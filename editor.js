"use strict";

// Load environment variables from .env file if present
require("dotenv").config();

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

// AWS S3 upload (optional — only active if AWS credentials are set in environment)
let S3Client, Upload;
try {
  ({ S3Client } = require("@aws-sdk/client-s3"));
  ({ Upload } = require("@aws-sdk/lib-storage"));
} catch {}

const S3_BUCKET = process.env.S3_BUCKET || "";
const AWS_REGION =
  process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "eu-west-2";
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
    // Empty basePath = relative CSS/JS paths, which work correctly
    // when served from /preview/<projectId>/ by the local server
    render(content, outDir, { basePath: "" });
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

// ── File upload ──────────────────────────────────────────────────
// Receives a multipart form upload, sends to S3, returns the public URL.
// Requires S3_BUCKET env var and valid AWS credentials.
// Uses busboy for reliable multipart parsing.

const Busboy = require("busboy");
const sharp = require("sharp");

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

          if (isImage) {
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

// ── Home screen ───────────────────────────────────────────────────

app.get("/", (req, res) => {
  res.sendFile(path.join(EDITOR_DIR, "home.html"));
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
