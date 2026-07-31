const fs = require("fs");
const path = require("path");
const {
  fileExists,
  getAbsoluteProjectFile,
  getContentType
} = require("../_lib/affiliate-access");

const KIT_ASSET = "downloads/kit-venta-productos-digitales-principiantes.zip";

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.statusCode = 405;
    return res.end("Method not allowed");
  }

  try {
    const filePath = getAbsoluteProjectFile(KIT_ASSET);
    if (!fileExists(filePath)) {
      res.statusCode = 404;
      return res.end("Recurso no encontrado");
    }

    const stat = await fs.promises.stat(filePath);
    res.statusCode = 200;
    res.setHeader("Content-Type", getContentType(filePath));
    res.setHeader("Content-Length", String(stat.size));
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("Content-Disposition", `attachment; filename="${path.basename(filePath)}"`);
    fs.createReadStream(filePath).pipe(res);
  } catch (_error) {
    res.statusCode = 500;
    res.end("No se pudo descargar el recurso");
  }
};