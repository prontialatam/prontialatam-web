const { getSiteUrl, parseJsonBody, sendJson } = require("../_lib/http");
const { deliverOrder, findOrCreateCustomerRecord } = require("../_lib/order-fulfillment");
const { getProduct } = require("../_lib/stripe-products");
const supabase = require("../_lib/supabase");

function isAuthorized(req, body) {
  const expectedToken = (process.env.AFFILIATE_APPROVAL_TOKEN || "").trim();
  const headerToken = (req.headers["x-affiliate-admin-token"] || "").trim();
  const bodyToken = (body && body.adminToken ? String(body.adminToken).trim() : "");
  return Boolean(expectedToken) && (headerToken === expectedToken || bodyToken === expectedToken);
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function toAmount(value, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return Number(fallback || 0);
  }
  return Number(numeric.toFixed(2));
}

function createSimulationId(prefix) {
  const random = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now()}_${random}`;
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return sendJson(res, 405, { error: "Method not allowed" });
  }

  const body = await parseJsonBody(req);
  if (!isAuthorized(req, body)) {
    return sendJson(res, 401, { error: "No autorizado" });
  }

  if (!supabase.isConfigured()) {
    return sendJson(res, 500, { error: "Falta configurar Supabase" });
  }

  try {
    const affiliateId = String(body.affiliateId || "").trim();
    const productSlug = String(body.productSlug || "").trim();
    const customerName = String(body.customerName || "").trim();
    const customerEmail = normalizeEmail(body.customerEmail || "");
    const currency = String(body.currency || "USD").trim().toUpperCase() || "USD";
    const attributionType = String(body.attributionType || "affiliate_code").trim().toLowerCase() === "affiliate_link"
      ? "affiliate_link"
      : "affiliate_code";
    const product = getProduct(productSlug);

    if (!affiliateId) {
      return sendJson(res, 400, { error: "Necesitamos seleccionar un afiliado aprobado." });
    }

    if (!product) {
      return sendJson(res, 400, { error: "Producto no válido para la simulación." });
    }

    if (!customerName) {
      return sendJson(res, 400, { error: "Necesitamos un nombre de cliente para la simulación." });
    }

    if (!customerEmail || !isValidEmail(customerEmail)) {
      return sendJson(res, 400, { error: "Necesitamos un email válido para la simulación." });
    }

    const affiliate = await supabase.findOne(
      "affiliates",
      `id=eq.${encodeURIComponent(affiliateId)}&status=eq.approved`
    );
    if (!affiliate) {
      return sendJson(res, 404, { error: "No se encontró el afiliado aprobado seleccionado." });
    }

    const amountTotal = toAmount(body.amountTotal, product.defaultAmountUsd);
    if (!amountTotal) {
      return sendJson(res, 400, { error: "El importe de la simulación no es válido." });
    }

    const customer = await findOrCreateCustomerRecord({
      email: customerEmail,
      fullName: customerName,
      sourceChannel: "admin_simulation"
    });

    const commissionRate = Number(affiliate.commission_rate || process.env.AFFILIATE_DEFAULT_COMMISSION_RATE || "0.60");
    const commissionAmount = Number((amountTotal * commissionRate).toFixed(2));
    const sessionId = createSimulationId("sim_checkout");
    const paymentIntentId = createSimulationId("sim_pi");
    const createdAt = new Date().toISOString();
    const baseOrder = {
      stripe_checkout_session_id: sessionId,
      stripe_payment_intent_id: paymentIntentId,
      customer_id: customer ? customer.id : null,
      customer_email: customerEmail,
      customer_name: customerName,
      product_slug: product.slug,
      product_name: product.name,
      affiliate_id: affiliate.id,
      affiliate_code: affiliate.tracking_code,
      payment_status: "paid",
      amount_total: amountTotal,
      currency,
      landing_path: "/operativa-afiliados.html",
      utm_source: "admin_simulation",
      utm_medium: "internal_console",
      utm_campaign: product.slug,
      commission_amount: commissionAmount,
      source_metadata: {
        is_test_order: true,
        stripe_event_id: null,
        stripe_customer_id: null,
        affiliate_id: affiliate.id,
        affiliate_entered_code: affiliate.tracking_code,
        affiliate_match_type: attributionType,
        affiliate_resolved_code: affiliate.tracking_code,
        simulation: {
          created_at: createdAt,
          created_by: "operativa-afiliados",
          attribution_type: attributionType
        }
      }
    };

    const delivery = await deliverOrder({
      order: baseOrder,
      customer,
      affiliate,
      siteUrl: getSiteUrl(req),
      skipExternalFulfillment: true,
      deliveryEvent: "order.simulated_paid"
    });

    const inserted = await supabase.insert("orders", {
      ...baseOrder,
      fulfillment_status: delivery.fulfillmentStatus,
      source_metadata: {
        ...baseOrder.source_metadata,
        admin_notification: delivery.adminNotificationResult,
        delivery_asset_url: delivery.deliveryAssetUrl,
        delivery_page_url: delivery.deliveryPageUrl,
        email_delivery: delivery.emailResult
      }
    });

    const order = Array.isArray(inserted) ? inserted[0] : inserted;

    return sendJson(res, 200, {
      ok: true,
      orderId: order && order.id ? order.id : null,
      sessionId,
      affiliateCode: affiliate.tracking_code,
      customerEmail,
      emailResult: delivery.emailResult,
      adminNotificationResult: delivery.adminNotificationResult,
      fulfillmentStatus: delivery.fulfillmentStatus
    });
  } catch (error) {
    return sendJson(res, 500, {
      error: error.message || "No se pudo crear la compra simulada."
    });
  }
};
