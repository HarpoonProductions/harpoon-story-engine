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
    .select("project_id, content->meta, updated_at")
    .order("updated_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data.map((row) => ({
    id: row.project_id,
    title: row.content?.title || row.project_id,
    client: row.content?.client || "",
    accent_color: row.content?.accent_color || "#1A3F6F",
    last_saved: row.updated_at,
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

module.exports = {
  isConfigured,
  listProjects,
  getProject,
  saveProject,
  createProject,
  deleteProject,
};
