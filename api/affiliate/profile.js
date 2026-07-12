const { parseJsonBody, sendJson } = require("../_lib/http");
const supabase = require("../_lib/supabase");
const { resolveAffiliateRequestAccess } = require("../_lib/affiliate-auth");

function normalizeString(value, maxLength) {
  const normalized = String(value || "").trim();
  return maxLength ? normalized.slice(0, maxLength) : normalized;
}

function normalizeNiches(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map(function (item) {
      return String(item || "").trim().toLowerCase();
    })
    .filter(Boolean)
    .filter(function (item, index, items) {
      return items.indexOf(item) === index;
    })
    .slice(0, 8);
}

function toProfilePayload(affiliate) {
  return {
    displayTitle: affiliate.display_title || "",
    profilePhotoUrl: affiliate.profile_photo_url || "",
    bio: affiliate.bio || "",
    websiteUrl: affiliate.website_url || "",
    instagramHandle: affiliate.instagram_handle || "",
    whatsappContact: affiliate.whatsapp_contact || "",
    preferredNiches: Array.isArray(affiliate.preferred_niches) ? affiliate.preferred_niches : [],
    payoutNotes: affiliate.payout_notes || ""
  };
}

module.exports = async function handler(req, res) {
  if (!supabase.isConfigured()) {
    return sendJson(res, 500, { error: "Falta configurar Supabase" });
  }

  try {
    const access = await resolveAffiliateRequestAccess(req, res);
    const affiliate = access && access.affiliate;
    if (!affiliate) {
      return sendJson(res, 403, { error: "Acceso no autorizado." });
    }

    if (req.method === "GET") {
      return sendJson(res, 200, {
        ok: true,
        profile: toProfilePayload(affiliate)
      });
    }

    if (req.method !== "PATCH") {
      return sendJson(res, 405, { error: "Method not allowed" });
    }

    const body = await parseJsonBody(req);
    const profilePhotoUrl = normalizeString(body.profilePhotoUrl, 1500000);
    if (profilePhotoUrl && !/^https?:\/\//i.test(profilePhotoUrl)) {
      return sendJson(res, 400, { error: "La foto debe ser una URL válida ya subida al sistema." });
    }

    const payload = {
      display_title: normalizeString(body.displayTitle, 120),
      profile_photo_url: profilePhotoUrl,
      bio: normalizeString(body.bio, 1000),
      website_url: normalizeString(body.websiteUrl, 280),
      instagram_handle: normalizeString(body.instagramHandle, 80),
      whatsapp_contact: normalizeString(body.whatsappContact, 80),
      preferred_niches: normalizeNiches(body.preferredNiches),
      payout_notes: normalizeString(body.payoutNotes, 500)
    };

    const updated = await supabase.update(
      "affiliates",
      `id=eq.${encodeURIComponent(affiliate.id)}`,
      payload
    );

    return sendJson(res, 200, {
      ok: true,
      profile: toProfilePayload(Array.isArray(updated) && updated[0] ? updated[0] : Object.assign({}, affiliate, payload))
    });
  } catch (error) {
    return sendJson(res, 500, {
      error: error.message || "No se pudo actualizar el perfil del afiliado."
    });
  }
};
