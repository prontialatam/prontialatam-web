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
        <p>Te recomendamos seguir este orden:</p>
        <ol>
          <li>Revisa el dossier de marca y el dossier del producto.</li>
          <li>Elige el canal con el que vas a empezar.</li>
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
      `Kit: ${options.kitUrl}`
    ].join("\n")
  };

  if (replyTo) {
    payload.replyTo = { email: replyTo };
  }

  return sendBrevoEmail(payload);
}

module.exports = {
  sendAffiliateOnboardingEmail
};
