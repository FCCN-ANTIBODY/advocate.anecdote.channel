# The backend — what a session calls, declared and not inferred

`session:` says **whether** a seat calls out. This says **what it calls**, and it is the same
rule one level down: **a credential appearing must never decide behaviour.**

The framework already refuses to let an org-wide key switch a repo from `local` to `hosted`.
The same argument applies to which provider that key opens, and today it does not hold — the
hosted path assumes Anthropic because the bundled adapter does, so a key named for a *role*
silently picks a *vendor*.

## The problem, stated exactly

An org secret called `ADVOCATE_AGENT_KEY` is **a role, and that is the right name for it**: the
credential that summons a session. It is deliberately not `ANTHROPIC_API_KEY`, because a name is
not a description and the next repo may want something else entirely.

But a role needs somewhere to say what fills it, and there was nowhere. So:

- Every repo in an org gets whichever provider the engine happened to hardcode.
- A repo that wants a local model has to override an environment variable in a workflow, which
  is ambient — invisible in the repository, decided somewhere else, silently reversible.
- Nothing catches an OpenAI key being handed to the Anthropic adapter until the API says so, at
  the cost of a call and a confusing error.

## The declaration

```yaml
version: 1

backend:
  kind: anthropic          # anthropic | openai | command
  model: claude-opus-5

advocates:
  - name: upkeep
    session: hosted        # still opt-in, still per-seat
    ...
```

`backend:` is **repo-level and optional**, and defaults to exactly today's behaviour, so nothing
that works now changes. A seat may override it — one seat on a big model and another on a cheap
local one is a reasonable thing to want, and `backend:` next to `session:` is where you would
look for it.

| key | means |
| --- | --- |
| `kind: anthropic` | the Messages API. The default, and what `bin/advocate-agent` speaks. |
| `kind: openai` | **any** OpenAI-compatible `/chat/completions`. See below — this is the wildcard. |
| `kind: command` | your own adapter at `command:`, in any language, honouring the contract. |
| `model:` | passed through. The adapter's own default applies when absent. |
| `url:` | override the endpoint. **This is how "local" happens** — it is a URL, not a code path. |
| `key-env:` | which environment variable holds the credential. Default `ADVOCATE_AGENT_KEY`, then the adapter's conventional name. |

There is no `kind: none`. `session: local` already says "never call out", and a second way to
spell it would be a second thing to keep honest.

## `kind: openai` is the wildcard, and that is the whole point

One adapter covers OpenAI, Azure, OpenRouter, Together, Groq, vLLM, llama.cpp's server, LM Studio
and Ollama, because they all speak the same request shape. **Local is a `url:`, not a fork.**

```yaml
backend:
  kind: openai
  url: http://127.0.0.1:11434/v1/chat/completions
  model: qwen3:14b
  key-env: ""              # a local server usually wants no credential at all
```

**A backend that needs no credential is the strongest configuration available**, and worth
reaching for on its own merits: a job holding no secret cannot leak one, and a session that never
leaves the machine is the only version of "not sent anywhere" that is unconditional. `LOCAL.md`
makes this argument about the *pipeline*; here it is about the *provider*.

Two implementations are also what makes the seam a contract rather than a habit. Until there was
a second adapter, "any command can stand behind this" was a claim nobody had tested.

## What a local model actually has to manage

Honest limits, because the failure modes differ from an API's and pretending otherwise wastes
somebody's evening.

**Structured output is the hard part.** A session must return four whole documents as JSON. The
Anthropic adapter asks for a JSON schema and gets one. An arbitrary OpenAI-compatible server may
support `response_format: json_schema`, or only `json_object`, or nothing at all. So the adapter
asks for the strictest thing it can, then parses leniently — fenced blocks, leading prose — and
**exits nonzero rather than returning a partial session.** A staged session is a real outcome; a
half-written one is the failure the whole method is arranged against.

**Context.** A session receives `METHOD.md` (~9 KB), the seat, the range, and three current
documents. Budget **32k tokens of context** as a floor and expect a 4k-context model to truncate
the method silently — which produces a session that looks fine and quietly ignored its own law.

**Quality degrades gracefully, and the format helps.** `POSITION.md` is rewritten whole every
session, so a weak session is **overwritten by the next one** rather than accumulating. Complaints
and asks carry forward, so those *do* accumulate — which is the place a poor backend leaves marks.
Watch the draft tally: a seat whose drafts never ripen is the signal.

**The refusals are the framework's, not the model's.** "Never manufacture output because a
schedule fired" is a line in `METHOD.md`, and a small model is worse at holding it. That is an
argument for reading the first few sessions of any new backend, not for a mechanism.

## The adapter contract

Anything at `ADVOCATE_AGENT_CMD` (or `backend.command`) honouring this works. It was only ever
written in a comment at the top of `bin/advocate-agent`; it belongs here.

**Probe.** `<cmd> --available` exits `0` iff it could run a session now, else nonzero. Print the
*reason* to stderr — "no credential" sends someone hunting for a missing key when the adapter
already knows it is a bad workspace id. `run.sh` probes first so a session degrades to `staged`
instead of being faked.

**Session.** No arguments. Read one JSON object on stdin:

```json
{ "method": "…METHOD.md verbatim…",
  "seat":   { "name": "upkeep", "mission": "…", "constituency": "…", "goals": [] },
  "range":  { "subject": "…", "first": false, "quiet": false, "commits": [] },
  "current": { "position": "…", "complaints": "…", "asks": "…" } }
```

Print one JSON object on stdout:

```json
{ "position": "…", "complaints": "…", "asks": "…", "session": "…" }
```

Four **whole markdown documents**. `position` is rewritten entirely; `complaints` and `asks` are
the previous files carried forward with edits applied; `session` is today's note.

**Refuse loudly.** Exit nonzero on anything you cannot complete — no credential, a declined
request, an unparsable response. Never print a partial object. The caller stages the work order
and a human picks it up, which is a real outcome; a fabricated session is not.

## Running it in the project's own repo

`skel/council.yml` is the pipeline. What changes with a declared backend:

**The secret stays one name.** `ADVOCATE_AGENT_KEY` at the org, meaning *the credential that
summons a session*. Which API it opens is the repo's declaration, and a repo that needs no
credential simply never reads it.

**Sanity-check the key against the declaration before spending a call.** A key beginning `sk-ant-`
handed to `kind: openai` is a misconfiguration the adapter can see for free, in the same spirit as
the existing workspace-id check.

**The matrix is a budget problem.** The workflow fans out over every seat, so a five-seat repo
makes five calls per fire, forever. This is the same lesson the local runner learned — a round is
a budget, not a sweep — and the same read-only staleness selection can emit a capped matrix.
**Not built here**; named because it is the next real cost.

**A self-hosted runner is the third path, and it is not a compromise.** With
`runs-on: [self-hosted, …]` and a local backend the pipeline needs **no secret and no egress**
except the push. It is also the only place `ADVOCATE_LOCAL_AGENT` — a CLI agent already
authenticated on that machine — can stand behind the seam in CI, because a hosted runner has no
such session to borrow.

**The report needs `contents: write`**, which `skel/council.yml` already grants; that covers the
`council` branch. Pushing to a repo's **wiki** uses the same credential against
`<repo>.wiki.git` — plausible, and **untested from Actions**. The wiki also has to have been
opened once by hand before it exists at all.

## What this deliberately does not do

- **No model routing, no fallbacks, no retries across providers.** One seat, one declared backend.
  A framework that silently tried something else would be inferring again.
- **No cost accounting.** The engine cannot know your rates. The controls are the cadence, the
  budget, and `session: local`.
- **No opinion about which backend is good.** That is a procurement question and no seat here
  holds it.
