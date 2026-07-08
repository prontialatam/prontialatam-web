const crypto = require("crypto");

const STRIPE_API_BASE = "https://api.stripe.com";
const DEFAULT_STRIPE_API_VERSION = "2026-02-25.clover";

const COUNTRY_ALIASES = {
  argentina: "AR",
  bolivia: "BO",
  brasil: "BR",
  brazil: "BR",
  chile: "CL",
  colombia: "CO",
  "costa rica": "CR",
  ecuador: "EC",
  "el salvador": "SV",
  espana: "ES",
  spain: "ES",
  guatemala: "GT",
  honduras: "HN",
  mexico: "MX",
  nicaragua: "NI",
  panama: "PA",
  paraguay: "PY",
  peru: "PE",
  "puerto rico": "PR",
  "republica dominicana": "DO",
  "rep dominicana": "DO",
  uruguay: "UY",
  usa: "US",
  "estados unidos": "US",
  "united states": "US"
};

function generateConnectOnboardingToken() {
  return crypto.randomBytes(32).toString("hex");
}

function normalizeCountry(value) {
  const raw = (value || "").trim();
  if (/^[a-z]{2}$/i.test(raw)) {
    return raw.toUpperCase();
  }

  const key = raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  const fallback = (process.env.STRIPE_CONNECT_DEFAULT_COUNTRY || "MX").trim().toUpperCase();
  return COUNTRY_ALIASES[key] || fallback;
}

function getDashboardType() {
  const value = (process.env.STRIPE_CONNECT_DASHBOARD || "express").trim().toLowerCase();
  return ["express", "full", "none"].includes(value) ? value : "express";
}

async function stripeRequest(path, options) {
  const secretKey = (process.env.STRIPE_SECRET_KEY || "").trim();
  if (!secretKey) {
    throw new Error("Falta configurar STRIPE_SECRET_KEY");
  }

  const url = new URL(path, STRIPE_API_BASE);
  const query = options && options.query ? options.query : {};
  Object.keys(query).forEach(function (key) {
    const value = query[key];
    if (Array.isArray(value)) {
      value.forEach(function (item) {
        url.searchParams.append(key, item);
      });
    } else if (value !== undefined && value !== null) {
      url.searchParams.set(key, value);
    }
  });

  const headers = {
    Authorization: `Bearer ${secretKey}`,
    "Content-Type": "application/json",
    "Stripe-Version": (process.env.STRIPE_API_VERSION || DEFAULT_STRIPE_API_VERSION).trim()
  };

  if (options && options.idempotencyKey) {
    headers["Idempotency-Key"] = options.idempotencyKey;
  }

  const response = await fetch(url, {
    method: options && options.method ? options.method : "POST",
    headers,
    body: options && options.body ? JSON.stringify(options.body) : undefined
  });

  const text = await response.text();
  let payload = {};
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch (error) {
      payload = { raw: text };
    }
  }
  if (!response.ok) {
    const message = payload && payload.error && payload.error.message
      ? payload.error.message
      : text || "Stripe request failed";
    throw new Error(message);
  }

  return payload;
}

async function createRecipientAccount(affiliate) {
  const country = normalizeCountry(affiliate.country);
  const dashboard = getDashboardType();
  const body = {
    contact_email: affiliate.email,
    dashboard,
    identity: {
      country
    },
    configuration: {
      recipient: {
        capabilities: {
          stripe_balance: {
            stripe_transfers: {
              requested: true
            }
          }
        }
      }
    },
    include: [
      "configuration.recipient",
      "identity",
      "requirements"
    ]
  };

  const account = await stripeRequest("/v2/core/accounts", {
    body,
    idempotencyKey: `prontia-affiliate-connect-${affiliate.id}`
  });

  return {
    account,
    country,
    dashboard
  };
}

async function createOnboardingLink(options) {
  return stripeRequest("/v2/core/account_links", {
    body: {
      account: options.accountId,
      use_case: {
        type: "account_onboarding",
        account_onboarding: {
          configurations: ["recipient"],
          refresh_url: options.refreshUrl,
          return_url: options.returnUrl
        }
      }
    }
  });
}

async function retrieveAccount(accountId) {
  return stripeRequest(`/v2/core/accounts/${encodeURIComponent(accountId)}`, {
    method: "GET",
    query: {
      "include[]": [
        "configuration.recipient",
        "identity",
        "requirements"
      ]
    }
  });
}

function collectRequirementList(requirements) {
  if (!requirements || typeof requirements !== "object") {
    return [];
  }

  return ["currently_due", "past_due", "pending_verification"]
    .reduce(function (items, key) {
      const value = requirements[key];
      return Array.isArray(value) ? items.concat(value) : items;
    }, []);
}

function summarizeAccount(account) {
  const requirements = account && account.requirements ? account.requirements : null;
  const due = collectRequirementList(requirements);
  const recipient = account && account.configuration ? account.configuration.recipient : null;
  const stripeBalance = recipient && recipient.capabilities ? recipient.capabilities.stripe_balance : null;
  const transfers = stripeBalance ? stripeBalance.stripe_transfers : null;
  const payouts = stripeBalance ? stripeBalance.payouts : null;
  const transferStatus = transfers && transfers.status ? transfers.status : "";
  const payoutStatus = payouts && payouts.status ? payouts.status : "";

  let status = "onboarding_started";
  if (due.length) {
    status = "pending_requirements";
  } else if (transferStatus === "active" || payoutStatus === "active") {
    status = "ready";
  } else if (account && account.id) {
    status = "submitted";
  }

  return {
    status,
    requirementsDue: requirements ? {
      currently_due: Array.isArray(requirements.currently_due) ? requirements.currently_due : [],
      past_due: Array.isArray(requirements.past_due) ? requirements.past_due : [],
      pending_verification: Array.isArray(requirements.pending_verification) ? requirements.pending_verification : []
    } : null,
    metadata: {
      account_id: account ? account.id : null,
      dashboard: account ? account.dashboard : null,
      identity: account ? account.identity : null,
      configuration: account ? account.configuration : null,
      requirements
    }
  };
}

module.exports = {
  createOnboardingLink,
  createRecipientAccount,
  generateConnectOnboardingToken,
  retrieveAccount,
  summarizeAccount
};
