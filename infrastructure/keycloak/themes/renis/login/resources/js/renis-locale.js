/* RENIS-BI Keycloak theme — converts the native <select id="login-select-toggle">
 * locale switcher into a segmented EN/FR anchor-button control fixed in the
 * top-right corner of the page (outside the login card), visually identical
 * to <LanguageSwitcher variant="inline" /> in the management app.
 *
 * If JS is disabled the native <select> remains visible inside the card
 * header as a (minimally-styled) fallback.
 */
(function () {
  "use strict";

  function init() {
    var select = document.getElementById("login-select-toggle");
    if (!select || select.tagName !== "SELECT") return;
    if (select.dataset.renisLocaleInit === "1") return;
    select.dataset.renisLocaleInit = "1";

    // Container for our floating segmented control (fixed top-right via CSS).
    var floater = document.createElement("div");
    floater.className = "renis-locale-floater";

    var group = document.createElement("div");
    group.className = "renis-locale-seg";
    group.setAttribute("role", "group");
    group.setAttribute(
      "aria-label",
      select.getAttribute("aria-label") || "languages"
    );

    Array.prototype.forEach.call(select.options, function (opt) {
      var href = (opt.value || "").trim();
      if (!href) return;
      var item = document.createElement("a");
      item.className = "renis-locale-seg__item";
      item.href = href;
      item.textContent = (opt.textContent || "").trim();
      if (opt.selected) {
        item.classList.add("is-active");
        item.setAttribute("aria-current", "true");
      }
      group.appendChild(item);
    });

    floater.appendChild(group);
    document.body.appendChild(floater);

    // Remove the original select + its PatternFly wrapper from the card.
    var wrapper =
      select.closest(".pf-v5-c-form-control") || select.parentElement;
    if (wrapper && wrapper.parentNode) {
      // Also drop the now-empty header utilities slot so the title centres.
      var utilities = wrapper.closest(
        ".pf-v5-c-login__main-header-utilities"
      );
      if (utilities && utilities.parentNode) {
        utilities.parentNode.removeChild(utilities);
      } else {
        wrapper.parentNode.removeChild(wrapper);
      }
    } else {
      select.parentNode && select.parentNode.removeChild(select);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
