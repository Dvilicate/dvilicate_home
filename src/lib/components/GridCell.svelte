<script>
	import { SLOT_LABELS } from '$lib/collatz.js';

	/**
	 * Rotating cylinder section.
	 *
	 * Performance: most cells render as a cheap "lite" face (a few DOM nodes).
	 * Full drum mounts when forceExpanded (global toggle / column hover), or
	 * this cell is focused / cascade-active / dragged — critical at 30×35 grids.
	 */
	/** @type {{ nodeShift: number, num: number, shiftTotal: number, id?: number }} */
	export let cell;
	export let active = false;
	export let columnActive = false;
	export let locked = false;
	/**
	 * Leading zeros (above first non-zero) and trailing zeros (below last
	 * non-zero / stop) — still usable, just quieter to cut visual noise.
	 */
	export let dimmed = false;
	/**
	 * Force full cylinder (wires + options). Set by parent for "show all
	 * connections", column hover, or the column currently animating.
	 */
	export let forceExpanded = false;
	/** @type {(dir: 'left' | 'right') => void} */
	export let onMove = () => {};

	const N = 12;
	const width = 240;
	const wireH = 48;
	const nodeWidth = width / N;
	const pixelsPerStep = 32;

	/** Static mesh geometry (shared, never reactive). */
	const MESH_LINES = Array.from({ length: N }, (_, index) => {
		const x1 = index * nodeWidth + nodeWidth / 2;
		const x2 = ((index % 4) * 3 + 2) * nodeWidth + nodeWidth / 2;
		return { x1, x2 };
	});

	let startX = 0;
	let dragging = false;
	/** Live drag slide (px), cleared on step / release */
	let dragSlide = 0;
	/** Live tilt around Y (deg) while dragging */
	let dragRotY = 0;
	/** Expand full cylinder UI */
	let hovering = false;
	let focused = false;

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
	$: label = SLOT_LABELS[activeIndex] ?? '?';

	/**
	 * Settled drum position from shiftTotal — same idea as Section.svelte:
	 *   translateX(shiftTotal * width/12) + wrap every full turn by -width.
	 */
	$: settledSlide = (() => {
		const raw = shiftTotal * nodeWidth;
		const wraps = Math.floor(shiftTotal / N);
		return raw - wraps * width;
	})();

	$: transformX = settledSlide + dragSlide;
	$: transformY = dragRotY;

	/** Full UI: global/column force, or this cell is interacting / hot */
	$: expanded = forceExpanded || active || hovering || focused || dragging;

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
		hovering = true;
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

		dragSlide = Math.max(-nodeWidth * 1.1, Math.min(nodeWidth * 1.1, delta * 0.55));
		dragRotY = Math.max(-22, Math.min(22, delta * 0.12));

		if (delta > pixelsPerStep) {
			startX += pixelsPerStep;
			dragSlide = 0;
			dragRotY = 10;
			onMove('right');
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
		dragRotY = s > cur ? 12 : -12;
		onMove(s > cur ? 'right' : 'left');
		setTimeout(() => {
			if (!dragging) dragRotY = 0;
		}, 180);
	}

	/** @param {KeyboardEvent} e */
	function onKey(e) {
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
	}

	function nudge(dir, e) {
		e.stopPropagation();
		if (locked) return;
		dragRotY = dir === 'left' ? -12 : 12;
		onMove(dir);
		setTimeout(() => {
			if (!dragging) dragRotY = 0;
		}, 180);
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="cell-wrap"
	class:active
	class:column-active={columnActive}
	class:locked
	class:dimmed
	class:expanded
	class:lite={!expanded}
	onmouseenter={() => (hovering = true)}
	onmouseleave={() => {
		if (!dragging) hovering = false;
	}}
	onfocusin={() => (focused = true)}
	onfocusout={(e) => {
		const next = e.relatedTarget;
		if (next instanceof Node && e.currentTarget.contains(next)) return;
		focused = false;
	}}
>
	{#if expanded}
		<div
			class="housing"
			role="button"
			tabindex="0"
			title="Rotate cylinder ← →  |  shift={shift}  total={shiftTotal}  num={num}  carry={carry}"
			aria-label="Cylinder section residue {label}, shift {shift}. Drag to rotate."
			onmousedown={pointerDown}
			ontouchstart={(e) => {
				if (e.target instanceof Element && e.target.closest('.opt-hit, .nudge-btn')) return;
				e.preventDefault();
				pointerDown(e);
			}}
			onkeydown={onKey}
		>
			<div class="stage">
				<div
					class="cylinder"
					class:dragging
					style="transform: translate3d({transformX}px, 0, 0) rotateY({transformY}deg);"
				>
					{#each [-1, 0, 1] as copy}
						<div
							class="strip"
							class:main={copy === 0}
							style="transform: translateX({copy * width}px);"
							aria-hidden={copy !== 0 ? 'true' : undefined}
						>
							<div class="labels">
								{#each SLOT_LABELS as slotLabel, index}
									{@const isOpt = optionIndexSet.has(index)}
									{@const selected = isOpt && index === activeIndex}
									<span
										class:circle={index === activeIndex}
										class:option={isOpt && !selected}
										class:option-sel={selected}
									>
										{slotLabel}
									</span>
								{/each}
							</div>

							<svg {width} height={wireH} viewBox="0 0 {width} {wireH}">
								{#each MESH_LINES as line, index}
									{#if !optionIndexSet.has(index)}
										<line
											x1={line.x1}
											y1="0"
											x2={line.x2}
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

			<div class="shade left" aria-hidden="true"></div>
			<div class="shade right" aria-hidden="true"></div>

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
					onclick={(e) => nudge('left', e)}
					aria-label="Rotate left"
				>
					‹
				</button>
				<button
					type="button"
					class="nudge-btn"
					disabled={locked}
					onclick={(e) => nudge('right', e)}
					aria-label="Rotate right"
				>
					›
				</button>
			</div>
		</div>
	{:else}
		<!-- Cheap stub: ~5 DOM nodes instead of ~100 -->
		<div
			class="housing lite-housing"
			role="button"
			tabindex="0"
			title="Shift {shift} · num {num} · click / hover for full cylinder"
			aria-label="Residue {label}, shift {shift}. Activate for full controls."
			onmousedown={pointerDown}
			ontouchstart={(e) => {
				e.preventDefault();
				pointerDown(e);
			}}
			onkeydown={onKey}
		>
			<span class="lite-label">{label}</span>
			{#if shift > 0}
				<span class="shift-tag lite-tag">|{shift}{'>'.repeat(shift)}</span>
			{/if}
			{#if carry > 0}
				<span class="carry-tag lite-tag">{'<' .repeat(Math.min(carry, 3))}{carry}</span>
			{/if}
			<span class="lite-hint" aria-hidden="true">‹ ›</span>
		</div>
	{/if}
</div>

<style>
	/*
	  Fixed outer box (240×70). Lite ↔ full must never change layout size —
	  hover remounts inner UI but the slot footprint stays put.
	*/
	.cell-wrap {
		position: relative;
		width: 240px;
		height: 70px;
		box-sizing: border-box;
		flex-shrink: 0;
		overflow: hidden;
		/* Skip paint/layout work for off-screen cells in the scrollport */
		content-visibility: auto;
		contain-intrinsic-size: 240px 70px;
		contain: layout style size;
		transition: opacity 0.12s ease;
	}

	/* Expanded cells must not use content-visibility — remount + CV jumps layout */
	.cell-wrap.expanded {
		content-visibility: visible;
	}

	/* Opacity-only dim (CSS filter is very expensive at scale) */
	.cell-wrap.dimmed {
		opacity: 0.22;
	}

	.cell-wrap.dimmed:hover,
	.cell-wrap.dimmed:focus-within,
	.cell-wrap.dimmed.expanded {
		opacity: 0.75;
	}

	.cell-wrap.dimmed.active,
	.cell-wrap.dimmed.column-active:not(.active) {
		opacity: 1;
	}

	.cell-wrap.active {
		opacity: 1;
		z-index: 3;
		/* shadow outside the box — does not affect layout */
		box-shadow: 0 0 10px #fbbf24aa;
		border-radius: 4px;
	}

	.cell-wrap.column-active .housing {
		outline-color: #38bdf8;
	}

	.cell-wrap.locked .housing {
		cursor: wait;
	}

	.housing {
		position: relative;
		width: 100%;
		height: 100%;
		box-sizing: border-box;
		background: #4a4a4a;
		border: 1px solid #2a2a2a;
		outline: 2px solid transparent;
		outline-offset: -2px; /* keep outline inside so it never grows the slot */
		border-radius: 4px;
		overflow: hidden;
		user-select: none;
		cursor: grab;
		transition: outline-color 0.15s ease, background 0.15s ease;
	}

	.housing:active {
		cursor: grabbing;
	}

	.cell-wrap.active .housing {
		background: #5c4e32;
		outline-color: #fbbf24;
	}

	/* ——— Lite stub ——— */
	.lite-housing {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		padding: 0 8px;
		background: linear-gradient(180deg, #555 0%, #4a4a4a 40%, #404040 100%);
	}

	.cell-wrap.active .lite-housing {
		background: linear-gradient(180deg, #6a5840 0%, #5c4e32 45%, #4a3c28 100%);
	}

	.lite-label {
		font-size: 15px;
		font-weight: 700;
		color: #f1f5f9;
		font-variant-numeric: tabular-nums;
		border: 2px solid #ef4444;
		border-radius: 5px;
		padding: 1px 6px;
		background: #3f1f1f;
		line-height: 1.2;
	}

	.lite-hint {
		position: absolute;
		top: 3px;
		right: 5px;
		font-size: 11px;
		color: #888;
		opacity: 0;
		transition: opacity 0.12s;
		pointer-events: none;
	}

	.lite-housing:hover .lite-hint,
	.lite-housing:focus-visible .lite-hint {
		opacity: 0.85;
	}

	.lite-tag {
		position: static;
		font-size: 12px;
		text-shadow: none;
	}

	/* ——— Full cylinder ——— */
	.stage {
		position: relative;
		width: 100%;
		/* Fill housing content box (70 outer − 2×1px border) */
		height: 100%;
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
		/*
		  No CSS transition on translateX. Cascade/realign can change
		  shiftTotal across a wrap boundary (e.g. 11→12 ⇒ slide 220→0);
		  interpolating that looks like the whole column lurches.
		  Live drag still feels smooth via dragSlide / dragRotY each frame.
		*/
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
		/* Fixed — height:auto was one source of lite/full height mismatch */
		height: 48px;
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
