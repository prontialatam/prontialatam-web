const supabase = require("./supabase");
const { getAffiliateByAccessToken } = require("./affiliate-access");

const ACCESS_COOKIE = "prontia_affiliate_access";
const REFRESH_COOKIE = "prontia_affiliate_refresh";

function getSupabaseBaseUrl() {
  return String(process.env.SUPABASE_URL || "").trim().replace(/\/$/, "");
}

function getPublicApiKey() {
  return String(process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
}

function getServiceRoleKey() {
  return String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
}

function parseCookies(req) {
  const raw = String((req.headers && req.headers.cookie) || "");
  return raw.split(";").reduce(function (acc, chunk) {
    const index = chunk.indexOf("=");
    if (index < 0) return acc;
    const key = chunk.slice(0, index).trim();
    const value = chunk.slice(index + 1).trim();
    if (key) acc[key] = decodeURIComponent(value);
    return acc;
  }, {});
}

function appendSetCookie(res, value) {
  const current = res.getHeader("Set-Cookie");
  if (!current) {
    res.setHeader("Set-Cookie", value);
    return;
  }
  if (Array.isArray(current)) {
    res.setHeader("Set-Cookie", current.concat(value));
    return;
  }
  res.setHeader("Set-Cookie", [current, value]);
}

function serializeCookie(name, value, options) {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  if (options.maxAge !== undefined) parts.push(`Max-Age=${options.maxAge}`);
  if (options.path) parts.push(`Path=${options.path}`);
  if (options.httpOnly) parts.push("HttpOnly");
  if (options.sameSite) parts.push(`SameSite=${options.sameSite}`);
  if (options.secure) parts.push("Secure");
  return parts.join("; ");
}

function setAuthCookies(res, session) {
  const accessTtl = Number(session && session.expires_in ? session.expires_in : 3600);
  appendSetCookie(res, serializeCookie(ACCESS_COOKIE, session.access_token, {
    maxAge: accessTtl,
    path: "/",
    httpOnly: true,
    sameSite: "Lax",
    secure: true
  }));
  appendSetCookie(res, serializeCookie(REFRESH_COOKIE, session.refresh_token, {
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
    httpOnly: true,
    sameSite: "Lax",
    secure: true
  }));
}

function clearAuthCookies(res) {
  appendSetCookie(res, serializeCookie(ACCESS_COOKIE, "", {
    maxAge: 0,
    path: "/",
    httpOnly: true,
    sameSite: "Lax",
    secure: true
  }));
  appendSetCookie(res, serializeCookie(REFRESH_COOKIE, "", {
    maxAge: 0,
    path: "/",
    httpOnly: true,
    sameSite: "Lax",
    secure: true
  }));
}

async function authRequest(path, options) {
  const baseUrl = getSupabaseBaseUrl();
  const apiKey = options && options.useServiceRole ? getServiceRoleKey() : getPublicApiKey();
  if (!baseUrl || !apiKey) {
    throw new Error("Falta configurar Supabase Auth.");
  }

  const response = await fetch(`${baseUrl}/auth/v1/${path}`, {
    method: (options && options.method) || "GET",
    headers: Object.assign(
      {
        apikey: apiKey
      },
      options && options.useServiceRole ? { Authorization: `Bearer ${getServiceRoleKey()}` } : {},
      options && options.bearerToken ? { Authorization: `Bearer ${options.bearerToken}` } : {},
      options && options.body ? { "Content-Type": "application/json" } : {}
    ),
    body: options && options.body ? JSON.stringify(options.body) : undefined
  });

  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (_error) {
    data = text;
  }

  if (!response.ok) {
    const message = data && typeof data === "object"
      ? data.msg || data.error_description || data.error || JSON.stringify(data)
      : text;
    throw new Error(message || "No se pudo completar la operación de autenticación.");
  }

  return data;
}

async function signInAffiliate(email, password) {
  return authRequest("token?grant_type=password", {
    method: "POST",
    body: {
      email,
      password
    }
  });
}

async function refreshAffiliateSession(refreshToken) {
  return authRequest("token?grant_type=refresh_token", {
    method: "POST",
    body: {
      refresh_token: refreshToken
    }
  });
}

async function getAuthUser(accessToken) {
  return authRequest("user", {
    method: "GET",
    bearerToken: accessToken
  });
}

async function listAuthUsers() {
  const payload = await authRequest("admin/users?page=1&per_page=1000", {
    method: "GET",
    useServiceRole: true
  });
  return Array.isArray(payload && payload.users) ? payload.users : [];
}

async function findAuthUserByEmail(email) {
  const users = await listAuthUsers();
  return users.find(function (item) {
    return String(item.email || "").toLowerCase() === String(email || "").toLowerCase();
  }) || null;
}

async function createOrUpdateAffiliateAuthUser(affiliate, password) {
  let authUser = null;
  if (affiliate.auth_user_id) {
    authUser = { id: affiliate.auth_user_id };
  } else {
    authUser = await findAuthUserByEmail(affiliate.email);
  }

  if (authUser && authUser.id) {
    return authRequest(`admin/users/${encodeURIComponent(authUser.id)}`, {
      method: "PUT",
      useServiceRole: true,
      body: {
        password,
        email_confirm: true,
        user_metadata: {
          role: "affiliate",
          affiliate_id: affiliate.id
        }
      }
    });
  }

  return authRequest("admin/users", {
    method: "POST",
    useServiceRole: true,
    body: {
      email: affiliate.email,
      password,
      email_confirm: true,
      user_metadata: {
        role: "affiliate",
        affiliate_id: affiliate.id
      }
    }
  });
}

async function getApprovedAffiliateByUser(user) {
  if (!user) return null;

  let affiliate = null;
  if (user.id) {
    affiliate = await supabase.findOne(
      "affiliates",
      `auth_user_id=eq.${encodeURIComponent(user.id)}&status=eq.approved`
    );
  }

  if (!affiliate && user.email) {
    affiliate = await supabase.findOne(
      "affiliates",
      `email=eq.${encodeURIComponent(String(user.email).toLowerCase())}&status=eq.approved`
    );
    if (affiliate && !affiliate.auth_user_id && user.id) {
      const updated = await supabase.update(
        "affiliates",
        `id=eq.${encodeURIComponent(affiliate.id)}`,
        { auth_user_id: user.id }
      );
      affiliate = Array.isArray(updated) && updated[0] ? updated[0] : Object.assign({}, affiliate, { auth_user_id: user.id });
    }
  }

  return affiliate;
}

async function resolveAffiliateRequestAccess(req, res) {
  const url = new URL(req.url, `https://${req.headers.host || "localhost"}`);
  const token = (url.searchParams.get("access") || "").trim();

  if (token && supabase.isConfigured()) {
    const affiliate = await getAffiliateByAccessToken(supabase, token);
    if (affiliate) {
      return {
        affiliate,
        mode: "token",
        legacyToken: token,
        authUser: null,
        isAuthenticated: false
      };
    }
  }

  const cookies = parseCookies(req);
  let accessToken = cookies[ACCESS_COOKIE] || "";
  let refreshToken = cookies[REFRESH_COOKIE] || "";
  let authUser = null;

  if (accessToken) {
    try {
      authUser = await getAuthUser(accessToken);
    } catch (_error) {
      authUser = null;
    }
  }

  if (!authUser && refreshToken) {
    try {
      const session = await refreshAffiliateSession(refreshToken);
      if (session && session.access_token && session.refresh_token) {
        setAuthCookies(res, session);
        accessToken = session.access_token;
        refreshToken = session.refresh_token;
        authUser = session.user || await getAuthUser(accessToken);
      }
    } catch (_error) {
      clearAuthCookies(res);
      authUser = null;
    }
  }

  if (!authUser) {
    return {
      affiliate: null,
      mode: null,
      legacyToken: token,
      authUser: null,
      isAuthenticated: false
    };
  }

  const affiliate = await getApprovedAffiliateByUser(authUser);
  return {
    affiliate,
    mode: affiliate ? "auth" : null,
    legacyToken: token,
    authUser,
    isAuthenticated: Boolean(affiliate)
  };
}

module.exports = {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  clearAuthCookies,
  createOrUpdateAffiliateAuthUser,
  findAuthUserByEmail,
  getApprovedAffiliateByUser,
  getAuthUser,
  parseCookies,
  refreshAffiliateSession,
  resolveAffiliateRequestAccess,
  setAuthCookies,
  signInAffiliate
};
