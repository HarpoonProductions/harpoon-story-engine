#!/bin/bash

# Harpoon Story Engine — Editor Launcher
# Double-click this file to start the editor.
#
# Every launch brings this folder up to the latest main on GitHub (see
# scripts/update.sh), then opens the Story Engine app. If the app isn't
# available, the editor opens in the browser at http://localhost:3001
# instead. Do code work in a separate folder, not this one.

# Change to the directory containing this script
# (works regardless of where the file is double-clicked from)
cd "$(dirname "$0")"

echo "  Checking for updates..."
bash scripts/update.sh || exit 1

# Open the Story Engine app, which runs the editor in its own window
if [ "$(uname)" = "Darwin" ] && [ -d "Story Engine.app/Contents/Resources/app" ]; then
  open "Story Engine.app" && exit 0
fi

VERSION=$(git log -1 --date=format:'%d %b %Y' --format='%h, %cd' 2>/dev/null || echo "unknown")

if [ "$(uname)" = "Darwin" ]; then
  echo ""
  echo "  ⚠  The Story Engine app isn't available (see above), so the"
  echo "     editor is opening in the browser instead."
fi

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
