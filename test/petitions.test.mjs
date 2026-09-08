import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { inbound, unseen, addressOf, norm } from '../bin/petitions.mjs';

const git = (cwd, ...a) => execFileSync('git', a, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
const tmp = () => fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'adv-pet-')));

// --- normalisation must match the runner's, or a repo could be served and unreachable -----
assert.equal(norm('git@github.com:FCCN-ANTIBODY/civic-node.git'), 'github.com/fccn-antibody/civic-node');
assert.equal(norm('https://github.com/FCCN-ANTIBODY/civic-node'), 'github.com/fccn-antibody/civic-node');
assert.equal(norm('https://github.com/FCCN-ANTIBODY/civic-node.git/'), 'github.com/fccn-antibody/civic-node');

// --- a fake node: a library, a config, and some mail --------------------------------------
function makeNode({ visibility = 'private', items = {}, aliases = '' } = {}) {
  const node = tmp();
  fs.mkdirSync(path.join(node, 'library', 'petitions'), { recursive: true });
  fs.writeFileSync(path.join(node, '.gitmodules'), `[submodule "library/Grp/subject"]
	path = library/Grp/subject
	url = https://github.com/Grp/subject.git
[submodule ".an-engine"]
	path = .an-engine
	url = https://github.com/Grp/engine.git
`);
  fs.writeFileSync(path.join(node, 'library', 'PETITIONS.yml'), `version: 1
space:
  path: petitions
  visibility: ${visibility}
addressing:
  from: .gitmodules
  prefix: library/
${aliases}`);
  for (const [addr, files] of Object.entries(items)) {
    const d = path.join(node, 'library', 'petitions', addr);
    fs.mkdirSync(d, { recursive: true });
    for (const [f, body] of Object.entries(files)) fs.writeFileSync(path.join(d, f), body);
  }
  return node;
}

function makeRepo(url) {
  const r = tmp();
  git(r, 'init', '-q');
  git(r, 'remote', 'add', 'origin', url);
  return r;
}

const ITEM = `# Do the thing

\`status: draft\` · \`source: relayed\` · \`raised: 2026-09-08\` · \`filed-by: Autumn\`

Body.
`;

// --- addressing ---------------------------------------------------------------------------
{
  const node = makeNode({ items: { 'Grp/subject': { 'a.md': ITEM } } });
  const repo = makeRepo('git@github.com:Grp/subject.git');   // ssh spelling, https in .gitmodules
  process.env.STATION_NODE = node;
  const inb = inbound(repo);
  assert.equal(inb.address, 'Grp/subject', 'address is the library path, matched by remote not by folder name');
  assert.equal(inb.items.length, 1);
  assert.equal(inb.items[0].status, 'draft');
  assert.equal(inb.items[0].filedBy, 'Autumn');
  assert.equal(inb.visibility, 'private');
}

// A library that does not know this repository. Unaddressable is an answer, never a crash.
{
  const node = makeNode();
  process.env.STATION_NODE = node;
  const inb = inbound(makeRepo('https://github.com/Grp/stranger.git'));
  assert.equal(inb.address, null);
  assert.equal(inb.unaddressed, true);
  assert.deepEqual(inb.items, []);
}

// An alias resolves WITHOUT the mount being hydrated. Addressing must not depend on bytes —
// otherwise a repository goes unaddressable exactly when the node has not fetched it.
{
  const node = makeNode({
    aliases: `  aliases:\n    - address: Grp/engine\n      at: .an-engine\n`,
    items: { 'Grp/engine': { 'b.md': ITEM } },
  });
  assert.ok(!fs.existsSync(path.join(node, '.an-engine')), 'the mount is deliberately absent');
  process.env.STATION_NODE = node;
  const inb = inbound(makeRepo('https://github.com/Grp/engine'));
  assert.equal(inb.address, 'Grp/engine', 'an alias resolves from .gitmodules, not from the mount');
  assert.equal(inb.items.length, 1);
}

// --- no space is the normal case, not an error --------------------------------------------
{
  process.env.STATION_NODE = tmp();     // exists, but holds no library
  const inb = inbound(makeRepo('https://github.com/Grp/subject.git'));
  assert.equal(inb.space, null, 'a repo with no station node has no mail and does not fail');
  assert.deepEqual(inb.items, []);
}

// A malformed config is the same answer. The framework travels; the node is one arrangement.
{
  const node = makeNode();
  fs.writeFileSync(path.join(node, 'library', 'PETITIONS.yml'), '{ this is not yaml-enough }');
  process.env.STATION_NODE = node;
  assert.equal(inbound(makeRepo('https://github.com/Grp/subject.git')).space, null);
}

// --- seen-set: content, not mtime ----------------------------------------------------------
{
  const items = [{ file: 'a.md', digest: 'aaa' }, { file: 'b.md', digest: 'bbb' }];
  assert.equal(unseen(items, {}).length, 2, 'nothing seen yet');
  assert.equal(unseen(items, { 'a.md': 'aaa', 'b.md': 'bbb' }).length, 0, 'all seen');
  assert.equal(unseen(items, { 'a.md': 'old', 'b.md': 'bbb' })[0].file, 'a.md', 'an edited item is news again');
}

// --- THE ONE THAT MATTERS: an unread petition defeats the quiet short circuit --------------
// Petitions arrive on nobody's commit schedule. Without this a seat would never reach the one
// thing it is asked to come looking for, because the empty-range exit fires first.
{
  const node = makeNode({ items: { 'Grp/subject': { 'a.md': ITEM } } });
  const repo = makeRepo('https://github.com/Grp/subject.git');
  fs.writeFileSync(path.join(repo, 'advocate.yml'), `version: 1
advocates:
  - name: mail
    mission: read the post
    constituency: |
      someone
`);
  git(repo, 'add', '-A');
  git(repo, '-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'init');

  const bin = new URL('../bin/session.mjs', import.meta.url).pathname;
  const workDir = tmp();
  const env = { ...process.env, STATION_NODE: node, ADVOCATE_WORK_DIR: workDir };
  const run = () => JSON.parse(execFileSync('node', [bin, 'mail', '--json'], { cwd: repo, encoding: 'utf8', env }));

  const first = run();
  assert.equal(first.first, true, 'the first session seats rather than reports');
  assert.equal(first.petitions.address, 'Grp/subject');
  assert.equal(first.petitions.unread, 1);
  assert.ok(fs.existsSync(path.join(first.workspace, 'PETITIONS.md')), 'the mail is delivered into the workspace');
  assert.match(fs.readFileSync(path.join(first.workspace, 'PETITIONS.md'), 'utf8'), /Do the thing/);

  // Commit the workspace so state.json survives, the way run.sh does.
  git(first.workspace, '-c', 'user.email=t@t', '-c', 'user.name=t', 'add', '-A');
  git(first.workspace, '-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'seated');

  // Subject unchanged AND the petition already seen -> genuinely quiet.
  const second = run();
  assert.equal(second.petitions.unread, 0, 'a petition already shown is not news');
  assert.equal(second.quiet, true, 'nothing merged, nothing unread — a real quiet session');

  // Now a new petition lands. Subject STILL unchanged.
  fs.writeFileSync(path.join(node, 'library', 'petitions', 'Grp/subject', 'c.md'), ITEM.replace('Do the thing', 'Another'));
  const third = run();
  assert.equal(third.commits.length, 0, 'the subject did not move');
  assert.equal(third.petitions.unread, 1);
  assert.equal(third.quiet, false, 'an unread petition makes a quiet subject a non-quiet session');
}

console.log('petitions: ok');
