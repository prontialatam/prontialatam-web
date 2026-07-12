const crypto = require("crypto");
const { parseJsonBody, sendJson } = require("../_lib/http");
const supabase = require("../_lib/supabase");
const { resolveAffiliateRequestAccess } = require("../_lib/affiliate-auth");

const PROFILE_PHOTO_BUCKET = "affiliate-profile-photos";
const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
const MIME_TO_EXTENSION = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp"
};

function parseDataUrl(dataUrl) {
  const match = String(dataUrl || "").match(/^data:(image\/(?:jpeg|png|webp));base64,([a-z0-9+/=]+)$/i);
  if (!match) return null;
  return {
    mimeType: match[1].toLowerCase(),
    buffer: Buffer.from(match[2], "base64")
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return sendJson(res, 405, { error: "Method not allowed" });
  }

  if (!supabase.isConfigured()) {
    return sendJson(res, 500, { error: "Falta configurar Supabase." });
  }

  try {
    const access = await resolveAffiliateRequestAccess(req, res);
    const affiliate = access && access.affiliate;
    if (!affiliate) {
      return sendJson(res, 403, { error: "Acceso no autorizado." });
    }

    const body = await parseJsonBody(req);
    const parsed = parseDataUrl(body.dataUrl);
    if (!parsed) {
      return sendJson(res, 400, { error: "La imagen debe ser JPG, PNG o WEBP válida." });
    }
    if (!MIME_TO_EXTENSION[parsed.mimeType]) {
      return sendJson(res, 400, { error: "Formato no permitido. Usa JPG, PNG o WEBP." });
    }
    if (!parsed.buffer.length || parsed.buffer.length > MAX_PHOTO_BYTES) {
      return sendJson(res, 400, { error: "La imagen supera el máximo permitido de 2 MB." });
    }

    const extension = MIME_TO_EXTENSION[parsed.mimeType];
    const objectPath = `${affiliate.id}/${Date.now()}-${crypto.randomBytes(6).toString("hex")}.${extension}`;
    await supabase.uploadStorageObject(PROFILE_PHOTO_BUCKET, objectPath, parsed.buffer, parsed.mimeType);
    const publicUrl = supabase.getPublicStorageUrl(PROFILE_PHOTO_BUCKET, objectPath);

    const updated = await supabase.update(
      "affiliates",
      `id=eq.${encodeURIComponent(affiliate.id)}`,
      {
        profile_photo_url: publicUrl
      }
    );
    const row = Array.isArray(updated) && updated[0] ? updated[0] : Object.assign({}, affiliate, { profile_photo_url: publicUrl });

    return sendJson(res, 200, {
      ok: true,
      profilePhotoUrl: row.profile_photo_url || publicUrl
    });
  } catch (error) {
    return sendJson(res, 500, {
      error: error.message || "No se pudo subir la foto de perfil."
    });
  }
};
