const { parseJsonBody, sendJson } = require("../../_lib/http");
const supabase = require("../../_lib/supabase");
const {
  getApprovedAffiliateByUser,
  getAuthUser,
  setAuthCookies,
  signInAffiliate,
  updateAffiliatePassword
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
    const accessToken = String(body.accessToken || "").trim();
    const password = String(body.password || "");
    const confirmPassword = String(body.confirmPassword || "");

    if (!accessToken) {
      return sendJson(res, 400, { error: "Falta el token de recuperación." });
    }
    if (!password || password.length < 8) {
      return sendJson(res, 400, { error: "La contraseña debe tener al menos 8 caracteres." });
    }
    if (password !== confirmPassword) {
      return sendJson(res, 400, { error: "Las contraseñas no coinciden." });
    }

    const authUser = await getAuthUser(accessToken);
    const affiliate = await getApprovedAffiliateByUser(authUser);
    if (!affiliate) {
      return sendJson(res, 403, { error: "Tu cuenta no tiene acceso aprobado al portal." });
    }

    await updateAffiliatePassword(accessToken, password);
    await supabase.update(
      "affiliates",
      `id=eq.${encodeURIComponent(affiliate.id)}`,
      {
        auth_password_set_at: new Date().toISOString()
      }
    );

    const session = await signInAffiliate(affiliate.email, password);
    setAuthCookies(res, session);

    return sendJson(res, 200, {
      ok: true,
      redirectTo: "/portal-afiliados",
      affiliateName: affiliate.full_name
    });
  } catch (error) {
    return sendJson(res, 500, {
      error: error.message || "No se pudo actualizar la contraseña."
    });
  }
};
