const { getSiteUrl, sendJson } = require("../_lib/http");
const supabase = require("../_lib/supabase");
const { getAffiliateByAccessToken } = require("../_lib/affiliate-access");

function getQueryParam(req, name) {
  const url = new URL(req.url, `https://${req.headers.host || "localhost"}`);
  return (url.searchParams.get(name) || "").trim();
}

function toAmount(value) {
  return Number(Number(value || 0).toFixed(2));
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    return sendJson(res, 405, { error: "Method not allowed" });
  }

  if (!supabase.isConfigured()) {
    return sendJson(res, 500, { error: "Falta configurar Supabase" });
  }

  try {
    const token = getQueryParam(req, "access");
    if (!token) {
      return sendJson(res, 401, { error: "Falta el acceso privado." });
    }

    const affiliate = await getAffiliateByAccessToken(supabase, token);
    if (!affiliate) {
      return sendJson(res, 403, { error: "Acceso no autorizado." });
    }

    const orders = await supabase.list(
      "orders",
      `select=id,customer_email,customer_name,product_name,payment_status,fulfillment_status,amount_total,commission_amount,currency,created_at,affiliate_code&affiliate_id=eq.${encodeURIComponent(affiliate.id)}&order=created_at.desc&limit=100`
    );
    const clicks = await supabase.list(
      "affiliate_clicks",
      `select=id,landing_path,utm_source,utm_medium,utm_campaign,referrer,clicked_at&affiliate_id=eq.${encodeURIComponent(affiliate.id)}&order=clicked_at.desc&limit=25`
    );

    const paidOrders = orders.filter(function (order) {
      return order.payment_status === "paid";
    });
    const totalSales = paidOrders.reduce(function (sum, order) {
      return sum + Number(order.amount_total || 0);
    }, 0);
    const totalCommissions = paidOrders.reduce(function (sum, order) {
      return sum + Number(order.commission_amount || 0);
    }, 0);
    const currency = paidOrders[0] && paidOrders[0].currency ? paidOrders[0].currency : "USD";
    const siteUrl = getSiteUrl(req);

    return sendJson(res, 200, {
      ok: true,
      affiliate: {
        fullName: affiliate.full_name,
        email: affiliate.email,
        country: affiliate.country || "",
        trackingCode: affiliate.tracking_code,
        couponCode: affiliate.coupon_code || "",
        commissionRate: Number(affiliate.commission_rate || 0.60),
        stripeConnectStatus: affiliate.stripe_connect_status || "not_started",
        stripeConnectDashboard: affiliate.stripe_connect_dashboard || "",
        stripeConnectCountry: affiliate.stripe_connect_country || "",
        requirementsDue: Array.isArray(affiliate.stripe_connect_requirements_due)
          ? affiliate.stripe_connect_requirements_due
          : [],
        affiliateLink: `${siteUrl}/talleres-mecanicos?ref=${affiliate.tracking_code}`
      },
      stats: {
        totalSales: toAmount(totalSales),
        totalCommissions: toAmount(totalCommissions),
        paidOrders: paidOrders.length,
        totalOrders: orders.length,
        totalClicks: clicks.length
      },
      currency,
      orders,
      clicks
    });
  } catch (error) {
    return sendJson(res, 500, {
      error: error.message || "No se pudo cargar el portal del afiliado."
    });
  }
};
