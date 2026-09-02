#!/usr/bin/env node
// order — write the work order for a session that a machine is not going to run.
//
//   bin/order.mjs <name> <workspace> <session-json> <engine-dir>
//
// This is the alternate pathway made explicit. The mechanical half of a session — advance
// the pin, compute the range, prepare the branch — costs nothing and needs no credential,
// so it runs wherever it likes. The half that needs judgement is left as an ORDER on the
// advocate's own branch, where anything can pick it up: a local agent on someone's machine,
// a scheduled desktop routine, or a person with an afternoon.
//
// The branch IS the queue. No issues, no labels, no second surface to keep honest.

import fs from 'node:fs';
import path from 'node:path';

const [name, work, sessionJson, engine] = process.argv.slice(2);
if (!name || !work || !sessionJson) { console.error('usage: order.mjs <name> <workspace> <session-json> [engine-dir]'); process.exit(2); }

const s = JSON.parse(sessionJson);
// Repo-relative, not the absolute path of whatever machine happened to prepare this: the
// order is read on a different computer than the one that wrote it. That is the point.
const method = `${path.basename(engine || '.advocate-engine')}/METHOD.md`;
const { workspace, ...order } = s;   // a local absolute path means nothing to the next reader
const rows = s.commits.map((c) => `| \`${c.sha.slice(0, 7)}\` | ${c.date} | ${c.subject} |`).join('\n');

const body = `# Work order — ${name}

**A session is due and no machine ran it.** Everything mechanical is already done: the branch is
prepared, the pin is recorded, and the range below is what moved. What is missing is the part that
needs judgement.

- **Advocate:** \`${name}\`  ·  **Branch:** \`${s.branch}\`
- **Subject commit:** \`${s.subject}\`
- **Range:** ${s.first ? '_first session — no range yet; form an opening position_' : `\`${s.range}\``}
- **Opened:** ${new Date().toISOString().slice(0, 10)}

${s.first ? '' : `## What moved\n\n| commit | date | subject |\n| --- | --- | --- |\n${rows}\n`}
## Doing it

1. Read the method: [\`${method}\`](${method}). It is law; follow it in order.
2. Your seat — mission, constituency, voice, goals, out-of-scope — is in \`advocate.yml\` under
   \`${name}\`. Read it. It is the only thing that says what to want.
3. **You are already standing in your workspace.** \`POSITION.md\`, \`COMPLAINTS.md\` and
   \`ASKS.md\` are here, carried forward from last time. Rewrite \`POSITION.md\` whole; carry the
   other two forward with your edits.
4. Write \`sessions/${new Date().toISOString().slice(0, 10)}.md\` — the range, what changed, and
   what you deliberately did **not** say.
5. **Delete this file.** An order left behind reads as a session still owed.
6. Commit on this branch and push. Never merge it into \`main\`.

<!-- machine-readable; bin/pending.mjs reads the block below -->
\`\`\`json
${JSON.stringify(order, null, 2)}
\`\`\`
`;

fs.mkdirSync(path.join(work, 'sessions'), { recursive: true });
fs.writeFileSync(path.join(work, 'sessions', 'PENDING.md'), body);
fs.rmSync(path.join(work, 'sessions', '.pending.json'), { force: true });
console.log(`advocate: work order open at ${path.join(work, 'sessions', 'PENDING.md')}`);
