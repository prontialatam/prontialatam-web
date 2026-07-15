const path = require("path");
const fs = require("fs");

const PROTECTED_PAGES = {
  portal: {
    route: "/portal-afiliados",
    file: "portal-afiliados.html"
  },
  brand: {
    route: "/dossier-marca-afiliados",
    file: "dossier-marca-afiliados.html"
  },
  product: {
    route: "/dossier-producto-talleres",
    file: "dossier-producto-talleres.html"
  },
  productRestaurant: {
    route: "/dossier-producto-restaurantes",
    file: "dossier-producto-restaurantes.html"
  },
  productEstetica: {
    route: "/dossier-producto-estetica",
    file: "dossier-producto-estetica.html"
  },
  productEmprendedores: {
    route: "/dossier-producto-emprendedores",
    file: "dossier-producto-emprendedores.html"
  },
  playbook: {
    route: "/playbook-afiliados-talleres",
    file: "playbook-afiliados-talleres.html"
  },
  playbookRestaurant: {
    route: "/playbook-afiliados-restaurantes",
    file: "playbook-afiliados-restaurantes.html"
  },
  playbookEstetica: {
    route: "/playbook-afiliados-estetica",
    file: "playbook-afiliados-estetica.html"
  },
  playbookEmprendedores: {
    route: "/playbook-afiliados-emprendedores",
    file: "playbook-afiliados-emprendedores.html"
  },
  social: {
    route: "/biblioteca-social-talleres",
    file: "biblioteca-social-talleres.html"
  },
  socialRestaurant: {
    route: "/biblioteca-social-restaurantes",
    file: "biblioteca-social-restaurantes.html"
  },
  socialEstetica: {
    route: "/biblioteca-social-estetica",
    file: "biblioteca-social-estetica.html"
  },
  socialEmprendedores: {
    route: "/biblioteca-social-emprendedores",
    file: "biblioteca-social-emprendedores.html"
  },
  guidePortal: {
    route: "/guia-portal-afiliados",
    file: "guia-portal-afiliados.html"
  },
  guideStripe: {
    route: "/guia-stripe-connect-afiliados",
    file: "guia-stripe-connect-afiliados.html"
  },
  beginnerKit: {
    route: "/kit-principiantes-afiliados",
    file: "kit-principiantes-afiliados.html"
  }
};

function buildProtectedPageUrl(siteUrl, route, token, extraParams) {
  const url = new URL(route, siteUrl);
  if (token) url.searchParams.set("access", token);
  Object.entries(extraParams || {}).forEach(function ([key, value]) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });
  return url.toString();
}

function findProtectedPageKeyByRoute(route) {
  return Object.keys(PROTECTED_PAGES).find(function (pageKey) {
    return PROTECTED_PAGES[pageKey].route === route;
  }) || "";
}

function buildProtectedPageRequestUrl(siteUrl, pageKeyOrRoute, token, extraParams) {
  const pageKey = PROTECTED_PAGES[pageKeyOrRoute]
    ? pageKeyOrRoute
    : findProtectedPageKeyByRoute(pageKeyOrRoute);

  if (!pageKey) {
    return buildProtectedPageUrl(siteUrl, pageKeyOrRoute, token, extraParams);
  }

  const url = new URL("/api/affiliate/page", siteUrl);
  url.searchParams.set("page", pageKey);
  if (token) url.searchParams.set("access", token);
  Object.entries(extraParams || {}).forEach(function ([key, value]) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });
  return url.toString();
}

function buildProtectedResourceUrl(siteUrl, assetPath, token) {
  const url = new URL("/api/affiliate/resource", siteUrl);
  if (token) url.searchParams.set("access", token);
  url.searchParams.set("asset", assetPath);
  return url.toString();
}

function getAffiliateByAccessToken(supabase, token) {
  return supabase.findOne(
    "affiliates",
    `connect_onboarding_token=eq.${encodeURIComponent(token)}&status=eq.approved`
  );
}

function getProtectedPage(pageKey) {
  return PROTECTED_PAGES[pageKey] || null;
}

function getProtectedPageByRoute(route) {
  return Object.values(PROTECTED_PAGES).find(function (page) {
    return page.route === route;
  }) || null;
}

function getAbsoluteProjectFile(relativePath) {
  return path.join(process.cwd(), relativePath);
}

function fileExists(filePath) {
  try {
    return fs.existsSync(filePath);
  } catch (_error) {
    return false;
  }
}

function transformProtectedHtml(html, siteUrl, token) {
  let output = html;

  Object.entries(PROTECTED_PAGES).forEach(function ([pageKey, page]) {
    const routePattern = new RegExp(`(href=["'])${page.route.replace(/\//g, "\\/")}(#[^"']*)?(["'])`, "g");
    output = output.replace(routePattern, function (_match, prefix, hash, suffix) {
      const directUrl = buildProtectedPageRequestUrl(siteUrl, pageKey, token);
      return `${prefix}${directUrl}${hash || ""}${suffix}`;
    });
  });

  const downloadPattern = /(href|src)=["'](\/downloads\/[^"']+)["']/g;
  output = output.replace(downloadPattern, function (_match, attr, assetUrl) {
    const assetPath = assetUrl.replace(/^\//, "");
    const protectedUrl = buildProtectedResourceUrl(siteUrl, assetPath, token);
    return `${attr}="${protectedUrl}"`;
  });

  const relativeAssetPattern = /(href|src)=["']((?:assets\/[^"']+)|logo-prontia\.jpg)["']/g;
  output = output.replace(relativeAssetPattern, function (_match, attr, assetPath) {
    const absoluteUrl = new URL(`/${assetPath.replace(/^\/+/, "")}`, siteUrl).toString();
    return `${attr}="${absoluteUrl}"`;
  });

  return output;
}

function getContentType(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  const map = {
    ".html": "text/html; charset=utf-8",
    ".zip": "application/zip",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".svg": "image/svg+xml",
    ".mp4": "video/mp4",
    ".csv": "text/csv; charset=utf-8",
    ".txt": "text/plain; charset=utf-8",
    ".pdf": "application/pdf"
  };
  return map[extension] || "application/octet-stream";
}

module.exports = {
  PROTECTED_PAGES,
  buildProtectedPageRequestUrl,
  buildProtectedPageUrl,
  buildProtectedResourceUrl,
  fileExists,
  findProtectedPageKeyByRoute,
  getAbsoluteProjectFile,
  getAffiliateByAccessToken,
  getContentType,
  getProtectedPage,
  getProtectedPageByRoute,
  transformProtectedHtml
};
