# Harpoon Story Engine — Getting Started

## First-time setup (do this once)

**Step 1 — Install Node.js**

Node.js is a small program the Story Engine needs to run. You only install it once.

Download it from: https://nodejs.org/en/download  
Choose the **LTS** version for macOS. Install it like any other Mac app.

**Step 2 — Get the Story Engine folder**

Download the Story Engine from this link:
https://github.com/HarpoonProductions/harpoon-story-engine/archive/refs/heads/main.zip

Double-click the downloaded zip to unpack it. You'll get a folder called
`harpoon-story-engine-main`. Rename it to `harpoon-story-engine` and move it
somewhere you'll remember — your Documents folder is fine. Keep it out of
iCloud-synced folders if you can (the Desktop is often synced).

**Step 3 — Add your credentials file**

Giles will send you a file called `.env` (sometimes it arrives as `env.txt`;
if so, rename it to `.env`). Drop it into the `harpoon-story-engine` folder.
It holds the keys that let the editor save stories and publish them, so keep
it private and don't forward it.

> Note: `.env` files are hidden by default on Mac. To see hidden files in Finder,  
> press **Cmd + Shift + .** (that's a full stop). Press it again to hide them.

**Step 4 — Run setup**

Double-click `setup.command` inside the folder. 

If Mac asks "are you sure you want to open this?" — right-click it instead, 
choose Open, then click Open again. You only need to do this once.

The setup links the folder to GitHub and installs everything the Story Engine needs.
It takes about a minute. If your Mac offers to install "command line developer tools",
say yes, then run setup again.

---

## Every day

Open the **Story Engine** app (it has the Harpoon icon and lives in the
`harpoon-story-engine` folder). The editor opens in its own window, and the Story
Engine shows up in the Dock and in the app switcher (Cmd-Tab) like any other app.

**Tip:** Drag the Story Engine app from the folder to your Dock so it's always one
click away. Leave the app itself in the folder; don't move it to Applications.

Each time it starts, the Story Engine updates itself to the latest version, so you
and Giles are always using the same one. To pick up a change Giles has just made,
quit the Story Engine (Cmd-Q) and open it again.

If the app is missing, double-click `start.command` in the folder. It updates
everything, builds the app, and opens it.

---

## If something goes wrong

- **"Node.js not found"** — run Step 1 again, then restart your Mac
- **"Missing .env file"** — ask Giles to resend the `.env` file
- **Editor won't open** — quit the Story Engine (Cmd-Q) and open it again. If that doesn't help, double-click `start.command`
- **Changes not saving** — check you have internet access (the editor saves to the cloud)
- **"Couldn't check for updates"** — you're probably offline. You can continue, but you may be on an older version
- **"This folder has local changes"** — files in the folder have been edited. Choose Quit and tell Giles

---

*Harpoon Productions — Story Engine*
