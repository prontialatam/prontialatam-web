const Stripe = require("stripe");
const { getSiteUrl, parseJsonBody, sendJson } = require("../_lib/http");
const { getProduct, getStripePriceId } = require("../_lib/stripe-products");
const { resolveAffiliateByCode, sanitizeTrackingCode } = require("../_lib/affiliate-codes");

function summarizeStripeError(error) {
  const cause = error && error.cause ? error.cause : null;
  return {
    message: error && error.message ? error.message : "Stripe error",
    type: error && error.type ? error.type : null,
    code: error && error.code ? error.code : null,
    decline_code: error && error.decline_code ? error.decline_code : null,
    statusCode: error && error.statusCode ? error.statusCode : null,
    requestId: error && error.requestId ? error.requestId : null,
    cause: cause ? {
      name: cause.name || null,
      code: cause.code || null,
      message: cause.message || null,
      errno: cause.errno || null,
      syscall: cause.syscall || null,
      host: cause.host || null,
      port: cause.port || null
    } : null
  };
}

function suffix(value) {
  if (!value) return null;
  return String(value).slice(-4);
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return sendJson(res, 405, { error: "Method not allowed" });
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return sendJson(res, 500, { error: "Falta configurar STRIPE_SECRET_KEY" });
  }

  try {
    const body = await parseJsonBody(req);
    const product = getProduct(body.productSlug);
    if (!product) {
      return sendJson(res, 400, { error: "Producto no soportado en esta fase." });
    }

    const enteredAffiliateCode = String(body.refCode || "").trim();
    let resolvedAffiliate = null;
    if (enteredAffiliateCode) {
      try {
        resolvedAffiliate = await resolveAffiliateByCode(enteredAffiliateCode);
      } catch (_error) {
        resolvedAffiliate = null;
      }
    }
    const affiliateTrackingCode = resolvedAffiliate
      ? resolvedAffiliate.affiliate.tracking_code
      : sanitizeTrackingCode(enteredAffiliateCode);

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      maxNetworkRetries: 1
    });
    const siteUrl = getSiteUrl(req);
    const priceId = getStripePriceId(product);

    console.log("checkout_env_snapshot", {
      stripeSecretSuffix: suffix(process.env.STRIPE_SECRET_KEY),
      priceIdSuffix: suffix(priceId),
      productSlug: product.slug
    });

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price: priceId,
          quantity: 1
        }
      ],
      allow_promotion_codes: true,
      billing_address_collection: "auto",
      customer_creation: "always",
      success_url: `${siteUrl}${product.successPath}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}${product.cancelPath}`,
      metadata: {
        product_slug: product.slug,
        product_name: product.name,
        affiliate_code: affiliateTrackingCode || "",
        affiliate_entered_code: enteredAffiliateCode || "",
        affiliate_match_type: resolvedAffiliate ? resolvedAffiliate.matchedBy : "",
        landing_path: body.landingPath || "",
        utm_source: body.utmSource || "",
        utm_medium: body.utmMedium || "",
        utm_campaign: body.utmCampaign || "",
        lead_source: "prontialatam_web"
      }
    });

    return sendJson(res, 200, {
      ok: true,
      url: session.url,
      sessionId: session.id
    });
  } catch (error) {
    console.error("checkout_create_session_failed", summarizeStripeError(error));
    return sendJson(res, 500, {
      error: error.message || "No se pudo crear la sesión de checkout."
    });
  }
};
