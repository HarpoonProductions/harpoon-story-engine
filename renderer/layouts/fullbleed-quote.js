'use strict';

const { escHtml } = require('../shell/head');

/**
 * Renders a section using the fullbleed-quote layout.
 * Full-viewport background image with a pull quote overlaid.
 * Uses section.hero_image and section.pull_quote — no new fields needed.
 *
 * @param {object} section  - HSE section definition
 * @returns {string} HTML string
 */
function renderFullbleedQuote(section) {
  const { hero_image, pull_quote } = section;

  const bgStyle = hero_image
    ? `style="background-image: url('${escHtml(hero_image.url)}')"
       role="img" aria-label="${escHtml(hero_image.alt || '')}"`
    : '';

  const quoteText = pull_quote
    ? `<blockquote class="hse-fbq__quote">
        <div class="hse-fbq__rule"></div>
        <p class="hse-fbq__text">${escHtml(pull_quote.text)}</p>
        ${pull_quote.attribution
          ? `<cite class="hse-fbq__attribution">${escHtml(pull_quote.attribution)}</cite>`
          : ''}
      </blockquote>`
    : '';

  return `<section class="hse-section hse-section--fullbleed-quote" id="${escHtml(section.id)}" data-layout="fullbleed-quote">
  <div class="hse-fbq__bg" ${bgStyle}></div>
  <div class="hse-fbq__grain"></div>
  <div class="hse-fbq__gradient"></div>
  <div class="hse-fbq__content hse-inner">
    ${quoteText}
  </div>
</section>`;
}

module.exports = { renderFullbleedQuote };
