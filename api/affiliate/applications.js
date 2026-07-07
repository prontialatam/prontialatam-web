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
    const affiliates = await supabase.list(
      "affiliates",
      "select=id,status,full_name,email,country,phone_country_code,phone_number,tracking_code,coupon_code,commission_rate,created_at&order=created_at.desc&limit=12"
    );
    const orders = await supabase.list(
      "orders",
      "select=id,customer_email,product_name,affiliate_id,affiliate_code,payment_status,fulfillment_status,amount_total,commission_amount,currency,created_at&order=created_at.desc&limit=20"
    );

    const totalSales = orders.reduce(function (sum, order) {
      return sum + Number(order.amount_total || 0);
    }, 0);
    const totalCommissions = orders.reduce(function (sum, order) {
      return sum + Number(order.commission_amount || 0);
    }, 0);
    const approvedAffiliates = affiliates.filter(function (item) {
      return item.status === "approved";
    }).length;
    const pendingApplications = applications.filter(function (item) {
      return item.status === "pending";
    }).length;

    return sendJson(res, 200, {
      ok: true,
      applications,
      affiliates,
      orders,
      stats: {
        pendingApplications,
        approvedAffiliates,
        totalSales: Number(totalSales.toFixed(2)),
        totalCommissions: Number(totalCommissions.toFixed(2))
      },
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
