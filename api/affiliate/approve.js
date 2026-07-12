const crypto = require("crypto");
const { getSiteUrl, parseJsonBody, sendJson } = require("../_lib/http");
const supabase = require("../_lib/supabase");
const { sendAffiliateOnboardingEmail } = require("../_lib/email");
const { buildProtectedPageUrl, buildProtectedResourceUrl } = require("../_lib/affiliate-access");
const { generateConnectOnboardingToken } = require("../_lib/stripe-connect");

function buildNicheAccesses(siteUrl, token, trackingCode) {
  return [
    {
      key: "talleres",
      label: "Talleres mecánicos",
      salesUrl: `${siteUrl}/talleres-mecanicos?ref=${trackingCode}`,
      kitUrl: buildProtectedResourceUrl(siteUrl, "downloads/kit-base-afiliados-talleres.zip", token),
      dossierUrl: buildProtectedPageUrl(siteUrl, "/dossier-producto-talleres", token),
      playbookUrl: buildProtectedPageUrl(siteUrl, "/playbook-afiliados-talleres", token),
      socialUrl: buildProtectedPageUrl(siteUrl, "/biblioteca-social-talleres", token)
    },
    {
      key: "restaurantes",
      label: "Restaurantes y hostelería",
      salesUrl: `${siteUrl}/restaurantes-hosteleria?ref=${trackingCode}`,
      kitUrl: buildProtectedResourceUrl(siteUrl, "downloads/kit-base-afiliados-restaurantes.zip", token),
      dossierUrl: buildProtectedPageUrl(siteUrl, "/dossier-producto-restaurantes", token),
      playbookUrl: buildProtectedPageUrl(siteUrl, "/playbook-afiliados-restaurantes", token),
      socialUrl: buildProtectedPageUrl(siteUrl, "/biblioteca-social-restaurantes", token)
    },
    {
      key: "estetica",
      label: "Centros de estética",
      salesUrl: `${siteUrl}/centros-estetica?ref=${trackingCode}`,
      kitUrl: buildProtectedResourceUrl(siteUrl, "downloads/kit-base-afiliados-estetica.zip", token),
      dossierUrl: buildProtectedPageUrl(siteUrl, "/dossier-producto-estetica", token),
      playbookUrl: buildProtectedPageUrl(siteUrl, "/playbook-afiliados-estetica", token),
      socialUrl: buildProtectedPageUrl(siteUrl, "/biblioteca-social-estetica", token)
    }
  ];
}

function sanitizeSegment(value) {
  return (value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
}

async function generateTrackingCode(fullName, email) {
  const base = sanitizeSegment(fullName) || sanitizeSegment((email || "").split("@")[0]) || "afiliado";

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const suffix = attempt === 0 ? "" : `-${crypto.randomBytes(2).toString("hex")}`;
    const candidate = `${base}${suffix}`;
    const existing = await supabase.findOne("affiliates", `tracking_code=eq.${encodeURIComponent(candidate)}`);
    if (!existing) return candidate;
  }

  return `${base}-${crypto.randomBytes(3).toString("hex")}`;
}

async function generateCouponCode(fullName) {
  const base = (sanitizeSegment(fullName) || "prontia").replace(/-/g, "").slice(0, 8).toUpperCase();
  const suffix = crypto.randomBytes(2).toString("hex").toUpperCase();
  return `PRONTIA-${base}-${suffix}`;
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return sendJson(res, 405, { error: "Method not allowed" });
  }

  const expectedToken = (process.env.AFFILIATE_APPROVAL_TOKEN || "").trim();
  const providedToken = (req.headers["x-affiliate-admin-token"] || "").trim();
  if (!expectedToken || providedToken !== expectedToken) {
    return sendJson(res, 401, { error: "No autorizado" });
  }

  if (!supabase.isConfigured()) {
    return sendJson(res, 500, { error: "Falta configurar Supabase para aprobar afiliados" });
  }

  try {
    const body = await parseJsonBody(req);
    const applicationId = (body.applicationId || "").trim();
    const email = (body.email || "").trim().toLowerCase();

    let application = null;
    if (applicationId) {
      application = await supabase.findOne("affiliate_applications", `id=eq.${encodeURIComponent(applicationId)}`);
    } else if (email) {
      application = await supabase.findOne("affiliate_applications", `email=eq.${encodeURIComponent(email)}`);
    }

    if (!application) {
      return sendJson(res, 404, { error: "No se encontró la solicitud de afiliado." });
    }

    const existingAffiliate = await supabase.findOne("affiliates", `email=eq.${encodeURIComponent(application.email)}`);
    const trackingCode = existingAffiliate && existingAffiliate.tracking_code
      ? existingAffiliate.tracking_code
      : await generateTrackingCode(application.full_name, application.email);
    const couponCode = existingAffiliate && existingAffiliate.coupon_code
      ? existingAffiliate.coupon_code
      : await generateCouponCode(application.full_name);
    const connectOnboardingToken = existingAffiliate && existingAffiliate.connect_onboarding_token
      ? existingAffiliate.connect_onboarding_token
      : generateConnectOnboardingToken();

    const commissionRate = Number(process.env.AFFILIATE_DEFAULT_COMMISSION_RATE || "0.60");
    const affiliatePayload = {
      status: "approved",
      full_name: application.full_name,
      email: application.email,
      country: application.country,
      phone_country_code: application.phone_country_code || null,
      phone_number: application.phone_number || null,
      tracking_code: trackingCode,
      coupon_code: couponCode,
      commission_rate: commissionRate,
      connect_onboarding_token: connectOnboardingToken,
      stripe_connect_status: existingAffiliate && existingAffiliate.stripe_connect_status
        ? existingAffiliate.stripe_connect_status
        : "not_started"
    };

    const affiliateResult = await supabase.upsert("affiliates", affiliatePayload, "email");
    const affiliate = Array.isArray(affiliateResult) ? affiliateResult[0] : affiliateResult;

    await supabase.update("affiliate_applications", `id=eq.${encodeURIComponent(application.id)}`, {
      status: "approved"
    });

    const siteUrl = getSiteUrl(req);
    const portalUrl = buildProtectedPageUrl(siteUrl, "/portal-afiliados", connectOnboardingToken);
    const affiliateLink = `${siteUrl}/talleres-mecanicos?ref=${trackingCode}`;
    const kitUrl = buildProtectedResourceUrl(siteUrl, "downloads/kit-base-afiliados-talleres.zip", connectOnboardingToken);
    const connectUrl = `${siteUrl}/api/affiliate/connect/start?token=${connectOnboardingToken}`;
    const brandLogoUrl = `${siteUrl}/logo-prontia.jpg`;
    const dossierUrl = buildProtectedPageUrl(siteUrl, "/dossier-marca-afiliados", connectOnboardingToken);
    const productDossierUrl = buildProtectedPageUrl(siteUrl, "/dossier-producto-talleres", connectOnboardingToken);
    const socialLibraryUrl = buildProtectedPageUrl(siteUrl, "/biblioteca-social-talleres", connectOnboardingToken);
    const whatsappCommunityUrl = (process.env.AFFILIATE_WHATSAPP_COMMUNITY_URL || "https://chat.whatsapp.com/L87FnfrSKmb2h7FJjmZkzk").trim();
    const nicheAccesses = buildNicheAccesses(siteUrl, connectOnboardingToken, trackingCode);

    const emailResult = await sendAffiliateOnboardingEmail({
      email: application.email,
      fullName: application.full_name,
      trackingCode,
      couponCode,
      portalUrl,
      affiliateLink,
      kitUrl,
      connectUrl,
      brandLogoUrl,
      dossierUrl,
      productDossierUrl,
      socialLibraryUrl,
      nicheAccesses,
      whatsappCommunityUrl,
      supportEmail: "hola@prontialatam.com",
      supportWhatsApp: "+34 697 47 46 46"
    });

    return sendJson(res, 200, {
      ok: true,
      affiliateId: affiliate ? affiliate.id : null,
      trackingCode,
      couponCode,
      affiliateLink,
      portalUrl,
      kitUrl,
      connectUrl,
      emailResult
    });
  } catch (error) {
    return sendJson(res, 500, {
      error: error.message || "No se pudo aprobar el afiliado."
    });
  }
};
