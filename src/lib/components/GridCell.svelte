<script>
	import { SLOT_LABELS } from '$lib/collatz.js';

	/**
	 * Rotating cylinder section (explainer / original Section.svelte behavior).
	 *
	 * - Wire mesh uses startPoint → endPoint map to the respective numbers.
	 * - The whole section translates with shiftTotal (one slot per unit), wrapped
	 *   so it stays in the column — feels like a drum rotating, not static labels.
	 * - Drag adds a live rotateY (around the vertical axis) + partial slide;
	 *   on each notch the drum steps and the tilt springs back.
	 */
	/** @type {{ nodeShift: number, num: number, shiftTotal: number, id?: number }} */
	export let cell;
	export let active = false;
	export let columnActive = false;
	export let locked = false;
	/** @type {(dir: 'left' | 'right') => void} */
	export let onMove = () => {};

	const N = 12;
	const width = 240;
	const wireH = 48;
	const nodeWidth = width / N;
	const pixelsPerStep = 32;

	let startX = 0;
	let dragging = false;
	/** Live drag slide (px), cleared on step / release */
	let dragSlide = 0;
	/** Live tilt around Y (deg) while dragging */
	let dragRotY = 0;

	$: num = cell?.num ?? 0;
	$: shift = cell?.nodeShift ?? 0;
	$: shiftTotal = cell?.shiftTotal ?? 0;
	$: carry = Math.floor(num / 4);
	$: base = num - shift;
	$: options = [0, 1, 2].map((s) => {
		const n = base + s;
		const index = ((11 - n) % N + N) % N;
		return { shift: s, num: n, index, selected: s === shift };
	});
	$: activeIndex = ((11 - num) % N + N) % N;
	$: optionIndexSet = new Set(options.map((o) => o.index));

	/**
	 * Settled drum position from shiftTotal — same idea as Section.svelte:
	 *   translateX(shiftTotal * width/12) + wrap every full turn by -width.
	 * Net: (shiftTotal mod 12) slots, always inside the housing.
	 */
	$: settledSlide = (() => {
		const raw = shiftTotal * nodeWidth;
		const wraps = Math.floor(shiftTotal / N);
		return raw - wraps * width;
	})();

	$: transformX = settledSlide + dragSlide;
	$: transformY = dragRotY;

	function startPoint(index) {
		return index * nodeWidth + nodeWidth / 2;
	}

	function endPoint(index) {
		return ((index % 4) * 3 + 2) * nodeWidth + nodeWidth / 2;
	}

	/** @param {MouseEvent | TouchEvent} event */
	function pointerDown(event) {
		if (locked) return;
		if (event.target instanceof Element && event.target.closest('.opt-hit, .nudge-btn')) {
			return;
		}
		dragging = true;
		dragSlide = 0;
		dragRotY = 0;
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

		// Cylinder feel: slide with the finger + tilt around Y
		dragSlide = Math.max(-nodeWidth * 1.1, Math.min(nodeWidth * 1.1, delta * 0.55));
		dragRotY = Math.max(-22, Math.min(22, delta * 0.12));

		if (delta > pixelsPerStep) {
			startX += pixelsPerStep;
			dragSlide = 0;
			// keep a brief residual tilt then ease (CSS transition handles release)
			dragRotY = 10;
			onMove('right');
			// snap tilt back after the step
			requestAnimationFrame(() => {
				if (dragging) dragRotY = Math.max(-8, Math.min(8, dragRotY * 0.3));
			});
		} else if (delta < -pixelsPerStep) {
			startX -= pixelsPerStep;
			dragSlide = 0;
			dragRotY = -10;
			onMove('left');
			requestAnimationFrame(() => {
				if (dragging) dragRotY = Math.max(-8, Math.min(8, dragRotY * 0.3));
			});
		}
	}

	function pointerUp() {
		dragging = false;
		dragSlide = 0;
		dragRotY = 0;
		window.removeEventListener('mousemove', pointerMove);
		window.removeEventListener('mouseup', pointerUp);
		window.removeEventListener('touchmove', pointerMove);
		window.removeEventListener('touchend', pointerUp);
	}

	function pickOption(s, e) {
		e.stopPropagation();
		if (locked) return;
		const cur = shift;
		if (s === cur) return;
		// Small kick of rotation so a click still “turns” the drum
		dragRotY = s > cur ? 12 : -12;
		onMove(s > cur ? 'right' : 'left');
		setTimeout(() => {
			if (!dragging) dragRotY = 0;
		}, 180);
	}
</script>

<div
	class="cell-wrap"
	class:active
	class:column-active={columnActive}
	class:locked
>
	<div
		class="housing"
		role="button"
		tabindex="0"
		title="Rotate cylinder ← →  |  shift={shift}  total={shiftTotal}  num={num}  carry={carry}"
		aria-label="Cylinder section residue {SLOT_LABELS[activeIndex]}, shift {shift}. Drag to rotate."
		onmousedown={pointerDown}
		ontouchstart={(e) => {
			if (e.target instanceof Element && e.target.closest('.opt-hit, .nudge-btn')) return;
			e.preventDefault();
			pointerDown(e);
		}}
		onkeydown={(e) => {
			if (locked) return;
			if (e.key === 'ArrowLeft') {
				e.preventDefault();
				dragRotY = -12;
				onMove('left');
				setTimeout(() => {
					if (!dragging) dragRotY = 0;
				}, 180);
			}
			if (e.key === 'ArrowRight') {
				e.preventDefault();
				dragRotY = 12;
				onMove('right');
				setTimeout(() => {
					if (!dragging) dragRotY = 0;
				}, 180);
			}
			if (e.key === '1' || e.key === '2' || e.key === '3') {
				e.preventDefault();
				pickOption(Number(e.key) - 1, e);
			}
		}}
	>
		<!-- Perspective stage: section rotates around Y like a cylinder face -->
		<div class="stage">
			<div
				class="cylinder"
				class:dragging
				style="transform: translate3d({transformX}px, 0, 0) rotateY({transformY}deg);"
			>
				<!--
				  Neighbor copies so the drum can wrap without empty gaps.
				  Option highlights MUST be on every copy — when the section
				  wraps, the visible face is often copy ±1, not the main strip.
				-->
				{#each [-1, 0, 1] as copy}
					<div
						class="strip"
						class:main={copy === 0}
						style="transform: translateX({copy * width}px);"
						aria-hidden={copy !== 0 ? 'true' : undefined}
					>
						<div class="labels">
							{#each SLOT_LABELS as label, index}
								{@const opt = options.find((o) => o.index === index)}
								<span
									class:circle={index === activeIndex}
									class:option={opt && !opt.selected}
									class:option-sel={opt && opt.selected}
								>
									{label}
								</span>
							{/each}
						</div>

						<svg {width} height={wireH} viewBox="0 0 {width} {wireH}">
							{#each SLOT_LABELS as _, index}
								{@const isOpt = optionIndexSet.has(index)}
								{#if !isOpt}
									<line
										x1={startPoint(index)}
										y1="0"
										x2={endPoint(index)}
										y2={wireH}
										class="mesh"
									/>
								{/if}
							{/each}
							{#each options as opt}
								<line
									x1={startPoint(opt.index)}
									y1="0"
									x2={endPoint(opt.index)}
									y2={wireH}
									class={opt.selected ? 'link-active' : 'link-option'}
								/>
								<circle
									cx={startPoint(opt.index)}
									cy="3"
									r={opt.selected ? 3.5 : 2.5}
									class={opt.selected ? 'dot-active' : 'dot-option'}
								/>
								<circle
									cx={endPoint(opt.index)}
									cy={wireH - 3}
									r={opt.selected ? 3.5 : 2.5}
									class={opt.selected ? 'dot-active' : 'dot-option'}
								/>
							{/each}
						</svg>
					</div>
				{/each}
			</div>
		</div>

		<!-- Side shading sells the cylinder / depth -->
		<div class="shade left" aria-hidden="true"></div>
		<div class="shade right" aria-hidden="true"></div>

		<!--
		  Hit targets on main + wrap copies so options stay clickable
		  after the drum wraps (same ±1 neighbors as the strips).
		-->
		<div class="option-hits" style="height: {wireH}px;">
			{#each [-1, 0, 1] as copy}
				{#each options as opt}
					<button
						type="button"
						class="opt-hit"
						class:sel={opt.selected}
						style="left: {settledSlide + copy * width + opt.index * nodeWidth}px; width: {nodeWidth}px;"
						disabled={locked}
						tabindex={copy === 0 ? 0 : -1}
						title="Rotate to shift {opt.shift}"
						aria-label="Rotate to shift {opt.shift}"
						onclick={(e) => pickOption(opt.shift, e)}
					></button>
				{/each}
			{/each}
		</div>

		{#if shift > 0}
			<div class="shift-tag">|{shift}{'>'.repeat(shift)}</div>
		{/if}
		{#if carry > 0}
			<div class="carry-tag">{'<' .repeat(Math.min(carry, 3))}{carry}</div>
		{/if}

		<div class="nudge">
			<button
				type="button"
				class="nudge-btn"
				disabled={locked}
				onclick={(e) => {
					e.stopPropagation();
					dragRotY = -12;
					onMove('left');
					setTimeout(() => {
						if (!dragging) dragRotY = 0;
					}, 180);
				}}
				aria-label="Rotate left"
			>
				‹
			</button>
			<button
				type="button"
				class="nudge-btn"
				disabled={locked}
				onclick={(e) => {
					e.stopPropagation();
					dragRotY = 12;
					onMove('right');
					setTimeout(() => {
						if (!dragging) dragRotY = 0;
					}, 180);
				}}
				aria-label="Rotate right"
			>
				›
			</button>
		</div>
	</div>
</div>

<style>
	.cell-wrap {
		position: relative;
		width: 240px;
		flex-shrink: 0;
		transition: filter 0.15s ease;
	}

	.cell-wrap.active {
		filter: drop-shadow(0 0 8px #fbbf24cc);
		z-index: 3;
	}

	.cell-wrap.column-active .housing {
		outline-color: #38bdf8;
	}

	.cell-wrap.locked .housing {
		cursor: wait;
	}

	.housing {
		position: relative;
		width: 240px;
		box-sizing: border-box;
		background: #4a4a4a;
		border: 1px solid #2a2a2a;
		outline: 2px solid transparent;
		border-radius: 4px;
		overflow: hidden; /* drum never leaves the column */
		user-select: none;
		cursor: grab;
		transition:
			outline-color 0.2s ease,
			background 0.2s ease;
	}

	.housing:active {
		cursor: grabbing;
	}

	.cell-wrap.active .housing {
		background: #5c4e32;
		outline-color: #fbbf24;
	}

	.stage {
		position: relative;
		width: 100%;
		height: 68px;
		perspective: 520px;
		perspective-origin: 50% 50%;
		overflow: hidden;
		transform-style: preserve-3d;
	}

	.cylinder {
		position: absolute;
		top: 0;
		left: 0;
		height: 100%;
		width: 100%;
		transform-style: preserve-3d;
		transform-origin: 50% 50%;
		/* Smooth step when shiftTotal changes; no transition mid-drag */
		transition:
			transform 0.22s cubic-bezier(0.22, 0.8, 0.3, 1);
		will-change: transform;
	}

	.cylinder.dragging {
		transition: none;
	}

	.strip {
		position: absolute;
		top: 0;
		left: 0;
		width: 240px;
		box-sizing: border-box;
		background: linear-gradient(180deg, #555 0%, #4a4a4a 40%, #404040 100%);
		backface-visibility: hidden;
	}

	.cell-wrap.active .strip {
		background: linear-gradient(180deg, #6a5840 0%, #5c4e32 45%, #4a3c28 100%);
	}

	.labels {
		display: flex;
		width: 100%;
		height: 18px;
		font-size: 10px;
		line-height: 16px;
		color: #ddd;
		font-variant-numeric: tabular-nums;
	}

	.labels span {
		flex: 1;
		text-align: center;
		box-sizing: border-box;
		border-radius: 4px;
	}

	.labels span.circle,
	.labels span.option-sel {
		border: 2px solid #ef4444;
		border-radius: 5px;
		font-weight: 700;
		color: #fff;
		background: #3f1f1f;
		line-height: 12px;
	}

	.labels span.option {
		border: 1px dashed #7cff4a88;
		color: #b6f5a0;
		background: #1a2e14;
		line-height: 14px;
	}

	svg {
		display: block;
		width: 100%;
		height: auto;
	}

	.mesh {
		stroke: #1a1a1a;
		stroke-width: 1.1;
	}

	.link-option {
		stroke: #7cff4a;
		stroke-width: 2;
		stroke-dasharray: 4 3;
		opacity: 0.85;
	}

	.link-active {
		stroke: #ef4444;
		stroke-width: 2.8;
	}

	.dot-option {
		fill: #7cff4a;
	}

	.dot-active {
		fill: #ef4444;
	}

	/* Cylinder edge shading (depth cue) */
	.shade {
		position: absolute;
		top: 0;
		bottom: 0;
		width: 14%;
		z-index: 2;
		pointer-events: none;
	}

	.shade.left {
		left: 0;
		background: linear-gradient(90deg, #00000066 0%, transparent 100%);
	}

	.shade.right {
		right: 0;
		background: linear-gradient(270deg, #00000066 0%, transparent 100%);
	}

	.option-hits {
		position: absolute;
		left: 0;
		right: 0;
		top: 18px;
		pointer-events: none;
		z-index: 3;
		/* hits track the settled drum; no live drag so they stay clickable */
	}

	.opt-hit {
		position: absolute;
		top: 0;
		bottom: 0;
		padding: 0;
		border: none;
		background: transparent;
		cursor: pointer;
		pointer-events: auto;
	}

	.opt-hit:hover:not(:disabled) {
		background: #7cff4a18;
	}

	.opt-hit.sel:hover:not(:disabled) {
		background: #ef444422;
	}

	.shift-tag {
		position: absolute;
		bottom: 3px;
		left: 5px;
		z-index: 4;
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
		z-index: 4;
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
		z-index: 5;
	}

	.housing:hover .nudge,
	.housing:focus-within .nudge {
		opacity: 1;
	}

	.nudge-btn {
		width: 18px;
		height: 18px;
		padding: 0;
		border: none;
		border-radius: 4px;
		background: #111a;
		color: #fff;
		font-size: 13px;
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
