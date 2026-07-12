const { parseJsonBody, sendJson } = require("../../_lib/http");
const supabase = require("../../_lib/supabase");
const { getAffiliateByAccessToken } = require("../../_lib/affiliate-access");
const {
  createOrUpdateAffiliateAuthUser,
  setAuthCookies,
  signInAffiliate
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
    const token = String(body.access || body.token || "").trim();
    const password = String(body.password || "");
    const confirmPassword = String(body.confirmPassword || "");

    if (!token) {
      return sendJson(res, 400, { error: "Falta el token de activación." });
    }
    if (!password || password.length < 8) {
      return sendJson(res, 400, { error: "La contraseña debe tener al menos 8 caracteres." });
    }
    if (password !== confirmPassword) {
      return sendJson(res, 400, { error: "Las contraseñas no coinciden." });
    }

    const affiliate = await getAffiliateByAccessToken(supabase, token);
    if (!affiliate) {
      return sendJson(res, 403, { error: "El acceso de activación no es válido." });
    }

    if (affiliate.auth_password_set_at) {
      return sendJson(res, 409, {
        error: "Este acceso ya fue activado. Inicia sesión con tu email y contraseña."
      });
    }

    const authUser = await createOrUpdateAffiliateAuthUser(affiliate, password);
    await supabase.update(
      "affiliates",
      `id=eq.${encodeURIComponent(affiliate.id)}`,
      {
        auth_user_id: authUser.id,
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
      error: error.message || "No se pudo activar el acceso del afiliado."
    });
  }
};
