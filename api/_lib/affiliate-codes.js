const supabase = require("./supabase");

function sanitizeTrackingCode(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "");
}

function sanitizeCouponCode(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "");
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

  const couponCode = sanitizeCouponCode(code);
  if (couponCode) {
    const byCoupon = await supabase.findOne(
      "affiliates",
      `coupon_code=ilike.${encodeURIComponent(couponCode)}&status=eq.approved`
    );
    if (byCoupon) {
      return {
        affiliate: byCoupon,
        matchedBy: "coupon_code",
        normalizedCode: byCoupon.tracking_code,
        enteredCode: String(code || "").trim()
      };
    }
  }

  return null;
}

module.exports = {
  resolveAffiliateByCode,
  sanitizeCouponCode,
  sanitizeTrackingCode
};
