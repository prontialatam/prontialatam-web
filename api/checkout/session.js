const Stripe = require("stripe");
const { getSiteUrl, sendJson } = require("../_lib/http");
const { getProduct } = require("../_lib/stripe-products");

function getQueryParam(req, name) {
  const url = new URL(req.url, `https://${req.headers.host || "localhost"}`);
  return (url.searchParams.get(name) || "").trim();
}

function buildAbsoluteUrl(siteUrl, path) {
  if (!path) return siteUrl;
  if (/^https?:\/\//i.test(path)) return path;
  const base = (siteUrl || "").replace(/\/$/, "");
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${base}${suffix}`;
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    return sendJson(res, 405, { error: "Method not allowed" });
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return sendJson(res, 500, { error: "Falta configurar STRIPE_SECRET_KEY" });
  }

  const sessionId = getQueryParam(req, "session_id");
  if (!sessionId || !sessionId.startsWith("cs_")) {
    return sendJson(res, 400, { error: "Sesión de pago no válida." });
  }

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: process.env.STRIPE_API_VERSION || "2026-02-25.clover",
      maxNetworkRetries: 1
    });
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const product = getProduct(session.metadata && session.metadata.product_slug);

    if (!product) {
      return sendJson(res, 404, { error: "No hemos podido identificar el producto comprado." });
    }

    if (session.payment_status !== "paid") {
      return sendJson(res, 402, { error: "El pago todavía no aparece confirmado." });
    }

    const siteUrl = getSiteUrl(req);
    return sendJson(res, 200, {
      ok: true,
      productName: session.metadata && session.metadata.product_name ? session.metadata.product_name : product.name,
      customerEmail: session.customer_details && session.customer_details.email ? session.customer_details.email : "",
      delivery: {
        assetUrl: buildAbsoluteUrl(siteUrl, product.deliveryAssetUrl),
        pageUrl: buildAbsoluteUrl(siteUrl, product.deliveryPageUrl)
      },
      supportEmail: product.supportEmail || "hola@prontialatam.com"
    });
  } catch (error) {
    return sendJson(res, 500, {
      error: error.message || "No se pudo verificar la sesión de pago."
    });
  }
};
