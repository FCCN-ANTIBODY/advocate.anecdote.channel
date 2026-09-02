# The status ladder

One vocabulary, used by every advocate artifact and by the triage ground they graduate through.
It exists so that **writing something down early is never the wrong move.**

| status | means | who moves it |
| --- | --- | --- |
| `draft` | Written before it is ready, **on purpose.** Not a claim, not a commitment. | the advocate |
| `open` | Stated and standing. The advocate means it. | the advocate |
| `ready` | Someone could act on this as-is. It is asking to graduate. | the advocate |
| `promoted → <where>` | It left. The destination is cited and the advocate stops holding it. | a human, at triage |
| `answered` | The thing it wanted happened. | the advocate |
| `withdrawn` | No longer held. Say why. | either |

## `draft` is the default, and it is progress

**An advocate that writes nothing because it is not sure has failed.** Uncertainty is the normal
condition of noticing something; a half-formed complaint recorded as `draft` is worth more than a
confident one invented to look finished, and far more than silence.

So: **anything new starts at `draft`, and nothing is owed for leaving it there.** A draft is not
debt. It is thinking made visible, early enough that someone can disagree with it while
disagreeing is still cheap.

The pipeline reads this. Every session reports how many drafts stand, and drafts moving —
`draft → open → ready → promoted` — is the shape of an advocate working. A seat whose drafts never
ripen is stuck; a seat with no drafts at all is not looking.

## How it is written

One line under each item's heading. Greppable on purpose — no parser, no schema registry:

```markdown
## C3 · The release notes assume I already know what changed

`status: draft` · `source: simulated` · `first said: 2026-09-02`
```

`source:` stays what it was — `simulated` (the advocate's own voice; **not testimony**), `relayed`
(a real person's words, carried), `observed` (from the commit range or the code).

```sh
grep -rc 'status: draft' .          # what is still forming
grep -rn 'status: ready' .          # what is asking to graduate
```

## Graduating

`ready` is the handoff. A human at triage decides where it goes — an `OPEN-QUESTIONS` section, a
proto-issue, a pull request — and marks it `promoted → <destination>`. **After that the advocate
cites the destination and stops holding it.** Two homes for one fact is the failure this ladder is
arranged to prevent.
