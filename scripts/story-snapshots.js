#!/usr/bin/env node
'use strict';

/**
 * Harpoon Story Engine — Story snapshots (Section Contract rule R14).
 *
 * An engine change must not quietly change how an existing story renders.
 * This renders every story the repo knows (projects/*, examples/*,
 * test/fixtures/*) into everything a reader can get: the page, the
 * printable page, the PDF's HTML and the audio script. It keeps a
 * fingerprint of each in test/snapshots.json, and test.js fails when one
 * changes.
 *
 * A change that is meant to alter stories is fine: say so in the PR and
 * refresh the fingerprints. Usage:
 *
 *   node scripts/story-snapshots.js --check          compare with test/snapshots.json
 *   node scripts/story-snapshots.js --update         rewrite test/snapshots.json
 *   node scripts/story-snapshots.js --diff [ref]     show what changed against a
 *                                                    commit (default origin/main)
 *   node scripts/story-snapshots.js --diff [ref] --live
 *       the same for every story in Supabase (needs .env). Frozen stories
 *       are skipped: they render with their own pinned engine.
 *   --only <id>   limit any of the above to one story
 *
 * What it doesn't see: a change to a CSS file alters how a story looks
 * without changing its HTML, so CSS-only changes need their own check.
 * The ?v= version stamps on CSS and JS links are left out of the
 * fingerprint for the same reason.
 */

const fs     = require('fs');
const os     = require('os');
const path   = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const SNAPSHOT_FILE = path.join(ROOT, 'test', 'snapshots.json');

// ── Sources ──────────────────────────────────────────────────────

function repoStories() {
  const out = [];
  const add = (id, file) => out.push({ id, content: JSON.parse(fs.readFileSync(file, 'utf8')) });

  const projects = path.join(ROOT, 'projects');
  for (const id of fs.readdirSync(projects).sort()) {
    const file = path.join(projects, id, 'content.json');
    if (fs.existsSync(file)) add(id, file);
  }
  for (const dir of ['examples', path.join('test', 'fixtures')]) {
    const abs = path.join(ROOT, dir);
    if (!fs.existsSync(abs)) continue;
    for (const f of fs.readdirSync(abs).filter(f => f.endsWith('.json')).sort()) {
      add(`${dir.replace(/\\/g, '/')}/${f.replace(/\.json$/, '')}`, path.join(abs, f));
    }
  }
  return out;
}

async function liveStories() {
  require('dotenv').config({ path: path.join(ROOT, '.env') });
  const db = require(path.join(ROOT, 'db'));
  if (!db.isConfigured()) throw new Error('--live needs SUPABASE_URL and SUPABASE_ANON_KEY (.env)');
  const rows = await db.getAllProjectContents();
  return rows
    .filter(r => r && r.content)
    .map(r => ({ id: r.project_id || r.id || (r.content.meta || {}).project_id, content: r.content }))
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));
}

// ── Rendering ────────────────────────────────────────────────────

const engines = new Map();

/** The engine's functions, from this checkout (null) or a commit. */
function engineAt(ref) {
  const key = ref || '';
  if (engines.has(key)) return engines.get(key);
  let dir = ROOT;
  if (ref) {
    const sha = execFileSync('git', ['-C', ROOT, 'rev-parse', `${ref}^{commit}`], { encoding: 'utf8' }).trim();
    dir = require(path.join(ROOT, 'engine-pin')).prepareEngine(sha);
  }
  const req = rel => require(path.join(dir, rel));
  const engine = {
    dir,
    render:           req('renderer/index').render,
    renderPrint:      req('renderer/print-renderer').renderPrint,
    renderPdf:        req('renderer/pdf-renderer').renderPdf,
    buildAudioScript: req('renderer/audio-script').buildAudioScript,
  };
  engines.set(key, engine);
  return engine;
}

function normalise(text) {
  return text
    // Version stamps change with any CSS or JS edit, not with the story
    .replace(/(\.(?:css|js))\?v=[0-9a-f]+/g, '$1')
    // A render-time timestamp ends up in the offline cache name when the
    // story has no last_saved
    .replace(/(-)\d{13}(['"])/g, '$1<time>$2');
}

/**
 * Everything a reader can get from one story, as { name: text }.
 * Group navigation is read from projects/ on disk, never from Supabase,
 * so the result is the same on every machine.
 */
async function renderOutputs(content, engine) {
  const story = JSON.parse(JSON.stringify(content));
  const meta = story.meta || (story.meta = {});
  const id = meta.project_id || 'story';

  const saved = { url: process.env.SUPABASE_URL, key: process.env.SUPABASE_ANON_KEY };
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_ANON_KEY;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hse-snapshot-'));
  const quiet = console.log;
  try {
    console.log = () => {};
    await engine.render(JSON.parse(JSON.stringify(story)), dir, { basePath: id });
    console.log = quiet;

    const outputs = {};
    const files = fs.readdirSync(dir, { recursive: true })
      .map(f => f.split(path.sep).join('/'))
      .filter(f => /\.(html|json|js)$/.test(f) && !f.startsWith('css/') && !f.startsWith('js/'))
      .sort();
    for (const f of files) outputs[f] = normalise(fs.readFileSync(path.join(dir, f), 'utf8'));

    if (story.kind !== 'graduation-guide') {
      outputs['pdf.html'] = normalise(engine.renderPdf(JSON.parse(JSON.stringify(story))));
      outputs['audio.ssml'] = normalise(engine.buildAudioScript(JSON.parse(JSON.stringify(story))));
    }
    return outputs;
  } finally {
    console.log = quiet;
    if (saved.url !== undefined) process.env.SUPABASE_URL = saved.url;
    if (saved.key !== undefined) process.env.SUPABASE_ANON_KEY = saved.key;
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

const hash = text => crypto.createHash('sha256').update(text).digest('hex').slice(0, 16);

async function fingerprints(stories, engine) {
  const result = {};
  for (const { id, content } of stories) {
    const outputs = await renderOutputs(content, engine);
    result[id] = {
      // The story's own content: when that changes, the outputs are
      // expected to change too, so there is nothing to compare.
      'content.json': hash(JSON.stringify(content)),
      ...Object.fromEntries(Object.entries(outputs).map(([f, t]) => [f, hash(t)])),
    };
  }
  return result;
}

/**
 * [{ id, file, change }] where change is 'changed', 'added' or 'removed'.
 * A story whose content itself has changed (someone edited its
 * content.json) is reported once as 'content edited' and not compared:
 * that's an editorial change, not an engine one.
 */
function compare(expected, actual) {
  const changes = [];
  for (const id of new Set([...Object.keys(expected), ...Object.keys(actual)])) {
    const a = expected[id] || {};
    const b = actual[id] || {};
    if (a['content.json'] && b['content.json'] && a['content.json'] !== b['content.json']) {
      changes.push({ id, file: 'content.json', change: 'content edited' });
      continue;
    }
    for (const file of new Set([...Object.keys(a), ...Object.keys(b)])) {
      if (!(file in a)) changes.push({ id, file, change: 'added' });
      else if (!(file in b)) changes.push({ id, file, change: 'removed' });
      else if (a[file] !== b[file]) changes.push({ id, file, change: 'changed' });
    }
  }
  return changes;
}

function readSnapshots() {
  return fs.existsSync(SNAPSHOT_FILE) ? JSON.parse(fs.readFileSync(SNAPSHOT_FILE, 'utf8')) : {};
}

// ── Diff ─────────────────────────────────────────────────────────

function showDiff(before, after, label) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hse-diff-'));
  try {
    // One tag per line so an HTML change reads as a short diff
    const split = t => t.replace(/>\s*</g, '>\n<');
    fs.writeFileSync(path.join(tmp, 'before'), split(before));
    fs.writeFileSync(path.join(tmp, 'after'), split(after));
    let out = '';
    try {
      execFileSync('diff', ['-u', '--label', `${label} (before)`, '--label', `${label} (after)`, 'before', 'after'], { cwd: tmp, encoding: 'utf8' });
    } catch (e) {
      out = e.stdout || '';
    }
    const lines = out.split('\n');
    console.log(lines.slice(0, 80).join('\n'));
    if (lines.length > 80) console.log(`  … ${lines.length - 80} more lines`);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

async function diffAgainst(ref, stories) {
  const before = engineAt(ref);
  const after = engineAt(null);
  let changed = 0;
  let skipped = 0;
  for (const { id, content } of stories) {
    if (content.meta && content.meta.engine_freeze && content.meta.engine_freeze.commit) {
      skipped++;
      continue;
    }
    let a, b;
    try {
      a = await renderOutputs(content, before);
      b = await renderOutputs(content, after);
    } catch (e) {
      console.log(`! ${id}: could not render (${e.message})`);
      continue;
    }
    const files = [...new Set([...Object.keys(a), ...Object.keys(b)])];
    const differing = files.filter(f => a[f] !== b[f]);
    if (!differing.length) continue;
    changed++;
    console.log(`\n■ ${id}`);
    for (const f of differing) showDiff(a[f] || '', b[f] || '', `${id}/${f}`);
  }
  console.log(`\n${changed} of ${stories.length - skipped} stories render differently from ${ref}` +
    (skipped ? ` (${skipped} frozen, skipped)` : ''));
  return changed;
}

// ── CLI ──────────────────────────────────────────────────────────

async function main(argv) {
  const flag = name => argv.includes(name);
  const value = name => {
    const i = argv.indexOf(name);
    return i !== -1 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : null;
  };
  let stories = flag('--live') ? await liveStories() : repoStories();
  const only = value('--only');
  if (only) stories = stories.filter(s => s.id === only);

  if (flag('--diff')) {
    await diffAgainst(value('--diff') || 'origin/main', stories);
    return 0;
  }

  const actual = await fingerprints(stories, engineAt(null));
  if (flag('--update')) {
    const merged = only ? { ...readSnapshots(), ...actual } : actual;
    fs.mkdirSync(path.dirname(SNAPSHOT_FILE), { recursive: true });
    fs.writeFileSync(SNAPSHOT_FILE, JSON.stringify(merged, null, 2) + '\n');
    console.log(`Wrote fingerprints for ${Object.keys(actual).length} stories to test/snapshots.json`);
    return 0;
  }

  let expected = readSnapshots();
  if (only) expected = { [only]: expected[only] || {} };
  const changes = compare(expected, actual);
  const edited = changes.filter(c => c.change === 'content edited');
  const real = changes.filter(c => c.change !== 'content edited');
  for (const c of edited) console.log(`content edited, not compared: ${c.id} (refresh with --update)`);
  for (const c of real) console.log(`${c.change}: ${c.id}/${c.file}`);
  console.log(real.length ? `${real.length} output(s) differ` : 'All stories render as before');
  return real.length ? 1 : 0;
}

module.exports = { repoStories, renderOutputs, fingerprints, compare, readSnapshots, engineAt };

if (require.main === module) {
  main(process.argv.slice(2)).then(code => process.exit(code), err => {
    console.error(err.message || err);
    process.exit(2);
  });
}
