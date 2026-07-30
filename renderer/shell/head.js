'use strict';
const fs   = require('fs');
const path = require('path');
const { buildPwaHeadTags } = require('../pwa');

/**
 * Reads the Platform Core token-set CSS file for a given token_set id and
 * wraps it in a <style> block, ready to inline into <head>. Shared by the
 * narrative renderHead() below and by other content kinds (e.g. the
 * graduation-guide renderer) that need the same token-set resolution
 * without pulling in renderHead's narrative-specific markup.
 *
 * @param {string} tokenSetId - meta.token_set, e.g. 'imperial'
 * @returns {string} '<style>...</style>' or '' if no matching file exists
 */
function resolveTokenStyle(tokenSetId) {
  const id = tokenSetId || 'default';
  const tokenSetPath = path.join(__dirname, '../../css', 'tokens-' + id + '.css');
  const tokenSetCss = fs.existsSync(tokenSetPath)
    ? fs.readFileSync(tokenSetPath, 'utf8')
    : '';
  return tokenSetCss ? '<style>\n' + tokenSetCss + '\n</style>' : '';
}

/**
 * Builds the Plausible analytics <script> tag for a content.config object,
 * or '' if no domain is configured. Shared by renderHead() and other
 * content kinds so the script host is only ever hardcoded in one place.
 *
 * @param {object} config - content.config
 * @returns {string}
 */
function renderPlausibleScript(config) {
  return config?.analytics?.plausible_domain
    ? `<script defer data-domain="${config.analytics.plausible_domain}" src="https://analytics.har.pn/js/script.js"></script>`
    : '';
}

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

  // No fallback to a hardcoded default here: this value gets injected as
  // an inline override at the very end of <head>, after the token_set's
  // own <style> block — so falling back to a default would silently clobber
  // a custom token set's own --hse-accent whenever a project uses one
  // without also duplicating its accent as meta.accent_color. Only override
  // when the project actually asked to.
  const accentColor  = meta.accent_color;
  const accentColor2 = meta.accent_color_2;

  // Load Platform Core token set
  const tokenSetId  = meta.token_set || 'default';

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

  const plausibleScript = renderPlausibleScript(config);

  const themeColorMeta = `<meta name="theme-color" content="${config?.pwa?.theme_color || accentColor || '#1A3F6F'}">`;

  const pwaTags = buildPwaHeadTags({
    enabled: !!config?.pwa?.enabled,
    asset: css,
  });

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

  const tokenSetHtml = resolveTokenStyle(tokenSetId);

  // OG / social tags
  const ogTitle       = escHtml(meta.title || '');
  const ogDescription = escHtml(meta.og_description || '');
  const ogImage       = escHtml(meta.og_image || heroImageUrl || '');
  const ogTags = [
    ogTitle       ? `<meta property="og:title" content="${ogTitle}">` : '',
    ogDescription ? `<meta property="og:description" content="${ogDescription}">` : '',
    ogImage       ? `<meta property="og:image" content="${ogImage}">` : '',
    ogImage       ? `<meta name="twitter:card" content="summary_large_image">` : '',
  ].filter(Boolean).join('\n  ');

  return `<!DOCTYPE html>
<html lang="${meta.language || 'en'}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escHtml(pageTitle)}</title>
  ${ogTags}
  ${robotsMeta}
  ${plausibleScript}
  ${themeColorMeta}
  ${pwaTags}

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
  <link rel="stylesheet" href="${css('css/layouts/two-column.css')}">

  <!-- Print stylesheet — media=print so it never affects screen rendering -->
  <link rel="stylesheet" href="${css('css/print.css')}" media="print">

  <!-- Review layer (activates only on review.* subdomain or ?review=1) -->
  <link rel="stylesheet" href="${css('css/review.css')}">
  <script defer src="${js('js/review.js')}"></script>
  <meta name="hse-supabase-url" content="${process.env.SUPABASE_URL || ''}">
  <meta name="hse-supabase-anon-key" content="${process.env.SUPABASE_ANON_KEY || ''}">

  ${(accentColor || accentColor2) ? `<!-- Per-project brand tokens -->
  <style>
    :root {
      ${accentColor  ? `--hse-accent:   ${accentColor};`  : ''}
      ${accentColor2 ? `--hse-accent-2: ${accentColor2};` : ''}
    }
  </style>` : ''}
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

/**
 * Parses a YouTube/Vimeo/direct-file video URL into an embeddable form.
 * Shared between the narrative kind's cinema-reveal layout and the
 * graduation-guide kind's ceremony recordings — one URL-sniffing
 * implementation, not two.
 */
function parseVideoUrl(url) {
  if (!url) return null;
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (yt) return { type: 'youtube', embedUrl: `https://www.youtube.com/embed/${yt[1]}?playsinline=1&rel=0` };
  const vimeo = url.match(/vimeo\.com\/(\d+)/);
  if (vimeo) return { type: 'vimeo', embedUrl: `https://player.vimeo.com/video/${vimeo[1]}?playsinline=1` };
  if (/\.(mp4|webm|mov)(\?|$)/i.test(url)) return { type: 'mp4', embedUrl: url };
  return { type: 'iframe', embedUrl: url };
}

module.exports = { renderHead, escHtml, resolveTokenStyle, renderPlausibleScript, parseVideoUrl };
