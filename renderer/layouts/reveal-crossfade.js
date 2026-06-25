"use strict";

const { escHtml } = require("../shell/head");

/**
 * Renders a section using the reveal-crossfade layout.
 * Supports N images — each scroll phase transitions to its corresponding image.
 * crossfade_images[i] is shown when crossfade_phases[i] scrolls into view.
 *
 * @param {object} section  - HSE section definition
 * @returns {string} HTML string
 */
function renderRevealCrossfade(section) {
  const images = section.crossfade_images || [];
  const phases = section.crossfade_phases || [];

  // Render all images as layers — first is visible, rest are hidden
  const imagesHtml = images
    .map(
      (img, i) => `
      <div
        class="hse-cf__image hse-cf__image--${i}${i === 0 ? " is-active" : ""}"
        style="background-image: url('${escHtml(img.url || "")}');${img.focal ? `background-position:${escHtml(img.focal)}` : ''}"
        role="img"
        aria-label="${escHtml(img.alt || "")}"
        data-index="${i}">
      </div>`,
    )
    .join("");

  // Render all phases — each linked to its image index
  const phasesHtml = phases
    .map((phase, i) => {
      if (!phase.text) return "";
      return `<div class="hse-cf__phase" data-phase="${i}" data-image="${i}">
      <div class="hse-cf__phase-rule"></div>
      <p class="hse-cf__phase-text">${escHtml(phase.text)}</p>
      ${
        phase.attribution
          ? `<cite class="hse-cf__phase-attribution">${escHtml(phase.attribution)}</cite>`
          : ""
      }
    </div>`;
    })
    .join("");

  return `<section
  class="hse-section hse-section--reveal-crossfade"
  id="${escHtml(section.id)}"
  data-layout="reveal-crossfade"
  data-image-count="${images.length}">

  <!-- Sticky image canvas -->
  <div class="hse-cf__sticky-wrap">
    <div class="hse-cf__canvas">

      ${imagesHtml}

      <!-- Overlay gradient -->
      <div class="hse-cf__gradient"></div>

    </div>
  </div>

  <!-- Scrolling text phases -->
  <div class="hse-cf__phases">
    ${phasesHtml}
  </div>

</section>`;
}

module.exports = { renderRevealCrossfade };
