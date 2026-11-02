#!/bin/bash

# Harpoon Story Engine — update step shared by start.command and the
# Story Engine app.
#
# Brings this folder up to the latest main on GitHub and installs
# dependencies when they change, so everyone runs the same, pushed
# version of the editor. If it can't, it says so and asks before carrying
# on, rather than quietly running old code. Do code work in a separate
# folder, not this one.
#
# Exits 0 to carry on and start the editor, 1 to quit.

cd "$(dirname "$0")/.."

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
  # Give up on a stalled connection rather than hanging the launch
  elif ! git -c http.lowSpeedLimit=1000 -c http.lowSpeedTime=15 fetch --quiet origin main; then
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
  osascript -e 'display notification "Installing updates. This can take a minute." with title "Story Engine"' >/dev/null 2>&1 || true
  if npm ci --include=optional && npm install --no-save --os=darwin --cpu=arm64 sharp; then
    echo "$LOCK_HASH" > node_modules/.lock-hash
  else
    alert "Install failed" "The Story Engine's dependencies couldn't be installed. Check your internet connection and try again."
    exit 1
  fi
fi

# ── Make sure the Story Engine app is built ────────────────────────
# Quick no-op when it's already up to date. A failure here isn't fatal:
# start.command can still open the editor in the browser.
bash scripts/build-desktop-app.sh || true

# Lets the app skip a second update check when start.command opens it
date +%s > node_modules/.last-update 2>/dev/null || true

exit 0
