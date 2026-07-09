const { getSiteUrl, parseJsonBody, sendJson } = require("../_lib/http");
const supabase = require("../_lib/supabase");
const { sendAffiliateOnboardingEmail } = require("../_lib/email");
const { buildProtectedPageUrl, buildProtectedResourceUrl } = require("../_lib/affiliate-access");
const { generateConnectOnboardingToken } = require("../_lib/stripe-connect");

function isAuthorized(req, body) {
  const expectedToken = (process.env.AFFILIATE_APPROVAL_TOKEN || "").trim();
  const headerToken = (req.headers["x-affiliate-admin-token"] || "").trim();
  const bodyToken = (body && body.adminToken ? String(body.adminToken).trim() : "");
  return Boolean(expectedToken) && (headerToken === expectedToken || bodyToken === expectedToken);
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return sendJson(res, 405, { error: "Method not allowed" });
  }

  const body = await parseJsonBody(req);
  if (!isAuthorized(req, body)) {
    return sendJson(res, 401, { error: "No autorizado" });
  }

  if (!supabase.isConfigured()) {
    return sendJson(res, 500, { error: "Falta configurar Supabase" });
  }

  try {
    const affiliateId = (body.affiliateId || "").trim();
    const email = (body.email || "").trim().toLowerCase();

    let affiliate = null;
    if (affiliateId) {
      affiliate = await supabase.findOne("affiliates", `id=eq.${encodeURIComponent(affiliateId)}`);
    } else if (email) {
      affiliate = await supabase.findOne("affiliates", `email=eq.${encodeURIComponent(email)}`);
    }

    if (!affiliate) {
      return sendJson(res, 404, { error: "No se encontró el afiliado." });
    }

    let connectOnboardingToken = affiliate.connect_onboarding_token;
    if (!connectOnboardingToken) {
      connectOnboardingToken = generateConnectOnboardingToken();
      await supabase.update("affiliates", `id=eq.${encodeURIComponent(affiliate.id)}`, {
        connect_onboarding_token: connectOnboardingToken
      });
    }

    const siteUrl = getSiteUrl(req);
    const portalUrl = buildProtectedPageUrl(siteUrl, "/portal-afiliados", connectOnboardingToken);
    const affiliateLink = `${siteUrl}/talleres-mecanicos?ref=${affiliate.tracking_code}`;
    const kitUrl = buildProtectedResourceUrl(siteUrl, "downloads/kit-base-afiliados-talleres.zip", connectOnboardingToken);
    const connectUrl = `${siteUrl}/api/affiliate/connect/start?token=${connectOnboardingToken}`;
    const brandLogoUrl = `${siteUrl}/logo-prontia.jpg`;
    const dossierUrl = buildProtectedPageUrl(siteUrl, "/dossier-marca-afiliados", connectOnboardingToken);
    const productDossierUrl = buildProtectedPageUrl(siteUrl, "/dossier-producto-talleres", connectOnboardingToken);
    const socialLibraryUrl = buildProtectedPageUrl(siteUrl, "/biblioteca-social-talleres", connectOnboardingToken);

    const emailResult = await sendAffiliateOnboardingEmail({
      email: affiliate.email,
      fullName: affiliate.full_name,
      trackingCode: affiliate.tracking_code,
      couponCode: affiliate.coupon_code || "",
      portalUrl,
      affiliateLink,
      kitUrl,
      connectUrl,
      brandLogoUrl,
      dossierUrl,
      productDossierUrl,
      socialLibraryUrl,
      supportEmail: "hola@prontialatam.com",
      supportWhatsApp: "+34 697 47 46 46"
    });

    return sendJson(res, 200, {
      ok: true,
      affiliateId: affiliate.id,
      emailResult
    });
  } catch (error) {
    return sendJson(res, 500, {
      error: error.message || "No se pudo reenviar el onboarding."
    });
  }
};
