const supabase = require("./supabase");

function sanitizeTrackingCode(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "");
}

async function resolveAffiliateByCode(code) {
  if (!supabase.isConfigured()) {
    return null;
  }

  const trackingCode = sanitizeTrackingCode(code);
  if (trackingCode) {
    const byTracking = await supabase.findOne(
      "affiliates",
      `tracking_code=eq.${encodeURIComponent(trackingCode)}&status=eq.approved`
    );
    if (byTracking) {
      return {
        affiliate: byTracking,
        matchedBy: "tracking_code",
        normalizedCode: byTracking.tracking_code,
        enteredCode: String(code || "").trim()
      };
    }
  }

  return null;
}

module.exports = {
  resolveAffiliateByCode,
  sanitizeTrackingCode
};
