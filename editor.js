"use strict";

/**
 * Harpoon Story Engine — Editor Server
 * editor.js
 *
 * Local authoring server. Run with: node editor.js
 * Opens at http://localhost:3001
 */

const express = require("express");
const fs = require("fs");
const path = require("path");
const chokidar = require("chokidar");

const { validate } = require("./renderer/validate");
const { render } = require("./renderer/index");

const app = express();
const PORT = 3001;

// ── Paths ─────────────────────────────────────────────────────────

const ROOT = __dirname;
const PROJECTS_DIR = path.join(ROOT, "projects");
const PREVIEW_DIR = path.join(ROOT, ".preview");
const EDITOR_DIR = path.join(ROOT, "editor");
const RECENT_FILE = path.join(ROOT, ".editor-recent.json");
const SCHEMA_FILE = path.join(ROOT, "schema", "content.schema.json");

// Ensure directories exist
fs.mkdirSync(PROJECTS_DIR, { recursive: true });
fs.mkdirSync(PREVIEW_DIR, { recursive: true });
fs.mkdirSync(EDITOR_DIR, { recursive: true });

// ── Middleware ────────────────────────────────────────────────────

app.use(express.json({ limit: "10mb" }));

// Explicit MIME types — express.static can misserve .css as octet-stream
const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".mp4": "video/mp4",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
};

const staticOpts = {
  setHeaders(res, filePath) {
    const ext = require("path").extname(filePath).toLowerCase();
    if (mime[ext]) res.setHeader("Content-Type", mime[ext]);
  },
};

// Serve editor UI static files
app.use("/editor", express.static(EDITOR_DIR, staticOpts));

// Serve preview output
app.use("/preview", express.static(PREVIEW_DIR, staticOpts));

// ── Recent projects ───────────────────────────────────────────────

function getRecent() {
  try {
    return JSON.parse(fs.readFileSync(RECENT_FILE, "utf8"));
  } catch {
    return [];
  }
}

function addRecent(projectId) {
  let recent = getRecent().filter((id) => id !== projectId);
  recent.unshift(projectId);
  recent = recent.slice(0, 8);
  fs.writeFileSync(RECENT_FILE, JSON.stringify(recent), "utf8");
}

// ── Render a project to .preview/ ────────────────────────────────

function renderToPreview(projectId) {
  const contentPath = path.join(PROJECTS_DIR, projectId, "content.json");
  if (!fs.existsSync(contentPath))
    return { ok: false, error: "Project not found" };

  let content;
  try {
    content = JSON.parse(fs.readFileSync(contentPath, "utf8"));
  } catch (err) {
    return { ok: false, error: "Invalid JSON: " + err.message };
  }

  const errors = validate(content);
  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const outDir = path.join(PREVIEW_DIR, projectId);
  try {
    render(content, outDir);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// ── API routes ────────────────────────────────────────────────────

// List all projects
app.get("/api/projects", (req, res) => {
  let projects = [];
  if (fs.existsSync(PROJECTS_DIR)) {
    projects = fs
      .readdirSync(PROJECTS_DIR, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => {
        const contentPath = path.join(PROJECTS_DIR, e.name, "content.json");
        let meta = {};
        try {
          const content = JSON.parse(fs.readFileSync(contentPath, "utf8"));
          meta = content.meta || {};
        } catch {}
        const stat = fs.existsSync(contentPath)
          ? fs.statSync(contentPath)
          : null;
        return {
          id: e.name,
          title: meta.title || e.name,
          client: meta.client || "",
          last_saved: stat ? stat.mtime.toISOString() : null,
          accent_color: meta.accent_color || "#1A3F6F",
        };
      });
  }

  const recent = getRecent();
  projects.sort((a, b) => {
    const ai = recent.indexOf(a.id);
    const bi = recent.indexOf(b.id);
    if (ai === -1 && bi === -1) return 0;
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });

  res.json({ projects, recent });
});

// Get a single project's content
app.get("/api/project/:id", (req, res) => {
  const contentPath = path.join(PROJECTS_DIR, req.params.id, "content.json");
  if (!fs.existsSync(contentPath)) {
    return res.status(404).json({ error: "Project not found" });
  }
  try {
    const content = JSON.parse(fs.readFileSync(contentPath, "utf8"));
    addRecent(req.params.id);
    res.json(content);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Save a project (autosave endpoint)
app.post("/api/project/:id/save", (req, res) => {
  const projectId = req.params.id;
  const projectDir = path.join(PROJECTS_DIR, projectId);
  fs.mkdirSync(projectDir, { recursive: true });

  const contentPath = path.join(projectDir, "content.json");
  const content = req.body;

  // Update last_saved
  if (content.meta) {
    content.meta.last_saved = new Date().toISOString();
  }

  // Write JSON
  try {
    fs.writeFileSync(contentPath, JSON.stringify(content, null, 2), "utf8");
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }

  // Render to preview
  const result = renderToPreview(projectId);
  addRecent(projectId);

  res.json(result);
});

// Create a new project
app.post("/api/project/create", (req, res) => {
  const { id, title, client, accent_color, accent_color_2 } = req.body;

  if (!id || !title) {
    return res.status(400).json({ error: "id and title are required" });
  }

  const projectDir = path.join(PROJECTS_DIR, id);
  const contentPath = path.join(projectDir, "content.json");

  if (fs.existsSync(contentPath)) {
    return res.status(409).json({ error: "Project already exists" });
  }

  fs.mkdirSync(projectDir, { recursive: true });

  const content = {
    meta: {
      project_id: id,
      title,
      language: "en",
      client: client || "",
      date: new Date().toISOString().split("T")[0],
      accent_color: accent_color || "#1A3F6F",
      accent_color_2: accent_color_2 || "#C9A84C",
      last_saved: new Date().toISOString(),
      version: 1,
    },
    config: {
      layout_mode: "multi-page",
      password_gate: { enabled: false },
      pwa: { enabled: false },
      analytics: {},
    },
    cover: {
      headline: title,
      body: "",
      cta_primary: { label: "Read more", href: "#section-1" },
    },
    sections: [],
  };

  try {
    fs.writeFileSync(contentPath, JSON.stringify(content, null, 2), "utf8");
    renderToPreview(id);
    addRecent(id);
    res.json({ ok: true, id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Serve the schema
app.get("/api/schema", (req, res) => {
  try {
    res.json(JSON.parse(fs.readFileSync(SCHEMA_FILE, "utf8")));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Trigger a manual re-render
app.post("/api/project/:id/render", (req, res) => {
  const result = renderToPreview(req.params.id);
  res.json(result);
});

// ── Home screen ───────────────────────────────────────────────────

app.get("/", (req, res) => {
  res.sendFile(path.join(EDITOR_DIR, "home.html"));
});

// ── Asset passthrough ─────────────────────────────────────────────
// Rendered HTML uses root-relative paths like /projectId/css/tokens.css
// /edit/:id would otherwise match these — this middleware must come first.
// Asset passthrough middleware — handles /projectId/css/..., /projectId/js/...
// Must come before the file watcher and after the /edit/:id route.
app.use((req, res, next) => {
  // Only intercept paths that look like /<projectId>/<assetType>/...
  const parts = req.path.split("/").filter(Boolean);
  if (parts.length < 2) return next();

  const [projectId, assetType, ...rest] = parts;

  // Don't intercept editor or API routes
  if (
    projectId === "api" ||
    projectId === "edit" ||
    projectId === "preview" ||
    projectId === "editor"
  )
    return next();

  const mimeMap = {
    ".css": "text/css",
    ".js": "application/javascript",
    ".html": "text/html; charset=utf-8",
    ".json": "application/json",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".svg": "image/svg+xml",
    ".webp": "image/webp",
    ".mp4": "video/mp4",
  };

  const filePath = path.join(PREVIEW_DIR, projectId, assetType, ...rest);
  if (!fs.existsSync(filePath)) return res.status(404).send("Not found");

  const ext = path.extname(filePath).toLowerCase();
  if (mimeMap[ext]) res.setHeader("Content-Type", mimeMap[ext]);
  res.sendFile(filePath);
});

app.get("/edit/:id", (req, res) => {
  res.sendFile(path.join(EDITOR_DIR, "editor.html"));
});

// ── File watcher (dev convenience) ───────────────────────────────
// If content.json is edited externally, re-render automatically

chokidar
  .watch(path.join(PROJECTS_DIR, "**", "content.json"), {
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 300 },
  })
  .on("change", (filePath) => {
    const projectId = path.basename(path.dirname(filePath));
    console.log(`↺  Re-rendering ${projectId}...`);
    renderToPreview(projectId);
  });

// ── Start ─────────────────────────────────────────────────────────

// Pre-render all existing projects on startup
if (fs.existsSync(PROJECTS_DIR)) {
  fs.readdirSync(PROJECTS_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .forEach((e) => {
      const result = renderToPreview(e.name);
      if (result.ok) {
        console.log(`✓  Pre-rendered ${e.name}`);
      }
    });
}

app.listen(PORT, () => {
  console.log(`\n  Harpoon Story Engine — Editor`);
  console.log(`  http://localhost:${PORT}\n`);

  // Auto-open in browser on Mac
  const { exec } = require("child_process");
  exec(`open http://localhost:${PORT}`);
});
