const { sendPurchaseAdminNotificationEmail, sendPurchaseConfirmationEmail } = require("./email");
const { getDeliveryAssetPath, getProduct } = require("./stripe-products");
const supabase = require("./supabase");

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
  const deliveryAssetUrl = buildAbsoluteUrl(
    siteUrl,
    getDeliveryAssetPath(product, options.order.stripe_checkout_session_id)
  );
  const deliveryPageUrl = buildAbsoluteUrl(siteUrl, product && product.deliveryPageUrl ? product.deliveryPageUrl : "/");
  const brandLogoUrl = buildAbsoluteUrl(siteUrl, "/logo-prontia.jpg");
  const instagramIconUrl = buildAbsoluteUrl(siteUrl, "/assets/email-social/instagram.png");
  const facebookIconUrl = buildAbsoluteUrl(siteUrl, "/assets/email-social/facebook.png");
  const youtubeIconUrl = buildAbsoluteUrl(siteUrl, "/assets/email-social/youtube.png");
  const supportEmail = product && product.supportEmail ? product.supportEmail : "hola@prontialatam.com";
  const deliveryEvent = options.deliveryEvent || "order.paid";
  let emailResult = { ok: false, skipped: true, reason: "not_attempted" };
  let adminNotificationResult = { ok: false, skipped: true, reason: "not_attempted" };
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

  try {
    adminNotificationResult = await sendPurchaseAdminNotificationEmail({
      adminUrl: `${siteUrl}/operativa-afiliados.html`,
      affiliateCode: options.order.affiliate_code,
      affiliateName: options.affiliate ? options.affiliate.full_name : "",
      amountTotal: options.order.amount_total,
      commissionAmount: options.order.commission_amount,
      currency: options.order.currency,
      customerEmail: options.order.customer_email,
      customerName: options.order.customer_name,
      fulfillmentStatus,
      productName: options.order.product_name || (product ? product.name : "Tu compra"),
      sessionId: options.order.stripe_checkout_session_id
    });
  } catch (error) {
    adminNotificationResult = {
      ok: false,
      error: error.message || "No se pudo enviar la notificación interna de compra"
    };
  }

  if (!options.skipExternalFulfillment) {
    const externalStatus = await queueFulfillment({
      event: deliveryEvent,
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
  }

  return {
    adminNotificationResult,
    deliveryAssetUrl,
    deliveryPageUrl,
    emailResult,
    fulfillmentStatus
  };
}

async function findOrCreateCustomerRecord(customer) {
  if (!supabase.isConfigured()) {
    return null;
  }

  const email = customer && customer.email ? String(customer.email).trim().toLowerCase() : "";
  if (!email) {
    return null;
  }

  const existing = await supabase.findOne("customers", `email=eq.${encodeURIComponent(email)}`);
  if (existing) return existing;

  const inserted = await supabase.insert("customers", {
    email,
    full_name: customer.fullName || null,
    country: customer.country || null,
    source_channel: customer.sourceChannel || "prontialatam_web"
  });

  return Array.isArray(inserted) ? inserted[0] : inserted;
}

module.exports = {
  buildAbsoluteUrl,
  deliverOrder,
  findOrCreateCustomerRecord
};
