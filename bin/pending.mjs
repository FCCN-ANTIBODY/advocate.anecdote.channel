#!/usr/bin/env node
// pending — which advocates are owed a session, read from the branches themselves.
//
//   bin/pending.mjs [--json]
//
// Offline by design: this reads local refs. Fetch first if you want the truth from a remote.
// There is no queue service and no issue tracker — a branch carrying sessions/PENDING.md is
// the whole of the backlog.

import { execFileSync } from 'node:child_process';
import { loadConfig } from './seats.mjs';

const git = (...a) => { try { return execFileSync('git', a, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trimEnd(); } catch { return null; } };

const cfg = loadConfig();
const open = [];

for (const seat of cfg.advocates) {
  const ref = git('rev-parse', '--verify', `refs/heads/${seat.branch}`) ? seat.branch
            : git('rev-parse', '--verify', `refs/remotes/origin/${seat.branch}`) ? `origin/${seat.branch}`
            : null;
  if (!ref) continue;
  const order = git('show', `${ref}:sessions/PENDING.md`);
  if (!order) continue;
  const json = order.match(/```json\n([\s\S]*?)\n```/);
  open.push({ advocate: seat.name, branch: seat.branch, ref, session: seat.session,
              ...(json ? { order: JSON.parse(json[1]) } : {}) });
}

if (process.argv.includes('--json')) { console.log(JSON.stringify(open, null, 2)); }
else if (!open.length) { console.log('advocate: nothing owed — no branch carries an open work order'); }
else {
  console.log(`advocate: ${open.length} session(s) owed`);
  for (const o of open) {
    const n = o.order?.commits?.length ?? 0;
    console.log(`  ${o.advocate.padEnd(16)} ${o.branch.padEnd(28)} ${o.order?.first ? 'first session' : `${n} commit(s) to read`}`);
  }
  console.log('\nCheck one out with:  node .advocate-engine/bin/session.mjs <advocate>');
}
process.exit(0);
