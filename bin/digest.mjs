#!/usr/bin/env node
// digest — one page for the whole council, rewritten whole.
//
//   bin/digest.mjs [--write <path>] [--json]
//
// Reads every seat's branch from LOCAL REFS and renders a single page: who is seated, when
// each last spoke, what is still forming, and what is asking to graduate. Fetch first if you
// want the truth from a remote; this never reaches for one.
//
// WHOLE, NOT APPENDED. There is deliberately no archive here — the digest is the current
// state of the council and nothing else. A seat's own history is its branch, which is the
// receipt; a digest that accumulated would be a second, worse copy of it, and a tower of old
// reports is the thing this file exists instead of.
//
// It reads what is already there and writes nothing into a seat's workspace. A digest that
// could edit a seat would be an advocate nobody seated.

import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { loadConfig } from './seats.mjs';

const git = (...a) => { try { return execFileSync('git', a, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trimEnd(); } catch { return null; } };

// org/repo from the origin URL, for links. Absent is fine — the digest is readable without
// links, and a wrong link is worse than none.
function slug() {
  const url = git('remote', 'get-url', 'origin');
  const m = url && url.match(/github\.com[/:]([^/]+\/[^/]+?)(?:\.git)?$/);
  return m ? m[1] : null;
}

const LADDER = ['draft', 'open', 'ready', 'answered', 'withdrawn'];

// Greppable on purpose (STATUS.md): no parser, no schema registry. An item is a heading with
// the status line written under it.
function items(text) {
  const out = [];
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const h = lines[i].match(/^#{1,6}\s+(.*\S)\s*$/);
    if (!h) continue;
    const near = lines.slice(i + 1, i + 4).join('\n');
    const s = near.match(/`?status:\s*([a-z]+)/);
    if (!s) continue;
    const src = near.match(/`?source:\s*([a-z]+)/);
    out.push({ title: h[1], status: s[1], source: src ? src[1] : null });
  }
  return out;
}

function seatState(seat) {
  const ref = git('rev-parse', '--verify', `refs/heads/${seat.branch}`) ? seat.branch
            : git('rev-parse', '--verify', `refs/remotes/origin/${seat.branch}`) ? `origin/${seat.branch}`
            : null;
  if (!ref) return { name: seat.name, branch: seat.branch, seated: false, ready: [] };

  const read = (f) => git('show', `${ref}:${f}`);
  const tree = (git('ls-tree', '-r', '--name-only', ref) || '').split('\n');
  const sessions = tree.filter((f) => /^sessions\/\d{4}-\d{2}-\d{2}\.md$/.test(f)).sort();
  const last = sessions.length ? sessions[sessions.length - 1].slice(9, 19) : null;

  let state = {};
  try { state = JSON.parse(read('state.json') || '{}'); } catch { /* a seat mid-flight is not an error */ }

  const all = [];
  for (const f of ['POSITION.md', 'COMPLAINTS.md', 'ASKS.md']) {
    const t = read(f);
    if (t) all.push(...items(t).map((i) => ({ ...i, file: f })));
  }
  const tally = Object.fromEntries(LADDER.map((s) => [s, all.filter((i) => i.status === s).length]));
  tally.promoted = all.filter((i) => i.status === 'promoted').length;

  return {
    name: seat.name, branch: seat.branch, seated: true, ref,
    session: seat.session, cadence: seat.cadence,
    pin: state.subject || null, ran: state.ran || null, last_session: last,
    sessions: sessions.length,
    owed: read('sessions/PENDING.md') !== null,
    tally,
    ready: all.filter((i) => i.status === 'ready'),
  };
}

const cfg = loadConfig();
const repo = slug();
const seats = cfg.advocates.map(seatState);
const today = new Date().toISOString().slice(0, 10);

function render() {
  const L = [];
  const link = (s, f) => (repo ? `https://github.com/${repo}/blob/${s.branch}/${f}` : `${s.branch}:${f}`);

  L.push(`# The council${repo ? ` — ${repo.split('/')[1]}` : ''}`, '');
  L.push('**Where every seat stands, as of the last round.** Rewritten whole each time: this page is a');
  L.push("position, not a log. Each seat's own history is its branch, which is the receipt.", '');
  L.push(`Generated ${today} by \`.advocate-engine/bin/digest.mjs\`. Do not edit it — edit the seat.`, '');

  L.push('| seat | last spoke | sessions | draft | ready | state |');
  L.push('| --- | --- | --- | --- | --- | --- |');
  for (const s of seats) {
    if (!s.seated) { L.push(`| \`${s.name}\` | — | — | — | — | not seated yet |`); continue; }
    const state = s.owed ? '**session owed**' : s.last_session ? 'up to date' : 'seated, has not spoken';
    const name = repo ? `[\`${s.name}\`](${link(s, 'POSITION.md')})` : `\`${s.name}\``;
    L.push(`| ${name} | ${s.last_session || '—'} | ${s.sessions} | ${s.tally.draft} | ${s.tally.ready} | ${state} |`);
  }
  L.push('');

  const ready = seats.flatMap((s) => s.ready.map((i) => ({ ...i, seat: s.name })));
  L.push('## Asking to graduate', '');
  if (!ready.length) {
    L.push('Nothing is `ready`. That is a normal reading and not a stall — `draft` is where thinking is');
    L.push('supposed to sit until it ripens, and a seat is not owed a promotion for having run.', '');
  } else {
    L.push('A human at triage decides where each of these goes, marks it `promoted → <where>`, and the');
    L.push('seat stops holding it. Nothing on this page is a decision.', '');
    for (const i of ready) L.push(`- **${i.seat}** · ${i.title}  <sub>${i.file}${i.source ? ` · ${i.source}` : ''}</sub>`);
    L.push('');
  }

  const owed = seats.filter((s) => s.owed);
  if (owed.length) {
    L.push('## Owed a session', '');
    L.push('The mechanical half ran and left a work order. Anything can pick it up — a local agent, a');
    L.push('scheduled routine, or a person with an afternoon.', '');
    for (const s of owed) L.push(`- \`${s.name}\` → \`${s.branch}\` · \`sessions/PENDING.md\``);
    L.push('', '```sh', 'node .advocate-engine/bin/pending.mjs', '```', '');
  }

  const unseated = seats.filter((s) => !s.seated);
  if (unseated.length) {
    L.push('## Declared but never run', '');
    L.push('Entries in `advocate.yml` with no branch behind them yet. A seat exists once it has spoken;');
    L.push('until then it is an intention.', '');
    for (const s of unseated) L.push(`- \`${s.name}\` → \`${s.branch}\``);
    L.push('');
  }

  L.push('## What a seat is', '');
  L.push('An advocate speaks, permanently, for one constituency about one question: **what would make us');
  L.push('stop, and what we need in order not to stop.** It decides nothing. It cannot merge, it holds no');
  L.push('authority, and everything above is a position or a request that can be declined by closing a');
  L.push('tab. Seats are declared in `advocate.yml` on the default branch; their workspaces are branches');
  L.push('that are **never merged**.', '');

  return L.join('\n') + '\n';
}

const out = render();
const w = process.argv.indexOf('--write');
if (process.argv.includes('--json')) console.log(JSON.stringify({ repo, generated: today, seats }, null, 2));
else if (w > -1) { fs.writeFileSync(process.argv[w + 1], out); console.error(`advocate: digest written to ${process.argv[w + 1]}`); }
else process.stdout.write(out);
