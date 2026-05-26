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

# Install dependencies
echo "  Installing dependencies (this takes a minute)..."
npm install --silent
npm install --os=darwin --cpu=arm64 sharp --silent 2>/dev/null || true
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
