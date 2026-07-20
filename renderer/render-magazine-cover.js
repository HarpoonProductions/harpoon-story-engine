'use strict';

const { escHtml } = require('./shell/head');

/**
 * Renders a standalone HSE magazine cover page — the front door for an
 * Edition OS edition. Distinct from renderCover (render-cover.js), which
 * fronts a single story project. A magazine cover fronts many, and links
 * out to them rather than scrolling into its own sections.
 *
 * @param {object} data - a magazine-cover.schema.json content object
 * @param {string} basePath - root-relative base path for CSS ('' for local preview)
 * @returns {string} complete HTML document
 */
function renderMagazineCover(data, basePath) {
  const { meta, masthead, portrait, headline } = data;

  const base = basePath
    ? '/' + basePath.replace(/^\//, '').replace(/\/$/, '')
    : '';
  const css = (file) => (base ? `${base}/${file}` : file);

  const accentColor  = meta.accent_color   || '#1A3F6F';
  const accentColor2 = meta.accent_color_2 || '#C9A84C';

  const mastheadHtml = renderMasthead(masthead, meta.title);
  const portraitHtml = renderPortrait(portrait);
  const headlineHtml = renderHeadline(headline);
  const issueMetaHtml = meta.issue_label
    ? `<p class="hse-mc__issue-meta">${escHtml(meta.issue_label)}</p>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escHtml(meta.title)}</title>

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,700;1,400;1,500&family=DM+Sans:wght@300;400;500&family=DM+Mono:wght@400&display=swap" rel="stylesheet">

  <link rel="stylesheet" href="${css('css/tokens.css')}">
  <link rel="stylesheet" href="${css('css/magazine-cover.css')}">

  <style>
    :root {
      --hse-accent:   ${accentColor};
      --hse-accent-2: ${accentColor2};
    }
  </style>
</head>
<body>

<section id="hse-magazine-cover">
  ${mastheadHtml}
  ${portraitHtml}
  <div class="hse-mc__foot">
    ${headlineHtml}
    ${issueMetaHtml}
  </div>
</section>

</body>
</html>`;
}

// ── Private helpers ───────────────────────────────────────────────

function renderMasthead(masthead, fallbackTitle) {
  if (masthead && masthead.logo_url) {
    return `<img class="hse-mc__masthead-logo" src="${escHtml(masthead.logo_url)}" alt="${escHtml(fallbackTitle || '')}">`;
  }
  return `<h1 class="hse-mc__masthead-text">${escHtml(fallbackTitle || '')}</h1>`;
}

function renderPortrait(portrait) {
  if (!portrait || !portrait.url) return '';
  const focalStyle = portrait.focal
    ? ` style="object-position: ${escHtml(portrait.focal)}"`
    : '';
  return `<img class="hse-mc__portrait"
    src="${escHtml(portrait.url)}"
    alt="${escHtml(portrait.alt || '')}"
    decoding="async"${focalStyle}>`;
}

function renderHeadline(headline) {
  if (!headline || !headline.text) return '';
  const text = escHtml(headline.text);
  return headline.href
    ? `<a class="hse-mc__headline" href="${escHtml(headline.href)}">${text}</a>`
    : `<p class="hse-mc__headline">${text}</p>`;
}

module.exports = { renderMagazineCover };
