'use strict';

/**
 * Harpoon Story Engine — Test Suite
 * 
 * Renders all example JSON files and runs assertions against the output.
 * Usage: node test.js
 */

const fs   = require('fs');
const path = require('path');
const { validate } = require('./renderer/validate');
const { render }   = require('./renderer/index');

// ── Utilities ─────────────────────────────────────────────────────

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

// ── Load example files ────────────────────────────────────────────

const examples = [
  { name: 'Opera',   file: 'examples/opera-example.json' },
  { name: 'Cricket', file: 'examples/cricket-example.json' },
];

// ── Run tests ─────────────────────────────────────────────────────

const outputBase = path.join(__dirname, 'output', 'test');
let allPassed = true;

for (const example of examples) {
  console.log(`\n── ${example.name} ──────────────────────────────────────`);

  // Load JSON
  const contentPath = path.join(__dirname, example.file);
  let content;
  try {
    content = JSON.parse(fs.readFileSync(contentPath, 'utf8'));
  } catch (err) {
    console.error(`  ✗ Failed to parse ${example.file}: ${err.message}`);
    failed++;
    continue;
  }

  // Schema validation
  const errors = validate(content);
  assert('Schema validation passes', errors.length === 0);
  if (errors.length > 0) {
    errors.forEach(e => console.error(`    ${e.instancePath} — ${e.message}`));
    continue;
  }

  // Render
  const outDir = path.join(outputBase, content.meta.project_id);
  fs.mkdirSync(outDir, { recursive: true });
  let files;
  try {
    files = render(content, outDir);
    assert('Render completes without error', true);
  } catch (err) {
    console.error(`  ✗ Render error: ${err.message}`);
    failed++;
    continue;
  }

  // Read rendered HTML
  const html = fs.readFileSync(path.join(outDir, 'index.html'), 'utf8');

  // ── Shell assertions ────────────────────────────────────────────
  assertContains('Has DOCTYPE',              html, '<!DOCTYPE html>');
  assertContains('Has correct lang',         html, `lang="${content.meta.language}"`);
  assertContains('Has page title',           html, `<title>${content.meta.title}`);
  assertContains('Has accent color token',   html, `--hse-accent:   ${content.meta.accent_color}`);
  assertContains('Has nav element',          html, 'id="hse-nav"');
  assertContains('Has progress bar',         html, 'id="hse-progress"');
  assertContains('Has GSAP',                 html, 'gsap.min.js');
  assertContains('Has ScrollTrigger',        html, 'ScrollTrigger.min.js');

  // ── Cover assertions ────────────────────────────────────────────
  assertContains('Has cover section',        html, 'id="hse-cover"');
  assertContains('Has cover headline',       html, content.cover.headline);
  if (content.cover.hero_video) {
    assertContains('Has video cover',        html, 'hse-cover__bg-video');
    assertContains('Video src present',      html, content.cover.hero_video.url);
  }
  if (content.cover.hero_image) {
    assertContains('Has image cover',        html, 'hse-cover__bg-img');
  }
  if (content.cover.cta_primary) {
    assertContains('Has primary CTA',        html, content.cover.cta_primary.label);
  }

  // ── Nav assertions ──────────────────────────────────────────────
  const navSections = content.sections.filter(s => !s.nav_exclude);
  navSections.forEach(s => {
    assertContains(`Nav link: ${s.id}`, html, `href="#${s.id}"`);
  });

  // ── Section assertions ──────────────────────────────────────────
  content.sections.forEach(s => {
    assertContains(`Section rendered: ${s.id}`, html, `id="${s.id}"`);
    assertContains(`Section has layout attr: ${s.id}`, html, `data-layout="${s.layout || 'default'}"`);
  });

  // ── Layout-specific assertions ──────────────────────────────────
  const layouts = [...new Set(content.sections.map(s => s.layout || 'default'))];

  if (layouts.includes('sticky-steps')) {
    assertContains('Sticky steps rendered',  html, 'hse-section--sticky-steps');
    assertContains('Sticky visual present',  html, 'hse-ss__visual');
    assertContains('Step items present',     html, 'hse-ss__step');
  }
  if (layouts.includes('fullbleed-quote')) {
    assertContains('Fullbleed quote rendered', html, 'hse-section--fullbleed-quote');
    assertContains('FBQ quote text present',   html, 'hse-fbq__text');
  }
  if (layouts.includes('reveal-crossfade')) {
    assertContains('Crossfade rendered',     html, 'hse-section--reveal-crossfade');
    assertCount('Two crossfade phases',      html, 'hse-cf__phase"', 2);
    assertCount('Two crossfade images',      html, 'hse-cf__image--', 2);
  }
  if (layouts.includes('stackable-cards')) {
    assertContains('Stackable cards rendered', html, 'hse-section--stackable-cards');
    assertContains('Card grid present',        html, 'hse-sc__grid');
  }

  // ── Block-specific assertions ───────────────────────────────────
  const hasPullQuote    = content.sections.some(s => s.pull_quote);
  const hasStatBlock    = content.sections.some(s => s.stat_block);
  const hasPhotoCluster = content.sections.some(s => s.photo_clusters && s.photo_clusters.length > 0);
  const hasToggle       = content.sections.some(s => s.toggle_panels && s.toggle_panels.length > 0);
  const hasAccordion    = content.sections.some(s => s.accordion_items && s.accordion_items.length > 0);
  const hasContributors = content.sections.some(s => s.contributors && s.contributors.length > 0);
  const hasBriefing     = content.sections.some(s => s.briefing_engine);

  if (hasPullQuote)    assertContains('Pull quote rendered',    html, 'hse-pull-quote');
  if (hasStatBlock)    assertContains('Stat block rendered',    html, 'hse-stat-block');
  if (hasPhotoCluster) assertContains('Photo cluster rendered', html, 'hse-photo-cluster');
  if (hasToggle)       assertContains('Toggle panels rendered', html, 'hse-toggle__btn');
  if (hasAccordion)    assertContains('Accordion rendered',     html, 'hse-accordion__item');
  if (hasContributors) assertContains('Contributors rendered',  html, 'hse-contributor');
  if (hasBriefing)     assertContains('Briefing engine rendered', html, 'hse-briefing-engine');

  // ── Safety assertions ───────────────────────────────────────────
  assertAbsent('No renderer stubs remaining', html, 'renderer pending');
  assertAbsent('No raw template vars',        html, '${');
  assertAbsent('No undefined values',         html, '>undefined<');
}

// ── Summary ───────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(52)}`);
console.log(`  ${passed} passed  ·  ${failed} failed  ·  ${passed + failed} total`);
console.log(`${'─'.repeat(52)}\n`);

if (failed > 0) {
  process.exit(1);
}
