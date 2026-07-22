"use strict";

/**
 * Harpoon Story Engine — Database
 * db.js
 *
 * Supabase client and project CRUD operations.
 * Falls back to filesystem if Supabase is not configured.
 */

const { createClient } = require("@supabase/supabase-js");

const TABLE = "story_engine_projects";

// ── Client ────────────────────────────────────────────────────────
// Read env vars lazily so dotenv has time to load them

let supabase = null;

function getClient() {
  if (!supabase) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_ANON_KEY;
    if (url && key) {
      supabase = createClient(url, key);
    }
  }
  return supabase;
}

function isConfigured() {
  return !!(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY);
}

// ── Projects ──────────────────────────────────────────────────────

async function listProjects() {
  const db = getClient();
  const { data, error } = await db
    .from(TABLE)
    .select("project_id, content, updated_at")
    .order("updated_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data.map((row) => ({
    id: row.project_id,
    kind: row.content?.kind || "story",
    title: row.content?.meta?.title || row.project_id,
    client: row.content?.meta?.client || "",
    accent_color: row.content?.meta?.accent_color || "#1A3F6F",
    folder: row.content?.meta?.folder || "",
    backup_of: row.content?.meta?.backup_of || "",
    note: row.content?.meta?.note || "",
    last_saved: row.updated_at,
  }));
}

/**
 * All projects sharing a meta.group_id — the read side of the group
 * mechanism (see renderer/groups.js for how this gets turned into
 * per-kind nav data). Basename-agnostic: works for any content kind.
 */
async function getProjectsByGroupId(groupId) {
  const db = getClient();
  const { data, error } = await db
    .from(TABLE)
    .select("project_id, content")
    .eq("content->meta->>group_id", groupId);

  if (error) throw new Error(error.message);
  return data.map((row) => ({
    project_id: row.project_id,
    meta: row.content?.meta || {},
  }));
}

async function getProject(projectId) {
  const db = getClient();
  const { data, error } = await db
    .from(TABLE)
    .select("content")
    .eq("project_id", projectId)
    .single();

  if (error) throw new Error(error.message);
  return data.content;
}

async function saveProject(projectId, content) {
  const db = getClient();
  console.log(
    projectId,
    "configured:",
    isConfigured(),
    "client:",
    !!db,
  );

  // Update last_saved in content
  if (content.meta) {
    content.meta.last_saved = new Date().toISOString();
  }

  const { error } = await db
    .from(TABLE)
    .upsert(
      { project_id: projectId, content, updated_at: new Date().toISOString() },
      { onConflict: "project_id" },
    );

  if (error) throw new Error(error.message);
  return content;
}

async function createProject(projectId, content) {
  const db = getClient();

  // Check if already exists
  const { data: existing } = await db
    .from(TABLE)
    .select("project_id")
    .eq("project_id", projectId)
    .single();

  if (existing) throw new Error("Project already exists");

  const { data, error } = await db
    .from(TABLE)
    .insert({
      project_id: projectId,
      content,
      updated_at: new Date().toISOString(),
    })
    .select();

  if (error) throw new Error(error.message);
  return content;
}

async function deleteProject(projectId) {
  const db = getClient();
  const { error } = await db.from(TABLE).delete().eq("project_id", projectId);

  if (error) throw new Error(error.message);
}

// ── Presence ──────────────────────────────────────────────────────
// Lightweight "who has this story open" awareness.
// Editor name comes from EDITOR_NAME in .env, falls back to hostname.

const os = require("os");
const PRESENCE_TABLE  = "story_presence";
const STALE_MINUTES   = 3; // rows older than this are ignored

function editorName() {
  return process.env.EDITOR_NAME || os.hostname().split(".")[0];
}

async function joinPresence(projectId) {
  const db = getClient();
  if (!db) return;
  const { error } = await db.from(PRESENCE_TABLE).upsert(
    { project_id: projectId, editor_name: editorName(), last_seen: new Date().toISOString() },
    { onConflict: "project_id,editor_name" }
  );
  if (error) console.warn("presence join:", error.message);
}

async function leavePresence(projectId) {
  const db = getClient();
  if (!db) return;
  await db.from(PRESENCE_TABLE)
    .delete()
    .eq("project_id", projectId)
    .eq("editor_name", editorName());
}

async function heartbeatPresence(projectId) {
  return joinPresence(projectId); // upsert refreshes last_seen
}

async function getOtherEditors(projectId) {
  const db = getClient();
  if (!db) return [];
  const cutoff = new Date(Date.now() - STALE_MINUTES * 60 * 1000).toISOString();
  const { data, error } = await db.from(PRESENCE_TABLE)
    .select("editor_name, last_seen")
    .eq("project_id", projectId)
    .neq("editor_name", editorName())
    .gte("last_seen", cutoff);
  if (error) return [];
  return data || [];
}

module.exports = {
  isConfigured,
  listProjects,
  getProject,
  getProjectsByGroupId,
  saveProject,
  createProject,
  deleteProject,
  editorName,
  joinPresence,
  leavePresence,
  heartbeatPresence,
  getOtherEditors,
};
