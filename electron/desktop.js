"use strict";

/**
 * Harpoon Story Engine — desktop app entry point
 *
 * "Story Engine.app" (built by scripts/build-desktop-app.sh) runs this
 * file from the folder it sits in. It brings the folder up to the latest
 * main, then starts the editor in its own window via main.js.
 */

const { app, BrowserWindow } = require("electron");
const { execFileSync, spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");

// Each launch writes how long each step took to
// ~/Library/Logs/Story Engine/launch.log, so a slow start can be traced.
const LOG_FILE = path.join(app.getPath("home"), "Library", "Logs", "Story Engine", "launch.log");
const launchStart = Date.now();
function logStep(step) {
  try {
    fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
    const secs = ((Date.now() - launchStart) / 1000).toFixed(1);
    fs.appendFileSync(LOG_FILE, `${new Date().toISOString()}  +${secs}s  ${step}\n`);
  } catch {}
}
logStep("launch");

// Apps opened from the Dock get a bare PATH, so node, npm and git from
// Homebrew or the Node.js installer aren't found. The usual install
// places cover most Macs; only ask the login shell (which can be slow to
// start) when node isn't in one of them.
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

const COMMON_BIN_DIRS = ["/opt/homebrew/bin", "/usr/local/bin"];
const nodeInCommonPlace = COMMON_BIN_DIRS.some((dir) => fs.existsSync(path.join(dir, "node")));
process.env.PATH = [
  nodeInCommonPlace ? "" : loginShellPath(),
  ...COMMON_BIN_DIRS,
  process.env.PATH,
].filter(Boolean).join(":");

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

// A small window so the app visibly responds while it checks for updates
function showUpdatingWindow() {
  const win = new BrowserWindow({
    width: 360,
    height: 200,
    frame: false,
    resizable: false,
    backgroundColor: "#1A1916",
    webPreferences: { nodeIntegration: false },
  });
  win.loadURL(`data:text/html,
    <html><body style="margin:0;height:100vh;display:flex;flex-direction:column;
      align-items:center;justify-content:center;gap:10px;background:%231A1916;color:%23F2EDE6;
      font-family:-apple-system,BlinkMacSystemFont,sans-serif;-webkit-app-region:drag">
      <div style="font-size:15px;font-weight:500">Story Engine</div>
      <div style="font-size:12px;color:%237A7268">Checking for updates&hellip;</div>
    </body></html>`);
  return win;
}

function runUpdate() {
  return new Promise((resolve) => {
    const child = spawn("/bin/bash", [path.join(ROOT, "scripts", "update.sh")], {
      cwd: ROOT,
      env: process.env,
      stdio: "ignore",
    });
    child.on("error", () => resolve(1));
    child.on("exit", (code) => resolve(code === null ? 1 : code));
  });
}

let updatingWindow = null;

// Keep running while the update window comes and goes; main.js sets
// the real behaviour once it has loaded
app.on("window-all-closed", () => {});

async function start() {
  if (!updatedRecently()) {
    const stampBefore = readStamp();
    await app.whenReady();
    updatingWindow = showUpdatingWindow();
    logStep("checking for updates");

    // scripts/update.sh shows its own dialogs if something needs you
    const code = await runUpdate();
    logStep(`update finished (exit ${code})`);
    if (code !== 0) {
      app.exit(0);
      return;
    }

    // An update brought a new version of Electron and the app was
    // rebuilt: start again from the new copy
    const stampAfter = readStamp();
    if (stampBefore && stampAfter && stampAfter !== stampBefore) {
      logStep("app rebuilt, relaunching");
      app.relaunch();
      app.exit(0);
      return;
    }
  }

  require(path.join(ROOT, "main.js"));
  logStep("editor starting");
  // main.js has its own "Starting up" window from here
  setTimeout(() => updatingWindow && !updatingWindow.isDestroyed() && updatingWindow.destroy(), 300);
}

start();
