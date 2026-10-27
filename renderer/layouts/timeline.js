'use strict';

const { escHtml } = require('../shell/head');

/**
 * Renders a section using the timeline layout.
 *
 * A sticky full-bleed image/video canvas sits behind scrolling text entries.
 * Each entry activates its corresponding media layer as it scrolls into view.
 *
 * Section fields:
 *   timeline_align   {string}  'left' | 'right' | 'alternate'  (default: 'left')
 *   timeline_entries {Array}   array of entry objects:
 *     entry.date     {string}  e.g. "1987" or "March 2020"
 *     entry.heading  {string}
 *     entry.body     {string}
 *     entry.image    {object}  { url, focal, alt }
 *     entry.video    {object}  { url, poster }   — takes priority over image if both set
 *
 * @param {object} section
 * @returns {string} HTML
 */
function renderTimeline(section) {
  const entries = section.timeline_entries || [];
  const align   = section.timeline_align   || 'left';

  // ── Canvas layers ────────────────────────────────────────────────
  const canvasHtml = entries.map((entry, i) => {
    const isFirst  = i === 0;
    const baseClass = `hse-tl__layer hse-tl__layer--${i}${isFirst ? ' is-active' : ''}`;

    if (entry.video && entry.video.url) {
      const poster = entry.video.poster ? ` poster="${escHtml(entry.video.poster)}"` : '';
      return `<div class="${baseClass}" data-index="${i}" data-type="video">
        <video class="hse-tl__video"${isFirst ? ' autoplay' : ''} muted loop playsinline${poster} data-tl-video>
          <source src="${escHtml(entry.video.url)}" type="video/mp4">
        </video>
      </div>`;
    }

    if (entry.image && entry.image.url) {
      const focal = entry.image.focal ? `background-position:${escHtml(entry.image.focal)};` : '';
      return `<div class="${baseClass}"
        style="background-image:url('${escHtml(entry.image.url)}');${focal}"
        role="img"
        aria-label="${escHtml(entry.image.alt || '')}"
        data-index="${i}"
        data-type="image"></div>`;
    }

    return `<div class="${baseClass}" data-index="${i}" data-type="empty"></div>`;
  }).join('\n');

  // ── Text entries ─────────────────────────────────────────────────
  const entriesHtml = entries.map((entry, i) => {
    // For alternate, even entries sit on the left, odd on the right
    const side = align === 'alternate' ? (i % 2 === 0 ? 'left' : 'right') : align;

    // Mobile thumbnail — hidden on desktop, visible on mobile
    let thumbHtml = '';
    if (entry.video && entry.video.url && entry.video.poster) {
      thumbHtml = `<div class="hse-tl__thumb" aria-hidden="true" style="background-image:url('${escHtml(entry.video.poster)}')"></div>`;
    } else if (entry.video && entry.video.url) {
      thumbHtml = `<div class="hse-tl__thumb hse-tl__thumb--video" aria-hidden="true"></div>`;
    } else if (entry.image && entry.image.url) {
      const focal = entry.image.focal ? `background-position:${escHtml(entry.image.focal)};` : '';
      thumbHtml = `<div class="hse-tl__thumb" aria-hidden="true" style="background-image:url('${escHtml(entry.image.url)}');${focal}"></div>`;
    }

    return `<div class="hse-tl__entry" data-index="${i}" data-side="${escHtml(side)}">
      ${thumbHtml}
      <div class="hse-tl__entry-inner">
        <div class="hse-tl__dot" aria-hidden="true"></div>
        ${entry.date    ? `<span class="hse-tl__date">${escHtml(entry.date)}</span>` : ''}
        ${entry.heading ? `<h3 class="hse-tl__heading">${escHtml(entry.heading)}</h3>` : ''}
        ${entry.body    ? `<p class="hse-tl__body">${escHtml(entry.body)}</p>` : ''}
      </div>
    </div>`;
  }).join('\n');

  return `<section
  class="hse-section hse-section--timeline"
  id="${escHtml(section.id)}"
  data-layout="timeline"
  data-align="${escHtml(align)}"
  data-entry-count="${entries.length}">

  <!-- Sticky image/video canvas (desktop) -->
  <div class="hse-tl__sticky-wrap" aria-hidden="true">
    <div class="hse-tl__canvas">
      ${canvasHtml}
      <div class="hse-tl__gradient"></div>
    </div>
  </div>

  <!-- Scrolling entries -->
  <div class="hse-tl__phases">
    <div class="hse-tl__spine" aria-hidden="true"></div>
    ${entriesHtml}
  </div>

</section>`;
}

module.exports = { renderTimeline };
