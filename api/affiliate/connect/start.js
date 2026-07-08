const { getSiteUrl, parseJsonBody, sendJson } = require("../../_lib/http");
const supabase = require("../../_lib/supabase");
const {
  createOnboardingLink,
  createRecipientAccount,
  generateConnectOnboardingToken,
  summarizeAccount
} = require("../../_lib/stripe-connect");

function getQueryParam(req, name) {
  const url = new URL(req.url, `https://${req.headers.host || "localhost"}`);
  return (url.searchParams.get(name) || "").trim();
}

function isAuthorized(req, body) {
  const expectedToken = (process.env.AFFILIATE_APPROVAL_TOKEN || "").trim();
  const headerToken = (req.headers["x-affiliate-admin-token"] || "").trim();
  const bodyToken = (body && body.adminToken ? String(body.adminToken).trim() : "");
  return Boolean(expectedToken) && (headerToken === expectedToken || bodyToken === expectedToken);
}

function redirect(res, url) {
  res.statusCode = 302;
  res.setHeader("Location", url);
  res.end();
}

async function ensureConnectToken(affiliate) {
  if (affiliate.connect_onboarding_token) {
    return affiliate.connect_onboarding_token;
  }

  const token = generateConnectOnboardingToken();
  await supabase.update("affiliates", `id=eq.${encodeURIComponent(affiliate.id)}`, {
    connect_onboarding_token: token
  });
  return token;
}

async function findAffiliate(req, body) {
  const queryToken = getQueryParam(req, "token");
  const bodyToken = body && body.token ? String(body.token).trim() : "";
  const token = queryToken || bodyToken;

  if (token) {
    return supabase.findOne("affiliates", `connect_onboarding_token=eq.${encodeURIComponent(token)}`);
  }

  if (!isAuthorized(req, body)) {
    return null;
  }

  const affiliateId = body && body.affiliateId ? String(body.affiliateId).trim() : "";
  const email = body && body.email ? String(body.email).trim().toLowerCase() : "";
  if (affiliateId) {
    return supabase.findOne("affiliates", `id=eq.${encodeURIComponent(affiliateId)}`);
  }
  if (email) {
    return supabase.findOne("affiliates", `email=eq.${encodeURIComponent(email)}`);
  }
  return null;
}

async function updateAffiliateConnectFields(affiliateId, payload) {
  return supabase.update("affiliates", `id=eq.${encodeURIComponent(affiliateId)}`, payload);
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    return sendJson(res, 405, { error: "Method not allowed" });
  }

  if (!supabase.isConfigured()) {
    return sendJson(res, 500, { error: "Falta configurar Supabase" });
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return sendJson(res, 500, { error: "Falta configurar STRIPE_SECRET_KEY" });
  }

  try {
    const body = req.method === "POST" ? await parseJsonBody(req) : {};
    const affiliate = await findAffiliate(req, body);
    if (!affiliate) {
      return sendJson(res, 404, { error: "No se encontró el afiliado o falta autorización." });
    }

    const siteUrl = getSiteUrl(req);
    const token = await ensureConnectToken(affiliate);
    let accountId = affiliate.stripe_connect_account_id;
    let accountSummary = null;

    if (!accountId) {
      const created = await createRecipientAccount(affiliate);
      accountId = created.account.id;
      accountSummary = summarizeAccount(created.account);

      await updateAffiliateConnectFields(affiliate.id, {
        stripe_connect_account_id: accountId,
        stripe_connect_status: accountSummary.status,
        stripe_connect_country: created.country,
        stripe_connect_dashboard: created.dashboard,
        stripe_connect_requirements_due: accountSummary.requirementsDue,
        stripe_connect_metadata: accountSummary.metadata,
        connect_onboarding_started_at: new Date().toISOString()
      });
    } else {
      await updateAffiliateConnectFields(affiliate.id, {
        connect_onboarding_started_at: new Date().toISOString()
      });
    }

    const refreshUrl = `${siteUrl}/api/affiliate/connect/start?token=${encodeURIComponent(token)}`;
    const returnUrl = `${siteUrl}/api/affiliate/connect/return?token=${encodeURIComponent(token)}`;
    const accountLink = await createOnboardingLink({
      accountId,
      refreshUrl,
      returnUrl
    });

    if (req.method === "GET") {
      return redirect(res, accountLink.url);
    }

    return sendJson(res, 200, {
      ok: true,
      url: accountLink.url,
      accountId,
      status: accountSummary ? accountSummary.status : affiliate.stripe_connect_status || "onboarding_started"
    });
  } catch (error) {
    return sendJson(res, 500, {
      error: error.message || "No se pudo iniciar Stripe Connect."
    });
  }
};
