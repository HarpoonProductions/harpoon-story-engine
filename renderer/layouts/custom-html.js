"use strict";

const { escHtml } = require("../shell/head");

/**
 * Renders a custom HTML embed section.
 * Supports Shadow DOM encapsulation and scroll lock.
 *
 * @param {object} section - HSE section definition
 * @returns {string} HTML string
 */
function renderCustomHtml(section) {
  const embed = section.custom_html || {};
  const html = embed.html || "";
  const shadowDom = !!embed.shadow_dom;
  const scrollLock = embed.scroll_lock !== false; // default true
  const caption = embed.caption || "";
  const fullWidth = !!embed.full_width;

  const widthClass = fullWidth ? " hse-embed--full" : "";
  const lockClass = scrollLock ? " hse-embed--scroll-locked" : "";
  const shadowAttr = shadowDom ? ' data-shadow-dom="true"' : "";

  const captionHtml = caption
    ? `<p class="hse-embed__caption">${escHtml(caption)}</p>`
    : "";

  const scrollOverlay = scrollLock
    ? `
    <div class="hse-embed__scroll-overlay" aria-hidden="true">
      <span class="hse-embed__scroll-hint">Click to interact</span>
    </div>`
    : "";

  return `<section class="hse-section hse-section--custom-html" id="${escHtml(section.id)}" data-layout="custom-html">
  <div class="hse-inner${fullWidth ? " hse-inner--full" : ""}">
    <div class="hse-embed${widthClass}${lockClass}"${shadowAttr}>
      ${scrollOverlay}
      <div class="hse-embed__content">
        ${shadowDom ? "" : html}
      </div>
      ${captionHtml}
    </div>
  </div>
  ${
    shadowDom
      ? `<script>
    (function() {
      var wrap = document.currentScript.previousElementSibling.querySelector('.hse-embed');
      var content = wrap.querySelector('.hse-embed__content');
      var shadow = content.attachShadow({ mode: 'open' });
      shadow.innerHTML = ${JSON.stringify(html)};
    })();
  </script>`
      : ""
  }
</section>`;
}

module.exports = { renderCustomHtml };
