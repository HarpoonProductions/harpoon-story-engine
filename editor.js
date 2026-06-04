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
const { render } = require("./renderer/index");

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

function renderToPreview(projectId, contentObj) {
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
    render(content, outDir, { basePath: "" });
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
            return {
              id: e.name,
              title: meta.title || e.name,
              client: meta.client || "",
              last_saved: stat ? stat.mtime.toISOString() : null,
              accent_color: meta.accent_color || "#1A3F6F",
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

    // Render to local preview from content in memory
    const result = renderToPreview(projectId, body);

    addRecent(projectId);
    res.json(result);
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
    renderToPreview(id, newContent);
    addRecent(id);
    res.json({ ok: true, id });
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

// ── Deploy via GitHub Actions API ────────────────────────────────
// Triggers the render-deploy workflow with a project ID and target.
// Requires GITHUB_TOKEN and GITHUB_REPO in environment.

app.post("/api/project/:id/deploy", async (req, res) => {
  const projectId = req.params.id;
  const target = req.body.target || "production"; // 'staging' or 'production'
  const githubToken = process.env.GITHUB_TOKEN || "";
  const githubRepo =
    process.env.GITHUB_REPO || "HarpoonProductions/harpoon-story-engine";

  if (!githubToken) {
    return res.status(503).json({
      error: "GITHUB_TOKEN not set in .env — required to trigger deployments.",
    });
  }

  try {
    // ── Trigger the workflow ─────────────────────────────────────
    // Content is read directly from Supabase by the Action —
    // no git commit needed.
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
        body: JSON.stringify({
          ref: "main",
          inputs: {
            project: projectId,
            target,
          },
        }),
      },
    );

    if (response.status === 204) {
      // 204 No Content = workflow triggered successfully
      const deliveryDomain = process.env.DELIVERY_DOMAIN || "";
      const url =
        target === "staging"
          ? `https://${deliveryDomain}/staging/${projectId}/`
          : `https://${deliveryDomain}/${projectId}/`;

      console.log(`✓  Deploy triggered: ${projectId} → ${target} (${url})`);
      res.json({ ok: true, target, url, projectId });
    } else {
      const text = await response.text();
      console.error(`Deploy error ${response.status}:`, text);
      res.status(response.status).json({
        error: `GitHub API returned ${response.status}: ${text}`,
      });
    }
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
  .on("change", (filePath) => {
    const projectId = path.basename(path.dirname(filePath));
    console.log(`↺  Re-rendering ${projectId}...`);
    renderToPreview(projectId);
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
          const result = renderToPreview(p.id, content);
          if (result.ok) console.log(`✓  Pre-rendered ${p.id}`);
        } catch (err) {
          console.warn(`⚠  Could not pre-render ${p.id}:`, err.message);
        }
      }
    } catch (err) {
      console.warn("⚠  Could not load projects from Supabase:", err.message);
    }
  } else if (fs.existsSync(PROJECTS_DIR)) {
    fs.readdirSync(PROJECTS_DIR, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .forEach((e) => {
        const result = renderToPreview(e.name);
        if (result.ok) console.log(`✓  Pre-rendered ${e.name}`);
      });
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
