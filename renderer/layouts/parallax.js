'use strict';

const { escHtml } = require('../shell/head');
const { renderPullQuote }    = require('../blocks/pull-quote');
const { renderStatBlock }    = require('../blocks/stat-block');
const { renderPhotoCluster } = require('../blocks/photo-cluster');

/**
 * Renders a section using the parallax layout.
 * Hero image scrolls at a reduced rate relative to content,
 * creating a depth effect. Content sits below in a standard
 * editorial column. Suited to scene-setting or chapter-break sections.
 *
 * @param {object} section  - HSE section definition
 * @returns {string} HTML string
 */
function renderParallax(section) {
  const num = section.num
    ? `<span class="hse-eyebrow" style="color:var(--hse-accent)">${String(section.num).padStart(2, '0')}</span>`
    : '';

  const heroImg = section.hero_image
    ? `<div
        class="hse-parallax__img"
        data-parallax-speed="0.4"
        style="background-image: url('${escHtml(section.hero_image.url)}')"
        role="img"
        aria-label="${escHtml(section.hero_image.alt || '')}">
      </div>`
    : '';

  const caption = section.hero_image && section.hero_image.caption
    ? `<p class="hse-parallax__caption hse-label">${escHtml(section.hero_image.caption)}</p>`
    : '';

  const intro = section.intro
    ? `<p class="hse-section-intro hse-reveal">${escHtml(section.intro)}</p>`
    : '';

  const pullQuote    = renderPullQuote(section.pull_quote);
  const statBlock    = renderStatBlock(section.stat_block);
  const photoClusters = section.photo_clusters && section.photo_clusters.length > 0
    ? section.photo_clusters.map(c => renderPhotoCluster(c)).join('\n')
    : '';

  const onwardLinks = section.onward_links && section.onward_links.length > 0
    ? `<nav class="hse-onward-links">
        ${section.onward_links.map(l =>
          `<a href="${escHtml(l.href)}" class="hse-onward-link">${escHtml(l.label)}</a>`
        ).join('\n')}
      </nav>`
    : '';

  return `<section
  class="hse-section hse-section--parallax"
  id="${escHtml(section.id)}"
  data-layout="parallax">

  <!-- Parallax hero window -->
  <div class="hse-parallax__window">
    ${heroImg}
    <div class="hse-parallax__gradient"></div>
    ${caption}
  </div>

  <!-- Content below the image -->
  <div class="hse-inner hse-parallax__content">
    <header class="hse-section-header">
      ${num}
      <h2 class="hse-heading hse-reveal">${escHtml(section.title || '')}</h2>
    </header>
    ${intro}
    ${pullQuote}
    ${statBlock}
    ${photoClusters}
    ${onwardLinks}
  </div>

</section>`;
}

module.exports = { renderParallax };
