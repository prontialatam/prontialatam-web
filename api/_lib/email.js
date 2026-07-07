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
  const instagramUrl = options.instagramUrl || "https://www.instagram.com/prontialatam";
  const facebookUrl = options.facebookUrl || "https://www.facebook.com/profile.php?id=61590596812173";
  const youtubeUrl = options.youtubeUrl || "https://www.youtube.com/@ProntiaLatam";

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
          <div style="background:linear-gradient(180deg,#153b5d 0%,#1f557a 100%);padding:12px 28px 14px;color:#ffffff;text-align:center;">
            ${brandLogoUrl ? `<div style="margin:0 0 4px;"><img src="${brandLogoUrl}" alt="ProntIA LATAM" style="display:block;height:112px;width:auto;max-width:340px;margin:0 auto;"></div>` : ""}
            <h1 style="margin:0;font-size:23px;line-height:1.02;font-family:'Cormorant Garamond',Georgia,serif;font-weight:700;letter-spacing:0.01em;">Tu compra ya está confirmada</h1>
          </div>
          <div style="padding:36px 40px 20px;">
            <p style="margin:0 0 20px;font-size:16px;line-height:1.75;color:#314354;">Hola ${firstName}, ya tienes preparado el acceso a tu material para empezar hoy mismo. Debajo encontrarás el resumen del pedido y los enlaces para descargar el kit y consultar la guía.</p>
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
            <div style="margin:0 0 14px;text-align:center;">
              <a href="${instagramUrl}" style="display:inline-block;text-decoration:none;margin:0 6px;" aria-label="Instagram">
                <span style="display:inline-flex;align-items:center;justify-content:center;width:38px;height:38px;border-radius:999px;background:#f4ede2;border:1px solid #decfb8;">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
                    <rect x="3.5" y="3.5" width="17" height="17" rx="4.5" stroke="#12385b" stroke-width="1.8"/>
                    <circle cx="12" cy="12" r="4.2" stroke="#12385b" stroke-width="1.8"/>
                    <circle cx="17.2" cy="6.9" r="1.2" fill="#12385b"/>
                  </svg>
                </span>
              </a>
              <a href="${facebookUrl}" style="display:inline-block;text-decoration:none;margin:0 6px;" aria-label="Facebook">
                <span style="display:inline-flex;align-items:center;justify-content:center;width:38px;height:38px;border-radius:999px;background:#f4ede2;border:1px solid #decfb8;">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
                    <path d="M13.3 20V12.7H15.8L16.2 9.9H13.3V8.1C13.3 7.3 13.5 6.8 14.7 6.8H16.3V4.2C16 4.1 15.1 4 14.1 4C11.8 4 10.3 5.4 10.3 8V9.9H7.8V12.7H10.3V20H13.3Z" fill="#12385b"/>
                  </svg>
                </span>
              </a>
              <a href="${youtubeUrl}" style="display:inline-block;text-decoration:none;margin:0 6px;" aria-label="YouTube">
                <span style="display:inline-flex;align-items:center;justify-content:center;width:38px;height:38px;border-radius:999px;background:#f4ede2;border:1px solid #decfb8;">
                  <svg width="20" height="14" viewBox="0 0 24 18" fill="none" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
                    <rect x="1.5" y="1.5" width="21" height="15" rx="4.5" stroke="#12385b" stroke-width="1.8"/>
                    <path d="M10 6.2V11.8L14.8 9L10 6.2Z" fill="#12385b"/>
                  </svg>
                </span>
              </a>
            </div>
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
      `WhatsApp: ${supportWhatsApp}`,
      `Instagram: ${instagramUrl}`,
      `Facebook: ${facebookUrl}`,
      `YouTube: ${youtubeUrl}`
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
