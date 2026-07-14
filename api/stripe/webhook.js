const Stripe = require("stripe");
const { getSiteUrl, readRawBody, sendJson } = require("../_lib/http");
const supabase = require("../_lib/supabase");
const { deliverOrder, findOrCreateCustomerRecord } = require("../_lib/order-fulfillment");
const { summarizeAccount } = require("../_lib/stripe-connect");
const { resolveAffiliateByCode } = require("../_lib/affiliate-codes");

async function findOrCreateCustomer(session) {
  return findOrCreateCustomerRecord({
    email: session.customer_details && session.customer_details.email,
    fullName: session.customer_details && session.customer_details.name ? session.customer_details.name : null,
    country: session.customer_details && session.customer_details.address && session.customer_details.address.country
      ? session.customer_details.address.country
      : null,
    sourceChannel: session.metadata && session.metadata.lead_source ? session.metadata.lead_source : "prontialatam_web"
  });
}

async function resolveAffiliate(session) {
  if (!supabase.isConfigured()) {
    return null;
  }

  const affiliateId = session.metadata && session.metadata.affiliate_id
    ? session.metadata.affiliate_id
    : session.client_reference_id || "";
  if (affiliateId) {
    const byId = await supabase.findOne(
      "affiliates",
      `id=eq.${encodeURIComponent(affiliateId)}&status=eq.approved`
    );
    if (byId) return byId;
  }

  const code = session.metadata && session.metadata.affiliate_code ? session.metadata.affiliate_code : "";
  if (code) {
    const byTracking = await supabase.findOne(
      "affiliates",
      `tracking_code=eq.${encodeURIComponent(code)}&status=eq.approved`
    );
    if (byTracking) return byTracking;
  }

  const enteredCode = session.metadata && session.metadata.affiliate_entered_code
    ? session.metadata.affiliate_entered_code
    : "";
  if (!enteredCode) return null;

  const resolved = await resolveAffiliateByCode(enteredCode);
  return resolved ? resolved.affiliate : null;
}

async function updateAffiliateConnectStatus(account) {
  if (!supabase.isConfigured() || !account || !account.id) {
    return false;
  }

  const affiliate = await supabase.findOne("affiliates", `stripe_connect_account_id=eq.${encodeURIComponent(account.id)}`);
  if (!affiliate) {
    return false;
  }

  const summary = summarizeAccount(account);
  const payload = {
    stripe_connect_status: summary.status,
    stripe_connect_requirements_due: summary.requirementsDue,
    stripe_connect_metadata: summary.metadata
  };

  if (summary.status === "ready" || summary.status === "submitted") {
    payload.connect_onboarding_completed_at = new Date().toISOString();
  }

  await supabase.update("affiliates", `id=eq.${encodeURIComponent(affiliate.id)}`, payload);
  return true;
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return sendJson(res, 405, { error: "Method not allowed" });
  }

  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    return sendJson(res, 500, { error: "Faltan credenciales de Stripe para el webhook" });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: process.env.STRIPE_API_VERSION || "2026-02-25.clover"
  });

  try {
    const rawBody = await readRawBody(req);
    const signature = req.headers["stripe-signature"];
    const event = stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);

    if (event.type === "account.updated" || event.type.indexOf("v2.core.account") === 0) {
      const updated = await updateAffiliateConnectStatus(event.data.object);
      return sendJson(res, 200, { received: true, connectUpdated: updated });
    }

    if (event.type !== "checkout.session.completed") {
      return sendJson(res, 200, { received: true, ignored: event.type });
    }

    const session = event.data.object;
    const customer = await findOrCreateCustomer(session);
    const affiliate = await resolveAffiliate(session);
    const amountTotal = typeof session.amount_total === "number" ? Number((session.amount_total / 100).toFixed(2)) : null;
    const commissionRate = affiliate
      ? Number(affiliate.commission_rate || process.env.AFFILIATE_DEFAULT_COMMISSION_RATE || "0.60")
      : Number(process.env.AFFILIATE_DEFAULT_COMMISSION_RATE || "0.60");
    const commissionAmount = affiliate && amountTotal ? Number((amountTotal * commissionRate).toFixed(2)) : null;

    const baseOrder = {
      stripe_checkout_session_id: session.id,
      stripe_payment_intent_id: session.payment_intent || null,
      customer_id: customer ? customer.id : null,
      customer_email: session.customer_details ? session.customer_details.email : null,
      customer_name: session.customer_details ? session.customer_details.name : null,
      product_slug: session.metadata ? session.metadata.product_slug : null,
      product_name: session.metadata ? session.metadata.product_name : null,
      affiliate_id: affiliate ? affiliate.id : null,
      affiliate_code: session.metadata ? session.metadata.affiliate_code || null : null,
      payment_status: session.payment_status || "paid",
      amount_total: amountTotal,
      currency: session.currency ? session.currency.toUpperCase() : null,
      landing_path: session.metadata ? session.metadata.landing_path || null : null,
      utm_source: session.metadata ? session.metadata.utm_source || null : null,
      utm_medium: session.metadata ? session.metadata.utm_medium || null : null,
      utm_campaign: session.metadata ? session.metadata.utm_campaign || null : null,
      commission_amount: commissionAmount,
      source_metadata: {
        stripe_event_id: event.id,
        stripe_customer_id: session.customer || null,
        affiliate_id: session.metadata ? session.metadata.affiliate_id || session.client_reference_id || null : session.client_reference_id || null,
        affiliate_entered_code: session.metadata ? session.metadata.affiliate_entered_code || null : null,
        affiliate_match_type: session.metadata ? session.metadata.affiliate_match_type || null : null,
        affiliate_resolved_code: session.metadata ? session.metadata.affiliate_code || null : null
      }
    };

    const siteUrl = getSiteUrl(req);
    const delivery = await deliverOrder({
      order: baseOrder,
      customer,
      affiliate,
      siteUrl
    });

    if (supabase.isConfigured()) {
      await supabase.upsert("orders", {
        ...baseOrder,
        fulfillment_status: delivery.fulfillmentStatus,
        source_metadata: {
          ...baseOrder.source_metadata,
          admin_notification: delivery.adminNotificationResult,
          delivery_asset_url: delivery.deliveryAssetUrl,
          delivery_page_url: delivery.deliveryPageUrl,
          email_delivery: delivery.emailResult
        }
      }, "stripe_checkout_session_id");
    }

    return sendJson(res, 200, { received: true });
  } catch (error) {
    return sendJson(res, 400, {
      error: error.message || "Webhook inválido"
    });
  }
};
