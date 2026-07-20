#!/usr/bin/env node

'use strict';

const fs   = require('fs');
const path = require('path');
const { validateMagazineCover } = require('./renderer/validate');
const { renderMagazineCover }   = require('./renderer/render-magazine-cover');

const args = process.argv.slice(2);

if (args.length === 0 || args.includes('--help')) {
  console.log(`
Harpoon Story Engine — Magazine Cover Renderer
Usage: node render-magazine-cover.js <magazine-cover.json> [--out <output-dir>] [--base <path>]

  <magazine-cover.json>  Path to a JSON file conforming to schema/magazine-cover.schema.json
  --out <dir>             Output directory (default: ./output)
  --base <path>           Root-relative base path for CSS links. Pass '' for local preview.

Examples:
  node render-magazine-cover.js examples/edition-cover-example.json --out ./output --base ""
`);
  process.exit(0);
}

const inputPath = path.resolve(args[0]);
const outFlagIndex = args.indexOf('--out');
const outputDir = path.resolve(
  outFlagIndex !== -1 ? args[outFlagIndex + 1] : './output'
);
const baseFlagIndex = args.indexOf('--base');
const basePath = baseFlagIndex !== -1 ? args[baseFlagIndex + 1] : undefined;

if (!fs.existsSync(inputPath)) {
  console.error(`\n✗ File not found: ${inputPath}\n`);
  process.exit(1);
}

let content;
try {
  content = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
} catch (err) {
  console.error(`\n✗ Invalid JSON: ${err.message}\n`);
  process.exit(1);
}

const errors = validateMagazineCover(content);
if (errors.length > 0) {
  console.error('\n✗ Schema validation failed:');
  errors.forEach(e => console.error(`  ${e.instancePath || '(root)'} — ${e.message}`));
  console.error('');
  process.exit(1);
}

console.log(`\n✓ Schema valid — ${content.meta.title}`);

fs.mkdirSync(outputDir, { recursive: true });

const cssSource = path.join(__dirname, 'css');
const cssDest   = path.join(outputDir, 'css');
copyDirRecursive(cssSource, cssDest);

const html = renderMagazineCover(content, basePath !== undefined ? basePath : content.meta.project_id || '');
const outPath = path.join(outputDir, 'index.html');
fs.writeFileSync(outPath, html, 'utf8');

console.log(`✓ Rendered 1 file to ${outputDir}`);
console.log(`  → ${path.relative(outputDir, outPath)}\n`);

function copyDirRecursive(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath  = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}
