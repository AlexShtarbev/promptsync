#!/bin/sh
# PROMPTSYNC-DRIVE-PUSH (PostToolUse) — mirror a just-written PromptSync project text file
# to Google Drive, the instant Claude writes it (no commit needed).
#
# Wired into ~/.claude/settings.json as a PostToolUse hook with matcher "Write|Edit".
# It reads the hook's JSON on stdin, extracts the written file path, and — only if that
# file is a TEXT file living inside a PromptSync project (an ancestor dir has project.yaml)
# — backgrounds scripts/drive-push-changed.ts for it. Everything else is ignored.
#
# Always exits 0 and never blocks: the upload is backgrounded; this never affects the tool.

PLATFORM="$HOME/personal/promptsync/platform"
CREDS="$HOME/personal/promptsync/google_creds/outh.json"
LOG="$HOME/.promptsync-drive-push.log"

[ -d "$PLATFORM" ] || exit 0

# Make node/npx/tsx resolvable regardless of the harness's PATH.
NODE_BIN="/home/saleksandar/.nvm/versions/node/v22.22.2/bin"
[ -d "$NODE_BIN" ] && PATH="$NODE_BIN:$PATH"
export PATH

# 1) Pull the written file path out of the PostToolUse JSON on stdin.
FILE="$(python3 -c 'import sys,json
try:
  d=json.load(sys.stdin); print((d.get("tool_input") or {}).get("file_path") or "")
except Exception:
  print("")' 2>/dev/null)"
[ -n "$FILE" ] || exit 0
[ -f "$FILE" ] || exit 0

# 2) Authored text only (cheap check before spawning node).
case "$FILE" in
  *.md|*.yaml|*.yml|*.json|*.tsv|*.txt) ;;
  *) exit 0 ;;
esac

# 3) Walk up to the owning PromptSync project (nearest ancestor with project.yaml).
dir="$(dirname "$FILE")"
root=""
while [ -n "$dir" ] && [ "$dir" != "/" ]; do
  if [ -f "$dir/project.yaml" ]; then root="$dir"; break; fi
  dir="$(dirname "$dir")"
done
[ -n "$root" ] || exit 0   # not part of a PromptSync project → ignore

# 4) Background the upsert; never block the tool. drive-push-changed re-validates the
#    project (so a non-project file can never slip through) and upserts to promptsync/<project>/.
(
  cd "$PLATFORM" 2>/dev/null || exit 0
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] PostToolUse push: $FILE (project: $root)" >>"$LOG"
  GOOGLE_CREDENTIALS_PATH="$CREDS" PROMPTSYNC_REPO="$root" PROMPTSYNC_DRIVE_ROOT="promptsync" \
    npx tsx scripts/drive-push-changed.ts "$FILE" >>"$LOG" 2>&1
) >/dev/null 2>&1 &

exit 0
