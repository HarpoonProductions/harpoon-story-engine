#!/usr/bin/env node

'use strict';

const fs   = require('fs');
const path = require('path');
const { validate } = require('./renderer/validate');
const { render }   = require('./renderer/index');

// ── CLI argument handling ─────────────────────────────────────────────────────

const args = process.argv.slice(2);

if (args.length === 0 || args.includes('--help')) {
  console.log(`
Harpoon Story Engine — Renderer v0.1.0
Usage: node render.js <content.json> [--out <output-dir>]

  <content.json>   Path to a JSON file conforming to the HSE content schema
  --out <dir>      Output directory (default: ./output)

Examples:
  node render.js examples/opera-example.json
  node render.js examples/cricket-example.json --out ./dist
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

// ── Load and validate ─────────────────────────────────────────────────────────

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

const errors = validate(content);
if (errors.length > 0) {
  console.error('\n✗ Schema validation failed:');
  errors.forEach(e => console.error(`  ${e.instancePath || '(root)'} — ${e.message}`));
  console.error('');
  process.exit(1);
}

console.log(`\n✓ Schema valid — ${content.meta.project_id}`);

// ── Render ────────────────────────────────────────────────────────────────────

fs.mkdirSync(outputDir, { recursive: true });

try {
  const files = render(content, outputDir, basePath !== undefined ? { basePath } : undefined);
  console.log(`✓ Rendered ${files.length} file(s) to ${outputDir}`);
  files.forEach(f => console.log(`  → ${path.relative(outputDir, f)}`));
  console.log('');
} catch (err) {
  console.error(`\n✗ Render error: ${err.message}`);
  console.error(err.stack);
  process.exit(1);
}
