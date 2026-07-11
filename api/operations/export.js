const { sendJson } = require("../_lib/http");
const supabase = require("../_lib/supabase");

function getToken(req) {
  const host = req.headers.host || "localhost";
  const url = new URL(req.url || "/", `https://${host}`);
  return {
    token: String(url.searchParams.get("token") || req.headers["x-operations-export-token"] || "").trim(),
    type: String(url.searchParams.get("type") || "orders").trim().toLowerCase()
  };
}

function isAuthorized(token) {
  const exportToken = (process.env.OPERATIONS_EXPORT_TOKEN || "").trim();
  const adminToken = (process.env.AFFILIATE_APPROVAL_TOKEN || "").trim();
  if (exportToken && token === exportToken) return true;
  return Boolean(adminToken) && token === adminToken;
}

function csvCell(value) {
  if (value === null || value === undefined) return "";
  const text = typeof value === "object" ? JSON.stringify(value) : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function toCsv(headers, rows) {
  const lines = [headers.map(csvCell).join(",")];
  rows.forEach(function (row) {
    lines.push(headers.map(function (header) {
      return csvCell(row[header]);
    }).join(","));
  });
  return `\ufeff${lines.join("\n")}\n`;
}

function sendCsv(res, filename, csv) {
  res.statusCode = 200;
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
  res.end(csv);
}

function normalizeOrder(row) {
  const metadata = row.source_metadata && typeof row.source_metadata === "object" ? row.source_metadata : {};
  return {
    fecha: row.created_at,
    cliente_nombre: row.customer_name,
    cliente_email: row.customer_email,
    producto: row.product_name,
    nicho: row.product_slug,
    importe: row.amount_total,
    moneda: row.currency,
    pago: row.payment_status,
    entrega: row.fulfillment_status,
    afiliado_codigo: row.affiliate_code,
    comision: row.commission_amount,
    stripe_session: row.stripe_checkout_session_id,
    stripe_payment_intent: row.stripe_payment_intent_id,
    landing: row.landing_path,
    utm_source: row.utm_source,
    utm_medium: row.utm_medium,
    utm_campaign: row.utm_campaign,
    ultimo_reenvio_email: metadata.last_purchase_email_resend ? metadata.last_purchase_email_resend.at : "",
    email_ultimo_reenvio: metadata.last_purchase_email_resend ? metadata.last_purchase_email_resend.to : "",
    id_pedido: row.id
  };
}

function normalizeAffiliate(row) {
  return {
    fecha_alta: row.created_at,
    nombre: row.full_name,
    email: row.email,
    estado: row.status,
    pais: row.country,
    telefono: `${row.phone_country_code || ""} ${row.phone_number || ""}`.trim(),
    codigo: row.tracking_code,
    cupon: row.coupon_code,
    comision: row.commission_rate,
    stripe_connect: row.stripe_connect_status,
    stripe_cuenta: row.stripe_connect_account_id,
    requisitos_pendientes: Array.isArray(row.stripe_connect_requirements_due) ? row.stripe_connect_requirements_due.join(", ") : row.stripe_connect_requirements_due,
    onboarding_iniciado: row.connect_onboarding_started_at,
    onboarding_completado: row.connect_onboarding_completed_at,
    id_afiliado: row.id
  };
}

async function getOrdersCsv() {
  const rows = await supabase.list(
    "orders",
    "select=id,stripe_checkout_session_id,stripe_payment_intent_id,customer_email,customer_name,product_slug,product_name,affiliate_code,payment_status,fulfillment_status,amount_total,commission_amount,currency,landing_path,utm_source,utm_medium,utm_campaign,source_metadata,created_at&order=created_at.desc&limit=1000"
  );
  const normalized = rows.map(normalizeOrder);
  const headers = [
    "fecha",
    "cliente_nombre",
    "cliente_email",
    "producto",
    "nicho",
    "importe",
    "moneda",
    "pago",
    "entrega",
    "afiliado_codigo",
    "comision",
    "stripe_session",
    "stripe_payment_intent",
    "landing",
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "ultimo_reenvio_email",
    "email_ultimo_reenvio",
    "id_pedido"
  ];
  return toCsv(headers, normalized);
}

async function getAffiliatesCsv() {
  const rows = await supabase.list(
    "affiliates",
    "select=id,status,full_name,email,country,phone_country_code,phone_number,tracking_code,coupon_code,commission_rate,stripe_connect_account_id,stripe_connect_status,stripe_connect_country,stripe_connect_dashboard,stripe_connect_requirements_due,connect_onboarding_started_at,connect_onboarding_completed_at,created_at&order=created_at.desc&limit=1000"
  );
  const normalized = rows.map(normalizeAffiliate);
  const headers = [
    "fecha_alta",
    "nombre",
    "email",
    "estado",
    "pais",
    "telefono",
    "codigo",
    "cupon",
    "comision",
    "stripe_connect",
    "stripe_cuenta",
    "requisitos_pendientes",
    "onboarding_iniciado",
    "onboarding_completado",
    "id_afiliado"
  ];
  return toCsv(headers, normalized);
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    return sendJson(res, 405, { error: "Method not allowed" });
  }

  const { token, type } = getToken(req);
  if (!isAuthorized(token)) {
    return sendJson(res, 401, { error: "No autorizado" });
  }

  if (!supabase.isConfigured()) {
    return sendJson(res, 500, { error: "Falta configurar Supabase" });
  }

  try {
    if (type === "affiliates" || type === "afiliados") {
      return sendCsv(res, "prontia-afiliados.csv", await getAffiliatesCsv());
    }

    if (type === "orders" || type === "ventas" || type === "clientes") {
      return sendCsv(res, "prontia-ventas-clientes.csv", await getOrdersCsv());
    }

    return sendJson(res, 400, { error: "Tipo de exportación no válido." });
  } catch (error) {
    return sendJson(res, 500, {
      error: error.message || "No se pudo exportar la operativa."
    });
  }
};
