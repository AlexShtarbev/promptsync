#!/bin/sh
# PROMPTSYNC-DRIVE-PUSH — mirror authored markdown to Google Drive after each commit.
# Installed into a project repo's .git/hooks/post-commit by scripts/install-drive-hook.ts.
# Non-blocking: the actual upload is backgrounded, so it never delays or fails a commit.

PLATFORM="$HOME/personal/promptsync/platform"
CREDS="$HOME/personal/promptsync/google_creds/outh.json"
LOG="$HOME/.promptsync-drive-push.log"

[ -d "$PLATFORM" ] || exit 0
REPO="$(git rev-parse --show-toplevel 2>/dev/null)" || exit 0
FILES="$(git diff-tree --no-commit-id --name-only -r HEAD 2>/dev/null)"
[ -n "$FILES" ] || exit 0

# Background the push and return immediately; all output goes to the log.
(
  cd "$PLATFORM" 2>/dev/null || exit 0
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] post-commit push for $REPO" >>"$LOG"
  printf '%s\n' "$FILES" | GOOGLE_CREDENTIALS_PATH="$CREDS" PROMPTSYNC_REPO="$REPO" \
    npx tsx scripts/drive-push-changed.ts >>"$LOG" 2>&1
) >/dev/null 2>&1 &

exit 0
