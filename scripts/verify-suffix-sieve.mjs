/**
 * Independent verification: suffix sieve vs real Collatz.
 * Run: node scripts/verify-suffix-sieve.mjs
 */
import {
  simulateClass,
  createSieveTree,
  expandLevel,
  suffixDigitsLsbFirst,
  suffixValue,
  EXPECTED_ALIVE,
  digitStep,
  LOG2_3
} from '../src/lib/suffixSieve.js';

let passed = 0;
let failed = 0;

function assert(cond, msg, detail = '') {
  if (cond) passed++;
  else {
    failed++;
    console.error('FAIL:', msg, detail || '');
  }
}

function collatzStep(n) {
  n = BigInt(n);
  if ((n & 1n) === 0n) return n >> 1n;
  return 3n * n + 1n;
}

/** Replay sieve ops on a real integer; return false if parity mismatches. */
function memberFollowsForced(n, result) {
  let val = BigInt(n);
  for (const step of result.steps) {
    if (step.op === 'halve') {
      if ((val & 1n) !== 0n) return false;
      val >>= 1n;
    } else {
      if ((val & 1n) !== 1n) return false;
      val = 3n * val + 1n;
    }
  }
  return true;
}

console.log('1. Level-1 classes vs real Collatz');
for (const [v, shouldLive] of [[0, false], [1, false], [2, false], [3, true]]) {
  const r = simulateClass(v, 2);
  assert(r.alive === shouldLive, `v≡${v} mod 4 alive=${r.alive}, want ${shouldLive}`);
}

// Real identities
for (const n of [5n, 9n, 13n, 101n]) {
  assert((3n * n + 1n) / 4n < n, `n=${n}≡1 mod4: (3n+1)/4 < n`);
}
for (const n of [4n, 8n, 100n]) assert(n / 2n < n, `n=${n} even decreases`);

console.log('2. Forced ops = real ops prefix for class members');
const classTests = [
  [0, 2], [1, 2], [2, 2], [3, 2],
  [3, 4], [7, 4], [11, 4], [15, 4],
  [3, 6], [27, 6], [43, 6], [51, 6],
  [43, 8], [91, 8], [155, 8],
  [0x5a, 10], [0x1b3, 12]
];
for (const [v, bits] of classTests) {
  const r = simulateClass(v, bits);
  const mod = 1n << BigInt(bits);
  const vv = BigInt(v) & (mod - 1n);
  let ok = true;
  for (let t = 0n; t < 25n; t++) {
    let n = vv + t * mod;
    if (n === 0n) n = mod;
    if (!memberFollowsForced(n, r)) {
      ok = false;
      break;
    }
  }
  assert(ok, `members of ≡${v} mod 2^${bits} follow forced ops (alive=${r.alive})`);
}

console.log('3. Pruned ⇒ large n decreases after forced prefix');
{
  let { root, levels, total } = createSieveTree();
  for (let k = 0; k < 4; k++) {
    const e = expandLevel(levels, { total, maxDepth: 20, maxNodes: 1e5 });
    levels = e.levels;
    total = e.total;
  }
  let checked = 0;
  function walk(n) {
    if (n.depth > 0 && !n.alive && n.result) {
      const mod = 1n << BigInt(2 * n.depth);
      const num = BigInt(n.v) + 10n ** 12n * mod;
      let val = num;
      for (const s of n.result.steps) {
        if (s.op === 'halve') val >>= 1n;
        else val = 3n * val + 1n;
      }
      assert(val < num, `pruned v=${n.v} d=${n.depth}: large n decreases`);
      checked++;
    }
    for (const c of n.children) walk(c);
  }
  walk(root);
  assert(checked > 0, `checked ${checked} pruned nodes`);
  console.log(`   (${checked} pruned nodes)`);
}

console.log('4. Alive ⇒ minScore≥0; members follow ops');
{
  let { root, levels, total } = createSieveTree();
  for (let k = 0; k < 5; k++) {
    const e = expandLevel(levels, { total, maxDepth: 20, maxNodes: 1e5 });
    levels = e.levels;
    total = e.total;
  }
  let ac = 0;
  function walk(n) {
    if (n.depth > 0 && n.alive && n.result) {
      ac++;
      assert(n.result.minScore > -1e-12, `alive v=${n.v} minScore`);
      const mod = 1n << BigInt(2 * n.depth);
      const num = BigInt(n.v) + 999n * mod;
      assert(memberFollowsForced(num === 0n ? mod : num, n.result), `alive member v=${n.v}`);
    }
    for (const c of n.children) walk(c);
  }
  walk(root);
  console.log(`   (${ac} alive nodes)`);
}

console.log('5. EXPECTED_ALIVE counts');
{
  let { levels, total } = createSieveTree();
  const counts = { 1: levels[0].filter((n) => n.alive).length };
  for (let target = 2; target <= 8; target++) {
    while (levels.length < target) {
      const e = expandLevel(levels, { total, maxDepth: 20, maxNodes: 5e5 });
      if (!e.grew) break;
      levels = e.levels;
      total = e.total;
    }
    if (levels.length >= target) {
      counts[target] = levels[target - 1].filter((n) => n.alive).length;
    }
  }
  for (const [k, exp] of Object.entries(EXPECTED_ALIVE)) {
    const got = counts[Number(k)];
    assert(got === exp, `k=${k} alive got=${got} expected=${exp}`);
    console.log(`   k=${k}: ${got} (expected ${exp})`);
  }
}

console.log('6. Base-4 suffix encoding');
{
  let { levels, total } = createSieveTree();
  const e = expandLevel(levels, { total, maxDepth: 10, maxNodes: 1e4 });
  levels = e.levels;
  for (const n of [...levels[0], ...levels[1]]) {
    assert(suffixValue(suffixDigitsLsbFirst(n)) === n.v, `suffix v=${n.v}`);
    assert(n.v >= 0 && n.v < 4 ** n.depth, `v range depth ${n.depth}`);
  }
}

console.log('7. digitStep = 3d+c');
for (let c = 0; c <= 2; c++) {
  for (let d = 0; d <= 3; d++) {
    const { out, emit } = digitStep(c, d);
    const t = 3 * d + c;
    assert(out === t % 4 && emit === (t >> 2 | 0), `digitStep(${c},${d})`);
  }
}

console.log('8. Identity (3^a n + c)/2^d after forced path');
for (const [v, bits] of [[3, 2], [7, 4], [27, 6], [43, 8], [91, 8]]) {
  const r = simulateClass(v, bits);
  const mod = 1n << BigInt(bits);
  const n = (BigInt(v) & (mod - 1n)) + 1000n * mod;
  let val = n;
  let a = 0,
    d = 0;
  for (const s of r.steps) {
    if (s.op === 'halve') {
      val >>= 1n;
      d++;
    } else {
      val = 3n * val + 1n;
      a++;
    }
  }
  const c = val * (1n << BigInt(d)) - 3n ** BigInt(a) * n;
  assert(a === r.mults && d === r.stripsTotal && c >= 0n, `formula v=${v} bits=${bits} c=${c}`);
}

console.log('9. Large members of high-score alive classes grow');
{
  let { levels, total } = createSieveTree();
  for (let k = 0; k < 5; k++) {
    const e = expandLevel(levels, { total, maxDepth: 20, maxNodes: 1e5 });
    levels = e.levels;
    total = e.total;
  }
  let strong = 0;
  for (const node of levels[levels.length - 1]) {
    if (!node.alive || node.result.score <= 0.5) continue;
    strong++;
    const mod = 1n << BigInt(2 * node.depth);
    const n = BigInt(node.v) + 10n ** 15n * mod;
    let val = n;
    for (const s of node.result.steps) {
      if (s.op === 'halve') val >>= 1n;
      else val = 3n * val + 1n;
    }
    assert(val > n, `score>0.5 v=${node.v} should grow`);
  }
  console.log(`   (${strong} strong alive leaves)`);
}

console.log('10. Ground-truth Collatz 1..5000 → 1');
{
  let ok = true;
  for (let i = 1; i <= 5000; i++) {
    let n = BigInt(i);
    let g = 0;
    while (n !== 1n && g++ < 2000) n = collatzStep(n);
    if (n !== 1n) {
      ok = false;
      break;
    }
  }
  assert(ok, 'Collatz 1..5000 reach 1');
}

console.log('11. Survivor density non-increasing');
{
  let { levels, total } = createSieveTree();
  const dens = [levels[0].filter((n) => n.alive).length / 4];
  for (let k = 1; k < 6; k++) {
    const e = expandLevel(levels, { total, maxDepth: 20, maxNodes: 5e5 });
    levels = e.levels;
    total = e.total;
    dens.push(levels[k].filter((n) => n.alive).length / 4 ** (k + 1));
  }
  for (let i = 1; i < dens.length; i++) {
    assert(dens[i] <= dens[i - 1] + 1e-12, `density k=${i + 1} > k=${i}`);
  }
  console.log(
    '  ',
    dens.map((d, i) => `k${i + 1}=${(d * 100).toFixed(2)}%`).join(' ')
  );
}

console.log('\n============================');
console.log(`PASSED: ${passed}  FAILED: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
