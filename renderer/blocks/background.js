'use strict';

/**
 * Renders a section background image overlay.
 * Returns { wrapperAttrs, bgHtml } to be applied to the section element.
 *
 * @param {object} bg - section.background
 * @returns {{ wrapperAttrs: string, bgHtml: string }}
 */
function renderBackground(bg) {
  if (!bg || !bg.url) return { wrapperAttrs: '', bgHtml: '' };

  const focal     = bg.focal      || '50% 50%';
  const tint      = bg.tint       ?? 0.5;
  const tintColor = bg.tint_color || '#000000';
  const fixed     = bg.fixed      ? 'hse-bg--fixed' : '';

  // Convert hex+opacity to rgba
  const hex = tintColor.replace('#', '');
  const r   = parseInt(hex.slice(0,2), 16);
  const g   = parseInt(hex.slice(2,4), 16);
  const b   = parseInt(hex.slice(4,6), 16);
  const rgba = `rgba(${r},${g},${b},${tint})`;

  const bgHtml = `
  <div class="hse-section-bg ${fixed}" aria-hidden="true">
    <img class="hse-section-bg__img"
      src="${bg.url}"
      alt=""
      style="object-position: ${focal}"
      loading="lazy">
    <div class="hse-section-bg__tint" style="background:${rgba}"></div>
  </div>`;

  return {
    wrapperAttrs: ' hse-section--has-bg',
    bgHtml,
  };
}

module.exports = { renderBackground };
