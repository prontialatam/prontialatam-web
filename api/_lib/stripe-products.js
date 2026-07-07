const PRODUCTS = {
  "talleres-mecanicos": {
    slug: "talleres-mecanicos",
    name: "100 Prompts para Talleres Mecánicos",
    stripePriceEnv: "STRIPE_TALLERES_PRICE_ID",
    supportEmail: "hola@prontialatam.com",
    deliveryAssetUrl: "/downloads/kit-base-afiliados-talleres.zip",
    deliveryPageUrl: "/dossier-producto-talleres",
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
