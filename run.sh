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
out() { if [ -n "${GITHUB_OUTPUT:-}" ]; then echo "$1=$2" >> "$GITHUB_OUTPUT"; fi; echo "advocate: $1=$2"; }

session="$(node "$here/bin/session.mjs" "$name" --subject "$ref" --json)"
branch=$(node -e 'process.stdout.write(JSON.parse(process.argv[1]).branch)' "$session")
work=$(node -e 'process.stdout.write(JSON.parse(process.argv[1]).workspace)' "$session")
quiet=$(node -e 'process.stdout.write(String(JSON.parse(process.argv[1]).quiet))' "$session")
count=$(node -e 'process.stdout.write(String(JSON.parse(process.argv[1]).commits.length))' "$session")
first=$(node -e 'process.stdout.write(String(JSON.parse(process.argv[1]).first))' "$session")

out branch "$branch"
out commits "$count"

for f in POSITION.md COMPLAINTS.md ASKS.md; do [ -f "$work/$f" ] || : > "$work/$f"; done

git -C "$work" config user.name  "${ADVOCATE_COMMITTER_NAME:-advocate}"
git -C "$work" config user.email "${ADVOCATE_COMMITTER_EMAIL:-advocate@users.noreply.github.com}"

commit_and_push() {
  git -C "$work" add -A
  git -C "$work" diff --cached --quiet && { echo "advocate: nothing to commit"; return 0; }
  git -C "$work" commit -qm "$1"
  if [ "${ADVOCATE_PUSH:-true}" = "true" ]; then
    git -C "$work" push -q origin "HEAD:refs/heads/$branch"
  else
    echo "advocate: push disabled; $branch left local"
  fi
  return 0
}

# 1. Nothing merged. This is a real answer; say it in one line and stop.
if [ "$quiet" = "true" ]; then
  commit_and_push "$name: quiet session"
  out status quiet
  exit 0
fi

# 2. LOCAL is the declared path: prepare the work, post the order, and never reach for an
#    API — even if a credential is sitting right there. The expensive, cloud-bound half is
#    something a repository OPTS INTO by saying so in advocate.yml, not something that starts
#    happening because a key appeared in the org.
mode=$(node "$here/bin/seats.mjs" --seat "$name" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>process.stdout.write(JSON.parse(s).session))')

if [ "$mode" = "local" ]; then
  node "$here/bin/order.mjs" "$name" "$work" "$session" "$here"
  if [ "$first" = "true" ]; then
    commit_and_push "$name: seated at $(git rev-parse --short "$ref") — work order open for a local session"
  else
    commit_and_push "$name: $count commit(s) to read — work order open for a local session"
  fi
  out status pending
  exit 0
fi

# 3. Is a session summonable at all? Probe first, so "no credential" degrades to a staged
#    session for a human rather than a faked one. Any adapter honoring the stdin/stdout
#    contract can stand behind ADVOCATE_AGENT_CMD; the bundled one talks to the Messages API.
export ANTHROPIC_API_KEY="${ADVOCATE_AGENT_KEY:-${ANTHROPIC_API_KEY:-}}"
cmd="${ADVOCATE_AGENT_CMD:-$here/bin/advocate-agent}"

if ! $cmd --available >/dev/null 2>&1; then
  node "$here/bin/order.mjs" "$name" "$work" "$session" "$here"
  if [ "$first" = "true" ]; then
    commit_and_push "$name: seated at $(git rev-parse --short "$ref") — no agent available"
  else
    commit_and_push "$name: staged $count commit(s) — no agent available"
  fi
  out status staged
  exit 0
fi

# 4. Summon the session. It receives the method, its seat, the range, and its own current
#    files — and nothing else. It returns four whole documents; this script writes them.
agent_in="$(jq -n \
  --rawfile method "${ADVOCATE_METHOD:-$here/METHOD.md}" \
  --argjson seat "$(node "$here/bin/seats.mjs" --seat "$name")" \
  --argjson range "$session" \
  --rawfile position "$work/POSITION.md" \
  --rawfile complaints "$work/COMPLAINTS.md" \
  --rawfile asks "$work/ASKS.md" \
  '{method: $method, seat: $seat, range: $range,
    current: {position: $position, complaints: $complaints, asks: $asks}}')"

raw="$(printf '%s' "$agent_in" | $cmd || true)"
if ! printf '%s' "$raw" | jq -e '.position and .complaints and .asks and .session' >/dev/null 2>&1; then
  # The agent was available and did not deliver. That is a not-available state too: stage
  # it for a human rather than write half a session.
  node "$here/bin/order.mjs" "$name" "$work" "$session" "$here"
  commit_and_push "$name: staged $count commit(s) — the session did not return"
  out status staged
  exit 1
fi

printf '%s' "$raw" | jq -r '.position'   > "$work/POSITION.md"
printf '%s' "$raw" | jq -r '.complaints' > "$work/COMPLAINTS.md"
printf '%s' "$raw" | jq -r '.asks'       > "$work/ASKS.md"
printf '%s' "$raw" | jq -r '.session'    > "$work/sessions/$(date -u +%Y-%m-%d).md"
rm -f "$work/sessions/PENDING.md" "$work/sessions/.pending.json"

if [ "$first" = "true" ]; then
  commit_and_push "$name: seated $(date -u +%Y-%m-%d) — opening position"
  out status seated
else
  commit_and_push "$name: session $(date -u +%Y-%m-%d) — $count commit(s) read"
  out status spoke
fi
