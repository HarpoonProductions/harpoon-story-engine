#!/bin/bash

# Harpoon Story Engine — Editor Launcher
# Double-click this file to start the editor.
# The browser will open automatically at http://localhost:3001
#
# Every launch brings this folder up to the latest main on GitHub, so
# everyone runs the same, pushed version of the editor. If it can't, it
# says so and asks before carrying on, rather than quietly running old
# code. Do code work in a separate folder, not this one.

# Change to the directory containing this script
# (works regardless of where the file is double-clicked from)
cd "$(dirname "$0")"

alert() {
  osascript -e "display alert \"$1\" message \"$2\" as critical" >/dev/null
}

# Asks Continue / Quit; returns 0 to continue
ask_continue() {
  osascript -e "button returned of (display alert \"$1\" message \"$2\" as warning buttons {\"Quit\", \"Continue anyway\"} default button \"Quit\")" 2>/dev/null \
    | grep -q "Continue anyway"
}

# Check Node.js is installed
if ! command -v node &> /dev/null; then
  alert "Node.js not found" "Please install Node.js from https://nodejs.org and try again."
  exit 1
fi

# Check .env exists
if [ ! -f ".env" ]; then
  alert "Missing .env file" "Please create a .env file in the Story Engine folder with your AWS and GitHub credentials. See .env.example for the format."
  exit 1
fi

# ── Update to the latest main ──────────────────────────────────────
if [ ! -d ".git" ]; then
  if ! ask_continue "This copy can't update itself" "This Story Engine folder isn't linked to GitHub, so it may be out of date. Run setup.command once to link it."; then
    exit 1
  fi
else
  echo "  Checking for updates..."
  BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
  if [ "$BRANCH" != "main" ]; then
    if ! ask_continue "Not on main" "This folder is on the branch '$BRANCH', not main, so it isn't running the shared version of the editor."; then
      exit 1
    fi
  elif [ -n "$(git status --porcelain --untracked-files=no)" ]; then
    if ! ask_continue "This folder has local changes" "Files in this folder have been edited, so it can't update to the latest version. Do code work in a separate folder and keep this one for running the editor."; then
      exit 1
    fi
  elif ! git fetch --quiet origin main; then
    if ! ask_continue "Couldn't check for updates" "GitHub couldn't be reached, so this may not be the latest version. Check your internet connection."; then
      exit 1
    fi
  elif [ -n "$(git rev-list origin/main..HEAD)" ] || ! git merge --quiet --ff-only origin/main; then
    if ! ask_continue "Couldn't update" "This folder has commits that aren't on GitHub, so it isn't running the shared version."; then
      exit 1
    fi
  else
    echo "  ✓ Up to date"
  fi
fi

# ── Install dependencies when they change ──────────────────────────
# Re-installs whenever package-lock.json differs from the last install,
# so an update that adds a dependency doesn't break the editor. npm ci and
# --no-save never rewrite package-lock.json, which would otherwise count
# as a local change and block the next update.
LOCK_HASH=$(shasum package-lock.json 2>/dev/null | cut -d' ' -f1)
if [ ! -d "node_modules" ] || [ "$(cat node_modules/.lock-hash 2>/dev/null)" != "$LOCK_HASH" ]; then
  echo "  Installing dependencies..."
  if npm ci --include=optional && npm install --no-save --os=darwin --cpu=arm64 sharp; then
    echo "$LOCK_HASH" > node_modules/.lock-hash
  else
    alert "Install failed" "The Story Engine's dependencies couldn't be installed. Check your internet connection and try again."
    exit 1
  fi
fi

VERSION=$(git log -1 --date=format:'%d %b %Y' --format='%h, %cd' 2>/dev/null || echo "unknown")

# Clear the terminal and show a clean startup message
clear
echo ""
echo "  ╔═══════════════════════════════════════╗"
echo "  ║   Harpoon Story Engine — Editor       ║"
echo "  ║   Opening at http://localhost:3001     ║"
echo "  ╚═══════════════════════════════════════╝"
echo ""
echo "  Version: $VERSION"
echo ""
echo "  Keep this window open while you're working."
echo "  Close it to stop the editor."
echo ""

# Start the editor
node editor.js
