"use strict";

// Load environment variables from .env file
// In Electron, check Documents folder first; in dev, use repo root
const _os = require("os");
const _envPaths = [
  require("path").join(
    _os.homedir(),
    "Documents",
    "Harpoon Story Engine",
    ".env",
  ),
  require("path").join(__dirname, ".env"),
];
for (const _ep of _envPaths) {
  if (require("fs").existsSync(_ep)) {
    require("dotenv").config({ path: _ep });
    break;
  }
}

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
const db = require("./db");

// AWS S3 upload (optional — only active if AWS credentials are set in environment)
let S3Client, Upload;
try {
  ({ S3Client } = require("@aws-sdk/client-s3"));
  ({ Upload } = require("@aws-sdk/lib-storage"));
} catch {}

const S3_BUCKET = process.env.S3_BUCKET || "";
const AWS_REGION =
  process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "eu-west-2";
const { render, renderSection } = require("./renderer/index");
const { resolveGroup } = require("./renderer/groups");

const app = express();
const PORT = 3001;

// ── Paths ─────────────────────────────────────────────────────────

const ROOT = __dirname;

// When running inside Electron, the app bundle (.asar) is read-only.
// Projects, previews, and recent file must live in user's Documents folder.
const isElectron = !!process.versions.electron;
const USER_DATA = isElectron
  ? path.join(require("os").homedir(), "Documents", "Harpoon Story Engine")
  : ROOT;

const PROJECTS_DIR = path.join(USER_DATA, "projects");
const PREVIEW_DIR = path.join(USER_DATA, ".preview");
const RECENT_FILE = path.join(USER_DATA, ".editor-recent.json");

// Editor UI and schema live inside the bundle (read-only is fine)
const EDITOR_DIR = path.join(ROOT, "editor");
const SCHEMA_FILE = path.join(ROOT, "schema", "content.schema.json");

// Ensure directories exist
// Only create writable directories — EDITOR_DIR is inside the bundle (read-only)
fs.mkdirSync(PROJECTS_DIR, { recursive: true });
fs.mkdirSync(PREVIEW_DIR, { recursive: true });

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

// No-cache options for editor UI — ensures editor.html/JS are always fresh after restart
const noCacheOpts = {
  setHeaders(res, filePath) {
    const ext = require("path").extname(filePath).toLowerCase();
    if (mime[ext]) res.setHeader("Content-Type", mime[ext]);
    res.setHeader("Cache-Control", "no-store");
  },
};

// Serve editor UI static files (no-cache so changes are immediate after restart)
app.use("/editor", express.static(EDITOR_DIR, noCacheOpts));

// Serve preview CSS and JS from SOURCE — bypasses stale copies in .preview/
const CSS_DIR = path.join(ROOT, "css");
const JS_DIR  = path.join(ROOT, "js");

app.get(/^\/preview\/[^/]+\/css\/(.+)$/, (req, res) => {
  const rel = req.params[0];
  const filePath = path.join(CSS_DIR, rel);
  res.setHeader("Cache-Control", "no-store");
  res.sendFile(filePath, (err) => { if (err) res.status(404).end(); });
});

app.get(/^\/preview\/[^/]+\/js\/(.+)$/, (req, res) => {
  const rel = req.params[0];
  const filePath = path.join(JS_DIR, rel);
  res.setHeader("Cache-Control", "no-store");
  res.sendFile(filePath, (err) => { if (err) res.status(404).end(); });
});

// Serve preview output (HTML and assets other than CSS/JS)
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

async function renderToPreview(projectId, contentObj) {
  let content = contentObj;

  // If no content passed, try to load from filesystem or skip
  if (!content) {
    const contentPath = path.join(PROJECTS_DIR, projectId, "content.json");
    if (!fs.existsSync(contentPath))
      return { ok: false, error: "Project not found" };
    try {
      content = JSON.parse(fs.readFileSync(contentPath, "utf8"));
    } catch (err) {
      return { ok: false, error: "Invalid JSON: " + err.message };
    }
  }

  const errors = validate(content);
  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const outDir = path.join(PREVIEW_DIR, projectId);
  try {
    await render(content, outDir, { basePath: "" });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// ── API routes ────────────────────────────────────────────────────

// List all projects
app.get("/api/projects", async (req, res) => {
  try {
    let projects = [];

    if (db.isConfigured()) {
      projects = await db.listProjects();
    } else {
      // Filesystem fallback
      if (fs.existsSync(PROJECTS_DIR)) {
        projects = fs
          .readdirSync(PROJECTS_DIR, { withFileTypes: true })
          .filter((e) => e.isDirectory())
          .map((e) => {
            const contentPath = path.join(PROJECTS_DIR, e.name, "content.json");
            let meta = {};
            try {
              meta =
                JSON.parse(fs.readFileSync(contentPath, "utf8")).meta || {};
            } catch {}
            const stat = fs.existsSync(contentPath)
              ? fs.statSync(contentPath)
              : null;
            let kind = "story";
            try {
              kind = JSON.parse(fs.readFileSync(contentPath, "utf8")).kind || "story";
            } catch {}
            return {
              id: e.name,
              kind,
              title: meta.title || e.name,
              client: meta.client || "",
              last_saved: stat ? stat.mtime.toISOString() : null,
              accent_color: meta.accent_color || "#1A3F6F",
              folder: meta.folder || "",
              backup_of: meta.backup_of || "",
            };
          });
      }
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
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get a single project's content
app.get("/api/project/:id", async (req, res) => {
  try {
    let content;
    if (db.isConfigured()) {
      content = await db.getProject(req.params.id);
      // Register presence now that the story is open
      db.joinPresence(req.params.id).catch(() => {});
    } else {
      const contentPath = path.join(
        PROJECTS_DIR,
        req.params.id,
        "content.json",
      );
      if (!fs.existsSync(contentPath))
        return res.status(404).json({ error: "Project not found" });
      content = JSON.parse(fs.readFileSync(contentPath, "utf8"));
    }
    addRecent(req.params.id);
    res.json(content);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// Render a project on demand and return its local preview URL. Generic
// across content kinds — renderToPreview() already dispatches on
// content.kind via renderer/index.js's render(), so this needed no
// kind-specific logic. Used by the home screen's "Preview" action for
// content kinds (e.g. graduation-guide) that don't have a field-editing
// UI — /edit/:id is narrative-story-shaped and would misrender them.
app.get("/api/project/:id/preview", async (req, res) => {
  const projectId = req.params.id;
  try {
    let content;
    if (db.isConfigured()) {
      content = await db.getProject(projectId);
    } else {
      const contentPath = path.join(PROJECTS_DIR, projectId, "content.json");
      if (!fs.existsSync(contentPath))
        return res.status(404).json({ ok: false, error: "Project not found" });
      content = JSON.parse(fs.readFileSync(contentPath, "utf8"));
    }
    const result = await renderToPreview(projectId, content);
    if (!result.ok) {
      const msg = result.error || (result.errors ? result.errors.map((e) => e.message).join("; ") : "Render failed");
      return res.status(500).json({ ok: false, error: msg });
    }
    res.json({ ok: true, url: `/preview/${projectId}/` });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Presence: heartbeat (called every 60s by the editor client)
app.post("/api/project/:id/presence/heartbeat", async (req, res) => {
  if (db.isConfigured()) await db.heartbeatPresence(req.params.id).catch(() => {});
  res.json({ ok: true });
});

// Presence: leave (called when editor navigates away)
app.post("/api/project/:id/presence/leave", async (req, res) => {
  if (db.isConfigured()) await db.leavePresence(req.params.id).catch(() => {});
  res.json({ ok: true });
});

// Presence: who else is here?
app.get("/api/project/:id/presence", async (req, res) => {
  if (!db.isConfigured()) return res.json({ others: [] });
  const others = await db.getOtherEditors(req.params.id).catch(() => []);
  res.json({ others, me: db.editorName() });
});

// Save a project (autosave endpoint)
app.post("/api/project/:id/save", async (req, res) => {
  const projectId = req.params.id;
  const body = req.body;

  try {
    if (db.isConfigured()) {
      await db.saveProject(projectId, body);
    } else {
      // Filesystem fallback
      const projectDir = path.join(PROJECTS_DIR, projectId);
      fs.mkdirSync(projectDir, { recursive: true });
      if (body.meta) body.meta.last_saved = new Date().toISOString();
      fs.writeFileSync(
        path.join(projectDir, "content.json"),
        JSON.stringify(body, null, 2),
        "utf8",
      );
    }

    // Render to local preview from content in memory (non-blocking — preview
    // failures don't roll back the save)
    let renderWarning = null;
    try {
      const renderResult = await renderToPreview(projectId, body);
      if (!renderResult.ok) {
        const msg = renderResult.error ||
          (renderResult.errors ? renderResult.errors.map(e => e.message).join("; ") : "Render failed");
        console.warn(`[render] ${projectId}: ${msg}`);
        renderWarning = msg;
      }
    } catch (renderErr) {
      console.error(`[render] ${projectId}: ${renderErr.message}`);
      renderWarning = renderErr.message;
    }

    addRecent(projectId);
    res.json({ ok: true, renderWarning });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Create a new project
app.post("/api/project/create", async (req, res) => {
  const { id, title, client, accent_color, accent_color_2 } = req.body;

  if (!id || !title) {
    return res.status(400).json({ error: "id and title are required" });
  }

  const projectDir = path.join(PROJECTS_DIR, id);
  const contentPath = path.join(projectDir, "content.json");

  const newContent = {
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
    if (db.isConfigured()) {
      await db.createProject(id, newContent);
    } else {
      fs.mkdirSync(projectDir, { recursive: true });
      fs.writeFileSync(
        contentPath,
        JSON.stringify(newContent, null, 2),
        "utf8",
      );
    }
    await renderToPreview(id, newContent);
    addRecent(id);
    res.json({ ok: true, id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Backup a project ──────────────────────────────────────────────
// Deep-copies the current content into a new project row tagged
// meta.folder = "backups". The copy is independent — no sync.

app.post("/api/project/:id/backup", async (req, res) => {
  const { id } = req.params;
  const now = new Date();
  const stamp = now.toISOString().replace(/[-:T]/g, "").slice(0, 12); // YYYYMMDDHHmm
  const backupId = `${id}--bak-${stamp}`;

  try {
    let original;
    if (db.isConfigured()) {
      original = await db.getProject(id);
    } else {
      const p = path.join(PROJECTS_DIR, id, "content.json");
      original = JSON.parse(fs.readFileSync(p, "utf8"));
    }
    if (!original) return res.status(404).json({ error: "Project not found" });

    // Deep copy and tag as backup
    const copy = JSON.parse(JSON.stringify(original));
    if (!copy.meta) copy.meta = {};
    copy.meta.project_id = backupId;
    copy.meta.folder     = "backups";
    copy.meta.backup_of  = id;
    copy.meta.backed_up_at = now.toISOString();
    copy.meta.last_saved   = now.toISOString();

    if (db.isConfigured()) {
      await db.createProject(backupId, copy);
    } else {
      const backupDir = path.join(PROJECTS_DIR, backupId);
      fs.mkdirSync(backupDir, { recursive: true });
      fs.writeFileSync(path.join(backupDir, "content.json"), JSON.stringify(copy, null, 2), "utf8");
    }

    res.json({ ok: true, backupId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Move a project to/from a folder ──────────────────────────────
// PATCH body: { folder: "backups" | "" }

app.patch("/api/project/:id/folder", async (req, res) => {
  const { id } = req.params;
  const { folder } = req.body;

  try {
    let content;
    if (db.isConfigured()) {
      content = await db.getProject(id);
    } else {
      const p = path.join(PROJECTS_DIR, id, "content.json");
      content = JSON.parse(fs.readFileSync(p, "utf8"));
    }
    if (!content) return res.status(404).json({ error: "Project not found" });

    if (!content.meta) content.meta = {};
    if (folder) {
      content.meta.folder = folder;
    } else {
      delete content.meta.folder;
    }

    if (db.isConfigured()) {
      await db.saveProject(id, content);
    } else {
      const p = path.join(PROJECTS_DIR, id, "content.json");
      fs.writeFileSync(p, JSON.stringify(content, null, 2), "utf8");
    }

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/project/:id/note — update meta.note
app.patch("/api/project/:id/note", async (req, res) => {
  const { id } = req.params;
  const { note } = req.body;
  try {
    let content;
    if (db.isConfigured()) {
      content = await db.getProject(id);
    } else {
      const p = path.join(PROJECTS_DIR, id, "content.json");
      content = JSON.parse(fs.readFileSync(p, "utf8"));
    }
    if (!content) return res.status(404).json({ error: "Project not found" });
    if (!content.meta) content.meta = {};
    if (note) {
      content.meta.note = note;
    } else {
      delete content.meta.note;
    }
    if (db.isConfigured()) {
      await db.saveProject(id, content);
    } else {
      const p = path.join(PROJECTS_DIR, id, "content.json");
      fs.writeFileSync(p, JSON.stringify(content, null, 2), "utf8");
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Serve token set registry
app.get("/api/tokens", (req, res) => {
  try {
    const registry = JSON.parse(
      fs.readFileSync(path.join(ROOT, "tokens", "registry.json"), "utf8"),
    );
    res.json(registry);
  } catch (err) {
    res.json({ token_sets: [{ id: "default", label: "Harpoon Default" }] });
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

// Live membership for the editor's "Other members of this group" panel —
// same resolver the renderer itself uses (renderer/groups.js), so what
// you see here is exactly what a render would pick up. ?exclude= omits
// the project currently being edited (it's not "another member" of itself).
app.get("/api/groups/:groupId", async (req, res) => {
  try {
    const members = await resolveGroup(req.params.groupId, req.query.exclude || null);
    res.json({ members });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Return CSS class names found in a rendered section (for the CSS override panel)
app.get("/api/project/:id/section/:index/classes", async (req, res) => {
  try {
    let content;
    if (db.isConfigured()) {
      content = await db.getProject(req.params.id);
    } else {
      const contentPath = path.join(PROJECTS_DIR, req.params.id, "content.json");
      if (!fs.existsSync(contentPath)) return res.status(404).json({ error: "Project not found" });
      content = JSON.parse(fs.readFileSync(contentPath, "utf8"));
    }
    const section = content.sections[parseInt(req.params.index, 10)];
    if (!section) return res.status(404).json({ error: "Section not found" });

    const html = renderSection(section);

    // Extract every class name, deduplicate, sort by prefix
    const classRe = /class="([^"]+)"/g;
    const seen = new Set();
    let m;
    while ((m = classRe.exec(html)) !== null) {
      m[1].trim().split(/\s+/).forEach(c => { if (c) seen.add(c); });
    }
    const classes = Array.from(seen).sort();
    res.json({ sectionId: section.id, classes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Trigger a manual re-render
app.post("/api/project/:id/render", async (req, res) => {
  const result = await renderToPreview(req.params.id);
  res.json(result);
});

// ── File upload ──────────────────────────────────────────────────
// Receives a multipart form upload, sends to S3, returns the public URL.
// Requires S3_BUCKET env var and valid AWS credentials.
// Uses busboy for reliable multipart parsing.

const Busboy = require("busboy");

// sharp is optional — if it fails to load (e.g. wrong platform binary),
// images will be uploaded uncompressed. Run:
//   npm install --os=darwin --cpu=arm64 sharp
// to install the correct binary for Apple Silicon Macs.
let sharp = null;
try {
  sharp = require("sharp");
} catch (err) {
  console.warn("⚠  sharp not available — images will upload uncompressed.");
  console.warn("   Fix: npm install --os=darwin --cpu=arm64 sharp");
}

app.post("/api/project/:id/upload", (req, res) => {
  if (!S3Client || !S3_BUCKET) {
    return res.status(503).json({
      error:
        "S3 not configured. Set S3_BUCKET, AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in your environment.",
    });
  }

  const projectId = req.params.id;
  let settled = false;

  try {
    const bb = Busboy({ headers: req.headers });

    bb.on("file", async (fieldname, fileStream, info) => {
      const { filename, mimeType } = info;
      const safeName = (filename || "upload-" + Date.now()).replace(
        /[^a-zA-Z0-9._-]/g,
        "_",
      );
      const s3Key = `${projectId}/images/${safeName}`;

      // Collect chunks
      const chunks = [];
      fileStream.on("data", (chunk) => chunks.push(chunk));
      fileStream.on("end", async () => {
        if (settled) return;
        try {
          const fileBuffer = Buffer.concat(chunks);
          const isVideo = (mimeType || "").startsWith("video/");
          const isImage =
            !isVideo &&
            ((mimeType || "").startsWith("image/") ||
              /\.(jpe?g|png|webp|gif|tiff?)$/i.test(safeName));

          const s3 = new S3Client({ region: AWS_REGION });

          // ── Step 1: upload original untouched ────────────────────
          const origKey = `${projectId}/originals/${safeName}`;
          await new Upload({
            client: s3,
            params: {
              Bucket: S3_BUCKET,
              Key: origKey,
              Body: fileBuffer,
              ContentType: mimeType || "application/octet-stream",
              CacheControl: "public, max-age=31536000",
            },
          }).done();
          console.log(`✓  Original: ${origKey}`);

          // ── Step 2: compress image and upload processed version ───
          let processedBuffer = fileBuffer;
          let processedMime = mimeType || "application/octet-stream";
          let processedName = safeName;

          if (isImage && sharp) {
            // Strip extension, add -hpn2560.jpg suffix
            const baseName = safeName.replace(/\.[^.]+$/, "");
            processedName = baseName + "-hpn2560.jpg";
            processedMime = "image/jpeg";

            processedBuffer = await sharp(fileBuffer)
              .rotate() // auto-rotate from EXIF
              .resize(2560, 2560, {
                fit: "inside", // preserve aspect ratio
                withoutEnlargement: true, // never upscale
              })
              .jpeg({
                quality: 82,
                mozjpeg: true, // better compression
                chromaSubsampling: "4:4:4", // preserve colour fidelity
              })
              .toBuffer();

            const origSize = Math.round(fileBuffer.length / 1024);
            const procSize = Math.round(processedBuffer.length / 1024);
            console.log(`✓  Compressed: ${origSize}KB → ${procSize}KB`);
          }

          const s3Key = `${projectId}/images/${processedName}`;
          await new Upload({
            client: s3,
            params: {
              Bucket: S3_BUCKET,
              Key: s3Key,
              Body: processedBuffer,
              ContentType: processedMime,
              CacheControl: "public, max-age=31536000",
            },
          }).done();
          settled = true;

          // Use CloudFront URL — images are immediately available via CloudFront
          // as soon as they land in S3, without needing a deployment step.
          // This URL is also correct for production use.
          const deliveryDomain = process.env.DELIVERY_DOMAIN || "";
          const publicUrl = deliveryDomain
            ? `https://${deliveryDomain}/${s3Key}`
            : `https://${S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${s3Key}`;

          console.log(`✓  Uploaded: ${s3Key} → ${publicUrl}`);
          res.json({
            ok: true,
            url: publicUrl,
            key: s3Key,
            originalKey: origKey,
            compressed: isImage,
          });
        } catch (err) {
          if (!settled) {
            settled = true;
            console.error("Upload error:", err.message);
            res.status(500).json({ error: err.message });
          }
        }
      });

      fileStream.on("error", (err) => {
        if (!settled) {
          settled = true;
          res.status(500).json({ error: err.message });
        }
      });
    });

    bb.on("error", (err) => {
      if (!settled) {
        settled = true;
        res
          .status(400)
          .json({ error: "Multipart parse error: " + err.message });
      }
    });

    req.pipe(bb);
  } catch (err) {
    if (!settled) {
      settled = true;
      res.status(500).json({ error: err.message });
    }
  }
});

// ── Frame extraction ──────────────────────────────────────────────
// Accepts a video file upload, extracts JPEG frames via ffmpeg-static,
// uploads them to S3, and streams progress back via SSE.

const activeExtractionStreams = new Map();

// SSE endpoint — client opens this before POSTing the video
app.get("/api/project/:id/extract-frames/events", (req, res) => {
  const jobId = req.query.jobId;
  if (!jobId) return res.status(400).json({ error: "jobId required" });

  res.set({
    "Content-Type":  "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection":    "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.flushHeaders();
  // Send an immediate comment so the client knows the connection is live
  res.write(": connected\n\n");

  // Heartbeat every 5s keeps the connection alive during long extractions
  const hb = setInterval(() => res.write(": heartbeat\n\n"), 5000);

  activeExtractionStreams.set(jobId, res);
  req.on("close", () => {
    clearInterval(hb);
    activeExtractionStreams.delete(jobId);
  });
});

function sendExtractionEvent(jobId, data) {
  const res = activeExtractionStreams.get(jobId);
  if (res) res.write(`data: ${JSON.stringify(data)}\n\n`);
}

// POST endpoint — receives the video file and options
app.post("/api/project/:id/extract-frames", (req, res) => {
  if (!S3Client || !S3_BUCKET) {
    return res.status(503).json({ error: "S3 not configured." });
  }

  const projectId = req.params.id;
  const jobId     = req.query.jobId || "";

  let settled = false;
  const send  = (data) => sendExtractionEvent(jobId, data);
  const fail  = (msg)  => {
    if (!settled) { settled = true; send({ type: "error", message: msg }); res.json({ ok: false, error: msg }); }
  };

  let tmpVideoPath = null;
  let tmpDir       = null;

  try {
    const bb = Busboy({ headers: req.headers });
    let opts = { frames: 120, prefix: "frame-", digits: 3, quality: 3 };

    bb.on("field", (name, val) => {
      if (name === "frames")  opts.frames  = parseInt(val) || 120;
      if (name === "prefix")  opts.prefix  = val || "frame-";
      if (name === "digits")  opts.digits  = parseInt(val) || 3;
      if (name === "quality") opts.quality = parseInt(val) || 3;
    });

    bb.on("file", (fieldname, fileStream, info) => {
      const ext  = path.extname(info.filename || "video.mp4").toLowerCase() || ".mp4";
      tmpDir       = fs.mkdtempSync(path.join(require("os").tmpdir(), "hse-frames-"));
      tmpVideoPath = path.join(tmpDir, `input${ext}`);
      const outDir = path.join(tmpDir, "frames");
      fs.mkdirSync(outDir);

      const writeStream = fs.createWriteStream(tmpVideoPath);
      fileStream.pipe(writeStream);

      writeStream.on("finish", async () => {
        try {
          const ffmpegStatic  = require("ffmpeg-static");
          const ffprobePath   = require("ffprobe-static").path;
          const ffmpeg        = require("fluent-ffmpeg");
          ffmpeg.setFfmpegPath(ffmpegStatic);
          ffmpeg.setFfprobePath(ffprobePath);

          // ── 1. Probe duration ─────────────────────────────────────
          send({ type: "stage", stage: "probing", message: "Reading video…" });

          const duration = await new Promise((resolve, reject) => {
            ffmpeg.ffprobe(tmpVideoPath, (err, meta) => {
              if (err) return reject(err);
              resolve(meta.format.duration);
            });
          });

          // ── 2. Extract frames ─────────────────────────────────────
          send({ type: "stage", stage: "extracting", message: `Extracting ${opts.frames} frames…`, total: opts.frames });

          const fps    = opts.frames / duration;
          const outPat = path.join(outDir, `${opts.prefix}%0${opts.digits}d.jpg`);

          await new Promise((resolve, reject) => {
            ffmpeg(tmpVideoPath)
              .videoFilter(`fps=${fps}`)
              .frames(opts.frames)
              .outputOptions([`-q:v ${opts.quality}`])
              .output(outPat)
              .on("progress", (info) => {
                send({ type: "progress", stage: "extracting", done: info.frames || 0, total: opts.frames });
              })
              .on("end",   resolve)
              .on("error", reject)
              .run();
          });

          // ── 3. Upload frames ──────────────────────────────────────
          const s3Folder = `${projectId}/frames`;
          const files    = fs.readdirSync(outDir).filter(f => f.endsWith(".jpg")).sort();
          send({ type: "stage", stage: "uploading", message: `Uploading ${files.length} frames to S3…`, total: files.length });

          const s3 = new S3Client({ region: AWS_REGION });
          let uploaded = 0;

          for (const file of files) {
            const s3Key = `${s3Folder}/${file}`;
            await new Upload({
              client: s3,
              params: {
                Bucket:       S3_BUCKET,
                Key:          s3Key,
                Body:         fs.readFileSync(path.join(outDir, file)),
                ContentType:  "image/jpeg",
                CacheControl: "public, max-age=31536000, immutable",
              },
            }).done();
            uploaded++;
            send({ type: "progress", stage: "uploading", done: uploaded, total: files.length });
          }

          // ── 4. Build result ───────────────────────────────────────
          const deliveryDomain = process.env.DELIVERY_DOMAIN || "";
          const baseUrl = deliveryDomain
            ? `https://${deliveryDomain}/${s3Folder}/`
            : `https://${S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${s3Folder}/`;

          const firstFrame = `${baseUrl}${opts.prefix}${String(1).padStart(opts.digits, "0")}.jpg`;

          send({
            type:        "done",
            base_url:    baseUrl,
            poster:      firstFrame,
            frame_count: opts.frames,
            prefix:      opts.prefix,
            digits:      opts.digits,
          });

          if (!settled) { settled = true; res.json({ ok: true }); }

        } catch (err) {
          fail(err.message);
        } finally {
          // Clean up temp files
          try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}
        }
      });

      writeStream.on("error", (err) => fail(err.message));
    });

    bb.on("error", (err) => fail(err.message));
    req.pipe(bb);

  } catch (err) {
    fail(err.message);
  }
});

// ── Deploy via GitHub Actions API ────────────────────────────────
// Triggers the render-deploy workflow with a project ID and target.
// Requires GITHUB_TOKEN and GITHUB_REPO in environment.

// A project's group nav (see renderer/groups.js) is baked into every
// *other* group member's HTML at THEIR own last render — not fetched live
// by the browser. So changing one of these fields makes siblings' already-
// deployed nav stale until they're redeployed too; changing anything else
// about a project (ordinary content) doesn't. meta._groupNavDeployedAs is
// a snapshot of these fields as of this project's last successful deploy
// dispatch, used to tell the difference.
const GROUP_NAV_FIELDS = ["title", "group_label", "group_role", "group_id"];

function groupNavSnapshot(meta) {
  const snap = {};
  GROUP_NAV_FIELDS.forEach((f) => { snap[f] = meta[f] || null; });
  return snap;
}

function groupNavChangedFields(meta) {
  const current = groupNavSnapshot(meta);
  const last = meta._groupNavDeployedAs || null;
  if (!last) return GROUP_NAV_FIELDS.filter((f) => current[f]); // never deployed before — only flag fields actually set
  return GROUP_NAV_FIELDS.filter((f) => current[f] !== last[f]);
}

async function dispatchDeploy(projectId, target, githubToken, githubRepo) {
  const response = await fetch(
    `https://api.github.com/repos/${githubRepo}/actions/workflows/render-deploy.yml/dispatches`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${githubToken}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({ ref: "main", inputs: { project: projectId, target } }),
    },
  );
  if (response.status !== 204) {
    const text = await response.text();
    throw new Error(`GitHub API returned ${response.status}: ${text}`);
  }
}

app.post("/api/project/:id/deploy", async (req, res) => {
  const projectId = req.params.id;
  const target = req.body.target || "production"; // 'staging' or 'production'
  const confirmed = !!req.body.confirmed;
  const includeSiblings = !!req.body.includeSiblings;
  const githubToken = process.env.GITHUB_TOKEN || "";
  const githubRepo =
    process.env.GITHUB_REPO || "HarpoonProductions/harpoon-story-engine";

  if (!githubToken) {
    return res.status(503).json({
      error: "GITHUB_TOKEN not set in .env — required to trigger deployments.",
    });
  }

  try {
    let content = null;
    if (db.isConfigured()) {
      content = await db.getProject(projectId).catch(() => null);
    } else {
      const contentPath = path.join(PROJECTS_DIR, projectId, "content.json");
      if (fs.existsSync(contentPath)) content = JSON.parse(fs.readFileSync(contentPath, "utf8"));
    }

    const isGrouped = content?.meta?.group_id;

    // ── Staleness check — only for grouped projects, only once, before
    // anything is actually dispatched ───────────────────────────────
    if (isGrouped && !confirmed) {
      const changedFields = groupNavChangedFields(content.meta);
      if (changedFields.length) {
        const siblings = await resolveGroup(content.meta.group_id, projectId);
        if (siblings.length) {
          return res.json({
            needsConfirmation: true,
            changedFields,
            siblings: siblings.map((s) => ({ project_id: s.project_id, title: s.title })),
          });
        }
      }
    }

    // ── Trigger the workflow(s) ─────────────────────────────────────
    // Content is read directly from Supabase by the Action — no git
    // commit needed.
    const siblingIds = includeSiblings && isGrouped
      ? (await resolveGroup(content.meta.group_id, projectId)).map((s) => s.project_id)
      : [];

    await dispatchDeploy(projectId, target, githubToken, githubRepo);
    const siblingResults = await Promise.allSettled(
      siblingIds.map((id) => dispatchDeploy(id, target, githubToken, githubRepo)),
    );
    const deployedSiblings = siblingIds.filter((_, i) => siblingResults[i].status === "fulfilled");
    const failedSiblings = siblingIds.filter((_, i) => siblingResults[i].status === "rejected");

    const deliveryDomain = process.env.DELIVERY_DOMAIN || "";
    const url =
      target === "staging"
        ? `https://${deliveryDomain}/staging/${projectId}/`
        : `https://${deliveryDomain}/${projectId}/`;

    console.log(`✓  Deploy triggered: ${projectId} → ${target} (${url})`);
    if (deployedSiblings.length) console.log(`   + siblings: ${deployedSiblings.join(", ")}`);
    if (failedSiblings.length) console.error(`   ✗ sibling dispatch failed: ${failedSiblings.join(", ")}`);

    // Snapshot this project's own nav-relevant fields now that a deploy
    // reflecting them has been dispatched — future deploys compare against
    // this to decide whether to ask again.
    if (isGrouped) {
      content.meta._groupNavDeployedAs = groupNavSnapshot(content.meta);
      if (db.isConfigured()) await db.saveProject(projectId, content).catch(() => {});
    }

    res.json({ ok: true, target, url, projectId, deployedSiblings, failedSiblings });
  } catch (err) {
    console.error("Deploy error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Home screen ───────────────────────────────────────────────────

app.get("/", (req, res) => {
  res.sendFile(path.join(EDITOR_DIR, "home.html"));
});

app.get("/edit/:id", (req, res) => {
  res.sendFile(path.join(EDITOR_DIR, "editor.html"));
});

// ── Print version ─────────────────────────────────────────────────
// Branded text-only render served live from Supabase content.
// Track 2 PDF preview — A4 layout, fed to Puppeteer at publish time.

app.get("/pdf-preview/:id", async (req, res) => {
  try {
    const { renderPdf } = require("./renderer/pdf-renderer");
    const content = await db.getProject(req.params.id);
    if (!content) return res.status(404).send("Story not found");
    const html = renderPdf(content);
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  } catch (err) {
    console.error("[pdf-preview]", err);
    res.status(500).send("Could not generate PDF preview: " + err.message);
  }
});

// Track 1 — Readers can print or Cmd+P → Save as PDF from here.

app.get("/print/:id", async (req, res) => {
  try {
    const { renderPrint } = require("./renderer/print-renderer");
    const content = await db.getProject(req.params.id);
    if (!content) return res.status(404).send("Story not found");
    const html = renderPrint(content);
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  } catch (err) {
    console.error("[print]", err);
    res.status(500).send("Could not generate print version: " + err.message);
  }
});

// ── Asset passthrough ─────────────────────────────────────────────
// Rendered HTML uses root-relative paths like /projectId/css/tokens.css
// This middleware intercepts those and serves from .preview/
app.use((req, res, next) => {
  const parts = req.path.split("/").filter(Boolean);
  if (parts.length < 2) return next();
  const [projectId, assetType, ...rest] = parts;
  if (["api", "edit", "preview", "editor"].includes(projectId)) return next();

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
  const absPath = path.resolve(filePath);

  if (!fs.existsSync(absPath)) {
    return res.status(404).send("Not found: " + absPath);
  }

  const ext = path.extname(absPath).toLowerCase();
  if (mimeMap[ext]) res.setHeader("Content-Type", mimeMap[ext]);

  // Use fs.createReadStream instead of res.sendFile —
  // res.sendFile cannot serve files outside the .asar bundle in Electron
  const stream = fs.createReadStream(absPath);
  stream.on("error", (err) => res.status(500).send(err.message));
  stream.pipe(res);
});

// ── File watcher (dev convenience) ───────────────────────────────
// If content.json is edited externally, re-render automatically

chokidar
  .watch(path.join(PROJECTS_DIR, "**", "content.json"), {
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 300 },
  })
  .on("change", async (filePath) => {
    const projectId = path.basename(path.dirname(filePath));
    console.log(`↺  Re-rendering ${projectId}...`);
    await renderToPreview(projectId);
  });

// ── Start ─────────────────────────────────────────────────────────

// Pre-render all existing projects on startup
async function preRenderAll() {
  if (db.isConfigured()) {
    try {
      const projects = await db.listProjects();
      for (const p of projects) {
        try {
          const content = await db.getProject(p.id);
          const result = await renderToPreview(p.id, content);
          if (result.ok) console.log(`✓  Pre-rendered ${p.id}`);
        } catch (err) {
          console.warn(`⚠  Could not pre-render ${p.id}:`, err.message);
        }
      }
    } catch (err) {
      console.warn("⚠  Could not load projects from Supabase:", err.message);
    }
  } else if (fs.existsSync(PROJECTS_DIR)) {
    const dirs = fs.readdirSync(PROJECTS_DIR, { withFileTypes: true }).filter((e) => e.isDirectory());
    for (const e of dirs) {
      const result = await renderToPreview(e.name);
      if (result.ok) console.log(`✓  Pre-rendered ${e.name}`);
    }
  }
}

preRenderAll();

app.listen(PORT, () => {
  console.log(`\n  Harpoon Story Engine — Editor`);
  console.log(`  http://localhost:${PORT}\n`);

  // Auto-open in browser on Mac (skip when running inside Electron)
  if (!process.versions.electron) {
    const { exec } = require("child_process");
    exec(`open http://localhost:${PORT}`);
  }
});
