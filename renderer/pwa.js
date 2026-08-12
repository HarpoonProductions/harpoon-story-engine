'use strict';

/**
 * PWA generation — Tier 1 capability (see harpoon-core's README and
 * renderer/pwa/{service-worker-template.js,manifest-template.json},
 * vendored from there). Deliberately generic: takes plain params, not a
 * specific content shape, so both the narrative render path and the
 * graduation-guide kind can call it with their own mapping rather than
 * this module knowing about either one specifically.
 *
 * Two-phase, in the order render() actually needs them:
 *   1. buildPwaHeadTags() — called while a page's <head> is being
 *      assembled (manifest link + theme-color meta + SW registration
 *      script). No dependency on the final HTML.
 *   2. writePwaFiles() — called after the full HTML string exists, so it
 *      can scan it for local asset paths to precache. Writes
 *      manifest.json, sw.js, and the generated icons into the output dir.
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const TEMPLATE_DIR = path.join(__dirname, 'pwa');

function isEnabled(config) {
  return !!(config && config.pwa && config.pwa.enabled);
}

// ── <head> tags ────────────────────────────────────────────────────────

/**
 * Manifest link + SW registration only — deliberately not responsible
 * for the page's theme-color meta tag, which is a general-purpose
 * browser-chrome-tint detail every page wants regardless of whether PWA
 * is enabled, not a PWA-specific concern. Each render path owns that
 * itself (see renderer/shell/head.js and renderer/kinds/graduation-guide.js).
 *
 * @param {object} opts
 * @param {boolean} opts.enabled
 * @param {function} opts.asset  - the page's own basePath-aware asset(file) helper
 * @returns {string} HTML to inline into <head> — '' when disabled
 */
function buildPwaHeadTags(opts) {
  if (!opts || !opts.enabled) return '';
  return `<link rel="manifest" href="${opts.asset('manifest.json')}">
  <script>
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', function () {
        navigator.serviceWorker.register('${opts.asset('sw.js')}').catch(function () {});
      });
    }
  </script>
  <script defer src="${opts.asset('ios-install-banner.js')}"></script>`;
}

// ── Icon generation ──────────────────────────────────────────────────
// Simple branded placeholder (institution/product initial on brand
// colour) via sharp — used when no real logo has been supplied.
// Replaceable later without touching this module: a future institution
// or meta field carrying real icon URLs would just bypass generateIcon
// entirely at the call site.

function iconSvg(letter, bgColor, size) {
  const fontSize = Math.round(size * 0.5);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <rect width="${size}" height="${size}" fill="${bgColor}"/>
    <text x="50%" y="50%" dy=".08em" text-anchor="middle" dominant-baseline="middle"
      font-family="Arial, Helvetica, sans-serif" font-weight="700"
      font-size="${fontSize}" fill="#ffffff">${letter}</text>
  </svg>`;
}

async function generateIcon(letter, bgColor, size) {
  const svg = iconSvg((letter || '?').slice(0, 1).toUpperCase(), bgColor || '#232333', size);
  return sharp(Buffer.from(svg)).png().toBuffer();
}

// ── Precache list ─────────────────────────────────────────────────────
// Derived generically from whatever a page actually references — no
// content-kind-specific knowledge here. htmlUrl is prepended (and must
// stay first: the service worker template falls back to
// PRECACHE_URLS[0] for offline navigations).

function extractLocalAssetPaths(html, htmlUrl) {
  const paths = new Set([htmlUrl]);
  const attrRe = /(?:href|src)=["']([^"']+)["']/g;
  let match;
  while ((match = attrRe.exec(html))) {
    const url = match[1];
    if (!url || /^(https?:)?\/\//.test(url) || /^(data|mailto|tel):/.test(url) || url.startsWith('#')) {
      continue;
    }
    paths.add(url);
  }
  return Array.from(paths);
}

// ── Manifest + service worker ────────────────────────────────────────

function buildManifest(opts) {
  const template = fs.readFileSync(path.join(TEMPLATE_DIR, 'manifest-template.json'), 'utf8');
  return template
    .replace(/__NAME__/g, opts.name)
    .replace(/__SHORT_NAME__/g, opts.shortName)
    .replace(/__START_URL__/g, opts.startUrl)
    .replace(/__SCOPE__/g, opts.scope)
    .replace(/__BACKGROUND_COLOR__/g, opts.backgroundColor)
    .replace(/__THEME_COLOR__/g, opts.themeColor)
    .replace('__ICONS_JSON__', JSON.stringify(opts.icons));
}

function buildServiceWorker(precacheUrls, cacheVersion) {
  const template = fs.readFileSync(path.join(TEMPLATE_DIR, 'service-worker-template.js'), 'utf8');
  // Global replace, not the first match only — the template's own doc
  // comment names both placeholder tokens too (explaining the mechanism),
  // so a single non-global .replace() would silently hit the comment
  // instead of the real code below it.
  return template
    .replace(/__CACHE_NAME__/g, cacheVersion)
    .replace(/__PRECACHE_URLS__/g, JSON.stringify(precacheUrls));
}

// ── Orchestration ─────────────────────────────────────────────────────

/**
 * Writes manifest.json, sw.js, and (unless opts.icons supplies real
 * ones) generated icons/icon-{192,512}.png into outputDir. Called after
 * a page's full HTML exists.
 *
 * @param {string} outputDir
 * @param {object} opts
 * @param {string} opts.html        - the fully-assembled page HTML (for asset scanning)
 * @param {function} opts.asset     - basePath-aware asset(file) helper
 * @param {string} opts.htmlFile    - relative filename of the page itself, e.g. 'index.html'
 * @param {string} opts.name
 * @param {string} opts.shortName
 * @param {string} opts.themeColor
 * @param {string} opts.backgroundColor
 * @param {string} opts.iconLetter
 * @param {Array}  [opts.icons]     - real {src,sizes,type} icons (e.g. institution.icons)
 *                                    — when supplied, skips placeholder generation entirely;
 *                                    src is resolved through opts.asset like fontFiles are.
 * @param {string} opts.cacheVersion - cache name / bust key, e.g. meta.project_id + '-' + a version string
 * @returns {Promise<string[]>} absolute paths written
 */
async function writePwaFiles(outputDir, opts) {
  const written = [];

  const bannerSrc = path.join(TEMPLATE_DIR, 'ios-install-banner.js');
  const bannerDest = path.join(outputDir, 'ios-install-banner.js');
  fs.copyFileSync(bannerSrc, bannerDest);
  written.push(bannerDest);

  let icons;
  let precacheIconUrls = [];

  if (opts.icons && opts.icons.length) {
    icons = opts.icons.map((icon) => ({ ...icon, src: opts.asset(icon.src) }));
    precacheIconUrls = icons.map((icon) => icon.src);
  } else {
    const iconsDir = path.join(outputDir, 'icons');
    fs.mkdirSync(iconsDir, { recursive: true });
    const [icon192, icon512] = await Promise.all([
      generateIcon(opts.iconLetter, opts.themeColor, 192),
      generateIcon(opts.iconLetter, opts.themeColor, 512),
    ]);
    const icon192Path = path.join(iconsDir, 'icon-192.png');
    const icon512Path = path.join(iconsDir, 'icon-512.png');
    fs.writeFileSync(icon192Path, icon192);
    fs.writeFileSync(icon512Path, icon512);
    written.push(icon192Path, icon512Path);

    icons = [
      { src: opts.asset('icons/icon-192.png'), sizes: '192x192', type: 'image/png' },
      { src: opts.asset('icons/icon-512.png'), sizes: '512x512', type: 'image/png' },
    ];
    precacheIconUrls = icons.map((icon) => icon.src);
  }

  const manifestJson = buildManifest({
    name: opts.name,
    shortName: opts.shortName,
    startUrl: opts.asset(opts.htmlFile),
    scope: opts.asset(''),
    backgroundColor: opts.backgroundColor,
    themeColor: opts.themeColor,
    icons,
  });
  const manifestPath = path.join(outputDir, 'manifest.json');
  fs.writeFileSync(manifestPath, manifestJson);
  written.push(manifestPath);

  const scanned = extractLocalAssetPaths(opts.html, opts.asset(opts.htmlFile));
  const precache = Array.from(new Set([
    ...scanned,
    opts.asset('manifest.json'),
    ...precacheIconUrls,
  ]));

  const swJs = buildServiceWorker(precache, opts.cacheVersion);
  const swPath = path.join(outputDir, 'sw.js');
  fs.writeFileSync(swPath, swJs);
  written.push(swPath);

  return written;
}

module.exports = { isEnabled, buildPwaHeadTags, writePwaFiles, extractLocalAssetPaths };
