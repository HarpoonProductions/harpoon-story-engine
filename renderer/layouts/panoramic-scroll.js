'use strict';

const { escHtml } = require('../shell/head');

/**
 * Renders a section using the panoramic-scroll layout.
 * A full-viewport image track pans horizontally as the user scrolls,
 * creating the illusion of a single wide scene. Each panel can carry
 * optional overlay text and attribution.
 *
 * @param {object} section  - HSE section definition
 * @returns {string} HTML string
 */
function renderPanoramicScroll(section) {
  const panels = section.panoramic_panels || [];

  const num = section.num
    ? `<span class="hse-eyebrow" style="color:var(--hse-accent)">${String(section.num).padStart(2, '0')}</span>`
    : '';

  const panelsHtml = panels.map((panel, i) => {
    const img = panel.image || {};
    const focalStyle = img.focal ? `background-position:${escHtml(img.focal)}` : '';
    return `<div class="hse-pan__panel" data-index="${i}">
      <div class="hse-pan__img"
           style="background-image:url('${escHtml(img.url || '')}');${focalStyle}"
           role="img"
           aria-label="${escHtml(img.alt || '')}">
      </div>
    </div>`;
  }).join('\n');

  const textsHtml = panels.map((panel, i) => `<div class="hse-pan__text-item${i === 0 ? ' is-active' : ''}" data-index="${i}">
      ${panel.text        ? `<p class="hse-pan__text">${escHtml(panel.text)}</p>` : ''}
      ${panel.attribution ? `<span class="hse-pan__attribution hse-label">${escHtml(panel.attribution)}</span>` : ''}
    </div>`).join('\n');

  const dotsHtml = panels.map((_, i) =>
    `<div class="hse-pan__dot${i === 0 ? ' is-active' : ''}" data-index="${i}"></div>`
  ).join('\n');

  const titleHtml = section.title ? `<div class="hse-pan__header">
      ${num}
      <h2 class="hse-pan__title">${escHtml(section.title)}</h2>
    </div>` : '';

  return `<section
  class="hse-section hse-section--panoramic-scroll"
  id="${escHtml(section.id)}"
  data-layout="panoramic-scroll"
  style="--pan-count:${panels.length}">

  <div class="hse-pan__sticky">

    <div class="hse-pan__track">
      ${panelsHtml}
    </div>

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

module.exports = { renderPanoramicScroll };
