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
  const docs = {};
  for (const f of ['POSITION.md', 'COMPLAINTS.md', 'ASKS.md']) {
    const t = read(f);
    docs[f] = t || '';
    if (t) all.push(...items(t).map((i) => ({ ...i, file: f })));
  }
  const note = last ? read(`sessions/${last}.md`) : null;
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
    docs, note,
  };
}

const cfg = loadConfig();
const repo = slug();
const seats = cfg.advocates.map(seatState);
const today = new Date().toISOString().slice(0, 10);

function render() {
  const L = [];
  L.push(`# The council${repo ? ` — ${repo.split('/')[1]}` : ''}`, '');
  L.push('**Where every seat stands, as of the last round.** Rewritten whole each time: this page is a');
  L.push("position, not a log. Each seat's own history is its branch, which is the receipt.", '');
  L.push(`Generated ${today} by \`.advocate-engine/bin/digest.mjs\`. Do not edit it — edit the seat.`, '');

  L.push('| seat | last spoke | sessions | draft | ready | state |');
  L.push('| --- | --- | --- | --- | --- | --- |');
  for (const s of seats) {
    if (!s.seated) { L.push(`| \`${s.name}\` | — | — | — | — | not seated yet |`); continue; }
    const state = s.owed ? '**session owed**' : s.last_session ? 'up to date' : 'seated, has not spoken';
    const name = `[\`${s.name}\`](${pageLink(s)})`;
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

// --- the hub -----------------------------------------------------------------------------
// One page per seat, carrying the seat's ACTUAL DOCUMENTS, not a link to them. The index by
// itself only relocates the problem: you still end up opening a branch per seat to read a
// finding, and a hub you have to leave in order to learn anything is not a hub.
//
// Still rewritten whole. These pages are copies of the current state of each branch, which is
// the authority; nothing here is edited by hand and nothing accumulates.
//
// Two flavours of the same hub, because they are addressed differently:
//   wiki    Home.md + _Sidebar.md + `Seat-<name>.md`. GitHub derives a page's URL from its
//           filename, collapsing every run of non-word characters to one dash.
//   branch  README.md + `<name>.md`, sitting in one directory listing. This is the default
//           and it needs NOTHING turned on — /tree/council renders the index and the seat
//           pages are right there beside it.
const FLAVOR = (() => { const i = process.argv.indexOf('--as'); return i > -1 ? process.argv[i + 1] : 'branch'; })();
const HUB = process.argv.includes('--pages');
const pageFile = (s) => (FLAVOR === 'wiki' ? `Seat-${s.name}.md` : `${s.name}.md`);
// Off the hub there is no sibling page to point at, so the index links where the thing
// actually lives. A relative link that resolves to nothing is worse than a long URL.
const pageLink = (s) => (HUB ? (FLAVOR === 'wiki' ? `Seat-${s.name}` : `${s.name}.md`)
  : repo ? `https://github.com/${repo}/blob/${s.branch}/POSITION.md` : `${s.branch}:POSITION.md`);
const title = (s) => `Seat · ${s.name}`;

function seatPage(s) {
  const L = [`# ${title(s)}`, ''];
  if (!s.seated) {
    L.push('Declared in `advocate.yml` and never run. A seat exists once it has spoken; until then it', 'is an intention.', '');
    return L.join('\n') + '\n';
  }
  L.push(`\`${s.branch}\` · last spoke **${s.last_session || 'never'}** · ${s.sessions} session(s) · ` +
         `${s.tally.draft} draft · ${s.tally.ready} ready${s.owed ? ' · **session owed**' : ''}`, '');
  L.push('<sub>Copied whole from the branch, which is the authority. Do not edit this page — it is', 'overwritten every round.</sub>', '');
  for (const [f, heading] of [['POSITION.md', 'Position'], ['COMPLAINTS.md', 'Complaints'], ['ASKS.md', 'Asks']]) {
    const body = (s.docs?.[f] || '').trim();
    L.push(`## ${heading}`, '');
    L.push(body ? body.replace(/^#\s+/gm, '### ') : `_Nothing in \`${f}\` yet._`, '');
  }
  if (s.note) { L.push(`## Last session note — ${s.last_session}`, '', s.note.trim().replace(/^#\s+/gm, '### '), ''); }
  return L.join('\n') + '\n';
}

function sidebar() {
  const L = ['**[The council](Home)**', ''];
  for (const s of seats) {
    const mark = !s.seated ? ' <sub>unseated</sub>' : s.owed ? ' <sub>owed</sub>' : '';
    L.push(`- [${s.name}](${pageLink(s)})${mark}`);
  }
  return L.join('\n') + '\n';
}

const pagesAt = process.argv.indexOf('--pages');
const out = render();
const w = process.argv.indexOf('--write');

if (process.argv.includes('--json')) console.log(JSON.stringify({ repo, generated: today, seats }, null, 2));
else if (pagesAt > -1) {
  // GitHub wikis derive a page's URL from its FILENAME, turning every run of non-word
  // characters into a single dash. Generate the filename the same way rather than guessing,
  // or every sidebar link 404s in a way that looks like the page failed to write.
  const dir = process.argv[pagesAt + 1];
  fs.mkdirSync(dir, { recursive: true });
  const home = FLAVOR === 'wiki' ? 'Home.md' : 'README.md';
  fs.writeFileSync(`${dir}/${home}`, out);
  const keep = new Set([home]);
  if (FLAVOR === 'wiki') { fs.writeFileSync(`${dir}/_Sidebar.md`, sidebar()); keep.add('_Sidebar.md'); }
  for (const s of seats) {
    keep.add(pageFile(s));
    fs.writeFileSync(`${dir}/${pageFile(s)}`, seatPage(s));
  }
  // A seat that was removed from advocate.yml leaves a page behind that will otherwise sit
  // there forever looking current. The hub reflects the config; it does not accumulate.
  for (const f of fs.readdirSync(dir)) {
    if (f.endsWith('.md') && !keep.has(f)) { fs.rmSync(`${dir}/${f}`); console.error(`advocate: retired hub page ${f}`); }
  }
  console.error(`advocate: ${keep.size} hub page(s) written to ${dir}`);
}
else if (w > -1) { fs.writeFileSync(process.argv[w + 1], out); console.error(`advocate: digest written to ${process.argv[w + 1]}`); }
else process.stdout.write(out);
