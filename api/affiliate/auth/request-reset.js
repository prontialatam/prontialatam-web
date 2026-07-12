const { getSiteUrl, parseJsonBody, sendJson } = require("../../_lib/http");
const supabase = require("../../_lib/supabase");
const {
  ensureAffiliateAuthUser,
  requestAffiliatePasswordRecovery
} = require("../../_lib/affiliate-auth");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return sendJson(res, 405, { error: "Method not allowed" });
  }

  if (!supabase.isConfigured()) {
    return sendJson(res, 500, { error: "Falta configurar Supabase." });
  }

  try {
    const body = await parseJsonBody(req);
    const email = String(body.email || "").trim().toLowerCase();
    if (!email) {
      return sendJson(res, 400, { error: "Debes indicar un email válido." });
    }

    const affiliate = await supabase.findOne(
      "affiliates",
      `email=eq.${encodeURIComponent(email)}&status=eq.approved`
    );

    if (affiliate) {
      const siteUrl = getSiteUrl(req);
      await ensureAffiliateAuthUser(affiliate);
      await requestAffiliatePasswordRecovery(email, `${siteUrl}/portal-afiliados?recover=1`);
    }

    return sendJson(res, 200, {
      ok: true,
      message: "Si tu cuenta está aprobada, te hemos enviado un email para restablecer la contraseña."
    });
  } catch (error) {
    return sendJson(res, 500, {
      error: error.message || "No se pudo solicitar la recuperación de contraseña."
    });
  }
};
