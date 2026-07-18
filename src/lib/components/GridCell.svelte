<script>
	import { SLOT_LABELS } from '$lib/collatz.js';

	/**
	 * Interactive residue cell — drag left/right to change nodeShift.
	 * Visual slide follows shiftTotal (like the original Section.svelte).
	 */
	/** @type {{ nodeShift: number, num: number, shiftTotal: number, id?: number }} */
	export let cell;
	/** Flash when this cell is the active cascade target */
	export let active = false;
	/** Column is currently being updated by the cascade */
	export let columnActive = false;
	/** Disable drag while cascade is animating */
	export let locked = false;
	/** @type {(dir: 'left' | 'right') => void} */
	export let onMove = () => {};

	const width = 220;
	const height = 34;
	const nodeWidth = width / 12;
	const pixelsPerStep = 36;

	let startX = 0;
	let dragging = false;

	/** @param {number} index */
	function startPoint(index) {
		return index * nodeWidth + nodeWidth / 2;
	}

	/** @param {number} index */
	function endPoint(index) {
		return ((index % 4) * 3 + 2) * nodeWidth + nodeWidth / 2;
	}

	$: activeIndex = 11 - (cell?.num ?? 0);
	$: carry = Math.floor((cell?.num ?? 0) / 4);
	$: shift = cell?.nodeShift ?? 0;
	$: slide = ((cell?.shiftTotal ?? 0) * width) / 12;
	$: wrapPull = Math.floor((cell?.shiftTotal ?? 0) / 12) * -width;

	/** @param {MouseEvent | TouchEvent} event */
	function pointerDown(event) {
		if (locked) return;
		dragging = true;
		startX = 'touches' in event ? event.touches[0].clientX : event.clientX;
		window.addEventListener('mousemove', pointerMove);
		window.addEventListener('mouseup', pointerUp);
		window.addEventListener('touchmove', pointerMove, { passive: false });
		window.addEventListener('touchend', pointerUp);
	}

	/** @param {MouseEvent | TouchEvent} event */
	function pointerMove(event) {
		if (!dragging) return;
		if ('touches' in event) event.preventDefault();
		const x = 'touches' in event ? event.touches[0].clientX : event.clientX;
		const delta = x - startX;
		if (delta > pixelsPerStep) {
			startX += pixelsPerStep;
			onMove('right');
		} else if (delta < -pixelsPerStep) {
			startX -= pixelsPerStep;
			onMove('left');
		}
	}

	function pointerUp() {
		dragging = false;
		window.removeEventListener('mousemove', pointerMove);
		window.removeEventListener('mouseup', pointerUp);
		window.removeEventListener('touchmove', pointerMove);
		window.removeEventListener('touchend', pointerUp);
	}
</script>

<div
	class="cell-wrap"
	class:active
	class:column-active={columnActive}
	class:locked
	style="margin-left: {wrapPull}px;"
>
	<div
		class="cell"
		style="transform: translateX({slide}px);"
		role="button"
		tabindex="0"
		title="Drag ← → to shift  |  shift={shift}  num={cell?.num ?? 0}  carry={carry}"
		onmousedown={pointerDown}
		ontouchstart={(e) => {
			e.preventDefault();
			pointerDown(e);
		}}
		onkeydown={(e) => {
			if (locked) return;
			if (e.key === 'ArrowLeft') {
				e.preventDefault();
				onMove('left');
			}
			if (e.key === 'ArrowRight') {
				e.preventDefault();
				onMove('right');
			}
		}}
	>
		<div class="labels">
			{#each SLOT_LABELS as label, index}
				<span class:circle={activeIndex === index}>{label}</span>
			{/each}
		</div>

		<svg {width} height={height} viewBox="0 0 {width} {height}" aria-hidden="true">
			{#each SLOT_LABELS as _, index}
				<line
					x1={startPoint(index)}
					y1="0"
					x2={endPoint(index)}
					y2={height}
					class={activeIndex === index ? 'wire-active' : 'wire'}
				/>
			{/each}
			<circle cx={startPoint(activeIndex)} cy="2" r="3" class="dot" />
			<circle cx={endPoint(activeIndex)} cy={height - 2} r="3" class="dot" />
		</svg>

		{#if shift > 0}
			<div class="shift-tag">|{shift}{'>'.repeat(shift)}</div>
		{/if}
		{#if carry > 0}
			<div class="carry-tag">{'<' .repeat(carry)}{carry}</div>
		{/if}

		<div class="nudge">
			<button
				type="button"
				class="nudge-btn"
				disabled={locked}
				onclick={(e) => {
					e.stopPropagation();
					onMove('left');
				}}
				aria-label="Shift left"
			>
				‹
			</button>
			<button
				type="button"
				class="nudge-btn"
				disabled={locked}
				onclick={(e) => {
					e.stopPropagation();
					onMove('right');
				}}
				aria-label="Shift right"
			>
				›
			</button>
		</div>
	</div>
</div>

<style>
	.cell-wrap {
		position: relative;
		width: 220px;
		transition: filter 0.15s ease;
	}

	.cell-wrap.active {
		filter: drop-shadow(0 0 8px #fbbf24cc);
		z-index: 3;
	}

	.cell-wrap.column-active .cell {
		outline-color: #38bdf8;
	}

	.cell-wrap.locked .cell {
		cursor: wait;
	}

	.cell {
		position: relative;
		width: 220px;
		background: #4a4a4a;
		border: 1px solid #2a2a2a;
		outline: 2px solid transparent;
		box-sizing: border-box;
		user-select: none;
		cursor: grab;
		transition: transform 0.22s ease, outline-color 0.2s ease, background 0.2s ease;
	}

	.cell:active {
		cursor: grabbing;
	}

	.cell-wrap.active .cell {
		background: #5c4e32;
		outline-color: #fbbf24;
	}

	.labels {
		display: flex;
		width: 100%;
		font-size: 10px;
		line-height: 1.35;
		color: #ddd;
		font-variant-numeric: tabular-nums;
	}

	.labels span {
		flex: 1;
		text-align: center;
		box-sizing: border-box;
		padding: 1px 0;
	}

	.labels span.circle {
		border: 2px solid #ef4444;
		border-radius: 5px;
		font-weight: 700;
		color: #fff;
		background: #3f1f1f;
	}

	svg {
		display: block;
		width: 100%;
		height: auto;
	}

	.wire {
		stroke: #1a1a1a;
		stroke-width: 1.1;
	}

	.wire-active {
		stroke: #ef4444;
		stroke-width: 2.4;
	}

	.dot {
		fill: #ef4444;
	}

	.shift-tag {
		position: absolute;
		bottom: 3px;
		left: 5px;
		font-size: 14px;
		font-weight: 800;
		color: #7cff4a;
		text-shadow: 0 1px 2px #000;
		pointer-events: none;
	}

	.carry-tag {
		position: absolute;
		bottom: 3px;
		right: 5px;
		font-size: 14px;
		font-weight: 800;
		color: #6b9b78;
		text-shadow: 0 1px 2px #000;
		pointer-events: none;
	}

	.nudge {
		position: absolute;
		top: 2px;
		right: 2px;
		display: flex;
		gap: 1px;
		opacity: 0;
		transition: opacity 0.15s;
	}

	.cell:hover .nudge,
	.cell:focus-within .nudge {
		opacity: 1;
	}

	.nudge-btn {
		width: 20px;
		height: 20px;
		padding: 0;
		border: none;
		border-radius: 4px;
		background: #111a;
		color: #fff;
		font-size: 14px;
		line-height: 1;
		cursor: pointer;
	}

	.nudge-btn:hover:not(:disabled) {
		background: #38bdf8;
		color: #0f172a;
	}

	.nudge-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}
</style>
