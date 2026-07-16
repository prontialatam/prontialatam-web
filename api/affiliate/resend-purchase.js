const { getSiteUrl, parseJsonBody, sendJson } = require("../_lib/http");
const { sendPurchaseConfirmationEmail } = require("../_lib/email");
const { getDeliveryAssetPath, getProduct } = require("../_lib/stripe-products");
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

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
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
    const requestedRecipientEmail = normalizeEmail(body.recipientEmail || body.emailOverride || "");

    let order = null;
    if (orderId) {
      order = await supabase.findOne("orders", `id=eq.${encodeURIComponent(orderId)}`);
    } else if (sessionId) {
      order = await supabase.findOne("orders", `stripe_checkout_session_id=eq.${encodeURIComponent(sessionId)}`);
    }

    if (!order) {
      return sendJson(res, 404, { error: "No se encontró el pedido." });
    }

    if (requestedRecipientEmail && !isValidEmail(requestedRecipientEmail)) {
      return sendJson(res, 400, { error: "El email alternativo no tiene un formato válido." });
    }

    const originalCustomerEmail = normalizeEmail(order.customer_email);
    const targetEmail = requestedRecipientEmail || originalCustomerEmail;
    if (!targetEmail || !isValidEmail(targetEmail)) {
      return sendJson(res, 400, { error: "El pedido no tiene un email de comprador válido." });
    }

    const sentToOriginalCustomer = targetEmail === originalCustomerEmail;
    const siteUrl = getSiteUrl(req);
    const product = getProduct(order.product_slug || "");
    const deliveryAssetUrl = buildAbsoluteUrl(
      siteUrl,
      getDeliveryAssetPath(product, order.stripe_checkout_session_id)
    );
    const deliveryPageUrl = buildAbsoluteUrl(siteUrl, product && product.deliveryPageUrl ? product.deliveryPageUrl : "/");
    const brandLogoUrl = buildAbsoluteUrl(siteUrl, "/logo-prontia.jpg");
    const instagramIconUrl = buildAbsoluteUrl(siteUrl, "/assets/email-social/instagram.png");
    const facebookIconUrl = buildAbsoluteUrl(siteUrl, "/assets/email-social/facebook.png");
    const youtubeIconUrl = buildAbsoluteUrl(siteUrl, "/assets/email-social/youtube.png");
    const supportEmail = product && product.supportEmail ? product.supportEmail : "hola@prontialatam.com";

    const emailResult = await sendPurchaseConfirmationEmail({
      amountTotal: Number(order.amount_total || 0),
      brandLogoUrl,
      currency: order.currency,
      deliveryAssetUrl,
      deliveryPageUrl,
      email: targetEmail,
      facebookIconUrl,
      fullName: order.customer_name,
      instagramIconUrl,
      productName: order.product_name || (product ? product.name : "Tu compra"),
      sessionId: order.stripe_checkout_session_id,
      supportEmail,
      supportWhatsApp: "+34 697 47 46 46",
      youtubeIconUrl
    });

    const existingMetadata = order.source_metadata && typeof order.source_metadata === "object"
      ? order.source_metadata
      : {};
    const resendEntry = {
      at: new Date().toISOString(),
      to: targetEmail,
      original_customer_email: originalCustomerEmail || null,
      sent_to_original_customer: sentToOriginalCustomer,
      email_result: emailResult
    };

    await supabase.update("orders", `id=eq.${encodeURIComponent(order.id)}`, {
      fulfillment_status: emailResult && emailResult.ok && sentToOriginalCustomer
        ? "delivered_email"
        : order.fulfillment_status,
      source_metadata: {
        ...existingMetadata,
        delivery_asset_url: deliveryAssetUrl,
        delivery_page_url: deliveryPageUrl,
        email_delivery: sentToOriginalCustomer ? emailResult : existingMetadata.email_delivery,
        last_purchase_email_resend: resendEntry
      }
    });

    return sendJson(res, 200, {
      ok: true,
      orderId: order.id,
      recipientEmail: targetEmail,
      sentToOriginalCustomer,
      emailResult
    });
  } catch (error) {
    return sendJson(res, 500, {
      error: error.message || "No se pudo reenviar el email de compra."
    });
  }
};
