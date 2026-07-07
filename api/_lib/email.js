async function sendBrevoEmail(payload) {
  const apiKey = (process.env.BREVO_API_KEY || "").trim();
  if (!apiKey) {
    return { ok: false, skipped: true, reason: "missing_brevo_api_key" };
  }

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": apiKey
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "No se pudo enviar el email transaccional");
  }

  return { ok: true };
}

async function sendAffiliateOnboardingEmail(options) {
  const senderEmail = (process.env.AFFILIATE_ONBOARDING_FROM_EMAIL || "").trim();
  if (!senderEmail) {
    return { ok: false, skipped: true, reason: "missing_sender_email" };
  }

  const senderName = (process.env.AFFILIATE_ONBOARDING_FROM_NAME || "ProntIA LATAM").trim();
  const replyTo = (process.env.AFFILIATE_ONBOARDING_REPLY_TO || "").trim();
  const connectHtml = options.connectUrl
    ? `<p><strong>Configurar cobros con Stripe Connect:</strong><br><a href="${options.connectUrl}">${options.connectUrl}</a></p>`
    : "";
  const connectText = options.connectUrl ? `Stripe Connect: ${options.connectUrl}` : "";

  const payload = {
    sender: {
      email: senderEmail,
      name: senderName
    },
    to: [
      {
        email: options.email,
        name: options.fullName || options.email
      }
    ],
    subject: "Tu acceso al programa de afiliados de ProntIA LATAM",
    htmlContent: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#24303f;max-width:680px;margin:0 auto;">
        <h1 style="font-size:28px;line-height:1.1;color:#0c447c;">Tu acceso de afiliado ya está listo</h1>
        <p>Hola ${options.fullName || ""},</p>
        <p>Tu solicitud ha sido aprobada. Desde este momento ya puedes empezar a trabajar con el producto de talleres mecánicos de ProntIA LATAM.</p>
        <p><strong>Tu comisión base es del 60% sobre la venta neta</strong>.</p>
        <p><strong>Tu código de afiliado:</strong> ${options.trackingCode}</p>
        <p><strong>Tu cupón de apoyo:</strong> ${options.couponCode}</p>
        <p><strong>Tu enlace principal:</strong><br><a href="${options.affiliateLink}">${options.affiliateLink}</a></p>
        <p><strong>Portal de afiliados:</strong><br><a href="${options.portalUrl}">${options.portalUrl}</a></p>
        <p><strong>Kit descargable:</strong><br><a href="${options.kitUrl}">${options.kitUrl}</a></p>
        ${connectHtml}
        <p>Te recomendamos seguir este orden:</p>
        <ol>
          <li>Revisa el dossier de marca y el dossier del producto.</li>
          <li>Elige el canal con el que vas a empezar.</li>
          <li>Configura Stripe Connect para dejar listos tus datos de cobro.</li>
          <li>Usa una pieza del kit y publica siempre con tu enlace.</li>
        </ol>
        <p>Si necesitas material adaptado a tu nicho o una pieza personalizada, responde a este email.</p>
        <p>Equipo ProntIA LATAM</p>
      </div>
    `,
    textContent: [
      "Tu acceso de afiliado ya está listo.",
      `Comisión base: 60% sobre la venta neta.`,
      `Código de afiliado: ${options.trackingCode}`,
      `Cupón de apoyo: ${options.couponCode}`,
      `Enlace principal: ${options.affiliateLink}`,
      `Portal: ${options.portalUrl}`,
      `Kit: ${options.kitUrl}`,
      connectText
    ].filter(Boolean).join("\n")
  };

  if (replyTo) {
    payload.replyTo = { email: replyTo };
  }

  return sendBrevoEmail(payload);
}

async function sendPurchaseConfirmationEmail(options) {
  const senderEmail = (process.env.PURCHASE_CONFIRMATION_FROM_EMAIL || process.env.AFFILIATE_ONBOARDING_FROM_EMAIL || "").trim();
  if (!senderEmail) {
    return { ok: false, skipped: true, reason: "missing_sender_email" };
  }

  const senderName = (process.env.PURCHASE_CONFIRMATION_FROM_NAME || process.env.AFFILIATE_ONBOARDING_FROM_NAME || "ProntIA LATAM").trim();
  const replyTo = (process.env.PURCHASE_CONFIRMATION_REPLY_TO || process.env.AFFILIATE_ONBOARDING_REPLY_TO || "").trim();
  const firstName = (options.fullName || options.email || "cliente").trim().split(/\s+/)[0];
  const amountLabel = typeof options.amountTotal === "number" && options.currency
    ? `${options.amountTotal.toFixed(2)} ${options.currency}`
    : options.currency || "confirmado";
  const supportEmail = options.supportEmail || "hola@prontialatam.com";
  const supportWhatsApp = options.supportWhatsApp || "+34 697 47 46 46";
  const brandLogoUrl = options.brandLogoUrl || "";

  const payload = {
    sender: {
      email: senderEmail,
      name: senderName
    },
    to: [
      {
        email: options.email,
        name: options.fullName || options.email
      }
    ],
    subject: `Tu compra en ProntIA LATAM ya está confirmada: ${options.productName}`,
    htmlContent: `
      <div style="margin:0;background:#f3efe7;padding:32px 16px;font-family:'DM Sans',Arial,sans-serif;color:#203040;">
        <div style="max-width:720px;margin:0 auto;background:#ffffff;border:1px solid #d9d1c4;border-radius:24px;overflow:hidden;">
          <div style="background:linear-gradient(135deg,#12385b 0%,#245f86 100%);padding:36px 40px;color:#ffffff;">
            ${brandLogoUrl ? `<div style="margin-bottom:18px;"><img src="${brandLogoUrl}" alt="ProntIA LATAM" style="display:block;height:48px;width:auto;max-width:220px;"></div>` : ""}
            <div style="font-size:12px;letter-spacing:0.18em;text-transform:uppercase;opacity:0.78;margin-bottom:14px;">ProntIA LATAM</div>
            <h1 style="margin:0;font-size:34px;line-height:1.05;font-family:'Cormorant Garamond',Georgia,serif;font-weight:700;">Compra confirmada y acceso preparado</h1>
            <p style="margin:16px 0 0;font-size:16px;line-height:1.7;max-width:560px;">Hola ${firstName}, muchas gracias por confiar en ProntIA LATAM. Hemos confirmado tu pago y ya tienes preparado el acceso al material para que puedas empezar hoy mismo.</p>
          </div>
          <div style="padding:36px 40px 20px;">
            <div style="background:#f7f3ec;border:1px solid #e4dacb;border-radius:18px;padding:22px 24px;margin-bottom:28px;">
              <div style="font-size:13px;letter-spacing:0.12em;text-transform:uppercase;color:#7a6d5c;margin-bottom:10px;">Resumen del pedido</div>
              <div style="font-size:24px;font-weight:700;color:#12385b;margin-bottom:8px;">${options.productName}</div>
              <div style="font-size:15px;line-height:1.8;">
                <div><strong>Importe confirmado:</strong> ${amountLabel}</div>
                <div><strong>Referencia de compra:</strong> ${options.sessionId}</div>
              </div>
            </div>

            <h2 style="margin:0 0 14px;font-size:24px;line-height:1.2;font-family:'Cormorant Garamond',Georgia,serif;color:#12385b;">Tu acceso inmediato</h2>
            <p style="margin:0 0 18px;font-size:16px;line-height:1.8;">Hemos preparado dos accesos para que empieces sin fricción: una descarga directa del kit y una guía del producto con contexto, recomendaciones y próximos pasos.</p>

            <div style="margin:0 0 24px;">
              <a href="${options.deliveryAssetUrl}" style="display:inline-block;background:#12385b;color:#ffffff;text-decoration:none;padding:14px 22px;border-radius:999px;font-weight:700;margin:0 12px 12px 0;">Descargar tu kit ahora</a>
              <a href="${options.deliveryPageUrl}" style="display:inline-block;background:#f4ede2;color:#12385b;text-decoration:none;padding:14px 22px;border-radius:999px;font-weight:700;border:1px solid #d9cdb8;margin:0 12px 12px 0;">Ver guía del producto</a>
            </div>

            <div style="background:#fbf8f2;border-left:4px solid #c4a972;padding:18px 20px;border-radius:12px;margin:0 0 26px;">
              <div style="font-size:15px;line-height:1.8;">
                <strong>Recomendación de uso:</strong> abre primero la guía del producto, identifica los bloques que mejor encajan con tu negocio y después descarga el material para empezar a aplicar los prompts de forma práctica.
              </div>
            </div>

            <h3 style="margin:0 0 10px;font-size:20px;font-family:'Cormorant Garamond',Georgia,serif;color:#12385b;">Si necesitas ayuda</h3>
            <p style="margin:0 0 18px;font-size:15px;line-height:1.8;">Si tienes cualquier duda sobre la compra, el acceso o el uso del material, responde a este correo, escríbenos a <a href="mailto:${supportEmail}" style="color:#12385b;">${supportEmail}</a> o contáctanos por WhatsApp en el <a href="https://wa.me/34697474646" style="color:#12385b;">${supportWhatsApp}</a>.</p>
          </div>
          <div style="padding:20px 40px 34px;border-top:1px solid #ece4d8;color:#6d7581;font-size:13px;line-height:1.8;">
            <div>Este email confirma una compra realizada en ProntIA LATAM.</div>
            <div>Si no reconoces esta operación, contacta con soporte cuanto antes.</div>
          </div>
        </div>
      </div>
    `,
    textContent: [
      `Hola ${firstName},`,
      "",
      `Tu compra en ProntIA LATAM ya está confirmada.`,
      `Producto: ${options.productName}`,
      `Importe: ${amountLabel}`,
      `Referencia: ${options.sessionId}`,
      "",
      `Descarga directa: ${options.deliveryAssetUrl}`,
      `Guía del producto: ${options.deliveryPageUrl}`,
      "",
      `Soporte email: ${supportEmail}`,
      `WhatsApp: ${supportWhatsApp}`
    ].join("\n")
  };

  if (replyTo) {
    payload.replyTo = { email: replyTo };
  }

  return sendBrevoEmail(payload);
}

module.exports = {
  sendAffiliateOnboardingEmail,
  sendPurchaseConfirmationEmail
};
