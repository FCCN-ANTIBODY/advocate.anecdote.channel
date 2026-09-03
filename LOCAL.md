# Running the council locally

**The default.** A repository that mounts this does **not** call any API until it says so in
`advocate.yml`. Adding an org-wide credential must not quietly switch every repo onto a paid,
cloud-bound path — so the path is *declared*, and `local` is what it declares by default.

```yaml
advocates:
  - name: upkeep
    session: local     # the default. Prepare the work; never call out.
  - name: other
    session: hosted    # opt in: run it unattended, at cost, over the API.
```

`local` is stronger than a disabled workflow or an absent secret. Both of those are ambient —
invisible in the repository, decided somewhere else, silently reversible when a key appears.
This is a line in a file, reviewed in a pull request, and **a credential sitting right there
does not override it.**

## What still runs, and what never does

The mechanical half of a session costs nothing and needs no credential: advance the pin, compute
the range, prepare the branch. Let that run wherever you like — including on GitHub. It is
ordinary git.

The half that needs judgement is left as a **work order** at `sessions/PENDING.md` on the
advocate's own branch. **The branch is the queue** — no issues, no labels, no second surface to
keep honest. Anything can pick it up: a desktop routine, an agent on your laptop, or you.

```sh
node .advocate-engine/bin/pending.mjs        # what is owed, read from local refs
node .advocate-engine/bin/session.mjs upkeep # prepare (or re-enter) one workspace
```

## What this actually buys you

**The pipeline never calls out.** Nothing in a `local` session — not the diff, not the
constitution, not the advocate's reasoning — is sent anywhere by this framework. The strongest
version of not-being-trained-on is not choosing a vendor with a good policy this quarter; it is the
code that would do the sending not existing on this path.

**Two honest limits, because the sentence above is easy to over-read.**

1. **`local` is a claim about the pipeline, not about you.** The work order is a queue anything can
   drain, and the routine prompt below hands it to an agent on purpose. If that agent is a hosted
   model, the repository reaches an inference provider — through *your* client, on *your* terms,
   under a subscription you already chose, rather than through a metered call this framework made
   on its own initiative because a schedule fired. That distinction is the entire point of the
   declaration, and it is worth more than the absolute would have been. A person doing it by hand,
   or a model on the same machine, sends nothing at all.
2. **Pushing the branch still puts the *result* on GitHub**, and on a public repo that was always
   public. What stays home is the reading, which is the part that was never public.

## One command: `bin/round.sh`

The prompt below is the loop written out for a person. `bin/round.sh` is the same loop written out
for a machine, and it is what a schedule should point at:

```sh
node .advocate-engine/bin/round.sh              # fetch, run every seat, publish the digest
node .advocate-engine/bin/round.sh --dry-run    # what is owed, without summoning anything
node .advocate-engine/bin/round.sh --seat upkeep
```

It runs the mechanical half through the same `run.sh` that CI calls — so the two paths cannot
drift — then hands each open work order to a local agent, commits, pushes, and rewrites the digest.

**It refuses the way everything else here does.** If the agent does not delete the work order and
leave a session note, the workspace is reverted and the seat still reads as owed. A round that
fired is not a round that spoke.

| | |
| --- | --- |
| `ADVOCATE_LOCAL_AGENT` | a command taking `<workspace> <root> <seat>` with the prompt on stdin. Default: the `claude` CLI. |
| `ADVOCATE_MODEL` | model for the default agent. Default `sonnet` — a caretaking session is reading, not reasoning about a hard problem, and the cheap one is the one you can afford weekly. |
| `ADVOCATE_PUSH` | `false` leaves every branch local. |
| `ADVOCATE_WORK_DIR` | where workspaces are checked out. `round.sh` defaults it to `~/.local/state/advocate`. |

**Why the workspaces move on this path.** `session.mjs` puts them under `.git/` so a stray
`git add -A` on the subject cannot sweep one into `main`. That is right for CI and unusable
locally: an agent running on somebody's machine may be flatly forbidden to write anywhere under
`.git` — Claude Code treats the whole directory as sensitive and refuses, with nobody around to
approve it — so the local path would fail on its first write, every time. A workspace the agent
cannot write in is not a workspace. Outside the repo is the **stronger** version of the same
guarantee anyway: it cannot be committed to the subject by accident, because it is not in the
subject.

### The cadence is the budget

Pick the interval from **what the work costs you**, not from what would be responsive. Seats read
merged commits; nothing arrives between them that a faster clock would catch sooner. Weekly is the
shipped default, and a round that fires against an empty range costs one line and a few seconds.

If the agent runs against a subscription with a usage window, **align the interval to the window
rather than to the calendar** — one round per window is a rate nothing else has to be tuned around,
and it makes the worst case a round you can name in advance.

## The routine prompt

If you would rather drive it yourself. It is short on purpose — everything it needs is in the
checkout by the time it looks.

```
Weekly, in <path-to-repo>:

1. git fetch --all --prune && git pull --ff-only
2. node .advocate-engine/bin/pending.mjs
   Nothing owed? Say so and stop. That is a real answer — do not go looking for work.
3. For each advocate owed a session:
   a. node .advocate-engine/bin/session.mjs <advocate>
      It prints the workspace path. Work there and nowhere else.
   b. Read sessions/PENDING.md. It names the range and what to produce.
   c. Follow .advocate-engine/METHOD.md exactly, in order. It is law, including its
      refusals — do not widen scope beyond this repository, report an unmeasurable
      goal as unmeasured, and never manufacture output because a schedule fired.
   d. Delete sessions/PENDING.md, commit on the advocate's branch, and push it.
      Never merge it into main.
4. Report which advocates spoke, which went quiet, and anything you refused to say.
```

**Do not paraphrase `METHOD.md` into the prompt.** It travels with the engine so it can be
corrected once, for every seat, without editing anybody's routine.

## Not letting GitHub run it at all

Keeping the scheduled workflow is recommended even in `local` mode: it costs nothing, and it keeps
the declaration live rather than dormant — the order appears on its own and you find work waiting.

If you would rather GitHub never act, drop the `schedule:` trigger from `council.yml` and leave
`workflow_dispatch:`. **The workflow is still the definition of the pipeline** — it just stops
being the thing that fires it, which is the posture the rest of this constellation already takes
with its dormant crons.

## What a `hosted` seat actually costs you

Verified against a real, correctly-configured credential on 2026-09-02: the request authenticated,
resolved its workspace, and came back

> `Your credit balance is too low to access the Anthropic API.`

Which is the point stated plainly by the API itself — **a hosted seat spends money every week, per
advocate, forever.** The framework degrades exactly as designed (the session went `staged` and left
its work order), so nothing was lost; but there is no version of `hosted` that is free, and a
council of several seats across several repos multiplies it.

`local` costs nothing and sends nothing. Reach for `hosted` only where unattended really matters.

## If you do turn a seat `hosted`

Two values, and the second one is easy to misread:

| what | where | shape |
| --- | --- | --- |
| `ADVOCATE_AGENT_KEY` | an org **secret** | the API key |
| `ADVOCATE_WORKSPACE_ID` | an org **variable** | `wrkspc_01...`, from the **Anthropic Console** |

The second is needed only when the key is identity-linked, and it is the **Anthropic** workspace —
not a GitHub org or repository. "Workspace" means three separate things in this stack (the Actions
checkout, the advocate's branch, and the Anthropic one), so `bin/advocate-agent` refuses a value
that is obviously not an id rather than spending a call to be told.

**The easiest version of this is not to need it.** A **workspace-scoped API key** carries its own
workspace, requires no header, and lets you delete the variable entirely. Only an *identity-linked*
key demands the id — so if the Console will not let you copy the string, change the key instead of
fighting the string.

Create the key **from inside the workspace you want it scoped to** (Console → that workspace → API
keys → create). A key made there is bound to it, and nothing ever has to name the id. The
workspace list elides ids in the middle (`wrkspc_01…5GRxn5C`) and the truncation is in the markup,
not just the styling, so there is no full string on the page to select — on a phone especially,
this route is the only comfortable one.

If you do want the id and the Console truncates it on screen, read it where nothing truncates:

```sh
brew install anthropics/tap/ant
xattr -d com.apple.quarantine "$(brew --prefix)/bin/ant"
ant auth login                    # a browser picker — click the workspace, never retype it
ant auth status                   # reports the active workspace
cat "${ANTHROPIC_CONFIG_DIR:-$HOME/.config/anthropic}"/configs/*.json
```

The picker means you select the workspace **by name** and the id lands in a JSON file you can
`cat`. The Console URL carries it too — `platform.claude.com/workspaces/<id>/…` — so copying the
address bar beats selecting the truncated text.
