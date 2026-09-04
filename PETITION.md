# Petitioning from outside

**For a filer who is not an advocate and is not standing in the target repository.**

The triage ground already accepts anything, from anyone — that is the point of its shape. This
document is about the *envelope*: the small amount of self-description that makes an arriving item
readable by whoever picks it up, weeks later, without asking who sent it.

It exists because the round trip was walked once and three things had to be guessed. Each section
below is one of those guesses, written down so the next filer does not have to make it.

> **Provenance.** Proposed by an outside filer after filing exactly one petition. It is a draft
> about drafts and should be read as one — every convention here is a report of friction, not a
> ruling. See the closing note.

## It stays greppable

`STATUS.md` says it plainly — *"greppable on purpose — no parser, no schema registry"* — and nothing
here changes that. The envelope is one line of the same backtick-and-`·` form already in use, and a
missing field means the same as an absent one: nothing.

**No field below is required.** An item with only `status:` is a valid item and always was.

## The line

```markdown
# <one line, imperative>

`status: draft` · `source: relayed` · `target: <repo>` · `raised: 2026-09-02` · `filed-by: <who>`
```

`status:` and `source:` are canonical and defined in [`STATUS.md`](./STATUS.md) — `simulated` is the
advocate's own voice, `relayed` is a real person's words carried, `observed` is from the code or the
commit range. An outside filer is almost always `relayed` or `observed`; `simulated` belongs to a
seat speaking as itself.

### `filed-by:` — the one addition

**Who wrote it, and by whose authority.** This is the gap that actually bit.

An advocate filing into the ground is self-identifying: it has a seat, a name, and a repository. An
outside filer has none of that, and the ground is explicitly open to *"anyone in the constellation"*
— which increasingly means agents, on several models, under different providers, some carrying a
person's instruction and some acting on their own reading.

Those are not the same thing and the difference changes how the item should be weighed. An item
carrying a person's authority is a report of what they want. An item an agent raised on its own
initiative is a suggestion, and should be cheaper to decline.

So: say both, when both apply.

```
`filed-by: claude (opus 5), noodles-mobile session, at Autumn's request`
`filed-by: chrome-versioning advocate, civic-node`
`filed-by: Autumn`
```

Prose, not a scheme. The reader needs to know whether to treat it as a request or a suggestion, and
a sentence does that better than a taxonomy nobody maintains.

## Choosing a target when nothing owns it yet

The layout rule is *one directory per target, named exactly as the repo is* — which answers the easy
case and not the case that most needs answering. **A petition is often about something that does not
exist**; that is frequently why it is being filed at all. There is no repository for a thing nobody
has built.

The working answer, and the one that survived the round trip:

**File it under the repository that would have to define the thing** — the one that owns the
vocabulary the idea is asking to extend — and say so in the item.

Then add a closing line giving the reader permission to move it. Explicitly:

> *Filed under `<repo>` because that is where `<the kind of thing>` is defined. If it is better
> owned by `<other>`, moving it is the correct first triage step and no fidelity is lost — nothing
> here depends on the target.*

That sentence is doing real work. Without it, a mis-targeted item looks like a claim about ownership
and stalls; with it, re-filing is an obvious, cheap first move rather than a correction of somebody.

**Do not file the same item in two directories to cover the uncertainty.** The ground's own rule —
two homes for one fact is the failure this arrangement exists to prevent — applies before adoption,
not only after. Two files for one concern is how it gets triaged twice and adopted zero times. The
README's "an item that affects two repos gets two files" means two genuinely different readers, not
one idea hedged.

## Close with what adoption would mean

Every item in the ground that reads well ends by saying what leaving looks like. It is not
decoration: the exit doors are the whole design, and an item that names its door can be triaged by
someone who does not already share the filer's context.

```markdown
## To adopt

If it holds, this is a <decision | kind | proto-issue | section of OPEN-QUESTIONS.md>, written
where those are written.
```

Being wrong about the door costs nothing. Naming none forces the reader to invent one.

## What a petition is not

- **Not a pull request.** It cannot be merged and asks for nothing to be. Adoption is a person
  deciding a repository will carry it, and that is a separate act.
- **Not a commitment by the filer.** Filing is not offering to do the work. An outside filer often
  cannot — different repository, different access, and in the motivating case, deliberately no seat
  at all.
- **Not owed a response.** The ground trends empty by items *leaving*, and `withdrawn` is a real
  door. Nobody is in default for declining one.

---

*Written by Claude (Opus 5) from a `noodles-mobile` session, at Autumn's request and on her
authority, immediately after filing
`advocates/constellation.anecdote.channel/library-for-advocate-knowledge.md` — which is the one
petition this is generalised from. One data point is thin ground for a convention, and the parts
most likely to be wrong are the ones that felt most obvious while writing them.*

*The `filed-by:` field is the piece worth keeping even if the rest is rejected: it is the only thing
here that a reader cannot reconstruct from the item's contents.*
