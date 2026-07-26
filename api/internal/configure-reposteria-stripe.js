const crypto = require("crypto");
const Stripe = require("stripe");

const PRODUCT_SLUG = "reposteria-comida-desde-casa";
const PRODUCT_NAME = "Kit IA para Repostería y Negocios de Comida desde Casa";

function secureEqual(left, right) {
  const leftBuffer = Buffer.from(String(left || ""));
  const rightBuffer = Buffer.from(String(right || ""));
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "private, no-store, max-age=0");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.end(JSON.stringify(payload));
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return sendJson(res, 405, { error: "Método no permitido" });
  }

  const expectedToken = process.env.STRIPE_REPOSTERIA_SETUP_TOKEN;
  if (!expectedToken || !secureEqual(req.headers["x-setup-token"], expectedToken)) {
    return sendJson(res, 401, { error: "No autorizado" });
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return sendJson(res, 500, { error: "Falta la configuración privada de Stripe" });
  }

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: process.env.STRIPE_API_VERSION || "2026-02-25.clover",
      maxNetworkRetries: 1
    });

    const search = await stripe.products.search({
      query: `metadata["product_slug"]:"${PRODUCT_SLUG}"`,
      limit: 10
    });

    const product = search.data[0] || await stripe.products.create({
      name: PRODUCT_NAME,
      description: "Sistema práctico de IA para calcular precios, organizar pedidos, vender por WhatsApp y crear contenido para repostería y comida preparada desde casa.",
      active: true,
      metadata: {
        brand: "ProntIA LATAM",
        product_slug: PRODUCT_SLUG
      }
    }, {
      idempotencyKey: "prontia-reposteria-product-v1"
    });

    const prices = await stripe.prices.list({
      product: product.id,
      active: true,
      type: "one_time",
      limit: 100
    });

    const price = prices.data.find((candidate) => (
      candidate.currency === "usd" && candidate.unit_amount === 3700
    )) || await stripe.prices.create({
      product: product.id,
      currency: "usd",
      unit_amount: 3700,
      metadata: {
        product_slug: PRODUCT_SLUG
      }
    }, {
      idempotencyKey: "prontia-reposteria-price-usd-37-v1"
    });

    return sendJson(res, 200, {
      configured: true,
      productId: product.id,
      priceId: price.id,
      currency: price.currency,
      unitAmount: price.unit_amount
    });
  } catch (error) {
    return sendJson(res, 500, {
      error: error.message || "No se pudo configurar Stripe"
    });
  }
};
