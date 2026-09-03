// The adapter contract, exercised against a stub server.
//
// The point is not the HTTP. It is that BACKEND.md's contract is checkable: a probe that answers
// honestly, four whole documents on success, and — the one that matters — a REFUSAL rather than a
// partial session when the model does not deliver one. A half-written session is the failure the
// whole method is arranged against, and an adapter is the most likely place to introduce it.
//
// It also stands in for a local model, which is the wildcard case: nothing here is OpenAI, it is
// something answering /chat/completions on localhost with no credential. That is the whole claim.
//
// The stub runs in ITS OWN PROCESS on purpose. A server in this process cannot answer while this
// process is blocked in execFileSync, and the deadlock looks exactly like an unreachable endpoint.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawn } from 'node:child_process';

const bin = new URL('../bin/advocate-agent-openai', import.meta.url).pathname;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'adv-adapter-'));
const replyFile = path.join(tmp, 'reply');   // what the model says back, rewritten per case
const seenFile = path.join(tmp, 'seen');     // what the adapter actually sent

const stub = spawn(process.execPath, ['-e', `
  const http = require('node:http'), fs = require('node:fs');
  http.createServer((q, r) => {
    if (q.url.endsWith('/models')) { r.writeHead(200, {'content-type':'application/json'}); return r.end('{"data":[]}'); }
    let b = ''; q.on('data', d => b += d); q.on('end', () => {
      fs.writeFileSync(process.env.SEEN, b);
      r.writeHead(200, {'content-type':'application/json'});
      r.end(JSON.stringify({ choices: [{ message: { content: fs.readFileSync(process.env.REPLY,'utf8') } }] }));
    });
  }).listen(0, '127.0.0.1', function () { console.log(this.address().port); });
`], { env: { ...process.env, REPLY: replyFile, SEEN: seenFile }, stdio: ['ignore', 'pipe', 'inherit'] });

const port = await new Promise((res, rej) => {
  stub.stdout.once('data', (d) => res(Number(String(d).trim())));
  stub.once('error', rej);
});

const url = `http://127.0.0.1:${port}/v1/chat/completions`;
// key-env: "" — a local backend takes no credential, and that is a real declaration rather than
// a missing one. It has to be a supported state or "local" is not actually supported.
const env = { ...process.env, ADVOCATE_API_URL: url, ADVOCATE_KEY_ENV: '', ADVOCATE_MODEL: 'stub' };
delete env.OPENAI_API_KEY;

const says = (t) => fs.writeFileSync(replyFile, t);
const run = () => {
  const input = JSON.stringify({
    method: 'THE-METHOD-MARKER', seat: { name: 'upkeep' }, range: { first: true, commits: [] },
    current: { position: '', complaints: '', asks: '' },
  });
  try { return { ok: true, out: JSON.parse(execFileSync(bin, { input, encoding: 'utf8', env, stdio: ['pipe', 'pipe', 'pipe'] })) }; }
  catch (e) { return { ok: false, err: String(e.stderr || '') }; }
};

try {
  const four = { position: 'P', complaints: 'C', asks: 'A', session: 'S' };

  // --- the probe: a local endpoint that answers needs no key ------------------------------
  says(JSON.stringify(four));
  execFileSync(bin, ['--available'], { env, stdio: ['ignore', 'ignore', 'inherit'] });

  // --- a complete session comes back as four whole documents ------------------------------
  const good = run();
  assert.ok(good.ok, good.err);
  assert.deepEqual(good.out, four);

  // The method must actually reach the model. An adapter that dropped it would produce sessions
  // that look fine and quietly ignored their own law, which is unfalsifiable from the outside.
  const seen = JSON.parse(fs.readFileSync(seenFile, 'utf8'));
  assert.match(seen.messages[1].content, /THE-METHOD-MARKER/, 'the method reaches the model');
  assert.equal(seen.model, 'stub');

  // --- fenced and prefaced JSON survives, because small models do this ---------------------
  says('Here is the session:\n```json\n' + JSON.stringify(four) + '\n```\n');
  assert.deepEqual(run().out, four, 'a fenced block is worth surviving');

  // --- a PARTIAL session is refused and never written --------------------------------------
  for (const [label, bad] of [
    ['missing two of the four documents', JSON.stringify({ position: 'P', complaints: 'C' })],
    ['not JSON at all', 'I could not complete this.'],
    ['nothing', ''],
  ]) {
    says(bad);
    assert.ok(!run().ok, `should have refused: ${label}`);
  }

  // --- a key for the wrong vendor is caught before a call is spent -------------------------
  let refused = '';
  try {
    execFileSync(bin, ['--available'],
      { env: { ...env, ADVOCATE_KEY_ENV: 'ADVOCATE_AGENT_KEY', ADVOCATE_AGENT_KEY: 'sk-ant-nope' },
        stdio: ['ignore', 'ignore', 'pipe'] });
  } catch (e) { refused = String(e.stderr || ''); }
  assert.match(refused, /ANTHROPIC key/, 'an Anthropic key handed to this adapter is visible for free');

  console.log('adapter: ok');
} finally {
  stub.kill();
  fs.rmSync(tmp, { recursive: true, force: true });
}
