#!/usr/bin/env node
/*
 * Upserts a graduation-guide content.json into the story_engine_projects
 * Supabase table via db.js's saveProject(), the same write path the
 * editor's autosave uses — bypasses the editor UI entirely (it has no
 * fields for graduation content). This is the entire integration needed
 * with the existing deploy pipeline: fetch-content.js, render-deploy.yml,
 * and the S3/CloudFront steps pick this up unchanged.
 *
 * Usage: node scripts/push-to-supabase.js projects/imperial-2026/content.json
 */
'use strict';
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const fs = require('fs');
const path = require('path');
const db = require('../db');

async function main() {
  const contentPath = process.argv[2];
  if (!contentPath) {
    console.error('Usage: node scripts/push-to-supabase.js <content.json>');
    process.exit(1);
  }

  if (!db.isConfigured()) {
    console.error('SUPABASE_URL / SUPABASE_ANON_KEY not set — check .env');
    process.exit(1);
  }

  const resolved = path.resolve(contentPath);
  const content = JSON.parse(fs.readFileSync(resolved, 'utf8'));
  const projectId = content.meta?.project_id;
  if (!projectId) {
    console.error('content.meta.project_id is required');
    process.exit(1);
  }

  await db.saveProject(projectId, content);
  console.log(`✓ Upserted "${projectId}" (${JSON.stringify(content).length} bytes) to story_engine_projects`);
}

main().catch((err) => {
  console.error('✗', err.message);
  process.exit(1);
});
