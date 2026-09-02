// yaml-enough — the subset of YAML an advocate.yml is allowed to be.
//
// Deliberately small, in the house idiom (git-enough, jekyll-enough): no vendor, no
// surprises, and a config that needs more than this is a config saying too much.
//
// Supported: nested maps, `- ` sequences (of scalars or maps), `#` comments, `|`/`>` block
// scalars (with `-`/`+` chomping), single/double quotes, and the plain scalars true/false/
// null/integers. Not supported, on purpose: anchors, aliases, tags, flow collections,
// multi-document streams. Those all fail loudly rather than quietly meaning something else.

const DEDENT = /^(\s*)/;

// A one-line `[a, b]` of scalars — the only flow collection allowed, because `writes: []`
// is the honest way to spell "nothing" and a block sequence cannot spell it at all.
function flowSeq(s) {
  const body = s.slice(1, -1).trim();
  if (body === '') return [];
  const out = [];
  let cur = '', q = null;
  for (const c of body) {
    if (q) { cur += c; if (c === q) q = null; continue; }
    if (c === '"' || c === "'") { q = c; cur += c; continue; }
    if (c === ',') { out.push(scalar(cur)); cur = ''; continue; }
    cur += c;
  }
  if (cur.trim() !== '') out.push(scalar(cur));
  return out;
}

function scalar(raw) {
  const s = raw.trim();
  if (s === '') return null;
  if (s.startsWith('[') && s.endsWith(']')) return flowSeq(s);
  if (s.startsWith('{')) throw new Error('yaml-enough: flow mappings are not supported');
  if (/^[&*!]/.test(s)) throw new Error(`yaml-enough: anchors, aliases and tags are not supported (${s})`);
  if ((s.startsWith('"') && s.endsWith('"') && s.length > 1) ||
      (s.startsWith("'") && s.endsWith("'") && s.length > 1)) {
    const body = s.slice(1, -1);
    return s[0] === '"' ? body.replace(/\\n/g, '\n').replace(/\\"/g, '"') : body.replace(/''/g, "'");
  }
  if (s === 'true') return true;
  if (s === 'false') return false;
  if (s === 'null' || s === '~') return null;
  if (/^-?\d+$/.test(s)) return Number(s);
  return s;
}

function stripComment(line) {
  let q = null;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) { if (c === q) q = null; continue; }
    if (c === '"' || c === "'") { q = c; continue; }
    if (c === '#' && (i === 0 || /\s/.test(line[i - 1]))) return line.slice(0, i);
  }
  return line;
}

// Gather a `|` / `>` block, returning [text, linesConsumed].
function block(lines, i, parentIndent, style, chomp) {
  const body = [];
  let indent = null;
  let j = i;
  for (; j < lines.length; j++) {
    const raw = lines[j];
    if (raw.trim() === '') { body.push(''); continue; }
    const ind = raw.match(DEDENT)[1].length;
    if (ind <= parentIndent) break;
    if (indent === null) indent = ind;
    body.push(raw.slice(indent));
  }
  while (body.length && body[body.length - 1] === '') body.pop();
  let text = style === '>'
    ? body.reduce((acc, l) => (l === '' ? acc + '\n\n' : acc && !acc.endsWith('\n') ? acc + ' ' + l : acc + l), '')
    : body.join('\n');
  if (chomp !== '-') text += '\n';
  if (chomp === '+') text += '\n'.repeat(0);
  return [text, j - i];
}

function parseBlock(lines, start, indent) {
  let i = start;
  let out = null;

  while (i < lines.length) {
    const raw = lines[i];
    if (raw.trim() === '' || stripComment(raw).trim() === '') { i++; continue; }
    const ind = raw.match(DEDENT)[1].length;
    if (ind < indent) break;
    if (ind > indent) throw new Error(`yaml-enough: unexpected indent at line ${i + 1}: ${raw}`);

    const line = stripComment(raw).slice(ind);
    if (/^[&*!]/.test(line)) throw new Error(`yaml-enough: anchors/aliases/tags are not supported (line ${i + 1})`);
    if (/^[{]/.test(line)) throw new Error(`yaml-enough: flow mappings are not supported (line ${i + 1})`);

    if (line.startsWith('- ') || line === '-') {
      if (out === null) out = [];
      if (!Array.isArray(out)) throw new Error(`yaml-enough: sequence item inside a mapping (line ${i + 1})`);
      const rest = line === '-' ? '' : line.slice(2);
      if (rest.trim() === '') {
        const [val, used] = parseBlock(lines, i + 1, indent + 2);
        out.push(val); i += 1 + used;
      } else if (/^[\w.$-]+\s*:(\s|$)/.test(rest)) {
        // `- key: value` — an inline map whose remaining keys sit at indent+2
        const inner = lines.slice();
        inner[i] = ' '.repeat(ind + 2) + rest;
        const [val, used] = parseBlock(inner, i, ind + 2);
        out.push(val); i += used;
      } else {
        out.push(scalar(rest)); i++;
      }
      continue;
    }

    const m = line.match(/^([\w.$-]+)\s*:(?:\s+([\s\S]*))?$/);
    if (!m) throw new Error(`yaml-enough: cannot read line ${i + 1}: ${raw}`);
    if (out === null) out = {};
    if (Array.isArray(out)) throw new Error(`yaml-enough: mapping key inside a sequence (line ${i + 1})`);
    const key = m[1];
    const rest = (m[2] ?? '').trim();

    const bm = rest.match(/^([|>])([-+]?)$/);
    if (bm) {
      const [text, used] = block(lines, i + 1, ind, bm[1], bm[2]);
      out[key] = text; i += 1 + used;
    } else if (rest === '') {
      const [val, used] = parseBlock(lines, i + 1, ind + 2);
      out[key] = val === null ? null : val; i += 1 + used;
    } else {
      out[key] = scalar(rest); i++;
    }
  }

  return [out, i - start];
}

export function parse(text) {
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
    .filter((l) => !/^%|^---\s*$|^\.\.\.\s*$/.test(l.trim()) || l.trim() === '');
  const [val] = parseBlock(lines, 0, 0);
  return val;
}

export default { parse };
