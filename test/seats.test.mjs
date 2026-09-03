import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const bin = new URL('../bin/seats.mjs', import.meta.url).pathname;
const run = (yaml) => {
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'adv-')), 'advocate.yml');
  fs.writeFileSync(f, yaml);
  try {
    return { ok: true, out: JSON.parse(execFileSync('node', [bin], { encoding: 'utf8', env: { ...process.env, ADVOCATE_CONFIG: f } })) };
  } catch (e) {
    return { ok: false, err: (e.stderr || '').toString() };
  }
};

const good = `version: 1
advocates:
  - name: upkeep
    mission: keep going
    constituency: |
      someone
`;

const g = run(good);
assert.ok(g.ok, g.err);
assert.equal(g.out.advocates[0].branch, 'advocate/upkeep', 'branch defaults to advocate/<name>');
assert.equal(g.out.advocates[0].cadence, 'weekly');
assert.deepEqual(g.out.advocates[0].writes, [], 'honest defaults fire nothing');
assert.equal(g.out.advocates[0].session, 'local', 'a session is local until a repo opts out');
assert.deepEqual(g.out.report, { branch: 'council', wiki: false }, 'the digest has a home by default');
// Absent means exactly today's behaviour, so nothing that works now changes.
assert.equal(g.out.backend, null, 'a repo that declares no backend declares nothing');
assert.equal(g.out.advocates[0].backend, null);

// A repo that wants no page at all says so, and that is a complete answer.
assert.deepEqual(run(`version: 1\nreport: false\n${good.split('\n').slice(1).join('\n')}`).out.report,
  { branch: null, wiki: false });
assert.deepEqual(run(`version: 1\nreport:\n  branch: board\n  wiki: true\n${good.split('\n').slice(1).join('\n')}`).out.report,
  { branch: 'board', wiki: true });

// inherits the repo-level constitution when the seat names none
const inherit = run(`version: 1\nconstitution: CONSTITUTION.md\n${good.split('\n').slice(1).join('\n')}`);
assert.equal(inherit.out.advocates[0].constitution, 'CONSTITUTION.md');

// backend: WHAT a session calls, declared and not inferred (BACKEND.md)
{
  const b = run(`version: 1\nbackend:\n  kind: openai\n  url: http://127.0.0.1:11434/v1/chat/completions\n  key-env: ""\n${good.split('\n').slice(1).join('\n')}`);
  assert.ok(b.ok, b.err);
  assert.equal(b.out.backend.kind, 'openai');
  assert.equal(b.out.backend.url, 'http://127.0.0.1:11434/v1/chat/completions');
  // "" is a DECLARATION — this backend takes no credential — and must not be read as absent.
  assert.equal(b.out.backend['key-env'], '', 'no credential is a supported state, not a missing one');
  assert.equal(b.out.advocates[0].backend.kind, 'openai', 'seats inherit the repo backend');
}
// A seat may override it: one seat on a big model, another on a cheap local one.
{
  const y = `version: 1\nbackend:\n  kind: openai\nadvocates:\n  - name: a\n    mission: m\n    constituency: |\n      c\n  - name: b\n    mission: m\n    constituency: |\n      c\n    backend:\n      kind: anthropic\n      model: claude-opus-5\n`;
  const o = run(y).out;
  assert.equal(o.advocates[0].backend.kind, 'openai');
  assert.equal(o.advocates[1].backend.kind, 'anthropic');
  assert.equal(o.advocates[1].backend.model, 'claude-opus-5');
}

// refusals — each of these should stop the council rather than guess
const refusals = [
  ['version: 2\nadvocates:\n  - name: a\n    mission: m\n    constituency: c\n', /version must be 1/],
  ['version: 1\nadvocates: []\n', /non-empty list/],
  ['version: 1\nadvocates:\n  - name: Upkeep\n    mission: m\n    constituency: c\n', /lowercase slug/],
  ['version: 1\nadvocates:\n  - name: a\n    mission: m\n', /no constituency/],
  ['version: 1\nadvocates:\n  - name: a\n    constituency: c\n', /no mission/],
  [`version: 1\nadvocates:\n  - name: a\n    mission: m\n    constituency: c\n  - name: a\n    mission: m\n    constituency: c\n`, /duplicate/],
  // A grant that cannot act must not parse as though it can.
  ['version: 1\nadvocates:\n  - name: a\n    mission: m\n    constituency: c\n    writes: [README.md]\n', /not wired yet/],
  ['version: 1\nadvocates:\n  - name: a\n    mission: m\n    constituency: c\n    session: cloud\n', /session must be/],
  // The digest is written by the round, not by a seat: it must never land in a workspace
  // the seat is told it owns.
  ['version: 1\nreport:\n  branch: advocate/a\nadvocates:\n  - name: a\n    mission: m\n    constituency: c\n', /which is a's workspace/],
  ['version: 1\nreport:\n  branch: 3\nadvocates:\n  - name: a\n    mission: m\n    constituency: c\n', /report.branch must be/],
  ['version: 1\nreport:\n  wiki: yes please\nadvocates:\n  - name: a\n    mission: m\n    constituency: c\n', /report.wiki must be/],
  ['version: 1\nreport: council\nadvocates:\n  - name: a\n    mission: m\n    constituency: c\n', /report: must be a mapping/],
  // A backend nobody can name is a typo that would fall through to the default adapter and
  // look like it worked.
  ['version: 1\nbackend:\n  kind: bedrock\nadvocates:\n  - name: a\n    mission: m\n    constituency: c\n', /backend.kind must be one of/],
  ['version: 1\nbackend:\n  kind: command\nadvocates:\n  - name: a\n    mission: m\n    constituency: c\n', /no command: is given/],
  ['version: 1\nbackend:\n  kind: openai\n  command: ./x\nadvocates:\n  - name: a\n    mission: m\n    constituency: c\n', /only applies to kind: command/],
];
for (const [yaml, re] of refusals) {
  const r = run(yaml);
  assert.ok(!r.ok, `should have refused:\n${yaml}`);
  assert.match(r.err, re);
}

console.log('seats: ok');
