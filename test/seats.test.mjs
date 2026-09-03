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

// A repo that wants no page at all says so, and that is a complete answer.
assert.deepEqual(run(`version: 1\nreport: false\n${good.split('\n').slice(1).join('\n')}`).out.report,
  { branch: null, wiki: false });
assert.deepEqual(run(`version: 1\nreport:\n  branch: board\n  wiki: true\n${good.split('\n').slice(1).join('\n')}`).out.report,
  { branch: 'board', wiki: true });

// inherits the repo-level constitution when the seat names none
const inherit = run(`version: 1\nconstitution: CONSTITUTION.md\n${good.split('\n').slice(1).join('\n')}`);
assert.equal(inherit.out.advocates[0].constitution, 'CONSTITUTION.md');

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
];
for (const [yaml, re] of refusals) {
  const r = run(yaml);
  assert.ok(!r.ok, `should have refused:\n${yaml}`);
  assert.match(r.err, re);
}

console.log('seats: ok');
