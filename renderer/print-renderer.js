'use strict';

/**
 * Harpoon Story Engine — Print Renderer (Track 1)
 *
 * Generates a clean, branded, text-focused HTML page from story content.
 * Served at /print/:projectId/ — readers print or save as PDF from their browser.
 *
 * Includes: cover summary, section titles/intros, text blocks, pull quotes,
 *           stat blocks, toggle panels, accordions, print-flagged images.
 * Excludes: visual-only layouts (cinema-reveal, frame-scrubber, panoramic-scroll,
 *           scroll-carousel, split-reveal, two-column) — title/intro only.
 */

const { escHtml } = require('./shell/head');
const path = require('path');
const fs   = require('fs');

// ── Layouts that are purely visual — print title+intro only ──────
const VISUAL_ONLY = new Set([
  'cinema-reveal', 'frame-scrubber', 'panoramic-scroll',
  'scroll-carousel', 'split-reveal', 'reveal-crossfade',
]);

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
    /* ── Token set override ── */
    ${tokenSetCss}

    /* ── Brand tokens ── */
    :root {
      --hpe-accent:  ${accent};
      --hpe-accent2: ${accent2};
      --hpe-font-serif: ${registryEntry?.font_serif || "'Playfair Display', Georgia, serif"};
      --hpe-font-sans:  ${registryEntry?.font_sans  || "'DM Sans', system-ui, sans-serif"};
      --hpe-font-mono:  ${registryEntry?.font_mono  || "'DM Mono', monospace"};
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
      margin-bottom: 12mm;
      padding-bottom: 8mm;
      border-bottom: 2pt solid var(--hpe-accent);
    }
    .hpe-cover__kicker {
      font-family: var(--hpe-font-mono);
      font-size: 7pt;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: var(--hpe-accent);
      margin: 0 0 3mm;
    }
    .hpe-cover__headline {
      font-family: var(--hpe-font-serif);
      font-size: 26pt;
      line-height: 1.15;
      font-weight: 700;
      margin: 0 0 2mm;
      color: #111;
    }
    .hpe-cover__headline em {
      font-style: italic;
      color: var(--hpe-accent);
    }
    .hpe-cover__body {
      font-size: 11.5pt;
      line-height: 1.6;
      color: #333;
      margin: 3mm 0 0;
      max-width: 90%;
    }
    .hpe-cover__meta {
      font-family: var(--hpe-font-mono);
      font-size: 7pt;
      color: #888;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      margin-top: 4mm;
    }
    .hpe-cover__hero {
      width: 100%;
      max-height: 55mm;
      object-fit: cover;
      object-position: center;
      display: block;
      margin-bottom: 6mm;
    }

    /* ── Section ── */
    .hpe-section {
      margin-bottom: 9mm;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .hpe-section + .hpe-section {
      padding-top: 7mm;
      border-top: 0.5pt solid #ddd;
    }
    .hpe-section__num {
      font-family: var(--hpe-font-mono);
      font-size: 6.5pt;
      letter-spacing: 0.15em;
      color: var(--hpe-accent);
      text-transform: uppercase;
      margin: 0 0 1.5mm;
    }
    .hpe-section__title {
      font-family: var(--hpe-font-serif);
      font-size: 17pt;
      font-weight: 700;
      line-height: 1.2;
      margin: 0 0 3mm;
      color: #111;
      page-break-after: avoid;
      break-after: avoid;
    }
    .hpe-section__intro {
      font-size: 11pt;
      line-height: 1.6;
      color: #333;
      margin: 0 0 4mm;
      font-style: italic;
    }

    /* ── Text blocks ── */
    .hpe-block { margin: 0 0 3mm; }
    .hpe-block p, .hpe-block-p { margin: 0 0 2.5mm; }
    .hpe-block-h2 {
      font-family: var(--hpe-font-serif);
      font-size: 13pt;
      font-weight: 700;
      margin: 5mm 0 2mm;
      page-break-after: avoid;
      break-after: avoid;
    }
    .hpe-block-h3 {
      font-family: var(--hpe-font-serif);
      font-size: 11pt;
      font-weight: 600;
      margin: 4mm 0 1.5mm;
      page-break-after: avoid;
      break-after: avoid;
    }
    .hpe-block-h4 {
      font-family: var(--hpe-font-sans);
      font-size: 9pt;
      font-weight: 600;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      margin: 4mm 0 1mm;
    }
    .hpe-block-blockquote {
      border-left: 2pt solid var(--hpe-accent);
      margin: 3mm 0 3mm 3mm;
      padding-left: 4mm;
      font-style: italic;
      color: #333;
    }
    .hpe-block--lead { font-size: 11.5pt; line-height: 1.6; }
    .hpe-block--caption { font-size: 8pt; color: #666; }
    .hpe-block--mono { font-family: var(--hpe-font-mono); font-size: 8.5pt; }

    /* ── Pull quote ── */
    .hpe-pull-quote {
      border-left: 2.5pt solid var(--hpe-accent);
      padding: 1mm 0 1mm 5mm;
      margin: 4mm 0;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .hpe-pull-quote__text {
      font-family: var(--hpe-font-serif);
      font-size: 13pt;
      line-height: 1.3;
      font-style: italic;
      margin: 0 0 1.5mm;
    }
    .hpe-pull-quote__attr {
      font-size: 8pt;
      color: #666;
      font-style: normal;
    }

    /* ── Stat block ── */
    .hpe-stats {
      display: flex;
      flex-wrap: wrap;
      gap: 4mm;
      margin: 4mm 0;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .hpe-stat {
      border-top: 1.5pt solid var(--hpe-accent);
      padding-top: 2mm;
      min-width: 28mm;
      flex: 1;
    }
    .hpe-stat__value {
      font-family: var(--hpe-font-serif);
      font-size: 20pt;
      font-weight: 700;
      line-height: 1;
      color: var(--hpe-accent);
    }
    .hpe-stat__label { font-size: 8pt; color: #555; margin-top: 1mm; }

    /* ── Toggle panels / accordion ── */
    .hpe-panel { margin: 2mm 0; page-break-inside: avoid; break-inside: avoid; }
    .hpe-panel__title {
      font-weight: 600;
      font-size: 9.5pt;
      margin: 0 0 1mm;
      color: var(--hpe-accent);
    }
    .hpe-panel__body { font-size: 9.5pt; color: #333; margin: 0 0 2mm; padding-left: 3mm; }

    /* ── Print image ── */
    .hpe-print-img {
      display: block;
      width: 100%;
      max-height: 80mm;
      object-fit: contain;
      object-position: left top;
      margin: 4mm 0;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .hpe-print-img__caption {
      font-size: 7.5pt;
      color: #777;
      font-style: italic;
      margin-top: 1mm;
    }

    /* ── Visual-only stub ── */
    .hpe-visual-stub {
      color: #999;
      font-size: 8pt;
      font-style: italic;
      margin: 2mm 0 4mm;
    }

    /* ── Footer ── */
    .hpe-print-footer {
      margin-top: 12mm;
      padding-top: 3mm;
      border-top: 0.5pt solid #ccc;
      display: flex;
      justify-content: space-between;
      font-family: var(--hpe-font-mono);
      font-size: 7pt;
      color: #aaa;
      letter-spacing: 0.08em;
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
  const heroUrl = cover?.hero_image?.url || cover?.hero_video?.poster || null;
  const heroHtml = heroUrl
    ? `<img class="hpe-cover__hero" src="${escHtml(heroUrl)}" alt="${escHtml(cover?.hero_image?.alt || '')}">`
    : '';

  const kicker = cover?.kicker || meta.kicker || '';
  const headline = cover?.headline || meta.title || '';
  const headlineEm = cover?.headline_em || '';
  const body = cover?.body || '';

  const dateParts = [];
  if (meta.client) dateParts.push(meta.client);
  if (meta.date) {
    dateParts.push(new Date(meta.date).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'long', year: 'numeric'
    }));
  }

  return `<header class="hpe-cover">
  ${heroHtml}
  ${kicker ? `<p class="hpe-cover__kicker">${escHtml(kicker)}</p>` : ''}
  <h1 class="hpe-cover__headline">${escHtml(headline)}${headlineEm ? `<br><em>${escHtml(headlineEm)}</em>` : ''}</h1>
  ${body ? `<p class="hpe-cover__body">${escHtml(body)}</p>` : ''}
  ${dateParts.length ? `<p class="hpe-cover__meta">${escHtml(dateParts.join(' · '))}</p>` : ''}
</header>`;
}

// ── Section dispatcher ───────────────────────────────────────────

function renderPrintSection(section) {
  const layout = section.layout || 'default';
  const num    = section.num ? String(section.num).padStart(2, '0') : null;

  const numHtml   = num ? `<p class="hpe-section__num">${escHtml(num)}</p>` : '';
  const titleHtml = section.title
    ? `<h2 class="hpe-section__title">${escHtml(section.title)}</h2>` : '';
  const introHtml = section.intro
    ? section.intro.split(/\n\n+/).map(p =>
        `<p class="hpe-section__intro">${escHtml(p.trim())}</p>`).join('') : '';

  const header = `${numHtml}${titleHtml}${introHtml}`;

  // Visual-only layouts: title + intro only, with a note
  if (VISUAL_ONLY.has(layout)) {
    const stub = `<p class="hpe-visual-stub">[Interactive ${layout} section — see online version]</p>`;
    return header || stub
      ? `<section class="hpe-section">${header}${stub}</section>` : '';
  }

  const body = renderPrintSectionBody(section, layout);
  if (!header && !body) return '';

  return `<section class="hpe-section">
  ${header}
  ${body}
</section>`;
}

function renderPrintSectionBody(section, layout) {
  const parts = [];

  // Text blocks (text layout and default layout)
  if (section.blocks && section.blocks.length) {
    parts.push(renderPrintBlocks(section.blocks));
  }

  // Pull quote
  if (section.pull_quote?.text) {
    parts.push(renderPrintPullQuote(section.pull_quote));
  }

  // Stat block
  if (section.stat_block?.length) {
    parts.push(renderPrintStats(section.stat_block));
  }

  // Toggle panels
  if (section.toggle_panels?.length) {
    parts.push(renderPrintPanels(section.toggle_panels, 'tab'));
  }

  // Accordion
  if (section.accordion_items?.length) {
    parts.push(renderPrintPanels(section.accordion_items, 'accordion'));
  }

  // Cards (stackable-cards, cascading-slides) — title + body only
  if (section.cards?.length) {
    parts.push(renderPrintCards(section.cards));
  }

  // Sticky steps — each step's text
  if (section.sticky_steps?.length) {
    parts.push(renderPrintStickySteps(section.sticky_steps));
  }

  // Fullbleed quote — treat as a pull quote
  if (layout === 'fullbleed-quote' && section.pull_quote?.text) {
    // Already handled above via pull_quote
  }

  // Parallax — body text if present
  if (layout === 'parallax' && section.body) {
    parts.push(`<p class="hpe-block-p">${escHtml(section.body)}</p>`);
  }

  // Print-flagged hero image
  if (section.hero_image?.url && section.hero_image?.print_include) {
    parts.push(renderPrintImage(section.hero_image));
  }

  return parts.filter(Boolean).join('\n');
}

// ── Block renderers ──────────────────────────────────────────────

function renderPrintBlocks(blocks) {
  return blocks.map(block => {
    const tag   = ['p','h2','h3','h4','blockquote'].includes(block.tag) ? block.tag : 'p';
    const style = ['lead','caption','mono'].includes(block.style) ? ` hpe-block--${block.style}` : '';
    const text  = escHtml(block.text || '').replace(/\n\n/g, '</p><p class="hpe-block-p">').replace(/\n/g, '<br>');
    return `<${tag} class="hpe-block-${tag}${style}">${text}</${tag}>`;
  }).join('\n');
}

function renderPrintPullQuote(pq) {
  return `<div class="hpe-pull-quote">
  <p class="hpe-pull-quote__text">${escHtml(pq.text)}</p>
  ${pq.attribution ? `<p class="hpe-pull-quote__attr">— ${escHtml(pq.attribution)}</p>` : ''}
</div>`;
}

function renderPrintStats(stats) {
  const items = stats.map(s => `<div class="hpe-stat">
  <div class="hpe-stat__value">${escHtml(s.value || '')}</div>
  ${s.label ? `<div class="hpe-stat__label">${escHtml(s.label)}</div>` : ''}
</div>`).join('\n');
  return `<div class="hpe-stats">${items}</div>`;
}

function renderPrintPanels(panels, type) {
  return panels.map(p => {
    const title = p.title || p.label || '';
    const body  = p.body  || p.content || '';
    return `<div class="hpe-panel">
  ${title ? `<p class="hpe-panel__title">${escHtml(title)}</p>` : ''}
  ${body  ? `<p class="hpe-panel__body">${escHtml(body)}</p>`  : ''}
</div>`;
  }).join('\n');
}

function renderPrintCards(cards) {
  return cards.map(c => {
    const title = c.title || c.tag || '';
    const body  = c.body  || '';
    return `<div class="hpe-panel">
  ${title ? `<p class="hpe-panel__title">${escHtml(title)}</p>` : ''}
  ${body  ? `<p class="hpe-panel__body">${escHtml(body)}</p>`  : ''}
</div>`;
  }).join('\n');
}

function renderPrintStickySteps(steps) {
  return steps.map((s, i) => {
    const title = s.title || `Step ${i + 1}`;
    const body  = s.body || '';
    const img   = s.image?.print_include ? renderPrintImage(s.image) : '';
    return `<div class="hpe-panel">
  <p class="hpe-panel__title">${escHtml(title)}</p>
  ${body ? `<p class="hpe-panel__body">${escHtml(body)}</p>` : ''}
  ${img}
</div>`;
  }).join('\n');
}

function renderPrintImage(image) {
  if (!image?.url) return '';
  return `<figure>
  <img class="hpe-print-img" src="${escHtml(image.url)}" alt="${escHtml(image.alt || '')}">
  ${image.caption ? `<figcaption class="hpe-print-img__caption">${escHtml(image.caption)}</figcaption>` : ''}
</figure>`;
}

module.exports = { renderPrint };
