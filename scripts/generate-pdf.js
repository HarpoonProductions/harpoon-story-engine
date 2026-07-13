'use strict';

/**
 * Harpoon Story Engine — PDF Generator (Track 2)
 *
 * Launches Puppeteer, loads the /pdf-preview/:id page from the running
 * editor server, and prints it to a publication-quality A4 PDF.
 *
 * Usage:
 *   node scripts/generate-pdf.js <project-id> [options]
 *
 * Options:
 *   --port <n>      Editor server port (default: 3001)
 *   --out <path>    Output file path (default: .pdf-output/<id>.pdf)
 *   --landscape     A4 landscape instead of portrait
 *
 * The editor server must be running before calling this script.
 * In CI, start it before the deploy step and stop it after.
 */

const puppeteer = require('puppeteer');
const path      = require('path');
const fs        = require('fs');

// ── Args ──────────────────────────────────────────────────────────

const args = process.argv.slice(2);

if (!args.length || args[0].startsWith('--')) {
  console.error('Usage: node scripts/generate-pdf.js <project-id> [--port 3001] [--out path/to/file.pdf] [--landscape]');
  process.exit(1);
}

const projectId  = args[0];
const port       = getArg('--port', '3001');
const landscape  = args.includes('--landscape');
const defaultOut = path.join(process.cwd(), '.pdf-output', `${projectId}.pdf`);
const outPath    = getArg('--out', defaultOut);

function getArg(flag, fallback) {
  const i = args.indexOf(flag);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
}

// ── Main ──────────────────────────────────────────────────────────

async function generate() {
  const url = `http://localhost:${port}/pdf-preview/${projectId}`;

  // Ensure output directory exists
  fs.mkdirSync(path.dirname(outPath), { recursive: true });

  console.log(`[pdf] Story:  ${projectId}`);
  console.log(`[pdf] Source: ${url}`);
  console.log(`[pdf] Output: ${outPath}`);
  console.log(`[pdf] Format: A4 ${landscape ? 'landscape' : 'portrait'}`);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();

    // Capture and surface any console errors from the page
    page.on('console', msg => {
      if (msg.type() === 'error') console.warn(`[page] ${msg.text()}`);
    });

    // Navigate and wait for network to be fully idle (fonts, images loaded)
    console.log('[pdf] Loading preview…');
    const response = await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });

    if (!response.ok()) {
      throw new Error(`Preview page returned HTTP ${response.status()} — is the editor server running on port ${port}?`);
    }

    // Extra wait for web fonts to finish rendering
    await page.evaluateHandle('document.fonts.ready');

    // Let any final layout settle (images, CSS transitions)
    await new Promise(r => setTimeout(r, 800));

    console.log('[pdf] Printing…');

    await page.pdf({
      path:            outPath,
      format:          'A4',
      landscape:       landscape,
      printBackground: true,  // required for cover background + header bar colour
      preferCSSPageSize: true, // honour @page { size: A4 } in CSS
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      // Zero Puppeteer margins — all spacing is owned by the CSS:
      // Cover: height:297mm fills the page edge-to-edge (full bleed)
      // Body:  running header + .hpdf-columns padding handle internal margins
    });

    const stat = fs.statSync(outPath);
    const kb   = Math.round(stat.size / 1024);
    console.log(`[pdf] Done — ${kb}KB written to ${outPath}`);

  } finally {
    await browser.close();
  }
}

generate().catch(err => {
  console.error('[pdf] Failed:', err.message);
  process.exit(1);
});
