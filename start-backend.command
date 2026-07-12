#!/bin/zsh
set -e

ROOT="${0:A:h}"
BACKEND="$ROOT/backend"
PNPM="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/fallback/pnpm"

cd "$BACKEND"

if [[ ! -x "$PNPM" ]]; then
  print "Package manager was not found at: $PNPM"
  print "Install Node.js, then run: npm install && npm start"
  read "?Press Enter to close..."
  exit 1
fi

if [[ ! -d node_modules ]]; then
  print "Installing backend packages..."
  "$PNPM" install
fi

print "Starting Meta Leads CRM at http://localhost:4000"
(sleep 2; open "http://localhost:4000") &
exec /usr/local/bin/node src/server.js
