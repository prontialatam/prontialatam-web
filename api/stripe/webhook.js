const Stripe = require("stripe");
const { readRawBody, sendJson } = require("../_lib/http");
const supabase = require("../_lib/supabase");

async function queueFulfillment(payload) {
  const target = (process.env.ORDER_FULFILLMENT_WEBHOOK_URL || "").trim();
  if (!target) {
    return "pending_manual";
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

    const fulfillmentStatus = await queueFulfillment({
      event: "order.paid",
      order: baseOrder,
      customer,
      affiliate
    });

    if (supabase.isConfigured()) {
      await supabase.upsert("orders", {
        ...baseOrder,
        fulfillment_status: fulfillmentStatus
      }, "stripe_checkout_session_id");
    }

    return sendJson(res, 200, { received: true });
  } catch (error) {
    return sendJson(res, 400, {
      error: error.message || "Webhook inválido"
    });
  }
};
