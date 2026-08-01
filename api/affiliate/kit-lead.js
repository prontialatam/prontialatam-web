const { getSiteUrl, parseJsonBody, sendJson } = require("../_lib/http");
const supabase = require("../_lib/supabase");
const { sendBrevoEmail } = require("../_lib/email");
const { buildPublicKitDownloadUrl, getPublicKit } = require("../_lib/public-kits");

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function cleanEmail(value) {
  return cleanText(value).toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function getEmailIdentity() {
  const senderEmail = (
    process.env.AFFILIATE_APPLICATION_FROM_EMAIL ||
    process.env.AFFILIATE_ONBOARDING_FROM_EMAIL ||
    process.env.PURCHASE_CONFIRMATION_FROM_EMAIL ||
    ""
  ).trim();
  const senderName = (
    process.env.AFFILIATE_APPLICATION_FROM_NAME ||
    process.env.AFFILIATE_ONBOARDING_FROM_NAME ||
    process.env.PURCHASE_CONFIRMATION_FROM_NAME ||
    "ProntIA LATAM"
  ).trim();
  const replyTo = (
    process.env.AFFILIATE_APPLICATION_REPLY_TO ||
    process.env.AFFILIATE_ONBOARDING_REPLY_TO ||
    process.env.PURCHASE_CONFIRMATION_REPLY_TO ||
    ""
  ).trim();

  return { senderEmail, senderName, replyTo };
}

function buildApplicantEmail(options) {
  const kitUrl = buildPublicKitDownloadUrl(options.siteUrl, options.kit.key);
  const challengeUrl = options.kit.challengeRoute ? `${options.siteUrl}${options.kit.challengeRoute}` : "";
  const applicationUrl = `${options.siteUrl}/afiliados#solicitud`;
  const secondaryAction = challengeUrl
    ? `<a href="${challengeUrl}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;font-weight:700;padding:14px 20px;border-radius:12px;margin:0 10px 12px 0;">Ver reto de 7 dias</a>`
    : "";
  const secondaryText = challengeUrl ? `Reto de 7 dias: ${challengeUrl}` : "";
  const supportBlock = challengeUrl
    ? "Empieza por descargar el kit, revisar el metodo y guardar el reto de 7 dias. Despues, si quieres vender con ProntIA LATAM y optar al 60% de comision, completa la solicitud de afiliado."
    : "Empieza por descargar el kit, revisar el calendario y adaptar los textos a tu nicho. Despues, si quieres vender con ProntIA LATAM y optar al 60% de comision, completa la solicitud de afiliado.";

  return {
    subject: options.kit.emailSubject,
    htmlContent: `
      <div style="margin:0;background:#070b1d;padding:28px 16px;font-family:Arial,sans-serif;color:#111111;">
        <div style="max-width:680px;margin:0 auto;background:#ffffff;border-radius:22px;overflow:hidden;border:1px solid #ebe7df;">
          <div style="background:#ffffff;padding:28px 34px 26px;color:#111111;border-bottom:1px solid #ebe7df;">
            <img src="${options.siteUrl}/logo-prontia.jpg" alt="ProntIA LATAM" style="display:block;width:126px;height:auto;margin:0 0 18px;">
            <div style="font-size:12px;text-transform:uppercase;letter-spacing:.14em;color:#ff6a00;font-weight:700;margin-bottom:8px;">Kit gratis para afiliados</div>
            <h1 style="margin:0;font-size:30px;line-height:1.08;color:#111111;">Tu material ya esta listo</h1>
            <p style="margin:14px 0 0;font-size:16px;line-height:1.7;color:#111111;">Hola ${options.fullName}, aqui tienes el acceso a <strong>${options.kit.title}</strong>.</p>
          </div>
          <div style="padding:30px 34px 12px;">
            <p style="margin:0 0 18px;font-size:16px;line-height:1.75;color:#111111;">${supportBlock}</p>
            <div style="margin:24px 0;">
              <a href="${kitUrl}" style="display:inline-block;background:#ff6a00;color:#ffffff;text-decoration:none;font-weight:700;padding:14px 20px;border-radius:12px;margin:0 10px 12px 0;">Descargar el kit gratis</a>
              ${secondaryAction}
            </div>
            <div style="background:#fff6ed;border:1px solid #ffd8b8;border-radius:16px;padding:18px 20px;margin:0 0 22px;">
              <strong style="display:block;color:#111827;margin-bottom:6px;">Siguiente paso recomendado</strong>
              <span style="font-size:15px;line-height:1.7;color:#111111;">Completa la solicitud para que podamos revisar tu perfil, activar tu acceso privado y prepararte materiales por nicho.</span>
            </div>
            <a href="${applicationUrl}" style="display:inline-block;color:#111111;font-weight:700;">Completar solicitud de afiliado</a>
          </div>
          <div style="padding:20px 34px 30px;color:#6b7280;font-size:13px;line-height:1.7;border-top:1px solid #ebe7df;">
            Equipo ProntIA LATAM<br>
            Soporte: <a href="mailto:hola@prontialatam.com" style="color:#111827;">hola@prontialatam.com</a>
          </div>
        </div>
      </div>
    `,
    textContent: [
      `Hola ${options.fullName},`,
      "",
      `Tu recurso gratuito ya esta listo: ${options.kit.title}.`,
      `Descargar kit: ${kitUrl}`,
      secondaryText,
      "",
      "Siguiente paso recomendado: completa la solicitud de afiliado.",
      `Solicitud: ${applicationUrl}`
    ].filter(Boolean).join("\n")
  };
}

function buildAdminEmail(options) {
  return {
    subject: `Nuevo lead Kit Gratis: ${options.kit.shortTitle} | ${options.fullName}`,
    htmlContent: `
      <div style="margin:0;background:#f3f4f6;padding:28px 16px;font-family:Arial,sans-serif;color:#111827;">
        <div style="max-width:720px;margin:0 auto;background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #e5e7eb;">
          <div style="background:#111827;color:#ffffff;padding:22px 28px;">
            <div style="font-size:12px;text-transform:uppercase;letter-spacing:.14em;color:#ffb36b;">Lead magnet afiliados</div>
            <h1 style="margin:8px 0 0;font-size:24px;">Nuevo registro para kit gratuito</h1>
          </div>
          <div style="padding:26px 28px;">
            <p><strong>Nombre:</strong> ${options.fullName}</p>
            <p><strong>Email:</strong> ${options.email}</p>
            <p><strong>WhatsApp:</strong> ${options.whatsapp}</p>
            <p><strong>Pais:</strong> ${options.country || "No indicado"}</p>
            <p><strong>Kit solicitado:</strong> ${options.kit.title}</p>
            <p><strong>Consentimiento comercial:</strong> ${options.marketingConsent ? "SI" : "NO"}</p>
            <p><strong>Origen:</strong> ${options.sourceSummary}</p>
            <p><strong>URL:</strong> ${options.pageUrl}</p>
            <div style="margin-top:18px;padding:16px;border-left:4px solid #ff6a00;background:#fff7ed;">
              Este lead aun no es una solicitud formal de afiliado. El siguiente objetivo es moverlo por email o WhatsApp a completar la solicitud completa.
            </div>
          </div>
        </div>
      </div>
    `,
    textContent: [
      "Nuevo lead de kit gratuito",
      `Nombre: ${options.fullName}`,
      `Email: ${options.email}`,
      `WhatsApp: ${options.whatsapp}`,
      `Pais: ${options.country || "No indicado"}`,
      `Kit solicitado: ${options.kit.title}`,
      `Consentimiento comercial: ${options.marketingConsent ? "SI" : "NO"}`,
      `Origen: ${options.sourceSummary}`,
      `URL: ${options.pageUrl}`
    ].join("\n")
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return sendJson(res, 405, { error: "Method not allowed" });
  }

  try {
    const body = await parseJsonBody(req);
    if (cleanText(body.company)) {
      return sendJson(res, 200, { ok: true, skipped: true });
    }

    const fullName = cleanText(body.fullName);
    const email = cleanEmail(body.email);
    const whatsapp = cleanText(body.whatsapp);
    const country = cleanText(body.country);
    const pageUrl = cleanText(body.pageUrl);
    const utmSource = cleanText(body.utmSource);
    const utmMedium = cleanText(body.utmMedium);
    const utmCampaign = cleanText(body.utmCampaign);
    const utmContent = cleanText(body.utmContent);
    const kitKey = cleanText(body.kitKey);
    const marketingConsent = Boolean(body.marketingConsent);
    const kit = getPublicKit(kitKey);

    if (!fullName || !email || !whatsapp) {
      return sendJson(res, 400, { error: "Indica nombre, email y WhatsApp." });
    }
    if (!isValidEmail(email)) {
      return sendJson(res, 400, { error: "Revisa el email. Parece incompleto." });
    }
    if (!marketingConsent) {
      return sendJson(res, 400, { error: "Debes aceptar el consentimiento para recibir emails sobre el kit y recursos comerciales relacionados." });
    }

    const siteUrl = getSiteUrl(req);
    const sourceSummary = [
      utmSource ? `source=${utmSource}` : "",
      utmMedium ? `medium=${utmMedium}` : "",
      utmCampaign ? `campaign=${utmCampaign}` : "",
      utmContent ? `content=${utmContent}` : ""
    ].filter(Boolean).join(" | ") || "Sin UTM";

    let insertResult = null;
    if (supabase.isConfigured()) {
      const consentTimestamp = new Date().toISOString();
      insertResult = await supabase.insert("affiliate_applications", {
        full_name: fullName,
        email,
        country: country || "No indicado",
        phone_country_code: "Lead kit",
        phone_number: whatsapp,
        main_channel: kit.mainChannel,
        audience_type: kit.audienceType,
        notes: [
          "Estado inicial: lead_kit. No es todavia solicitud formal de afiliado.",
          `Kit solicitado: ${kit.title}`,
          `WhatsApp: ${whatsapp}`,
          `Landing: ${pageUrl || "/kit-gratis-afiliados"}`,
          `Origen: ${sourceSummary}`,
          `Consentimiento comercial: SI`,
          `Fuente consentimiento: formulario ${kit.key}`,
          `Fecha consentimiento: ${consentTimestamp}`,
          "",
          kit.followUpAction
        ].join("\n"),
        status: "lead_kit"
      });
    }

    const identity = getEmailIdentity();
    const emailResults = {
      applicant: { ok: false, skipped: true, reason: "missing_sender_email" },
      admin: { ok: false, skipped: true, reason: "missing_sender_email" }
    };

    if (identity.senderEmail) {
      const applicant = buildApplicantEmail({ fullName, siteUrl, kit });
      const admin = buildAdminEmail({ fullName, email, whatsapp, country, sourceSummary, pageUrl, kit, marketingConsent });
      const recipientEmail = (
        process.env.AFFILIATE_NOTIFICATION_TO_EMAIL ||
        process.env.AFFILIATE_APPLICATION_REPLY_TO ||
        process.env.AFFILIATE_ONBOARDING_REPLY_TO ||
        process.env.PURCHASE_CONFIRMATION_REPLY_TO ||
        "hola@prontialatam.com"
      ).trim();

      const baseSender = {
        sender: { email: identity.senderEmail, name: identity.senderName }
      };
      const replyTo = identity.replyTo ? { replyTo: { email: identity.replyTo } } : {};

      emailResults.applicant = await sendBrevoEmail({
        ...baseSender,
        ...replyTo,
        to: [{ email, name: fullName }],
        subject: applicant.subject,
        htmlContent: applicant.htmlContent,
        textContent: applicant.textContent
      });

      if (recipientEmail) {
        emailResults.admin = await sendBrevoEmail({
          ...baseSender,
          ...replyTo,
          to: [{ email: recipientEmail, name: "Gestion ProntIA LATAM" }],
          subject: admin.subject,
          htmlContent: admin.htmlContent,
          textContent: admin.textContent
        });
      }
    }

    return sendJson(res, 200, {
      ok: true,
      leadId: Array.isArray(insertResult) && insertResult[0] ? insertResult[0].id : null,
      emailResults,
      kitKey: kit.key,
      kitTitle: kit.title,
      successTitle: kit.successTitle,
      successBody: kit.successBody,
      successCta: kit.successCta,
      downloadUrl: buildPublicKitDownloadUrl(siteUrl, kit.key),
      nextUrl: buildPublicKitDownloadUrl(siteUrl, kit.key)
    });
  } catch (error) {
    return sendJson(res, 500, { error: error.message || "No se pudo registrar el lead." });
  }
};
