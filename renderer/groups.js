'use strict';

/**
 * Group resolution — Tier 2 (HSE) capability. Not specific to any one
 * kind or product: any HSE project can set meta.group_id, and any other
 * project sharing that id is a member of the same group. This module
 * only resolves *membership as data* (project_id, title, label, role) —
 * it has no opinion on how a consumer renders that data. The narrative
 * kind turns it into onward_links; the graduation-guide kind turns it
 * into its own nav dropdown; a future kind is free to do something else
 * entirely with the same call.
 *
 * Supabase is the source of truth (matches every other cross-project
 * capability in this repo — deploy, editor listings). Falls back to a
 * local projects/*\/content.json scan when Supabase isn't configured,
 * so offline/local rendering (tests, `node render.js` without a .env)
 * still works — group data just reflects whatever's on disk instead of
 * whatever's live, which is the correct offline behaviour, not a bug.
 *
 * Queries Supabase via raw REST fetch, not the @supabase/supabase-js
 * client — that client initialises a realtime/WebSocket connection at
 * construction time, which throws on the Node 20 CI runner (no native
 * WebSocket support until Node 22). fetch-content.js already works
 * around the same constraint the same way; this follows that pattern
 * rather than reintroducing the problem via db.js's client-based helpers.
 */

const fs = require('fs');
const path = require('path');
const db = require('../db');

const PROJECTS_DIR = path.join(__dirname, '..', 'projects');

/**
 * @param {string} groupId
 * @param {string} selfProjectId - excluded from the returned list
 * @returns {Promise<Array<{project_id: string, title: string, label: string, role: string}>>}
 */
async function resolveGroup(groupId, selfProjectId) {
  if (!groupId) return [];

  const rows = db.isConfigured()
    ? await resolveFromSupabase(groupId)
    : resolveFromFilesystem(groupId);

  return rows
    .filter((r) => r.project_id !== selfProjectId)
    .map((r) => ({
      project_id: r.project_id,
      title: r.meta.title || r.project_id,
      label: r.meta.group_label || r.meta.title || r.project_id,
      role: r.meta.group_role || '',
    }));
}

async function resolveFromSupabase(groupId) {
  const params = new URLSearchParams({
    select: 'project_id,content',
    'content->meta->>group_id': `eq.${groupId}`,
  });
  const url = `${process.env.SUPABASE_URL}/rest/v1/story_engine_projects?${params.toString()}`;

  const res = await fetch(url, {
    headers: {
      apikey: process.env.SUPABASE_ANON_KEY,
      Authorization: `Bearer ${process.env.SUPABASE_ANON_KEY}`,
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    throw new Error(`resolveGroup: Supabase API error ${res.status}: ${await res.text()}`);
  }

  const rows = await res.json();
  return rows.map((row) => ({
    project_id: row.project_id,
    meta: row.content?.meta || {},
  }));
}

function resolveFromFilesystem(groupId) {
  if (!fs.existsSync(PROJECTS_DIR)) return [];

  return fs.readdirSync(PROJECTS_DIR)
    .filter((name) => fs.existsSync(path.join(PROJECTS_DIR, name, 'content.json')))
    .map((name) => {
      const contentPath = path.join(PROJECTS_DIR, name, 'content.json');
      try {
        const content = JSON.parse(fs.readFileSync(contentPath, 'utf8'));
        return { project_id: content.meta?.project_id || name, meta: content.meta || {} };
      } catch {
        return null;
      }
    })
    .filter((row) => row && row.meta.group_id === groupId);
}

module.exports = { resolveGroup };
