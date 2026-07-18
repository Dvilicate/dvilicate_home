/**
 * Collatz suffix sieve — modular certainty engine + explainer-backed digit paths.
 *
 * Digit-aligned paths / last-node settlement: ONLY via collatz.js
 * (realignStream, dropStreamToZeroAt, deriveLeftInto). Do not reimplement.
 */

import {
	deriveLeftInto,
	dropStreamToZeroAt,
	emptyStream,
	realignStream,
	setCellBase4Digit
} from './collatz.js';

export const LOG2_3 = Math.log2(3);

/** Carry labels for the educational wheel panel: 0=∅, 1=+, 2=++ */
export const CARRY_SYM = ['∅', '+', '++'];

/**
 * @typedef {{
 *   op: 'halve' | 'odd',
 *   val: string,
 *   known: number,
 *   score: number
 * }} SieveStep
 *
 * @typedef {{
 *   alive: boolean,
 *   score: number,
 *   minScore: number,
 *   mults: number,
 *   stripsTotal: number,
 *   knownLeft: number,
 *   finalVal: string,
 *   steps: SieveStep[]
 * }} SieveResult
 *
 * @typedef {{
 *   id: number,
 *   digit: number | null,
 *   parent: SieveNode | null,
 *   children: SieveNode[],
 *   depth: number,
 *   alive: boolean,
 *   v: number,
 *   result: SieveResult | null,
 *   x: number
 * }} SieveNode
 */

let _id = 1;
function nextId() {
	return _id++;
}

/**
 * Simulate Collatz on the residue class n ≡ v (mod 2^bits).
 * Only steps forced for every member of the class are applied.
 *
 * @param {number|bigint} v
 * @param {number} bits  number of known low bits (≥0)
 * @returns {SieveResult}
 */
export function simulateClass(v, bits) {
	let a = 0;
	let d = 0;
	let score = 0;
	let minScore = 0;
	let val = typeof v === 'bigint' ? v : BigInt(v);
	if (val < 0n) val = -val;
	let known = Math.max(0, bits | 0);
	/** @type {SieveStep[]} */
	const steps = [];

	// Bound work: each loop either spends known bits or applies odd step then strips
	let guard = 0;
	const guardMax = Math.max(32, known * 8 + 16);

	while (known > 0 && guard++ < guardMax) {
		if ((val & 1n) === 0n) {
			// Even — ÷2 is forced for the whole class
			val >>= 1n;
			known -= 1;
			d += 1;
			score -= 1;
			if (score < minScore) minScore = score;
			steps.push({ op: 'halve', val: val.toString(), known, score });
			if (minScore < -1e-12) {
				return {
					alive: false,
					score,
					minScore,
					mults: a,
					stripsTotal: d,
					knownLeft: known,
					finalVal: val.toString(),
					steps
				};
			}
		} else {
			// Odd — 3n+1. For n ≡ val (mod 2^known), 3n+1 ≡ 3·val+1 (mod 2^known).
			val = 3n * val + 1n;
			a += 1;
			score += LOG2_3;
			steps.push({ op: 'odd', val: val.toString(), known, score });

			// Strip every factor of 2 that is forced by the congruence
			while ((val & 1n) === 0n && known > 0) {
				val >>= 1n;
				known -= 1;
				d += 1;
				score -= 1;
				if (score < minScore) minScore = score;
				steps.push({ op: 'halve', val: val.toString(), known, score });
				if (minScore < -1e-12) {
					return {
						alive: false,
						score,
						minScore,
						mults: a,
						stripsTotal: d,
						knownLeft: known,
						finalVal: val.toString(),
						steps
					};
				}
			}
			// If still odd with known>0, loop applies another 3n+1.
			// If known==0, further steps depend on unknown high bits — stop.
		}
	}

	return {
		alive: minScore > -1e-12,
		score,
		minScore,
		mults: a,
		stripsTotal: d,
		knownLeft: known,
		finalVal: val.toString(),
		steps
	};
}

/** @param {SieveResult | null | undefined} r */
export function isAlive(r) {
	return !!r && r.alive;
}

/**
 * Digits from root→leaf: index 0 = least significant (first revealed).
 * @param {SieveNode} n
 * @returns {number[]}
 */
export function suffixDigitsLsbFirst(n) {
	const ds = [];
	for (let p = n; p && p.depth > 0; p = p.parent) {
		ds.push(/** @type {number} */ (p.digit));
	}
	ds.reverse();
	return ds;
}

/**
 * Trailing-suffix string, MSD left / LSB right (standard base-4 writing).
 * @param {SieveNode} n
 */
export function suffixDisplay(n) {
	return suffixDigitsLsbFirst(n).slice().reverse().join('');
}

/**
 * @param {number[]} digitsLsbFirst
 */
export function suffixValue(digitsLsbFirst) {
	let v = 0;
	let p = 1;
	for (const d of digitsLsbFirst) {
		v += (d & 3) * p;
		p *= 4;
	}
	return v;
}

/**
 * Build root + four depth-1 children (digits 0,1,2,3).
 * @returns {{ root: SieveNode, levels: SieveNode[][], total: number }}
 */
export function createSieveTree() {
	_id = 1;
	/** @type {SieveNode} */
	const root = {
		id: nextId(),
		digit: null,
		parent: null,
		children: [],
		depth: 0,
		alive: true,
		v: 0,
		result: null,
		x: 0
	};
	/** @type {SieveNode[]} */
	const level1 = [];
	for (let d = 0; d < 4; d++) {
		const ch = makeChild(root, d);
		root.children.push(ch);
		level1.push(ch);
	}
	return { root, levels: [level1], total: 4 };
}

/**
 * @param {SieveNode} parent
 * @param {number} digit  0..3 — next more-significant base-4 digit
 * @returns {SieveNode}
 */
export function makeChild(parent, digit) {
	const d = digit & 3;
	const depth = parent.depth + 1;
	// v' = v + d · 4^{parent.depth}   (append MSD place while keeping LSB = first digit)
	const v = parent.depth === 0 ? d : parent.v + d * 4 ** parent.depth;
	const bits = 2 * depth;
	const result = simulateClass(v, bits);
	return {
		id: nextId(),
		digit: d,
		parent,
		children: [],
		depth,
		alive: result.alive,
		v,
		result,
		x: 0
	};
}

/**
 * Expand one level from the current frontier.
 * Mutates parent.children; returns a new levels array.
 *
 * @param {SieveNode[][]} levels
 * @param {{ ghost?: boolean, maxDepth?: number, maxNodes?: number, total: number }} opts
 * @returns {{ levels: SieveNode[][], total: number, grew: boolean, reason?: string }}
 */
export function expandLevel(levels, opts) {
	const ghost = !!opts.ghost;
	const maxDepth = opts.maxDepth ?? 14;
	const maxNodes = opts.maxNodes ?? 100000;
	let total = opts.total;

	if (!levels.length) {
		return { levels, total, grew: false, reason: 'no levels' };
	}

	const last = levels[levels.length - 1];
	const frontier = ghost ? last.slice() : last.filter((n) => n.alive);

	if (!frontier.length) {
		return { levels, total, grew: false, reason: 'frontier empty' };
	}
	if (levels.length >= maxDepth) {
		return { levels, total, grew: false, reason: `depth cap ${maxDepth}` };
	}
	if (total + frontier.length * 4 > maxNodes) {
		return { levels, total, grew: false, reason: `node budget ${maxNodes}` };
	}

	// Skip parents that were already expanded (safety if step called twice)
	const parents = frontier.filter((p) => p.children.length === 0);
	if (!parents.length) {
		// Already expanded — synthesize next level from existing children
		const existing = frontier.flatMap((p) => p.children);
		if (!existing.length) {
			return { levels, total, grew: false, reason: 'already expanded, no children' };
		}
		return { levels: levels.concat([existing]), total, grew: true };
	}

	/** @type {SieveNode[]} */
	const next = [];
	for (const p of parents) {
		for (let dig = 0; dig < 4; dig++) {
			const ch = makeChild(p, dig);
			p.children.push(ch);
			next.push(ch);
			total++;
		}
	}
	return { levels: levels.concat([next]), total, grew: true };
}

/**
 * Tidy x-layout: leaves evenly spaced, parents centered.
 * @param {SieveNode} root
 * @param {number} [xGap=22]
 */
export function layoutTree(root, xGap = 22) {
	let cursor = 0;
	/** @param {SieveNode} n */
	function place(n) {
		const kids = n.children;
		if (!kids.length) {
			n.x = cursor;
			cursor += xGap;
			return;
		}
		for (const k of kids) place(k);
		n.x = (kids[0].x + kids[kids.length - 1].x) / 2;
	}
	place(root);
}

/**
 * Walk every node with depth > 0.
 * @param {SieveNode} root
 * @param {(n: SieveNode) => void} fn
 */
export function walkNodes(root, fn) {
	/** @param {SieveNode} n */
	function go(n) {
		if (n.depth > 0) fn(n);
		for (const c of n.children) go(c);
	}
	go(root);
}

/* ==========================================================================
 * Digit-aligned paths + carry wheel — POWERED BY THE EXPLAINER ENGINE ONLY
 *
 * Source of truth: src/lib/collatz.js
 *   realignStream:      num[i] = (prev.num % 4) * 3 + nodeShift   (shift 0–2)
 *   dropStreamToZeroAt: last-node rule —
 *        trueNum = num[k] % 4
 *        if trueNum === 3: next.shift = 1; trueNum = 2; advance
 *        next.shift = trueNum
 *        everything below → shift 0
 *   deriveLeftInto:     left.shift[i] = floor(num[i] / 4), then dropStreamToZeroAt
 *   digit shown:        num % 4
 *   carry to left:      floor(num / 4)
 *
 * The staircase is successive explainer columns after settlement (seed, then
 * cascade left). No separate Collatz digit machine. No invented 2↔3 maps.
 * ========================================================================== */

/**
 * Wheel identity for ×3+c on one base-4 digit (educational diagram only).
 * Same arithmetic as num = 3·d + c in place-value form:
 *   out = (3d+c) mod 4, emit = ⌊(3d+c)/4⌋.
 * @param {number} c 0..2
 * @param {number} d 0..3
 */
export function digitStep(c, d) {
	const t = 3 * (d & 3) + (c | 0);
	return { out: t & 3, emit: t >> 2 };
}

/**
 * @param {(number|null|undefined)[]} cs
 */
export function resolveChain(cs) {
	const chain = cs.filter((c) => c !== null && c !== undefined);
	const n = chain.length;
	/** @param {number} d */
	const F = (d) => {
		let x = d;
		for (const c of chain) x = (((/** @type {number} */ (c) - x) % 4) + 4) % 4;
		return x;
	};
	return {
		n,
		kind: n % 2 ? /** @type {'reflection'} */ ('reflection') : /** @type {'rotation'} */ ('rotation'),
		map: [0, 1, 2, 3].map(F),
		b3: chain.join('')
	};
}

/**
 * Find last index with non-zero shift or residue (active end of column).
 * @param {import('./collatz.js').Stream} stream
 */
function lastActiveIndex(stream) {
	let last = 0;
	for (let i = 0; i < stream.length; i++) {
		const c = stream[i];
		if ((c.nodeShift | 0) !== 0 || (c.num | 0) !== 0) last = i;
	}
	return last;
}

/**
 * Seed one explainer column from base-4 residue digits TOP → BOTTOM
 * (index 0 = top of column), then apply dropStreamToZeroAt at the last
 * non-zero *input* place — the real last-node rule from collatz.js.
 *
 * Important: do NOT use “last non-zero num” for the drop index. Zero shifts
 * below an active node freely wire 1,3,1,3,… forever; that is not a real
 * last node. The last node is the last residue the user (or seed) specified.
 *
 * @param {number[]} residuesTopToBottom  each 0..3
 * @param {number} [tailPad=8]  empty rows below so dropStream has room
 */
/**
 * Top of a column has prev=0 so num∈{0,1,2} only — residue 3 is unreachable.
 * Prepend parent residue 1 (shift 0 under prev%4=1 → num 3) when seed starts with 3.
 * @param {number[]} residues
 */
function normalizeTopResidues(residues) {
	const out = residues.map((d) => d & 3);
	if (out.length && out[0] === 3) out.unshift(1);
	return out.length ? out : [0];
}

export function seedExplainerColumn(residuesTopToBottom, tailPad = 8) {
	const residues = normalizeTopResidues(residuesTopToBottom);
	const span = residues.length;
	// Need room below last node for: optional residue-3 intermediate + residual + zeros
	const n = span + Math.max(6, tailPad);
	const stream = emptyStream(n);

	for (let i = 0; i < residues.length; i++) {
		setCellBase4Digit(stream, i, residues[i]);
	}
	realignStream(stream);

	// Last intentional node = last non-zero *seed* digit (not wired zero-shift tail)
	let last = 0;
	for (let i = residues.length - 1; i >= 0; i--) {
		if (residues[i] !== 0) {
			last = i;
			break;
		}
	}
	if (last > stream.length - 3) {
		last = Math.max(0, stream.length - 3);
	}

	// THE explainer last-node rule (same function as applyLocalMove / seedNumberIntoGrid)
	dropStreamToZeroAt(stream, last);
	return stream;
}

/**
 * Snapshot one settled column for the staircase.
 * digits[i] = num%4 (top→bottom). carries[i] = floor(num/4) = left.shift[i].
 * Includes the settled tail zeros so you can see the last node fall to 0.
 *
 * @param {import('./collatz.js').Stream} stream
 * @param {string} [kind]
 */
export function snapshotExplainerColumn(stream, kind = 'column') {
	realignStream(stream);
	const fullDigits = stream.map((c) => ((c.num % 4) + 4) % 4);
	const fullCarries = stream.map((c) => Math.floor(Number(c.num) / 4));
	const fullShifts = stream.map((c) => c.nodeShift | 0);

	// Keep through last non-zero residue, plus the forced zero tail (at least one 0)
	let end = 0;
	for (let i = 0; i < fullDigits.length; i++) {
		if (fullDigits[i] !== 0 || fullShifts[i] !== 0) end = i;
	}
	// Include zeros written by dropStream below the residual (show fall-to-0)
	const showEnd = Math.min(fullDigits.length - 1, end + 2);

	const digits = fullDigits.slice(0, showEnd + 1);
	/** @type {Record<number, number>} */
	const lane = {};
	for (let i = 0; i <= showEnd; i++) lane[i] = fullCarries[i];

	return {
		/** top→bottom residues (num%4), includes settled zeros at the end */
		digits,
		/** always 0 for explainer columns — place index = row index from top */
		off: 0,
		carries: lane,
		shifts: fullShifts.slice(0, showEnd + 1),
		kind
	};
}

/**
 * Digit-aligned staircase = explainer columns only.
 *
 * @param {number[]} startTopToBottom  base-4 residues top→bottom (or pass LSB-first
 *        and set opts.lsbFirst). Each step is deriveLeftInto (cascade left) which
 *        itself ends in dropStreamToZeroAt.
 * @param {number} steps
 * @param {number} [_widthCap]  unused; kept for call-site compatibility
 * @param {{ lsbFirst?: boolean }} [opts]
 */
export function runAligned(startTopToBottom, steps, _widthCap = 32, opts = {}) {
	let residues = (startTopToBottom?.length ? startTopToBottom : [0]).map((d) => d & 3);
	// Page historically passed LSB-first (string reversed). Explainer column is top-first.
	// If lsbFirst, reverse so index 0 is top of the column.
	if (opts.lsbFirst) residues = residues.slice().reverse();

	/** @type {ReturnType<typeof snapshotExplainerColumn>[]} */
	const rows = [];
	let stream = seedExplainerColumn(residues);
	rows.push(snapshotExplainerColumn(stream, 'seed+drop'));

	const maxSteps = Math.max(0, steps | 0);
	for (let j = 0; j < maxSteps; j++) {
		if (lastActiveIndex(stream) === 0 && stream[0].num === 0 && stream[0].nodeShift === 0) {
			break;
		}
		const left = emptyStream(stream.length);
		// deriveLeftInto: left.shift[i] = floor(num[i]/4), then dropStreamToZeroAt
		deriveLeftInto(stream, left);
		stream = left;
		rows.push(snapshotExplainerColumn(stream, 'left+drop'));
	}
	return rows;
}

/**
 * Walk one place-lane (column row index) down the staircase of explainer columns.
 * @param {ReturnType<typeof runAligned>} rows
 * @param {number} P  row index from top (0 = top of column)
 */
export function laneChainOf(rows, P) {
	/** @type {(number|null)[]} */
	const chain = [];
	/** @type {(number|null)[]} */
	const walk = [];
	for (const r of rows) {
		if (P >= 0 && P < r.digits.length) {
			walk.push(r.digits[P]);
		} else if (P >= r.digits.length) {
			// Below settled region — already fallen to 0
			walk.push(0);
		} else {
			walk.push(null);
		}
		if (r.carries) {
			chain.push(r.carries[P] !== undefined ? r.carries[P] : null);
		}
	}
	return { chain, walk };
}

/** @deprecated kept for any old imports — strips trailing zeros of an LSB array */
export function stripTrailingZeros4(digits) {
	let s = 0;
	while (digits.length > 1 && digits[0] === 0) {
		digits.shift();
		s++;
	}
	return s;
}

/** Expected alive counts (sanity / HUD). */
export const EXPECTED_ALIVE = {
	1: 1,
	2: 3,
	3: 8,
	4: 19,
	6: 226,
	8: 2114
};
