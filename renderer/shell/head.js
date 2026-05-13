'use strict';

/**
 * Renders the <head> block for a Story Engine page.
 * Injects per-project CSS custom property overrides from meta.
 *
 * @param {object} meta      - content.meta
 * @param {object} config    - content.config
 * @param {string} title     - page title (may differ from meta.title for section pages)
 * @param {string} basePath  - root-relative base path, e.g. '/opera-voices-2026'
 * @returns {string} HTML string
 */
function renderHead(meta, config, title, basePath) {
  const pageTitle = title
    ? `${title} — ${meta.title}`
    : meta.title;

  const accentColor  = meta.accent_color  || '#1A3F6F';
  const accentColor2 = meta.accent_color_2 || '#C9A84C';

  // Normalise basePath: ensure leading slash, no trailing slash
  // Empty string = relative paths for local preview
  // Non-empty = root-relative paths for S3/CloudFront
  const base = basePath
    ? '/' + basePath.replace(/^\//, '').replace(/\/$/, '')
    : '';

  const css = (file) => base ? `${base}/${file}` : file;

  const plausibleScript = config?.analytics?.plausible_domain
    ? `<script defer data-domain="${config.analytics.plausible_domain}" src="https://analytics.harpoonproductions.com/js/script.js"></script>`
    : '';

  const pwaThemeColor = config?.pwa?.enabled && config.pwa.theme_color
    ? `<meta name="theme-color" content="${config.pwa.theme_color}">`
    : '';

  return `<!DOCTYPE html>
<html lang="${meta.language || 'en'}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escHtml(pageTitle)}</title>
  ${plausibleScript}
  ${pwaThemeColor}

  <!-- Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,700;1,400;1,500&family=DM+Sans:wght@300;400;500&family=DM+Mono:wght@400&display=swap" rel="stylesheet">

  <!-- GSAP + ScrollTrigger -->
  <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js"></script>

  <!-- Story Engine styles -->
  <link rel="stylesheet" href="${css('css/tokens.css')}">
  <link rel="stylesheet" href="${css('css/base.css')}">
  <link rel="stylesheet" href="${css('css/nav.css')}">
  <link rel="stylesheet" href="${css('css/cover.css')}">
  <link rel="stylesheet" href="${css('css/blocks/pull-quote.css')}">
  <link rel="stylesheet" href="${css('css/blocks/stat-block.css')}">
  <link rel="stylesheet" href="${css('css/blocks/photo-cluster.css')}">
  <link rel="stylesheet" href="${css('css/blocks/toggle-panels.css')}">
  <link rel="stylesheet" href="${css('css/blocks/accordion.css')}">
  <link rel="stylesheet" href="${css('css/blocks/cards.css')}">
  <link rel="stylesheet" href="${css('css/blocks/contributors.css')}">
  <link rel="stylesheet" href="${css('css/blocks/briefing-engine.css')}">
  <link rel="stylesheet" href="${css('css/layouts/default.css')}">
  <link rel="stylesheet" href="${css('css/layouts/sticky-steps.css')}">
  <link rel="stylesheet" href="${css('css/layouts/stackable-cards.css')}">
  <link rel="stylesheet" href="${css('css/layouts/cascading-slides.css')}">
  <link rel="stylesheet" href="${css('css/layouts/parallax.css')}">
  <link rel="stylesheet" href="${css('css/layouts/fullbleed-quote.css')}">
  <link rel="stylesheet" href="${css('css/layouts/reveal-crossfade.css')}">

  <!-- Per-project brand tokens -->
  <style>
    :root {
      --hse-accent:   ${accentColor};
      --hse-accent-2: ${accentColor2};
    }
  </style>
</head>`;
}

/**
 * Escape HTML special characters for safe attribute/text insertion.
 */
function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

module.exports = { renderHead, escHtml };
