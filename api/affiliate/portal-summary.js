const { getSiteUrl, sendJson } = require("../_lib/http");
const { buildProtectedPageUrl } = require("../_lib/affiliate-access");
const supabase = require("../_lib/supabase");
const { resolveAffiliateRequestAccess } = require("../_lib/affiliate-auth");

function toAmount(value) {
  return Number(Number(value || 0).toFixed(2));
}

function toPercent(numerator, denominator) {
  if (!denominator) return 0;
  return Number(((numerator / denominator) * 100).toFixed(2));
}

function buildProductPerformance(orders) {
  const grouped = {};
  orders.forEach(function (order) {
    const key = order.product_slug || order.product_name || "producto";
    if (!grouped[key]) {
      grouped[key] = {
        key,
        label: order.product_name || "Producto",
        orders: 0,
        sales: 0,
        commissions: 0
      };
    }
    grouped[key].orders += 1;
    grouped[key].sales += Number(order.amount_total || 0);
    grouped[key].commissions += Number(order.commission_amount || 0);
  });

  return Object.values(grouped)
    .map(function (item) {
      return {
        key: item.key,
        label: item.label,
        orders: item.orders,
        sales: toAmount(item.sales),
        commissions: toAmount(item.commissions)
      };
    })
    .sort(function (a, b) {
      return b.sales - a.sales;
    });
}

function normalizeAttributionLabel(value) {
  const normalized = String(value || "").toLowerCase();
  if (normalized === "affiliate_link" || normalized === "tracking_code") return "Enlace de afiliado";
  if (normalized === "affiliate_code") return "Código de afiliado";
  return "Sin identificar";
}

function normalizeFulfillmentLabel(value) {
  const normalized = String(value || "").toLowerCase();
  if (normalized === "delivered_and_queued") return "Entregado y automatizado";
  if (normalized === "delivered_email") return "Entregado por email";
  if (normalized === "delivery_partial_and_queued") return "Entrega parcial";
  if (normalized === "delivery_missing_sender") return "Falta remitente";
  if (normalized === "delivery_email_failed") return "Email pendiente";
  if (normalized === "queued") return "En cola";
  if (normalized === "pending_manual") return "Pendiente manual";
  return normalized || "Pendiente";
}

function normalizeRequirements(value) {
  if (Array.isArray(value)) {
    return value;
  }
  if (!value || typeof value !== "object") {
    return [];
  }
  return ["currently_due", "past_due", "pending_verification"].reduce(function (items, key) {
    const current = value[key];
    return Array.isArray(current) ? items.concat(current) : items;
  }, []);
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    return sendJson(res, 405, { error: "Method not allowed" });
  }

  if (!supabase.isConfigured()) {
    return sendJson(res, 500, { error: "Falta configurar Supabase" });
  }

  try {
    const access = await resolveAffiliateRequestAccess(req, res);
    const affiliate = access && access.affiliate;
    if (!affiliate) {
      return sendJson(res, 403, { error: "Acceso no autorizado." });
    }

    const orders = await supabase.list(
      "orders",
      `select=id,customer_email,customer_name,product_slug,product_name,payment_status,fulfillment_status,amount_total,commission_amount,currency,created_at,affiliate_code,source_metadata&affiliate_id=eq.${encodeURIComponent(affiliate.id)}&order=created_at.desc&limit=100`
    );
    const clicks = await supabase.list(
      "affiliate_clicks",
      `select=id,landing_path,utm_source,utm_medium,utm_campaign,referrer,clicked_at&affiliate_id=eq.${encodeURIComponent(affiliate.id)}&order=clicked_at.desc&limit=100`
    );
    const payouts = await supabase.list(
      "affiliate_payouts",
      `select=id,period_label,amount,currency,status,notes,paid_at,created_at&affiliate_id=eq.${encodeURIComponent(affiliate.id)}&order=created_at.desc&limit=50`
    ).catch(function () {
      return [];
    });

    const paidOrders = orders.filter(function (order) {
      return order.payment_status === "paid";
    });
    const totalSales = paidOrders.reduce(function (sum, order) {
      return sum + Number(order.amount_total || 0);
    }, 0);
    const totalCommissions = paidOrders.reduce(function (sum, order) {
      return sum + Number(order.commission_amount || 0);
    }, 0);
    const totalClicks = clicks.length;
    const currency = paidOrders[0] && paidOrders[0].currency ? paidOrders[0].currency : "USD";
    const avgOrderValue = paidOrders.length ? totalSales / paidOrders.length : 0;
    const deliveredOrders = paidOrders.filter(function (order) {
      return String(order.fulfillment_status || "").startsWith("delivered");
    });
    const paidPayouts = payouts.filter(function (item) {
      return String(item.status || "").toLowerCase() === "paid";
    });
    const pendingPayouts = payouts.filter(function (item) {
      return String(item.status || "").toLowerCase() !== "paid";
    });
    const totalPaidOut = paidPayouts.reduce(function (sum, item) {
      return sum + Number(item.amount || 0);
    }, 0);
    const totalPendingPayout = pendingPayouts.reduce(function (sum, item) {
      return sum + Number(item.amount || 0);
    }, 0);
    const unpaidCommissionBalance = Math.max(totalCommissions - totalPaidOut, 0);
    const commissionCoverageRate = totalCommissions ? (totalPaidOut / totalCommissions) * 100 : 0;
    const productPerformance = buildProductPerformance(paidOrders);
    const siteUrl = getSiteUrl(req);
    const connectToken = affiliate.connect_onboarding_token || access.legacyToken || "";
    const resourceLinks = {
      portalGuideUrl: buildProtectedPageUrl(siteUrl, "/guia-portal-afiliados", connectToken),
      stripeGuideUrl: buildProtectedPageUrl(siteUrl, "/guia-stripe-connect-afiliados", connectToken)
    };
    const connectUrl = connectToken ? `${siteUrl}/api/affiliate/connect/start?token=${connectToken}` : "";
    const safeOrders = orders.map(function (order) {
      const metadata = order.source_metadata && typeof order.source_metadata === "object" ? order.source_metadata : {};
      return Object.assign({}, order, {
        attributionLabel: normalizeAttributionLabel(metadata.affiliate_match_type),
        affiliateEnteredCode: metadata.affiliate_entered_code || "",
        fulfillmentLabel: normalizeFulfillmentLabel(order.fulfillment_status),
        isTestOrder: Boolean(metadata.is_test_order)
      });
    });

    return sendJson(res, 200, {
      ok: true,
      affiliate: {
        fullName: affiliate.full_name,
        email: affiliate.email,
        country: affiliate.country || "",
        displayTitle: affiliate.display_title || "",
        profilePhotoUrl: affiliate.profile_photo_url || "",
        bio: affiliate.bio || "",
        websiteUrl: affiliate.website_url || "",
        instagramHandle: affiliate.instagram_handle || "",
        whatsappContact: affiliate.whatsapp_contact || "",
        preferredNiches: Array.isArray(affiliate.preferred_niches) ? affiliate.preferred_niches : [],
        payoutNotes: affiliate.payout_notes || "",
        trackingCode: affiliate.tracking_code,
        commissionRate: Number(affiliate.commission_rate || 0.60),
        stripeConnectStatus: affiliate.stripe_connect_status || "not_started",
        stripeConnectDashboard: affiliate.stripe_connect_dashboard || "",
        stripeConnectCountry: affiliate.stripe_connect_country || "",
        requirementsDue: normalizeRequirements(affiliate.stripe_connect_requirements_due),
        affiliateLink: `${siteUrl}/talleres-mecanicos?ref=${affiliate.tracking_code}`,
        connectUrl,
        resourceLinks
      },
      stats: {
        totalSales: toAmount(totalSales),
        totalCommissions: toAmount(totalCommissions),
        totalPaidOut: toAmount(totalPaidOut),
        totalPendingPayout: toAmount(totalPendingPayout),
        unpaidCommissionBalance: toAmount(unpaidCommissionBalance),
        paidOrders: paidOrders.length,
        totalOrders: orders.length,
        totalClicks,
        conversionRate: toPercent(paidOrders.length, totalClicks),
        averageOrderValue: toAmount(avgOrderValue),
        deliveredOrders: deliveredOrders.length,
        commissionCoverageRate: toAmount(commissionCoverageRate),
        lastSaleAt: paidOrders[0] ? paidOrders[0].created_at : "",
        lastClickAt: clicks[0] ? clicks[0].clicked_at : ""
      },
      currency,
      productPerformance,
      payoutsSummary: {
        totalPaidOut: toAmount(totalPaidOut),
        totalPendingPayout: toAmount(totalPendingPayout),
        unpaidCommissionBalance: toAmount(unpaidCommissionBalance),
        lastPaidAt: paidPayouts[0] ? paidPayouts[0].paid_at || paidPayouts[0].created_at : "",
        lastPaidAmount: paidPayouts[0] ? toAmount(paidPayouts[0].amount) : 0
      },
      orders: safeOrders,
      clicks: clicks.slice(0, 25),
      payouts
    });
  } catch (error) {
    return sendJson(res, 500, {
      error: error.message || "No se pudo cargar el portal del afiliado."
    });
  }
};
