#!/usr/bin/env bash
# publish.sh — put the digest where a person will actually find it.
#
#   bin/publish.sh
#
# Reads `report:` from advocate.yml and writes bin/digest.mjs's page to it. Every destination
# here is A GIT PUSH. Nothing calls the GitHub API, opens an issue, or files a discussion —
# not out of purity, but because a second surface is a second thing that can be stale while
# the repository is fine, and because the agent that maintains this should not need a token
# and a REST client to say what it thinks.
#
# THE PAGE IS REWRITTEN WHOLE, EVERY TIME. There is no archive, on purpose. Reports get
# edited far more than they get written, and the value of the current one is that it is
# current; the history is in the branch, where history goes.
#
#   report.branch   an orphan branch of this repo — one file, README.md, so that visiting
#                   the branch on GitHub renders it. Never merged into anything.
#   report.wiki     the repo's wiki, which is itself a git repository (<origin>.wiki.git).
#                   Opt-in: GitHub does not create it until a first page exists, so this
#                   pushes only if the remote is already there, and says so if it is not.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
root="$(git rev-parse --show-toplevel)"
say() { echo "advocate: $*"; }

report=$(node "$here/bin/seats.mjs" --report)
branch=$(node -e 'const r=JSON.parse(process.argv[1]);process.stdout.write(r.branch||"")' "$report")
wiki=$(node -e 'const r=JSON.parse(process.argv[1]);process.stdout.write(String(r.wiki))' "$report")

if [ -z "$branch" ] && [ "$wiki" != "true" ]; then say "report: nothing declared; digest not published"; exit 0; fi

# --- the branch ---------------------------------------------------------------------------
if [ -n "$branch" ]; then
  # Same reasoning as a seat's workspace (see session.mjs): out of the subject repo where
  # `git add -A` cannot reach it, and out of `.git` where a local agent may not write.
  if [ -n "${ADVOCATE_WORK_DIR:-}" ]; then
    work="$ADVOCATE_WORK_DIR/$(basename "$root")/.report"
  else
    work="$(git -C "$root" rev-parse --git-common-dir)/advocate-report"
    case "$work" in /*) ;; *) work="$root/$work" ;; esac
  fi
  mkdir -p "$(dirname "$work")"
  rm -rf "$work"
  git -C "$root" worktree prune

  if git -C "$root" rev-parse --verify -q "refs/heads/$branch" >/dev/null; then
    git -C "$root" worktree add --quiet -B "$branch" "$work" "$branch"
  elif git -C "$root" rev-parse --verify -q "refs/remotes/origin/$branch" >/dev/null; then
    git -C "$root" worktree add --quiet -B "$branch" "$work" "origin/$branch"
  else
    # Orphan, like a seat's workspace: the digest shares no history with main and is never
    # merged into it. A generated page in main's tree would churn the default branch every
    # round and make every submodule pin that references it look like it moved.
    git -C "$root" worktree add --quiet --detach "$work" HEAD
    git -C "$work" checkout --quiet --orphan "$branch"
    git -C "$work" rm -rq --cached . >/dev/null 2>&1 || true
    find "$work" -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
  fi

  # The whole hub, not just the index. /tree/<branch> renders README.md and lists the seat
  # pages beside it, so the findings are one click from the repo with nothing turned on —
  # which is the thing the wiki was wanted for, minus the wiki's one-time manual setup.
  node "$here/bin/digest.mjs" --pages "$work" --as branch
  git -C "$work" config user.name  "${ADVOCATE_COMMITTER_NAME:-advocate}"
  git -C "$work" config user.email "${ADVOCATE_COMMITTER_EMAIL:-advocate@users.noreply.github.com}"
  git -C "$work" add -A
  if git -C "$work" diff --cached --quiet; then
    say "report: digest unchanged on $branch"
  else
    git -C "$work" commit -qm "council: digest $(date -u +%Y-%m-%d)"
    if [ "${ADVOCATE_PUSH:-true}" = "true" ]; then
      git -C "$work" push -q origin "HEAD:refs/heads/$branch" && say "report: digest pushed to $branch" \
        || say "report: could not push $branch"
    else
      say "report: digest committed to $branch; push disabled"
    fi
  fi
  git -C "$root" worktree remove --force "$work" 2>/dev/null || true
fi

# --- the wiki -----------------------------------------------------------------------------
if [ "$wiki" = "true" ]; then
  origin="$(git -C "$root" remote get-url origin 2>/dev/null || true)"
  url="${origin%.git}.wiki.git"
  if [ -z "$origin" ]; then
    say "report: wiki requested but there is no origin"
  elif ! git ls-remote "$url" >/dev/null 2>&1; then
    # Say the actual reason. "Repository not found" sends someone hunting for a permissions
    # problem when the answer is that nobody has ever opened the wiki.
    say "report: wiki requested but ${url##*/} does not exist yet — enable the wiki and create"
    say "        one page in the browser once; after that this is only ever a push"
  else
    ww="$(mktemp -d)"
    git clone -q "$url" "$ww"
    # The whole hub, not just the index: Home, a sidebar, and one page per seat carrying that
    # seat's actual documents. An index of links would only relocate the problem — you would
    # still open a branch per seat to read a finding.
    node "$here/bin/digest.mjs" --pages "$ww" --as wiki
    git -C "$ww" config user.name  "${ADVOCATE_COMMITTER_NAME:-advocate}"
    git -C "$ww" config user.email "${ADVOCATE_COMMITTER_EMAIL:-advocate@users.noreply.github.com}"
    git -C "$ww" add -A
    if git -C "$ww" diff --cached --quiet; then say "report: wiki unchanged"
    else
      git -C "$ww" commit -qm "council: digest $(date -u +%Y-%m-%d)"
      git -C "$ww" push -q origin HEAD && say "report: digest pushed to the wiki" || say "report: could not push the wiki"
    fi
    rm -rf "$ww"
  fi
fi
