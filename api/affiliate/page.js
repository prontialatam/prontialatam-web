const fs = require("fs/promises");
const { getSiteUrl } = require("../_lib/http");
const supabase = require("../_lib/supabase");
const {
  getAbsoluteProjectFile,
  getAffiliateByAccessToken,
  getProtectedPage,
  transformProtectedHtml
} = require("../_lib/affiliate-access");

function sendHtml(res, statusCode, html) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "private, no-store");
  res.end(html);
}

function getQueryParam(req, name) {
  const url = new URL(req.url, `https://${req.headers.host || "localhost"}`);
  return (url.searchParams.get(name) || "").trim();
}

function renderDeniedPage(siteUrl) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Acceso privado | ProntIA LATAM</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600;700&family=DM+Sans:wght@400;500;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="${siteUrl}/assets/css/commerce-pages.css">
</head>
<body>
  <div class="page-shell">
    <main>
      <section class="hero">
        <div class="container hero-grid">
          <div>
            <div class="eyebrow">Acceso privado</div>
            <h1 class="title">Este contenido solo está disponible para <em>afiliados aprobados</em></h1>
            <p class="lede">El portal, el kit base y la biblioteca comercial se activan únicamente después de revisar y aprobar manualmente la solicitud del afiliado en ProntIA LATAM.</p>
            <div class="cta-row">
              <a href="${siteUrl}/afiliados#solicitud" class="btn-primary">Quiero solicitar el alta</a>
              <a href="mailto:hola@prontialatam.com?subject=Acceso%20Programa%20Afiliados" class="btn-secondary">Contactar con soporte</a>
            </div>
          </div>
          <aside class="hero-card">
            <div class="hero-card-note">
              <strong>Proceso de acceso</strong>
              <ul class="bullet-list" style="margin-top:0.9rem;">
                <li>Solicitud pública gratuita.</li>
                <li>Revisión manual del perfil y redes.</li>
                <li>Aprobación interna en ProntIA LATAM.</li>
                <li>Email privado con acceso personal al portal.</li>
              </ul>
            </div>
          </aside>
        </div>
      </section>
    </main>
  </div>
</body>
</html>`;
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.statusCode = 405;
    return res.end("Method not allowed");
  }

  const siteUrl = getSiteUrl(req);
  const token = getQueryParam(req, "access");
  const pageKey = getQueryParam(req, "page");
  const page = getProtectedPage(pageKey);

  if (!page || !token || !supabase.isConfigured()) {
    return sendHtml(res, 403, renderDeniedPage(siteUrl));
  }

  try {
    const affiliate = await getAffiliateByAccessToken(supabase, token);
    if (!affiliate) {
      return sendHtml(res, 403, renderDeniedPage(siteUrl));
    }

    const filePath = getAbsoluteProjectFile(page.file);
    const html = await fs.readFile(filePath, "utf8");
    const transformed = transformProtectedHtml(html, siteUrl, token);
    return sendHtml(res, 200, transformed);
  } catch (_error) {
    return sendHtml(res, 500, renderDeniedPage(siteUrl));
  }
};
