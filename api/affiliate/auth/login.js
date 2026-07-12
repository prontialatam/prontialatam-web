const { parseJsonBody, sendJson } = require("../../_lib/http");
const supabase = require("../../_lib/supabase");
const {
  getApprovedAffiliateByUser,
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
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");

    if (!email || !password) {
      return sendJson(res, 400, { error: "Debes indicar email y contraseña." });
    }

    const session = await signInAffiliate(email, password);
    const affiliate = await getApprovedAffiliateByUser(session.user);

    if (!affiliate) {
      return sendJson(res, 403, { error: "Tu cuenta no tiene acceso aprobado al portal." });
    }

    setAuthCookies(res, session);
    if (!affiliate.auth_password_set_at) {
      await supabase.update(
        "affiliates",
        `id=eq.${encodeURIComponent(affiliate.id)}`,
        {
          auth_password_set_at: new Date().toISOString()
        }
      );
    }

    return sendJson(res, 200, {
      ok: true,
      redirectTo: "/portal-afiliados",
      affiliateName: affiliate.full_name
    });
  } catch (error) {
    return sendJson(res, 401, {
      error: error.message || "No se pudo iniciar sesión."
    });
  }
};
