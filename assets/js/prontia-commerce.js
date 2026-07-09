(function (window, document) {
  const REF_COOKIE = "prontia_aff_ref";
  const REF_TTL_DAYS = 30;

  function setCookie(name, value, days) {
    const expires = new Date(Date.now() + days * 864e5).toUTCString();
    document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
  }

  function getCookie(name) {
    const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
    return match ? decodeURIComponent(match[1]) : "";
  }

  function sanitizeRef(ref) {
    return (ref || "").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
  }

  async function validateAffiliateCode(code) {
    const response = await window.fetch("/api/affiliate/code", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ code })
    });

    const data = await response.json();
    if (!response.ok || !data.valid || !data.trackingCode) {
      throw new Error(data.error || "No hemos podido validar ese código.");
    }

    return data;
  }

  function currentUtmData() {
    const url = new URL(window.location.href);
    return {
      utmSource: url.searchParams.get("utm_source") || "",
      utmMedium: url.searchParams.get("utm_medium") || "",
      utmCampaign: url.searchParams.get("utm_campaign") || ""
    };
  }

  function persistAffiliateRef() {
    const url = new URL(window.location.href);
    const ref = sanitizeRef(url.searchParams.get("ref"));
    if (!ref) return getCookie(REF_COOKIE) || "";

    setCookie(REF_COOKIE, ref, REF_TTL_DAYS);

    if (window.fetch) {
      window.fetch("/api/affiliate/apply-ref", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          ref,
          landingPath: window.location.pathname,
          referrer: document.referrer || "",
          ...currentUtmData()
        })
      }).catch(function () {
        return null;
      });
    }

    return ref;
  }

  function setStatus(target, text, type) {
    if (!target) return;
    target.textContent = text || "";
    target.className = `inline-status${type ? ` ${type}` : ""}`;
  }

  async function startCheckout(options) {
    const button = options.button;
    const statusNode = options.statusNode || null;
    const productSlug = options.productSlug;
    const refInput = options.refInput || null;
    const originalLabel = button ? button.textContent : "";

    try {
      if (button) {
        button.disabled = true;
        button.textContent = "Conectando con el pago seguro...";
      }
      setStatus(statusNode, "Preparando tu checkout seguro...", "");

      let refCode = getCookie(REF_COOKIE) || "";
      if (refInput && refInput.value.trim()) {
        setStatus(statusNode, "Validando el código del afiliado...", "");
        const validation = await validateAffiliateCode(refInput.value.trim());
        refCode = validation.trackingCode;
        setCookie(REF_COOKIE, refCode, REF_TTL_DAYS);
        refInput.value = validation.couponCode || validation.trackingCode;
      }

      const response = await window.fetch("/api/checkout/create-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          productSlug,
          refCode,
          landingPath: window.location.pathname,
          ...currentUtmData()
        })
      });

      const data = await response.json();
      if (!response.ok || !data.url) {
        throw new Error(data.error || "No se pudo iniciar el checkout.");
      }

      setStatus(statusNode, "Redirigiendo a Stripe...", "success");
      window.location.href = data.url;
    } catch (error) {
      setStatus(statusNode, error.message || "No se pudo abrir el pago.", "error");
      if (button) {
        button.disabled = false;
        button.textContent = originalLabel;
      }
    }
  }

  function bindCheckoutButtons() {
    const buttons = document.querySelectorAll("[data-checkout-product]");
    buttons.forEach(function (button) {
      const statusSelector = button.getAttribute("data-status-target");
      const statusNode = statusSelector ? document.querySelector(statusSelector) : null;
      const refInputSelector = button.getAttribute("data-affiliate-input-target");
      const refInput = refInputSelector ? document.querySelector(refInputSelector) : null;
      button.addEventListener("click", function () {
        startCheckout({
          productSlug: button.getAttribute("data-checkout-product"),
          button,
          statusNode,
          refInput
        });
      });
    });
  }

  function bindAffiliateCodeForms() {
    const forms = document.querySelectorAll("[data-affiliate-code-form]");
    forms.forEach(function (form) {
      const input = form.querySelector("[data-affiliate-code-input]");
      const statusSelector = form.getAttribute("data-status-target");
      const statusNode = statusSelector ? document.querySelector(statusSelector) : null;
      const clearButton = form.querySelector("[data-affiliate-code-clear]");

      if (!input) return;

      const currentCode = getCookie(REF_COOKIE) || "";
      if (currentCode) {
        input.value = currentCode;
        setStatus(statusNode, "Código de afiliado listo para aplicar en la compra.", "success");
      }

      form.addEventListener("submit", async function (event) {
        event.preventDefault();
        try {
          setStatus(statusNode, "Validando tu código...", "");
          const validation = await validateAffiliateCode(input.value.trim());
          setCookie(REF_COOKIE, validation.trackingCode, REF_TTL_DAYS);
          input.value = validation.couponCode || validation.trackingCode;
          setStatus(
            statusNode,
            `Código aplicado. La compra quedará vinculada a ${validation.affiliateName || "tu afiliado"}.`,
            "success"
          );
        } catch (error) {
          setStatus(statusNode, error.message || "No se pudo validar el código.", "error");
        }
      });

      if (clearButton) {
        clearButton.addEventListener("click", function () {
          setCookie(REF_COOKIE, "", -1);
          input.value = "";
          setStatus(statusNode, "Código borrado. La compra seguirá sin afiliado asociado.", "");
        });
      }
    });
  }

  function init() {
    persistAffiliateRef();
    bindCheckoutButtons();
    bindAffiliateCodeForms();
  }

  window.ProntiaCommerce = {
    init,
    startCheckout,
    getAffiliateCode: function () {
      return getCookie(REF_COOKIE) || "";
    },
    clearAffiliateCode: function () {
      setCookie(REF_COOKIE, "", -1);
    }
  };

  document.addEventListener("DOMContentLoaded", init);
})(window, document);
