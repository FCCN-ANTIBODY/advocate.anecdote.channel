#!/usr/bin/env bash
# run.sh — the seam. Prepare, hand to the agent if there is one, commit, push.
#
# Deliberately thin: everything that decides anything is either bin/session.mjs (mechanical)
# or the agent reading METHOD.md (judgement). This file only sequences them and refuses to
# invent a result when either is absent.
set -euo pipefail

name="${1:?usage: run.sh <advocate> [subject-ref]}"
ref="${2:-HEAD}"
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
out() { [ -n "${GITHUB_OUTPUT:-}" ] && echo "$1=$2" >> "$GITHUB_OUTPUT"; echo "advocate: $1=$2"; }

session="$(node "$here/bin/session.mjs" "$name" --subject "$ref" --json)"
branch=$(node -e 'process.stdout.write(JSON.parse(process.argv[1]).branch)' "$session")
work=$(node -e 'process.stdout.write(JSON.parse(process.argv[1]).workspace)' "$session")
quiet=$(node -e 'process.stdout.write(String(JSON.parse(process.argv[1]).quiet))' "$session")
count=$(node -e 'process.stdout.write(String(JSON.parse(process.argv[1]).commits.length))' "$session")

out branch "$branch"
out commits "$count"

git -C "$work" config user.name  "${ADVOCATE_COMMITTER_NAME:-advocate}"
git -C "$work" config user.email "${ADVOCATE_COMMITTER_EMAIL:-advocate@users.noreply.github.com}"

commit_and_push() {
  git -C "$work" add -A
  git -C "$work" diff --cached --quiet && { echo "advocate: nothing to commit"; return 0; }
  git -C "$work" commit -qm "$1"
  [ "${ADVOCATE_PUSH:-true}" = "true" ] && git -C "$work" push -q origin "HEAD:refs/heads/$branch"
  return 0
}

# 1. Nothing merged. This is a real answer; say it in one line and stop.
if [ "$quiet" = "true" ]; then
  commit_and_push "$name: quiet session"
  out status quiet
  exit 0
fi

# 2. No credential. Stage what moved for a human and stop — never fabricate a session.
cmd="${ADVOCATE_AGENT_CMD:-}"
if [ -z "$cmd" ] && [ -z "${ADVOCATE_AGENT_KEY:-}" ]; then
  echo "$session" > "$work/sessions/.pending.json"
  commit_and_push "$name: staged $count commit(s) — no agent credential"
  out status staged
  exit 0
fi

# 3. Run the session. The agent gets the method, the seat, and the range; nothing else.
node "$here/bin/seats.mjs" --seat "$name" > "$work/.seat.json"
echo "$session" > "$work/.range.json"
: "${cmd:=claude -p --permission-mode acceptEdits}"
{
  echo "Run one advocate session. The method is law; follow it in order."
  echo; echo "=== METHOD ==="; cat "${ADVOCATE_METHOD:-$here/METHOD.md}"
  echo; echo "=== YOUR SEAT (advocate.yml) ==="; cat "$work/.seat.json"
  echo; echo "=== WHAT MOVED ==="; cat "$work/.range.json"
  echo; echo "Your workspace is $work. The subject repository is $(git rev-parse --show-toplevel)."
  echo "Write only inside your workspace. Do not commit; the caller does that."
} | ( cd "$work" && ANTHROPIC_API_KEY="${ADVOCATE_AGENT_KEY:-}" $cmd )

rm -f "$work/.seat.json" "$work/.range.json" "$work/sessions/.pending.json"
commit_and_push "$name: session $(date -u +%Y-%m-%d) — $count commit(s) read"
out status spoke
