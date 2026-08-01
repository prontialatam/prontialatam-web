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
    successBody: "La descarga del ZIP debería empezar ahora mismo. También te hemos enviado el acceso por email para que lo revises con calma.",
    successCta: "Descargar el kit para principiantes"
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
    successBody: "La descarga del ZIP debería empezar ahora mismo. También te hemos enviado el acceso por email para que empieces hoy mismo a publicar con estructura.",
    successCta: "Descargar el Kit 30D"
  }
};

function getPublicKit(key) {
  if (key && KITS[key]) return KITS[key];
  return KITS.principiantes;
}

function listPublicKits() {
  return Object.values(KITS);
}

function buildPublicKitDownloadUrl(siteUrl, key) {
  const kit = getPublicKit(key);
  return new URL(kit.downloadRoute, siteUrl).toString();
}

module.exports = {
  KITS,
  getPublicKit,
  listPublicKits,
  buildPublicKitDownloadUrl
};
