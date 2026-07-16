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

function resolveStorageAsset(product) {
  if (
    !product ||
    !product.secureDownload ||
    !product.storageBucket ||
    !product.storageObjectPath ||
    !product.deliveryFilename
  ) {
    return null;
  }

  const bucket = String(product.storageBucket).trim();
  const objectPath = String(product.storageObjectPath).replace(/^\/+/, "");
  const filename = String(product.deliveryFilename).replace(/[\r\n"\\/]/g, "-");
  if (!bucket || !objectPath || objectPath.includes("..") || !filename) {
    return null;
  }

  return { bucket, objectPath, filename };
}

async function downloadPrivateAsset(asset) {
  const supabaseUrl = String(process.env.SUPABASE_URL || "").replace(/\/$/, "");
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Falta la configuración privada de Supabase");
  }

  const encodedPath = asset.objectPath.split("/").map(encodeURIComponent).join("/");
  const response = await fetch(
    `${supabaseUrl}/storage/v1/object/authenticated/${encodeURIComponent(asset.bucket)}/${encodedPath}`,
    {
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey
      }
    }
  );

  if (!response.ok) {
    throw new Error(`Supabase Storage devolvió ${response.status}`);
  }

  return Buffer.from(await response.arrayBuffer());
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
    const asset = resolveStorageAsset(product);
    if (!asset) {
      return sendText(res, 403, "Esta compra no autoriza la descarga solicitada");
    }

    const file = await downloadPrivateAsset(asset);

    res.statusCode = 200;
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Length", String(file.length));
    res.setHeader("Content-Disposition", `attachment; filename="${asset.filename}"`);
    res.setHeader("Cache-Control", "private, no-store, max-age=0");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.end(file);
  } catch (error) {
    return sendText(res, 403, "No se pudo verificar el acceso a esta descarga");
  }
};
