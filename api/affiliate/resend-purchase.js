const { getSiteUrl, parseJsonBody, sendJson } = require("../_lib/http");
const { sendPurchaseConfirmationEmail } = require("../_lib/email");
const { getProduct } = require("../_lib/stripe-products");
const supabase = require("../_lib/supabase");

function isAuthorized(req, body) {
  const expectedToken = (process.env.AFFILIATE_APPROVAL_TOKEN || "").trim();
  const headerToken = (req.headers["x-affiliate-admin-token"] || "").trim();
  const bodyToken = (body && body.adminToken ? String(body.adminToken).trim() : "");
  return Boolean(expectedToken) && (headerToken === expectedToken || bodyToken === expectedToken);
}

function buildAbsoluteUrl(siteUrl, path) {
  if (!path) return siteUrl;
  if (/^https?:\/\//i.test(path)) return path;
  const base = (siteUrl || "").replace(/\/$/, "");
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${base}${suffix}`;
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
    const orderId = String(body.orderId || "").trim();
    const sessionId = String(body.sessionId || "").trim();

    let order = null;
    if (orderId) {
      order = await supabase.findOne("orders", `id=eq.${encodeURIComponent(orderId)}`);
    } else if (sessionId) {
      order = await supabase.findOne("orders", `stripe_checkout_session_id=eq.${encodeURIComponent(sessionId)}`);
    }

    if (!order) {
      return sendJson(res, 404, { error: "No se encontró el pedido." });
    }

    const siteUrl = getSiteUrl(req);
    const product = getProduct(order.product_slug || "");
    const deliveryAssetUrl = buildAbsoluteUrl(siteUrl, product && product.deliveryAssetUrl ? product.deliveryAssetUrl : "/");
    const deliveryPageUrl = buildAbsoluteUrl(siteUrl, product && product.deliveryPageUrl ? product.deliveryPageUrl : "/");
    const supportEmail = product && product.supportEmail ? product.supportEmail : "hola@prontialatam.com";

    const emailResult = await sendPurchaseConfirmationEmail({
      amountTotal: Number(order.amount_total || 0),
      currency: order.currency,
      deliveryAssetUrl,
      deliveryPageUrl,
      email: order.customer_email,
      fullName: order.customer_name,
      productName: order.product_name || (product ? product.name : "Tu compra"),
      sessionId: order.stripe_checkout_session_id,
      supportEmail
    });

    await supabase.update("orders", `id=eq.${encodeURIComponent(order.id)}`, {
      fulfillment_status: emailResult && emailResult.ok ? "delivered_email" : "delivery_missing_sender",
      source_metadata: {
        ...(order.source_metadata || {}),
        delivery_asset_url: deliveryAssetUrl,
        delivery_page_url: deliveryPageUrl,
        email_delivery: emailResult,
        resent_at: new Date().toISOString()
      }
    });

    return sendJson(res, 200, {
      ok: true,
      orderId: order.id,
      emailResult
    });
  } catch (error) {
    return sendJson(res, 500, {
      error: error.message || "No se pudo reenviar el email de compra."
    });
  }
};
