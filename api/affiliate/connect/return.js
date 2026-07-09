const { getSiteUrl, sendJson } = require("../../_lib/http");
const supabase = require("../../_lib/supabase");
const { buildProtectedPageUrl } = require("../../_lib/affiliate-access");
const { retrieveAccount, summarizeAccount } = require("../../_lib/stripe-connect");

function getQueryParam(req, name) {
  const url = new URL(req.url, `https://${req.headers.host || "localhost"}`);
  return (url.searchParams.get(name) || "").trim();
}

function redirect(res, url) {
  res.statusCode = 302;
  res.setHeader("Location", url);
  res.end();
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    return sendJson(res, 405, { error: "Method not allowed" });
  }

  const siteUrl = getSiteUrl(req);
  const token = getQueryParam(req, "token");
  const fallbackUrl = buildProtectedPageUrl(siteUrl, "/portal-afiliados", token, { connect: "returned" });

  if (!supabase.isConfigured() || !process.env.STRIPE_SECRET_KEY) {
    return redirect(res, buildProtectedPageUrl(siteUrl, "/portal-afiliados", token, { connect: "config_error" }));
  }

  try {
    if (!token) {
      return redirect(res, buildProtectedPageUrl(siteUrl, "/portal-afiliados", token, { connect: "missing_token" }));
    }

    const affiliate = await supabase.findOne("affiliates", `connect_onboarding_token=eq.${encodeURIComponent(token)}`);
    if (!affiliate || !affiliate.stripe_connect_account_id) {
      return redirect(res, buildProtectedPageUrl(siteUrl, "/portal-afiliados", token, { connect: "not_found" }));
    }

    const account = await retrieveAccount(affiliate.stripe_connect_account_id);
    const summary = summarizeAccount(account);
    const updatePayload = {
      stripe_connect_status: summary.status,
      stripe_connect_requirements_due: summary.requirementsDue,
      stripe_connect_metadata: summary.metadata
    };

    if (summary.status === "ready" || summary.status === "submitted") {
      updatePayload.connect_onboarding_completed_at = new Date().toISOString();
    }

    await supabase.update("affiliates", `id=eq.${encodeURIComponent(affiliate.id)}`, updatePayload);
    return redirect(res, buildProtectedPageUrl(siteUrl, "/portal-afiliados", token, { connect: summary.status }));
  } catch (error) {
    return redirect(res, `${fallbackUrl}&error=${encodeURIComponent(error.message || "stripe_connect")}`);
  }
};
