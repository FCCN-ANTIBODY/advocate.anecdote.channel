#!/usr/bin/env bash
# round.sh — one whole council round for THIS repository, on this machine.
#
#   bin/round.sh [--no-fetch] [--dry-run] [--seat <name>]
#
# `run.sh` is one seat's mechanical half and is what CI calls. This is the operator-side
# loop LOCAL.md describes in prose: fetch, run every seat, hand each open work order to a
# LOCAL agent, and publish the digest. It is the thing a cron points at.
#
# WHY IT IS NOT THE WORKFLOW. `session: hosted` means the metered API, declared per seat and
# billed per week forever. This path is neither: the work order sits on a branch, and what
# picks it up is an agent already running on somebody's own machine. That is the third case
# LOCAL.md's routine prompt has always described, and this file is that prompt made
# executable so it stops being retyped.
#
# It refuses the same way everything else here does: if the agent does not deliver a session,
# the order is LEFT IN PLACE and the seat still reads as owed. A round that fired is not a
# round that spoke.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
root="$(git rev-parse --show-toplevel)"
fetch=true; dry=false; only=""
while [ $# -gt 0 ]; do
  case "$1" in
    --no-fetch) fetch=false ;;
    --dry-run)  dry=true ;;
    --seat)     only="${2:?--seat needs a name}"; shift ;;
    -h|--help)  sed -n '2,12p' "${BASH_SOURCE[0]}"; exit 0 ;;
    *) echo "round: unknown argument $1" >&2; exit 2 ;;
  esac
  shift
done

say() { echo "round[$(basename "$root")]: $*"; }

# The range is the input, and a stale checkout hides it. Failing to fetch is not fatal —
# offline is a supported condition here, and a round read from local refs is still honest
# about what it read.
if [ "$fetch" = true ]; then
  git -C "$root" fetch --all --prune --quiet 2>/dev/null || say "could not fetch; reading local refs"
fi

seats=$(node "$here/bin/seats.mjs" --matrix | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>process.stdout.write(JSON.parse(s).include.map(x=>x.name).join("\n")))')
[ -n "$seats" ] || { say "no seats declared"; exit 0; }

# ---------------------------------------------------------------------------------------
# 1. The mechanical half, per seat. Costs nothing, needs no credential, calls nothing out.
#    run.sh is reused rather than reimplemented so CI and this path cannot drift apart.
# ---------------------------------------------------------------------------------------
for name in $seats; do
  [ -z "$only" ] || [ "$only" = "$name" ] || continue
  ADVOCATE_PUSH="${ADVOCATE_PUSH:-true}" bash "$here/run.sh" "$name" HEAD >/dev/null || say "$name: mechanical half failed"
done

# ---------------------------------------------------------------------------------------
# 2. The judgement half. Only for seats carrying an open order — a seat whose range was
#    empty already wrote its one line and is not owed anything.
# ---------------------------------------------------------------------------------------
owed=$(node "$here/bin/pending.mjs" --json | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>process.stdout.write(JSON.parse(s).map(o=>o.advocate).join("\n")))')

if [ -z "$owed" ]; then
  say "nothing owed"
else
  for name in $owed; do
    [ -z "$only" ] || [ "$only" = "$name" ] || continue
    work="$(node "$here/bin/session.mjs" "$name" --json | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>process.stdout.write(JSON.parse(s).workspace))')"

    if [ "$dry" = true ]; then say "$name: owed a session; workspace $work (dry run)"; continue; fi

    say "$name: summoning a local session"
    prompt="You are the advocate \`$name\`, seated in $(basename "$root").

Your workspace is $work and you work THERE and nowhere else. Read, in this order:

1. $work/sessions/PENDING.md — your work order. It names the range.
2. $here/METHOD.md — the method. It is law, including its refusals. Follow it in order.
3. $root/advocate.yml, the entry under \`$name\` — the only thing that says what to want.

Then do the session. Do not widen scope beyond $root. Report an unmeasurable goal as
unmeasured. Never manufacture output because a schedule fired — an empty or thin range is a
real answer and saying so is a complete session.

Finish by deleting $work/sessions/PENDING.md. Do not commit and do not push; the round does
that. Do not touch anything under $root outside your workspace."

    # A swappable adapter, so this is not a Claude Code framework. Anything that reads a
    # prompt on stdin and edits the workspace it is handed will do.
    if [ -n "${ADVOCATE_LOCAL_AGENT:-}" ]; then
      printf '%s' "$prompt" | (cd "$work" && "$ADVOCATE_LOCAL_AGENT" "$work" "$root" "$name") || say "$name: agent exited nonzero"
    else
      (cd "$work" && claude -p "$prompt" \
          --add-dir "$root" --add-dir "$here" \
          --permission-mode acceptEdits \
          --model "${ADVOCATE_MODEL:-sonnet}" \
          ${ADVOCATE_EFFORT:+--effort "$ADVOCATE_EFFORT"}) || say "$name: agent exited nonzero"
    fi

    today="$(date -u +%Y-%m-%d)"
    if [ -f "$work/sessions/PENDING.md" ] || [ ! -f "$work/sessions/$today.md" ]; then
      # Not delivered. Leave the order standing: the seat reads as owed next round, which is
      # the only honest state. Half a session written down is worse than none.
      say "$name: no session delivered — order left standing"
      git -C "$work" checkout -- . 2>/dev/null || true
      continue
    fi

    git -C "$work" config user.name  "${ADVOCATE_COMMITTER_NAME:-advocate}"
    git -C "$work" config user.email "${ADVOCATE_COMMITTER_EMAIL:-advocate@users.noreply.github.com}"
    git -C "$work" add -A
    if git -C "$work" diff --cached --quiet; then
      say "$name: agent changed nothing"
    else
      drafts=$(grep -rho 'status: draft' "$work" 2>/dev/null | wc -l | tr -d ' ')
      ready=$(grep -rho 'status: ready' "$work" 2>/dev/null | wc -l | tr -d ' ')
      git -C "$work" commit -qm "$name: session $today — $drafts draft(s), $ready ready"
      if [ "${ADVOCATE_PUSH:-true}" = "true" ]; then
        git -C "$work" push -q origin "HEAD:refs/heads/$(git -C "$work" rev-parse --abbrev-ref HEAD)" \
          && say "$name: spoke — $drafts draft(s), $ready ready" \
          || say "$name: spoke but could not push"
      else
        say "$name: spoke — push disabled, branch left local"
      fi
    fi
  done
fi

# ---------------------------------------------------------------------------------------
# 3. The one page anyone reads. Rewritten whole; never appended to.
# ---------------------------------------------------------------------------------------
[ "$dry" = true ] || bash "$here/bin/publish.sh" || say "digest not published"
node "$here/bin/digest.mjs"
