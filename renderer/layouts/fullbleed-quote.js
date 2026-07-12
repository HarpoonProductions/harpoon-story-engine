'use strict';

const { escHtml } = require('../shell/head');

function renderFullbleedQuote(section) {
  const { hero_image, pull_quote } = section;

  const overlay  = section.fbq_overlay    || 'solid';
  const posV     = section.fbq_position_v || 'middle';
  const posH     = section.fbq_position_h || 'left';
  const bgScroll = section.fbq_bg_scroll  || 'parallax';

  const bgStyle = hero_image
    ? `style="background-image: url('${escHtml(hero_image.url)}')" role="img" aria-label="${escHtml(hero_image.alt || '')}"`
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

  const noOverlay = overlay === 'none';

  return `<section
  class="hse-section hse-section--fullbleed-quote"
  id="${escHtml(section.id)}"
  data-layout="fullbleed-quote"
  data-overlay="${escHtml(overlay)}"
  data-pos-v="${escHtml(posV)}"
  data-pos-h="${escHtml(posH)}"
  data-bg-scroll="${escHtml(bgScroll)}">
  <div class="hse-fbq__bg" ${bgStyle}></div>
  ${noOverlay ? '' : '<div class="hse-fbq__grain"></div>'}
  ${noOverlay ? '' : '<div class="hse-fbq__gradient"></div>'}
  <div class="hse-fbq__content hse-inner">
    ${quoteText}
  </div>
</section>`;
}

module.exports = { renderFullbleedQuote };
