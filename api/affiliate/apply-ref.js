const { parseJsonBody, sendJson } = require("../_lib/http");
const { resolveAffiliateByCode } = require("../_lib/affiliate-codes");
const supabase = require("../_lib/supabase");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return sendJson(res, 405, { error: "Method not allowed" });
  }

  try {
    const body = await parseJsonBody(req);
    const ref = String(body.ref || "").trim();
    if (!ref) {
      return sendJson(res, 400, { error: "Falta el código de afiliado" });
    }

    let affiliate = null;
    if (supabase.isConfigured()) {
      const resolved = await resolveAffiliateByCode(ref);
      if (!resolved || !resolved.affiliate) {
        return sendJson(res, 200, { ok: true, valid: false });
      }
      affiliate = resolved.affiliate;

      await supabase.insert("affiliate_clicks", {
        affiliate_id: affiliate.id,
        tracking_code: affiliate.tracking_code,
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