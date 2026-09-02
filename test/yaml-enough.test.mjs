import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parse } from '../bin/yaml-enough.mjs';

const cfg = parse(fs.readFileSync(new URL('../advocate.example.yml', import.meta.url), 'utf8'));

assert.equal(cfg.version, 1, 'version is an integer, not a string');
assert.equal(cfg.advocates.length, 2);
assert.deepEqual(cfg.advocates.map((a) => a.name), ['upkeep', 'legibility']);

// block scalars keep their shape
assert.match(cfg.advocates[0].constituency, /^The person who runs this and did not write it\./);
assert.ok(cfg.advocates[0].constituency.includes('\n'), 'a | block keeps its newlines');
assert.ok(!cfg.mission.trim().includes('\n'), 'a > block folds to one line');

// flow sequences — the only flow collection allowed, because [] is how you spell "nothing".
// (The parser reads a populated one fine; seats.mjs is what refuses it while grants are
// unwired, which is a policy check, not a parsing one.)
assert.deepEqual(cfg.advocates[0].writes, []);
assert.deepEqual(cfg.advocates[1].writes, []);
assert.deepEqual(parse('writes: [a.md, "b c.md"]\n').writes, ['a.md', 'b c.md']);

// sequences of maps
assert.deepEqual(cfg.advocates[0].goals[0].id, 'G1');
assert.equal(cfg.advocates[0].goals.length, 2);
assert.equal(cfg.advocates[0]['out-of-scope'].length, 2);

// comments and quoting
assert.equal(cfg.advocates[0].constitution, '#caretaking', 'a quoted # is not a comment');
assert.equal(parse('a: 1 # trailing\nb: "x # y"\n').b, 'x # y');

// what it refuses, loudly
for (const bad of ['a: &anchor 1\n', 'a: {b: 1}\n', 'a: *ref\n']) {
  assert.throws(() => parse(bad), /yaml-enough/, `should refuse: ${bad.trim()}`);
}

console.log('yaml-enough: ok');
