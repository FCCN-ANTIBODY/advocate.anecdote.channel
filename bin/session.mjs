#!/usr/bin/env node
// session — prepare one advocate's workspace and tell it what moved.
//
//   bin/session <name> [--subject <ref>] [--json]
//
// Checks out the advocate's branch as a worktree under .advocate-work/<name> (creating it
// as an ORPHAN the first time — the workspace shares no history with main and is never
// merged into it), then reports the range of first-parent commits on the subject since the
// last session.
//
// An EMPTY RANGE is a real answer. It writes one line and stops. An advocate that
// manufactures opinion because a schedule fired is the failure this exists to prevent.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { loadConfig } from './seats.mjs';

const git = (...a) => execFileSync('git', a, { encoding: 'utf8' }).trimEnd();
const gitQuiet = (...a) => { try { return execFileSync('git', a, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trimEnd(); } catch { return null; } };

const [name, ...rest] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const flags = process.argv.slice(2).filter((a) => a.startsWith('--'));
const subjectRef = (() => {
  const i = process.argv.indexOf('--subject');
  return i > -1 ? process.argv[i + 1] : 'HEAD';
})();

if (!name) { console.error('usage: bin/session <advocate-name> [--subject <ref>] [--json]'); process.exit(2); }

const cfg = loadConfig();
const seat = cfg.advocates.find((a) => a.name === name);
if (!seat) { console.error(`advocate: no advocate named ${JSON.stringify(name)} in ${cfg.file}`); process.exit(1); }

const root = git('rev-parse', '--show-toplevel');
// Inside .git on purpose: a workspace under the worktree root gets swept into a stray
// `git add -A` on the subject and committed to main, which is the one place it must never be.
const work = path.join(git('rev-parse', '--git-common-dir').replace(/^(?!\/)/, root + '/'), 'advocate-work', seat.name);
const head = git('rev-parse', subjectRef);
const today = new Date().toISOString().slice(0, 10);

// --- the workspace, as a worktree on the advocate's own branch --------------------------
fs.mkdirSync(path.dirname(work), { recursive: true });
if (fs.existsSync(work)) execFileSync('git', ['worktree', 'remove', '--force', work], { stdio: 'ignore' });

const exists = gitQuiet('rev-parse', '--verify', `refs/heads/${seat.branch}`)
  || gitQuiet('rev-parse', '--verify', `refs/remotes/origin/${seat.branch}`);

if (exists) {
  const start = gitQuiet('rev-parse', '--verify', `refs/heads/${seat.branch}`)
    ? seat.branch : `origin/${seat.branch}`;
  git('worktree', 'add', '--quiet', '-B', seat.branch, work, start);
} else {
  // First run: an orphan, so the workspace carries none of main's tree or history.
  git('worktree', 'add', '--quiet', '--detach', work, head);
  execFileSync('git', ['-C', work, 'checkout', '--orphan', seat.branch], { stdio: 'ignore' });
  execFileSync('git', ['-C', work, 'rm', '-rq', '--cached', '.'], { stdio: 'ignore' });
  for (const e of fs.readdirSync(work)) if (e !== '.git') fs.rmSync(path.join(work, e), { recursive: true, force: true });
}

// --- what moved -------------------------------------------------------------------------
const statePath = path.join(work, 'state.json');
const state = fs.existsSync(statePath) ? JSON.parse(fs.readFileSync(statePath, 'utf8')) : {};
const since = state.subject && gitQuiet('cat-file', '-e', `${state.subject}^{commit}`) !== null ? state.subject : null;
const range = since ? `${since}..${head}` : head;
const log = git('log', '--first-parent', '--format=%H%x1f%ad%x1f%s', '--date=short', ...(since ? [range] : ['-1', head]));
const commits = log ? log.split('\n').map((l) => { const [sha, date, subject] = l.split('\x1f'); return { sha, date, subject }; }) : [];
const quiet = since !== null && commits.length === 0;

fs.mkdirSync(path.join(work, 'sessions'), { recursive: true });
fs.writeFileSync(statePath, JSON.stringify({ subject: head, ran: today, advocate: seat.name }, null, 2) + '\n');

if (quiet) {
  fs.writeFileSync(path.join(work, 'sessions', `${today}.md`),
    `# ${today}\n\nSubject unchanged at \`${head.slice(0, 7)}\`. Nothing merged since the last session; nothing to say.\n`);
}

const out = {
  advocate: seat.name, branch: seat.branch, workspace: work,
  subject: head, since, range: since ? range : null, quiet, commits,
  writes: seat.writes, constitution: seat.constitution,
};

if (flags.includes('--json')) { console.log(JSON.stringify(out, null, 2)); }
else {
  console.log(`advocate ${seat.name} → ${seat.branch}`);
  console.log(`  workspace: ${out.workspace}`);
  console.log(quiet ? `  quiet: subject unchanged at ${head.slice(0, 7)}`
                    : `  ${commits.length} commit(s) since ${since ? since.slice(0, 7) : 'the beginning'}`);
  for (const c of commits.slice(0, 20)) console.log(`  ${c.sha.slice(0, 7)} ${c.date} ${c.subject}`);
}
process.exit(0);
