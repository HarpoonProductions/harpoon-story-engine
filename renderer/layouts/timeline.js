'use strict';

const { escHtml } = require('../shell/head');

/**
 * Renders a section using the timeline layout.
 *
 * A sticky full-bleed image/video canvas sits behind scrolling text entries.
 * Each entry activates its corresponding media layer as it scrolls into view.
 *
 * Section fields:
 *   timeline_direction {string} 'vertical' | 'horizontal' | 'stepped'  (default: 'vertical')
 *                              Horizontal pins the section and scrolls the entries
 *                              sideways. Stepped pins it and travels a path that
 *                              turns across or down after each entry (entry.next);
 *                              js/runtime.js lays it out. Phones get the stacked
 *                              vertical layout, as does stepped without JS.
 *   timeline_align   {string}  'left' | 'right' | 'alternate'  (default: 'left')
 *                              Horizontal reads these as line at the top (text
 *                              below), at the bottom (text above), or in the
 *                              middle (text alternating above and below).
 *   timeline_marker  {string}  'dot' | 'triangle' | 'icon'      (default: 'dot')
 *   timeline_marker_icon  {string}  image URL, used when timeline_marker is 'icon'
 *   timeline_marker_size  {number}  px (default: 12)
 *   timeline_marker_color {string}  CSS colour (default: the story accent)
 *   timeline_line_color   {string}  CSS colour (default: the story accent, half opacity)
 *   timeline_line_width   {number}  px (default: 2)
 *   timeline_date_bg      {object}  { color, opacity, text_color, text_size } the block
 *                                   behind each date (text_size: small | large | xlarge)
 *   timeline_text_bg      {object}  the same for the heading + body block
 *   timeline_entries {Array}   array of entry objects:
 *     entry.date     {string}  e.g. "1987" or "March 2020"
 *     entry.heading  {string}
 *     entry.body     {string}
 *     entry.image    {object}  { url, focal, alt }
 *     entry.video    {object}  { url, poster }   — takes priority over image if both set
 *     entry.media    {object}  inline media shown with the text:
 *                              { type: 'image'|'video'|'embed', url, alt, caption, poster,
 *                                html (embed code), position: 'above'|'below'|'left'|'right' }
 *     entry.next     {string}  stepped only: 'across' | 'down' | 'up' | 'rise' (↗) | 'fall' (↘),
 *                              the way the path
 *                              goes after this entry (default: alternating, across first)
 *     entry.date_bg  {object}  { color, opacity } overrides timeline_date_bg for this entry
 *     entry.text_bg  {object}  { color, opacity } overrides timeline_text_bg for this entry
 *     entry.images   {Array}   more backgrounds after image/video: [{ url, focal, alt, caption }].
 *                              Each adds a scroll stop after the text has moved on.
 *     entry.images_transition {string} 'fade' | 'push' (default: 'fade'). Push slides the
 *                              next image in from the direction of travel.
 *     entry.kind     {string}  'interstitial' makes a chapter card (heading, body, background)
 *                              with no date or marker
 *     entry.line     {string}  interstitial only: 'hide' gaps the line through it
 *
 * @param {object} section
 * @returns {string} HTML
 */
// Only plain colour values reach the inline style: hex, names, rgb()/hsl()
// and var() — nothing that could close the declaration.
function cssColor(value) {
  return typeof value === 'string' && /^[#a-zA-Z0-9(),.%\s-]+$/.test(value.trim()) ? value.trim() : null;
}

function px(value, min, max) {
  const n = Number(value);
  return value !== '' && value != null && Number.isFinite(n) ? `${Math.min(max, Math.max(min, n))}px` : null;
}

// A background block: colour plus opacity (0–100). The entry's own setting
// wins field by field over the section default. Returns a CSS colour or null.
function blockBg(sectionBg, entryBg) {
  const s = sectionBg || {};
  const e = entryBg || {};
  const color = cssColor(e.color) || cssColor(s.color);
  if (!color) return null;
  const raw = e.opacity != null && e.opacity !== '' ? e.opacity : s.opacity;
  const n = Number(raw);
  const opacity = raw != null && raw !== '' && Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 100;
  if (opacity === 0) return null;
  const hex = color.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const h = hex[1].length === 3 ? hex[1].replace(/./g, c => c + c) : hex[1];
    const [r, g, b] = [0, 2, 4].map(o => parseInt(h.slice(o, o + 2), 16));
    return opacity === 100 ? color : `rgba(${r},${g},${b},${+(opacity / 100).toFixed(2)})`;
  }
  return opacity === 100 ? color : `color-mix(in srgb, ${color} ${opacity}%, transparent)`;
}

// Text colour and size for a block, with the same entry-over-section
// rule. Returns the inline style declarations (background included).
const TEXT_SIZES = { small: '0.85', large: '1.2', xlarge: '1.45' };
function blockStyle(sectionBg, entryBg) {
  const s = sectionBg || {};
  const e = entryBg || {};
  const bg = blockBg(s, e);
  const color = cssColor(e.text_color) || cssColor(s.text_color);
  const size = TEXT_SIZES[e.text_size] || (e.text_size ? null : TEXT_SIZES[s.text_size]);
  const style = [
    bg ? `background:${bg}` : null,
    color ? `--tl-text-color:${color}` : null,
    size ? `--tl-text-scale:${size}` : null,
  ].filter(Boolean).join(';');
  return { bg, style };
}

const MEDIA_POSITIONS = ['above', 'below', 'left', 'right'];

// Inline media inside an entry's text block. Embeds are trusted author HTML,
// as in the custom-html layout; a bare embed URL becomes an iframe.
function mediaHtml(media) {
  if (!media || typeof media !== 'object') return { html: '', position: null };
  const type = media.type || (media.html ? 'embed' : 'image');
  let inner = '';
  if (type === 'video' && media.url) {
    const poster = media.poster ? ` poster="${escHtml(media.poster)}"` : '';
    inner = `<video controls playsinline preload="metadata"${poster}><source src="${escHtml(media.url)}" type="video/mp4"></video>`;
  } else if (type === 'embed' && (media.html || media.url)) {
    inner = media.html
      ? `<div class="hse-tl__embed">${media.html}</div>`
      : `<div class="hse-tl__embed hse-tl__embed--frame"><iframe src="${escHtml(media.url)}" title="${escHtml(media.alt || media.caption || 'Embedded content')}" loading="lazy" allowfullscreen allow="autoplay; encrypted-media; picture-in-picture; fullscreen"></iframe></div>`;
  } else if (type === 'image' && media.url) {
    inner = `<img src="${escHtml(media.url)}" alt="${escHtml(media.alt || '')}" loading="lazy">`;
  }
  if (!inner) return { html: '', position: null };
  const position = MEDIA_POSITIONS.includes(media.position) ? media.position : 'above';
  const caption = media.caption ? `<figcaption>${escHtml(media.caption)}</figcaption>` : '';
  return {
    html: `<figure class="hse-tl__media hse-tl__media--${position}" data-type="${escHtml(type)}">${inner}${caption}</figure>`,
    position,
  };
}

// One background: the entry's video, else its image, else nothing.
function backgroundHtml(entry, cls, autoplay) {
  if (entry.video && entry.video.url) {
    const poster = entry.video.poster ? ` poster="${escHtml(entry.video.poster)}"` : '';
    return `<div class="${cls}" data-type="video">
        <video class="hse-tl__video"${autoplay ? ' autoplay' : ''} muted loop playsinline${poster} data-tl-video>
          <source src="${escHtml(entry.video.url)}" type="video/mp4">
        </video>
      </div>`;
  }
  if (entry.image && entry.image.url) {
    const focal = entry.image.focal ? `background-position:${escHtml(entry.image.focal)};` : '';
    return `<div class="${cls}"
        style="background-image:url('${escHtml(entry.image.url)}');${focal}"
        role="img"
        aria-label="${escHtml(entry.image.alt || '')}"
        data-type="image"></div>`;
  }
  return `<div class="${cls}" data-type="empty"></div>`;
}

// The extra background images of an entry, with a usable URL
function extraImages(entry) {
  return Array.isArray(entry.images) ? entry.images.filter(im => im && typeof im.url === 'string' && im.url.trim()) : [];
}

function renderTimeline(section) {
  const entries = section.timeline_entries || [];
  const align   = section.timeline_align   || 'left';
  const icon    = section.timeline_marker === 'icon' && section.timeline_marker_icon;
  const marker  = icon ? 'icon' : section.timeline_marker === 'triangle' ? 'triangle' : 'dot';
  const horizontal = section.timeline_direction === 'horizontal';
  const stepped    = section.timeline_direction === 'stepped';

  // Marker and line settings become custom properties on the section;
  // css/layouts/timeline.css falls back to the story accent for any not set.
  const lineColor = cssColor(section.timeline_line_color);
  const vars = [
    ['--tl-marker-size',  px(section.timeline_marker_size, 4, 64)],
    ['--tl-marker-color', cssColor(section.timeline_marker_color)],
    ['--tl-line-width',   px(section.timeline_line_width, 1, 16)],
    ['--tl-line-color',   lineColor],
    ['--tl-line-opacity', lineColor ? '1' : null],
    ['--tl-count',        horizontal ? String(entries.length) : null],
  ].filter(([, v]) => v).map(([k, v]) => `${k}:${v}`).join(';');

  const markerHtml = icon
    ? `<span class="hse-tl__marker" aria-hidden="true"><img src="${escHtml(icon)}" alt=""></span>`
    : `<span class="hse-tl__marker" aria-hidden="true"></span>`;

  // ── Canvas layers ────────────────────────────────────────────────
  const canvasHtml = entries.map((entry, i) => {
    const isFirst  = i === 0;
    const baseClass = `hse-tl__layer hse-tl__layer--${i}${isFirst ? ' is-active' : ''}`;
    const extras = extraImages(entry);
    if (!extras.length) {
      // A single background: the layer is the image (unchanged markup)
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
    }

    // Several: the layer holds a slide per image; js/runtime.js moves
    // through them while the entry's text stays in view
    const transition = entry.images_transition === 'push' ? 'push' : 'fade';
    const slides = [backgroundHtml(entry, 'hse-tl__slide is-current', isFirst)].concat(extras.map(im => {
      const caption = im.caption ? `<span class="hse-tl__slide-caption">${escHtml(im.caption)}</span>` : '';
      const focal = im.focal ? `background-position:${escHtml(im.focal)};` : '';
      return `<div class="hse-tl__slide" style="background-image:url('${escHtml(im.url)}');${focal}" role="img" aria-label="${escHtml(im.alt || '')}" data-type="image">${caption}</div>`;
    }));
    return `<div class="${baseClass}" data-index="${i}" data-type="gallery" data-transition="${transition}" data-slides="${slides.length}">
      ${slides.join('\n      ')}
    </div>`;
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

    // Date and text are separate blocks so each can carry its own background
    const dateBlock = blockStyle(section.timeline_date_bg, entry.date_bg);
    const textBlock = blockStyle(section.timeline_text_bg, entry.text_bg);
    const dateBg = dateBlock.bg;
    const textBg = textBlock.bg;
    const media  = mediaHtml(entry.media);
    const heading = entry.heading ? `<h3 class="hse-tl__heading">${escHtml(entry.heading)}</h3>` : '';
    const body    = entry.body    ? `<p class="hse-tl__body">${escHtml(entry.body)}</p>` : '';
    // Above: before the heading. Left/right: floated after the heading so
    // the body wraps round it. Below: after the body.
    const textParts = media.position === 'above' ? [media.html, heading, body]
      : media.position === 'below' ? [heading, body, media.html]
      : [heading, media.html, body];
    const hasText = heading || body || media.html;

    // Stepped: which way the path runs from this entry
    const run = !stepped ? '' : ['across', 'down', 'up', 'rise', 'fall'].includes(entry.next) ? entry.next : (i % 2 === 0 ? 'across' : 'down');

    // Extra backgrounds: a scroll stop each (data-slides); phones, which
    // have no background canvas, show them as pictures under the text
    const extras = extraImages(entry);
    const slidesAttr = extras.length ? ` data-slides="${extras.length + 1}" style="--tl-slides:${extras.length + 1}"` : '';
    const moreHtml = extras.length ? `
      <div class="hse-tl__more" aria-hidden="true">${extras.map(im => {
        const focal = im.focal ? `background-position:${escHtml(im.focal)};` : '';
        return `<div class="hse-tl__thumb" style="background-image:url('${escHtml(im.url)}');${focal}"></div>${im.caption ? `<span class="hse-tl__thumb-caption">${escHtml(im.caption)}</span>` : ''}`;
      }).join('')}</div>` : '';

    // Interstitial: a chapter card between entries — no date, no marker
    if (entry.kind === 'interstitial') {
      const title = entry.heading ? `<h2 class="hse-tl__heading">${escHtml(entry.heading)}</h2>` : '';
      return `<div class="hse-tl__entry hse-tl__entry--interstitial" data-index="${i}" data-kind="interstitial"${entry.line === 'hide' ? ' data-line="hide"' : ''}${run ? ` data-run="${run}"` : ''}${slidesAttr}>
      ${thumbHtml}
      <div class="hse-tl__entry-inner">
        ${title || body ? `<div class="hse-tl__text${textBg ? ' has-bg' : ''}"${textBlock.style ? ` style="${escHtml(textBlock.style)}"` : ''}>
          ${[title, body].filter(Boolean).join('\n          ')}
        </div>` : ''}
      </div>${moreHtml}
    </div>`;
    }

    return `<div class="hse-tl__entry" data-index="${i}" data-side="${escHtml(side)}"${run ? ` data-run="${run}"` : ''}${slidesAttr}>
      ${thumbHtml}
      <div class="hse-tl__entry-inner"${dateBg && entry.date ? ' data-date-bg' : ''}>
        ${markerHtml}
        ${entry.date ? `<span class="hse-tl__date${dateBg ? ' has-bg' : ''}"${dateBlock.style ? ` style="${escHtml(dateBlock.style)}"` : ''}>${escHtml(entry.date)}</span>` : ''}
        ${hasText ? `<div class="hse-tl__text${textBg ? ' has-bg' : ''}"${textBlock.style ? ` style="${escHtml(textBlock.style)}"` : ''}>
          ${textParts.filter(Boolean).join('\n          ')}
        </div>` : ''}
      </div>${moreHtml}
    </div>`;
  }).join('\n');

  return `<section
  class="hse-section hse-section--timeline"
  id="${escHtml(section.id)}"
  data-layout="timeline"
  data-align="${escHtml(align)}"${horizontal || stepped ? `
  data-direction="${stepped ? 'stepped' : 'horizontal'}"` : ''}
  data-marker="${marker}"${vars ? `
  style="${escHtml(vars)}"` : ''}
  data-entry-count="${entries.length}">

  <!-- Sticky image/video canvas (desktop) -->
  <div class="hse-tl__sticky-wrap" aria-hidden="true">
    <div class="hse-tl__canvas">
      ${canvasHtml}
      <div class="hse-tl__gradient"></div>
    </div>
  </div>

  <!-- Scrolling entries -->${horizontal || stepped ? `
  <div class="hse-tl__viewport">` : ''}
  <div class="hse-tl__phases">
    <div class="hse-tl__spine" aria-hidden="true"></div>
    ${entriesHtml}
  </div>${horizontal || stepped ? `
  </div>` : ''}

</section>`;
}

module.exports = { renderTimeline, blockBg, blockStyle };
