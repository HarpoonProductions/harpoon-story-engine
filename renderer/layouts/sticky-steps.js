'use strict';

const { escHtml } = require('../shell/head');
const { renderImage } = require('../blocks/image');

/**
 * Renders a section using the sticky-steps layout.
 * The visual (image) stays fixed in the viewport while step text scrolls.
 * Each step updates the pinned visual as it enters the viewport.
 *
 * @param {object} section  - HSE section definition
 * @returns {string} HTML string
 */
function renderStickySteps(section) {
  const steps = section.sticky_steps || [];

  const num = section.num
    ? `<span class="hse-eyebrow" style="color:var(--hse-accent)">${String(section.num).padStart(2, '0')}</span>`
    : '';

  const intro = section.intro
    ? section.intro.split(/\n\n+/).map(p => `<p class="hse-section-intro">${escHtml(p.trim())}</p>`).join("\n    ")
    : '';

  // Visual panel — starts with the first step's image
  const firstImage = steps.length > 0 && steps[0].image ? steps[0].image : null;
  const visualPanel = `<div class="hse-ss__visual" aria-hidden="true">
    <div class="hse-ss__visual-inner">
      ${firstImage
        ? `<img
            class="hse-ss__visual-img is-active"
            src="${escHtml(firstImage.url)}"
            alt="${escHtml(firstImage.alt || '')}"
            data-step="0">`
        : ''}
      ${steps.slice(1).map((step, i) =>
        step.image
          ? `<img
              class="hse-ss__visual-img"
              src="${escHtml(step.image.url)}"
              alt="${escHtml(step.image.alt || '')}"
              data-step="${i + 1}">`
          : ''
      ).join('\n')}
    </div>
    <div class="hse-ss__progress">
      ${steps.map((_, i) =>
        `<div class="hse-ss__progress-pip${i === 0 ? ' is-active' : ''}" data-step="${i}"></div>`
      ).join('\n')}
    </div>
  </div>`;

  // Text panel — one step per scroll trigger
  const stepItems = steps.map((step, i) => `<div
    class="hse-ss__step${i === 0 ? ' is-active' : ''}"
    data-step="${i}"
    id="${escHtml(section.id)}-step-${i}">
    ${step.icon
      ? `<div class="hse-ss__step-icon" aria-hidden="true">◆</div>`
      : ''}
    <h3 class="hse-ss__step-title">${escHtml(step.title || '')}</h3>
    <p class="hse-ss__step-body">${escHtml(step.body || '')}</p>
  </div>`).join('\n');

  return `<section
  class="hse-section hse-section--sticky-steps"
  id="${escHtml(section.id)}"
  data-layout="sticky-steps"
  data-step-count="${steps.length}">

  <!-- Section header -->
  <div class="hse-ss__header hse-inner">
    ${num}
    <h2 class="hse-heading">${escHtml(section.title || '')}</h2>
    ${intro}
  </div>

  <!-- Two-column sticky layout -->
  <div class="hse-ss__body">

    <!-- Left: sticky visual -->
    <div class="hse-ss__visual-col">
      ${visualPanel}
    </div>

    <!-- Right: scrolling steps -->
    <div class="hse-ss__text-col">
      ${stepItems}
    </div>

  </div>

</section>`;
}

module.exports = { renderStickySteps };
