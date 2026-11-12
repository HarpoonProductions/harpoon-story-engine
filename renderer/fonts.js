'use strict';

/**
 * Story fonts (meta.fonts) — fonts chosen for one story, on top of whatever
 * its token set (theme) loads. For stories that sit outside a client theme.
 *
 *   meta.fonts = {
 *     google_url: "https://fonts.googleapis.com/css2?family=Lora:wght@400;700&display=swap",
 *     files: [{ family: "Brand Sans", weight: "400", style: "normal", url: "https://…/fonts/brand-sans.woff2" }],
 *     headings: "Lora",              // sets --hse-font-display
 *     body: "Brand Sans, sans-serif" // sets --hse-font-body
 *   }
 *
 * Uploaded font files are downloaded at render time:
 *  - the story page gets copies in its own fonts/ folder, so the fonts load
 *    from the story's own domain (stories.har.pn, a client's server after
 *    Export, or the editor preview) and no cross-origin (CORS) rules apply;
 *  - the print page and PDF get them inlined as data: URIs, because they
 *    are also served from editor routes and opened from file:// in CI.
 * If a download fails, the uploaded URL is used as it is.
 *
 * A story without meta.fonts renders exactly as before.
 */

const fs     = require('fs');
const os     = require('os');
const path   = require('path');
const crypto = require('crypto');

const FORMATS = { woff2: 'woff2', woff: 'woff', ttf: 'truetype', otf: 'opentype' };
const MIME    = { woff2: 'font/woff2', woff: 'font/woff', ttf: 'font/ttf', otf: 'font/otf' };
const MAX_FONT_BYTES = 10 * 1024 * 1024;
const CACHE_DIR = path.join(os.tmpdir(), 'hse-font-cache');

const GOOGLE_FONTS_RE = /^https:\/\/fonts\.googleapis\.com\/css2?\?[^"'<>\s]+$/;

/** Extension of a font URL (woff2|woff|ttf|otf), or null. */
function fontExt(url) {
  const m = /\.(woff2|woff|ttf|otf)(?:[?#].*)?$/i.exec(String(url || ''));
  return m ? m[1].toLowerCase() : null;
}

function cleanFamily(name) {
  return String(name || '').replace(/["'\\;{}<>]/g, '').trim();
}

function cleanWeight(w) {
  const s = String(w == null ? '' : w).trim().toLowerCase();
  if (/^[1-9]00( [1-9]00)?$/.test(s) || s === 'normal' || s === 'bold') return s;
  return '400';
}

function slug(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'font';
}

/**
 * The story's font settings, tidied up, or null when it has none.
 * Pure: no network. Files are listed without their bytes (data: null).
 */
function storyFonts(meta) {
  const f = meta && meta.fonts;
  if (!f || typeof f !== 'object') return null;

  const googleUrl = String(f.google_url || '').trim();
  const google = GOOGLE_FONTS_RE.test(googleUrl) ? googleUrl : null;

  const used = new Set();
  const files = (Array.isArray(f.files) ? f.files : [])
    .map((file) => {
      const url = String((file && file.url) || '').trim();
      const ext = fontExt(url);
      const family = cleanFamily(file && file.family);
      if (!/^https?:\/\//.test(url) || !ext || !family || /["'<>\s]/.test(url)) return null;
      const weight = cleanWeight(file.weight);
      const style = file.style === 'italic' ? 'italic' : 'normal';
      let filename = `${slug(family)}-${slug(weight)}-${style}.${ext}`;
      for (let i = 2; used.has(filename); i++) filename = `${slug(family)}-${slug(weight)}-${style}-${i}.${ext}`;
      used.add(filename);
      return { family, weight, style, url, ext, filename, data: null };
    })
    .filter(Boolean);

  const headings = fontStack(f.headings);
  const body = fontStack(f.body);

  if (!google && !files.length && !headings && !body) return null;
  return { google, files, headings, body };
}

/**
 * A CSS font-family value from what the editor typed. One name gets quoted
 * and a sans-serif fallback; a list ("Lora, Georgia, serif") is kept as typed.
 */
function fontStack(value) {
  const s = String(value || '').replace(/[;{}<>\\]/g, '').trim();
  if (!s) return null;
  if (s.includes(',')) return s;
  const name = s.replace(/["']/g, '');
  return `"${name}", sans-serif`;
}

/** Downloads one font (cached on disk by URL). Returns a Buffer or null. */
async function fetchFont(url) {
  const key = crypto.createHash('sha1').update(url).digest('hex');
  const cached = path.join(CACHE_DIR, key);
  try {
    if (fs.existsSync(cached)) return fs.readFileSync(cached);
  } catch (_) {}
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (!buf.length || buf.length > MAX_FONT_BYTES) throw new Error(`unexpected size ${buf.length}`);
    try {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
      fs.writeFileSync(cached, buf);
    } catch (_) {}
    return buf;
  } catch (err) {
    console.warn(`[fonts] Couldn't download ${url} (${err.message}); the page will load it from that URL instead`);
    return null;
  }
}

/** storyFonts(meta) with each uploaded file's bytes filled in where it downloaded. */
async function loadStoryFonts(meta) {
  const fonts = storyFonts(meta);
  if (!fonts) return null;
  await Promise.all(fonts.files.map(async (file) => { file.data = await fetchFont(file.url); }));
  return fonts;
}

/** Copies downloaded fonts into <outputDir>/fonts/. */
function writeStoryFontFiles(fonts, outputDir) {
  if (!fonts) return [];
  const saved = fonts.files.filter((f) => f.data);
  if (!saved.length) return [];
  const dir = path.join(outputDir, 'fonts');
  fs.mkdirSync(dir, { recursive: true });
  return saved.map((f) => {
    const p = path.join(dir, f.filename);
    fs.writeFileSync(p, f.data);
    return p;
  });
}

/**
 * The <link>/<style> for a story's fonts, or '' when it has none.
 * srcFor(file) gives each @font-face its URL.
 */
function fontsHtml(fonts, srcFor) {
  if (!fonts) return '';
  let out = '';
  if (fonts.google) {
    out += '\n  <!-- Story fonts (Google Fonts) -->' +
      '\n  <link rel="preconnect" href="https://fonts.googleapis.com">' +
      '\n  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
      `\n  <link href="${fonts.google.replace(/&(?!amp;)/g, '&amp;')}" rel="stylesheet">`;
  }
  const faces = fonts.files.map((f) => [
    '@font-face {',
    `  font-family: "${f.family}";`,
    `  font-weight: ${f.weight};`,
    `  font-style: ${f.style};`,
    '  font-display: swap;',
    `  src: url("${srcFor(f)}") format("${FORMATS[f.ext]}");`,
    '}',
  ].join('\n'));
  const vars = [
    fonts.headings ? `  --hse-font-display: ${fonts.headings};` : '',
    fonts.body ? `  --hse-font-body: ${fonts.body};` : '',
  ].filter(Boolean);
  if (vars.length) faces.push(`:root {\n${vars.join('\n')}\n}`);
  if (faces.length) {
    out += `\n  <!-- Story fonts -->\n  <style data-story-fonts>\n${faces.join('\n')}\n</style>`;
  }
  return out;
}

/** For the story page: the copy in its fonts/ folder, else the uploaded URL. */
function pageFontsHtml(fonts, asset) {
  return fontsHtml(fonts, (f) => (f.data ? asset(`fonts/${f.filename}`) : f.url));
}

/** For print and PDF: the font inlined, else the uploaded URL. */
function inlineFontsHtml(fonts) {
  return fontsHtml(fonts, (f) => (f.data ? `data:${MIME[f.ext]};base64,${f.data.toString('base64')}` : f.url));
}

module.exports = {
  storyFonts,
  loadStoryFonts,
  writeStoryFontFiles,
  pageFontsHtml,
  inlineFontsHtml,
  fontExt,
  MIME,
  GOOGLE_FONTS_RE,
};
