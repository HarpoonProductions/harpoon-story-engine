"use strict";

/**
 * Harpoon Story Engine — desktop app entry point
 *
 * "Story Engine.app" (built by scripts/build-desktop-app.sh) runs this
 * file from the folder it sits in. It brings the folder up to the latest
 * main, then starts the editor in its own window via main.js.
 */

const { app } = require("electron");
const { execFileSync, spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");

// Apps opened from the Dock get a bare PATH, so node, npm and git from
// Homebrew or the Node.js installer aren't found. Borrow the login shell's.
function loginShellPath() {
  try {
    const shell = process.env.SHELL || "/bin/zsh";
    const out = execFileSync(shell, ["-ilc", 'printf "__PATH__%s" "$PATH"'], {
      encoding: "utf8",
      timeout: 5000,
      stdio: ["ignore", "pipe", "ignore"],
    });
    const match = out.match(/__PATH__(.*)$/);
    if (match) return match[1].trim();
  } catch {}
  return "";
}

function readStamp() {
  // process.execPath is <app>/Contents/MacOS/Electron
  const stampFile = path.resolve(
    process.execPath, "..", "..", "Resources", "app", "stamp",
  );
  try {
    return fs.readFileSync(stampFile, "utf8").trim();
  } catch {
    return "";
  }
}

function updatedRecently() {
  // start.command has just run the update and then opened this app
  try {
    const at = Number(fs.readFileSync(path.join(ROOT, "node_modules", ".last-update"), "utf8"));
    return Date.now() / 1000 - at < 120;
  } catch {
    return false;
  }
}

process.env.PATH = [
  loginShellPath(),
  "/opt/homebrew/bin",
  "/usr/local/bin",
  process.env.PATH,
].filter(Boolean).join(":");

if (!updatedRecently()) {
  const stampBefore = readStamp();

  // Runs before the app has finished launching, so nothing is on screen
  // yet; scripts/update.sh shows its own dialogs if something needs you.
  const result = spawnSync("/bin/bash", [path.join(ROOT, "scripts", "update.sh")], {
    cwd: ROOT,
    env: process.env,
    stdio: "inherit",
  });
  if (result.status !== 0) {
    app.exit(0);
    return;
  }

  // An update brought a new version of Electron and the app was rebuilt:
  // start again from the new copy
  const stampAfter = readStamp();
  if (stampBefore && stampAfter && stampAfter !== stampBefore) {
    app.relaunch();
    app.exit(0);
    return;
  }
}

require(path.join(ROOT, "main.js"));
