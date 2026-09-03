#!/usr/bin/env node
// seats — read advocate.yml, validate it, and print the seats as JSON.
//
//   bin/seats                    → the full config, validated
//   bin/seats --matrix           → {"include":[{"name":…,"branch":…}]} for a workflow matrix
//   bin/seats --seat <name>      → one seat, resolved (defaults filled in)
//
// Refuses rather than guesses. A config that does not parse stops the council; an advocate
// running against a config nobody could read is the failure this check exists to prevent.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from './yaml-enough.mjs';

// Am I the entry point? Compare REALPATHS: on macOS /tmp is a symlink to /private/tmp, so a
// naive `import.meta.url === file://${process.argv[1]}` is true on Linux and false on a Mac —
// which would silently break exactly the local path this is meant to serve.
const isMain = (url) => {
  if (!process.argv[1]) return false;
  try { return fs.realpathSync(fileURLToPath(url)) === fs.realpathSync(process.argv[1]); }
  catch { return false; }
};

const CANDIDATES = ['advocate.yml', 'advocate.yaml', '.github/advocate.yml'];

function die(msg) { console.error(`advocate: ${msg}`); process.exit(1); }

// `report:` — where the council's one page is published. Optional; the default is a branch.
//
//   report: false                  publish nothing
//   report:
//     branch: council              a branch of THIS repo, holding one file, rewritten whole
//     wiki: true                   also push it to <origin>.wiki.git as Home.md
//
// A branch is the default because it is a push and nothing else. The wiki is opt-in for a
// mechanical reason worth stating: GitHub does not create the wiki's git repository until a
// first page exists, so `wiki: true` on a repo whose wiki was never opened has no remote to
// push to. That is a one-time click somebody has to make, and defaulting to it would mean
// the framework's headline output failed on a fresh repo for a reason nothing explains.
function resolveReport(r, where) {
  if (r === undefined || r === null) return { branch: 'council', wiki: false };
  if (r === false) return { branch: null, wiki: false };
  if (typeof r !== 'object' || Array.isArray(r)) die(`${where}: report: must be a mapping, or false`);
  const branch = r.branch === undefined ? 'council' : r.branch;
  if (branch !== null && branch !== false && !(typeof branch === 'string' && /^[\w][\w./-]*$/.test(branch))) {
    die(`${where}: report.branch must be a branch name, or false (got ${JSON.stringify(branch)})`);
  }
  if (r.wiki !== undefined && typeof r.wiki !== 'boolean') die(`${where}: report.wiki must be true or false`);
  return { branch: branch === false ? null : branch, wiki: r.wiki === true };
}

// `backend:` — WHAT a session calls, when `session: hosted` says it may call anything.
//
// Same rule as `session:`, one level down: a credential appearing must never decide behaviour.
// An org secret named for a ROLE ("the key that summons a session") was silently choosing a
// VENDOR, because the bundled adapter is the only one there was. See BACKEND.md.
//
// Repo-level with a per-seat override, and absent means exactly today's behaviour.
const KINDS = ['anthropic', 'openai', 'command'];

function resolveBackend(b, where, what) {
  if (b === undefined || b === null) return null;
  if (typeof b === 'string') b = { kind: b };
  if (typeof b !== 'object' || Array.isArray(b)) die(`${where}: ${what} must be a mapping, or a kind`);
  const kind = b.kind ?? 'anthropic';
  if (!KINDS.includes(kind)) die(`${where}: ${what}.kind must be one of ${KINDS.join(', ')} (got ${JSON.stringify(kind)})`);
  // A declaration that names no command is not a command backend; it is a typo that would fall
  // through to the default adapter and look like it worked.
  if (kind === 'command' && (typeof b.command !== 'string' || !b.command.trim())) {
    die(`${where}: ${what}.kind is 'command' but no command: is given`);
  }
  if (kind !== 'command' && b.command !== undefined) {
    die(`${where}: ${what}.command only applies to kind: command`);
  }
  for (const k of ['model', 'url', 'command']) {
    if (b[k] !== undefined && typeof b[k] !== 'string') die(`${where}: ${what}.${k} must be a string`);
  }
  // "" is meaningful and not the same as absent: it says this backend takes NO credential, which
  // is the strongest configuration available and must not be read as "you forgot to set it".
  if (b['key-env'] !== undefined && typeof b['key-env'] !== 'string') die(`${where}: ${what}.key-env must be a string`);
  return {
    kind,
    model: b.model ?? null,
    url: b.url ?? null,
    command: b.command ?? null,
    'key-env': b['key-env'] === undefined ? 'ADVOCATE_AGENT_KEY' : b['key-env'],
  };
}

export function loadConfig(root = process.cwd()) {
  const found = process.env.ADVOCATE_CONFIG
    ? path.resolve(process.env.ADVOCATE_CONFIG)
    : CANDIDATES.map((c) => path.join(root, c)).find((p) => fs.existsSync(p));
  if (!found) die(`no advocate.yml (looked for ${CANDIDATES.join(', ')})`);

  let cfg;
  try { cfg = parse(fs.readFileSync(found, 'utf8')); }
  catch (e) { die(`${found}: ${e.message}`); }

  if (!cfg || typeof cfg !== 'object' || Array.isArray(cfg)) die(`${found}: expected a mapping at the top level`);
  if (cfg.version !== 1) die(`${found}: version must be 1 (got ${JSON.stringify(cfg.version)})`);
  if (!Array.isArray(cfg.advocates) || cfg.advocates.length === 0) die(`${found}: advocates: must be a non-empty list`);

  // Where the one readable page goes. A branch by default, because a branch is a push and
  // nothing else — no API to keep honest, no second surface that can be stale while the
  // repository is fine. `report: false` publishes nothing, which is a complete answer.
  cfg.report = resolveReport(cfg.report, found);
  const repoBackend = resolveBackend(cfg.backend, found, 'backend');
  cfg.backend = repoBackend;

  const seen = new Set();
  cfg.advocates = cfg.advocates.map((a, i) => {
    const where = `${found}: advocates[${i}]`;
    if (!a || typeof a !== 'object' || Array.isArray(a)) die(`${where}: expected a mapping`);
    if (typeof a.name !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(a.name)) {
      die(`${where}: name must be a lowercase slug (got ${JSON.stringify(a.name)})`);
    }
    if (seen.has(a.name)) die(`${where}: duplicate advocate name ${a.name}`);
    seen.add(a.name);
    if (typeof a.mission !== 'string' || a.mission.trim() === '') die(`${where}: ${a.name} has no mission`);
    if (typeof a.constituency !== 'string' || a.constituency.trim() === '') {
      die(`${where}: ${a.name} has no constituency — a brief nobody wrote is the one input that cannot be inherited`);
    }
    // Where a session RUNS is declared here, never inferred from whether a credential
    // happens to exist. `local` is the default: adding an org-wide key must not silently
    // switch every repo that mounts this onto a paid, cloud-bound path.
    const session = a.session ?? cfg.session ?? 'local';
    if (session !== 'local' && session !== 'hosted') {
      die(`${where}: ${a.name}: session must be 'local' or 'hosted' (got ${JSON.stringify(session)})`);
    }
    const writes = a.writes == null ? [] : a.writes;
    if (!Array.isArray(writes)) die(`${where}: ${a.name}: writes must be a list (use [] for none)`);
    // The grant parses, but nothing acts on it yet: the pull-request step is unbuilt. A key
    // that reads as a capability and quietly does nothing is the failure this whole file is
    // written against, so refuse it until the step exists.
    if (writes.length) {
      die(`${where}: ${a.name}: writes: is not wired yet — the pull-request step is unbuilt. Use [] until it is.`);
    }
    return {
      ...a,
      branch: a.branch || `advocate/${a.name}`,
      cadence: a.cadence || 'weekly',
      session,
      writes,
      constitution: a.constitution ?? cfg.constitution ?? null,
      // One seat on a big model and another on a cheap local one is a reasonable thing to
      // want, and this is where you would look for it.
      backend: resolveBackend(a.backend, `${found}: advocates[${i}]`, `${a.name}.backend`) ?? repoBackend,
      goals: Array.isArray(a.goals) ? a.goals : [],
      'out-of-scope': Array.isArray(a['out-of-scope']) ? a['out-of-scope'] : [],
    };
  });

  // The digest is written by the round, not by a seat. Letting it land on a seat's branch
  // would put a generated page inside a workspace the seat is told it owns.
  const clash = cfg.advocates.find((a) => a.branch === cfg.report.branch);
  if (clash) die(`${found}: report.branch is ${JSON.stringify(cfg.report.branch)}, which is ${clash.name}'s workspace`);

  return { file: path.relative(root, found), ...cfg };
}

if (isMain(import.meta.url)) {
  const cfg = loadConfig();
  const args = process.argv.slice(2);
  if (args[0] === '--matrix') {
    console.log(JSON.stringify({ include: cfg.advocates.map(({ name, branch, cadence, session }) => ({ name, branch, cadence, session })) }));
  } else if (args[0] === '--backend') {
    const seat = args[1] ? cfg.advocates.find((a) => a.name === args[1]) : null;
    if (args[1] && !seat) die(`no advocate named ${JSON.stringify(args[1])}`);
    console.log(JSON.stringify((seat ? seat.backend : cfg.backend) || { kind: 'anthropic', model: null, url: null, command: null, 'key-env': 'ADVOCATE_AGENT_KEY' }));
  } else if (args[0] === '--report') {
    console.log(JSON.stringify(cfg.report));
  } else if (args[0] === '--seat') {
    const seat = cfg.advocates.find((a) => a.name === args[1]);
    if (!seat) die(`no advocate named ${JSON.stringify(args[1])}`);
    console.log(JSON.stringify({ ...seat, repo_mission: cfg.mission ?? null }, null, 2));
  } else {
    console.log(JSON.stringify(cfg, null, 2));
  }
}
