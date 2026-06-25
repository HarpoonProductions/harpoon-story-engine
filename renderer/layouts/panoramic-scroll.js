'use strict';

const { escHtml } = require('../shell/head');

/**
 * Renders a section using the panoramic-scroll layout.
 *
 * Two modes:
 *   Single-image: section.panoramic_image is a single wide image — GSAP animates
 *     backgroundPositionX across it for a perfectly seamless pan. Panels supply
 *     text overlays only.
 *   Multi-image: section.panoramic_panels each carry their own image. Images are
 *     translated horizontally as a track. Focal points control the crop within
 *     each panel.
 *
 * @param {object} section  - HSE section definition
 * @returns {string} HTML string
 */
function renderPanoramicScroll(section) {
  const panels     = section.panoramic_panels || [];
  const singleImg  = section.panoramic_image;
  const isSingle   = !!(singleImg && singleImg.url);

  const num = section.num
    ? `<span class="hse-eyebrow" style="color:var(--hse-accent)">${String(section.num).padStart(2, '0')}</span>`
    : '';

  const titleHtml = section.title ? `<div class="hse-pan__header">
      ${num}
      <h2 class="hse-pan__title">${escHtml(section.title)}</h2>
    </div>` : '';

  // Text overlays — position driven by text_position: { x, y } percentages
  const textsHtml = panels.map((panel, i) => {
    const tx = panel.text_position ? panel.text_position.x : null;
    const ty = panel.text_position ? panel.text_position.y : null;
    const posStyle = (tx !== null && ty !== null)
      ? `style="--tx:${tx}%;--ty:${ty}%"`
      : '';
    return `<div class="hse-pan__text-item${i === 0 ? ' is-active' : ''}" data-index="${i}" ${posStyle}>
      ${panel.text        ? `<p class="hse-pan__text">${escHtml(panel.text)}</p>` : ''}
      ${panel.attribution ? `<span class="hse-pan__attribution hse-label">${escHtml(panel.attribution)}</span>` : ''}
    </div>`;
  }).join('\n');

  const dotsHtml = panels.map((_, i) =>
    `<div class="hse-pan__dot${i === 0 ? ' is-active' : ''}" data-index="${i}"></div>`
  ).join('\n');

  if (isSingle) {
    // ── Single-image mode ──────────────────────────────────────────
    const focalStyle = singleImg.focal ? `background-position:${escHtml(singleImg.focal)}` : 'background-position:left center';
    return `<section
  class="hse-section hse-section--panoramic-scroll"
  id="${escHtml(section.id)}"
  data-layout="panoramic-scroll"
  data-pan-mode="single"
  style="--pan-count:${Math.max(panels.length, 1)}">

  <div class="hse-pan__sticky hse-pan__sticky--single"
       style="background-image:url('${escHtml(singleImg.url)}');${focalStyle}"
       role="img"
       aria-label="${escHtml(singleImg.alt || '')}">

    <div class="hse-pan__gradient" aria-hidden="true"></div>

    ${titleHtml}

    <div class="hse-pan__texts" aria-live="polite">
      ${textsHtml}
    </div>

    <div class="hse-pan__progress" aria-hidden="true">
      ${dotsHtml}
    </div>

  </div>

</section>`;
  }

  // ── Multi-image mode ─────────────────────────────────────────────
  const isFramed = !!section.framed;

  const panelsHtml = panels.map((panel, i) => {
    const img = panel.image || {};
    const focalStyle = img.focal ? `background-position:${escHtml(img.focal)}` : '';

    if (isFramed) {
      return `<div class="hse-pan__panel" data-index="${i}">
        <div class="hse-pan__frame">
          <div class="hse-pan__img"
               style="background-image:url('${escHtml(img.url || '')}');${focalStyle}"
               role="img"
               aria-label="${escHtml(img.alt || '')}">
          </div>
          <div class="hse-pan__caption">
            ${panel.text        ? `<p class="hse-pan__text">${escHtml(panel.text)}</p>` : ''}
            ${panel.attribution ? `<span class="hse-pan__attribution hse-label">${escHtml(panel.attribution)}</span>` : ''}
          </div>
        </div>
      </div>`;
    }

    return `<div class="hse-pan__panel" data-index="${i}">
      <div class="hse-pan__img"
           style="background-image:url('${escHtml(img.url || '')}');${focalStyle}"
           role="img"
           aria-label="${escHtml(img.alt || '')}">
      </div>
    </div>`;
  }).join('\n');

  return `<section
  class="hse-section hse-section--panoramic-scroll"
  id="${escHtml(section.id)}"
  data-layout="panoramic-scroll"
  data-pan-mode="multi"${isFramed ? '\n  data-pan-framed="true"' : ''}
  style="--pan-count:${panels.length}">

  <div class="hse-pan__sticky">

    <div class="hse-pan__track">
      ${panelsHtml}
    </div>

    ${isFramed ? '' : `<div class="hse-pan__gradient" aria-hidden="true"></div>

    ${titleHtml}

    <div class="hse-pan__texts" aria-live="polite">
      ${textsHtml}
    </div>`}

    <div class="hse-pan__progress" aria-hidden="true">
      ${dotsHtml}
    </div>

  </div>

</section>`;
}

module.exports = { renderPanoramicScroll };
