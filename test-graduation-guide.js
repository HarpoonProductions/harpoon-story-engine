'use strict';

/**
 * Harpoon Story Engine — Graduation Guide Test Suite
 *
 * Parallel to test.js, deliberately NOT wired into render-deploy.yml's
 * blocking CI gate yet (see docs/graduation-guide-integration.md) — run
 * manually with `node test-graduation-guide.js` until this render path
 * is stable enough to gate every other live project's deploy.
 */

const fs   = require('fs');
const path = require('path');
const { validate } = require('./renderer/validate');
const { render }   = require('./renderer/index');

let passed = 0;
let failed = 0;

function assert(label, condition) {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}`);
    failed++;
  }
}

function assertContains(label, html, needle) {
  assert(label, html.includes(needle));
}

function assertCount(label, html, needle, min) {
  const count = (html.match(new RegExp(needle, 'g')) || []).length;
  assert(`${label} (found ${count}, expected ≥${min})`, count >= min);
}

function assertAbsent(label, html, needle) {
  assert(label, !html.includes(needle));
}

const contentPath = path.join(__dirname, 'projects', 'imperial-2026', 'content.json');
const outputDir   = path.join(__dirname, 'output', 'test', 'imperial-2026');

console.log('\n── Imperial 2026 graduation guide ──────────────────────────');

let content;
try {
  content = JSON.parse(fs.readFileSync(contentPath, 'utf8'));
} catch (err) {
  console.error(`  ✗ Failed to parse ${contentPath}: ${err.message}`);
  process.exit(1);
}

const errors = validate(content);
assert('Schema valid', errors.length === 0);
if (errors.length) {
  errors.forEach((e) => console.error(`    ${e.instancePath || '(root)'} — ${e.message}`));
}

(async () => {

let files;
try {
  files = await render(content, outputDir, { basePath: '' });
} catch (err) {
  console.error(`  ✗ Render threw: ${err.message}`);
  console.error(err.stack);
  process.exit(1);
}
// No print/PDF tracks for this kind (narrative-only) — but PWA is
// enabled for this project, so expect index.html + manifest.json + sw.js
// + 2 generated icon PNGs.
assert('Rendered index.html + manifest.json + sw.js + 2 icons (PWA enabled)', files.length === 5);

const html = fs.readFileSync(files.find((f) => f.endsWith('index.html')), 'utf8');

assertContains('Title includes guide + institution name', html, `${content.guide.title} | ${content.institution.name}`);
assertContains('Plausible script uses the correct domain', html, 'analytics.har.pn/js/script.js');
assertContains('Chooser tiles present', html, 'gg-chooser-tile');
assertCount('One chooser tile per ceremony', html, 'class="gg-chooser-tile(?:"| )', content.ceremonies.length);
assertCount('One ceremony section per ceremony', html, 'class="gg-ceremony', content.ceremonies.length);
assertContains('Active ceremony is marked active', html, 'gg-ceremony active');
assertContains('Search-related DOM hooks present', html, 'id="nav-search-input"');
assertContains('Nav search results panel present', html, 'id="nav-search-panel"');
assertContains('Find-box search results panel present', html, 'id="find-search-panel"');
assertAbsent('Obsolete result pill removed', html, 'id="result-pill"');
assertContains('Personalised hero hook present', html, 'id="hero-congrats"');
assertContains('Find-in-honours-list link present and visible by default', html, 'id="hero-find-link"');
assertContains('Default find-link has a generic fallback label', html, 'a student&#39;s name');
assertContains('Default find-link points at the inline search box', html, 'href="#find-student"');
assertContains('Find-a-student section has the matching anchor id', html, 'id="find-student"');
assertContains('Runtime script linked', html, 'js/graduation-guide-runtime.js');
assertContains('Search module CSS linked', html, 'css/kinds/graduation-guide.css');
assertContains('Data embedded for offline use', html, 'window.GRADUATION_DATA');
assertContains('searchIndex embedded for offline search', html, '"searchIndex"');

const expectedStudents = content.ceremonies.reduce(
  (sum, c) => sum + c.courseGroups.reduce((s, g) => s + g.students.length, 0),
  0
);
assertCount('One student row per graduate', html, 'gg-student-name-row', expectedStudents);
assert('searchIndex has one entry per graduate', content.searchIndex.length === expectedStudents);

// ── PWA ──────────────────────────────────────────────────────────────

assertContains('Manifest link present in <head>', html, 'rel="manifest"');
assertContains('Service worker registration script present', html, "navigator.serviceWorker.register");

const outDir = path.dirname(files.find((f) => f.endsWith('index.html')));

let manifest;
try {
  manifest = JSON.parse(fs.readFileSync(path.join(outDir, 'manifest.json'), 'utf8'));
  assert('manifest.json is valid JSON', true);
} catch (err) {
  assert('manifest.json is valid JSON', false);
  manifest = {};
}
assert('Manifest name includes guide + institution', (manifest.name || '').includes(content.guide.title) && manifest.name.includes(content.institution.name));
assert('Manifest theme_color matches institution.primaryColor', manifest.theme_color === content.institution.primaryColor);
assert('Manifest background_color matches institution.lightBackground', manifest.background_color === content.institution.lightBackground);
assert('Manifest display is standalone', manifest.display === 'standalone');
assert('Manifest has a 192x192 icon', (manifest.icons || []).some((i) => i.sizes === '192x192'));
assert('Manifest has a 512x512 icon', (manifest.icons || []).some((i) => i.sizes === '512x512'));

const swPath = path.join(outDir, 'sw.js');
const swJs = fs.readFileSync(swPath, 'utf8');
assertAbsent('Service worker has no leftover template placeholders', swJs, '__CACHE_NAME__');
assertAbsent('Service worker has no leftover precache placeholder', swJs, '__PRECACHE_URLS__');
assertContains('Service worker precaches the page itself first', swJs, '"index.html"');
assertContains('Service worker precaches the manifest', swJs, '"manifest.json"');
assertContains('Service worker precaches the runtime JS', swJs, 'graduation-guide-runtime.js');

for (const size of ['192', '512']) {
  const iconPath = path.join(outDir, 'icons', `icon-${size}.png`);
  const exists = fs.existsSync(iconPath);
  assert(`icon-${size}.png was written`, exists);
  if (exists) {
    const buf = fs.readFileSync(iconPath);
    assert(`icon-${size}.png is a valid PNG (correct magic bytes)`, buf.slice(0, 8).toString('hex') === '89504e470d0a1a0a');
    const dims = buf.readUInt32BE(16) + 'x' + buf.readUInt32BE(20);
    assert(`icon-${size}.png is ${size}x${size}`, dims === `${size}x${size}`);
  }
}

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);

})();
