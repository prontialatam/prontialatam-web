const { parseJsonBody, sendJson } = require("../_lib/http");
const supabase = require("../_lib/supabase");
const {
  sendAffiliateApplicationAdminNotificationEmail,
  sendAffiliateApplicationReceivedEmail
} = require("../_lib/email");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return sendJson(res, 405, { error: "Method not allowed" });
  }

  try {
    const body = await parseJsonBody(req);
    const fullName = (body.fullName || "").trim();
    const email = (body.email || "").trim().toLowerCase();
    const country = (body.country || "").trim();
    const phoneCountryCode = (body.phoneCountryCode || "").trim();
    const phoneNumber = (body.phoneNumber || "").trim();
    const rawChannels = Array.isArray(body.mainChannel)
      ? body.mainChannel
      : body.mainChannel
        ? [body.mainChannel]
        : [];
    const mainChannel = rawChannels
      .map(function (item) {
        return String(item || "").trim();
      })
      .filter(Boolean);
    const audienceType = (body.audienceType || "").trim();
    const rawProfiles = Array.isArray(body.profileLinks) ? body.profileLinks : [];
    const profileLinks = rawProfiles
      .map(function (item) {
        return {
          network: String(item && item.network ? item.network : "").trim(),
          profile: String(item && item.profile ? item.profile : "").trim()
        };
      })
      .filter(function (item) {
        return item.network && item.profile;
      });
    const notes = (body.notes || "").trim();

    if (!fullName || !email || !country || !phoneCountryCode || !phoneNumber || !mainChannel.length || !audienceType || !profileLinks.length || !notes) {
      return sendJson(res, 400, { error: "Faltan campos obligatorios." });
    }

    const profileSummary = profileLinks
      .map(function (item) {
        return `${item.network}: ${item.profile}`;
      })
      .join(" | ");
    const notesWithProfiles = `Perfiles: ${profileSummary}\n\n${notes}`;

    let insertResult = null;
    if (supabase.isConfigured()) {
      insertResult = await supabase.insert("affiliate_applications", {
        full_name: fullName,
        email,
        country,
        phone_country_code: phoneCountryCode,
        phone_number: phoneNumber,
        main_channel: mainChannel.join(", "),
        audience_type: audienceType,
        notes: notesWithProfiles,
        status: "pending"
      });
    }

    const siteUrl = ((process.env.SITE_URL || "").trim().replace(/\/$/, "")) || `${req.headers["x-forwarded-proto"] || "https"}://${req.headers.host}`;
    const adminUrl = `${siteUrl}/operativa-afiliados.html`;
    const brandLogoUrl = `${siteUrl}/logo-prontia.jpg`;

    const applicantEmailResult = await sendAffiliateApplicationReceivedEmail({
      email,
      fullName,
      brandLogoUrl,
      supportEmail: "hola@prontialatam.com",
      supportWhatsApp: "+34 697 47 46 46"
    });

    const adminEmailResult = await sendAffiliateApplicationAdminNotificationEmail({
      fullName,
      email,
      country,
      phoneCountryCode,
      phoneNumber,
      mainChannel: mainChannel.join(", "),
      audienceType,
      profileSummary,
      notes,
      adminUrl
    });

    return sendJson(res, 200, {
      ok: true,
      applicationId: Array.isArray(insertResult) && insertResult[0] ? insertResult[0].id : null,
      applicantEmailResult,
      adminEmailResult
    });
  } catch (error) {
    return sendJson(res, 500, { error: error.message || "No se pudo registrar la solicitud." });
  }
};
