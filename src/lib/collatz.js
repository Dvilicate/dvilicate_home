/**
 * Interactive Collatz residue-grid engine.
 *
 * Grid model (from test2 + explainer 29.png):
 * - Columns = streams of cells (top → bottom).
 * - Each cell: nodeShift 0–2, num 0–11, shiftTotal (cumulative shift).
 * - Labels: 3² 2² 1² 0²  3¹ 2¹ 1¹ 0¹  3 2 1 0
 * - Wiring down a column: num = (prev.num % 4) * 3 + nodeShift
 * - Left neighbor:  left.shift[i]  = floor(current.num[i] / 4)
 * - Right neighbor: accumulated ternary residue (original realignRightStreams)
 *
 * Interaction: drag a cell → shift it → realign column → drop tail →
 * cascade into the next column → next → … to the end (animated).
 */

/** Index → residue base used by the wiring table. */
const INDEX_TO_NUM = [0, 3, 6, 9, 0, 3, 6, 9, 0, 3, 6, 9];

export const SLOT_LABELS = [
	'3²',
	'2²',
	'1²',
	'0²',
	'3¹',
	'2¹',
	'1¹',
	'0¹',
	'3',
	'2',
	'1',
	'0'
];

/**
 * @typedef {{ nodeShift: number, num: number, shiftTotal: number, id: number }} Cell
 * @typedef {Cell[]} Stream
 * @typedef {{
 *   kind: 'source' | 'column' | 'row',
 *   streamId: number,
 *   rowIndex?: number,
 *   streams: Stream[]
 * }} CascadeFrame
 */

let _id = 1;
function nextId() {
	return _id++;
}

/** @param {number} s */
export function clampShift(s) {
	const n = Number(s) || 0;
	if (n < 0) return 0;
	if (n > 2) return 2;
	return n | 0;
}

/** @returns {Cell} */
export function makeCell(shift = 0) {
	return {
		id: nextId(),
		nodeShift: clampShift(shift),
		num: 0,
		shiftTotal: 0
	};
}

/**
 * @param {number} rows
 * @returns {Stream}
 */
export function emptyStream(rows) {
	const cells = [];
	for (let i = 0; i < rows; i++) cells.push(makeCell(0));
	return cells;
}

/**
 * @param {number} cols
 * @param {number} rows
 * @returns {Stream[]}
 */
export function emptyGrid(cols, rows) {
	const streams = [];
	for (let c = 0; c < cols; c++) streams.push(emptyStream(rows));
	return streams;
}

/** Deep-clone streams (plain data, no reactivity). */
export function cloneStreams(streams) {
	return streams.map((col) =>
		col.map((cell) => ({
			id: cell.id,
			nodeShift: cell.nodeShift,
			num: cell.num,
			shiftTotal: cell.shiftTotal
		}))
	);
}

/**
 * Recompute num + shiftTotal down a column from nodeShift values.
 * @param {Stream} stream
 */
export function realignStream(stream) {
	let shiftTotal = 0;
	let lastNum = 0;
	for (let i = 0; i < stream.length; i++) {
		const shift = clampShift(stream[i].nodeShift);
		stream[i].nodeShift = shift;
		stream[i].shiftTotal = shift + shiftTotal;
		shiftTotal = stream[i].shiftTotal;
		const idx = ((lastNum % 12) + 12) % 12;
		stream[i].num = INDEX_TO_NUM[idx] + shift;
		lastNum = stream[i].num;
	}
	return stream;
}

/**
 * After the edited row, settle the trailing residue tail.
 * @param {Stream} stream
 * @param {number} nodeId
 */
export function dropStreamToZeroAt(stream, nodeId) {
	realignStream(stream);
	if (nodeId < 0 || nodeId >= stream.length) return nodeId;

	let trueNum = stream[nodeId].num % 4;
	let id = nodeId;

	if (id + 1 < stream.length) {
		if (trueNum === 3) {
			stream[id + 1].nodeShift = 1;
			id += 1;
			trueNum = 2;
		}
		if (id + 1 < stream.length) {
			stream[id + 1].nodeShift = trueNum;
		}
	}

	for (let x = id + 2; x < stream.length; x++) {
		stream[x].nodeShift = 0;
	}

	realignStream(stream);
	return id;
}

/**
 * Shift one cell; overflow carries upward (toward row 0), like test2.
 * @param {Stream} stream
 * @param {number} nodeIndex
 * @param {number} delta  +1 right / -1 left
 */
export function shiftStreamNode(stream, nodeIndex, delta) {
	if (!stream[nodeIndex] || delta === 0) return;

	let temp = stream[nodeIndex].nodeShift + delta;
	if (temp > 2) {
		if (nodeIndex > 0) {
			// Carry the overflow to the row above
			shiftStreamNode(stream, nodeIndex - 1, temp - stream[nodeIndex].nodeShift);
		}
		temp = 2;
	} else if (temp < 0) {
		if (nodeIndex > 0) {
			shiftStreamNode(stream, nodeIndex - 1, temp);
		}
		temp = 0;
	}
	stream[nodeIndex].nodeShift = temp;
}

/**
 * Apply a drag move on one cell of one column, then re-settle that column.
 * @param {Stream[]} streams
 * @param {number} streamId
 * @param {number} nodeIndex
 * @param {number} delta
 */
export function applyLocalMove(streams, streamId, nodeIndex, delta) {
	const stream = streams[streamId];
	if (!stream?.[nodeIndex] || delta === 0) return streams;
	shiftStreamNode(stream, nodeIndex, delta);
	realignStream(stream);
	dropStreamToZeroAt(stream, nodeIndex);
	return streams;
}

/**
 * Derive left column from current: left.shift[i] = floor(num[i] / 4).
 * Fixed: uses real nums, treats 0 as valid residue.
 * @param {Stream} current
 * @param {Stream} left  mutated in place
 * @returns {number} lastChange row
 */
export function deriveLeftInto(current, left) {
	let lastChange = 0;
	const n = Math.min(current.length, left.length);
	for (let i = 0; i < n; i++) {
		left[i].nodeShift = Math.floor(current[i].num / 4);
		if (current[i].nodeShift !== 0 || current[i].num !== 0) {
			lastChange = i;
		}
	}
	// Clear any extra rows
	for (let i = n; i < left.length; i++) left[i].nodeShift = 0;
	dropStreamToZeroAt(left, lastChange);
	return lastChange;
}

/**
 * Derive right column (original realignRightStreams idea).
 * @param {Stream} current
 * @param {Stream} right  mutated in place
 */
export function deriveRightInto(current, right) {
	let tempNum = 0;
	let lastChange = 0;
	const n = Math.min(current.length, right.length);
	for (let x = n - 1; x >= 0; x--) {
		right[x].nodeShift = tempNum % 3;
		tempNum += current[x].nodeShift;
		tempNum = tempNum % 3;
		if (current[x].num !== 0 || current[x].nodeShift !== 0) {
			lastChange = x;
		}
	}
	for (let i = n; i < right.length; i++) right[i].nodeShift = 0;
	realignStream(right);
	return lastChange;
}

/**
 * Divide out factors of 2 until the value is odd (0 stays 0).
 * @param {number} n
 * @returns {{ odd: number, twos: number, value: number }}
 */
export function splitOddEven(n) {
	let value = Math.abs(Math.floor(Number(n) || 0));
	if (value === 0) return { odd: 0, twos: 0, value: 0 };
	let odd = value;
	let twos = 0;
	while (odd % 2 === 0) {
		odd = odd / 2;
		twos += 1;
	}
	return { odd, twos, value };
}

/** @param {number} n */
export function oddPart(n) {
	return splitOddEven(n).odd;
}

/**
 * Parse a digit string for the given max digit (inclusive).
 * Invalid characters are dropped.
 * @param {string} str
 * @param {number} maxDigit
 * @returns {number[]}
 */
export function parseDigitString(str, maxDigit) {
	const out = [];
	const s = String(str ?? '');
	for (let i = 0; i < s.length; i++) {
		const ch = s[i];
		if (ch < '0' || ch > '9') continue;
		const d = ch.charCodeAt(0) - 48;
		if (d <= maxDigit) out.push(d);
	}
	return out;
}

/**
 * Snapshot base-3 value of a column's shifts (MSD top, trim trailing zeros).
 * @param {Stream} stream
 */
export function columnValue(stream) {
	const shifts = stream.map((c) => c.nodeShift);
	let end = 0;
	for (let i = shifts.length - 1; i >= 0; i--) {
		if (shifts[i] !== 0) {
			end = i;
			break;
		}
	}
	let v = 0;
	for (let i = 0; i <= end; i++) v = v * 3 + (shifts[i] || 0);
	return v;
}

/**
 * Column nodeShift digits: full span row 0..lastNonZero, plus display form
 * (no leading zeros) and the row offset where display digits begin.
 * @param {Stream} stream
 * @returns {{
 *   full: number[],
 *   display: number[],
 *   displayStr: string,
 *   lead: number,
 *   last: number,
 *   value: number
 * }}
 */
export function columnBase3Digits(stream) {
	const shifts = (stream ?? []).map((c) => clampShift(c?.nodeShift));
	let last = -1;
	for (let i = shifts.length - 1; i >= 0; i--) {
		if (shifts[i] !== 0) {
			last = i;
			break;
		}
	}
	if (last < 0) {
		return { full: [], display: [], displayStr: '', lead: 0, last: -1, value: 0 };
	}
	const full = shifts.slice(0, last + 1);
	let lead = 0;
	while (lead < full.length && full[lead] === 0) lead += 1;
	const display = full.slice(lead);
	let value = 0;
	for (let i = 0; i < full.length; i++) value = value * 3 + full[i];
	return {
		full,
		display,
		displayStr: display.join(''),
		lead,
		last,
		value
	};
}

/**
 * Apply a base-3 digit string to a column surgically.
 *
 * - `replace` (after a full clear, or empty column): write digits from row 0.
 * - `patch` (default): only change rows whose display digit changed, append, or
 *   clear the tail — does not re-seed the whole column from a new integer.
 *
 * @param {Stream} stream  mutated
 * @param {string|number[]} digitsOrStr
 * @param {{ replace?: boolean }} [opts]
 * @returns {{ changedRows: number[], mode: 'patch' | 'replace' | 'clear' }}
 */
export function applyColumnBase3Digits(stream, digitsOrStr, opts = {}) {
	const rows = stream?.length ?? 0;
	const newDigits = Array.isArray(digitsOrStr)
		? digitsOrStr.map((d) => clampShift(d))
		: parseDigitString(String(digitsOrStr), 2);

	const prev = columnBase3Digits(stream);
	/** @type {number[]} */
	const changedRows = [];

	const mark = (r) => {
		if (r >= 0 && r < rows && !changedRows.includes(r)) changedRows.push(r);
	};

	const setShift = (r, s) => {
		if (r < 0 || r >= rows) return;
		const next = clampShift(s);
		if (stream[r].nodeShift !== next) {
			stream[r].nodeShift = next;
			mark(r);
		}
	};

	// Clear
	if (newDigits.length === 0) {
		for (let r = 0; r < rows; r++) setShift(r, 0);
		realignStream(stream);
		return { changedRows, mode: 'clear' };
	}

	const replace = opts.replace === true || prev.display.length === 0;

	if (replace) {
		// Write new number from the top; zero the rest
		for (let r = 0; r < rows; r++) {
			setShift(r, r < newDigits.length ? newDigits[r] : 0);
		}
		realignStream(stream);
		return { changedRows, mode: 'replace' };
	}

	// Surgical patch against the display digit span (skip leading zero rows)
	const lead = prev.lead;
	const oldDisp = prev.display;
	const minLen = Math.min(oldDisp.length, newDigits.length);

	for (let i = 0; i < minLen; i++) {
		if (oldDisp[i] !== newDigits[i]) setShift(lead + i, newDigits[i]);
	}
	// Appended digits
	for (let i = minLen; i < newDigits.length; i++) {
		setShift(lead + i, newDigits[i]);
	}
	// Removed tail digits → zero those rows (and anything that was in the old span)
	for (let i = newDigits.length; i < oldDisp.length; i++) {
		setShift(lead + i, 0);
	}
	// Zero any residual below the previous last if we shortened past it
	const newLast = lead + newDigits.length - 1;
	for (let r = Math.max(newLast + 1, 0); r <= prev.last && r < rows; r++) {
		setShift(r, 0);
	}

	realignStream(stream);
	return { changedRows, mode: 'patch' };
}

/**
 * Base-4 reading of one grid row: digit at column c is `num % 4` (0–3).
 * Leftmost column is MSD. Digits are taken through the last non-zero digit
 * (trailing zeros dropped, same idea as columnValue).
 *
 * If the base-4 number ends in digit 2 (n ≡ 2 mod 4), the reported result is
 * value / 2.
 *
 * @param {Stream[]} streams
 * @param {number} rowIndex
 * @returns {{
 *   digits: number[],
 *   base4: string,
 *   value: number,
 *   result: number,
 *   halved: boolean,
 *   lastCol: number,
 *   lead: number,
 *   full: number[]
 * }}
 */
export function rowBase4Value(streams, rowIndex) {
	const cols = streams?.length ?? 0;
	/** @type {number[]} */
	const raw = [];
	for (let c = 0; c < cols; c++) {
		const num = streams[c]?.[rowIndex]?.num ?? 0;
		raw.push(((Number(num) % 4) + 4) % 4);
	}

	let end = -1;
	for (let i = raw.length - 1; i >= 0; i--) {
		if (raw[i] !== 0) {
			end = i;
			break;
		}
	}

	if (end < 0) {
		return {
			digits: [],
			base4: '',
			value: 0,
			result: 0,
			halved: false,
			lastCol: -1,
			lead: 0,
			full: []
		};
	}

	const full = raw.slice(0, end + 1);
	let value = 0;
	for (let i = 0; i < full.length; i++) value = value * 4 + full[i];

	const halved = full[full.length - 1] === 2;
	const result = halved ? value / 2 : value;

	let lead = 0;
	while (lead < full.length && full[lead] === 0) lead += 1;
	const digits = full.slice(lead);

	return {
		digits,
		base4: digits.join(''),
		value,
		result,
		halved,
		lastCol: end,
		lead,
		full
	};
}

/**
 * Choose nodeShift (0–2) so that after realign, cell.num % 4 is as close as
 * possible to `digit` (exact when the residue is reachable from the row above).
 * @param {Stream} stream
 * @param {number} rowIndex
 * @param {number} digit  0–3
 * @returns {{ shift: number, exact: boolean }}
 */
export function shiftForBase4Digit(stream, rowIndex, digit) {
	const d = ((Number(digit) % 4) + 4) % 4;
	// Ensure rows above are aligned so prev.num is trustworthy
	realignStream(stream);
	const prevNum = rowIndex > 0 ? stream[rowIndex - 1].num : 0;
	const base = INDEX_TO_NUM[((prevNum % 12) + 12) % 12];

	for (let s = 0; s <= 2; s++) {
		if ((base + s) % 4 === d) return { shift: s, exact: true };
	}

	// Unreachable with shift alone — pick closest residue
	let best = 0;
	let bestDist = 99;
	for (let s = 0; s <= 2; s++) {
		const got = (base + s) % 4;
		const dist = Math.min((got - d + 4) % 4, (d - got + 4) % 4);
		if (dist < bestDist) {
			bestDist = dist;
			best = s;
		}
	}
	return { shift: best, exact: false };
}

/**
 * Set one cell so its base-4 residue (num % 4) matches `digit` as closely as
 * possible. Only touches that row's nodeShift (+ realign of the column).
 * @param {Stream} stream
 * @param {number} rowIndex
 * @param {number} digit
 */
export function setCellBase4Digit(stream, rowIndex, digit) {
	if (!stream?.[rowIndex]) return { exact: true };
	const { shift, exact } = shiftForBase4Digit(stream, rowIndex, digit);
	if (stream[rowIndex].nodeShift !== shift) {
		stream[rowIndex].nodeShift = shift;
	}
	realignStream(stream);
	return { exact };
}

/**
 * Apply a base-4 digit string to one grid row surgically (per-column cells).
 *
 * Same patch/replace rules as {@link applyColumnBase3Digits}: in-place digit
 * edits, append, and tail-delete only touch the corresponding nodes; a full
 * clear then retype rewrites from column 0.
 *
 * @param {Stream[]} streams  mutated
 * @param {number} rowIndex
 * @param {string|number[]} digitsOrStr
 * @param {{ replace?: boolean }} [opts]
 * @returns {{ changedCols: number[], mode: 'patch' | 'replace' | 'clear' }}
 */
export function applyRowBase4Digits(streams, rowIndex, digitsOrStr, opts = {}) {
	const cols = streams?.length ?? 0;
	const newDigits = Array.isArray(digitsOrStr)
		? digitsOrStr.map((d) => ((Number(d) % 4) + 4) % 4)
		: parseDigitString(String(digitsOrStr), 3);

	const prev = rowBase4Value(streams, rowIndex);
	/** @type {number[]} */
	const changedCols = [];
	const mark = (c) => {
		if (c >= 0 && c < cols && !changedCols.includes(c)) changedCols.push(c);
	};

	const setDigit = (c, digit) => {
		if (c < 0 || c >= cols) return;
		setCellBase4Digit(streams[c], rowIndex, digit);
		mark(c);
	};

	const clearCell = (c) => {
		if (c < 0 || c >= cols || !streams[c][rowIndex]) return;
		if (streams[c][rowIndex].nodeShift !== 0) {
			streams[c][rowIndex].nodeShift = 0;
			realignStream(streams[c]);
			mark(c);
		} else {
			// Ensure realigned even if already 0
			realignStream(streams[c]);
		}
	};

	if (newDigits.length === 0) {
		for (let c = 0; c < cols; c++) clearCell(c);
		return { changedCols, mode: 'clear' };
	}

	const replace = opts.replace === true || prev.digits.length === 0;

	if (replace) {
		for (let c = 0; c < cols; c++) {
			if (c < newDigits.length) setDigit(c, newDigits[c]);
			else clearCell(c);
		}
		return { changedCols, mode: 'replace' };
	}

	const lead = prev.lead;
	const oldDisp = prev.digits;
	const minLen = Math.min(oldDisp.length, newDigits.length);

	for (let i = 0; i < minLen; i++) {
		if (oldDisp[i] !== newDigits[i]) setDigit(lead + i, newDigits[i]);
	}
	for (let i = minLen; i < newDigits.length; i++) {
		setDigit(lead + i, newDigits[i]);
	}
	for (let i = newDigits.length; i < oldDisp.length; i++) {
		clearCell(lead + i);
	}
	const newLast = lead + newDigits.length - 1;
	for (let c = Math.max(newLast + 1, 0); c <= prev.lastCol && c < cols; c++) {
		clearCell(c);
	}

	return { changedCols, mode: 'patch' };
}

/**
 * Instant left/right cascade from a source column (no animation frames).
 * @param {Stream[]} streams
 * @param {number} fromCol
 * @param {'left' | 'right' | 'both'} [direction]
 */
export function cascadeInstant(streams, fromCol, direction = 'left') {
	if (!streams?.length) return streams;
	const doLeft = direction === 'left' || direction === 'both';
	const doRight = direction === 'right' || direction === 'both';
	if (doLeft) {
		for (let c = fromCol; c > 0; c--) {
			deriveLeftInto(streams[c], streams[c - 1]);
		}
	}
	if (doRight) {
		for (let c = fromCol; c < streams.length - 1; c++) {
			deriveRightInto(streams[c], streams[c + 1]);
		}
	}
	return streams;
}

/**
 * Instant cascade after a row edit: ripple from each changed column.
 * @param {Stream[]} streams
 * @param {number[]} changedCols
 * @param {'left' | 'right' | 'both'} [direction]
 */
export function cascadeInstantFromCols(streams, changedCols, direction = 'left') {
	if (!changedCols?.length) return streams;
	const sorted = [...new Set(changedCols)].sort((a, b) => a - b);
	// One pass: leftmost change cascades left; rightmost cascades right; both cover middle
	if (direction === 'left' || direction === 'both') {
		const rightmost = sorted[sorted.length - 1];
		cascadeInstant(streams, rightmost, 'left');
	}
	if (direction === 'right' || direction === 'both') {
		const leftmost = sorted[0];
		cascadeInstant(streams, leftmost, 'right');
	}
	return streams;
}

/**
 * Base-4 row readings for every row of the grid.
 * @param {Stream[]} streams
 */
export function allRowBase4Values(streams) {
	const n = streams?.[0]?.length ?? 0;
	/** @type {ReturnType<typeof rowBase4Value>[]} */
	const out = [];
	for (let r = 0; r < n; r++) out.push(rowBase4Value(streams, r));
	return out;
}

/**
 * Seed the rightmost column from a decimal number (base-3 digits, leading 0),
 * then cascade left through every column. Instant (no animation frames).
 * @param {Stream[]} streams  left→right columns
 * @param {number} n
 */
export function seedNumberIntoGrid(streams, n) {
	if (!streams.length) return streams;
	const right = streams.length - 1;
	const rows = streams[right].length;
	const digits = toDigits(Math.max(0, Math.floor(Number(n) || 0)), 3);
	const typed = [0, ...digits];

	for (let i = 0; i < rows; i++) {
		const d = i < typed.length ? typed[i] : 0;
		streams[right][i].nodeShift = d < 3 ? d : 0;
	}
	const end = Math.min(typed.length - 1, rows - 1);
	dropStreamToZeroAt(streams[right], end);

	// Cascade left instantly
	for (let c = right; c > 0; c--) {
		deriveLeftInto(streams[c], streams[c - 1]);
	}
	return streams;
}

/**
 * Rows worth animating when revealing `full` from `prev`.
 *
 * - Skips a leading run of zeros that stay zero (nothing changing yet).
 * - Starts at the first row that changes — which includes writing a non-zero
 *   digit into a zero cell ("starts with a number not 0").
 * - Ends at the last changed row so trailing inert zeros are not stepped
 *   through; the cascade moves on to the next column instead.
 *
 * @param {Stream} prev
 * @param {Stream} full
 * @returns {{ first: number, last: number }} first/last inclusive; first=-1 if none
 */
export function interestingRowRange(prev, full) {
	const n = Math.max(prev?.length ?? 0, full?.length ?? 0);
	let first = -1;
	let last = -1;
	for (let r = 0; r < n; r++) {
		const prevShift = prev?.[r]?.nodeShift ?? 0;
		const nextShift = full?.[r]?.nodeShift ?? 0;
		const prevNum = prev?.[r]?.num ?? 0;
		const nextNum = full?.[r]?.num ?? 0;
		if (prevShift !== nextShift || prevNum !== nextNum) {
			if (first < 0) first = r;
			last = r;
		}
	}
	return { first, last };
}

/**
 * Copy shift/num/shiftTotal from `source` column into `target` column of `streams`.
 * @param {Stream[]} streams
 * @param {number} col
 * @param {Stream} source
 */
function copyColumnState(streams, col, source) {
	const dest = streams[col];
	const n = dest.length;
	for (let i = 0; i < n; i++) {
		const s = source[i];
		if (!s) {
			dest[i].nodeShift = 0;
			dest[i].num = 0;
			dest[i].shiftTotal = 0;
			continue;
		}
		dest[i].nodeShift = s.nodeShift;
		dest[i].num = s.num;
		dest[i].shiftTotal = s.shiftTotal;
	}
}

/**
 * Progressive by-row reveal of one cascade column.
 * Applies leading skipped rows instantly, emits frames only for interesting
 * rows, then commits the full column and returns (caller can push column frame).
 *
 * @param {Stream[]} streams  working grid (mutated)
 * @param {number} target  column index being revealed
 * @param {Stream} full  final derived column
 * @param {Stream} prev  column state from previous frame
 * @param {CascadeFrame[]} frames
 * @param {{ lastChange?: number, dropTail?: boolean }} [opts]
 */
function emitByRowColumnFrames(streams, target, full, prev, frames, opts = {}) {
	const dropTail = opts.dropTail ?? false;
	const lastChange = opts.lastChange ?? 0;
	const n = streams[target].length;

	// Start from previous visual state
	copyColumnState(streams, target, prev);

	const { first, last } = interestingRowRange(prev, full);

	if (first < 0) {
		// Nothing interesting — snap to full and one column frame
		for (let i = 0; i < n; i++) {
			streams[target][i].nodeShift = full[i]?.nodeShift ?? 0;
		}
		if (dropTail) dropStreamToZeroAt(streams[target], lastChange);
		else realignStream(streams[target]);
		frames.push({
			kind: 'column',
			streamId: target,
			streams: cloneStreams(streams)
		});
		return;
	}

	// Instantly apply leading rows (skipped zeros / unchanged prefix)
	for (let r = 0; r < first; r++) {
		streams[target][r].nodeShift = full[r]?.nodeShift ?? 0;
	}
	if (first > 0) realignStream(streams[target]);

	// Animate only first..last (stop before trailing inert zeros)
	for (let r = first; r <= last; r++) {
		streams[target][r].nodeShift = full[r]?.nodeShift ?? 0;
		realignStream(streams[target]);
		frames.push({
			kind: 'row',
			streamId: target,
			rowIndex: r,
			streams: cloneStreams(streams)
		});
	}

	// Commit full final column (including any trailing zeros)
	for (let i = 0; i < n; i++) {
		streams[target][i].nodeShift = full[i]?.nodeShift ?? 0;
	}
	if (dropTail) dropStreamToZeroAt(streams[target], lastChange);
	else realignStream(streams[target]);
	frames.push({
		kind: 'column',
		streamId: target,
		streams: cloneStreams(streams)
	});
}

/**
 * Build animation frames for cascading LEFT from streamId down to column 0.
 * Optionally emits one frame per row (top→bottom) inside each column.
 * Row animation skips leading zeros and trailing inert zeros.
 *
 * @param {Stream[]} streams  will be mutated; also cloned into frames
 * @param {number} fromStreamId  column that already holds the new state
 * @param {{ byRow?: boolean, alsoRight?: boolean }} [opts]
 * @returns {CascadeFrame[]}
 */
export function buildCascadeFrames(streams, fromStreamId, opts = {}) {
	const byRow = opts.byRow ?? false;
	const alsoRight = opts.alsoRight ?? false;
	/** @type {CascadeFrame[]} */
	const frames = [];

	frames.push({
		kind: 'source',
		streamId: fromStreamId,
		streams: cloneStreams(streams)
	});

	// Leftward cascade: fromStreamId-1, fromStreamId-2, …, 0
	for (let c = fromStreamId; c > 0; c--) {
		const target = c - 1;
		const lastChange = deriveLeftInto(streams[c], streams[target]);

		if (byRow) {
			const full = cloneStreams([streams[target]])[0];
			const prev = frames[frames.length - 1].streams[target];
			emitByRowColumnFrames(streams, target, full, prev, frames, {
				lastChange,
				dropTail: true
			});
		} else {
			frames.push({
				kind: 'column',
				streamId: target,
				streams: cloneStreams(streams)
			});
		}
	}

	if (alsoRight) {
		for (let c = fromStreamId; c < streams.length - 1; c++) {
			const target = c + 1;
			const lastChange = deriveRightInto(streams[c], streams[target]);
			if (byRow) {
				const full = cloneStreams([streams[target]])[0];
				const prev = frames[frames.length - 1].streams[target];
				emitByRowColumnFrames(streams, target, full, prev, frames, {
					lastChange,
					dropTail: false
				});
			} else {
				frames.push({
					kind: 'column',
					streamId: target,
					streams: cloneStreams(streams)
				});
			}
		}
	}

	return frames;
}

/**
 * Full move: apply local edit, then build cascade frames (mutating a working copy).
 * Returns frames; caller plays them and commits the final snapshot.
 *
 * @param {Stream[]} streams  current grid (not mutated)
 * @param {number} streamId
 * @param {number} nodeIndex
 * @param {number} delta
 * @param {{ byRow?: boolean, alsoRight?: boolean, direction?: 'left' | 'right' | 'both' }} [opts]
 * @returns {CascadeFrame[]}
 */
export function planMove(streams, streamId, nodeIndex, delta, opts = {}) {
	const working = cloneStreams(streams);
	// delta 0 = cascade-only replay from this column (no drag)
	if (delta !== 0) {
		applyLocalMove(working, streamId, nodeIndex, delta);
	} else if (working[streamId]) {
		realignStream(working[streamId]);
	}

	const direction = opts.direction ?? 'left';
	const doLeft = direction === 'left' || direction === 'both';
	const doRight = direction === 'right' || direction === 'both';

	/** @type {CascadeFrame[]} */
	const frames = [
		{
			kind: 'source',
			streamId,
			rowIndex: nodeIndex,
			streams: cloneStreams(working)
		}
	];

	if (doLeft) {
		const leftFrames = buildCascadeFrames(working, streamId, {
			byRow: opts.byRow,
			alsoRight: false
		});
		// drop duplicate source frame
		frames.push(...leftFrames.slice(1));
	}

	if (doRight) {
		// Right cascade from source column using the latest working state
		// (after left cascade if both were requested)
		const base = doLeft ? cloneStreams(frames[frames.length - 1].streams) : working;
		for (let c = streamId; c < base.length - 1; c++) {
			const target = c + 1;
			const lastChange = deriveRightInto(base[c], base[target]);
			if (opts.byRow) {
				const full = cloneStreams([base[target]])[0];
				const prevSnap = frames[frames.length - 1].streams[target];
				emitByRowColumnFrames(base, target, full, prevSnap, frames, {
					lastChange,
					dropTail: false
				});
			} else {
				frames.push({
					kind: 'column',
					streamId: target,
					streams: cloneStreams(base)
				});
			}
		}
	}

	return frames;
}

// ——— number helpers (still useful for seeding / sidebar) ———

/** @param {number} n */
export function collatzStep(n) {
	return n % 2 === 0 ? n / 2 : 3 * n + 1;
}

/** @param {number} n @param {number} [limit] */
export function collatzSequence(n, limit = 500) {
	const start = Math.max(1, Math.floor(Math.abs(Number(n)) || 1));
	const seq = [start];
	let cur = start;
	while (cur !== 1 && seq.length < limit) {
		cur = collatzStep(cur);
		seq.push(cur);
	}
	return seq;
}

/** @param {number} n @param {number} base */
export function toDigits(n, base) {
	n = Math.floor(Math.abs(Number(n)) || 0);
	if (n === 0) return [0];
	const digits = [];
	while (n > 0) {
		digits.push(n % base);
		n = Math.floor(n / base);
	}
	return digits.reverse();
}

/** @param {string|number} numStr @param {number} fromBase @param {number} toBase */
export function baseConvert(numStr, fromBase, toBase) {
	const s = String(numStr).trim();
	if (!s) return '0';
	const n = parseInt(s, fromBase);
	if (Number.isNaN(n)) return '—';
	return n.toString(toBase);
}

/** @param {number} n */
export function collatzSteps(n) {
	const seq = collatzSequence(n);
	return seq.map((value, i) => {
		const next = seq[i + 1];
		const even = value % 2 === 0;
		return {
			value,
			index: i,
			even,
			op: next === undefined ? 'done' : even ? '÷2' : '×3+1',
			next: next ?? null,
			base2: value.toString(2),
			base3: value.toString(3),
			base4: value.toString(4)
		};
	});
}
