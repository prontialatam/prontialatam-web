const fs = require("fs/promises");
const { getSiteUrl } = require("../_lib/http");
const supabase = require("../_lib/supabase");
const {
  getAbsoluteProjectFile,
  getProtectedPage,
  transformProtectedHtml
} = require("../_lib/affiliate-access");
const { resolveAffiliateRequestAccess } = require("../_lib/affiliate-auth");

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

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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
  <link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@500;600;700;800&family=DM+Sans:wght@400;500;700&display=swap" rel="stylesheet">
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
              <a href="${siteUrl}/portal-afiliados" class="btn-secondary">Ir al acceso del portal</a>
            </div>
          </div>
          <aside class="hero-card">
            <div class="hero-card-note">
              <strong>Proceso de acceso</strong>
              <ul class="bullet-list" style="margin-top:0.9rem;">
                <li>Solicitud pública gratuita.</li>
                <li>Revisión manual del perfil y redes.</li>
                <li>Aprobación interna en ProntIA LATAM.</li>
                <li>Activación de contraseña y acceso al portal privado.</li>
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

function renderAccessPage(siteUrl, options) {
  const initialMode = options.mode === "activate" ? "activate" : options.mode === "recover" ? "recover" : "login";
  const loginActive = initialMode === "login";
  const activateActive = initialMode === "activate";
  const recoverActive = initialMode === "recover";
  const cardTitle = activateActive
    ? "Activa tu acceso con contraseña"
    : recoverActive
      ? "Recupera tu acceso al portal"
      : "Accede a tu portal privado";
  const cardCopy = activateActive
    ? "Tu alta ya está aprobada. Define ahora tu contraseña para convertir este acceso privado en un login real y estable."
    : recoverActive
      ? "Solicita un email seguro de recuperación y, cuando abras ese enlace, define una nueva contraseña dentro de este mismo portal."
      : "Entra con tu email y tu contraseña para abrir el dashboard de afiliado, tus materiales y tus métricas.";
  const showActivateTab = Boolean(options.showActivateTab);
  const message = options.message
    ? `<div id="pageNotice" class="notice-box">${escapeHtml(options.message)}</div>`
    : `<div id="pageNotice" class="notice-box" hidden></div>`;

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Acceso al Portal | ProntIA LATAM</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@500;600;700;800&family=DM+Sans:wght@400;500;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="${siteUrl}/assets/css/commerce-pages.css">
  <style>
    body {
      margin: 0;
      font-family: "DM Sans", sans-serif;
      background:
        radial-gradient(circle at top left, rgba(22, 95, 168, 0.16), transparent 28%),
        linear-gradient(180deg, #f8f5ef 0%, #ffffff 42%);
      color: #17314d;
    }
    .auth-shell {
      min-height: 100vh;
      display: grid;
      place-items: center;
      padding: 2rem 1rem;
    }
    .auth-card {
      width: min(980px, 100%);
      display: grid;
      grid-template-columns: 1.05fr 0.95fr;
      gap: 1.25rem;
      align-items: stretch;
    }
    .auth-panel,
    .auth-form-card {
      background: rgba(255,255,255,0.96);
      border: 1px solid rgba(11, 36, 64, 0.08);
      border-radius: 1.6rem;
      box-shadow: 0 26px 60px rgba(16, 60, 106, 0.12);
      overflow: hidden;
    }
    .auth-panel {
      padding: 1.8rem;
      background:
        radial-gradient(circle at top right, rgba(55, 138, 221, 0.14), transparent 34%),
        linear-gradient(180deg, rgba(255,255,255,0.98), rgba(247,251,255,0.94));
    }
    .auth-brand {
      display: inline-flex;
      align-items: center;
      gap: 0.8rem;
      margin-bottom: 1.5rem;
      text-decoration: none;
      color: inherit;
    }
    .auth-brand img {
      height: 52px;
      border-radius: 10px;
      box-shadow: 0 14px 32px rgba(12,68,124,0.15);
    }
    .auth-brand span,
    .auth-panel h1,
    .auth-form-head h2,
    .auth-tabs button {
      font-family: "Bricolage Grotesque", sans-serif;
      letter-spacing: -0.03em;
      color: #0b2440;
    }
    .auth-brand span {
      font-size: 1.06rem;
      font-weight: 700;
    }
    .auth-panel h1 {
      margin: 0 0 0.9rem;
      font-size: clamp(2.5rem, 4vw, 4rem);
      line-height: 0.94;
    }
    .auth-panel p {
      margin: 0;
      color: #5d6670;
      font-size: 1rem;
      line-height: 1.7;
    }
    .auth-list {
      list-style: none;
      padding: 0;
      margin: 1.5rem 0 0;
      display: grid;
      gap: 0.85rem;
    }
    .auth-list li {
      padding: 0.95rem 1rem;
      border-radius: 1rem;
      background: rgba(235,244,253,0.55);
      border: 1px solid rgba(11,36,64,0.06);
      color: #405160;
    }
    .auth-form-card {
      padding: 1.45rem;
      display: grid;
      gap: 1rem;
    }
    .auth-form-head h2 {
      margin: 0;
      font-size: 2rem;
      line-height: 1;
    }
    .auth-form-head p {
      margin: 0.45rem 0 0;
      color: #5d6670;
      line-height: 1.65;
    }
    .auth-tabs {
      display: flex;
      gap: 0.7rem;
      flex-wrap: wrap;
    }
    .auth-tabs button {
      border: 1px solid rgba(11,36,64,0.1);
      background: rgba(255,255,255,0.92);
      border-radius: 999px;
      padding: 0.78rem 1rem;
      font-size: 0.92rem;
      cursor: pointer;
    }
    .auth-tabs button.active {
      background: #153b5d;
      color: #fff;
      border-color: #153b5d;
    }
    .auth-form {
      display: grid;
      gap: 0.85rem;
    }
    .auth-form[hidden] {
      display: none;
    }
    .auth-form label {
      display: grid;
      gap: 0.35rem;
      color: #4f5a66;
      font-size: 0.92rem;
      font-weight: 500;
    }
    .auth-form input {
      width: 100%;
      padding: 0.96rem 1rem;
      border-radius: 0.9rem;
      border: 1px solid rgba(11,36,64,0.12);
      background: rgba(255,255,255,0.98);
      font: inherit;
      color: #0b2440;
      box-sizing: border-box;
    }
    .auth-form button {
      margin-top: 0.35rem;
    }
    .notice-box,
    .auth-status {
      padding: 0.95rem 1rem;
      border-radius: 1rem;
      background: rgba(235,244,253,0.6);
      border: 1px solid rgba(11,36,64,0.08);
      color: #405160;
      font-size: 0.92rem;
      line-height: 1.6;
    }
    .auth-status.error,
    .notice-box.error {
      background: rgba(181,69,69,0.12);
      color: #8b2f2f;
      border-color: rgba(181,69,69,0.14);
    }
    .auth-status.success,
    .notice-box.success {
      background: rgba(31,122,77,0.12);
      color: #236644;
      border-color: rgba(31,122,77,0.16);
    }
    .auth-inline {
      font-size: 0.9rem;
      color: #5d6670;
      line-height: 1.6;
    }
    .auth-inline a {
      color: #165fa8;
      text-decoration: none;
      font-weight: 700;
    }
    .auth-link-button {
      background: transparent;
      border: 0;
      padding: 0;
      margin: 0;
      color: #165fa8;
      text-decoration: none;
      font-weight: 700;
      cursor: pointer;
      font: inherit;
      text-align: left;
    }
    @media (max-width: 900px) {
      .auth-card {
        grid-template-columns: 1fr;
      }
    }
  </style>
</head>
<body>
  <div class="auth-shell">
    <div class="auth-card">
      <section class="auth-panel">
        <a class="auth-brand" href="${siteUrl}">
          <img src="${siteUrl}/logo-prontia.jpg" alt="ProntIA LATAM">
          <span>Portal Privado de Afiliados</span>
        </a>
        <h1>${loginActive ? "Accede a tu espacio de afiliado" : "Activa tu acceso definitivo"}</h1>
        <p>${cardCopy}</p>
        <ul class="auth-list">
          <li>Consulta tus métricas, materiales y estado de cobros desde un único espacio.</li>
          <li>Descarga los kits por nicho y gestiona tu perfil con una sesión segura.</li>
          <li>Una vez activada tu contraseña, podrás volver a entrar directamente desde ${siteUrl}/portal-afiliados.</li>
        </ul>
      </section>

      <section class="auth-form-card">
        <div class="auth-form-head">
          <h2>${cardTitle}</h2>
          <p>${activateActive ? "Este paso se hace una sola vez y convierte tu enlace privado en un acceso por email y contraseña." : recoverActive ? "Usa siempre el email con el que aprobamos tu perfil de afiliado para que el sistema encuentre tu cuenta." : "Usa el mismo email con el que te dimos de alta como afiliado."}</p>
        </div>
        <div class="auth-tabs">
          <button type="button" id="loginTab" class="${loginActive ? "active" : ""}">Entrar</button>
          ${showActivateTab ? `<button type="button" id="activateTab" class="${activateActive ? "active" : ""}">Activar contraseña</button>` : ""}
          <button type="button" id="recoverTab" class="${recoverActive ? "active" : ""}">Recuperar acceso</button>
        </div>
        ${message}
        <form id="loginForm" class="auth-form" ${loginActive ? "" : "hidden"}>
          <label>
            Email
            <input type="email" id="loginEmail" value="${escapeHtml(options.prefillEmail || "")}" placeholder="tu@email.com" autocomplete="username">
          </label>
          <label>
            Contraseña
            <input type="password" id="loginPassword" placeholder="Tu contraseña" autocomplete="current-password">
          </label>
          <button type="submit" class="btn-primary">Entrar al portal</button>
          <button type="button" id="forgotPasswordButton" class="auth-link-button">He olvidado mi contraseña</button>
          <p id="loginStatus" class="auth-status" hidden></p>
        </form>
        <form id="activateForm" class="auth-form" ${activateActive ? "" : "hidden"}>
          <label>
            Email aprobado
            <input type="email" id="activateEmail" value="${escapeHtml(options.prefillEmail || "")}" autocomplete="username" disabled>
          </label>
          <label>
            Nueva contraseña
            <input type="password" id="activatePassword" placeholder="Mínimo 8 caracteres" autocomplete="new-password">
          </label>
          <label>
            Repetir contraseña
            <input type="password" id="activatePasswordConfirm" placeholder="Repite tu contraseña" autocomplete="new-password">
          </label>
          <button type="submit" class="btn-primary">Activar y entrar</button>
          <p id="activateStatus" class="auth-status" hidden></p>
        </form>
        <form id="recoverRequestForm" class="auth-form" ${recoverActive ? "" : "hidden"}>
          <label>
            Email aprobado
            <input type="email" id="recoverEmail" value="${escapeHtml(options.prefillEmail || "")}" placeholder="tu@email.com" autocomplete="username">
          </label>
          <button type="submit" class="btn-primary">Enviar email de recuperación</button>
          <p id="recoverRequestStatus" class="auth-status" hidden></p>
        </form>
        <form id="recoverCompleteForm" class="auth-form" hidden>
          <label>
            Nueva contraseña
            <input type="password" id="recoverPassword" placeholder="Mínimo 8 caracteres" autocomplete="new-password">
          </label>
          <label>
            Repetir contraseña
            <input type="password" id="recoverPasswordConfirm" placeholder="Repite tu contraseña" autocomplete="new-password">
          </label>
          <button type="submit" class="btn-primary">Guardar nueva contraseña</button>
          <p id="recoverCompleteStatus" class="auth-status" hidden></p>
        </form>
        <div class="auth-inline">
          Si necesitas soporte, escríbenos a <a href="mailto:hola@prontialatam.com">hola@prontialatam.com</a>.
        </div>
      </section>
    </div>
  </div>

  <script>
    (function () {
      const mode = ${JSON.stringify(initialMode)};
      const token = ${JSON.stringify(options.token || "")};
      const recoverRequested = ${JSON.stringify(Boolean(options.recover))};
      const loginTab = document.getElementById("loginTab");
      const activateTab = document.getElementById("activateTab");
      const recoverTab = document.getElementById("recoverTab");
      const loginForm = document.getElementById("loginForm");
      const activateForm = document.getElementById("activateForm");
      const recoverRequestForm = document.getElementById("recoverRequestForm");
      const recoverCompleteForm = document.getElementById("recoverCompleteForm");
      const loginStatus = document.getElementById("loginStatus");
      const activateStatus = document.getElementById("activateStatus");
      const recoverRequestStatus = document.getElementById("recoverRequestStatus");
      const recoverCompleteStatus = document.getElementById("recoverCompleteStatus");
      const pageNotice = document.getElementById("pageNotice");
      const forgotPasswordButton = document.getElementById("forgotPasswordButton");
      const recoveryParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const recoveryToken = recoveryParams.get("access_token") || "";
      const recoveryType = recoveryParams.get("type") || "";
      const recoveryError = recoveryParams.get("error_description") || recoveryParams.get("error") || "";

      function showForm(nextMode) {
        loginForm.hidden = nextMode !== "login";
        activateForm.hidden = nextMode !== "activate";
        recoverRequestForm.hidden = nextMode !== "recover-request";
        recoverCompleteForm.hidden = nextMode !== "recover-complete";
        loginTab.classList.toggle("active", nextMode === "login");
        if (activateTab) activateTab.classList.toggle("active", nextMode === "activate");
        recoverTab.classList.toggle("active", nextMode === "recover-request" || nextMode === "recover-complete");
      }

      function setStatus(node, message, type) {
        node.hidden = !message;
        node.textContent = message || "";
        node.className = "auth-status" + (type ? " " + type : "");
      }

      function setNotice(message, type) {
        if (!pageNotice) return;
        pageNotice.hidden = !message;
        pageNotice.textContent = message || "";
        pageNotice.className = "notice-box" + (type ? " " + type : "");
      }

      loginTab.addEventListener("click", function () {
        showForm("login");
      });

      if (activateTab) {
        activateTab.addEventListener("click", function () {
          showForm("activate");
        });
      }

      recoverTab.addEventListener("click", function () {
        showForm(recoveryToken && recoveryType === "recovery" ? "recover-complete" : "recover-request");
      });

      forgotPasswordButton.addEventListener("click", function () {
        showForm("recover-request");
      });

      loginForm.addEventListener("submit", async function (event) {
        event.preventDefault();
        setStatus(loginStatus, "Comprobando acceso...", "");
        try {
          const response = await fetch("${siteUrl}/api/affiliate/auth/login", {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              email: document.getElementById("loginEmail").value.trim(),
              password: document.getElementById("loginPassword").value
            })
          });
          const payload = await response.json();
          if (!response.ok || !payload.ok) {
            throw new Error(payload.error || "No se pudo iniciar sesión.");
          }
          setStatus(loginStatus, "Acceso correcto. Entrando al portal...", "success");
          window.location.href = payload.redirectTo || "${siteUrl}/portal-afiliados";
        } catch (error) {
          setStatus(loginStatus, error.message || "No se pudo iniciar sesión.", "error");
        }
      });

      if (activateForm) {
        activateForm.addEventListener("submit", async function (event) {
          event.preventDefault();
          setStatus(activateStatus, "Activando tu acceso...", "");
          try {
            const response = await fetch("${siteUrl}/api/affiliate/auth/activate", {
              method: "POST",
              headers: {
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                access: token,
                password: document.getElementById("activatePassword").value,
                confirmPassword: document.getElementById("activatePasswordConfirm").value
              })
            });
            const payload = await response.json();
            if (!response.ok || !payload.ok) {
              throw new Error(payload.error || "No se pudo activar el acceso.");
            }
            setStatus(activateStatus, "Acceso activado. Entrando al portal...", "success");
            window.location.href = payload.redirectTo || "${siteUrl}/portal-afiliados";
          } catch (error) {
            setStatus(activateStatus, error.message || "No se pudo activar el acceso.", "error");
          }
        });
      }

      recoverRequestForm.addEventListener("submit", async function (event) {
        event.preventDefault();
        setStatus(recoverRequestStatus, "Enviando email de recuperación...", "");
        try {
          const response = await fetch("${siteUrl}/api/affiliate/auth/request-reset", {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              email: document.getElementById("recoverEmail").value.trim()
            })
          });
          const payload = await response.json();
          if (!response.ok || !payload.ok) {
            throw new Error(payload.error || "No se pudo solicitar la recuperación.");
          }
          setStatus(recoverRequestStatus, payload.message || "Revisa tu email para continuar.", "success");
          setNotice("Te hemos enviado un email de recuperación si tu cuenta está aprobada. Usa siempre el enlace más reciente.", "success");
        } catch (error) {
          setStatus(recoverRequestStatus, error.message || "No se pudo solicitar la recuperación.", "error");
        }
      });

      recoverCompleteForm.addEventListener("submit", async function (event) {
        event.preventDefault();
        setStatus(recoverCompleteStatus, "Guardando tu nueva contraseña...", "");
        try {
          const response = await fetch("${siteUrl}/api/affiliate/auth/complete-reset", {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              accessToken: recoveryToken,
              password: document.getElementById("recoverPassword").value,
              confirmPassword: document.getElementById("recoverPasswordConfirm").value
            })
          });
          const payload = await response.json();
          if (!response.ok || !payload.ok) {
            throw new Error(payload.error || "No se pudo actualizar la contraseña.");
          }
          setStatus(recoverCompleteStatus, "Contraseña actualizada. Entrando al portal...", "success");
          window.location.hash = "";
          window.location.href = payload.redirectTo || "${siteUrl}/portal-afiliados";
        } catch (error) {
          setStatus(recoverCompleteStatus, error.message || "No se pudo actualizar la contraseña.", "error");
        }
      });

      if (recoveryError) {
        setNotice(recoveryError, "error");
        showForm("recover-request");
      } else if (recoverRequested && recoveryToken && recoveryType === "recovery") {
        setNotice("Ya puedes definir una nueva contraseña para tu portal.", "success");
        showForm("recover-complete");
      } else if (mode === "activate") {
        showForm("activate");
      } else if (mode === "recover") {
        showForm("recover-request");
      } else {
        showForm("login");
      }
    }());
  </script>
</body>
</html>`;
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.statusCode = 405;
    return res.end("Method not allowed");
  }

  const siteUrl = getSiteUrl(req);
  const pageKey = getQueryParam(req, "page");
  const recoverFlow = getQueryParam(req, "recover") === "1";
  const page = getProtectedPage(pageKey);

  if (!page || !supabase.isConfigured()) {
    return sendHtml(res, 403, renderDeniedPage(siteUrl));
  }

  try {
    const access = await resolveAffiliateRequestAccess(req, res);

    if (pageKey === "portal") {
      if (!recoverFlow && access.mode === "auth" && access.affiliate) {
        const filePath = getAbsoluteProjectFile(page.file);
        const html = await fs.readFile(filePath, "utf8");
        const transformed = transformProtectedHtml(html, siteUrl, "");
        return sendHtml(res, 200, transformed);
      }

      if (access.mode === "token" && access.affiliate && !access.affiliate.auth_password_set_at) {
        return sendHtml(res, 200, renderAccessPage(siteUrl, {
          mode: "activate",
          token: access.legacyToken,
          prefillEmail: access.affiliate.email,
          showActivateTab: true
        }));
      }

      return sendHtml(res, 200, renderAccessPage(siteUrl, {
        mode: recoverFlow ? "recover" : "login",
        prefillEmail: access.affiliate ? access.affiliate.email : "",
        recover: recoverFlow,
        message: access.mode === "token" && access.affiliate && access.affiliate.auth_password_set_at
          ? "Tu acceso ya está activado. Entra ahora con tu email y tu contraseña."
          : ""
      }));
    }

    if (!(access.affiliate && (access.mode === "auth" || access.mode === "token"))) {
      return sendHtml(res, 403, renderDeniedPage(siteUrl));
    }

    const filePath = getAbsoluteProjectFile(page.file);
    const html = await fs.readFile(filePath, "utf8");
    const transformed = transformProtectedHtml(html, siteUrl, access.mode === "token" ? access.legacyToken : "");
    return sendHtml(res, 200, transformed);
  } catch (_error) {
    return sendHtml(res, 500, renderDeniedPage(siteUrl));
  }
};
