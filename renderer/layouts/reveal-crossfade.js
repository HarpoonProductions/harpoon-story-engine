'use strict';

const { escHtml } = require('../shell/head');

/**
 * Renders a section using the reveal-crossfade layout.
 * Two images crossfade on scroll, driven by two text phases.
 * crossfade_images[0] fades out as crossfade_images[1] fades in.
 * crossfade_phases[0] and [1] provide the corresponding text.
 *
 * @param {object} section  - HSE section definition
 * @returns {string} HTML string
 */
function renderRevealCrossfade(section) {
  const images = section.crossfade_images || [];
  const phases = section.crossfade_phases || [];

  const img0 = images[0] || {};
  const img1 = images[1] || {};
  const ph0  = phases[0] || {};
  const ph1  = phases[1] || {};

  const renderPhase = (phase, index) => {
    if (!phase.text) return '';
    return `<div class="hse-cf__phase" data-phase="${index}">
      <div class="hse-cf__phase-rule"></div>
      <p class="hse-cf__phase-text">${escHtml(phase.text)}</p>
      ${phase.attribution
        ? `<cite class="hse-cf__phase-attribution">${escHtml(phase.attribution)}</cite>`
        : ''}
    </div>`;
  };

  return `<section
  class="hse-section hse-section--reveal-crossfade"
  id="${escHtml(section.id)}"
  data-layout="reveal-crossfade">

  <!-- Sticky image canvas -->
  <div class="hse-cf__sticky-wrap">
    <div class="hse-cf__canvas">

      <!-- Image A (initial) -->
      <div
        class="hse-cf__image hse-cf__image--a"
        style="background-image: url('${escHtml(img0.url || '')}')"
        role="img"
        aria-label="${escHtml(img0.alt || '')}">
      </div>

      <!-- Image B (revealed) -->
      <div
        class="hse-cf__image hse-cf__image--b"
        style="background-image: url('${escHtml(img1.url || '')}')"
        role="img"
        aria-label="${escHtml(img1.alt || '')}">
      </div>

      <!-- Overlay gradient -->
      <div class="hse-cf__gradient"></div>

    </div>
  </div>

  <!-- Scrolling text phases -->
  <div class="hse-cf__phases">
    ${renderPhase(ph0, 0)}
    ${renderPhase(ph1, 1)}
  </div>

</section>`;
}

module.exports = { renderRevealCrossfade };
