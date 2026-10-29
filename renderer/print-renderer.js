'use strict';

/**
 * Harpoon Story Engine — Print Renderer (Track 1)
 *
 * Generates a clean, branded, text-focused HTML page from story content.
 * Served at /print/:projectId/ — readers print or save as PDF from their browser.
 *
 * Section content comes from readable.js, so every layout prints its words
 * (and any images ticked "Include in print & PDF") in the same way the PDF
 * and the audio narration read them.
 */

const { escHtml } = require('./shell/head');
const { readSection } = require('./readable');
const path = require('path');
const fs   = require('fs');

// ── Main entry point ─────────────────────────────────────────────

function renderPrint(content) {
  const { meta, config, cover, sections } = content;

  // Resolve cover data (section-based or legacy)
  const coverSection = (sections || []).find(s => s.layout === 'cover');
  const coverData    = coverSection || cover || {};

  const head   = renderPrintHead(meta, config, coverData);
  const header = renderPrintCoverBlock(meta, coverData);
  const body   = (sections || [])
    .filter(s => s.layout !== 'cover')
    .map(s => renderPrintSection(s))
    .filter(Boolean)
    .join('\n\n');

  return `${head}
<body>
${header}
<main class="hpe-print-main">
${body}
</main>
<footer class="hpe-print-footer">
  <span>${escHtml(meta.title || '')}</span>
  <span>Produced with the Harpoon Story Engine</span>
</footer>
</body>
</html>`;
}

// ── Head ─────────────────────────────────────────────────────────

function renderPrintHead(meta, config, coverData) {
  const accent  = meta.accent_color  || '#1A3F6F';
  const accent2 = meta.accent_color_2 || '#C9A84C';

  const tokenSetId   = meta.token_set || 'default';
  const tokenSetPath = path.join(__dirname, '../css', 'tokens-' + tokenSetId + '.css');
  const tokenSetCss  = fs.existsSync(tokenSetPath)
    ? fs.readFileSync(tokenSetPath, 'utf8') : '';

  const registryPath  = path.join(__dirname, '../tokens/registry.json');
  const registry      = fs.existsSync(registryPath)
    ? JSON.parse(fs.readFileSync(registryPath, 'utf8')) : { token_sets: [] };
  const registryEntry = registry.token_sets.find(ts => ts.id === tokenSetId);
  const googleFontsUrl = registryEntry?.google_fonts_url || null;

  const fontsLink = googleFontsUrl
    ? `<link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="${googleFontsUrl}&display=swap" rel="stylesheet">`
    : `<link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,700;1,400;1,500&family=DM+Sans:wght@300;400;500&family=DM+Mono:wght@400&display=swap" rel="stylesheet">`;

  return `<!DOCTYPE html>
<html lang="${escHtml(meta.language || 'en')}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escHtml(meta.title || '')} — Print version</title>
  ${fontsLink}
  <style>
    /* ── Font defaults — overridden by token set below if present ── */
    :root {
      --hse-font-display: 'Playfair Display', Georgia, serif;
      --hse-font-body:    'DM Sans', system-ui, sans-serif;
      --hse-font-mono:    'DM Mono', monospace;
    }

    /* ── Token set override (sets --hse-* brand vars) ── */
    ${tokenSetCss}

    /* ── Print brand tokens — bridged from token set ── */
    :root {
      --hpe-accent:     ${accent};
      --hpe-accent2:    ${accent2};
      --hpe-font-serif: var(--hse-font-display);
      --hpe-font-sans:  var(--hse-font-body);
      --hpe-font-mono:  var(--hse-font-mono);
    }

    /* ── Page ── */
    @page { size: A4; margin: 18mm 22mm 22mm; }

    *, *::before, *::after { box-sizing: border-box; }

    html {
      font-family: var(--hpe-font-sans);
      font-size: 10.5pt;
      line-height: 1.65;
      color: #111;
    }

    body { margin: 0; padding: 0; }

    /* ── Cover block ── */
    .hpe-cover {
      margin-bottom: 5mm;
      padding-bottom: 5mm;
      border-bottom: 1.5pt solid var(--hpe-accent);
    }
    .hpe-cover__kicker {
      font-size: 7.5pt;
      letter-spacing: 0.15em;
      text-transform: uppercase;
      color: var(--hpe-accent);
      margin: 0 0 3mm;
    }
    .hpe-cover__headline {
      font-size: 22pt;
      line-height: 1.2;
      font-weight: 700;
      margin: 0 0 3mm;
    }
    .hpe-cover__headline em { font-style: italic; }
    .hpe-cover__body {
      font-size: 11pt;
      line-height: 1.65;
      color: #333;
      margin: 0 0 3mm;
    }
    .hpe-cover__meta {
      font-size: 7.5pt;
      color: #888;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    /* ── Sections ── */
    .hpe-section { margin-bottom: 6mm; }
    .hpe-section + .hpe-section {
      margin-top: 6mm;
      padding-top: 5mm;
      border-top: 0.5pt solid #ddd;
    }
    .hpe-section__label {
      font-size: 6.5pt;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: var(--hpe-accent);
      margin: 0 0 1.5mm;
    }
    .hpe-section__title {
      font-size: 15pt;
      font-weight: 700;
      line-height: 1.25;
      margin: 0 0 3mm;
      page-break-after: avoid;
      break-after: avoid;
    }
    .hpe-section__intro {
      font-size: 10.5pt;
      line-height: 1.65;
      color: #333;
      font-style: italic;
      margin: 0 0 3mm;
    }

    /* ── Body text ── */
    p { margin: 0 0 2.5mm; }
    .hpe-block-h2 {
      font-size: 12pt;
      font-weight: 700;
      margin: 5mm 0 2mm;
      page-break-after: avoid;
      break-after: avoid;
    }
    .hpe-block-h3 {
      font-size: 10.5pt;
      font-weight: 600;
      margin: 4mm 0 1.5mm;
      page-break-after: avoid;
      break-after: avoid;
    }
    .hpe-block-h4 {
      font-size: 9pt;
      font-weight: 600;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      margin: 4mm 0 1mm;
    }
    blockquote, .hpe-block-blockquote {
      margin: 3mm 0 3mm 4mm;
      padding-left: 4mm;
      border-left: 1.5pt solid #ccc;
      font-style: italic;
      color: #444;
    }
    .hpe-block--lead  { font-size: 11pt; }
    .hpe-block--caption { font-size: 8pt; color: #666; }

    /* ── Pull quote — plain italic, no box ── */
    .hpe-pull-quote { margin: 4mm 0 4mm 4mm; }
    .hpe-pull-quote__text {
      font-size: 11pt;
      font-style: italic;
      line-height: 1.45;
    }
    .hpe-pull-quote__attr {
      font-size: 8pt;
      color: #666;
      display: block;
      margin-top: 1mm;
    }

    /* ── Stats — simple list ── */
    .hpe-stats { margin: 3mm 0; }
    .hpe-stat { margin: 0 0 2mm; }
    .hpe-stat__value { font-weight: 700; font-size: 11pt; }
    .hpe-stat__label { font-size: 9pt; color: #555; }

    /* ── Panels (accordion / toggle) ── */
    .hpe-panel { margin: 0 0 2mm; }
    .hpe-panel__title { font-weight: 600; font-size: 10pt; margin: 0 0 0.5mm; }
    .hpe-panel__body  { font-size: 9.5pt; color: #333; margin: 0 0 2mm; }
    .hpe-panel__meta  { font-size: 8pt; color: #666; margin: 0; letter-spacing: 0.05em; }

    /* ── Images ticked "Include in print & PDF" ── */
    .hpe-figure { margin: 4mm 0; break-inside: avoid; }
    .hpe-figure img { display: block; max-width: 100%; max-height: 90mm; }
    .hpe-figure figcaption { font-size: 8pt; color: #666; margin-top: 1mm; }

    /* ── Footer ── */
    .hpe-print-footer {
      margin-top: 10mm;
      padding-top: 3mm;
      border-top: 0.5pt solid #ccc;
      font-size: 7pt;
      color: #aaa;
      letter-spacing: 0.08em;
      display: flex;
      justify-content: space-between;
    }

    /* ── Screen styles (viewing in browser before printing) ── */
    @media screen {
      html { background: #e8e8e4; }
      body {
        max-width: 170mm;
        margin: 12mm auto;
        background: #fff;
        padding: 18mm 22mm 22mm;
        box-shadow: 0 2px 24px rgba(0,0,0,0.12);
      }
    }

    /* ── Print overrides ── */
    @media print {
      html { background: none; }
      body { max-width: none; margin: 0; padding: 0; box-shadow: none; }
      a { color: inherit; text-decoration: none; }
    }
  </style>
</head>`;
}

// ── Cover block ──────────────────────────────────────────────────

function renderPrintCoverBlock(meta, cover) {
  const kicker     = cover?.kicker || meta.kicker || '';
  const headline   = cover?.headline || meta.title || '';
  const headlineEm = cover?.headline_em || '';
  const body       = cover?.body || '';

  const dateParts = [];
  if (meta.client) dateParts.push(meta.client);
  if (meta.date) {
    dateParts.push(new Date(meta.date).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'long', year: 'numeric'
    }));
  }

  return `<header class="hpe-cover">
  ${kicker ? `<p class="hpe-cover__kicker">${escHtml(kicker)}</p>` : ''}
  <h1 class="hpe-cover__headline">${escHtml(headline)}${headlineEm ? ` <em>${escHtml(headlineEm)}</em>` : ''}</h1>
  ${body ? `<p class="hpe-cover__body">${escHtml(body)}</p>` : ''}
  ${dateParts.length ? `<p class="hpe-cover__meta">${escHtml(dateParts.join(' · '))}</p>` : ''}
</header>`;
}

// ── Section renderer ─────────────────────────────────────────────
// Content comes from readable.js, shared with the PDF and audio.

function renderPrintSection(section) {
  const { label, title, intro, items } = readSection(section);

  const header = [
    label ? `<p class="hpe-section__label">${escHtml(label)}</p>` : '',
    title ? `<h2 class="hpe-section__title">${escHtml(title)}</h2>` : '',
    ...intro.map(p => `<p class="hpe-section__intro">${escHtml(p)}</p>`),
  ].join('');

  const body = items.map(renderPrintItem).filter(Boolean).join('\n');

  // A section with no words of its own adds nothing to a printed page
  if (!intro.length && !body) return '';

  return `<section class="hpe-section">
  ${header}
  ${body}
</section>`;
}

function renderPrintItem(item) {
  switch (item.kind) {
    case 'heading': {
      const tag = `h${item.level}`;
      return `<${tag} class="hpe-block-${tag}">${escHtml(item.text)}</${tag}>`;
    }
    case 'text': {
      const text = escHtml(item.text).replace(/\n\n/g, '</p><p class="hpe-block-p">').replace(/\n/g, '<br>');
      if (item.style === 'quote') return `<blockquote class="hpe-block-blockquote">${text}</blockquote>`;
      const style = item.style ? ` hpe-block--${item.style}` : '';
      return `<p class="hpe-block-p${style}">${text}</p>`;
    }
    case 'quote':
      return `<div class="hpe-pull-quote">
  <p class="hpe-pull-quote__text">${escHtml(item.text)}</p>
  ${item.attribution ? `<p class="hpe-pull-quote__attr">— ${escHtml(item.attribution)}</p>` : ''}
</div>`;
    case 'stats':
      return `<div class="hpe-stats">${item.items.map(s => `<div class="hpe-stat">
  <div class="hpe-stat__value">${escHtml(s.value || '')}</div>
  ${s.label ? `<div class="hpe-stat__label">${escHtml(s.label)}</div>` : ''}
</div>`).join('\n')}</div>`;
    case 'items':
      return item.items.map(i => `<div class="hpe-panel">
  ${i.meta  ? `<p class="hpe-panel__meta">${escHtml(i.meta)}</p>` : ''}
  ${i.title ? `<p class="hpe-panel__title">${escHtml(i.title)}</p>` : ''}
  ${i.body  ? `<p class="hpe-panel__body">${escHtml(i.body)}</p>` : ''}
</div>`).join('\n');
    case 'image':
      return `<figure class="hpe-figure">
  <img src="${escHtml(item.url)}" alt="${escHtml(item.alt)}">
  ${item.caption ? `<figcaption>${escHtml(item.caption)}</figcaption>` : ''}
</figure>`;
    default:
      return '';
  }
}

module.exports = { renderPrint };
