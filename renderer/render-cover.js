'use strict';

const { escHtml } = require('./shell/head');

/**
 * Renders the cover section.
 * Supports hero_video (preferred) or hero_image as background.
 *
 * @param {object} cover - content.cover
 * @returns {string} HTML string
 */
function renderCover(cover) {
  const bg = cover.hero_video
    ? renderVideoBg(cover.hero_video)
    : cover.hero_image
      ? renderImageBg(cover.hero_image)
      : '';

  const kicker = cover.kicker
    ? `<p class="hse-cover__kicker hse-reveal">${escHtml(cover.kicker)}</p>`
    : '';

  const headline = renderHeadline(cover);

  const body = cover.body
    ? `<p class="hse-cover__body hse-reveal hse-reveal-delay-2">${escHtml(cover.body)}</p>`
    : '';

  const ctas = renderCtas(cover);

  const colophon = cover.colophon
    ? `<p class="hse-cover__colophon hse-reveal">${escHtml(cover.colophon)}</p>`
    : '';

  return `
<section id="hse-cover">
  ${bg}
  <div class="hse-cover__grain"></div>
  <div class="hse-cover__gradient"></div>
  <div class="hse-cover__content">
    ${kicker}
    ${headline}
    ${body}
    ${ctas}
    ${colophon}
  </div>
  <div class="hse-cover__scroll-cue">
    <span>Scroll</span>
    <div class="hse-cover__scroll-line"></div>
  </div>
</section>`.trim();
}

// ── Private helpers ───────────────────────────────────────────────

function renderVideoBg(video) {
  const poster = video.poster ? ` poster="${escHtml(video.poster)}"` : '';
  const autoplay = video.autoplay !== false ? ' autoplay' : '';
  const loop     = video.loop     !== false ? ' loop' : '';
  const muted    = video.muted    !== false ? ' muted' : '';
  return `<video class="hse-cover__bg-video"${autoplay}${muted}${loop} playsinline${poster}>
    <source src="${escHtml(video.url)}" type="video/mp4">
  </video>`;
}

function renderImageBg(image) {
  if (!image.url) return '';
  const focalStyle = image.focal
    ? ` style="object-position: ${escHtml(image.focal)}"`
    : '';
  return `<img class="hse-cover__bg-img"
    src="${escHtml(image.url)}"
    alt="${escHtml(image.alt || '')}"
    fetchpriority="high"
    decoding="async"
    aria-hidden="true"${focalStyle}>`;
}

function renderHeadline(cover) {
  if (!cover.headline) return '';

  // If headline_em is provided, split headline into plain + emphasised
  if (cover.headline_em) {
    return `<h1 class="hse-cover__headline hse-reveal hse-reveal-delay-1">
      ${escHtml(cover.headline)}<br><em>${escHtml(cover.headline_em)}</em>
    </h1>`;
  }

  return `<h1 class="hse-cover__headline hse-reveal hse-reveal-delay-1">
    ${escHtml(cover.headline)}
  </h1>`;
}

function renderCtas(cover) {
  const primary   = cover.cta_primary;
  const secondary = cover.cta_secondary;

  if (!primary && !secondary) return '';

  const primaryBtn = primary
    ? `<a href="${escHtml(primary.href)}" class="hse-btn hse-btn--primary">${escHtml(primary.label)}</a>`
    : '';

  const secondaryBtn = secondary
    ? `<a href="${escHtml(secondary.href)}" class="hse-btn hse-btn--secondary">${escHtml(secondary.label)}</a>`
    : '';

  return `<div class="hse-cover__ctas hse-reveal hse-reveal-delay-3">
    ${primaryBtn}
    ${secondaryBtn}
  </div>`;
}

module.exports = { renderCover };
