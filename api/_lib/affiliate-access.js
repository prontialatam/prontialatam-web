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
  const accessSuffix = token ? `?access=${encodeURIComponent(token)}` : "";

  Object.values(PROTECTED_PAGES).forEach(function (page) {
    const routePattern = new RegExp(`(href=["'])${page.route.replace(/\//g, "\\/")}(#[^"']*)?(["'])`, "g");
    output = output.replace(routePattern, function (_match, prefix, hash, suffix) {
      return `${prefix}${page.route}${accessSuffix}${hash || ""}${suffix}`;
    });
  });

  const downloadPattern = /(href|src)=["'](\/downloads\/[^"']+)["']/g;
  output = output.replace(downloadPattern, function (_match, attr, assetUrl) {
    const assetPath = assetUrl.replace(/^\//, "");
    const protectedUrl = buildProtectedResourceUrl(siteUrl, assetPath, token);
    return `${attr}="${protectedUrl}"`;
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
  buildProtectedPageUrl,
  buildProtectedResourceUrl,
  fileExists,
  getAbsoluteProjectFile,
  getAffiliateByAccessToken,
  getContentType,
  getProtectedPage,
  getProtectedPageByRoute,
  transformProtectedHtml
};
