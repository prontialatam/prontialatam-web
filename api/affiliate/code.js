const { parseJsonBody, sendJson } = require("../_lib/http");
const { resolveAffiliateByCode } = require("../_lib/affiliate-codes");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return sendJson(res, 405, { error: "Method not allowed" });
  }

  try {
    const body = await parseJsonBody(req);
    const code = String(body.code || "").trim();
    if (!code) {
      return sendJson(res, 400, { error: "Introduce un código." });
    }

    const resolved = await resolveAffiliateByCode(code);
    if (!resolved || !resolved.affiliate) {
      return sendJson(res, 404, {
        ok: false,
        valid: false,
        error: "No hemos encontrado ese código de afiliado."
      });
    }

    return sendJson(res, 200, {
      ok: true,
      valid: true,
      trackingCode: resolved.affiliate.tracking_code,
      affiliateName: resolved.affiliate.full_name || "",
      matchedBy: resolved.matchedBy
    });
  } catch (error) {
    return sendJson(res, 500, {
      error: error.message || "No se pudo validar el código."
    });
  }
};
