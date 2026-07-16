const fs = require("fs");
const path = require("path");
const Stripe = require("stripe");
const { getProduct } = require("../_lib/stripe-products");

function getQueryParam(req, name) {
  const url = new URL(req.url, `https://${req.headers.host || "localhost"}`);
  return (url.searchParams.get(name) || "").trim();
}

function sendText(res, statusCode, message) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "private, no-store, max-age=0");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.end(message);
}

function resolveDeliveryFile(product) {
  const assetPath = String(product && product.deliveryAssetUrl || "").replace(/^\/+/, "");
  if (!product || !product.secureDownload || !assetPath.startsWith("downloads/")) {
    return null;
  }

  const downloadsRoot = path.resolve(process.cwd(), "downloads");
  const filePath = path.resolve(process.cwd(), assetPath);
  if (!filePath.startsWith(`${downloadsRoot}${path.sep}`)) {
    return null;
  }

  return filePath;
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    return sendText(res, 405, "Método no permitido");
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return sendText(res, 500, "No se pudo verificar el pago");
  }

  const sessionId = getQueryParam(req, "session_id");
  if (!/^cs_(?:live|test)_/.test(sessionId)) {
    return sendText(res, 401, "Necesitas una compra verificada para descargar este archivo");
  }

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: process.env.STRIPE_API_VERSION || "2026-02-25.clover",
      maxNetworkRetries: 1
    });
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== "paid") {
      return sendText(res, 402, "El pago todavía no aparece confirmado");
    }

    const product = getProduct(session.metadata && session.metadata.product_slug);
    const filePath = resolveDeliveryFile(product);
    if (!filePath) {
      return sendText(res, 403, "Esta compra no autoriza la descarga solicitada");
    }

    const stat = await fs.promises.stat(filePath);
    if (!stat.isFile()) {
      return sendText(res, 404, "Archivo no encontrado");
    }

    res.statusCode = 200;
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Length", String(stat.size));
    res.setHeader("Content-Disposition", `attachment; filename="${path.basename(filePath)}"`);
    res.setHeader("Cache-Control", "private, no-store, max-age=0");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("X-Content-Type-Options", "nosniff");
    fs.createReadStream(filePath).pipe(res);
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return sendText(res, 404, "Archivo no encontrado");
    }
    return sendText(res, 403, "No se pudo verificar el acceso a esta descarga");
  }
};
