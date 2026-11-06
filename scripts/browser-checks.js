#!/usr/bin/env node
'use strict';

/**
 * Harpoon Story Engine — Browser checks (Section Contract R11, R12, R13).
 *
 * Opens each layout's sample story (test/fixtures/<layout>.json) in
 * headless Chrome and checks three things a plain render can't:
 *
 *   R11 phone          at 320px wide nothing makes the page scroll sideways
 *   R12 reduced motion with motion turned off, every word is showing
 *   R13 Ctrl+P         printing the live page shows every word
 *
 * "Every word" means every QQ marker the section shows as text, apart from
 * image alt text and captions (those follow their image, and print hides
 * images that aren't ticked for print).
 *
 * Usage: node scripts/browser-checks.js [layout]
 * Exported as runBrowserChecks() for test.js. Returns null when no browser
 * is available, so the rest of the tests still run.
 */

const fs   = require('fs');
const os   = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const MARK = /QQ[A-Z0-9]+/g;
const IMAGE_TEXT = /(ALT|CAP)$/;

async function launch() {
  let puppeteer;
  try { puppeteer = require('puppeteer'); } catch { return null; }
  const candidates = [process.env.PUPPETEER_EXECUTABLE_PATH, undefined, '/opt/pw-browsers/chromium'];
  for (const executablePath of candidates) {
    try {
      return await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--allow-file-access-from-files'],
        ...(executablePath ? { executablePath } : {}),
      });
    } catch {}
  }
  return null;
}

/** Markers shown as text on the rendered section (from its HTML). */
function expectedMarkers(html) {
  const text = html.replace(/<(script|style)\b[\s\S]*?<\/\1>/g, ' ').replace(/<[^>]*>/g, ' ');
  return [...new Set(text.match(MARK) || [])].filter(m => !IMAGE_TEXT.test(m)).sort();
}

// Runs in the page: markers in text a reader could see right now. A text
// counts when no ancestor is display:none, visibility:hidden or fully
// transparent, and it takes up space.
function visibleMarkersInPage() {
  const found = new Set();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    const words = node.textContent.match(/QQ[A-Z0-9]+/g);
    if (!words) continue;
    let el = node.parentElement;
    let shown = true;
    const range = document.createRange();
    range.selectNodeContents(node);
    const rect = range.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) shown = false;
    while (shown && el) {
      const s = getComputedStyle(el);
      if (s.display === 'none' || s.visibility === 'hidden' || parseFloat(s.opacity) === 0) shown = false;
      // Cut off by a box that hides its overflow (a pinned 100vh panel)
      if (shown && el !== node.parentElement && /hidden|clip/.test(s.overflow + s.overflowX + s.overflowY)) {
        const box = el.getBoundingClientRect();
        if (rect.bottom <= box.top || rect.top >= box.bottom || rect.right <= box.left || rect.left >= box.right) shown = false;
      }
      if (shown && s.clipPath && s.clipPath !== 'none' && /inset\(\s*(100%|50%)/.test(s.clipPath)) shown = false;
      el = el.parentElement;
    }
    if (shown) words.forEach(w => found.add(w));
  }
  return [...found];
}

async function checkLayout(browser, name, file) {
  const { render, renderSection } = require(path.join(ROOT, 'renderer/index'));
  const story = JSON.parse(fs.readFileSync(file, 'utf8'));
  const section = story.sections.find(s => s.layout === name) || story.sections[0];
  const expected = expectedMarkers(renderSection(JSON.parse(JSON.stringify(section)), story.meta));

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hse-browser-'));
  const quiet = console.log;
  console.log = () => {};
  try {
    await render(JSON.parse(JSON.stringify(story)), dir, { basePath: '' });
  } finally {
    console.log = quiet;
  }
  const url = 'file://' + path.join(dir, 'index.html');
  const result = { name, phone: null, reducedMotion: null, print: null };

  const open = async (viewport, features, media) => {
    const page = await browser.newPage();
    // Pages load fonts and media from the web; the checks don't need them
    await page.setRequestInterception(true);
    page.on('request', r => (r.url().startsWith('file:') ? r.continue() : r.abort()));
    await page.setViewport(viewport);
    if (features) await page.emulateMediaFeatures(features);
    await page.goto(url, { waitUntil: 'load', timeout: 30000 });
    await new Promise(r => setTimeout(r, 400));
    if (media) await page.emulateMediaType(media);
    return page;
  };

  try {
    // R11: 320px wide, no sideways scroll
    let page = await open({ width: 320, height: 640 });
    const widths = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth, win: window.innerWidth }));
    result.phone = { ok: widths.doc <= widths.win + 1, detail: `page is ${widths.doc}px wide` };
    await page.close();

    // R12: reduced motion, every word showing
    page = await open({ width: 1280, height: 800 }, [{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    let seen = new Set(await page.evaluate(visibleMarkersInPage));
    let missing = expected.filter(m => !seen.has(m));
    result.reducedMotion = { ok: missing.length === 0, missing };
    await page.close();

    // R13: Ctrl+P on the live page
    page = await open({ width: 1280, height: 800 }, null, 'print');
    seen = new Set(await page.evaluate(visibleMarkersInPage));
    missing = expected.filter(m => !seen.has(m));
    result.print = { ok: missing.length === 0, missing };
    await page.close();
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  return result;
}

async function runBrowserChecks(only) {
  const { LAYOUTS } = require(path.join(ROOT, 'renderer/layouts/registry'));
  const browser = await launch();
  if (!browser) return null;
  const results = [];
  try {
    for (const name of Object.keys(LAYOUTS)) {
      if (name === 'cover' || (only && name !== only)) continue;
      const file = path.join(ROOT, 'test/fixtures', `${name}.json`);
      if (!fs.existsSync(file)) continue;
      results.push(await checkLayout(browser, name, file));
    }
  } finally {
    await browser.close();
  }
  return results;
}

module.exports = { runBrowserChecks };

if (require.main === module) {
  runBrowserChecks(process.argv[2]).then(results => {
    if (!results) { console.log('No browser available'); process.exit(2); }
    let bad = 0;
    for (const r of results) {
      const line = (label, c, extra) => {
        if (!c.ok) bad++;
        console.log(`  ${c.ok ? '✓' : '✗'} ${r.name}: ${label}${c.ok ? '' : ` (${extra})`}`);
      };
      line('fits a 320px phone', r.phone, r.phone.detail);
      line('every word shows with motion off', r.reducedMotion, `missing ${r.reducedMotion.missing.join(', ')}`);
      line('every word prints with Ctrl+P', r.print, `missing ${r.print.missing.join(', ')}`);
    }
    process.exit(bad ? 1 : 0);
  }, err => { console.error(err); process.exit(2); });
}
