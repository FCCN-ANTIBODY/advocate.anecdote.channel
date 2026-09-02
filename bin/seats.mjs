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
import { parse } from './yaml-enough.mjs';

const CANDIDATES = ['advocate.yml', 'advocate.yaml', '.github/advocate.yml'];

function die(msg) { console.error(`advocate: ${msg}`); process.exit(1); }

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
      writes,
      constitution: a.constitution ?? cfg.constitution ?? null,
      goals: Array.isArray(a.goals) ? a.goals : [],
      'out-of-scope': Array.isArray(a['out-of-scope']) ? a['out-of-scope'] : [],
    };
  });
  return { file: path.relative(root, found), ...cfg };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const cfg = loadConfig();
  const args = process.argv.slice(2);
  if (args[0] === '--matrix') {
    console.log(JSON.stringify({ include: cfg.advocates.map(({ name, branch, cadence }) => ({ name, branch, cadence })) }));
  } else if (args[0] === '--seat') {
    const seat = cfg.advocates.find((a) => a.name === args[1]);
    if (!seat) die(`no advocate named ${JSON.stringify(args[1])}`);
    console.log(JSON.stringify({ ...seat, repo_mission: cfg.mission ?? null }, null, 2));
  } else {
    console.log(JSON.stringify(cfg, null, 2));
  }
}
