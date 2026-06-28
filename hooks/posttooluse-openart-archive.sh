#!/bin/sh
# PROMPTSYNC-OPENART-ARCHIVE (PostToolUse) — archive an OpenArt video OUTPUT to Google Drive.
#
# Wired into ~/.claude/settings.json with matcher "mcp__claude_ai_OpenArt__openart_creation_wait"
# (the tool whose response carries the COMPLETED resource URL on a CLI host). It reads the hook
# JSON on stdin, regex-finds a finished video URL (cdn.openart.ai …mp4/mov/webm), attributes it
# to the active PromptSync project (from cwd → nearest project.yaml), and backgrounds
# drive-push-asset.ts to upsert it at  promptsync/<project>/openart-outputs/<historyId>.<ext>.
#
# STILL_RUNNING / image / non-video responses contain no matching URL → it no-ops.
# Always exits 0 and never blocks: the upload is backgrounded.

PLATFORM="$HOME/personal/promptsync/platform"
CREDS="$HOME/personal/promptsync/google_creds/outh.json"
LOG="$HOME/.promptsync-drive-push.log"

[ -d "$PLATFORM" ] || exit 0

NODE_BIN="/home/saleksandar/.nvm/versions/node/v22.22.2/bin"
[ -d "$NODE_BIN" ] && PATH="$NODE_BIN:$PATH"
export PATH

# Parse the whole payload once: line1=video url, line2=historyId, line3=cwd.
PARSED="$(python3 -c '
import sys, json, re
raw = sys.stdin.read()
url = ""
m = re.search(r"https://cdn\.openart\.ai/[^\"\\ ]+\.(?:mp4|mov|webm|m4v)", raw)
if m: url = m.group(0)
hid = ""; cwd = ""
try:
    d = json.loads(raw)
    cwd = d.get("cwd") or ""
    hid = (d.get("tool_input") or {}).get("historyId") or ""
except Exception:
    pass
if not hid:
    m2 = re.search(r"\"historyId\"\s*:\s*\"([^\"]+)\"", raw)
    if m2: hid = m2.group(1)
print(url); print(hid); print(cwd)
' 2>/dev/null)"

URL="$(printf '%s\n' "$PARSED" | sed -n '1p')"
HID="$(printf '%s\n' "$PARSED" | sed -n '2p')"
CWD="$(printf '%s\n' "$PARSED" | sed -n '3p')"

[ -n "$URL" ] || exit 0   # no finished video URL (still running / image / not a video) → ignore

# Filename: <historyId>.<ext-from-url>; fall back to a timestamp if no id.
EXT="${URL##*.}"
BASE="$HID"
[ -n "$BASE" ] || BASE="$(date '+%s')"
DEST="openart-outputs/${BASE}.${EXT}"

# Attribute to the active PromptSync project: walk up cwd to the nearest project.yaml.
PROJECT="_openart-inbox"
dir="$CWD"
while [ -n "$dir" ] && [ "$dir" != "/" ]; do
  if [ -f "$dir/project.yaml" ]; then PROJECT="$(basename "$dir")"; break; fi
  dir="$(dirname "$dir")"
done

(
  cd "$PLATFORM" 2>/dev/null || exit 0
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] OpenArt archive: $PROJECT/$DEST  <- $URL" >>"$LOG"
  GOOGLE_CREDENTIALS_PATH="$CREDS" PROMPTSYNC_DRIVE_ROOT="promptsync" \
    npx tsx scripts/drive-push-asset.ts --project "$PROJECT" --dest "$DEST" --url "$URL" >>"$LOG" 2>&1
) >/dev/null 2>&1 &

exit 0
