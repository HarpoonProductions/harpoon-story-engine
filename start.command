#!/bin/bash

# Harpoon Story Engine — Editor Launcher
# Double-click this file to start the editor.
# The browser will open automatically at http://localhost:3001

# Change to the directory containing this script
# (works regardless of where the file is double-clicked from)
cd "$(dirname "$0")"

# Check Node.js is installed
if ! command -v node &> /dev/null; then
  osascript -e 'display alert "Node.js not found" message "Please install Node.js from https://nodejs.org and try again." as critical'
  exit 1
fi

# Check .env exists
if [ ! -f ".env" ]; then
  osascript -e 'display alert "Missing .env file" message "Please create a .env file in the Story Engine folder with your AWS and GitHub credentials. See .env.example for the format." as critical'
  exit 1
fi

# Pull latest updates from GitHub (only if this is a git repo)
if [ -d ".git" ]; then
  echo "  Checking for updates..."
  if git pull --rebase origin main 2>/dev/null; then
    echo "  ✓ Up to date"
  else
    echo "  ⚠  Could not check for updates — continuing anyway"
  fi
fi

# Install any new dependencies
if [ ! -d "node_modules" ]; then
  echo "  Installing dependencies..."
  npm install
  npm install --os=darwin --cpu=arm64 sharp
fi

# Clear the terminal and show a clean startup message
clear
echo ""
echo "  ╔═══════════════════════════════════════╗"
echo "  ║   Harpoon Story Engine — Editor       ║"
echo "  ║   Opening at http://localhost:3001     ║"
echo "  ╚═══════════════════════════════════════╝"
echo ""
echo "  Keep this window open while you're working."
echo "  Close it to stop the editor."
echo ""

# Start the editor
node editor.js
