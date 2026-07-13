const PRODUCTS = {
  "talleres-mecanicos": {
    slug: "talleres-mecanicos",
    name: "100 Prompts para Talleres Mecánicos",
    defaultAmountUsd: 29,
    stripePriceEnv: "STRIPE_TALLERES_PRICE_ID",
    supportEmail: "hola@prontialatam.com",
    deliveryAssetUrl: "/downloads/kit-base-afiliados-talleres.zip",
    deliveryPageUrl: "/dossier-producto-talleres",
    successPath: "/checkout-success",
    cancelPath: "/checkout-cancel"
  },
  "restaurantes-hosteleria": {
    slug: "restaurantes-hosteleria",
    name: "50 Prompts para Restaurantes y Hostelería",
    defaultAmountUsd: 20,
    stripePriceEnv: "STRIPE_RESTAURANTES_PRICE_ID",
    supportEmail: "hola@prontialatam.com",
    deliveryAssetUrl: "/recurso-restaurantes-hosteleria",
    deliveryPageUrl: "/recurso-restaurantes-hosteleria",
    successPath: "/checkout-success",
    cancelPath: "/checkout-cancel"
  },
  "centros-estetica": {
    slug: "centros-estetica",
    name: "Kit Agenda Llena 30 Días para Centros de Estética",
    defaultAmountUsd: 37,
    stripePriceEnv: "STRIPE_ESTETICA_PRICE_ID",
    supportEmail: "hola@prontialatam.com",
    deliveryAssetUrl: "/downloads/kit-agenda-llena-centros-estetica.zip",
    deliveryPageUrl: "/kit-agenda-llena-centros-estetica",
    successPath: "/checkout-success",
    cancelPath: "/checkout-cancel"
  }
};

function getProduct(slug) {
  return PRODUCTS[slug] || null;
}

function getStripePriceId(product) {
  const priceId = process.env[product.stripePriceEnv];
  if (!priceId) {
    throw new Error(`Falta configurar ${product.stripePriceEnv}`);
  }
  return priceId;
}

module.exports = {
  getProduct,
  getStripePriceId
};
