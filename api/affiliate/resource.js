const fs = require("fs");
const path = require("path");
const supabase = require("../_lib/supabase");
const {
  fileExists,
  getAbsoluteProjectFile,
  getContentType
} = require("../_lib/affiliate-access");
const { resolveAffiliateRequestAccess } = require("../_lib/affiliate-auth");

function getQueryParam(req, name) {
  const url = new URL(req.url, `https://${req.headers.host || "localhost"}`);
  return (url.searchParams.get(name) || "").trim();
}

function isAllowedAsset(assetPath) {
  return assetPath === "downloads/kit-base-afiliados-talleres.zip"
    || assetPath.startsWith("downloads/affiliate-kit-talleres/")
    || assetPath === "downloads/kit-base-afiliados-restaurantes.zip"
    || assetPath.startsWith("downloads/affiliate-kit-restaurantes/")
    || assetPath === "downloads/kit-base-afiliados-estetica.zip"
    || assetPath.startsWith("downloads/affiliate-kit-estetica/")
    || assetPath === "downloads/kit-base-afiliados-emprendedores.zip"
    || assetPath.startsWith("downloads/affiliate-kit-emprendedores/")
    || assetPath === "downloads/kit-venta-productos-digitales-principiantes.zip"
    || assetPath.startsWith("downloads/kit-venta-digital-principiantes/");
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.statusCode = 405;
    return res.end("Method not allowed");
  }

  const rawAsset = getQueryParam(req, "asset").replace(/^\/+/, "");

  if (!rawAsset || rawAsset.includes("..") || !isAllowedAsset(rawAsset) || !supabase.isConfigured()) {
    res.statusCode = 403;
    return res.end("Acceso no autorizado");
  }

  try {
    const access = await resolveAffiliateRequestAccess(req, res);
    if (!(access && access.affiliate)) {
      res.statusCode = 403;
      return res.end("Acceso no autorizado");
    }

    const filePath = getAbsoluteProjectFile(rawAsset);
    const downloadsRoot = getAbsoluteProjectFile("downloads");
    if (!filePath.startsWith(downloadsRoot) || !fileExists(filePath)) {
      res.statusCode = 404;
      return res.end("Recurso no encontrado");
    }

    const stat = await fs.promises.stat(filePath);
    res.statusCode = 200;
    res.setHeader("Content-Type", getContentType(filePath));
    res.setHeader("Content-Length", String(stat.size));
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("Content-Disposition", `inline; filename="${path.basename(filePath)}"`);
    fs.createReadStream(filePath).pipe(res);
  } catch (_error) {
    res.statusCode = 500;
    res.end("No se pudo servir el recurso");
  }
};
