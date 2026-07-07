const { parseJsonBody, sendJson } = require("../_lib/http");
const supabase = require("../_lib/supabase");

function isAuthorized(req, body) {
  const expectedToken = (process.env.AFFILIATE_APPROVAL_TOKEN || "").trim();
  const headerToken = (req.headers["x-affiliate-admin-token"] || "").trim();
  const bodyToken = (body && body.adminToken ? String(body.adminToken).trim() : "");
  return Boolean(expectedToken) && (headerToken === expectedToken || bodyToken === expectedToken);
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    return sendJson(res, 405, { error: "Method not allowed" });
  }

  const body = req.method === "POST" ? await parseJsonBody(req) : {};
  if (!isAuthorized(req, body)) {
    return sendJson(res, 401, { error: "No autorizado" });
  }

  if (!supabase.isConfigured()) {
    return sendJson(res, 500, { error: "Falta configurar Supabase" });
  }

  try {
    const applications = await supabase.list(
      "affiliate_applications",
      "select=id,status,full_name,email,country,phone_country_code,phone_number,main_channel,audience_type,notes,created_at&order=created_at.desc"
    );

    return sendJson(res, 200, {
      ok: true,
      applications,
      config: {
        supabase: supabase.isConfigured(),
        brevo: Boolean((process.env.BREVO_API_KEY || "").trim()),
        stripe: Boolean((process.env.STRIPE_SECRET_KEY || "").trim() && (process.env.STRIPE_WEBHOOK_SECRET || "").trim()),
        approvalToken: Boolean((process.env.AFFILIATE_APPROVAL_TOKEN || "").trim())
      }
    });
  } catch (error) {
    return sendJson(res, 500, { error: error.message || "No se pudieron cargar las solicitudes." });
  }
};
