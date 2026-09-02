# advocate.anecdote.channel — the caretaking framework

**This repo is the method. It contains no advocate and knows no subject.** Consumer-blind on
purpose: describe the capability, never the customer. If something here only makes sense for one
repository, it belongs in *that* repository's `advocate.yml`, not here.

| Your question | The one file |
| --- | --- |
| What is an advocate supposed to do? | [`METHOD.md`](METHOD.md) — the whole loop, written to hand to an agent |
| What does the config look like? | [`advocate.example.yml`](advocate.example.yml) |
| How do I mount this? | [`README.md`](README.md) → Mounting |
| What does the action take? | [`action.yml`](action.yml) |
| What does a consumer copy? | [`skel/`](skel/) |

## The shape, in four facts

1. **One loop, many configs.** There is no taxonomy of advocates. A retention advocate and a
   release-cadence advocate run identical code and differ only in what they were told to want.
2. **One file in the subject repo** — `advocate.yml` at the root. No top-level directory: this has
   to be mountable in repositories that did not expect to be written in.
3. **The workspace is a branch.** One orphan branch per advocate, never merged, allowed to grow into
   whatever shape it needs.
4. **Writes are granted, never inherent.** `writes:` defaults to `[]`. A seated advocate with no
   grant produces only its branch.

## Tests

`npm test` — `node test/*.test.mjs`. **Zero dependencies, on purpose**; `bin/yaml-enough.mjs` is the
subset of YAML a config is allowed to be, in the house `*-enough` idiom.
