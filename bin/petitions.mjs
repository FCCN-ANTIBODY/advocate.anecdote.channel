#!/usr/bin/env node
// petitions — what has been filed FOR this repository, resolved before the agent runs.
//
//   bin/petitions.mjs [--json]
//
// A petition asks a repository you are not standing in to care about something. They are
// filed in a node's library, under the library path that names the target, so the filed
// location says who an item is for without a sentence of explanation.
//
// THIS RUNS IN THE MECHANICAL HALF, and that is the whole point. METHOD.md forbids an
// advocate from reading a repository that is not in its checkout, and that refusal is load
// bearing — it is most of what keeps a seat narrow. So the agent never goes looking. The
// mail is fetched before it wakes up and deposited in its workspace, which is the one place
// it already reads. Scope is not widened; the inbox is delivered.
//
// NO PETITION SPACE IS THE NORMAL CASE. A repository using this framework without a station
// node has no mail, and everything here returns empty rather than failing. A missing space
// must never be an error: the framework is the thing that travels, and the node is one
// operator's arrangement.

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { parse } from './yaml-enough.mjs';

const gitQuiet = (...a) => {
  try { return execFileSync('git', a, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trimEnd(); }
  catch { return null; }
};

// Remote URLs are not canonical and comparing them raw does not work: some origins carry a
// trailing `.git` and some do not, and ssh and https spell the same repository differently.
// Identical normalisation to the runner's, on purpose — an address that resolves for a round
// must resolve for its mail, or a repository could be served and unreachable at once.
export function norm(u) {
  return String(u || '')
    .replace(/^git\+/, '').replace(/^ssh:\/\//, '').replace(/^https?:\/\//, '').replace(/^git@/, '')
    .replace(/^([^/:]+):/, '$1/')
    // Trailing slash BEFORE `.git`, or `…/repo.git/` keeps a `.git` nobody else will have.
    .replace(/\/$/, '').replace(/\.git$/, '').replace(/\/$/, '')
    .toLowerCase();
}

function stationNode() {
  const p = process.env.STATION_NODE || path.join(os.homedir(), 'Project', 'station-node');
  return fs.existsSync(path.join(p, 'library', 'PETITIONS.yml')) ? p : null;
}

// The address is a LIBRARY PATH — `FCCN-ANTIBODY/civic-node`, `Chaevity/ablative`. A repository
// is never asked to declare its own; it is discovered by matching origin against what the
// library already points at. Configuring it per repository would be one more thing to keep
// true, and the library is already the place that knows.
export function addressOf(root, node, cfg) {
  const url = norm(gitQuiet('-C', root, 'remote', 'get-url', 'origin'));
  if (!url) return null;

  const gitmodules = path.join(node, cfg?.addressing?.from || '.gitmodules');
  const prefix = cfg?.addressing?.prefix ?? 'library/';
  const listed = gitQuiet('config', '-f', gitmodules, '--get-regexp', '^submodule\\..*\\.url$') || '';
  for (const line of listed.split('\n')) {
    if (!line) continue;
    const i = line.indexOf(' ');
    const key = line.slice(0, i), val = line.slice(i + 1);
    if (norm(val) !== url) continue;
    const sub = key.replace(/^submodule\./, '').replace(/\.url$/, '');
    if (sub.startsWith(prefix)) return sub.slice(prefix.length);
  }

  // Names the library knows that are not under library/. An engine mounted at the node root
  // runs there; that is a functional mount, not an address. Aliasing it beats a second gitlink
  // to the same repository, which would be a second pin to keep current.
  //
  // Resolved from .gitmodules, NOT by reading the mount's own remote. Addressing must not
  // depend on hydration — the library is the addressing layer and whether a submodule is
  // checked out is a question about bytes. Reading the mount would make a repository
  // unaddressable exactly when the node had not fetched it, which is backwards.
  for (const a of cfg?.addressing?.aliases || []) {
    if (!a?.address || !a?.at) continue;
    const u = gitQuiet('config', '-f', gitmodules, '--get', `submodule.${a.at}.url`);
    if (u && norm(u) === url) return a.address;
  }
  return null;
}

export function inbound(root = process.cwd()) {
  const node = stationNode();
  if (!node) return { space: null, address: null, items: [] };

  let cfg;
  try { cfg = parse(fs.readFileSync(path.join(node, 'library', 'PETITIONS.yml'), 'utf8')); }
  catch { return { space: null, address: null, items: [] }; }

  const visibility = cfg?.space?.visibility || 'private';
  const address = addressOf(root, node, cfg);
  // Unaddressable is a real answer and not an error. It means the library does not know this
  // repository by any name — which is worth saying out loud, because the library is the list
  // of what the node speaks about at all, and being absent from it is a fact about the node.
  if (!address) return { space: node, address: null, items: [], visibility, unaddressed: true };

  const dir = path.join(node, 'library', cfg?.space?.path || 'petitions', address);
  if (!fs.existsSync(dir)) return { space: node, address, items: [], visibility };

  const items = [];
  for (const f of fs.readdirSync(dir).sort()) {
    if (!f.endsWith('.md') || f === 'README.md') continue;
    const body = fs.readFileSync(path.join(dir, f), 'utf8');
    const title = (body.match(/^#\s+(.+)$/m) || [, f.replace(/\.md$/, '')])[1].trim();
    const env = (body.match(/^`.*`$/m) || [''])[0];
    const field = (k) => (env.match(new RegExp('`' + k + ':\\s*([^`]*)`')) || [, ''])[1].trim();
    items.push({
      file: f, title, body,
      status: field('status') || 'draft',
      source: field('source'),
      raised: field('raised'),
      filedBy: field('filed-by'),
      // Content, not mtime. A petition edited in place is new news; one merely touched is not.
      digest: createHash('sha1').update(body).digest('hex').slice(0, 12),
    });
  }
  return { space: node, address, items, visibility };
}

// What the seat has not been shown, or has been shown in a different form. This is the signal
// that makes a quiet subject a non-quiet session: petitions arrive on nobody's commit schedule,
// so a repository can go a month without a merge and still be owed a reading.
export function unseen(items, seen = {}) {
  return items.filter((it) => seen[it.file] !== it.digest);
}

export function render(inb, fresh) {
  const L = [];
  L.push(`# Petitions addressed to \`${inb.address}\``);
  L.push('');
  L.push('Filed for this repository by someone not standing in it. **Delivered, not fetched** —');
  L.push('you did not widen scope to get this and you must not widen it to follow up.');
  L.push('');
  L.push('An item here is an **idea only**: not a decision, not a commitment, and **not owed a');
  L.push('response**. Declining one costs nothing and is a complete answer.');
  L.push('');
  L.push('**A petition addressed to this repository is not automatically yours.** Take what falls');
  L.push('in your constituency; leave the rest for another seat and say you left it.');
  L.push('');
  for (const it of inb.items) {
    const isNew = fresh.some((f) => f.file === it.file);
    L.push(`## ${isNew ? '🆕 ' : ''}${it.title}`);
    L.push('');
    L.push(`\`${it.file}\` · \`status: ${it.status}\`${it.source ? ` · \`source: ${it.source}\`` : ''}${it.raised ? ` · \`raised: ${it.raised}\`` : ''}`);
    if (it.filedBy) L.push(`\nFiled by: ${it.filedBy}`);
    L.push('');
    L.push(it.body.replace(/^#\s+.+$/m, '').replace(/^`.*`$/m, '').trim());
    L.push('');
    L.push('---');
    L.push('');
  }
  if (!inb.items.length) L.push('*Nothing filed.*');
  return L.join('\n') + '\n';
}

// Compared through realpath, not by string. On macOS `/tmp` is a symlink to `/private/tmp`, so
// `import.meta.url` comes back resolved while argv[1] does not, and a naive comparison makes the
// CLI silently do nothing from behind any symlinked path.
const isMain = (() => {
  try { return fs.realpathSync(process.argv[1] || '') === fs.realpathSync(fileURLToPath(import.meta.url)); }
  catch { return false; }
})();

if (isMain) {
  const inb = inbound();
  if (process.argv.includes('--json')) { console.log(JSON.stringify(inb, null, 2)); process.exit(0); }
  if (!inb.space) { console.log('petitions: no petition space on this machine — nothing to check'); process.exit(0); }
  if (inb.unaddressed) { console.log(`petitions: ${inb.space} has no library name for this repository — unaddressable`); process.exit(0); }
  console.log(`petitions: ${inb.address} — ${inb.items.length} filed (${inb.visibility})`);
  for (const it of inb.items) console.log(`  ${it.status.padEnd(24)} ${it.file}`);
}
