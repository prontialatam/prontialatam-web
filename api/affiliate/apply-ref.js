const { parseJsonBody, sendJson } = require("../_lib/http");
const supabase = require("../_lib/supabase");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return sendJson(res, 405, { error: "Method not allowed" });
  }

  try {
    const body = await parseJsonBody(req);
    const ref = (body.ref || "").trim().toLowerCase();
    if (!ref) {
      return sendJson(res, 400, { error: "Falta el código de afiliado" });
    }

    let affiliate = null;
    if (supabase.isConfigured()) {
      affiliate = await supabase.findOne("affiliates", `tracking_code=eq.${encodeURIComponent(ref)}`);
      if (!affiliate) {
        return sendJson(res, 200, { ok: true, valid: false });
      }

      await supabase.insert("affiliate_clicks", {
        affiliate_id: affiliate.id,
        tracking_code: ref,
        landing_path: body.landingPath || null,
        utm_source: body.utmSource || null,
        utm_medium: body.utmMedium || null,
        utm_campaign: body.utmCampaign || null,
        referrer: body.referrer || null
      });
    }

    return sendJson(res, 200, {
      ok: true,
      valid: true,
      affiliateId: affiliate ? affiliate.id : null
    });
  } catch (error) {
    return sendJson(res, 500, { error: error.message || "No se pudo registrar la referencia." });
  }
};
