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

> **Updated 2026-09-08.** Addressing is now by **library path**, and a seat reads its mail as a
> step in its round rather than the ground being something a person remembers to check. See
> *The address* below and `METHOD.md` step 2b.

## It stays greppable

`STATUS.md` says it plainly — *"greppable on purpose — no parser, no schema registry"* — and nothing
here changes that. The envelope is one line of the same backtick-and-`·` form already in use, and a
missing field means the same as an absent one: nothing.

**No field below is required.** An item with only `status:` is a valid item and always was.

## The address

A petition is filed under the **library path** of the repository it is for:

    library/petitions/<group>/<repo>/<slug>.md

`FCCN-ANTIBODY/civic-node`, `Chaevity/ablative` — the same words a round uses to name what it
serves. **The filed location is the statement of who an item is for**, so pointing at the file
settles it and a `target:` field cannot disagree with the path it sits in.

The **repository name, not the DNS name.** `anecdote.channel` is a repository that happens to look
like a domain; its address is `FCCN-ANTIBODY/anecdote.channel` and the group prefix does the work
the domain was doing. Nothing routes by DNS.

**Whether the submodule is filled makes no difference.** An address resolves if the library knows
the name. Filing is never a reason to fetch anything.

If the library knows no name for the target at all, it goes in `petitions/unplaced/` — a question
about the library, not a defect in the item.

## The line

```markdown
# <one line, imperative>

`status: draft` · `source: relayed` · `target: <library-path>` · `raised: 2026-09-02` · `filed-by: <who>`
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

The layout rule — *one directory per target, named by its library path* — answers the easy case and
not the case that most needs answering. **A petition is often about something that does not exist**;
that is frequently why it is being filed at all. There is no repository for a thing nobody has
built, and so no address for it either.

The working answer, and the one that survived the round trip:

**File it under the repository that would have to define the thing** — the one that owns the
vocabulary the idea is asking to extend — and say so in the item.

Then add a closing line giving the reader permission to move it. Explicitly:

> *Filed under `<library-path>` because that is where `<the kind of thing>` is defined. If it is
> better owned by `<other>`, moving it is the correct first triage step and no fidelity is lost —
> nothing here depends on the target.*

Moving one **is a `git mv`** now, and the history says it moved. Under the old ground it was a copy
and a delete that left no trace of either.

If no repository would define it, file it in `petitions/unplaced/` and name the repository that
would have to exist. That is not a lesser filing — one of the items sitting there right now is the
argument for the repository that would place it.

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

## It will be read, and that is new

A seat now **checks its mail as a step in its round** — `METHOD.md` step 2b. The items addressed to
its repository are fetched in the mechanical half and written into its workspace, so a seat reads
them without widening scope, and **an unread petition makes an otherwise quiet session non-quiet.**
A repository can go a month without a merge and still be woken by mail.

What that changes for a filer, and it is worth being plain about it:

- **Filing is no longer a message in a bottle.** Somebody's round will surface it. Nobody is
  obliged to agree.
- **It is still not owed a response.** A seat may decline an item, or say it belongs to another
  seat, or that it is nobody's. Each of those is a complete answer and appears in a session note.
- **Only what falls in a seat's constituency gets taken.** An item addressed to a repository whose
  seats all decline it is not lost — it is reported as outside every seat, which is a signal that
  the repository may be missing one. Seating is a person's act, never an advocate's.

So write the item for the constituency most likely to hold it, not for the repository in general.

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
