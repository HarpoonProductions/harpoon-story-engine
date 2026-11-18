'use strict';

/**
 * Export media bundling.
 *
 * A client export should be fully self-hosted: every image, video, poster,
 * font, caption file and frame sequence that we host (our S3 buckets or the
 * stories.har.pn CDN) is downloaded into the bundle's assets/ folder and every
 * reference to it is rewritten to a relative path.
 *
 *   findStoryMedia(texts)          → which of our files a story uses
 *   estimateMedia(content)         → how many files / bytes, without rendering
 *   bundleMedia(dir, opts)         → download + rewrite a rendered export dir
 *
 * Anything that fails to download keeps its original URL (so the story still
 * works) and is reported back so the README can list it.
 */

const fs   = require('fs');
const path = require('path');
const { pipeline } = require('stream/promises');
const { Readable } = require('stream');

// ── Which hosts are ours ──────────────────────────────────────────

const DEFAULT_BUCKETS = ['harpn', 'harpoon-stories'];
const DEFAULT_DOMAINS = ['stories.har.pn'];

const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function ourHosts(env = process.env) {
  const buckets = new Set(DEFAULT_BUCKETS);
  if (env.S3_BUCKET) buckets.add(env.S3_BUCKET);
  const domains = new Set(DEFAULT_DOMAINS);
  if (env.DELIVERY_DOMAIN) domains.add(env.DELIVERY_DOMAIN.replace(/^https?:\/\//, '').replace(/\/.*$/, ''));
  return { buckets: [...buckets], domains: [...domains] };
}

function hostPattern(hosts) {
  const parts = [
    // harpn.s3.amazonaws.com, harpn.s3-eu-west-2.amazonaws.com, harpn.s3.eu-west-2.amazonaws.com
    ...hosts.buckets.map((b) => `${escRe(b)}\\.s3(?:[.-][a-z0-9-]+)?\\.amazonaws\\.com`),
    ...hosts.domains.map(escRe),
  ];
  return `(?:${parts.join('|')})`;
}

// A URL on one of our hosts. The path stops at anything that can't be part
// of an unescaped URL in HTML, CSS, JS or JSON: quotes, whitespace, brackets,
// backslashes (JSON-escaped quotes), and & (HTML-escaped quotes like &quot;).
function urlRegex(hosts) {
  return new RegExp(
    `https?:\\/\\/(${hostPattern(hosts)})\\/([^\\s"'<>()\\\\\`?#&]+)(\\?[^\\s"'<>()\\\\\`#]*)?`,
    'gi'
  );
}

// Files we bundle. stories.har.pn also serves whole stories (links to other
// stories, canonical URLs), so only paths that look like media are taken.
const MEDIA_EXT = new Set([
  'jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'svg', 'ico', 'bmp', 'tif', 'tiff',
  'mp4', 'webm', 'mov', 'm4v', 'ogv', 'm3u8',
  'mp3', 'm4a', 'wav', 'ogg', 'oga', 'aac', 'flac',
  'vtt', 'srt',
  'woff2', 'woff', 'ttf', 'otf', 'eot',
  'pdf', 'glb', 'gltf', 'lottie',
]);
// Anything under an uploads folder counts, whatever its extension.
const MEDIA_DIR = /(^|\/)(images|fonts|media|sequences|graduation-guide-media)\//i;

function isMediaPath(p) {
  if (MEDIA_DIR.test(p)) return true;
  const m = p.match(/\.([a-z0-9]+)$/i);
  return !!m && MEDIA_EXT.has(m[1].toLowerCase());
}

function safeDecode(s) {
  try { return decodeURIComponent(s); } catch { return s; }
}

/** The local path (under assets/) a remote path is saved to, or null if unsafe. */
function localPathFor(remotePath) {
  const decoded = safeDecode(remotePath).replace(/\\/g, '/');
  const segs = decoded.split('/').filter((s) => s && s !== '.');
  if (!segs.length || segs.some((s) => s === '..')) return null;
  return 'assets/' + segs.join('/');
}

/** Turn a parsed match into { url, local } or null. */
function parseMatch(full, host, rawPath) {
  // Trailing punctuation from prose or srcset lists isn't part of the URL.
  const trimmed = rawPath.replace(/[,.;:]+$/, '');
  if (!trimmed || trimmed.endsWith('/') || !isMediaPath(trimmed)) return null;
  const local = localPathFor(trimmed);
  if (!local) return null;
  return { trimmed, local };
}

// ── Finding what a story uses ─────────────────────────────────────

const unescHtml = (s) => s
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&amp;/g, '&');

/** Frame-scrubber sections only store a folder; the runtime builds frame URLs. */
function findSequencesInHtml(html, hosts) {
  const out = [];
  const tagRe = /<section\b[^>]*data-layout="frame-scrubber"[^>]*>/g;
  const hostRe = new RegExp(`^https?:\\/\\/${hostPattern(hosts)}\\/`, 'i');
  let m;
  while ((m = tagRe.exec(html)) !== null) {
    const tag = m[0];
    const attr = (name) => { const a = tag.match(new RegExp(`${name}="([^"]*)"`)); return a ? unescHtml(a[1]) : null; };
    const baseUrl = attr('data-base-url');
    if (!baseUrl || !hostRe.test(baseUrl)) continue;
    out.push({
      baseUrl,
      count:  parseInt(attr('data-frame-count'), 10) || 60,
      prefix: attr('data-frame-prefix') ?? 'frame-',
      digits: parseInt(attr('data-frame-digits'), 10) || 3,
    });
  }
  return out;
}

function sequencesFromContent(content, hosts) {
  const hostRe = new RegExp(`^https?:\\/\\/${hostPattern(hosts)}\\/`, 'i');
  const out = [];
  for (const s of content.sections || []) {
    const sc = s && s.layout === 'frame-scrubber' && s.scrubber;
    if (!sc || !sc.base_url || !hostRe.test(sc.base_url)) continue;
    out.push({ baseUrl: sc.base_url, count: sc.frame_count || 60, prefix: sc.frame_prefix || 'frame-', digits: sc.frame_digits || 3 });
  }
  return out;
}

function sequenceFiles(seq) {
  const base = seq.baseUrl.endsWith('/') ? seq.baseUrl : seq.baseUrl + '/';
  const basePath = base.replace(/^https?:\/\/[^/]+\//, '');
  const localBase = localPathFor(basePath);
  if (!localBase) return { localBase: null, files: [] };
  const files = [];
  for (let i = 1; i <= seq.count; i++) {
    const name = `${seq.prefix}${String(i).padStart(seq.digits, '0')}.jpg`;
    files.push({ url: base + name, local: `${localBase}/${safeDecode(name)}` });
  }
  return { localBase: localBase + '/', files };
}

/**
 * Every file of ours that the given texts reference.
 * Returns Map<local path, url to download from>.
 */
function findStoryMedia(texts, hosts = ourHosts()) {
  const files = new Map();
  const re = urlRegex(hosts);
  for (const text of texts) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text)) !== null) {
      const parsed = parseMatch(m[0], m[1], m[2]);
      if (!parsed) continue;
      if (!files.has(parsed.local)) files.set(parsed.local, `https://${m[1]}/${parsed.trimmed}`);
    }
  }
  return files;
}

/** External media we can't bundle (other people's servers), for the README. */
function findExternalMedia(texts, hosts = ourHosts()) {
  const ours = new RegExp(`^${hostPattern(hosts)}$`, 'i');
  const re = /https?:\/\/([a-z0-9.-]+\.[a-z]{2,})\/[^\s"'<>()\\`]+?\.(jpe?g|png|gif|webp|avif|svg|mp4|webm|mov|mp3|m4a|wav|vtt|woff2?|ttf|otf)\b/gi;
  const domains = new Set();
  for (const text of texts) {
    let m;
    while ((m = re.exec(text)) !== null) {
      const host = m[1].toLowerCase();
      // Our own services (analytics.har.pn etc.) aren't media to re-host.
      if (!ours.test(host) && !/(^|\.)har\.pn$/.test(host)) domains.add(host);
    }
  }
  return [...domains].sort();
}

// ── Rewriting ─────────────────────────────────────────────────────

function relLink(fromDir, local) {
  const rel = path.posix.relative(fromDir || '.', local) || path.posix.basename(local);
  return rel.split('/').map((seg) => (seg === '..' ? seg : encodeURIComponent(seg))).join('/');
}

/**
 * Rewrite one file's text. `bundled` is the Set of local paths that were
 * downloaded; URLs whose file failed keep pointing at us.
 */
function rewriteText(text, fileRelDir, bundled, hosts, sequenceMap) {
  const re = urlRegex(hosts);
  let out = text.replace(re, (full, host, rawPath) => {
    const parsed = parseMatch(full, host, rawPath);
    if (!parsed || !bundled.has(parsed.local)) return full;
    // Keep any trailing punctuation that the URL regex swallowed.
    const tail = rawPath.slice(parsed.trimmed.length);
    return relLink(fileRelDir, parsed.local) + tail;
  });
  if (sequenceMap && sequenceMap.size) {
    out = out.replace(/data-base-url="([^"]*)"/g, (full, val) => {
      const local = sequenceMap.get(unescHtml(val));
      return local ? `data-base-url="${relLink(fileRelDir, local.replace(/\/$/, ''))}/"` : full;
    });
  }
  return out;
}

// ── Downloading ───────────────────────────────────────────────────

async function runPool(items, limit, worker) {
  let next = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      await worker(items[i], i);
    }
  });
  await Promise.all(runners);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function downloadOne(url, dest, { retries = 3, timeoutMs = 10 * 60 * 1000, fetchImpl = fetch } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt) await sleep(500 * 2 ** (attempt - 1));
    const tmp = dest + '.part';
    try {
      const res = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs), redirect: 'follow' });
      if (!res.ok) {
        lastErr = new Error(`HTTP ${res.status}`);
        // A missing or forbidden file won't appear on retry.
        if (res.status === 403 || res.status === 404) break;
        continue;
      }
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      await pipeline(Readable.fromWeb(res.body), fs.createWriteStream(tmp));
      fs.renameSync(tmp, dest);
      return fs.statSync(dest).size;
    } catch (e) {
      lastErr = e;
      fs.rmSync(tmp, { force: true });
    }
  }
  throw lastErr || new Error('download failed');
}

const TEXT_EXT = new Set(['.html', '.htm', '.css', '.js', '.mjs', '.json', '.webmanifest', '.svg', '.xml', '.txt']);

function listTextFiles(root) {
  const out = [];
  const walk = (dir) => {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, ent.name);
      if (ent.isDirectory()) { if (path.relative(root, p) !== 'assets') walk(p); }
      else if (TEXT_EXT.has(path.extname(ent.name).toLowerCase())) out.push(p);
    }
  };
  walk(root);
  return out;
}

/**
 * Download every file of ours that a rendered export uses into dir/assets/
 * and rewrite all references to relative paths.
 *
 * Returns { files, bytes, failed: [{ url, error }], external: [domains] }.
 */
async function bundleMedia(dir, { hosts = ourHosts(), concurrency = 6, onProgress, fetchImpl } = {}) {
  const textFiles = listTextFiles(dir);
  const texts = new Map(textFiles.map((f) => [f, fs.readFileSync(f, 'utf8')]));

  const media = findStoryMedia(texts.values(), hosts);
  const sequenceMap = new Map(); // base url → local folder
  for (const [f, text] of texts) {
    if (!/\.html?$/i.test(f)) continue;
    for (const seq of findSequencesInHtml(text, hosts)) {
      const { localBase, files } = sequenceFiles(seq);
      if (!localBase) continue;
      sequenceMap.set(seq.baseUrl, localBase);
      for (const sf of files) if (!media.has(sf.local)) media.set(sf.local, sf.url);
    }
  }

  const jobs = [...media.entries()];
  const bundled = new Set();
  const failed = [];
  const failedSeqFolders = new Set();
  let bytes = 0;
  let done = 0;

  await runPool(jobs, concurrency, async ([local, url]) => {
    try {
      bytes += await downloadOne(url, path.join(dir, local), { fetchImpl });
      bundled.add(local);
    } catch (e) {
      failed.push({ url, error: e.message });
      failedSeqFolders.add(path.posix.dirname(local) + '/');
    }
    done++;
    if (onProgress) onProgress({ done, total: jobs.length, bytes });
  });

  // A sequence with any missing frame stays on our servers rather than half-working.
  for (const [base, localBase] of sequenceMap) {
    if (failedSeqFolders.has(localBase)) sequenceMap.delete(base);
  }

  for (const [f, text] of texts) {
    const relDir = path.relative(dir, path.dirname(f)).split(path.sep).join('/') || '.';
    const next = rewriteText(text, relDir, bundled, hosts, sequenceMap);
    if (next !== text) fs.writeFileSync(f, next, 'utf8');
  }

  return {
    files: bundled.size,
    bytes,
    failed: failed.sort((a, b) => a.url.localeCompare(b.url)),
    external: findExternalMedia([...texts.values()], hosts),
  };
}

// ── Estimating (before export) ────────────────────────────────────

/** How much the story's media weighs, from its content alone (HEAD requests). */
async function estimateMedia(content, { hosts = ourHosts(), concurrency = 8, fetchImpl = fetch } = {}) {
  const media = findStoryMedia([JSON.stringify(content)], hosts);
  // Frame sequences can be thousands of files: size the first frame and
  // multiply, rather than asking for every one.
  const jobs = [...media.values()].map((url) => ({ url, times: 1 }));
  let files = jobs.length;
  for (const seq of sequencesFromContent(content, hosts)) {
    const { files: frames } = sequenceFiles(seq);
    if (!frames.length) continue;
    jobs.push({ url: frames[0].url, times: frames.length });
    files += frames.length;
  }
  let bytes = 0;
  let unknown = 0;
  await runPool(jobs, concurrency, async ({ url, times }) => {
    try {
      const res = await fetchImpl(url, { method: 'HEAD', signal: AbortSignal.timeout(15000) });
      const len = res.ok ? parseInt(res.headers.get('content-length'), 10) : NaN;
      if (Number.isFinite(len)) bytes += len * times;
      else unknown += times;
    } catch {
      unknown += times;
    }
  });
  return { files, bytes, unknown };
}

function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}

module.exports = {
  ourHosts,
  findStoryMedia,
  findExternalMedia,
  findSequencesInHtml,
  sequenceFiles,
  rewriteText,
  bundleMedia,
  estimateMedia,
  formatBytes,
};
