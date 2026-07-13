const { parseJsonBody, sendJson } = require("../_lib/http");
const supabase = require("../_lib/supabase");

function isAuthorized(req, body) {
  const expectedToken = (process.env.AFFILIATE_APPROVAL_TOKEN || "").trim();
  const headerToken = (req.headers["x-affiliate-admin-token"] || "").trim();
  const bodyToken = (body && body.adminToken ? String(body.adminToken).trim() : "");
  return Boolean(expectedToken) && (headerToken === expectedToken || bodyToken === expectedToken);
}

function toAmount(value) {
  return Number(Number(value || 0).toFixed(2));
}

function isPaidStatus(value) {
  return String(value || "").toLowerCase() === "paid";
}

function summarizeAffiliateBalances(affiliateId, orders, payouts) {
  const affiliateOrders = (orders || []).filter(function (order) {
    return order.affiliate_id === affiliateId && String(order.payment_status || "").toLowerCase() === "paid";
  });
  const affiliatePayouts = (payouts || []).filter(function (item) {
    return item.affiliate_id === affiliateId;
  });
  const totalCommissions = affiliateOrders.reduce(function (sum, order) {
    return sum + Number(order.commission_amount || 0);
  }, 0);
  const totalPaidOut = affiliatePayouts.filter(function (item) {
    return isPaidStatus(item.status);
  }).reduce(function (sum, item) {
    return sum + Number(item.amount || 0);
  }, 0);
  const totalPendingPayout = affiliatePayouts.filter(function (item) {
    return !isPaidStatus(item.status);
  }).reduce(function (sum, item) {
    return sum + Number(item.amount || 0);
  }, 0);
  return {
    totalCommissions: toAmount(totalCommissions),
    generatedBalance: toAmount(Math.max(totalCommissions - totalPendingPayout - totalPaidOut, 0)),
    totalPendingPayout: toAmount(totalPendingPayout),
    totalPaidOut: toAmount(totalPaidOut),
    outstandingBalance: toAmount(Math.max(totalCommissions - totalPaidOut, 0))
  };
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
    const affiliates = await supabase.list(
      "affiliates",
      "select=id,status,full_name,email,country,phone_country_code,phone_number,tracking_code,commission_rate,stripe_connect_account_id,stripe_connect_status,stripe_connect_country,stripe_connect_dashboard,stripe_connect_requirements_due,connect_onboarding_started_at,connect_onboarding_completed_at,created_at&order=created_at.desc"
    );
    const orders = await supabase.list(
      "orders",
      "select=id,stripe_checkout_session_id,stripe_payment_intent_id,customer_email,customer_name,product_slug,product_name,affiliate_id,affiliate_code,payment_status,fulfillment_status,amount_total,commission_amount,currency,landing_path,utm_source,utm_medium,utm_campaign,source_metadata,created_at&order=created_at.desc&limit=500"
    );
    const payouts = await supabase.list(
      "affiliate_payouts",
      "select=id,affiliate_id,period_label,amount,currency,status,notes,paid_at,created_at&order=created_at.desc&limit=500"
    ).catch(function () {
      return [];
    });

    const totalSales = orders.reduce(function (sum, order) {
      return sum + Number(order.amount_total || 0);
    }, 0);
    const totalCommissions = orders.reduce(function (sum, order) {
      return sum + Number(order.commission_amount || 0);
    }, 0);
    const totalPaidOut = payouts.filter(function (item) {
      return isPaidStatus(item.status);
    }).reduce(function (sum, item) {
      return sum + Number(item.amount || 0);
    }, 0);
    const totalPendingPayout = payouts.filter(function (item) {
      return !isPaidStatus(item.status);
    }).reduce(function (sum, item) {
      return sum + Number(item.amount || 0);
    }, 0);
    const approvedAffiliates = affiliates.filter(function (item) {
      return item.status === "approved";
    }).length;
    const rejectedApplications = applications.filter(function (item) {
      return item.status === "rejected";
    }).length;
    const pendingApplications = applications.filter(function (item) {
      return item.status === "pending";
    }).length;
    const affiliatesWithBalances = affiliates.map(function (affiliate) {
      return Object.assign({}, affiliate, {
        payout_summary: summarizeAffiliateBalances(affiliate.id, orders, payouts),
        payout_items: payouts.filter(function (item) {
          return item.affiliate_id === affiliate.id;
        }).slice(0, 10)
      });
    });

    return sendJson(res, 200, {
      ok: true,
      applications,
      affiliates: affiliatesWithBalances,
      orders,
      payouts,
      stats: {
        pendingApplications,
        rejectedApplications,
        approvedAffiliates,
        totalSales: Number(totalSales.toFixed(2)),
        totalCommissions: Number(totalCommissions.toFixed(2)),
        totalPaidOut: Number(totalPaidOut.toFixed(2)),
        totalPendingPayout: Number(totalPendingPayout.toFixed(2))
      },
      config: {
        supabase: supabase.isConfigured(),
        brevo: Boolean((process.env.BREVO_API_KEY || "").trim()),
        stripe: Boolean((process.env.STRIPE_SECRET_KEY || "").trim() && (process.env.STRIPE_WEBHOOK_SECRET || "").trim()),
        stripeConnect: Boolean((process.env.STRIPE_SECRET_KEY || "").trim()),
        approvalToken: Boolean((process.env.AFFILIATE_APPROVAL_TOKEN || "").trim()),
        affiliateApplicationEmail: Boolean(
          ((process.env.AFFILIATE_APPLICATION_FROM_EMAIL || "").trim() || (process.env.AFFILIATE_ONBOARDING_FROM_EMAIL || "").trim()) &&
          ((process.env.AFFILIATE_NOTIFICATION_TO_EMAIL || "").trim() || (process.env.AFFILIATE_ONBOARDING_REPLY_TO || "").trim() || (process.env.PURCHASE_CONFIRMATION_REPLY_TO || "").trim())
        ),
        purchaseConfirmationEmail: Boolean(
          ((process.env.PURCHASE_CONFIRMATION_FROM_EMAIL || "").trim() || (process.env.AFFILIATE_ONBOARDING_FROM_EMAIL || "").trim()) &&
          ((process.env.PURCHASE_CONFIRMATION_REPLY_TO || "").trim() || (process.env.AFFILIATE_ONBOARDING_REPLY_TO || "").trim())
        ),
        operationsExport: Boolean((process.env.OPERATIONS_EXPORT_TOKEN || "").trim())
      }
    });
  } catch (error) {
    return sendJson(res, 500, { error: error.message || "No se pudieron cargar las solicitudes." });
  }
};
