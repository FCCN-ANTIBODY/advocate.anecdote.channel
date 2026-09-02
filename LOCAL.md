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

**Nothing about the repository is sent to an inference provider.** Not the diff, not the
constitution, not the advocate's reasoning. The strongest version of not-being-trained-on is not
choosing a vendor with a good policy this quarter — it is never sending it.

**The honest limit:** pushing the branch still puts the *result* on GitHub, and on a public repo
that was always public. What stays home is the reading and the reasoning, which is the part that
was never public and never had to leave.

## The routine prompt

For a scheduled local agent (Claude desktop routines, cron, whatever). It is short on purpose —
everything it needs is in the checkout by the time it looks.

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
