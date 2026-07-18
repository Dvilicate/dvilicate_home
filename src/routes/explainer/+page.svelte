<script>
	import { browser } from '$app/environment';
	import GridCell from '$lib/components/GridCell.svelte';
	import {
		allRowBase4Values,
		applyColumnBase3Digits,
		applyRowBase4Digits,
		baseConvert,
		cascadeInstant,
		cascadeInstantFromCols,
		cloneStreams,
		columnBase3Digits,
		columnValue,
		emptyGrid,
		patchStreams,
		planMove,
		seedNumberIntoGrid,
		splitOddEven
	} from '$lib/collatz.js';

	/** Grid size */
	let cols = $state(12);
	let rows = $state(16);

	/** Mutable grid: streams[col][row] — left → right */
	let streams = $state(emptyGrid(12, 16));

	/** Seed input */
	let inputStr = $state('29');

	/**
	 * Cascade direction:
	 * - left: edited column updates neighbors toward col 0
	 * - right: toward last column
	 * - both: left then right
	 */
	let direction = $state(/** @type {'left' | 'right' | 'both'} */ ('left'));

	/** Animate cell-by-cell down each column, vs whole column at once */
	let byRow = $state(true);

	/**
	 * Always show full cylinder wires on every cell (like pre-lite UI).
	 * Off by default for large-grid performance.
	 */
	let showAllConnections = $state(false);

	/** Column under the pointer — expand full wires for the whole column */
	let hoverCol = $state(/** @type {number | null} */ (null));

	/** ms between cascade frames */
	let speedMs = $state(120);

	/** True while a cascade animation is playing */
	let animating = $state(false);

	/** Which column/row is lit during the cascade */
	let hotCol = $state(/** @type {number | null} */ (null));
	let hotRow = $state(/** @type {number | null} */ (null));

	/** Status line */
	let status = $state(
		'Drag any node left/right — the change cascades through the remaining columns.'
	);

	/** @type {ReturnType<typeof setTimeout> | null} */
	let animTimer = null;
	/** Generation token so stale animations abort */
	let animGen = 0;

	const PRESETS = [7, 12, 17, 27, 29, 41];

	let colValues = $derived(streams.map((s) => columnValue(s)));
	let colMeta = $derived(
		streams.map((s) => {
			const info = columnBase3Digits(s);
			const split = splitOddEven(info.value);
			return { ...info, ...split };
		})
	);
	let rowBase4 = $derived(allRowBase4Values(streams));

	// ——— digit editors (surgical; draft kept while focused) ———
	let editingCol = $state(/** @type {number | null} */ (null));
	let colDraft = $state('');
	/** After a full clear, the next typed number rewrites from row 0 */
	let colFresh = $state(false);

	let editingRow = $state(/** @type {number | null} */ (null));
	let rowDraft = $state('');
	let rowFresh = $state(false);

	/** @param {number} colIndex */
	function colBase3Str(colIndex) {
		return colMeta[colIndex]?.displayStr ?? '';
	}

	/** @param {number} colIndex */
	function beginColEdit(colIndex) {
		stopAnim({ clearHot: false });
		editingCol = colIndex;
		colDraft = colBase3Str(colIndex);
		colFresh = colDraft.length === 0;
	}

	/**
	 * @param {number} colIndex
	 * @param {string} raw
	 */
	function onColDigitsInput(colIndex, raw) {
		// Keep only valid base-3 digits in the draft
		const cleaned = raw.replace(/[^0-2]/g, '');
		colDraft = cleaned;

		const grid = cloneStreams(streams);
		if (cleaned.length === 0) {
			colFresh = true;
			applyColumnBase3Digits(grid[colIndex], '', { replace: true });
			cascadeInstant(grid, colIndex, direction);
			patchStreams(streams, grid);
			hotCol = colIndex;
			hotRow = null;
			status = `Col ${colIndex} cleared — type a new base-3 number to start fresh.`;
			return;
		}

		const result = applyColumnBase3Digits(grid[colIndex], cleaned, {
			replace: colFresh
		});
		cascadeInstant(grid, colIndex, direction);
		patchStreams(streams, grid);
		hotCol = colIndex;
		hotRow = result.changedRows[0] ?? null;
		const mode =
			result.mode === 'replace' ? 'fresh write' : result.mode === 'clear' ? 'clear' : 'patch';
		status = `Col ${colIndex} base-3 “${cleaned}”₃ (${mode}${result.changedRows.length ? ` · rows ${result.changedRows.join(',')}` : ''}).`;
	}

	/** @param {number} colIndex */
	function endColEdit(colIndex) {
		if (editingCol !== colIndex) return;
		editingCol = null;
		colFresh = false;
	}

	/** @param {number} rowIndex */
	function beginRowEdit(rowIndex) {
		stopAnim({ clearHot: false });
		editingRow = rowIndex;
		rowDraft = rowBase4[rowIndex]?.base4 ?? '';
		rowFresh = rowDraft.length === 0;
	}

	/**
	 * @param {number} rowIndex
	 * @param {string} raw
	 */
	function onRowDigitsInput(rowIndex, raw) {
		const cleaned = raw.replace(/[^0-3]/g, '');
		rowDraft = cleaned;

		const grid = cloneStreams(streams);
		if (cleaned.length === 0) {
			rowFresh = true;
			applyRowBase4Digits(grid, rowIndex, '', { replace: true });
			// Clear doesn't need a wide cascade; realign already done per col
			patchStreams(streams, grid);
			hotCol = null;
			hotRow = rowIndex;
			status = `Row ${rowIndex} cleared — type a new base-4 number to start fresh.`;
			return;
		}

		const result = applyRowBase4Digits(grid, rowIndex, cleaned, {
			replace: rowFresh
		});
		cascadeInstantFromCols(grid, result.changedCols, direction);
		patchStreams(streams, grid);
		hotCol = result.changedCols[0] ?? null;
		hotRow = rowIndex;
		const mode =
			result.mode === 'replace' ? 'fresh write' : result.mode === 'clear' ? 'clear' : 'patch';
		status = `Row ${rowIndex} base-4 “${cleaned}”₄ (${mode}${result.changedCols.length ? ` · cols ${result.changedCols.join(',')}` : ''}).`;
	}

	/** @param {number} rowIndex */
	function endRowEdit(rowIndex) {
		if (editingRow !== rowIndex) return;
		editingRow = null;
		rowFresh = false;
	}

	/**
	 * Cancel any in-flight cascade timer. Leaves `streams` as-is (whatever frame
	 * was last shown) so a new edit can stack on the current grid and restart.
	 * @param {{ clearHot?: boolean }} [opts]
	 */
	function stopAnim(opts = {}) {
		animGen += 1;
		if (animTimer) {
			clearTimeout(animTimer);
			animTimer = null;
		}
		animating = false;
		if (opts.clearHot !== false) {
			hotCol = null;
			hotRow = null;
		}
	}

	/**
	 * Play cascade frames one by one. Calling again cancels the previous run
	 * and starts over (edits are non-blocking).
	 * @param {ReturnType<typeof planMove>} frames
	 * @param {string} [startStatus]
	 */
	function playFrames(frames, startStatus) {
		if (!browser || !frames.length) return;
		// Invalidate previous timer without clearing hot — first frame sets it
		stopAnim({ clearHot: false });
		const gen = animGen;
		animating = true;
		if (startStatus) status = startStatus;

		let i = 0;

		const step = () => {
			if (gen !== animGen) return;
			if (i >= frames.length) {
				animating = false;
				hotCol = null;
				hotRow = null;
				status = `Cascade finished (${frames.length} steps).`;
				return;
			}
			const frame = frames[i];
			// Mutate existing cell objects — keeps component identity, only
			// cells whose num/shift actually change re-render.
			patchStreams(streams, frame.streams);
			hotCol = frame.streamId;
			hotRow = frame.rowIndex ?? null;

			// Status every frame is cheap; skip on very large runs for less churn
			if (frames.length < 80 || i % 3 === 0 || i === frames.length - 1) {
				const label =
					frame.kind === 'source'
						? `Source col ${frame.streamId}`
						: frame.kind === 'row'
							? `Col ${frame.streamId} · row ${frame.rowIndex}`
							: `Col ${frame.streamId}`;
				status = `${label}  ·  step ${i + 1}/${frames.length}`;
			}

			i += 1;
			animTimer = setTimeout(step, Math.max(30, Number(speedMs) || 120));
		};

		step();
	}

	/**
	 * User moved a node on column `streamId`, row `rowIndex`.
	 * Always allowed — interrupts any running cascade and restarts from this column.
	 * @param {number} streamId
	 * @param {number} rowIndex
	 * @param {'left' | 'right'} dir
	 */
	function handleMove(streamId, rowIndex, dir) {
		const delta = dir === 'right' ? 1 : -1;
		// Base plan on whatever is currently on screen (mid-cascade is fine:
		// planMove rewrites neighbors in the cascade direction from this column).
		const frames = planMove(streams, streamId, rowIndex, delta, {
			byRow,
			direction
		});
		if (!frames.length) return;
		const restart = animating ? ' · restart' : '';
		playFrames(
			frames,
			`Moved col ${streamId} row ${rowIndex} ${dir} — cascading ${direction}${restart}…`
		);
	}

	function loadNumber() {
		stopAnim();
		const n = parseInt(String(inputStr), 10);
		if (!Number.isFinite(n) || n < 0) return;
		const c = Math.min(40, Math.max(3, parseInt(String(cols), 10) || 12));
		const r = Math.min(40, Math.max(4, parseInt(String(rows), 10) || 16));
		cols = c;
		rows = r;
		const grid = emptyGrid(c, r);
		seedNumberIntoGrid(grid, n);
		streams = grid;
		status = `Seeded ${n} (${baseConvert(n, 10, 3)}₃) into the rightmost column, cascaded left. Drag any node to ripple.`;
	}

	/** @param {number} n */
	function loadPreset(n) {
		inputStr = String(n);
		loadNumber();
	}

	function resizeGrid() {
		stopAnim();
		const c = Math.min(40, Math.max(3, parseInt(String(cols), 10) || 12));
		const r = Math.min(40, Math.max(4, parseInt(String(rows), 10) || 16));
		cols = c;
		rows = r;
		const grid = emptyGrid(c, r);
		const n = parseInt(String(inputStr), 10);
		if (Number.isFinite(n) && n >= 0) seedNumberIntoGrid(grid, n);
		streams = grid;
		status = `Grid ${c}×${r}.`;
	}

	function clearGrid() {
		stopAnim();
		streams = emptyGrid(cols, rows);
		status = 'Cleared.';
	}

	/**
	 * Re-run cascade from a column without moving a node (replay ripple).
	 * Interrupts any running animation and restarts from this column.
	 * @param {number} streamId
	 */
	function cascadeFrom(streamId) {
		const frames = planMove(streams, streamId, 0, 0, { byRow, direction });
		if (!frames.length) return;
		const restart = animating ? ' · restart' : '';
		playFrames(frames, `Ripple from col ${streamId} (${direction})${restart}…`);
	}

	let booted = $state(false);
	$effect(() => {
		if (!browser || booted) return;
		booted = true;
		loadNumber();
	});
</script>

<svelte:head>
	<title>Collatz grid — interactive cascade</title>
</svelte:head>

<div class="page">
	<header class="top">
		<div class="brand">
			<h1>Collatz residue grid</h1>
			<p class="sub">
				Each cell is a rotating cylinder section (like the explainer): drag to turn it — the strip
				slides and tilts around the Y axis while wires stay mapped to their numbers. The column
				settles, then the cascade ripples. Edits are never blocked.
			</p>
		</div>

		<form
			class="controls"
			onsubmit={(e) => {
				e.preventDefault();
				loadNumber();
			}}
		>
			<label class="field">
				<span>Seed n</span>
				<input type="number" min="0" bind:value={inputStr} />
			</label>
			<button type="submit" class="btn primary">Load into right col</button>

			<label class="field narrow">
				<span>Cols</span>
				<input type="number" min="3" max="40" bind:value={cols} onchange={resizeGrid} />
			</label>
			<label class="field narrow">
				<span>Rows</span>
				<input type="number" min="4" max="40" bind:value={rows} onchange={resizeGrid} />
			</label>
		</form>

		<div class="controls secondary">
			<label class="field">
				<span>Cascade</span>
				<select bind:value={direction}>
					<option value="left">← Left (to col 0)</option>
					<option value="right">Right → (to last col)</option>
					<option value="both">Both directions</option>
				</select>
			</label>

			<label class="check">
				<input type="checkbox" bind:checked={byRow} />
				Animate row-by-row inside each column
			</label>

			<button
				type="button"
				class="btn"
				class:primary={showAllConnections}
				onclick={() => (showAllConnections = !showAllConnections)}
				title="Always show full wire mesh on every cell (heavier on large grids). When off, hover a column to reveal its connections."
			>
				{showAllConnections ? 'Connections: all' : 'Connections: auto'}
			</button>

			<label class="field narrow">
				<span>Speed ms</span>
				<input type="number" min="30" max="800" step="10" bind:value={speedMs} />
			</label>

			<button type="button" class="btn" onclick={clearGrid}>Clear</button>
			<button
				type="button"
				class="btn"
				onclick={() => stopAnim()}
				disabled={!animating}
				title="Stop the cascade without applying further frames"
			>
				Stop anim
			</button>
		</div>

		<div class="presets">
			<span class="muted">Seed:</span>
			{#each PRESETS as p}
				<button type="button" class="chip" onclick={() => loadPreset(p)}>
					{p}
				</button>
			{/each}
		</div>

		<div class="status" class:busy={animating}>
			{#if animating}
				<span class="pulse"></span>
			{/if}
			{status}
		</div>
	</header>

	<section class="legend">
		<span><i class="swatch shift"></i> green dashed = other shift options (0–2)</span>
		<span><i class="swatch carry"></i> carry <code>&lt;n</code> = ⌊num/4⌋ → left</span>
		<span><i class="swatch hot"></i> red = selected wire to its target slot</span>
		<span class="muted">Drag to rotate · keys 1–3 pick shift · hover a column for full wires</span>
	</section>

	<div class="grid-wrap">
		<div
			class="grid"
			style="grid-template-columns: repeat({streams.length}, var(--col-w)) var(--row-panel-w);"
		>
			{#each streams as stream, colIndex}
				{@const val = colValues[colIndex]}
				{@const meta = colMeta[colIndex]}
				<div
					class="column"
					class:hot={hotCol === colIndex}
					class:source-hint={colIndex === streams.length - 1}
				>
					<header class="col-head">
						<div class="col-idx">col {colIndex}</div>
						<div
							class="col-val"
							title={meta.twos
								? `${meta.value} = ${meta.odd} × 2^${meta.twos} (show odd)`
								: `Base-3 value ${meta.value}`}
						>
							<span class="odd-num">{meta.odd}</span>
							<!-- Always reserve this line so /2^n appearing doesn't reflow the header -->
							<span class="twos-tag" class:hidden={meta.twos <= 0}>
								{#if meta.twos > 0}/2^{meta.twos}{:else}&nbsp;{/if}
							</span>
						</div>
						<label class="digit-edit" title="Edit base-3 digits (0–2). Patch in place; clear then retype for a fresh number.">
							<span class="digit-edit-label">base 3</span>
							<span class="digit-edit-row">
								<input
									class="digit-input base3"
									type="text"
									inputmode="numeric"
									autocomplete="off"
									spellcheck="false"
									value={editingCol === colIndex ? colDraft : meta.displayStr}
									placeholder="—"
									onfocus={() => beginColEdit(colIndex)}
									oninput={(e) => onColDigitsInput(colIndex, e.currentTarget.value)}
									onblur={() => endColEdit(colIndex)}
									onkeydown={(e) => {
										if (e.key === 'Enter') e.currentTarget.blur();
									}}
								/>
								<span class="rad-tag">₃</span>
							</span>
						</label>
						<div class="col-meta">
							<span title="Full value before odd-reduction">{val}</span>
							<span>{val.toString(4)}₄</span>
						</div>
						<button
							type="button"
							class="linkish"
							onclick={() => cascadeFrom(colIndex)}
							title="Re-run cascade from this column (interrupts current animation)"
						>
							ripple from here
						</button>
					</header>

					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<div
						class="col-body"
						onmouseenter={() => (hoverCol = colIndex)}
						onmouseleave={() => {
							if (hoverCol === colIndex) hoverCol = null;
						}}
					>
						{#each stream as cell, rowIndex (cell.id)}
							{@const meta = colMeta[colIndex]}
							{@const inertZero =
								meta.last < 0 || rowIndex < meta.lead || rowIndex > meta.last}
							<div class="row-slot" class:inert={inertZero}>
								<span class="row-idx">{rowIndex}</span>
								<GridCell
									{cell}
									active={hotCol === colIndex && (hotRow === null || hotRow === rowIndex)}
									columnActive={hotCol === colIndex}
									dimmed={inertZero}
									forceExpanded={showAllConnections ||
										hoverCol === colIndex ||
										(animating && hotCol === colIndex)}
									onMove={(dir) => handleMove(colIndex, rowIndex, dir)}
								/>
							</div>
						{/each}
					</div>
				</div>
			{/each}

			<aside class="column row-panel" title="Base-4 from num%4 across the row (left = MSD)">
				<header class="col-head">
					<div class="col-idx">per row</div>
					<div class="col-val panel-title">base 4</div>
					<div class="col-meta panel-meta">
						<span>num%4 → n</span>
						<span>…2₄ ⇒ ÷2</span>
					</div>
					<div class="panel-sub">sticky · last non-zero digit</div>
				</header>

				<div class="col-body">
					{#each rowBase4 as rv, rowIndex}
						<div
							class="row-slot panel-slot"
							class:hot-row={hotRow === rowIndex}
							class:has-value={rv.value !== 0}
						>
							<span class="row-idx">{rowIndex}</span>
							<div class="base4-cell">
								<label
									class="digit-edit row-digit-edit"
									title="Edit base-4 digits (0–3). Patch nodes in place; clear then retype for a fresh number."
								>
									<span class="digit-edit-row">
										<input
											class="digit-input base4"
											type="text"
											inputmode="numeric"
											autocomplete="off"
											spellcheck="false"
											value={editingRow === rowIndex ? rowDraft : rv.base4}
											placeholder="—"
											onfocus={() => beginRowEdit(rowIndex)}
											oninput={(e) => onRowDigitsInput(rowIndex, e.currentTarget.value)}
											onblur={() => endRowEdit(rowIndex)}
											onkeydown={(e) => {
												if (e.key === 'Enter') e.currentTarget.blur();
											}}
										/>
										<span class="rad-tag">₄</span>
									</span>
								</label>
								<div
									class="b4-result"
									title={rv.halved ? `${rv.value} ÷ 2 (ends in 2₄)` : String(rv.value || 0)}
								>
									{#if rv.halved}
										<span class="raw">{rv.value}</span>
										<span class="div2">÷2</span>
										<span class="eq">=</span>
									{/if}
									<span class="n">{rv.result}</span>
								</div>
							</div>
						</div>
					{/each}
				</div>
			</aside>
		</div>
	</div>

	<section class="explain">
		<details open>
			<summary>How interaction works</summary>
			<ol>
				<li>
					<strong>Rotate the cylinder section</strong> left or right (drag, ‹ ›, arrow keys, or
					keys <code>1</code>–<code>3</code>). Each cell is a clipped drum: the whole strip
					<em>slides and tilts around Y</em> with <code>shiftTotal</code> (like the explainer),
					while wires still map each top number to its bottom target
					(<code>end = ((i%4)·3+2)</code>). Red = selected shift option; green dashed = the other
					two. Overflow wraps inside the column so the section never flies off.
				</li>
				<li>
					<strong>Column settles</strong> — residues rewire top→bottom
					(<code>num = (prev%4)·3 + shift</code>), then the tail “drops to zero” under the edited row.
				</li>
				<li>
					<strong>Cascade</strong> — the next column is rewritten from this one
					(<code>left.shift[i] = ⌊num[i]/4⌋</code> when cascading left), settles, then the next
					column, and so on until the last column in that direction. Animation shows each step; enable
					<strong>row-by-row</strong> to watch the update walk down inside a column. Leading zeros that
					do not change are skipped; once trailing zeros have nothing left to update, the highlight
					jumps to the next column.
				</li>
				<li>
					<strong>Seed n</strong> loads base-3 digits into the <em>rightmost</em> column and
					instantly (then you can drag from anywhere). Column headers show the odd part of each
					column’s base-3 value (÷2 until odd), with editable base-3 digits.
				</li>
				<li>
					<strong>Editable base 3 / base 4</strong> — column headers edit ternary digits (0–2);
					the right panel edits each row’s base-4 digits (0–3 from <code>num % 4</code>). Edits
					patch the matching nodes only (change / append / delete digits). Clear the field
					completely, then type again, to rewrite the column or row from scratch. Neighbors update
					instantly using the current cascade direction.
				</li>
				<li>
					<strong>Right panel</strong> — for each row, read <code>num % 4</code> across columns
					(left = most significant digit) up through the last non-zero digit as a base-4 integer.
					If that number ends in <code>2</code>₄, show the value divided by 2.
				</li>
			</ol>
		</details>
	</section>

	<footer class="foot">
		<a href="/">Home</a>
		·
		<a href="/test2">Legacy test2</a>
	</footer>
</div>

<style>
	:global(body) {
		margin: 0;
		background: #1a1a1a;
		color: #e5e5e5;
		font-family: 'Segoe UI', system-ui, sans-serif;
	}

	.page {
		padding: 16px 18px 48px;
	}

	.brand h1 {
		margin: 0;
		font-size: 1.4rem;
		color: #f8fafc;
	}

	.sub {
		margin: 4px 0 12px;
		color: #94a3b8;
		max-width: 70ch;
		line-height: 1.45;
		font-size: 0.95rem;
	}

	.controls {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
		align-items: flex-end;
		margin-bottom: 10px;
	}

	.controls.secondary {
		padding: 10px;
		background: #111827;
		border-radius: 10px;
		border: 1px solid #1f2937;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 4px;
		font-size: 0.7rem;
		color: #94a3b8;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.field input,
	.field select {
		font-size: 1rem;
		padding: 7px 10px;
		border-radius: 8px;
		border: 1px solid #334155;
		background: #0f172a;
		color: #f1f5f9;
		min-width: 0;
	}

	.field.narrow input {
		width: 72px;
	}

	.field input {
		width: 120px;
	}

	.check {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 0.9rem;
		color: #cbd5e1;
		padding-bottom: 6px;
	}

	.btn {
		border: 1px solid #334155;
		background: #1e293b;
		color: #e2e8f0;
		border-radius: 8px;
		padding: 8px 12px;
		font-size: 0.92rem;
		cursor: pointer;
	}

	.btn:hover:not(:disabled) {
		background: #334155;
	}

	.btn:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}

	.btn.primary {
		background: #38bdf8;
		color: #0f172a;
		border-color: #38bdf8;
		font-weight: 700;
	}

	.presets {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		align-items: center;
		margin: 8px 0;
	}

	.chip {
		border: 1px solid #334155;
		background: #0f172a;
		color: #cbd5e1;
		border-radius: 999px;
		padding: 4px 12px;
		cursor: pointer;
		font-size: 0.85rem;
	}

	.chip:hover:not(:disabled) {
		background: #fbbf24;
		color: #111;
		border-color: #fbbf24;
	}

	.chip:disabled {
		opacity: 0.45;
	}

	.muted {
		color: #64748b;
	}

	.status {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 12px;
		border-radius: 8px;
		background: #0f172a;
		border: 1px solid #1e293b;
		font-size: 0.9rem;
		color: #cbd5e1;
		min-height: 1.4em;
	}

	.status.busy {
		border-color: #fbbf24;
		color: #fde68a;
	}

	.pulse {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: #fbbf24;
		animation: pulse 0.8s ease infinite;
	}

	@keyframes pulse {
		0%,
		100% {
			opacity: 1;
			transform: scale(1);
		}
		50% {
			opacity: 0.4;
			transform: scale(0.85);
		}
	}

	.legend {
		display: flex;
		flex-wrap: wrap;
		gap: 14px;
		font-size: 0.8rem;
		color: #94a3b8;
		margin: 12px 0;
	}

	.legend code {
		color: #86efac;
	}

	.swatch {
		display: inline-block;
		width: 10px;
		height: 10px;
		border-radius: 2px;
		margin-right: 4px;
		vertical-align: middle;
	}

	.swatch.shift {
		background: #7cff4a;
	}
	.swatch.carry {
		background: #6b9b78;
	}
	.swatch.hot {
		background: #fbbf24;
	}
	.swatch.col {
		background: #38bdf8;
	}

	.grid-wrap {
		/* Wide columns so 12-slot strips + straight links are readable */
		--col-w: 252px;
		--row-panel-w: 148px;
		overflow: auto;
		/* Keep layout stable when scrollbars appear as columns expand */
		scrollbar-gutter: stable;
		background: #222;
		border: 1px solid #333;
		border-radius: 12px;
		padding: 12px;
		max-height: calc(100vh - 280px);
	}

	.grid {
		display: grid;
		gap: 10px;
		width: max-content;
		min-width: 100%;
		align-items: start;
	}

	/* Sticky right panel — stays visible while scrolling the grid horizontally */
	.row-panel {
		position: sticky;
		right: 0;
		z-index: 8;
		width: var(--row-panel-w);
		background: #151b24;
		border-color: #38bdf866;
		box-shadow: -8px 0 16px #0008;
	}

	.row-panel .col-head {
		background: #0c1520;
	}

	.panel-title {
		font-size: 1rem !important;
		letter-spacing: 0.02em;
	}

	.panel-meta {
		flex-direction: column;
		gap: 2px !important;
		color: #7dd3fc !important;
	}

	.panel-sub {
		margin-top: 4px;
		font-size: 0.62rem;
		color: #64748b;
		line-height: 1.3;
	}

	.panel-slot {
		min-height: 78px;
		contain-intrinsic-size: auto 78px;
	}

	.panel-slot.hot-row .base4-cell {
		outline-color: #fbbf24;
		background: #5c4e32;
	}

	.panel-slot.has-value .b4-result .n {
		color: #f8fafc;
	}

	.base4-cell {
		flex: 1;
		min-width: 0;
		box-sizing: border-box;
		padding: 4px 6px;
		background: #2a2a2a;
		border: 1px solid #2a2a2a;
		outline: 2px solid transparent;
		border-radius: 4px;
		font-variant-numeric: tabular-nums;
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 2px;
		/* Match residue-strip cell height (~labels + wires) */
		min-height: 74px;
	}

	.b4-result {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 3px;
		font-size: 0.85rem;
		font-weight: 800;
		color: #94a3b8;
		line-height: 1.2;
	}

	.b4-result .raw {
		color: #64748b;
		font-weight: 600;
		font-size: 0.75rem;
	}

	.b4-result .div2 {
		color: #fbbf24;
		font-size: 0.7rem;
		font-weight: 700;
	}

	.b4-result .eq {
		color: #475569;
		font-size: 0.7rem;
	}

	.b4-result .n {
		color: #cbd5e1;
	}

	.column {
		background: #2a2a2a;
		border-radius: 8px;
		border: 1px solid #3a3a3a;
		overflow: hidden;
		transition: border-color 0.2s, box-shadow 0.2s;
		min-width: 0;
	}

	.column.hot {
		border-color: #38bdf8;
		box-shadow: 0 0 0 1px #38bdf888, 0 0 20px #38bdf822;
	}

	.column.source-hint .col-head {
		background: #1a2332;
	}

	.col-head {
		padding: 8px;
		background: #1a1a1a;
		border-bottom: 1px solid #333;
		text-align: center;
		/* Fixed height so /2^n (and other value churn) never reflows the grid */
		height: 148px;
		min-height: 148px;
		max-height: 148px;
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: flex-start;
		gap: 2px;
		overflow: hidden;
		flex-shrink: 0;
	}

	/* Panel header can use the same height for row alignment; allow slightly more if needed */
	.row-panel .col-head {
		height: 148px;
		overflow: hidden;
	}

	.col-val .twos-tag {
		display: block;
		height: 0.85em;
		min-height: 0.85em;
		font-size: 0.55rem;
		font-weight: 600;
		color: #fbbf24;
		letter-spacing: 0.02em;
		line-height: 0.85em;
	}

	.col-val .twos-tag.hidden {
		visibility: hidden;
	}

	.digit-edit {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
		width: 100%;
		margin: 2px 0;
	}

	.digit-edit-label {
		font-size: 0.58rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: #64748b;
	}

	.digit-edit-row {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 2px;
		width: 100%;
	}

	.digit-input {
		width: 100%;
		max-width: 120px;
		box-sizing: border-box;
		padding: 3px 6px;
		border-radius: 6px;
		border: 1px solid #334155;
		background: #0f172a;
		color: #7cff4a;
		font-family: ui-monospace, monospace;
		font-size: 0.85rem;
		font-weight: 700;
		text-align: center;
		letter-spacing: 0.04em;
	}

	.digit-input.base4 {
		max-width: 100%;
		font-size: 0.78rem;
		padding: 2px 4px;
		color: #7cff4a;
	}

	.digit-input:focus {
		outline: none;
		border-color: #38bdf8;
		box-shadow: 0 0 0 1px #38bdf866;
		background: #0c1520;
	}

	.digit-input::placeholder {
		color: #475569;
		font-weight: 500;
	}

	.rad-tag {
		font-size: 0.75rem;
		font-weight: 700;
		color: #86efac;
		flex-shrink: 0;
	}

	.row-digit-edit {
		margin: 0;
		width: 100%;
	}

	.row-digit-edit .digit-edit-row {
		width: 100%;
	}

	.col-idx {
		font-size: 0.65rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: #64748b;
	}

	.col-val {
		font-size: 1.15rem;
		font-weight: 800;
		font-variant-numeric: tabular-nums;
		color: #f8fafc;
		line-height: 1.15;
		/* Number + reserved /2^n line — fixed footprint */
		min-height: 2.15em;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: flex-start;
	}

	.col-val .odd-num {
		line-height: 1.15;
		min-height: 1.15em;
	}

	.column.hot .col-val {
		color: #fbbf24;
	}

	.col-meta {
		display: flex;
		justify-content: center;
		gap: 8px;
		font-size: 0.7rem;
		font-family: ui-monospace, monospace;
		color: #7cff4a;
	}

	.linkish {
		margin-top: 4px;
		border: none;
		background: none;
		color: #38bdf8;
		font-size: 0.7rem;
		cursor: pointer;
		text-decoration: underline;
		padding: 0;
	}

	.linkish:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.col-body {
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 8px 4px 10px;
		align-items: center;
	}

	.row-slot {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 4px;
		width: 100%;
		/* Match GridCell outer box (70px) so hover never reflows the column */
		min-height: 70px;
		/* Browser can skip layout/paint for slots outside the scrollport */
		content-visibility: auto;
		contain-intrinsic-size: auto 70px;
	}

	.row-idx {
		width: 14px;
		font-size: 0.65rem;
		color: #555;
		text-align: right;
		flex-shrink: 0;
		font-variant-numeric: tabular-nums;
	}

	/* Match row label to dimmed inert-zero cells */
	.row-slot.inert .row-idx {
		color: #333;
		opacity: 0.55;
	}

	.explain {
		margin-top: 16px;
	}

	.explain details {
		background: #0f172a;
		border: 1px solid #1e293b;
		border-radius: 10px;
		padding: 10px 14px;
	}

	.explain summary {
		cursor: pointer;
		font-weight: 600;
	}

	.explain ol {
		color: #cbd5e1;
		font-size: 0.92rem;
		line-height: 1.5;
	}

	.explain code {
		background: #1e293b;
		padding: 1px 5px;
		border-radius: 4px;
		color: #86efac;
		font-size: 0.85em;
	}

	.foot {
		margin-top: 24px;
		font-size: 0.85rem;
		color: #64748b;
	}

	.foot a {
		color: #38bdf8;
		text-decoration: none;
	}
</style>
