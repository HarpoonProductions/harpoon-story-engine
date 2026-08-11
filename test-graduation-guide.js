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
assert('Rendered index.html + manifest.json + sw.js + ios-install-banner.js + 2 icons (PWA enabled)', files.length === 6);

const html = fs.readFileSync(files.find((f) => f.endsWith('index.html')), 'utf8');

assertContains('Title includes guide + institution name', html, `${content.guide.title} | ${content.institution.name}`);
assertContains('Plausible script uses the correct domain', html, 'analytics.har.pn/js/script.js');
assertContains('Chooser tiles present', html, 'gg-chooser-tile');
assertCount('One chooser tile per ceremony', html, 'class="gg-chooser-tile(?:"| )', content.ceremonies.length);
assertCount('One ceremony section per ceremony', html, 'class="gg-ceremony', content.ceremonies.length);
// No ceremony is pre-selected server-side any more — real feedback: a
// default-active ceremony on a plain visit read as broken, not helpful.
// The runtime JS only activates one when a deep link / share link says so.
assert('No ceremony is marked active by default', !html.includes('gg-ceremony active') && !html.includes('gg-chooser-tile active'));
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
assertContains('iOS install banner script linked', html, 'ios-install-banner.js');

const runtimeJs = fs.readFileSync(path.join(__dirname, 'js', 'graduation-guide-runtime.js'), 'utf8');
assertContains('Personalised hero calls the iOS install banner', runtimeJs, 'maybeShowIOSInstallBanner');
assertContains('iOS banner call is guarded (no-ops if HarpoonPWA absent)', runtimeJs, 'window.HarpoonPWA');

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
assertContains('Service worker precaches the iOS install banner', swJs, 'ios-install-banner.js');

const bannerPath = path.join(outDir, 'ios-install-banner.js');
assert('ios-install-banner.js was written to the output dir', fs.existsSync(bannerPath));
if (fs.existsSync(bannerPath)) {
  const bannerJs = fs.readFileSync(bannerPath, 'utf8');
  assertContains('Banner exposes HarpoonPWA.maybeShowIOSInstallBanner', bannerJs, 'maybeShowIOSInstallBanner');
  assertContains('Banner checks navigator.standalone (skip if already installed)', bannerJs, 'navigator.standalone');
}

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

// ── Homepage media (hero video, signer/dean/awardee photos, background
// images, ceremony recordings) — all optional, absent from imperial-2026's
// real content today (no real assets exist yet). Rendered here against a
// cloned content object with synthetic test values, not the real project
// data, so this proves the new render branches work without fabricating
// photos of real named people or committing placeholder media as if it
// were real Imperial content. See project memory
// "hse-graduation-guide-media".
console.log('\n── Homepage media (synthetic fixture) ──────────────────────');

const mediaContent = JSON.parse(JSON.stringify(content));
// Tests the legacy two-column welcome+image layout specifically, so this
// must stay off regardless of imperial-2026's own current config.scrollHero
// setting (production has it on — see the dedicated scroll-hero fixture
// below for that path instead).
mediaContent.config = mediaContent.config || {};
mediaContent.config.scrollHero = { enabled: false };
mediaContent.guide.heroVideo = { url: 'videos/hero-test.mp4', poster: 'photos/hero-poster-test.jpg' };
mediaContent.guide.welcomeImage = { url: 'photos/welcome-test.jpg', alt: 'Test welcome image' };
mediaContent.guide.welcomeSigners[0].photo = 'photos/signer-test.jpg';
// Absolute URL, deliberately not a relative photos/ path — proves
// resolveMediaUrl() passes it through untouched instead of mangling it
// with the basePath prefix asset() would otherwise add (the editor's
// Guide tab UI is a plain URL input, so this is the realistic case).
mediaContent.guide.venuePhoto = { url: 'https://cdn.example.com/venue-test.jpg', alt: 'Test venue photo' };
mediaContent.guide.aboutTheDay = mediaContent.guide.aboutTheDay || {};
mediaContent.guide.aboutTheDay.backgroundImage = { url: 'photos/about-test.jpg', alt: 'Test about background' };
mediaContent.ceremonies[0].dean = mediaContent.ceremonies[0].dean || {};
mediaContent.ceremonies[0].dean.photo = 'photos/dean-test.jpg';
mediaContent.ceremonies[0].recordingUrl = 'https://www.youtube.com/watch?v=abcDEFghi12';
mediaContent.ceremonies[0].awardees = [
  { medal: 'Test Medal', name: 'Test Awardee', desc: 'Synthetic fixture entry, not real data.', photo: 'photos/awardee-test.jpg' },
];

const mediaOutDir = path.join(__dirname, 'output', 'test', 'imperial-2026-media');
let mediaFiles;
try {
  mediaFiles = await render(mediaContent, mediaOutDir, { basePath: '' });
} catch (err) {
  console.error(`  ✗ Media-fixture render threw: ${err.message}`);
  console.error(err.stack);
  process.exit(1);
}
const mediaHtml = fs.readFileSync(mediaFiles.find((f) => f.endsWith('index.html')), 'utf8');

assertContains('Hero video renders with resolved source', mediaHtml, '<source src="videos/hero-test.mp4" type="video/mp4">');
assertContains('Hero video uses the resolved poster', mediaHtml, 'poster="photos/hero-poster-test.jpg"');
assertContains('Welcome section image renders', mediaHtml, 'src="photos/welcome-test.jpg"');
assertContains('Signer photo renders in place of the placeholder icon', mediaHtml, 'src="photos/signer-test.jpg"');
assertContains('Venue photo (absolute URL) renders', mediaHtml, 'src="https://cdn.example.com/venue-test.jpg"');

// A non-empty basePath is where this actually matters — the local-preview
// render above uses basePath:'' (asset() is a no-op there regardless), so
// it wouldn't have caught asset() wrongly prefixing an absolute URL. This
// mirrors a real production render (node render.js ... --base imperial-2026).
const mediaBaseOutDir = path.join(__dirname, 'output', 'test', 'imperial-2026-media-base');
const mediaBaseFiles = await render(mediaContent, mediaBaseOutDir, { basePath: 'imperial-2026' });
const mediaBaseHtml = fs.readFileSync(mediaBaseFiles.find((f) => f.endsWith('index.html')), 'utf8');
assertContains('With a real basePath, a relative photo path is still prefixed', mediaBaseHtml, 'src="/imperial-2026/photos/signer-test.jpg"');
assertContains('With a real basePath, an absolute venue photo URL is untouched', mediaBaseHtml, 'src="https://cdn.example.com/venue-test.jpg"');
assertAbsent('Absolute venue photo URL is never prefixed with the basePath', mediaBaseHtml, 'src="/imperial-2026/https');
assertContains('About-section background image renders', mediaHtml, 'src="photos/about-test.jpg"');
assertContains('Dean photo renders in place of the placeholder icon', mediaHtml, 'src="photos/dean-test.jpg"');
assertContains('Awardee photo renders in place of the placeholder icon', mediaHtml, 'src="photos/awardee-test.jpg"');
assertContains('Ceremony recording renders as a YouTube embed', mediaHtml, 'https://www.youtube.com/embed/abcDEFghi12');
assertContains('Ceremony recording section has a heading', mediaHtml, 'Ceremony recording');

// Fallback check — the *first* (real, untouched) render above had none of
// these fields set, so it should still show every placeholder unchanged.
assertContains('No-photo fallback: signer placeholder icon unchanged', html, '&#128100;');
assertContains('No-photo fallback: dean placeholder icon unchanged', html, '&#128100;');
assertAbsent('No-recording fallback: no recording section rendered', html, 'gg-recording');

// Explicit fixture with scrollHero off — confirms the opt-in flag actually
// gates everything: no GSAP payload, no pinned markup, for every project
// that hasn't turned this on. Deliberately its own clone rather than the
// shared `html` above: imperial-2026 itself has scrollHero.enabled:true in
// production now, so this can't lean on that fixture "happening" to be off.
const scrollHeroOffContent = JSON.parse(JSON.stringify(content));
scrollHeroOffContent.config = scrollHeroOffContent.config || {};
scrollHeroOffContent.config.scrollHero = { enabled: false };
const scrollHeroOffOutDir = path.join(__dirname, 'output', 'test', 'imperial-2026-scroll-hero-off');
const scrollHeroOffFiles = await render(scrollHeroOffContent, scrollHeroOffOutDir, { basePath: '' });
const scrollHeroOffHtml = fs.readFileSync(scrollHeroOffFiles.find((f) => f.endsWith('index.html')), 'utf8');

assertAbsent('scrollHero off by default: no GSAP script tag', scrollHeroOffHtml, 'gsap.min.js');
assertAbsent('scrollHero off by default: no ScrollTrigger script tag', scrollHeroOffHtml, 'ScrollTrigger.min.js');
assertAbsent('scrollHero off by default: no pinned hero markup', scrollHeroOffHtml, 'id="scroll-hero"');
assertContains('scrollHero off by default: static hero still renders', scrollHeroOffHtml, 'class="gg-hero" id="hero"');

// ── Scroll hero (config.scrollHero.enabled) ─────────────────────────
console.log('\n── Scroll hero (synthetic fixture) ─────────────────────────');

const scrollHeroContent = JSON.parse(JSON.stringify(content));
scrollHeroContent.config = scrollHeroContent.config || {};
scrollHeroContent.config.scrollHero = { enabled: true };
scrollHeroContent.guide.heroVideo = { url: 'videos/hero-test.mp4' };

const scrollHeroOutDir = path.join(__dirname, 'output', 'test', 'imperial-2026-scroll-hero');
const scrollHeroFiles = await render(scrollHeroContent, scrollHeroOutDir, { basePath: '' });
const scrollHeroHtml = fs.readFileSync(scrollHeroFiles.find((f) => f.endsWith('index.html')), 'utf8');

assertContains('GSAP script tag present when enabled', scrollHeroHtml, 'js/vendor/gsap.min.js');
assertContains('ScrollTrigger script tag present when enabled', scrollHeroHtml, 'js/vendor/ScrollTrigger.min.js');
assertContains('Pinned hero wrapper renders', scrollHeroHtml, 'id="scroll-hero"');
assertContains('Sticky video/panel layer renders', scrollHeroHtml, 'gg-scroll-hero-sticky');
assertContains('Wipe panel renders', scrollHeroHtml, 'id="scroll-wipe-panel"');
assertContains('Entrance block renders', scrollHeroHtml, 'id="scroll-hero-entrance"');
assertContains('Welcome scroll-trigger renders', scrollHeroHtml, 'id="scroll-welcome-trigger"');
assertContains('Welcome signers still render inside the pinned block', scrollHeroHtml, 'gg-signer-name');
assertAbsent('Static hero section not also rendered', scrollHeroHtml, 'class="gg-hero" id="hero"');
assertAbsent('Legacy two-column welcome section not also rendered', scrollHeroHtml, 'class="gg-welcome"');
assertContains('Hero video renders inside the pinned sticky layer', scrollHeroHtml, 'id="hero-video"');
assertContains('Pause button renders when a hero video is present', scrollHeroHtml, 'id="hero-pause-btn"');

// No video → no pause button, in *either* hero variant (nothing to pause).
const noVideoContent = JSON.parse(JSON.stringify(scrollHeroContent));
delete noVideoContent.guide.heroVideo;
const noVideoOutDir = path.join(__dirname, 'output', 'test', 'imperial-2026-scroll-hero-no-video');
const noVideoFiles = await render(noVideoContent, noVideoOutDir, { basePath: '' });
const noVideoHtml = fs.readFileSync(noVideoFiles.find((f) => f.endsWith('index.html')), 'utf8');
assertAbsent('No pause button when there is no hero video', noVideoHtml, 'gg-hero-pause');

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);

})();
