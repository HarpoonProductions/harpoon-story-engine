#!/bin/bash

# Harpoon Story Engine — First-time Setup
# Double-click this once when setting up on a new Mac.

cd "$(dirname "$0")"

clear
echo ""
echo "  ╔═══════════════════════════════════════╗"
echo "  ║   Harpoon Story Engine — Setup        ║"
echo "  ╚═══════════════════════════════════════╝"
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
  echo "  ✗ Node.js is not installed."
  echo ""
  echo "  Opening the Node.js download page..."
  echo "  Download the LTS version, install it,"
  echo "  then double-click this setup file again."
  echo ""
  open "https://nodejs.org/en/download"
  read -p "  Press Enter when Node.js is installed..."
  if ! command -v node &> /dev/null; then
    echo "  Still not found. Please restart Terminal and try again."
    exit 1
  fi
fi
echo "  ✓ Node.js $(node --version) found"

# Check git (macOS offers to install it the first time it's used)
if ! git --version &> /dev/null; then
  echo "  ✗ git is not installed."
  echo ""
  echo "  A window should have opened offering to install"
  echo "  the command line developer tools. Install them,"
  echo "  then double-click this setup file again."
  echo ""
  read -p "  Press Enter to close..."
  exit 1
fi
echo "  ✓ git found"

# Link this folder to GitHub so start.command can keep it up to date.
# The repository is public, so no sign-in is needed. Only files that are
# part of the Story Engine are replaced; .env and anything else of yours
# in the folder are left alone.
if [ ! -d ".git" ]; then
  echo "  Linking this folder to GitHub..."
  if git init --quiet \
    && git remote add origin https://github.com/HarpoonProductions/harpoon-story-engine.git \
    && git fetch --quiet origin main \
    && git checkout --quiet -f -B main origin/main; then
    echo "  ✓ Linked to GitHub and updated to the latest version"
  else
    echo "  ✗ Couldn't link to GitHub. Check your internet connection"
    echo "    and run setup again."
    rm -rf .git
    read -p "  Press Enter to close..."
    exit 1
  fi
else
  echo "  ✓ Already linked to GitHub"
fi

# Install dependencies
echo "  Installing dependencies (this takes a minute)..."
npm ci --include=optional --silent
npm install --no-save --os=darwin --cpu=arm64 sharp --silent 2>/dev/null || true
shasum package-lock.json | cut -d' ' -f1 > node_modules/.lock-hash
echo "  ✓ Dependencies installed"

# Check .env
if [ ! -f ".env" ]; then
  echo ""
  echo "  ⚠  No .env file found."
  echo ""
  echo "  You need a .env file with your credentials."
  echo "  Ask Giles to send you the .env file and"
  echo "  drop it into this folder, then run setup again."
  echo ""
else
  echo "  ✓ .env file found"
fi

echo ""
echo "  ╔═══════════════════════════════════════╗"
echo "  ║   Setup complete!                     ║"
echo "  ║   Double-click start.command          ║"
echo "  ║   to launch the Story Engine.         ║"
echo "  ╚═══════════════════════════════════════╝"
echo ""
read -p "  Press Enter to close..."
