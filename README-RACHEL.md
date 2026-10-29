# Harpoon Story Engine — Getting Started

## First-time setup (do this once)

**Step 1 — Install Node.js**

Node.js is a small program the Story Engine needs to run. You only install it once.

Download it from: https://nodejs.org/en/download  
Choose the **LTS** version for macOS. Install it like any other Mac app.

**Step 2 — Get the Story Engine folder**

You should have received a folder called `harpoon-story-engine`. Put it somewhere 
you'll remember — your Desktop or Documents folder is fine.

**Step 3 — Add your credentials file**

Giles will send you a file called `.env`. Drop it into the `harpoon-story-engine` folder.

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

Double-click `start.command` to launch the Story Engine.  
Your browser will open automatically at the editor.

To stop the editor, close the Terminal window that opened.

Each time it starts, the Story Engine updates itself to the latest version, so you
and Giles are always using the same one. To pick up a change Giles has just made,
close the Terminal window and double-click `start.command` again. The version is
shown in the Terminal window.

**Tip:** Drag `start.command` to your Dock so it's always one click away.

---

## If something goes wrong

- **"Node.js not found"** — run Step 1 again, then restart your Mac
- **"Missing .env file"** — ask Giles to resend the `.env` file
- **Editor won't open** — make sure the Terminal window from `start.command` is still open
- **Changes not saving** — check you have internet access (the editor saves to the cloud)
- **"Couldn't check for updates"** — you're probably offline. You can continue, but you may be on an older version
- **"This folder has local changes"** — files in the folder have been edited. Choose Quit and tell Giles

---

*Harpoon Productions — Story Engine*
