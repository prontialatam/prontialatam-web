const { parseJsonBody, sendJson } = require("../_lib/http");
const supabase = require("../_lib/supabase");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return sendJson(res, 405, { error: "Method not allowed" });
  }

  try {
    const body = await parseJsonBody(req);
    const fullName = (body.fullName || "").trim();
    const email = (body.email || "").trim().toLowerCase();
    const country = (body.country || "").trim();
    const mainChannel = (body.mainChannel || "").trim();
    const audienceType = (body.audienceType || "").trim();
    const notes = (body.notes || "").trim();

    if (!fullName || !email || !country || !mainChannel || !audienceType || !notes) {
      return sendJson(res, 400, { error: "Faltan campos obligatorios." });
    }

    if (supabase.isConfigured()) {
      await supabase.insert("affiliate_applications", {
        full_name: fullName,
        email,
        country,
        main_channel: mainChannel,
        audience_type: audienceType,
        notes,
        status: "pending"
      });
    }

    return sendJson(res, 200, { ok: true });
  } catch (error) {
    return sendJson(res, 500, { error: error.message || "No se pudo registrar la solicitud." });
  }
};
