const crypto = require("crypto");

const PUBLIC_KIT_LINK_TTL_SECONDS = 7 * 24 * 60 * 60;

const KITS = {
  principiantes: {
    key: "principiantes",
    title: "Kit Venta de Productos Digitales para Principiantes",
    shortTitle: "Kit para principiantes",
    badge: "Empezar desde cero",
    description: "Método, plan de 30 días, checklist y reto inicial para entender el modelo y arrancar con una base clara.",
    downloadAsset: "downloads/kit-venta-productos-digitales-principiantes.zip",
    downloadRoute: "/descargar/kit-gratis-afiliados?kit=principiantes",
    audienceType: "Lead intermedio: Kit Venta de Productos Digitales para Principiantes",
    mainChannel: "Lead magnet - Kit Gratis Afiliados",
    followUpAction: "Accion recomendada: enviar seguimiento por WhatsApp/email para que complete /afiliados#solicitud.",
    challengeRoute: "/afiliados#reto-7-dias",
    emailSubject: "Tu kit gratuito para empezar en afiliados ya esta listo",
    successTitle: "Listo. Tu kit para principiantes está preparado.",
    successBody: "Te acabamos de enviar el acceso por email. Revisa tu bandeja de entrada y, si no aparece en unos minutos, mira spam o promociones.",
    successCta: "Ir al programa de afiliados"
  },
  "30d-contenido": {
    key: "30d-contenido",
    title: "30 días de contenido para conseguir tus primeras conversaciones de venta",
    shortTitle: "Kit 30D de contenido",
    badge: "Publicar y conversar",
    description: "Calendario, copies, ganchos, guiones, CTA, mensajes y prompts para dejar de improvisar y empezar a generar conversaciones.",
    downloadAsset: "downloads/kit-30-dias-contenido-conversaciones.zip",
    downloadRoute: "/descargar/kit-gratis-afiliados?kit=30d-contenido",
    audienceType: "Lead intermedio: Kit 30D de contenido para primeras conversaciones",
    mainChannel: "Lead magnet - Kit 30D Conversaciones",
    followUpAction: "Accion recomendada: activar seguimiento por email/WhatsApp para mover el lead hacia solicitud de afiliado y reto de ejecucion.",
    challengeRoute: "",
    emailSubject: "Tu kit 30D de contenido ya esta listo",
    successTitle: "Listo. Tu Kit 30D ya está preparado.",
    successBody: "Te acabamos de enviar el acceso por email para que empieces a publicar con estructura. Si no lo ves en unos minutos, revisa spam o promociones.",
    successCta: "Ir al programa de afiliados"
  }
};

function getPublicKit(key) {
  if (key && KITS[key]) return KITS[key];
  return KITS.principiantes;
}

function listPublicKits() {
  return Object.values(KITS);
}

function getPublicKitDownloadSecret() {
  return (
    process.env.PUBLIC_KIT_DOWNLOAD_SECRET ||
    process.env.AFFILIATE_APPROVAL_TOKEN ||
    ""
  ).trim();
}

function buildSignedKitToken(key, email, expiresAt) {
  const secret = getPublicKitDownloadSecret();
  if (!secret) return "";
  return crypto
    .createHmac("sha256", secret)
    .update(`${key}:${String(email || "").toLowerCase()}:${String(expiresAt || "")}`)
    .digest("hex");
}

function buildPublicKitDownloadUrl(siteUrl, key, email) {
  const kit = getPublicKit(key);
  const expiresAt = Math.floor(Date.now() / 1000) + PUBLIC_KIT_LINK_TTL_SECONDS;
  const url = new URL(kit.downloadRoute, siteUrl);
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const token = buildSignedKitToken(kit.key, normalizedEmail, expiresAt);
  url.searchParams.set("email", normalizedEmail);
  url.searchParams.set("expires", String(expiresAt));
  url.searchParams.set("token", token);
  return url.toString();
}

function verifyPublicKitDownloadAccess(key, email, expiresAt, token) {
  const secret = getPublicKitDownloadSecret();
  if (!secret) {
    return { ok: false, reason: "missing_secret" };
  }

  const normalizedEmail = String(email || "").trim().toLowerCase();
  const normalizedToken = String(token || "").trim();
  const normalizedExpires = Number(expiresAt);

  if (!normalizedEmail || !normalizedToken || !Number.isFinite(normalizedExpires)) {
    return { ok: false, reason: "missing_params" };
  }

  if (normalizedExpires < Math.floor(Date.now() / 1000)) {
    return { ok: false, reason: "expired" };
  }

  const expectedToken = buildSignedKitToken(key, normalizedEmail, normalizedExpires);
  if (!expectedToken || normalizedToken.length !== expectedToken.length) {
    return { ok: false, reason: "invalid_token" };
  }

  if (!crypto.timingSafeEqual(Buffer.from(normalizedToken), Buffer.from(expectedToken))) {
    return { ok: false, reason: "invalid_token" };
  }

  return { ok: true };
}

module.exports = {
  KITS,
  getPublicKit,
  listPublicKits,
  buildPublicKitDownloadUrl,
  verifyPublicKitDownloadAccess
};
