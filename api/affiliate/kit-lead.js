const { getSiteUrl, parseJsonBody, sendJson } = require("../_lib/http");
const supabase = require("../_lib/supabase");
const { sendBrevoEmail } = require("../_lib/email");

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
  const kitUrl = `${options.siteUrl}/descargar/kit-gratis-afiliados`;
  const challengeUrl = `${options.siteUrl}/afiliados#reto-7-dias`;
  const applicationUrl = `${options.siteUrl}/afiliados#solicitud`;

  return {
    subject: "Tu Kit Gratis + Reto de Activacion en 7 dias",
    htmlContent: `
      <div style="margin:0;background:#070b1d;padding:28px 16px;font-family:Arial,sans-serif;color:#172033;">
        <div style="max-width:680px;margin:0 auto;background:#ffffff;border-radius:22px;overflow:hidden;border:1px solid #ebe7df;">
          <div style="background:linear-gradient(135deg,#160a36 0%,#08152e 58%,#ff6a00 100%);padding:28px 34px;color:#ffffff;">
            <img src="${options.siteUrl}/logo-prontia.jpg" alt="ProntIA LATAM" style="display:block;width:126px;height:auto;margin:0 0 18px;">
            <div style="font-size:12px;text-transform:uppercase;letter-spacing:.14em;color:#ffd7b0;margin-bottom:8px;">Kit gratis para afiliados</div>
            <h1 style="margin:0;font-size:30px;line-height:1.08;">Tu material ya esta listo</h1>
            <p style="margin:14px 0 0;font-size:16px;line-height:1.7;color:#f8efe7;">Hola ${options.fullName}, aqui tienes el acceso al Kit Venta de Productos Digitales para Principiantes y al reto de primera activacion.</p>
          </div>
          <div style="padding:30px 34px 12px;">
            <p style="margin:0 0 18px;font-size:16px;line-height:1.75;">Empieza por descargar el kit, revisar el metodo y guardar el reto de 7 dias. Despues, si quieres vender con ProntIA LATAM y optar al 60% de comision, completa la solicitud de afiliado.</p>
            <div style="margin:24px 0;">
              <a href="${kitUrl}" style="display:inline-block;background:#ff6a00;color:#ffffff;text-decoration:none;font-weight:700;padding:14px 20px;border-radius:12px;margin:0 10px 12px 0;">Descargar el kit gratis</a>
              <a href="${challengeUrl}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;font-weight:700;padding:14px 20px;border-radius:12px;margin:0 10px 12px 0;">Ver reto de 7 dias</a>
            </div>
            <div style="background:#fff6ed;border:1px solid #ffd8b8;border-radius:16px;padding:18px 20px;margin:0 0 22px;">
              <strong style="display:block;color:#111827;margin-bottom:6px;">Siguiente paso recomendado</strong>
              <span style="font-size:15px;line-height:1.7;">Completa la solicitud para que podamos revisar tu perfil, activar tu acceso privado y prepararte materiales por nicho.</span>
            </div>
            <a href="${applicationUrl}" style="display:inline-block;color:#111827;font-weight:700;">Completar solicitud de afiliado</a>
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
      "Tu Kit Venta de Productos Digitales para Principiantes ya esta listo.",
      `Descargar kit: ${kitUrl}`,
      `Reto de 7 dias: ${challengeUrl}`,
      "",
      "Siguiente paso recomendado: completa la solicitud de afiliado.",
      `Solicitud: ${applicationUrl}`
    ].join("\n")
  };
}

function buildAdminEmail(options) {
  return {
    subject: `Nuevo lead Kit Gratis: ${options.fullName}`,
    htmlContent: `
      <div style="margin:0;background:#f3f4f6;padding:28px 16px;font-family:Arial,sans-serif;color:#111827;">
        <div style="max-width:720px;margin:0 auto;background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #e5e7eb;">
          <div style="background:#111827;color:#ffffff;padding:22px 28px;">
            <div style="font-size:12px;text-transform:uppercase;letter-spacing:.14em;color:#ffb36b;">Lead magnet afiliados</div>
            <h1 style="margin:8px 0 0;font-size:24px;">Nuevo registro para Kit Gratis + Reto</h1>
          </div>
          <div style="padding:26px 28px;">
            <p><strong>Nombre:</strong> ${options.fullName}</p>
            <p><strong>Email:</strong> ${options.email}</p>
            <p><strong>WhatsApp:</strong> ${options.whatsapp}</p>
            <p><strong>Pais:</strong> ${options.country || "No indicado"}</p>
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
      "Nuevo lead Kit Gratis + Reto",
      `Nombre: ${options.fullName}`,
      `Email: ${options.email}`,
      `WhatsApp: ${options.whatsapp}`,
      `Pais: ${options.country || "No indicado"}`,
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

    if (!fullName || !email || !whatsapp) {
      return sendJson(res, 400, { error: "Indica nombre, email y WhatsApp." });
    }
    if (!isValidEmail(email)) {
      return sendJson(res, 400, { error: "Revisa el email. Parece incompleto." });
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
      insertResult = await supabase.insert("affiliate_applications", {
        full_name: fullName,
        email,
        country: country || "No indicado",
        phone_country_code: "Lead kit",
        phone_number: whatsapp,
        main_channel: "Meta lead magnet - Kit Gratis + Reto",
        audience_type: "Lead intermedio: Kit Venta de Productos Digitales para Principiantes",
        notes: [
          "Estado inicial: lead_kit. No es todavia solicitud formal de afiliado.",
          `WhatsApp: ${whatsapp}`,
          `Landing: ${pageUrl || "/kit-gratis-afiliados"}`,
          `Origen: ${sourceSummary}`,
          "",
          "Accion recomendada: enviar seguimiento por WhatsApp/email para que complete /afiliados#solicitud."
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
      const applicant = buildApplicantEmail({ fullName, siteUrl });
      const admin = buildAdminEmail({ fullName, email, whatsapp, country, sourceSummary, pageUrl });
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
      downloadUrl: `${siteUrl}/descargar/kit-gratis-afiliados`,
      nextUrl: `${siteUrl}/descargar/kit-gratis-afiliados`
    });
  } catch (error) {
    return sendJson(res, 500, { error: error.message || "No se pudo registrar el lead." });
  }
};