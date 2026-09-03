# advocate.anecdote.channel

**Agentic repository caretaking framework.** An *advocate* is a seat that speaks, permanently, for
one constituency about one question: **what would make us stop, and what do we need in order not to
stop.**

It is not there for the integrity of the build or the correctness of the code — tests own that. It
is not there for the content the repository publishes, or for anybody's agenda about it. It is there
for the conditions under which the thing keeps running for the people who depend on it. That is
**caretaking**, and it is the only thing in scope.

**An advocate decides nothing.** It cannot merge, it cannot write outside an explicit grant, and it
holds no authority over the repository or over another advocate. It counsels. Every output is a
position or a request, and every request can be declined by closing a tab.

## What you get, from a cold checkout and no network

You have this directory. There is nothing to install — no dependencies, on purpose.

```sh
node bin/seats.mjs --seat upkeep      # read a config, with every default resolved
node bin/session.mjs upkeep           # prepare a workspace and report what moved
npm test                              # node test/*.test.mjs
```

`bin/session.mjs` needs only a git repository. It creates the advocate's branch as an **orphan**,
checks it out as a worktree — inside `.git/` by default, where a stray `git add -A` on the subject
can never sweep it into `main`, or wherever `ADVOCATE_WORK_DIR` says — and prints the first-parent
commits merged since that advocate last ran.

Everything above works with the network off. The workflow in `skel/` is how this is *scheduled*, not
how it *works* — a declarative definition of the loop, not the runtime it depends on.

## Mounting it

A mount and two files land in the repository being cared for, and one of the files is optional.

**0. The mount: `.advocate-engine`** — this repository, as a submodule, per the
`.<subdomain>-engine` convention.

```sh
git submodule add https://github.com/FCCN-ANTIBODY/advocate.anecdote.channel .advocate-engine
```

The local runbook is written against it — `node .advocate-engine/bin/pending.mjs`,
`node .advocate-engine/bin/session.mjs <advocate>` — so without the mount the default path has
nothing to run. See [`LOCAL.md`](LOCAL.md).

**Why a mount and not a vendored copy.** Two reasons, and the second is the deciding one.

*The pin is a broadcast.* A submodule records a hash in the subject repository, so which version of
this a repo took, and when it took it, is legible from the outside without asking anyone. That
presence is itself a signal about how the repo is governed — visible before a single session runs.
A vendored file would carry a hash too, so this reason alone would not settle it.

*This is a space, not a payload.* It is an engine: material a subject repo is meant to be able to
bootstrap from, not a fixed set of files to copy once. A vendored copy forecloses that — it freezes
the thing at the moment it was taken and turns every later capability into a re-vendoring chore.
Mounting keeps the engine canonical and lets a subject reach into it for whatever it grows.

The cost is real and small: a recursive clone of a subject repository pulls this one too.

**1. `advocate.yml` at the root** — the only file this framework asks you for. Start from
[`skel/advocate.yml`](skel/advocate.yml); the annotated version is
[`advocate.example.yml`](advocate.example.yml).

```yaml
version: 1
advocates:
  - name: upkeep
    mission: What would make us stop, and what we need in order not to stop.
    writes: []                    # honest defaults fire nothing
    constituency: |
      The person who runs this and did not write it…
    goals:
      - id: G1
        says: No more than four releases a year that require the operator to do anything.
```

**One or many is the same file.** Adding an advocate is a config change; the workflow matrixes over
the list. There is no taxonomy of advocates — a retention advocate and a release-cadence advocate
run identical code and differ only in what they were told to want.

**No top-level directory.** A folder is a habit of repositories that expect to be written in. This
has to be mountable in ones that don't, so briefs live **inline** in the config: a brief on a branch
is an onboarding gap, and a brief in a folder is the folder again.

**2. `.github/workflows/council.yml`** — copy [`skel/council.yml`](skel/council.yml). Optional: you
can run a session by hand forever and never schedule one.

## Where the work lives: a branch, not a folder

One orphan branch per advocate — `advocate/<name>` by default — holding only what that advocate
keeps:

```
advocate/upkeep
  POSITION.md              rewritten whole each run — a position, not a log
  COMPLAINTS.md            the constituency's voice; each entry carries source: and state:
  ASKS.md                  requests on other projects; triage is a human's
  sessions/YYYY-MM-DD.md   the range read, what changed, and what was deliberately not said
  state.json               the subject commit this advocate has seen
```

**It is never merged into `main`.** A branch is the right home precisely because the workspace is
allowed to be as big and as strange as it needs — a growing tree with reasons of its own, which is
the thing a tidy folder in `main` would keep punishing.

## A round is a budget, not a sweep

A session is minutes of somebody's real attention. Nine seats across four repositories is an hour of
it every time the clock fires, and that is how a cadence stops being affordable and then stops being
kept at all.

```sh
node .advocate-engine/bin/round.sh --max 2
```

A round serves the **stalest** seats up to `--max` and the rest wait. **Waiting costs nothing** — a
range is cumulative, so a seat served three rounds from now reads everything it would have read
today. Seats carrying a standing work order go first, because they were already interrupted once.

Selection is **read-only**, and that is load-bearing rather than tidy: the mechanical half advances
the pin, so preparing every seat in order to choose one would spend the range of every seat that did
not get chosen.

## One page you can actually find

A branch per seat is right for the work and wrong for the reader: nobody checks out five branches
to find out whether anything happened. So a round ends by rewriting a **hub** — an index of every
seat, plus **a page per seat carrying that seat's actual documents**: its position, its complaints,
its asks, its last session note.

The index alone was not enough, and the reason is worth stating: a list of links only relocates the
problem. You still open a branch per seat to read a finding, and **a hub you have to leave in order
to learn anything is not a hub.** So the pages carry the text, copied whole from the branch, which
remains the authority.

```sh
node .advocate-engine/bin/digest.mjs                       # the index, to stdout
node .advocate-engine/bin/digest.mjs --pages ./out --as branch
node .advocate-engine/bin/publish.sh                       # to wherever report: says
```

```yaml
report:
  branch: council      # the default. `report: false` publishes nothing.
  wiki: false          # opt-in; see below
```

**The default destination is another branch**, holding `README.md` and the seat pages beside it,
so that visiting `/tree/council` renders the index with everything one click away and **nothing
turned on**. It is orphaned and never merged, for the same reason a seat's branch is:
a generated page in `main` churns the default branch every round, and every submodule pin pointing
at that repo then looks stale when nothing changed.

**It is rewritten whole, every time, and there is no archive.** Reports get edited far more than
they get written; the value of the current one is that it is current. The history is in the branch,
which is where history goes.

**Every destination is a push.** No issue is opened, no discussion is filed, no REST call is made.
That is not squeamishness about the API — it is that a second surface is a second thing that can be
stale while the repository is fine, and an agent that had to hold a token and speak HTTP to say what
it thinks would be harder to replace than one that only knows how to commit.

`report.wiki: true` renders the same hub into the repo's wiki — `Home.md`, a `_Sidebar.md`, and
`Seat-<name>.md` per seat — which is itself a git repository (`<origin>.wiki.git`) and so still only
a push. The wiki's advantage is that it sits in the repo's own navigation instead of behind a branch
picker; its cost is one manual step. It is opt-in for a mechanical reason: **GitHub does not create the wiki's git
repository until a first page exists**, so on a repo whose wiki was never opened there is no remote
to push to. Open it once in the browser; after that it is only ever a push, and `publish.sh` says
exactly this if you turn it on too early.

## Anyone can advocate for you, and it costs you nothing

Fork this repository's *subject*, run the same framework, and hand back your branch. **The fork is
the namespace** — a guest's `advocate/upkeep` lives in the guest's repository, so it cannot shadow
one the subject already runs. If the subject runs the same seat, GitHub renders the proposal as
`them:advocate/upkeep → you:advocate/upkeep`: two workspaces, one known format, side by side. If the
subject runs no such seat, the rational gesture is a few lines of `advocate.yml` proposing they seat
it, with the branch as the evidence.

That is the whole point of standardizing the tree: **you can read a stranger's workspace because it
is the format you already read every week.** You don't have to keep it. It makes its entire case in
place.

**A guest branch is read, never run.** The shipped workflow triggers on `schedule` and
`workflow_dispatch` only — never `pull_request_target`, which would hand a stranger's tree your
secrets. A guest holds no `writes:` grant by construction, because grants live in *your* config.

## No API by default — the path is declared, not inferred

```yaml
advocates:
  - name: upkeep
    session: local     # the default: prepare the work, never call out
```

`local` prepares everything mechanical — pin, range, branch — and leaves the judgement half as a
**work order** at `sessions/PENDING.md` on the advocate's own branch. **The branch is the queue.**
A local agent, a desktop routine, or a person picks it up:

```sh
node .advocate-engine/bin/pending.mjs        # what is owed
node .advocate-engine/bin/session.mjs upkeep # enter one workspace
```

Nothing about the repository reaches an inference provider on this path — not the diff, not the
constitution, not the reasoning. `session: hosted` opts a seat into running unattended over the
API, at cost. **A credential sitting right there does not override a `local` declaration**, which
is the point: adding an org-wide key must not quietly switch every repo onto a paid path.

Full details and a ready-to-paste routine prompt: [`LOCAL.md`](LOCAL.md).

## Two honest failures, both quiet

- **Nothing merged since last time?** The session writes one line and stops. An advocate that
  manufactures opinion because a schedule fired is worse than one that never ran.
- **No agent credential?** The workspace is prepared, the range is recorded, and it stops there —
  staged for a human. A session is never faked.

## There is no constitution for caretakers

An advocate that cannot act needs no charter, and writing it one would mean **manufacturing an
authority in order to have something to constrain.** The config's `mission` is the standard.

A repository that *wants* to bind its caretakers writes a section into the law it already has — a
`## Caretaking` section in its own `CONSTITUTION.md` — and points at it:

```yaml
constitution: CONSTITUTION.md      # repo-wide
advocates:
  - name: upkeep
    constitution: "#caretaking"    # a sub-constitution: the part that is this seat's
```

**A missing constitution is not a blocker.** It narrows what an advocate can check — it can no
longer report conduct against attestation — and that absence becomes its first finding.

## License

See the repository this is mounted in; this framework carries the constellation's terms.
