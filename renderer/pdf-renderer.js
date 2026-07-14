'use strict';

/**
 * Harpoon Story Engine — PDF Renderer (Track 2)
 *
 * Generates a publication-quality A4 HTML document.
 * Served at /pdf-preview/:id for visual checking.
 * The same HTML is fed to Puppeteer at publish time to produce story.pdf.
 *
 * Layout:
 *   Page 1 — Cover: full-bleed hero image, headline overlaid, colophon
 *   Pages 2+ — Body: branded running header, two-column text flow
 *
 * Visual-only sections (cinema-reveal, panoramic-scroll etc) are skipped.
 * Images within sections are omitted — text content only in the body.
 */

const { escHtml } = require('./shell/head');
const path = require('path');
const fs   = require('fs');

// Layouts that carry no extractable text worth printing
const VISUAL_ONLY = new Set([
  'cinema-reveal', 'frame-scrubber', 'panoramic-scroll',
  'scroll-carousel', 'split-reveal', 'reveal-crossfade',
]);

// ── Main entry ────────────────────────────────────────────────────

function renderPdf(content) {
  const { meta, config, cover, sections } = content;

  const coverSection = (sections || []).find(s => s.layout === 'cover');
  const coverData    = coverSection || cover || {};
  const bodySections = (sections || []).filter(s =>
    s.layout !== 'cover' && !VISUAL_ONLY.has(s.layout || 'default')
  );

  const tokenSetId    = meta.token_set || 'default';
  const registryPath  = path.join(__dirname, '../tokens/registry.json');
  const registry      = fs.existsSync(registryPath)
    ? JSON.parse(fs.readFileSync(registryPath, 'utf8')) : { token_sets: [] };
  const registryEntry = registry.token_sets.find(ts => ts.id === tokenSetId) || {};

  const tokenSetPath = path.join(__dirname, '../css', 'tokens-' + tokenSetId + '.css');
  const tokenSetCss  = fs.existsSync(tokenSetPath)
    ? fs.readFileSync(tokenSetPath, 'utf8') : '';

  const accent  = meta.accent_color   || '#1A3F6F';
  const accent2 = meta.accent_color_2 || '#C9A84C';

  const googleFontsUrl = registryEntry.google_fonts_url || null;
  const fontsLink = googleFontsUrl
    ? `<link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="${googleFontsUrl}&display=swap" rel="stylesheet">`
    : `<link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=DM+Sans:wght@300;400;500&family=DM+Mono:wght@400&display=swap" rel="stylesheet">`;

  const logoUrl  = meta.logo_url || registryEntry.logo_url || null;
  const head     = buildHead(meta, fontsLink, tokenSetCss, accent, accent2, registryEntry);
  const coverHtml = buildCoverPage(meta, coverData, logoUrl, accent);
  const bodyHtml  = buildBodyPages(meta, bodySections, logoUrl, accent, registryEntry);

  return `${head}
<body>
${coverHtml}
${bodyHtml}
</body>
</html>`;
}

// ── Head ──────────────────────────────────────────────────────────

function buildHead(meta, fontsLink, tokenSetCss, accent, accent2, reg) {
  return `<!DOCTYPE html>
<html lang="${escHtml(meta.language || 'en')}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="hpdf-title"  content="${escHtml(meta.title  || '')}">
  <meta name="hpdf-client" content="${escHtml(meta.client || '')}">
  <meta name="hpdf-accent" content="${escHtml(accent || '#1a3a5c')}">
  <title>${escHtml(meta.title || '')} — PDF</title>
  ${fontsLink}
  <style>
    /* ── Font defaults (overridden by token set) ── */
    :root {
      --hse-font-display: 'Playfair Display', Georgia, serif;
      --hse-font-body:    'DM Sans', system-ui, sans-serif;
      --hse-font-mono:    'DM Mono', monospace;
    }

    /* ── Token set ── */
    ${tokenSetCss}

    /* ── PDF brand vars ── */
    :root {
      --hpdf-accent:  ${accent};
      --hpdf-accent2: ${accent2};
      --hpdf-serif:   var(--hse-font-display);
      --hpdf-sans:    var(--hse-font-body);
      --hpdf-mono:    var(--hse-font-mono);
    }

    /* ── Reset ── */
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    /* ── @page rules for Puppeteer ── */
    /* 12mm top margin = space for the fixed running header on every body page.
       9mm bottom margin = space for Puppeteer's footer template (page numbers).
       :first removes the top margin on page 1 so the cover stays full-bleed;
       the fixed header's z-index is lower than the cover's so it's hidden there. */
    @page         { size: A4 portrait; margin: 12mm 0 9mm; }
    @page :first  { margin-top: 0; margin-bottom: 0; }

    html {
      font-family: var(--hpdf-sans);
      font-size: 10pt;
      line-height: 1.65;
      color: #111;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    /* ── Screen preview wrapper ── */
    @media screen {
      html { background: #d8d8d4; }
      body { padding: 10mm; }
    }

    /* ── A4 page simulation (screen) ── */
    .hpdf-page {
      width: 210mm;
      background: white;
      margin: 0 auto 8mm;
      box-shadow: 0 2px 20px rgba(0,0,0,0.15);
      position: relative;
      overflow: hidden;
    }

    /* ── Cover page ── */
    .hpdf-cover {
      height: calc(297mm - 9mm); /* 9mm reserved for Puppeteer footer on page 1 */
      display: flex;
      flex-direction: column;
    }

    .hpdf-cover__bg {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: center;
      display: block;
    }

    .hpdf-cover__gradient {
      position: absolute;
      inset: 0;
      background: linear-gradient(
        to bottom,
        rgba(0,0,0,0.05) 0%,
        rgba(0,0,0,0.3)  40%,
        rgba(0,0,0,0.75) 100%
      );
    }

    /* Solid fallback when no hero image */
    .hpdf-cover--no-image {
      background: var(--hpdf-accent);
    }
    .hpdf-cover--no-image .hpdf-cover__text { color: white; }

    .hpdf-cover__text {
      position: relative;
      z-index: 2;
      margin-top: auto;
      padding: 14mm 16mm 0;
      color: white;
    }

    .hpdf-cover__kicker {
      font-size: 7pt;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      opacity: 0.85;
      margin-bottom: 4mm;
    }

    .hpdf-cover__headline {
      font-family: var(--hpdf-serif);
      font-size: 28pt;
      line-height: 1.1;
      font-weight: 700;
      margin-bottom: 5mm;
    }

    .hpdf-cover__headline em {
      font-style: italic;
      opacity: 0.9;
    }

    .hpdf-cover__summary {
      font-size: 11pt;
      line-height: 1.6;
      opacity: 0.88;
      max-width: 155mm;
      margin-bottom: 10mm;
    }

    /* Accent rule above colophon */
    .hpdf-cover__rule {
      height: 2pt;
      background: var(--hpdf-accent2, var(--hpdf-accent));
      opacity: 0.9;
      margin: 0 16mm;
      position: relative;
      z-index: 2;
    }

    .hpdf-cover__colophon {
      position: relative;
      z-index: 2;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 5mm 16mm 10mm;
      color: white;
    }

    .hpdf-cover__logo {
      height: 8mm;
      width: auto;
      object-fit: contain;
      object-position: left;
      opacity: 0.9;
      filter: brightness(0) invert(1);
    }

    .hpdf-cover__meta {
      font-size: 7pt;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      opacity: 0.7;
      text-align: right;
    }

    /* Cover page — no logo text fallback */
    .hpdf-cover__brand-text {
      font-family: var(--hpdf-mono);
      font-size: 7pt;
      letter-spacing: 0.15em;
      text-transform: uppercase;
      opacity: 0.75;
    }

    /* ── Body pages ── */
    .hpdf-body {
      min-height: 297mm;
      padding: 0;
    }

    /* Running header */
    .hpdf-running-header {
      background: var(--hpdf-accent);
      color: white;
      padding: 4mm 16mm;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 4mm;
    }

    .hpdf-running-header__title {
      font-family: var(--hpdf-mono);
      font-size: 6.5pt;
      letter-spacing: 0.15em;
      text-transform: uppercase;
      opacity: 0.9;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .hpdf-running-header__client {
      font-family: var(--hpdf-mono);
      font-size: 6.5pt;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      opacity: 0.65;
      white-space: nowrap;
    }

    .hpdf-running-header__logo {
      height: 5mm;
      width: auto;
      object-fit: contain;
      opacity: 0.85;
      filter: brightness(0) invert(1);
      flex-shrink: 0;
    }

    /* Two-column body text */
    .hpdf-columns {
      padding: 12mm 16mm 14mm;
      column-count: 2;
      column-gap: 8mm;
      column-rule: 0.5pt solid #e0e0e0;
    }

    /* ── Column flow rules ──────────────────────────────────────────
       Only running prose flows in two columns.
       Everything structural (headers, intros, pull quotes, stats,
       panels, cards) uses column-span:all to stay full-width.
    ────────────────────────────────────────────────────────────── */

    /* Section header block — always full-width */
    .hpdf-section__header {
      column-span: all;
      padding-top: 7mm;
      border-top: 0.5pt solid #ddd;
      margin-bottom: 0;
      break-after: avoid;
    }
    .hpdf-section__header:first-child { padding-top: 0; border-top: none; }

    .hpdf-section__label {
      font-size: 6pt;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      color: var(--hpdf-accent);
      margin-bottom: 2mm;
    }

    .hpdf-section__title {
      font-family: var(--hpdf-serif);
      font-size: 14pt;
      font-weight: 700;
      line-height: 1.2;
      margin-bottom: 0;
    }

    /* Intro — full-width, italic lead-in */
    .hpdf-section__intro {
      column-span: all;
      font-size: 10.5pt;
      line-height: 1.65;
      font-style: italic;
      color: #333;
      margin: 3mm 0 3mm;
      break-after: avoid;
    }

    /* Body prose flows in two columns */
    p { margin-bottom: 2.5mm; }

    .hpdf-h2 {
      font-family: var(--hpdf-serif);
      font-size: 11pt;
      font-weight: 700;
      margin: 4mm 0 2mm;
      break-after: avoid;
    }

    .hpdf-h3 {
      font-size: 10pt;
      font-weight: 600;
      margin: 3.5mm 0 1.5mm;
      break-after: avoid;
    }

    .hpdf-h4 {
      font-size: 8.5pt;
      font-weight: 600;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      margin: 3mm 0 1mm;
    }

    blockquote {
      margin: 2mm 0 2mm 3mm;
      padding-left: 3mm;
      border-left: 1.5pt solid #ccc;
      font-style: italic;
      color: #444;
    }

    /* Pull quotes — full-width */
    .hpdf-pull-quote {
      column-span: all;
      border-top: 1.5pt solid var(--hpdf-accent);
      border-bottom: 0.5pt solid #ddd;
      padding: 4mm 0;
      margin: 5mm 0;
    }

    .hpdf-pull-quote__text {
      font-family: var(--hpdf-serif);
      font-size: 13pt;
      line-height: 1.35;
      font-style: italic;
      color: #222;
    }

    .hpdf-pull-quote__attr {
      font-size: 8pt;
      color: #777;
      margin-top: 2mm;
      display: block;
    }

    /* Stats — full-width flex row */
    .hpdf-stats {
      column-span: all;
      display: flex;
      flex-wrap: wrap;
      gap: 4mm;
      margin: 4mm 0;
    }
    .hpdf-stat { flex: 1; min-width: 28mm; }
    .hpdf-stat__value {
      font-family: var(--hpdf-serif);
      font-size: 22pt;
      font-weight: 700;
      line-height: 1;
      color: var(--hpdf-accent);
    }
    .hpdf-stat__label { font-size: 8pt; color: #555; margin-top: 1mm; }

    /* Panels / cards / accordion — full-width, stacked vertically */
    .hpdf-panels { column-span: all; margin: 3mm 0; }
    .hpdf-panel { margin-bottom: 2.5mm; break-inside: avoid; }
    .hpdf-panel__title { font-weight: 600; font-size: 9.5pt; margin-bottom: 0.5mm; }
    .hpdf-panel__body  { font-size: 9pt; color: #333; }

    /* ── Print ── */
    @media print {
      .hpdf-page  { width: 210mm; margin: 0; box-shadow: none; }
      .hpdf-cover { page-break-after: always; break-after: page; }
      .hpdf-body  { page-break-after: auto;   break-after: auto; }
      /* Running header is screen-only; Puppeteer headerTemplate handles print */
      .hpdf-running-header { display: none; }
    }
  </style>
</head>`;
}

// ── Cover page ────────────────────────────────────────────────────

function buildCoverPage(meta, cover, logoUrl, accent) {
  const heroUrl    = cover?.hero_image?.url || cover?.hero_video?.poster || null;
  const kicker     = cover?.kicker || meta.kicker || '';
  const headline   = cover?.headline || meta.title || '';
  const headlineEm = cover?.headline_em || '';
  const summary    = cover?.body || '';

  const dateParts = [];
  if (meta.client) dateParts.push(escHtml(meta.client));
  if (meta.date) {
    dateParts.push(new Date(meta.date).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'long', year: 'numeric'
    }));
  }

  const logoHtml = logoUrl
    ? `<img class="hpdf-cover__logo" src="${escHtml(logoUrl)}" alt="">`
    : `<span class="hpdf-cover__brand-text">${escHtml(meta.title || '')}</span>`;

  const heroHtml = heroUrl
    ? `<img class="hpdf-cover__bg" src="${escHtml(heroUrl)}" alt="">
  <div class="hpdf-cover__gradient"></div>`
    : '';

  const noImageClass = heroUrl ? '' : ' hpdf-cover--no-image';

  return `<div class="hpdf-page hpdf-cover${noImageClass}">
  ${heroHtml}
  <div class="hpdf-cover__text">
    ${kicker ? `<p class="hpdf-cover__kicker">${escHtml(kicker)}</p>` : ''}
    <h1 class="hpdf-cover__headline">${escHtml(headline)}${headlineEm ? ` <em>${escHtml(headlineEm)}</em>` : ''}</h1>
    ${summary ? `<p class="hpdf-cover__summary">${escHtml(summary)}</p>` : ''}
  </div>
  <div class="hpdf-cover__rule"></div>
  <div class="hpdf-cover__colophon">
    ${logoHtml}
    ${dateParts.length ? `<p class="hpdf-cover__meta">${dateParts.join('<br>')}</p>` : ''}
  </div>
</div>`;
}

// ── Body pages ────────────────────────────────────────────────────

function buildBodyPages(meta, sections, logoUrl, accent, reg) {
  const clientLabel = meta.client || '';
  const titleLabel  = meta.title  || '';

  // Logo in the screen-visible static header (the fixed print header is separate)
  const logoHtml = logoUrl
    ? `<img class="hpdf-running-header__logo" src="${escHtml(logoUrl)}" alt="">`
    : '';

  const header = `<div class="hpdf-running-header">
  <span class="hpdf-running-header__title">${escHtml(titleLabel)}</span>
  ${clientLabel ? `<span class="hpdf-running-header__client">${escHtml(clientLabel)}</span>` : ''}
  ${logoHtml}
</div>`;

  const body = sections.flatMap(s => renderPdfSection(s)).filter(Boolean).join('\n');

  if (!body) return '';

  return `<div class="hpdf-page hpdf-body">
${header}
<div class="hpdf-columns">
${body}
</div>
</div>`;
}

// ── Section renderer ──────────────────────────────────────────────
// Elements are emitted FLAT — direct children of .hpdf-columns.
// This is required for column-span:all to work reliably in Chrome.
// A .hpdf-section wrapper div traps column-span inside a fragmentation
// boundary, preventing panels/pull-quotes from escaping to full-width.

function renderPdfSection(section) {
  const navLabel = section.nav_label || null;
  const title    = section.title || '';
  const intro    = section.intro || '';

  const parts = [];

  // Section header — spans both columns
  if (navLabel || title) {
    parts.push(`<div class="hpdf-section__header">
  ${navLabel ? `<p class="hpdf-section__label">${escHtml(navLabel)}</p>` : ''}
  ${title    ? `<h2 class="hpdf-section__title">${escHtml(title)}</h2>` : ''}
</div>`);
  }

  // Intro — spans both columns
  if (intro) {
    intro.split(/\n\n+/).forEach(p => {
      parts.push(`<p class="hpdf-section__intro">${escHtml(p.trim())}</p>`);
    });
  }

  // Body content — mix of two-column prose and full-width spanning elements
  parts.push(...renderPdfSectionBody(section));

  return parts.filter(Boolean).join('\n');
}

// Returns an array of HTML strings — each is a direct child of .hpdf-columns.
// Prose blocks are plain <p>/<h2> etc (flow in columns).
// Pull quotes, stats, panels use column-span:all (full-width).
function renderPdfSectionBody(section) {
  const layout = section.layout || 'default';
  const parts  = [];

  if (section.blocks?.length) {
    // Blocks may contain inline headings — emit individually so they flow naturally
    parts.push(renderPdfBlocks(section.blocks));
  }

  if (section.pull_quote?.text) {
    parts.push(renderPdfPullQuote(section.pull_quote));
  }

  if (section.stat_block?.length) {
    parts.push(renderPdfStats(section.stat_block));
  }

  if (section.toggle_panels?.length) {
    parts.push(renderPdfPanels(section.toggle_panels));
  }

  if (section.accordion_items?.length) {
    parts.push(renderPdfPanels(section.accordion_items));
  }

  if (section.cards?.length) {
    parts.push(renderPdfPanels(section.cards.map(c => ({
      title: c.title || c.tag || '',
      body:  c.body  || '',
    }))));
  }

  if (section.sticky_steps?.length) {
    parts.push(renderPdfPanels(section.sticky_steps.map((s, i) => ({
      title: s.title || `Step ${i + 1}`,
      body:  s.body  || '',
    }))));
  }

  if (layout === 'parallax' && section.body) {
    parts.push(`<p>${escHtml(section.body)}</p>`);
  }

  return parts.filter(Boolean);
}

// ── Element renderers ─────────────────────────────────────────────

function renderPdfBlocks(blocks) {
  return blocks.map(block => {
    const text = escHtml(block.text || '').replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>');
    switch (block.tag) {
      case 'h2': return `<h2 class="hpdf-h2">${text}</h2>`;
      case 'h3': return `<h3 class="hpdf-h3">${text}</h3>`;
      case 'h4': return `<h4 class="hpdf-h4">${text}</h4>`;
      case 'blockquote': return `<blockquote>${text}</blockquote>`;
      default:
        const cls = block.style === 'lead' ? ' style="font-size:11pt"' : '';
        return `<p${cls}>${text}</p>`;
    }
  }).join('\n');
}

function renderPdfPullQuote(pq) {
  return `<div class="hpdf-pull-quote">
  <p class="hpdf-pull-quote__text">${escHtml(pq.text)}</p>
  ${pq.attribution ? `<span class="hpdf-pull-quote__attr">— ${escHtml(pq.attribution)}</span>` : ''}
</div>`;
}

function renderPdfStats(stats) {
  const items = stats.map(s => `<div class="hpdf-stat">
  <div class="hpdf-stat__value">${escHtml(s.value || '')}</div>
  ${s.label ? `<div class="hpdf-stat__label">${escHtml(s.label)}</div>` : ''}
</div>`).join('\n');
  return `<div class="hpdf-stats">${items}</div>`;
}

function renderPdfPanels(panels) {
  const items = panels.map(p => {
    const title = p.title || p.label || '';
    const body  = p.body  || p.content || '';
    if (!title && !body) return '';
    return `<div class="hpdf-panel">
  ${title ? `<p class="hpdf-panel__title">${escHtml(title)}</p>` : ''}
  ${body  ? `<p class="hpdf-panel__body">${escHtml(body)}</p>`   : ''}
</div>`;
  }).filter(Boolean).join('\n');
  return items ? `<div class="hpdf-panels">${items}</div>` : '';
}

module.exports = { renderPdf };
