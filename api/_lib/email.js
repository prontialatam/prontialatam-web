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
  const senderEmail = (process.env.AFFILIATE_ONBOARDING_FROM_EMAIL || process.env.PURCHASE_CONFIRMATION_FROM_EMAIL || "").trim();
  if (!senderEmail) {
    return { ok: false, skipped: true, reason: "missing_sender_email" };
  }

  const senderName = (process.env.AFFILIATE_ONBOARDING_FROM_NAME || process.env.PURCHASE_CONFIRMATION_FROM_NAME || "ProntIA LATAM").trim();
  const replyTo = (process.env.AFFILIATE_ONBOARDING_REPLY_TO || process.env.PURCHASE_CONFIRMATION_REPLY_TO || "").trim();
  const supportEmail = options.supportEmail || replyTo || senderEmail;
  const supportWhatsApp = options.supportWhatsApp || "+34 697 47 46 46";
  const brandLogoUrl = options.brandLogoUrl || "";
  const dossierUrl = options.dossierUrl || "";
  const productDossierUrl = options.productDossierUrl || "";
  const socialLibraryUrl = options.socialLibraryUrl || "";
  const connectHtml = options.connectUrl
    ? `<tr><td style="padding:0 0 14px;"><strong style="display:block;color:#12385b;font-size:14px;letter-spacing:0.06em;text-transform:uppercase;margin-bottom:6px;">Configurar cobros</strong><a href="${options.connectUrl}" style="color:#185fa5;text-decoration:none;word-break:break-word;">Activar Stripe Connect</a></td></tr>`
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
      <div style="margin:0;background:#f3efe7;padding:32px 16px;font-family:'DM Sans',Arial,sans-serif;color:#203040;">
        <div style="max-width:720px;margin:0 auto;background:#ffffff;border:1px solid #d9d1c4;border-radius:24px;overflow:hidden;">
          <div style="background:linear-gradient(180deg,#153b5d 0%,#1f557a 100%);padding:16px 28px 18px;color:#ffffff;text-align:center;">
            ${brandLogoUrl ? `<div style="margin:0 0 6px;"><img src="${brandLogoUrl}" alt="ProntIA LATAM" style="display:block;height:92px;width:auto;max-width:300px;margin:0 auto;"></div>` : ""}
            <h1 style="margin:0;font-size:28px;line-height:1.02;font-family:'Cormorant Garamond',Georgia,serif;font-weight:700;letter-spacing:0.01em;">Tu acceso de afiliado ya está listo</h1>
          </div>
          <div style="padding:34px 40px 20px;">
            <p style="margin:0 0 18px;font-size:16px;line-height:1.75;color:#314354;">Hola ${options.fullName || ""}, hemos aprobado tu acceso al programa de afiliados de ProntIA LATAM. Ya puedes empezar con una base real de producto, material gráfico, activos comerciales y trazabilidad de ventas.</p>

            <div style="background:#f7f3ec;border:1px solid #e4dacb;border-radius:18px;padding:22px 24px;margin-bottom:28px;">
              <div style="font-size:13px;letter-spacing:0.12em;text-transform:uppercase;color:#7a6d5c;margin-bottom:10px;">Resumen de activación</div>
              <div style="font-size:24px;font-weight:700;color:#12385b;margin-bottom:8px;">Programa de afiliados ProntIA LATAM</div>
              <div style="font-size:15px;line-height:1.85;">
                <div><strong>Comisión base:</strong> 60% sobre la venta neta</div>
                <div><strong>Código de afiliado:</strong> ${options.trackingCode}</div>
                <div><strong>Cupón de apoyo:</strong> ${options.couponCode}</div>
              </div>
            </div>

            <h2 style="margin:0 0 14px;font-size:24px;line-height:1.2;font-family:'Cormorant Garamond',Georgia,serif;color:#12385b;">Tus accesos principales</h2>
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="width:100%;margin:0 0 18px;">
              <tr>
                <td style="padding:0 0 14px;"><strong style="display:block;color:#12385b;font-size:14px;letter-spacing:0.06em;text-transform:uppercase;margin-bottom:6px;">Enlace de ventas</strong><a href="${options.affiliateLink}" style="color:#185fa5;text-decoration:none;word-break:break-word;">${options.affiliateLink}</a></td>
              </tr>
              <tr>
                <td style="padding:0 0 14px;"><strong style="display:block;color:#12385b;font-size:14px;letter-spacing:0.06em;text-transform:uppercase;margin-bottom:6px;">Portal privado</strong><a href="${options.portalUrl}" style="color:#185fa5;text-decoration:none;word-break:break-word;">${options.portalUrl}</a></td>
              </tr>
              <tr>
                <td style="padding:0 0 14px;"><strong style="display:block;color:#12385b;font-size:14px;letter-spacing:0.06em;text-transform:uppercase;margin-bottom:6px;">Kit descargable</strong><a href="${options.kitUrl}" style="color:#185fa5;text-decoration:none;word-break:break-word;">Descargar kit base</a></td>
              </tr>
              ${dossierUrl ? `<tr><td style="padding:0 0 14px;"><strong style="display:block;color:#12385b;font-size:14px;letter-spacing:0.06em;text-transform:uppercase;margin-bottom:6px;">Dossier de marca</strong><a href="${dossierUrl}" style="color:#185fa5;text-decoration:none;word-break:break-word;">Abrir dossier de marca</a></td></tr>` : ""}
              ${productDossierUrl ? `<tr><td style="padding:0 0 14px;"><strong style="display:block;color:#12385b;font-size:14px;letter-spacing:0.06em;text-transform:uppercase;margin-bottom:6px;">Dossier del producto</strong><a href="${productDossierUrl}" style="color:#185fa5;text-decoration:none;word-break:break-word;">Ver dossier de talleres mecánicos</a></td></tr>` : ""}
              ${socialLibraryUrl ? `<tr><td style="padding:0 0 14px;"><strong style="display:block;color:#12385b;font-size:14px;letter-spacing:0.06em;text-transform:uppercase;margin-bottom:6px;">Biblioteca visual</strong><a href="${socialLibraryUrl}" style="color:#185fa5;text-decoration:none;word-break:break-word;">Ver piezas para RRSS</a></td></tr>` : ""}
              ${connectHtml}
            </table>

            <div style="background:#fbf8f2;border-left:4px solid #c4a972;padding:18px 20px;border-radius:12px;margin:0 0 24px;">
              <div style="font-size:15px;line-height:1.8;">
                <strong>Siguiente secuencia recomendada:</strong> revisa el dossier de marca, abre el dossier del producto, configura Stripe Connect para dejar listos tus cobros y publica tu primera pieza usando siempre tu enlace de seguimiento.
              </div>
            </div>

            <h3 style="margin:0 0 10px;font-size:20px;font-family:'Cormorant Garamond',Georgia,serif;color:#12385b;">Qué te entregamos con esta alta</h3>
            <ul style="margin:0 0 20px;padding:0 0 0 20px;color:#314354;font-size:15px;line-height:1.8;">
              <li>Material gráfico listo para feed, stories, reels, formatos anchos y WhatsApp.</li>
              <li>Copies y argumentos comerciales para vender sin improvisar.</li>
              <li>Código de afiliado y trazabilidad de ventas.</li>
              <li>Base documental para mantener una comunicación de marca sólida y profesional.</li>
            </ul>

            <p style="margin:0 0 18px;font-size:15px;line-height:1.8;">Si necesitas ayuda con tu enfoque, una adaptación a tu nicho o soporte comercial, responde a este correo, escríbenos a <a href="mailto:${supportEmail}" style="color:#12385b;">${supportEmail}</a> o contáctanos por WhatsApp en el <a href="https://wa.me/34697474646" style="color:#12385b;">${supportWhatsApp}</a>.</p>
          </div>
          <div style="padding:20px 40px 32px;border-top:1px solid #ece4d8;color:#6d7581;font-size:13px;line-height:1.8;">
            <div>Equipo ProntIA LATAM</div>
            <div>Onboarding de afiliados para productos digitales orientados a negocios reales en LATAM.</div>
          </div>
        </div>
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
      dossierUrl ? `Dossier de marca: ${dossierUrl}` : "",
      productDossierUrl ? `Dossier del producto: ${productDossierUrl}` : "",
      socialLibraryUrl ? `Biblioteca visual: ${socialLibraryUrl}` : "",
      connectText,
      `Soporte email: ${supportEmail}`,
      `WhatsApp: ${supportWhatsApp}`
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
  const instagramIconUrl = options.instagramIconUrl || "";
  const facebookIconUrl = options.facebookIconUrl || "";
  const youtubeIconUrl = options.youtubeIconUrl || "";

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
              <a href="${instagramUrl}" style="display:inline-block;text-decoration:none;margin:0 6px 8px;" aria-label="Instagram">
                ${instagramIconUrl ? `<img src="${instagramIconUrl}" alt="Instagram" width="38" height="38" style="display:block;width:38px;height:38px;border:0;">` : `<span style="display:inline-block;padding:8px 14px;border-radius:999px;background:#f4ede2;border:1px solid #decfb8;color:#12385b;font-weight:700;font-size:13px;line-height:1;">Instagram</span>`}
              </a>
              <a href="${facebookUrl}" style="display:inline-block;text-decoration:none;margin:0 6px 8px;" aria-label="Facebook">
                ${facebookIconUrl ? `<img src="${facebookIconUrl}" alt="Facebook" width="38" height="38" style="display:block;width:38px;height:38px;border:0;">` : `<span style="display:inline-block;padding:8px 14px;border-radius:999px;background:#f4ede2;border:1px solid #decfb8;color:#12385b;font-weight:700;font-size:13px;line-height:1;">Facebook</span>`}
              </a>
              <a href="${youtubeUrl}" style="display:inline-block;text-decoration:none;margin:0 6px 8px;" aria-label="YouTube">
                ${youtubeIconUrl ? `<img src="${youtubeIconUrl}" alt="YouTube" width="38" height="38" style="display:block;width:38px;height:38px;border:0;">` : `<span style="display:inline-block;padding:8px 14px;border-radius:999px;background:#f4ede2;border:1px solid #decfb8;color:#12385b;font-weight:700;font-size:13px;line-height:1;">YouTube</span>`}
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
