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

// ── Engine asset versions ────────────────────────────────────────
// Engine CSS/JS are cached for a day under fixed names; a content hash
// in the URL stops new HTML being paired with an old runtime.js.
console.log('\n── Engine asset versions ─────────────────────────────');
{
  const { renderHead } = require('./renderer/shell/head');
  const head = renderHead({ title: 'T', project_id: 'v' }, {}, 'T', 'staging/v', false);
  assert('runtime.js carries a content version', /src="\/staging\/v\/js\/runtime\.js\?v=[0-9a-f]{8}"/.test(head));
  assert('base.css carries a content version', /href="\/staging\/v\/css\/base\.css\?v=[0-9a-f]{8}"/.test(head));
}

// ── Timeline direction ───────────────────────────────────────────
console.log('\n── Timeline direction ────────────────────────────────');
{
  const { renderTimeline } = require('./renderer/layouts/timeline');
  const entries = [{ date: '1987', heading: 'One' }, { date: '1999', heading: 'Two' }];
  const vertical = renderTimeline({ id: 'tl', timeline_entries: entries });
  assert('Vertical by default, no horizontal markup', !vertical.includes('data-direction') && !vertical.includes('hse-tl__viewport') && !vertical.includes('--tl-count'));
  const h = renderTimeline({ id: 'tl', timeline_entries: entries, timeline_direction: 'horizontal', timeline_align: 'alternate' });
  assertContains('Horizontal flag', h, 'data-direction="horizontal"');
  assertContains('Horizontal viewport wraps the track', h, '<div class="hse-tl__viewport">');
  assertContains('Entry count drives the scroll length', h, '--tl-count:2');

  const st = renderTimeline({ id: 'tl', timeline_direction: 'stepped', timeline_entries: [{ heading: 'A' }, { heading: 'B' }, { heading: 'C', next: 'down' }, { heading: 'D', next: 'sideways' }, { heading: 'E', next: 'up' }, { heading: 'F', next: 'rise' }, { heading: 'G', next: 'fall' }] });
  assertContains('Stepped flag', st, 'data-direction="stepped"');
  assertContains('Stepped has the pinned viewport', st, '<div class="hse-tl__viewport">');
  assert('Stepped runs alternate by default, entry choice wins, bad value falls back',
    JSON.stringify([...st.matchAll(/data-run="(\w+)"/g)].map(m => m[1])) === '["across","down","down","down","up","rise","fall"]');
  assert('Only stepped entries carry a run', !h.includes('data-run'));
  const lf = renderTimeline({ id: 'tl', timeline_direction: 'stepped', timeline_entries: [{ heading: 'A', next: 'left' }, { heading: 'B', next: 'rise-left' }, { heading: 'C', next: 'fall-left' }] });
  assert('Leftward runs', JSON.stringify([...lf.matchAll(/data-run="([\w-]+)"/g)].map(m => m[1])) === '["left","rise-left","fall-left"]');
  assert('Stepped line position is opt-in', !st.includes('data-step-side'));
  const pole = renderTimeline({ id: 'tl', timeline_line_style: 'scaffold', timeline_entries: entries });
  assert('Scaffold line style', pole.includes('data-line-style="scaffold"') && pole.includes('data-marker="clamp"') && pole.includes('--tl-line-width:14px'));
  assert('Scaffold keeps a chosen marker', renderTimeline({ id: 'tl', timeline_line_style: 'scaffold', timeline_marker: 'triangle', timeline_entries: entries }).includes('data-marker="triangle"')
    && renderTimeline({ id: 'tl', timeline_line_style: 'scaffold', timeline_marker: 'dot', timeline_line_width: 6, timeline_entries: entries }).includes('--tl-line-width:6px'));
  assert('Plain line by default', !vertical.includes('data-line-style') && vertical.includes('data-marker="dot"'));
  const sw = renderTimeline({ id: 'tl', timeline_direction: 'stepped', timeline_entries: [{ heading: 'A', swap_side: true }, { heading: 'B' }] });
  assert('Per-entry side swap', (sw.match(/ data-swap/g) || []).length === 1);
  assert('Side swap only on stepped', !renderTimeline({ id: 'tl', timeline_entries: [{ heading: 'A', swap_side: true }] }).includes('data-swap'));
  const stEnd = renderTimeline({ id: 'tl', timeline_direction: 'stepped', timeline_step_side: 'end', timeline_entries: entries });
  assertContains('Stepped line position end', stEnd, 'data-step-side="end"');
  const stAlt = renderTimeline({ id: 'tl', timeline_direction: 'stepped', timeline_step_side: 'alternate', timeline_entries: entries });
  assertContains('Stepped line position alternate', stAlt, 'data-step-side="alternate"');
  assert('Line position only applies to stepped', !renderTimeline({ id: 'tl', timeline_direction: 'horizontal', timeline_step_side: 'end', timeline_entries: entries }).includes('data-step-side')
    && !renderTimeline({ id: 'tl', timeline_direction: 'stepped', timeline_step_side: 'middle', timeline_entries: entries }).includes('data-step-side'));
}

// ── Timeline extra images and chapter cards ──────────────────────
console.log('\n── Timeline extra images and chapter cards ───────────');
{
  const { renderTimeline } = require('./renderer/layouts/timeline');
  const single = renderTimeline({ id: 'tl', timeline_entries: [{ heading: 'A', image: { url: 'a.jpg' } }] });
  assert('One background keeps the plain layer', single.includes('data-type="image"') && !single.includes('hse-tl__slide') && !single.includes('data-slides'));

  const g = renderTimeline({ id: 'tl', timeline_entries: [{ heading: 'A', image: { url: 'a.jpg' },
    images: [{ url: 'b.jpg', caption: 'Second', focal: '20% 30%' }, { url: '' }, { url: 'c.jpg' }], images_transition: 'push' }] });
  assertContains('Gallery layer', g, 'data-type="gallery" data-transition="push" data-slides="3"');
  assert('A slide per image, blank URLs skipped', (g.match(/class="hse-tl__slide[ "]/g) || []).length === 3);
  assertContains('First slide shows first', g, 'class="hse-tl__slide is-current"');
  assertContains('Slide caption', g, '<span class="hse-tl__slide-caption">Second</span>');
  assertContains('Slide focal point', g, 'background-position:20% 30%');
  assertContains('Entry knows its stops', g, 'data-slides="3" style="--tl-slides:3">');
  assertContains('Phones get the extra images under the text', g, 'class="hse-tl__more"');
  const fade = renderTimeline({ id: 'tl', timeline_entries: [{ heading: 'A', images: [{ url: 'b.jpg' }], images_transition: 'wipe' }] });
  assertContains('Unknown transition fades', fade, 'data-transition="fade"');

  const c = renderTimeline({ id: 'tl', timeline_direction: 'stepped', timeline_entries: [{ date: '1979', heading: 'A' },
    { kind: 'interstitial', date: 'ignored', heading: 'The 1980s', body: 'A new decade', line: 'hide', image: { url: 'd.jpg' } }, { date: '1981', heading: 'B' }] });
  assertContains('Chapter card', c, 'hse-tl__entry--interstitial');
  assertContains('Chapter card can hide the line', c, 'data-kind="interstitial" data-line="hide"');
  assertContains('Chapter card title', c, '<h2 class="hse-tl__heading">The 1980s</h2>');
  const sub = renderTimeline({ id: 'tl', timeline_entries: [{ kind: 'interstitial', heading: 'The 1980s', subheading: 'A new decade' }, { heading: 'A', subheading: 'ignored on entries' }] });
  assertContains('Chapter card second heading', sub, '<p class="hse-tl__subheading">A new decade</p>');
  assert('Only chapter cards show a second heading', !sub.includes('ignored on entries'));
  const card = c.slice(c.indexOf('hse-tl__entry--interstitial'), c.indexOf('data-index="2"'));
  assert('Chapter card has no date or marker', !card.includes('hse-tl__marker') && !c.includes('ignored'));
  assert('Chapter card still has a run on stepped', /data-kind="interstitial"[^>]*data-run="down"/.test(c));
  assertContains('Chapter card has its own background layer', c, "background-image:url('d.jpg')");
}

// ── Timeline inline media and background blocks ──────────────────
console.log('\n── Timeline media and backgrounds ────────────────────');
{
  const { renderTimeline, blockBg } = require('./renderer/layouts/timeline');
  const one = (entry, extra) => renderTimeline({ id: 'tl', timeline_entries: [{ date: '1987', heading: 'H', body: 'B', ...entry }], ...extra });

  const plain = one({});
  assertContains('Heading and body sit in a text block', plain, '<div class="hse-tl__text">');
  assert('No background blocks by default', !plain.includes('has-bg') && !plain.includes('data-date-bg'));

  const img = one({ media: { type: 'image', url: 'https://example.com/a.jpg', alt: 'A', caption: 'Cap', position: 'left' } });
  assertContains('Inline image', img, '<img src="https://example.com/a.jpg" alt="A" loading="lazy">');
  assertContains('Wrapped media floats left', img, 'hse-tl__media--left');
  assertContains('Caption', img, '<figcaption>Cap</figcaption>');
  assert('Wrapped media sits between heading and body', img.indexOf('hse-tl__heading') < img.indexOf('hse-tl__media') && img.indexOf('hse-tl__media') < img.indexOf('hse-tl__body'));
  const below = one({ media: { type: 'image', url: 'x.jpg', position: 'below' } });
  assert('Media below comes after the body', below.indexOf('hse-tl__body') < below.indexOf('hse-tl__media'));
  const above = one({ media: { type: 'image', url: 'x.jpg', position: 'sideways' } });
  assert('Unknown position falls back to above', above.includes('hse-tl__media--above') && above.indexOf('hse-tl__media') < above.indexOf('hse-tl__heading'));
  assertContains('Inline video has controls', one({ media: { type: 'video', url: 'v.mp4' } }), '<video controls playsinline');
  assertContains('Embed code is used as given', one({ media: { type: 'embed', html: '<iframe src="https://player.vimeo.com/x"></iframe>' } }), '<div class="hse-tl__embed"><iframe src="https://player.vimeo.com/x"></iframe></div>');
  assertContains('Embed URL becomes a frame', one({ media: { type: 'embed', url: 'https://example.com/chart' } }), '<iframe src="https://example.com/chart"');
  assert('Media without a URL renders nothing', !one({ media: { type: 'image' } }).includes('hse-tl__media'));

  assert('Hex colour at 50% becomes rgba', blockBg({ color: '#ff0000', opacity: 50 }) === 'rgba(255,0,0,0.5)');
  assert('Short hex expands', blockBg({ color: '#fff', opacity: 25 }) === 'rgba(255,255,255,0.25)');
  assert('Full opacity keeps the colour', blockBg({ color: '#123456' }) === '#123456');
  assert('Named colour uses color-mix', blockBg({ color: 'navy', opacity: 40 }) === 'color-mix(in srgb, navy 40%, transparent)');
  assert('Zero opacity means no block', blockBg({ color: '#000', opacity: 0 }) === null);
  assert('Entry opacity overrides the section, colour inherited', blockBg({ color: '#000000', opacity: 80 }, { opacity: 30 }) === 'rgba(0,0,0,0.3)');
  assert('No colour means no block', blockBg({ opacity: 50 }) === null);
  assert('Unsafe background colour is dropped', blockBg({ color: 'red;x:url(y)' }) === null);

  const bg = one({ text_bg: { color: '#002244', opacity: 70 } }, { timeline_date_bg: { color: '#ffcc00' } });
  assertContains('Section date background', bg, '<span class="hse-tl__date has-bg" style="background:#ffcc00">');
  assertContains('Marker drops level with a date block', bg, 'data-date-bg');
  assertContains('Entry text background', bg, '<div class="hse-tl__text has-bg" style="background:rgba(0,34,68,0.7)">');
  const txt = one({ text_bg: { text_size: 'large' } }, { timeline_text_bg: { text_color: '#112233', text_size: 'small' }, timeline_date_bg: { text_color: 'navy' } });
  assertContains('Text colour and entry size on the text block', txt, '<div class="hse-tl__text" style="--tl-text-color:#112233;--tl-text-scale:1.2">');
  assertContains('Date text colour without a background', txt, '<span class="hse-tl__date" style="--tl-text-color:navy">');
  assert('Medium on an entry resets the section size', !one({ text_bg: { text_size: 'medium' } }, { timeline_text_bg: { text_size: 'large' } }).includes('--tl-text-scale'));
  const off = one({ date_bg: { opacity: 0 } }, { timeline_date_bg: { color: '#ffcc00' } });
  assert('An entry can switch the section block off', !off.includes('has-bg'));
}

// ── Print, PDF and audio coverage ────────────────────────────────
// Every layout must say what it contains in words (renderer/readable.js),
// or its text silently disappears from the print page, PDF and narration.
console.log('\n── Print, PDF and audio coverage ─────────────────────');
{
  const schema = JSON.parse(fs.readFileSync(path.join(__dirname, 'schema/content.schema.json'), 'utf8'));
  const schemaLayouts = schema.definitions.section.properties.layout.enum;
  const { LAYOUTS } = require('./renderer/layouts/registry');
  const rendererLayouts = Object.keys(LAYOUTS);
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
  sample.sections[1].timeline_entries.push({ heading: 'Inline', media: { type: 'image', url: 'https://example.com/inline.jpg' } });
  const printHtml = renderPrint(sample);
  const pdfHtml   = renderPdf(sample);
  const ssml      = buildAudioScript(sample);
  assertContains('Print includes ticked image',   printHtml, 'keep.jpg');
  assertAbsent('Print omits unticked image',      printHtml, 'drop.jpg');
  assertContains('PDF includes ticked image',     pdfHtml,   'keep.jpg');
  assertContains('Print includes timeline inline image', printHtml, 'inline.jpg');
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

  // The cover always renders as #hse-cover, so its CSS is scoped to that
  const coverSection = (meta, css) => ({ ...base(meta), sections: [{ id: 'opening', layout: 'cover', headline: 'Hi', custom_css: css }] });
  const coverScoped = await renderHtml(coverSection({ scope_section_css: true }, '#opening .hse-cover__headline { color: red; } #hse-cover { color: blue; } .hse-cover__body {}'), 'css-cover-section');
  assertContains('Cover section CSS is scoped to #hse-cover', coverScoped, '@scope (#hse-cover) {\n:scope .hse-cover__headline { color: red; } :scope { color: blue; } .hse-cover__body {}\n}');
  const coverOld = await renderHtml(coverSection({}, '#hse-cover .x { color: red; }'), 'css-cover-old');
  assertContains('Older story keeps cover section CSS as written', coverOld, '<style data-section-override="opening">\n#hse-cover .x { color: red; }\n</style>');
  const legacyCover = (meta, css) => ({ ...base(meta), cover: { headline: 'CSS', custom_css: css } });
  const legacyScoped = await renderHtml(legacyCover({ scope_section_css: true }, '.hse-cover__headline { color: red; } </style><script>'), 'css-cover-legacy');
  assertContains('Original cover CSS is scoped to #hse-cover', legacyScoped, '<style data-section-override="hse-cover">\n@scope (#hse-cover) {\n.hse-cover__headline { color: red; }');
  assertAbsent('Original cover CSS cannot close its <style> tag', legacyScoped, '</style><script>');
  assert('Original cover CSS follows the cover', legacyScoped.indexOf('data-section-override="hse-cover"') > legacyScoped.indexOf('id="hse-cover"') && legacyScoped.indexOf('data-section-override="hse-cover"') < legacyScoped.indexOf('<main'));
  const legacyOld = await renderHtml(legacyCover({}, '#hse-cover .x {}'), 'css-cover-legacy-old');
  assertContains('Older story keeps original cover CSS as written', legacyOld, '<style data-section-override="hse-cover">\n#hse-cover .x {}\n</style>');
  assertAbsent('No cover CSS block when empty', legacy, 'data-section-override="hse-cover"');
  assert('Cover CSS passes the schema', validate(legacyCover({ scope_section_css: true }, 'a{}')).length === 0);
}

// ── Story custom JavaScript ─────────────────────────────────────
{
  console.log('\n── Story custom JavaScript ────────────────────────────');
  const base = (meta) => ({
    meta: { title: 'JS', project_id: 'js-test', ...meta },
    cover: { headline: 'JS' },
    sections: [{ id: 'intro', layout: 'default', title: 'Intro' }],
  });
  const renderHtml = async (content, name) => {
    const dir = path.join(outputBase, name);
    fs.mkdirSync(dir, { recursive: true });
    await render(content, dir);
    return fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
  };

  const none = await renderHtml(base({}), 'js-none');
  assertAbsent('No story JS block when empty', none, 'data-story-js');
  assertContains('Story without JS keeps its old ending', none, '</style>\n\n</body>');
  const blank = await renderHtml(base({ custom_js: '   \n ' }), 'js-blank');
  assertAbsent('Whitespace-only story JS adds nothing', blank, 'data-story-js');

  const code = "window.hseStoryJs = 1;\nconst s = '</script><b>x</b>'; // <!-- hi";
  const withJs = await renderHtml(base({ custom_js: code }), 'js-on');
  const block = withJs.slice(withJs.indexOf('<script data-story-js>'));
  assertContains('Story JS rendered', block, 'window.hseStoryJs = 1;');
  assertContains('Story JS waits for the engine scripts', block, "document.addEventListener('DOMContentLoaded'");
  assert('Story JS cannot close its <script> tag', block.indexOf('</script>') > block.indexOf("<\\/script><b>x</b>"));
  assertAbsent('Story JS cannot open an HTML comment', block.slice(0, block.indexOf('</script>')), '<!--');
  assert('Story JS is the last thing in <body>', /<\/script>\s*<\/body>/.test(withJs) && withJs.lastIndexOf('data-story-js') > withJs.indexOf('hse-footer'));
  assertAbsent('Print page never gets story JS', renderPrint(base({ custom_js: code })), 'hseStoryJs');
  assert('Story JS field passes the schema', validate(base({ custom_js: 'console.log(1)' })).length === 0);
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

// ── Layout registry (Section Contract) ───────────────────────────
// Every layout is one entry in renderer/layouts/registry.js, and every
// part of the engine that has to know about it must. Each failure here
// names the file a new layout still needs. See docs/section-contract.md.
console.log('\nLayout registry');
{
  const { LAYOUTS, extraLayoutCss } = require('./renderer/layouts/registry');
  const schema = JSON.parse(fs.readFileSync(path.join(__dirname, 'schema/content.schema.json'), 'utf8'));
  const schemaLayouts = schema.definitions.section.properties.layout.enum;
  const runtimeSrc = fs.readFileSync(path.join(__dirname, 'js/runtime.js'), 'utf8');
  const editorSrc = fs.readFileSync(path.join(__dirname, 'editor/editor.html'), 'utf8');
  const headSrc = fs.readFileSync(path.join(__dirname, 'renderer/shell/head.js'), 'utf8');
  const extra = new Set(extraLayoutCss());

  for (const layout of schemaLayouts) {
    assert(`Schema layout "${layout}" is in the registry`, Object.prototype.hasOwnProperty.call(LAYOUTS, layout));
  }
  for (const [name, entry] of Object.entries(LAYOUTS)) {
    assert(`${name}: has a render function`, typeof entry.render === 'function');
    if (entry.css) {
      assert(`${name}: stylesheet ${entry.css} exists`, fs.existsSync(path.join(__dirname, entry.css)));
      assert(`${name}: stylesheet is linked from the page`,
        extra.has(entry.css) || headSrc.includes(`css('${entry.css}')`));
    }
    if (entry.runtime) {
      for (const fn of [entry.runtime.setup, entry.runtime.reducedMotion].filter(Boolean)) {
        assert(`${name}: js/runtime.js defines ${fn}()`, new RegExp(`function ${fn}\\s*\\(`).test(runtimeSrc));
        assert(`${name}: js/runtime.js calls ${fn}()`, (runtimeSrc.match(new RegExp(`\\b${fn}\\(\\)`, 'g')) || []).length >= 2);
      }
    }
    assert(`${name}: the editor offers it`, editorSrc.includes(`<option value="${name}"`));
  }

  // Rendering a section of each layout keeps everything inside one
  // <section data-layout> root (rule R1).
  for (const name of Object.keys(LAYOUTS)) {
    if (name === 'cover') continue;
    const html = require('./renderer/index').renderSection({ id: `reg-${name}`, layout: name, title: 'T' }, {}).trim();
    const opens = (html.match(/<section\b/g) || []).length;
    const root = html.replace(/^<!--[\s\S]*?-->\s*/, '');
    assert(`${name}: renders one <section data-layout="${name}"> root`,
      root.startsWith('<section') && root.includes(`data-layout="${name}"`) && root.trimEnd().endsWith('</section>') && opens === 1);
  }
}

// ── Every word on screen is read (Section Contract R10) ──────────
// Each layout has a sample story in test/fixtures/<layout>.json whose
// words are unique markers (QQ…). Every marker the page shows as text
// must also come out of the layout's reader, which is what the printable
// page, the PDF and the audio all use. A word that deliberately isn't
// read is listed in the section's "_not_read" with the reason.
// The reverse holds too: a reader may not read text the page doesn't
// show (leftovers from switching layouts). The section title and ticked
// print images are exempt: every output heads a section with its title,
// and a printed image keeps its caption.
console.log('\nEvery word on screen is read');
{
  const { LAYOUTS } = require('./renderer/layouts/registry');
  const { renderSection } = require('./renderer/index');
  const { readSection } = require('./renderer/readable');
  const MARK = /QQ[A-Z0-9]+/g;
  for (const name of Object.keys(LAYOUTS)) {
    if (name === 'cover') continue; // read by each output's own cover code
    const file = path.join(__dirname, 'test/fixtures', `${name}.json`);
    assert(`${name}: has a sample in test/fixtures/${name}.json`, fs.existsSync(file));
    if (!fs.existsSync(file)) continue;
    const story = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert(`${name}: sample passes the schema`, validate(story).length === 0);
    const section = story.sections.find(s => s.layout === name);
    const notRead = section._not_read || {};
    const html = renderSection(JSON.parse(JSON.stringify(section)), story.meta);
    const shown = new Set(html.replace(/<(script|style)\b[\s\S]*?<\/\1>/g, ' ').replace(/<[^>]*>/g, ' ').match(MARK) || []);
    const read = readSection(JSON.parse(JSON.stringify(section)));
    const readText = JSON.stringify([read.intro, read.items.filter(i => i.kind !== 'image')]);
    const readAll = JSON.stringify(read);

    const missing = [...shown].filter(m => !readAll.includes(m) && !notRead[m]);
    assert(`${name}: print, PDF and audio read every word it shows` + (missing.length ? ` (missing ${missing.join(', ')})` : ''), missing.length === 0);
    const stale = [...new Set(readText.match(MARK) || [])].filter(m => !html.includes(m));
    assert(`${name}: reads nothing it doesn't show` + (stale.length ? ` (${stale.join(', ')})` : ''), stale.length === 0);
    if (name === 'timeline') {
      const chapter = read.items.find(i => i.kind === 'heading' && i.text === 'QQTLCHAPTER');
      assert('timeline: a chapter card is read as a heading, not an entry', !!chapter && !JSON.stringify(read.items.filter(i => i.kind === 'items')).includes('QQTLCHAPTER'));
    }
    if (['default', 'stackable-cards', 'cascading-slides'].includes(name)) {
      const withTag = read.items.find(i => i.kind === 'items' && i.items.some(c => /TAG/.test(c.meta || '')));
      assert(`${name}: a card's tag is read with its title`, !!withTag);
    }
    for (const [m, why] of Object.entries(notRead)) {
      if (/^Known gap/i.test(why)) console.log(`  – ${name}: ${m} not read. ${why}`);
    }
  }
}

// ── Existing stories unchanged (Section Contract R14) ────────────
// Every story in projects/, examples/ and test/fixtures/ must render
// exactly as recorded in test/snapshots.json: page, printable page, PDF
// and audio. A change that is meant to alter stories refreshes the record
// with `npm run snapshots:update`, and its PR says which stories change.
console.log('\nExisting stories unchanged');
{
  const snapshots = require('./scripts/story-snapshots');
  const stories = snapshots.repoStories();
  const expected = snapshots.readSnapshots();
  const actual = await snapshots.fingerprints(stories, snapshots.engineAt(null));
  const all = snapshots.compare(expected, actual);
  // A story whose content.json was edited is an editorial change, not an
  // engine one: it can't be compared, so it doesn't fail a content push.
  for (const c of all.filter(c => c.change === 'content edited')) {
    console.log(`  – ${c.id}: content edited, not compared (refresh with npm run snapshots:update)`);
  }
  const changes = all.filter(c => c.change !== 'content edited');
  for (const { id } of stories) {
    const mine = changes.filter(c => c.id === id);
    assert(`${id} renders as before` + (mine.length ? ` (${mine.map(c => `${c.file} ${c.change}`).join(', ')})` : ''), mine.length === 0);
  }
  const gone = changes.filter(c => !stories.some(s => s.id === c.id));
  assert('No recorded story is missing' + (gone.length ? ` (${[...new Set(gone.map(c => c.id))].join(', ')})` : ''), gone.length === 0);
  if (changes.length) {
    console.log('  See what changed:   npm run snapshots:diff');
    console.log('  If it is intended:  npm run snapshots:update, and say so in the PR');
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
