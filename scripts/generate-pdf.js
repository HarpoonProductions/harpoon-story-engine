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
const filePath   = getArg('--file', null);   // local file path for CI (no server needed)
const defaultOut = path.join(process.cwd(), '.pdf-output', `${projectId}.pdf`);
const outPath    = getArg('--out', defaultOut);

function getArg(flag, fallback) {
  const i = args.indexOf(flag);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
}

// Build the URL to load — file:// in CI, http:// locally
const url = filePath
  ? `file://${path.resolve(filePath)}`
  : `http://localhost:${port}/pdf-preview/${projectId}`;

// ── Main ──────────────────────────────────────────────────────────

async function generate() {
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

    // Read story metadata from embedded <meta> tags for the footer template
    const storyTitle  = await page.$eval('meta[name="hpdf-title"]',  el => el.content).catch(() => '');
    const storyClient = await page.$eval('meta[name="hpdf-client"]', el => el.content).catch(() => '');

    // Footer template — rendered by Puppeteer in the bottom margin of every page.
    // Must use inline styles only (no access to page CSS). Font-size defaults to 0pt.
    const footerLabel = [storyClient, storyTitle].filter(Boolean).join(' · ');
    const footerTemplate = `
      <div style="width:100%;display:flex;justify-content:space-between;align-items:center;
                  padding:0 16mm;font-size:7pt;color:#aaa;font-family:sans-serif;
                  letter-spacing:0.06em;">
        <span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:130mm;">
          ${footerLabel.replace(/</g, '&lt;').replace(/>/g, '&gt;')}
        </span>
        <span style="white-space:nowrap;flex-shrink:0;">
          <span class="pageNumber"></span> / <span class="totalPages"></span>
        </span>
      </div>`;

    console.log('[pdf] Printing…');

    await page.pdf({
      path:                outPath,
      format:              'A4',
      landscape:           landscape,
      printBackground:     true,   // required for cover background + header bar colour
      preferCSSPageSize:   true,   // honour @page { size: A4 } in CSS
      displayHeaderFooter: true,
      headerTemplate:      '<span></span>',  // required but empty — header handled by CSS
      footerTemplate,
      margin: { top: '12mm', right: 0, bottom: '9mm', left: 0 },
      // top:12mm   — matches @page margin-top; @page :first overrides to 0 for cover
      // bottom:9mm — Puppeteer footer template space (page numbers + title)
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
