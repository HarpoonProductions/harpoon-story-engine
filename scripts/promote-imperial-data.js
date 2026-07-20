#!/usr/bin/env node
/*
 * One-off: promotes graduation-guides/data/imperial-2026.json (the
 * standalone POC's data file) into the meta/config-wrapped shape this
 * repo's graduation-guide content kind expects, and updates font paths
 * to match where the fonts actually live here (css/fonts/, picked up by
 * copyCss's existing wholesale css/ copy — see docs/graduation-guide-integration.md).
 *
 * Usage: node scripts/promote-imperial-data.js
 */
'use strict';
const fs = require('fs');
const path = require('path');

const SRC = '/Users/gillis/Projects/graduation-guides/data/imperial-2026.json';
const OUT_DIR = path.join(__dirname, '..', 'projects', 'imperial-2026');
const OUT_FILE = path.join(OUT_DIR, 'content.json');

const source = JSON.parse(fs.readFileSync(SRC, 'utf8'));

const institution = {
  ...source.institution,
  fontFiles: (source.institution.fontFiles || []).map((f) => ({
    ...f,
    file: 'css/fonts/' + path.basename(f.file),
  })),
};

const promoted = {
  kind: 'graduation-guide',
  meta: {
    project_id: 'imperial-2026',
    title: source.guide.title,
    client: institution.name,
    token_set: 'imperial',
  },
  config: {
    analytics: { plausible_domain: 'analytics.har.pn' },
    pwa: { enabled: true },
  },
  institution,
  guide: source.guide,
  ceremonies: source.ceremonies,
  searchIndex: source.searchIndex,
};

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(OUT_FILE, JSON.stringify(promoted, null, 2));

const totalStudents = promoted.ceremonies.reduce(
  (sum, c) => sum + c.courseGroups.reduce((s, g) => s + g.students.length, 0),
  0
);
console.log('Wrote', path.relative(path.join(__dirname, '..'), OUT_FILE));
console.log('Ceremonies:', promoted.ceremonies.length, '| Students:', totalStudents, '| Search index:', promoted.searchIndex.length);
