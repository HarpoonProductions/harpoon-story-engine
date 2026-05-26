"use strict";

/**
 * Harpoon Story Engine — Electron Main Process
 * electron/main.js
 *
 * Starts the Express editor server then opens a browser window.
 * The app behaves like a native Mac application.
 */

const { app, BrowserWindow, shell, Menu, dialog } = require("electron");
const path = require("path");
const http = require("http");

// Load .env — check user's Documents folder first (Electron), then app directory (dev)
const os = require("os");
const envPaths = [
  path.join(os.homedir(), "Documents", "Harpoon Story Engine", ".env"),
  path.join(__dirname, ".env"),
  path.join(__dirname, "..", ".env"),
];
for (const envPath of envPaths) {
  if (require("fs").existsSync(envPath)) {
    require("dotenv").config({ path: envPath });
    console.log("Loaded .env from:", envPath);
    break;
  }
}

const PORT = 3001;
let mainWindow = null;
let serverStarted = false;

// ── Start the Express editor server ───────────────────────────────

function startServer() {
  return new Promise((resolve, reject) => {
    // Start the editor server
    try {
      require("./editor.js");
    } catch (err) {
      reject(err);
      return;
    }

    // Poll until the server is responding (max 10s)
    const start = Date.now();
    const timeout = 10000;

    function poll() {
      const req = http.get(`http://localhost:${PORT}`, (res) => {
        serverStarted = true;
        resolve();
      });
      req.on("error", () => {
        if (Date.now() - start > timeout) {
          reject(new Error("Editor server did not start within 10 seconds"));
          return;
        }
        setTimeout(poll, 300);
      });
      req.setTimeout(500, () => {
        req.destroy();
      });
    }

    // Give Node a moment to bind the port before first poll
    setTimeout(poll, 500);
  });
}

// ── Create the main window ─────────────────────────────────────────

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: "Harpoon Story Engine",
    icon: path.join(__dirname, "electron", "build-assets", "icon.png"),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false, // Allow iframes to load localhost preview
      allowRunningInsecureContent: true,
    },
    backgroundColor: "#F7F6F3",
    show: false, // Don't show until ready
    titleBarStyle: "hiddenInset", // Mac-style traffic lights inset into toolbar
  });

  // Load the editor
  mainWindow.loadURL(`http://localhost:${PORT}`);

  // Allow iframes to load localhost content
  mainWindow.webContents.session.webRequest.onHeadersReceived(
    (details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          "Content-Security-Policy": [
            "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:",
          ],
        },
      });
    },
  );

  // Show window once loaded and bring to front
  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
    // Small delay to let the permissions dialog fully dismiss
    setTimeout(() => {
      mainWindow.restore();
      mainWindow.setAlwaysOnTop(true);
      mainWindow.focus();
      mainWindow.setAlwaysOnTop(false);
    }, 500);
  });

  // Open DevTools with Cmd+Option+I (remove before shipping to Rachel)
  mainWindow.webContents.on("before-input-event", (event, input) => {
    if (input.meta && input.alt && input.key === "i") {
      mainWindow.webContents.openDevTools({ mode: "detach" });
    }
  });

  // Open external links in the default browser, not in the app
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http://localhost")) return { action: "allow" };
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// ── Splash / loading screen ────────────────────────────────────────

function createSplash() {
  const splash = new BrowserWindow({
    width: 420,
    height: 280,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    icon: path.join(__dirname, "electron", "build-assets", "icon.png"),
    webPreferences: { nodeIntegration: false },
  });

  splash.loadURL(`data:text/html,
    <html>
    <head>
    <style>
      * { margin:0; padding:0; box-sizing:border-box; }
      body {
        background: #1A1916;
        color: #F2EDE6;
        font-family: -apple-system, BlinkMacSystemFont, sans-serif;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100vh;
        border-radius: 12px;
        gap: 1rem;
      }
      .logo {
        width: 72px; height: 72px;
        border-radius: 50%;
        background: #1A3F6F;
        display: flex; align-items: center; justify-content: center;
        font-size: 2rem; color: white;
      }
      h1 { font-size: 1rem; font-weight: 500; letter-spacing: 0.05em; }
      p  { font-size: 0.72rem; color: #7A7268; letter-spacing: 0.1em; }
    </style>
    </head>
    <body>
      <div class="logo">H</div>
      <h1>Story Engine</h1>
      <p>Starting up…</p>
    </body>
    </html>
  `);

  return splash;
}

// ── Mac application menu ───────────────────────────────────────────

function buildMenu() {
  const template = [
    {
      label: "Story Engine",
      submenu: [
        { label: "About Story Engine", role: "about" },
        { type: "separator" },
        { label: "Hide Story Engine", role: "hide" },
        { label: "Hide Others", role: "hideOthers" },
        { label: "Show All", role: "unhide" },
        { type: "separator" },
        { label: "Quit Story Engine", role: "quit" },
      ],
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" },
      ],
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    {
      label: "Window",
      submenu: [{ role: "minimize" }, { role: "zoom" }, { role: "close" }],
    },
    {
      label: "Help",
      submenu: [
        {
          label: "Open Story Engine folder",
          click: () => shell.openPath(path.join(__dirname)),
        },
        {
          label: "Open projects folder",
          click: () => {
            const os = require("os");
            const projectsPath = path.join(
              os.homedir(),
              "Documents",
              "Harpoon Story Engine",
              "projects",
            );
            shell.openPath(projectsPath);
          },
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ── App lifecycle ──────────────────────────────────────────────────

app.whenReady().then(async () => {
  buildMenu();

  const splash = createSplash();

  try {
    await startServer();
    splash.close();
    createWindow();
  } catch (err) {
    splash.close();
    dialog.showErrorBox(
      "Story Engine failed to start",
      `Could not start the editor server:\n\n${err.message}\n\nPlease check your .env file and try again.`,
    );
    app.quit();
  }
});

// Quit when all windows are closed (standard Mac behaviour: keep running in dock)
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// Ensure Cmd+Q always quits cleanly
app.on("before-quit", () => {
  if (mainWindow) {
    mainWindow.removeAllListeners("close");
    mainWindow.close();
  }
});

app.on("activate", () => {
  if (mainWindow === null) createWindow();
});
