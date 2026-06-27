'use strict';
const fs   = require('fs');
const path = require('path');

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
function renderHead(meta, config, title, basePath, staging, heroImageUrl) {
  const pageTitle = title
    ? `${title} — ${meta.title}`
    : meta.title;

  const accentColor  = meta.accent_color  || '#1A3F6F';
  const accentColor2 = meta.accent_color_2 || '#C9A84C';

  // Load Platform Core token set
  const tokenSetId   = meta.token_set || 'default';
  const tokenSetPath = path.join(__dirname, '../../css', 'tokens-' + tokenSetId + '.css');
  const tokenSetCss  = fs.existsSync(tokenSetPath)
    ? fs.readFileSync(tokenSetPath, 'utf8')
    : '';

  // Resolve Google Fonts URL — registry entry takes precedence over hardcoded default
  const registryPath  = path.join(__dirname, '../../tokens/registry.json');
  const registry      = fs.existsSync(registryPath)
    ? JSON.parse(fs.readFileSync(registryPath, 'utf8'))
    : { token_sets: [] };
  const registryEntry = registry.token_sets.find(ts => ts.id === tokenSetId);
  const googleFontsUrl = registryEntry?.google_fonts_url || null;
  const useDefaultFonts = tokenSetId === 'default' && !googleFontsUrl;

  // Normalise basePath: ensure leading slash, no trailing slash
  // Empty string = relative paths for local preview
  // Non-empty = root-relative paths for S3/CloudFront
  const base = basePath
    ? '/' + basePath.replace(/^\//, '').replace(/\/$/, '')
    : '';

  const css = (file) => base ? `${base}/${file}` : file;
  const js  = (file) => base ? `${base}/${file}` : file;

  // Staging builds get noindex to prevent search engine indexing
  const robotsMeta = staging
    ? '<meta name="robots" content="noindex, nofollow">'
    : '';

  const plausibleScript = config?.analytics?.plausible_domain
    ? `<script defer data-domain="${config.analytics.plausible_domain}" src="https://analytics.harpoonproductions.com/js/script.js"></script>`
    : '';

  const pwaThemeColor = config?.pwa?.enabled && config.pwa.theme_color
    ? `<meta name="theme-color" content="${config.pwa.theme_color}">`
    : '';

  // Pre-compute conditional HTML blocks (avoids nested template literals)
  // Ensure font-display=swap is always present so text renders immediately
  function withSwap(url) {
    return url.includes('display=') ? url : url + '&display=swap';
  }

  const defaultFontsLink = '<link rel="preconnect" href="https://fonts.googleapis.com">\n' +
    '  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n' +
    '  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,700;1,400;1,500&family=DM+Sans:wght@300;400;500&family=DM+Mono:wght@400&display=swap" rel="stylesheet">';

  const fontsHtml = googleFontsUrl
    ? '<link rel="preconnect" href="https://fonts.googleapis.com">\n' +
      '  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n' +
      `  <link href="${withSwap(googleFontsUrl)}" rel="stylesheet">`
    : useDefaultFonts ? defaultFontsLink : '';

  const tokenSetHtml = tokenSetCss
    ? '<style>\n' + tokenSetCss + '\n</style>'
    : '';

  return `<!DOCTYPE html>
<html lang="${meta.language || 'en'}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escHtml(pageTitle)}</title>
  ${robotsMeta}
  ${plausibleScript}
  ${pwaThemeColor}

  <!-- Fonts (default set uses Google Fonts; client token sets may specify their own) -->
  ${fontsHtml}

  ${heroImageUrl ? `<!-- Preload hero image so LCP fires as early as possible -->
  <link rel="preload" as="image" href="${escHtml(heroImageUrl)}">` : ''}

  <!-- GSAP + ScrollTrigger + runtime (deferred — does not block first paint) -->
  <script defer src="${js('js/vendor/gsap.min.js')}"></script>
  <script defer src="${js('js/vendor/ScrollTrigger.min.js')}"></script>
  <script defer src="${js('js/runtime.js')}"></script>

  <!-- Story Engine styles -->
  <link rel="stylesheet" href="${css('css/tokens.css')}">

  <!-- Platform Core token set override -->
  ${tokenSetHtml}
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
  <link rel="stylesheet" href="${css('css/layouts/text.css')}">
  <link rel="stylesheet" href="${css('css/layouts/custom-html.css')}">
  <link rel="stylesheet" href="${css('css/layouts/scroll-carousel.css')}">
  <link rel="stylesheet" href="${css('css/blocks/background.css')}">
  <link rel="stylesheet" href="${css('css/heading-animations.css')}">
  <link rel="stylesheet" href="${css('css/layouts/sticky-steps.css')}">
  <link rel="stylesheet" href="${css('css/layouts/stackable-cards.css')}">
  <link rel="stylesheet" href="${css('css/layouts/cascading-slides.css')}">
  <link rel="stylesheet" href="${css('css/layouts/parallax.css')}">
  <link rel="stylesheet" href="${css('css/layouts/fullbleed-quote.css')}">
  <link rel="stylesheet" href="${css('css/layouts/reveal-crossfade.css')}">
  <link rel="stylesheet" href="${css('css/layouts/panoramic-scroll.css')}">
  <link rel="stylesheet" href="${css('css/layouts/cinema-reveal.css')}">
  <link rel="stylesheet" href="${css('css/layouts/frame-scrubber.css')}">
  <link rel="stylesheet" href="${css('css/layouts/split-reveal.css')}">

  <!-- Print stylesheet — media=print so it never affects screen rendering -->
  <link rel="stylesheet" href="${css('css/print.css')}" media="print">

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
