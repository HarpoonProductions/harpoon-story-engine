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

let files;
try {
  files = render(content, outputDir, { basePath: '' });
} catch (err) {
  console.error(`  ✗ Render threw: ${err.message}`);
  console.error(err.stack);
  process.exit(1);
}
assert('Rendered exactly one file (no print/PDF tracks for this kind)', files.length === 1);

const html = fs.readFileSync(files[0], 'utf8');

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

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
