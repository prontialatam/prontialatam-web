const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const BUCKET = "paid-products";
const OBJECT_PATH = "emprendedores/kit-completo-premium-emprendedores-latam-v2.zip";
const LOCAL_FILE = path.resolve(
  process.cwd(),
  "downloads/emprendedores/kit-completo-premium-emprendedores-latam.zip"
);

function secureEqual(left, right) {
  const leftBuffer = Buffer.from(String(left || ""));
  const rightBuffer = Buffer.from(String(right || ""));
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "private, no-store, max-age=0");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.end(JSON.stringify(payload));
}

async function storageRequest(supabaseUrl, serviceRoleKey, pathname, options = {}) {
  return fetch(`${supabaseUrl.replace(/\/$/, "")}${pathname}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
      ...(options.headers || {})
    }
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return sendJson(res, 405, { error: "Método no permitido" });
  }

  const expectedToken = process.env.STORAGE_MIGRATION_TOKEN;
  if (!expectedToken || !secureEqual(req.headers["x-migration-token"], expectedToken)) {
    return sendJson(res, 401, { error: "No autorizado" });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return sendJson(res, 500, { error: "Falta la configuración privada de Supabase" });
  }

  try {
    const file = await fs.promises.readFile(LOCAL_FILE);
    const hash = crypto.createHash("sha256").update(file).digest("hex");

    const bucketResponse = await storageRequest(supabaseUrl, serviceRoleKey, "/storage/v1/bucket", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: BUCKET,
        name: BUCKET,
        public: false,
        file_size_limit: 10 * 1024 * 1024,
        allowed_mime_types: ["application/zip"]
      })
    });

    if (!bucketResponse.ok && bucketResponse.status !== 409) {
      const bucketError = await bucketResponse.text();
      throw new Error(`No se pudo crear el bucket (${bucketResponse.status}): ${bucketError}`);
    }

    const encodedObjectPath = OBJECT_PATH.split("/").map(encodeURIComponent).join("/");
    const uploadResponse = await storageRequest(
      supabaseUrl,
      serviceRoleKey,
      `/storage/v1/object/${BUCKET}/${encodedObjectPath}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/zip",
          "x-upsert": "true",
          "Cache-Control": "private, max-age=0, no-store"
        },
        body: file
      }
    );

    if (!uploadResponse.ok) {
      const uploadError = await uploadResponse.text();
      throw new Error(`No se pudo subir el archivo (${uploadResponse.status}): ${uploadError}`);
    }

    return sendJson(res, 200, {
      migrated: true,
      bucket: BUCKET,
      objectPath: OBJECT_PATH,
      size: file.length,
      sha256: hash
    });
  } catch (error) {
    return sendJson(res, 500, { error: error.message || "No se pudo completar la migración" });
  }
};
