const Stripe = require("stripe");
const { getSiteUrl, readRawBody, sendJson } = require("../_lib/http");
const { sendPurchaseConfirmationEmail } = require("../_lib/email");
const supabase = require("../_lib/supabase");
const { summarizeAccount } = require("../_lib/stripe-connect");
const { getProduct } = require("../_lib/stripe-products");

async function queueFulfillment(payload) {
  const target = (process.env.ORDER_FULFILLMENT_WEBHOOK_URL || "").trim();
  if (!target) {
    return "not_configured";
  }

  const response = await fetch(target, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error("No se pudo notificar el flujo de entrega");
  }

  return "queued";
}

function buildAbsoluteUrl(siteUrl, path) {
  if (!path) return siteUrl;
  if (/^https?:\/\//i.test(path)) return path;
  const base = (siteUrl || "").replace(/\/$/, "");
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${base}${suffix}`;
}

async function deliverOrder(options) {
  const product = getProduct(options.order.product_slug || "");
  const siteUrl = options.siteUrl;
  const deliveryAssetUrl = buildAbsoluteUrl(siteUrl, product && product.deliveryAssetUrl ? product.deliveryAssetUrl : "/");
  const deliveryPageUrl = buildAbsoluteUrl(siteUrl, product && product.deliveryPageUrl ? product.deliveryPageUrl : "/");
  const brandLogoUrl = buildAbsoluteUrl(siteUrl, "/logo-prontia.jpg");
  const instagramIconUrl = buildAbsoluteUrl(siteUrl, "/assets/email-social/instagram.png");
  const facebookIconUrl = buildAbsoluteUrl(siteUrl, "/assets/email-social/facebook.png");
  const youtubeIconUrl = buildAbsoluteUrl(siteUrl, "/assets/email-social/youtube.png");
  const supportEmail = product && product.supportEmail ? product.supportEmail : "hola@prontialatam.com";
  let emailResult = { ok: false, skipped: true, reason: "not_attempted" };
  let fulfillmentStatus = "delivery_not_attempted";

  try {
    emailResult = await sendPurchaseConfirmationEmail({
      amountTotal: options.order.amount_total,
      currency: options.order.currency,
      deliveryAssetUrl,
      deliveryPageUrl,
      brandLogoUrl,
      email: options.order.customer_email,
      facebookIconUrl,
      fullName: options.order.customer_name,
      instagramIconUrl,
      productName: options.order.product_name || (product ? product.name : "Tu compra"),
      sessionId: options.order.stripe_checkout_session_id,
      supportEmail,
      supportWhatsApp: "+34 697 47 46 46",
      youtubeIconUrl
    });

    fulfillmentStatus = "delivered_email";
    if (emailResult && emailResult.skipped) {
      fulfillmentStatus = "delivery_missing_sender";
    }
  } catch (error) {
    emailResult = {
      ok: false,
      error: error.message || "No se pudo enviar el email de compra"
    };
    fulfillmentStatus = "delivery_email_failed";
  }

  const externalStatus = await queueFulfillment({
    event: "order.paid",
    order: options.order,
    customer: options.customer,
    affiliate: options.affiliate,
    delivery: {
      asset_url: deliveryAssetUrl,
      guide_url: deliveryPageUrl,
      email_result: emailResult
    }
  });

  if (externalStatus === "queued") {
    fulfillmentStatus = fulfillmentStatus === "delivered_email"
      ? "delivered_and_queued"
      : "delivery_partial_and_queued";
  }

  return {
    deliveryAssetUrl,
    deliveryPageUrl,
    emailResult,
    fulfillmentStatus
  };
}

async function findOrCreateCustomer(session) {
  if (!supabase.isConfigured()) {
    return null;
  }

  const email = session.customer_details && session.customer_details.email;
  if (!email) {
    return null;
  }

  const existing = await supabase.findOne("customers", `email=eq.${encodeURIComponent(email)}`);
  if (existing) return existing;

  const inserted = await supabase.insert("customers", {
    email,
    full_name: session.customer_details.name || null,
    country: session.customer_details.address && session.customer_details.address.country ? session.customer_details.address.country : null,
    source_channel: session.metadata && session.metadata.lead_source ? session.metadata.lead_source : "prontialatam_web"
  });

  return Array.isArray(inserted) ? inserted[0] : inserted;
}

async function resolveAffiliate(session) {
  if (!supabase.isConfigured()) {
    return null;
  }

  const code = session.metadata && session.metadata.affiliate_code ? session.metadata.affiliate_code : "";
  if (!code) return null;

  return supabase.findOne("affiliates", `tracking_code=eq.${encodeURIComponent(code)}`);
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

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

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
    const commissionRate = Number(process.env.AFFILIATE_DEFAULT_COMMISSION_RATE || "0.60");
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
        stripe_customer_id: session.customer || null
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
