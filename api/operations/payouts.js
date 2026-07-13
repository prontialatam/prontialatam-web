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

function normalizeString(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength || 500);
}

function isPaidStatus(value) {
  return String(value || "").toLowerCase() === "paid";
}

function isPendingStatus(value) {
  return !isPaidStatus(value);
}

function summarizeBalances(orders, payouts) {
  const paidOrders = (orders || []).filter(function (order) {
    return String(order.payment_status || "").toLowerCase() === "paid";
  });
  const totalCommissions = paidOrders.reduce(function (sum, order) {
    return sum + Number(order.commission_amount || 0);
  }, 0);
  const totalPaidOut = (payouts || []).filter(function (item) {
    return isPaidStatus(item.status);
  }).reduce(function (sum, item) {
    return sum + Number(item.amount || 0);
  }, 0);
  const totalPending = (payouts || []).filter(function (item) {
    return isPendingStatus(item.status);
  }).reduce(function (sum, item) {
    return sum + Number(item.amount || 0);
  }, 0);
  return {
    totalCommissions: toAmount(totalCommissions),
    totalPaidOut: toAmount(totalPaidOut),
    totalPending: toAmount(totalPending),
    generatedBalance: toAmount(Math.max(totalCommissions - totalPending - totalPaidOut, 0)),
    outstandingBalance: toAmount(Math.max(totalCommissions - totalPaidOut, 0))
  };
}

async function loadAffiliateContext(affiliateId) {
  const affiliate = await supabase.findOne(
    "affiliates",
    `id=eq.${encodeURIComponent(affiliateId)}&status=eq.approved`
  );
  if (!affiliate) return null;

  const orders = await supabase.list(
    "orders",
    `select=id,payment_status,commission_amount&affiliate_id=eq.${encodeURIComponent(affiliateId)}&limit=1000`
  );
  const payouts = await supabase.list(
    "affiliate_payouts",
    `select=id,amount,status,notes,period_label,currency,paid_at,created_at&affiliate_id=eq.${encodeURIComponent(affiliateId)}&order=created_at.desc&limit=1000`
  ).catch(function () {
    return [];
  });

  return {
    affiliate,
    orders,
    payouts,
    balances: summarizeBalances(orders, payouts)
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return sendJson(res, 405, { error: "Method not allowed" });
  }

  const body = await parseJsonBody(req);
  if (!isAuthorized(req, body)) {
    return sendJson(res, 401, { error: "No autorizado" });
  }

  if (!supabase.isConfigured()) {
    return sendJson(res, 500, { error: "Falta configurar Supabase" });
  }

  try {
    const action = normalizeString(body.action, 40).toLowerCase();

    if (action === "create_pending") {
      const affiliateId = normalizeString(body.affiliateId, 80);
      const currency = normalizeString(body.currency || "USD", 10).toUpperCase() || "USD";
      const periodLabel = normalizeString(body.periodLabel, 120);
      const notes = normalizeString(body.notes, 1000);
      const amount = toAmount(body.amount);

      if (!affiliateId) {
        return sendJson(res, 400, { error: "Falta el afiliado para generar el cobro pendiente." });
      }
      if (!amount || amount <= 0) {
        return sendJson(res, 400, { error: "El importe del cobro pendiente no es válido." });
      }

      const context = await loadAffiliateContext(affiliateId);
      if (!context) {
        return sendJson(res, 404, { error: "No se encontró el afiliado aprobado." });
      }
      if (amount > context.balances.generatedBalance + 0.009) {
        return sendJson(res, 400, {
          error: "El importe supera la comisión generada disponible para pasar a pendiente."
        });
      }

      const inserted = await supabase.insert("affiliate_payouts", {
        affiliate_id: affiliateId,
        period_label: periodLabel || "Liquidación pendiente",
        amount,
        currency,
        status: "pending",
        notes: notes || null
      });
      const payout = Array.isArray(inserted) ? inserted[0] : inserted;
      const refreshed = await loadAffiliateContext(affiliateId);

      return sendJson(res, 200, {
        ok: true,
        action,
        payout,
        balances: refreshed ? refreshed.balances : context.balances
      });
    }

    if (action === "mark_paid") {
      const payoutId = normalizeString(body.payoutId, 80);
      const notes = normalizeString(body.notes, 1000);
      if (!payoutId) {
        return sendJson(res, 400, { error: "Falta el payout que quieres marcar como pagado." });
      }

      const payout = await supabase.findOne(
        "affiliate_payouts",
        `id=eq.${encodeURIComponent(payoutId)}`
      );
      if (!payout) {
        return sendJson(res, 404, { error: "No se encontró el cobro pendiente indicado." });
      }

      const updated = await supabase.update(
        "affiliate_payouts",
        `id=eq.${encodeURIComponent(payoutId)}`,
        {
          status: "paid",
          paid_at: new Date().toISOString(),
          notes: notes || payout.notes || null
        }
      );
      const refreshed = await loadAffiliateContext(payout.affiliate_id);

      return sendJson(res, 200, {
        ok: true,
        action,
        payout: Array.isArray(updated) ? updated[0] : updated,
        balances: refreshed ? refreshed.balances : null
      });
    }

    return sendJson(res, 400, { error: "Acción de payouts no válida." });
  } catch (error) {
    return sendJson(res, 500, {
      error: error.message || "No se pudo actualizar el estado de cobro."
    });
  }
};
