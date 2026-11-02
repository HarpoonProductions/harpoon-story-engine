"use strict";

/**
 * Harpoon Story Engine — frozen engine versions
 * engine-pin.js
 *
 * A published story can be frozen to the engine (renderer, CSS, JS,
 * schema, tokens) it was built with, so later engine changes never reach
 * it, while its words and pictures stay editable. The freeze is one field
 * in the story's own content:
 *
 *   meta.engine_freeze = {
 *     commit:      "<git commit of this repo>",   // the engine to build with
 *     engine_date: "<ISO date of that commit>",   // for display
 *     frozen_at:   "<ISO date the story was frozen>"
 *   }
 *
 * Removing the field unfreezes the story; its next build uses the latest
 * engine again.
 *
 * This file is deliberately NOT part of the versioned engine (it lives
 * outside renderer/): it is the switch that picks which engine runs, so it
 * always comes from the current code. The engine itself is a plain copy of
 * the repo at the frozen commit, extracted once into <base>/.engines/<sha>
 * and loaded from there. The renderer finds its CSS, JS, schema and tokens
 * relative to its own files, so a copy renders exactly as that commit did.
 *
 * Used by:
 *   - editor.js — preview, export, print/PDF preview of a frozen story
 *   - .github/workflows/render-deploy.yml — via the CLI below:
 *       node engine-pin.js commit <content.json>      prints the frozen commit, or nothing
 *       node engine-pin.js prepare <sha> [--projects <dir>]
 *                                                     prints the engine's directory
 */

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = __dirname;
const SHA_RE = /^[0-9a-f]{7,40}$/;

function git(args, opts = {}) {
  return execFileSync("git", ["-C", ROOT, ...args], {
    encoding: opts.encoding === undefined ? "utf8" : opts.encoding,
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 512 * 1024 * 1024,
  });
}

/** The frozen commit for a story, or null when it follows the latest engine. */
function pinnedCommit(content) {
  const commit = content && content.meta && content.meta.engine_freeze && content.meta.engine_freeze.commit;
  if (typeof commit !== "string") return null;
  const c = commit.trim().toLowerCase();
  return SHA_RE.test(c) ? c : null;
}

/** Full sha + ISO commit date for a ref, or null if git can't resolve it. */
function describeCommit(ref) {
  try {
    const out = git(["log", "-1", "--format=%H %cI", ref, "--"]).trim();
    const [commit, date] = out.split(" ");
    return SHA_RE.test(commit) ? { commit, date } : null;
  } catch {
    return null;
  }
}

/** The engine this code checkout is running right now. */
function currentEngine() {
  return describeCommit("HEAD");
}

/**
 * Which engine to freeze a story to: the main-branch commit that was live
 * the last time the story went out, whether published to stories.har.pn
 * (every publish builds from main) or exported for a client's own site
 * (built in the editor, which runs the latest main), whichever was later.
 * For a story that has never gone out, the engine running now.
 */
function suggestFreeze(content) {
  const meta = (content && content.meta) || {};
  const outings = [
    { at: meta.last_published_at, basis: "last-published" },
    { at: meta.last_exported_at, basis: "last-exported" },
  ].filter((o) => o.at && !Number.isNaN(Date.parse(o.at)))
   .sort((a, b) => Date.parse(b.at) - Date.parse(a.at));

  const latest = outings[0];
  if (latest) {
    const before = new Date(Date.parse(latest.at)).toISOString();
    for (const branch of ["origin/main", "main"]) {
      try {
        const sha = git(["rev-list", "-1", "--first-parent", `--before=${before}`, branch]).trim();
        const info = sha && describeCommit(sha);
        if (info) return { ...info, basis: latest.basis, published_at: latest.at };
      } catch {}
    }
  }
  const now = currentEngine();
  return now ? { ...now, basis: "current" } : null;
}

function commitExists(sha) {
  try {
    git(["cat-file", "-e", `${sha}^{commit}`]);
    return true;
  } catch {
    return false;
  }
}

function sameFile(sha, file) {
  try {
    git(["diff", "--quiet", sha, "HEAD", "--", file]);
    return true;
  } catch {
    return false;
  }
}

function replaceWithLink(linkPath, target) {
  fs.rmSync(linkPath, { recursive: true, force: true });
  fs.symlinkSync(target, linkPath, "dir");
}

/**
 * Make sure a copy of the engine at `sha` exists under <baseDir>/.engines
 * and return its directory. Safe to call on every render: once a copy is
 * complete it is reused.
 *
 * projectsDir: where this machine keeps projects/<id>/ (photos, logo,
 * group members). The copy's own projects/ is replaced by a link to it so
 * the frozen renderer sees the same project files the current one would.
 */
function prepareEngine(sha, { baseDir = ROOT, projectsDir = path.join(ROOT, "projects") } = {}) {
  if (!SHA_RE.test(sha)) throw new Error(`Not a commit id: ${sha}`);

  if (!commitExists(sha)) {
    try { git(["fetch", "--quiet", "origin", sha]); } catch {}
    if (!commitExists(sha)) throw new Error(`Engine version ${sha.slice(0, 7)} isn't in this copy of the code`);
  }
  const full = git(["rev-parse", `${sha}^{commit}`]).trim();

  const enginesDir = path.join(baseDir, ".engines");
  const dir = path.join(enginesDir, full);
  const marker = path.join(dir, ".engine-ready");

  if (!fs.existsSync(marker)) {
    fs.mkdirSync(enginesDir, { recursive: true });
    const tmp = `${dir}.tmp-${process.pid}`;
    fs.rmSync(tmp, { recursive: true, force: true });
    fs.mkdirSync(tmp, { recursive: true });

    const tar = git(["archive", "--format=tar", full], { encoding: null });
    execFileSync("tar", ["-x", "-C", tmp], { input: tar, stdio: ["pipe", "ignore", "pipe"] });

    // Dependencies: reuse this checkout's node_modules when the lockfile
    // is unchanged (the usual case); otherwise install the frozen set.
    let installed = false;
    if (!sameFile(full, "package-lock.json")) {
      try {
        execFileSync("npm", ["ci", "--include=optional", "--no-audit", "--no-fund"], { cwd: tmp, stdio: "ignore" });
        installed = true;
      } catch {}
    }
    if (!installed) replaceWithLink(path.join(tmp, "node_modules"), path.join(ROOT, "node_modules"));

    fs.writeFileSync(path.join(tmp, ".engine-ready"), `${full}\n`);
    fs.rmSync(dir, { recursive: true, force: true });
    fs.renameSync(tmp, dir);
  }

  // Refresh every time: the projects folder can differ between callers.
  const want = path.resolve(projectsDir);
  const link = path.join(dir, "projects");
  let current = null;
  try { current = fs.readlinkSync(link); } catch {}
  if (current !== want && fs.existsSync(want)) replaceWithLink(link, want);

  return dir;
}

/**
 * Load the frozen engine's modules. Returns the same functions the editor
 * otherwise requires from ./renderer, plus `dir` and `commit`.
 */
function loadEngine(sha, opts) {
  const dir = prepareEngine(sha, opts);
  const req = (rel) => require(path.join(dir, rel));
  const index = req("renderer/index");
  return {
    dir,
    commit: fs.readFileSync(path.join(dir, ".engine-ready"), "utf8").trim(),
    render: index.render,
    renderSection: index.renderSection,
    validate: req("renderer/validate").validate,
    renderPdf: (...a) => req("renderer/pdf-renderer").renderPdf(...a),
    renderPrint: (...a) => req("renderer/print-renderer").renderPrint(...a),
  };
}

module.exports = { pinnedCommit, suggestFreeze, currentEngine, describeCommit, prepareEngine, loadEngine };

// ── CLI (used by the deploy workflow) ─────────────────────────────

if (require.main === module) {
  const [cmd, arg, ...rest] = process.argv.slice(2);
  try {
    if (cmd === "commit") {
      const content = JSON.parse(fs.readFileSync(arg, "utf8"));
      const sha = pinnedCommit(content);
      if (sha) process.stdout.write(sha);
    } else if (cmd === "prepare") {
      const i = rest.indexOf("--projects");
      const projectsDir = i !== -1 ? path.resolve(rest[i + 1]) : path.join(ROOT, "projects");
      process.stdout.write(prepareEngine(arg, { projectsDir }));
    } else {
      console.error("Usage: node engine-pin.js commit <content.json> | prepare <sha> [--projects <dir>]");
      process.exit(2);
    }
  } catch (err) {
    console.error(`✗ ${err.message}`);
    process.exit(1);
  }
}
