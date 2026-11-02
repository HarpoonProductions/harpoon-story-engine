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
const { hasReader } = require('./renderer/readable');
const { renderPrint } = require('./renderer/print-renderer');
const { renderPdf }   = require('./renderer/pdf-renderer');
const { buildAudioScript } = require('./renderer/audio-script');

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

(async () => {

// ── Timeline marker and line ─────────────────────────────────────
console.log('\n── Timeline marker and line ──────────────────────────');
{
  const { renderTimeline } = require('./renderer/layouts/timeline');
  const entries = [{ date: '1987', heading: 'One' }];

  const plain = renderTimeline({ id: 'tl', timeline_entries: entries });
  assertContains('Defaults to a dot marker', plain, 'data-marker="dot"');
  assert('No inline style without settings', !/<section[^>]*style=/.test(plain));

  const styled = renderTimeline({ id: 'tl', timeline_entries: entries, timeline_marker: 'triangle',
    timeline_marker_size: 22, timeline_marker_color: '#ffcc00', timeline_line_color: 'rgb(255, 255, 255)', timeline_line_width: 99 });
  assertContains('Triangle marker', styled, 'data-marker="triangle"');
  assertContains('Marker size as px', styled, '--tl-marker-size:22px');
  assertContains('Marker colour', styled, '--tl-marker-color:#ffcc00');
  assertContains('Line colour at full strength', styled, '--tl-line-opacity:1');
  assertContains('Line thickness clamped to 16px', styled, '--tl-line-width:16px');

  const icon = renderTimeline({ id: 'tl', timeline_entries: entries, timeline_marker: 'icon', timeline_marker_icon: 'https://example.com/i.svg' });
  assertContains('Icon marker image', icon, '<img src="https://example.com/i.svg" alt="">');
  const noIcon = renderTimeline({ id: 'tl', timeline_entries: entries, timeline_marker: 'icon' });
  assertContains('Icon without a URL falls back to a dot', noIcon, 'data-marker="dot"');

  const hostile = renderTimeline({ id: 'tl', timeline_entries: entries, timeline_line_color: 'red;background:url(x)' });
  assert('Unsafe colour value is dropped', !hostile.includes('background:url'));
}

// ── Print, PDF and audio coverage ────────────────────────────────
// Every layout must say what it contains in words (renderer/readable.js),
// or its text silently disappears from the print page, PDF and narration.
console.log('\n── Print, PDF and audio coverage ─────────────────────');
{
  const schema = JSON.parse(fs.readFileSync(path.join(__dirname, 'schema/content.schema.json'), 'utf8'));
  const schemaLayouts = schema.definitions.section.properties.layout.enum;
  const indexSrc = fs.readFileSync(path.join(__dirname, 'renderer/index.js'), 'utf8');
  const switchSrc = indexSrc.slice(indexSrc.indexOf('function renderSectionHtml'));
  const rendererLayouts = [...switchSrc.slice(0, switchSrc.indexOf('default:')).matchAll(/case\s+["']([^"']+)["']/g)]
    .map(m => m[1]);
  for (const layout of new Set([...schemaLayouts, ...rendererLayouts])) {
    assert(`Layout "${layout}" has a reader in renderer/readable.js`, hasReader(layout));
  }
  // A layout the renderer knows but the schema doesn't fails validation,
  // so the editor preview and every deploy of that story break.
  for (const layout of rendererLayouts) {
    assert(`Layout "${layout}" is allowed by the schema`, schemaLayouts.includes(layout));
  }

  const sample = {
    meta: { title: 'Coverage', project_id: 'coverage-test' },
    sections: [
      { id: 'a', layout: 'default', title: 'Flagged', hero_image: { url: 'https://example.com/keep.jpg', alt: 'Kept', print_include: true },
        interstitial_image: { url: 'https://example.com/drop.jpg' }, pull_quote: { text: 'Repeated quote' } },
      { id: 'b', layout: 'timeline', title: 'History', timeline_entries: [{ date: '1987', heading: 'Founded', body: 'Timeline body text' }] },
      { id: 'c', layout: 'reveal-crossfade', crossfade_phases: [{ text: 'Crossfade phase text' }] },
    ],
  };
  const printHtml = renderPrint(sample);
  const pdfHtml   = renderPdf(sample);
  const ssml      = buildAudioScript(sample);
  assertContains('Print includes ticked image',   printHtml, 'keep.jpg');
  assertAbsent('Print omits unticked image',      printHtml, 'drop.jpg');
  assertContains('PDF includes ticked image',     pdfHtml,   'keep.jpg');
  assertAbsent('PDF omits unticked image',        pdfHtml,   'drop.jpg');
  assertContains('Print includes timeline text',  printHtml, 'Timeline body text');
  assertContains('PDF includes timeline text',    pdfHtml,   'Timeline body text');
  assertContains('Audio includes timeline text',  ssml,      'Timeline body text');
  assertContains('PDF includes crossfade text',   pdfHtml,   'Crossfade phase text');
  assertContains('Audio includes crossfade text', ssml,      'Crossfade phase text');
  assertAbsent('Audio skips repeated pull quote', ssml,      'Repeated quote');
}
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
    files = await render(content, outDir);
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

// ── Custom CSS layers: theme -> story -> section ─────────────────
{
  console.log('\n── Custom CSS layers ──────────────────────────────────');
  const base = (meta) => ({
    meta: { title: 'CSS', project_id: 'css-test', ...meta },
    cover: { headline: 'CSS' },
    sections: [{ id: 'intro', layout: 'default', title: 'Intro', custom_css: '.hse-section-intro { color: red; }' }],
  });
  const renderHtml = async (content, name) => {
    const dir = path.join(outputBase, name);
    fs.mkdirSync(dir, { recursive: true });
    await render(content, dir);
    return fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
  };

  const legacy = await renderHtml(base({}), 'css-legacy');
  assertContains('Older story keeps page-wide section CSS', legacy, '<style data-section-override="intro">\n.hse-section-intro { color: red; }\n</style>');
  assertAbsent('Older story gets no @scope', legacy, '@scope');
  assertAbsent('No story CSS block when empty', legacy, 'data-story-css');

  const scoped = await renderHtml(base({ scope_section_css: true, custom_css: 'body { --x: 1; } </style><script>' }), 'css-scoped');
  assertContains('New story scopes section CSS', scoped, '@scope (#intro) {\n.hse-section-intro { color: red; }\n}');
  assertContains('Story CSS rendered', scoped, '<style data-story-css>\nbody { --x: 1; }');
  assertAbsent('Story CSS cannot close its <style> tag', scoped, '</style><script>');
  const head = scoped.slice(0, scoped.indexOf('</head>'));
  assert('Story CSS comes after the token set', head.lastIndexOf('data-story-css') > head.indexOf('css/base.css'));
  assert('Section CSS comes after story CSS', scoped.indexOf('data-section-override') > scoped.indexOf('data-story-css'));
  const selfScoped = await renderHtml({ ...base({ scope_section_css: true }), sections: [{ id: 'intro', layout: 'default', title: 'Intro', custom_css: '#intro .x { color: red; } #intro-2 .y {}' }] }, 'css-self');
  assertContains('Old-style #section selectors become :scope', selfScoped, ':scope .x { color: red; } #intro-2 .y {}');
  assert('Story CSS fields pass the schema', validate(base({ scope_section_css: true, custom_css: 'a{}' })).length === 0);
}

// ── Frozen engine versions (engine-pin.js) ──────────────────────
// A story frozen to an engine commit is built from a copy of the repo at
// that commit. Check the switch reads the freeze safely, and that a copy
// of this very commit renders a story exactly like the live code does.
console.log('\nFrozen engine versions');
{
  const enginePin = require('./engine-pin');
  const { execFileSync } = require('child_process');
  assert('No freeze: follows the latest engine', enginePin.pinnedCommit({ meta: {} }) === null);
  assert('Freeze with a bad commit id is ignored', enginePin.pinnedCommit({ meta: { engine_freeze: { commit: 'main; rm -rf /' } } }) === null);
  assert('Freeze commit id is read', enginePin.pinnedCommit({ meta: { engine_freeze: { commit: 'ABCDEF1' } } }) === 'abcdef1');

  const head = enginePin.currentEngine();
  if (!head) {
    console.log('  – git history not available, skipping the frozen render check');
  } else {
    const exported = enginePin.suggestFreeze({ meta: { last_exported_at: head.date } });
    assert('Freeze suggestion follows a client-site export', exported && exported.basis === 'last-exported');
    const os = require('os');
    const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), 'hse-engine-test-'));
    try {
      const example = JSON.parse(fs.readFileSync(path.join(__dirname, 'examples/opera-example.json'), 'utf8'));
      const frozen = { ...example, meta: { ...example.meta, engine_freeze: { commit: head.commit, engine_date: head.date } } };
      assert('Current schema accepts a frozen story', validate(frozen).length === 0);

      const engine = enginePin.loadEngine(head.commit, { baseDir: tmpBase });
      assert('Frozen engine is its own copy of the code', engine.dir !== __dirname && fs.existsSync(path.join(engine.dir, 'renderer/index.js')));
      assert('Frozen engine accepts the frozen story', engine.validate(frozen).length === 0);

      const frozenOut = path.join(tmpBase, 'out-frozen');
      const liveOut = path.join(tmpBase, 'out-live');
      await engine.render(frozen, frozenOut, { basePath: '' });
      await render(frozen, liveOut, { basePath: '' });
      assert('Frozen engine copies its own CSS', fs.existsSync(path.join(frozenOut, 'css')));

      // Only comparable when the engine code here is exactly that commit
      const dirty = execFileSync('git', ['-C', __dirname, 'status', '--porcelain', '--', 'renderer', 'css', 'js', 'tokens'], { encoding: 'utf8' }).trim();
      if (dirty) {
        console.log('  – engine files have uncommitted changes, skipping the identical-output check');
      } else {
        const a = fs.readFileSync(path.join(frozenOut, 'index.html'), 'utf8');
        const b = fs.readFileSync(path.join(liveOut, 'index.html'), 'utf8');
        assert('Frozen copy of this commit renders identically', a === b);
      }
    } finally {
      fs.rmSync(tmpBase, { recursive: true, force: true });
    }
  }
}

})().then(() => {
  // ── Summary ─────────────────────────────────────────────────────
  console.log(`\n${'─'.repeat(52)}`);
  console.log(`  ${passed} passed  ·  ${failed} failed  ·  ${passed + failed} total`);
  console.log(`${'─'.repeat(52)}\n`);

  if (failed > 0) {
    process.exit(1);
  }
});
