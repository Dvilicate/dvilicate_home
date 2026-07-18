<script>
	import { base } from '$app/paths';
	import { browser } from '$app/environment';
	import { tick } from 'svelte';
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
		emptyGrid,
		patchStreams,
		planMove,
		resizeStreams,
		seedNumberIntoGrid,
		splitOddEven
	} from '$lib/collatz.js';

	/** Default grid size */
	const DEFAULT_COLS = 10;
	const DEFAULT_ROWS = 12;

	/** Grid size */
	let cols = $state(DEFAULT_COLS);
	let rows = $state(DEFAULT_ROWS);

	/** Mutable grid: streams[col][row] — left → right */
	let streams = $state(emptyGrid(DEFAULT_COLS, DEFAULT_ROWS));

	/** Seed input */
	let inputStr = $state('29');

	/**
	 * How cascade animation steps (always cascades left / right→left):
	 * - instant: jump to final state (no playback)
	 * - column: one whole column per step
	 * - row: walk downward row-by-row inside each column
	 */
	let animStyle = $state(/** @type {'instant' | 'column' | 'row'} */ ('instant'));

	/**
	 * Wire / line view mode:
	 * - off: closed lite faces only (never show wires)
	 * - hover: expand full wires for hovered column/row + animating column
	 * - all: always show full wire mesh on every cell (heavier on large grids)
	 */
	let wireMode = $state(/** @type {'off' | 'hover' | 'all'} */ ('off'));

	/** Column under the pointer — expand full wires for the whole column */
	let hoverCol = $state(/** @type {number | null} */ (null));

	/** Row under the pointer — highlight full row + expand wires */
	let hoverRow = $state(/** @type {number | null} */ (null));

	/** ms between cascade frames (column / row styles) */
	let speedMs = $state(120);

	/** Visual scale of the grid (1 = 100%) */
	let gridScale = $state(1);

	/** True while a fit measurement is in progress (avoid re-entry) */
	let fitting = false;

	/** @type {HTMLElement | null} */
	let gridWrapEl = $state(null);
	/** @type {HTMLElement | null} */
	let gridEl = $state(null);

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

	let colMeta = $derived(
		streams.map((s) => {
			const info = columnBase3Digits(s);
			const split = splitOddEven(info.value);
			return { ...info, ...split };
		})
	);
	let rowBase4 = $derived(
		allRowBase4Values(streams).map((rv) => {
			const split = splitOddEven(rv.value);
			return { ...rv, ...split };
		})
	);

	/**
	 * Full decimal → odd core after dividing out 2s, e.g. "68→17".
	 * Already-odd (or zero) stays a single number.
	 * @param {number} value
	 * @param {number} [odd]
	 * @param {number} [twos]
	 */
	function formatDecOdd(value, odd, twos) {
		const v = Math.abs(Math.floor(Number(value) || 0));
		const split = odd === undefined || twos === undefined ? splitOddEven(v) : null;
		const o = Math.abs(Math.floor(Number(odd ?? split?.odd ?? v) || 0));
		const t = Math.floor(Number(twos ?? split?.twos ?? 0) || 0);
		if (v === 0 || t <= 0 || v === o) return String(v);
		return `${v}→${o}`;
	}

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
			cascadeInstant(grid, colIndex, 'left');
			patchStreams(streams, grid);
			hotCol = colIndex;
			hotRow = null;
			status = `Col ${colIndex} cleared — type a new base-3 number to start fresh.`;
			return;
		}

		const result = applyColumnBase3Digits(grid[colIndex], cleaned, {
			replace: colFresh
		});
		cascadeInstant(grid, colIndex, 'left');
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
		cascadeInstantFromCols(grid, result.changedCols, 'left');
		patchStreams(streams, grid);
		hotCol = result.changedCols[0] ?? null;
		hotRow = rowIndex;
		const mode =
			result.mode === 'replace' ? 'fresh write' : result.mode === 'clear' ? 'clear' : 'patch';
		status = `Row ${rowIndex} base-4 “${cleaned}”₄ (${mode}${result.changedCols.length ? ` · cols ${result.changedCols.join(',')}` : ''}).`;
	}

	/**
	 * Shared cascade runner for drag / ripple.
	 * @param {number} streamId
	 * @param {number} rowIndex
	 * @param {number} delta
	 * @param {string} startStatus
	 */
	function runCascade(streamId, rowIndex, delta, startStatus) {
		const frames = planMove(streams, streamId, rowIndex, delta, {
			byRow: animStyle === 'row',
			direction: 'left'
		});
		if (!frames.length) return;

		// Instant: apply final frame only (no playback)
		if (animStyle === 'instant') {
			stopAnim();
			const last = frames[frames.length - 1];
			patchStreams(streams, last.streams);
			hotCol = null;
			hotRow = null;
			status = `${startStatus} · instant (${frames.length} steps collapsed).`;
			return;
		}

		const restart = animating ? ' · restart' : '';
		playFrames(frames, `${startStatus}${restart}…`);
	}

	/** Wait two animation frames so layout (incl. zoom) has settled. */
	function nextFrame() {
		return new Promise((resolve) => {
			requestAnimationFrame(() => requestAnimationFrame(resolve));
		});
	}

	/**
	 * Fit the grid into the visible wrap area in one shot.
	 * Measures the grid at zoom=1 (DOM), then applies a single scale factor.
	 * Caps at 100% — never enlarges past natural size.
	 */
	async function autoscaleToFit() {
		if (!browser || fitting) return;
		fitting = true;
		try {
			// Measure unscaled geometry so a second click is a no-op
			gridScale = 1;
			await tick();
			await nextFrame();

			if (!gridWrapEl || !gridEl) return;

			// Padding inside the wrap; keep a small inset so edges aren't clipped
			const pad = 8;
			const availW = Math.max(80, gridWrapEl.clientWidth - pad);
			const availH = Math.max(80, gridWrapEl.clientHeight - pad);

			// At zoom 1, scroll size is the full natural content box
			// (offset can be clamped by the wrap; scroll includes overflow)
			const naturalW = Math.max(1, gridEl.scrollWidth);
			const naturalH = Math.max(1, gridEl.scrollHeight);

			const fit = Math.min(availW / naturalW, availH / naturalH, 1);
			const next = Math.round(Math.max(0.2, Math.min(1, fit)) * 100) / 100;
			gridScale = next;

			await tick();
			await nextFrame();

			// If a scrollbar appeared/disappeared, re-measure once at the new scale
			// by computing from the unscaled size we already have (idempotent).
			const availW2 = Math.max(80, gridWrapEl.clientWidth - pad);
			const availH2 = Math.max(80, gridWrapEl.clientHeight - pad);
			const fit2 = Math.min(availW2 / naturalW, availH2 / naturalH, 1);
			const next2 = Math.round(Math.max(0.2, Math.min(1, fit2)) * 100) / 100;
			if (next2 !== next) gridScale = next2;

			status = `Scale ${Math.round(gridScale * 100)}% (fit ${cols}×${rows}).`;
		} finally {
			fitting = false;
		}
	}

	/** @param {number} v */
	function setGridScale(v) {
		const n = Number(v);
		if (!Number.isFinite(n)) return;
		gridScale = Math.round(Math.max(0.2, Math.min(1.5, n)) * 100) / 100;
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
		// Mid-cascade is fine: planMove rewrites neighbors from this column.
		runCascade(
			streamId,
			rowIndex,
			delta,
			`Moved col ${streamId} row ${rowIndex} ${dir} — ${animStyle}`
		);
	}

	function loadNumber() {
		stopAnim();
		const n = parseInt(String(inputStr), 10);
		if (!Number.isFinite(n) || n < 0) return;
		const c = Math.min(40, Math.max(3, parseInt(String(cols), 10) || DEFAULT_COLS));
		const r = Math.min(40, Math.max(4, parseInt(String(rows), 10) || DEFAULT_ROWS));
		cols = c;
		rows = r;
		const grid = emptyGrid(c, r);
		seedNumberIntoGrid(grid, n);
		streams = grid;
		status = `Seeded ${n} (${baseConvert(n, 10, 3)}₃) into the rightmost column, cascaded left. Drag any node to ripple.`;
	}

	function resizeGrid() {
		stopAnim();
		const c = Math.min(40, Math.max(3, parseInt(String(cols), 10) || DEFAULT_COLS));
		const r = Math.min(40, Math.max(4, parseInt(String(rows), 10) || DEFAULT_ROWS));
		cols = c;
		rows = r;
		// Grow left / bottom; shrink removes left / bottom — keep existing content
		streams = resizeStreams(streams, c, r);
		status = `Grid ${c}×${r} (new cols left · new rows bottom).`;
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
		runCascade(streamId, 0, 0, `Ripple from col ${streamId} — ${animStyle}`);
	}

	let booted = $state(false);
	$effect(() => {
		if (!browser || booted) return;
		booted = true;
		loadNumber();
		// Fit as soon as the grid has laid out (retry briefly if wrap not ready)
		(async () => {
			for (let i = 0; i < 8; i++) {
				await tick();
				await nextFrame();
				if (gridWrapEl && gridEl && gridWrapEl.clientWidth > 0) {
					await autoscaleToFit();
					return;
				}
			}
			await autoscaleToFit();
		})();
	});
</script>

<svelte:head>
	<title>Collatz grid — interactive cascade</title>
</svelte:head>

<div class="page">
	<header class="top">
		<div class="top-bar">
			<a class="home-btn" href="{base}/maths" title="Back to maths section">← Maths</a>
			<h1 class="title">Collatz residue grid</h1>
			<p class="sub" title="Drag nodes to rotate; cascade ripples through remaining columns. Edits never block.">
				Drag to rotate · cascade ripples · edits never blocked
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
				<input class="no-spin" type="number" min="0" bind:value={inputStr} />
			</label>
			<button type="submit" class="btn primary">Load</button>

			<label class="field narrow">
				<span>Cols</span>
				<input
					class="no-spin"
					type="number"
					min="3"
					max="40"
					bind:value={cols}
					onchange={resizeGrid}
				/>
			</label>
			<label class="field narrow">
				<span>Rows</span>
				<input
					class="no-spin"
					type="number"
					min="4"
					max="40"
					bind:value={rows}
					onchange={resizeGrid}
				/>
			</label>

			<span class="ctrl-sep" aria-hidden="true"></span>

			<fieldset
				class="anim-opts"
				title="Cascade always goes left (right→left). Instant = no playback · Column = one column per step · Row = walk downward inside each column"
			>
				<legend>Animate</legend>
				<label class="radio">
					<input type="radio" name="animStyle" value="instant" bind:group={animStyle} />
					Instant
				</label>
				<label class="radio">
					<input type="radio" name="animStyle" value="column" bind:group={animStyle} />
					Column
				</label>
				<label class="radio">
					<input type="radio" name="animStyle" value="row" bind:group={animStyle} />
					Row
				</label>
			</fieldset>

			<label class="field narrow" title="Milliseconds between animation frames">
				<span>ms</span>
				<input
					class="no-spin"
					type="number"
					min="30"
					max="800"
					step="10"
					bind:value={speedMs}
					disabled={animStyle === 'instant'}
				/>
			</label>

			<button
				type="button"
				class="btn"
				onclick={() => stopAnim()}
				disabled={!animating}
				title="Stop the cascade without applying further frames"
			>
				Stop
			</button>

			<span class="ctrl-sep" aria-hidden="true"></span>

			<fieldset
				class="wire-mode"
				title="Connection line views: Hidden = closed nodes only · On hover = column/row · All = every cell (heavier)."
			>
				<legend>Lines</legend>
				<label class="radio">
					<input type="radio" name="wireMode" value="off" bind:group={wireMode} />
					Hidden
				</label>
				<label class="radio">
					<input type="radio" name="wireMode" value="hover" bind:group={wireMode} />
					On hover
				</label>
				<label class="radio">
					<input type="radio" name="wireMode" value="all" bind:group={wireMode} />
					All
				</label>
			</fieldset>

			<label
				class="field scale-field"
				title="Zoom the grid. Auto-fits on load; Fit remeasures at 100% then scales once."
			>
				<span>Scale {Math.round(gridScale * 100)}%</span>
				<input
					type="range"
					min="0.2"
					max="1.5"
					step="0.05"
					value={gridScale}
					oninput={(e) => setGridScale(e.currentTarget.value)}
				/>
			</label>
			<button type="button" class="btn" onclick={autoscaleToFit} title="Fit grid to view">
				Fit
			</button>

			<button type="button" class="btn" onclick={clearGrid}>Clear</button>
		</form>

		<div class="status" class:busy={animating}>
			{#if animating}
				<span class="pulse"></span>
			{/if}
			{status}
		</div>
	</header>

	<section class="legend">
		<span><i class="swatch shift"></i> shift options</span>
		<span><i class="swatch carry"></i> carry <code>&lt;n</code></span>
		<span><i class="swatch hot"></i> selected wire</span>
		<span class="muted">1–3 pick shift · green/red floats = decimal→odd</span>
	</section>

	<div class="grid-wrap" bind:this={gridWrapEl}>
		<div
			class="grid"
			bind:this={gridEl}
			style="
				--grid-zoom: {gridScale};
				grid-template-columns: repeat({streams.length}, var(--col-w)) var(--row-panel-w);
			"
		>
			{#each streams as stream, colIndex}
				{@const meta = colMeta[colIndex]}
				<div
					class="column"
					class:hot={hotCol === colIndex}
					class:col-hovered={hoverCol === colIndex}
					class:source-hint={colIndex === streams.length - 1}
				>
					<header class="col-head">
						<div class="col-idx">col {colIndex}</div>
						<!-- Hero: base-3 digit string (neon green) + decimal reading -->
						<label
							class="digit-edit col-b3"
							title="Base-3 digits of this column (0–2). Edit to patch nodes; clear then retype for a fresh number."
						>
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
								<span class="rad-tag rad-3">₃</span>
							</span>
						</label>
						<div
							class="col-val"
							title={meta.twos
								? `${meta.value} = ${meta.odd} × 2^${meta.twos} (show odd)`
								: `Base-3 “${meta.displayStr || '0'}”₃ = ${meta.value}`}
						>
							<span class="dec-eq">=</span>
							<span class="odd-num">{meta.odd}</span>
							<!-- Always reserve this line so /2^n appearing doesn't reflow the header -->
							<span class="twos-tag" class:hidden={meta.twos <= 0}>
								{#if meta.twos > 0}/2^{meta.twos}{:else}&nbsp;{/if}
							</span>
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
							hoverRow = null;
						}}
					>
						{#each stream as cell, rowIndex (cell.id)}
							{@const cMeta = colMeta[colIndex]}
							{@const rMeta = rowBase4[rowIndex]}
							{@const inertZero =
								cMeta.last < 0 || rowIndex < cMeta.lead || rowIndex > cMeta.last}
							<!--
								During cascade: keep nodes grey until the walk reaches them, and
								never ungrey padding zeros — only digits that are part of the number.
							-->
							{@const animAhead =
								animating &&
								hotCol === colIndex &&
								hotRow != null &&
								rowIndex > hotRow}
							{@const partOfNumber = !inertZero}
							{@const isDimmed = inertZero || animAhead}
							<!-- Top active node of the column (or row 0 when empty) — anchor for green decimal -->
							{@const isTopActive =
								cMeta.last >= 0 ? rowIndex === cMeta.lead : rowIndex === 0}
							<!-- Last active node of the row (last non-zero base-4 digit; col 0 if empty) -->
							{@const lastActiveCol =
								rMeta && rMeta.lastCol >= 0 ? rMeta.lastCol : 0}
							{@const isLastActive = colIndex === lastActiveCol}
							{@const rowLit = hoverRow === rowIndex || hotRow === rowIndex}
							{@const colDecLabel = formatDecOdd(cMeta.value, cMeta.odd, cMeta.twos)}
							{@const rowDecLabel = formatDecOdd(
								rMeta?.value ?? 0,
								rMeta?.odd,
								rMeta?.twos
							)}
							<!-- svelte-ignore a11y_no_static_element_interactions -->
							<div
								class="row-slot"
								class:inert={isDimmed}
								class:top-active={isTopActive}
								class:last-active={isLastActive}
								class:row-hovered={hoverRow === rowIndex}
								class:row-hot={hotRow === rowIndex}
								onmouseenter={() => (hoverRow = rowIndex)}
								onmouseleave={() => {
									if (hoverRow === rowIndex) hoverRow = null;
								}}
							>
								<!-- Green: column decimal → odd core above every top active node -->
								{#if isTopActive}
									<span
										class="float-dec float-dec-col"
										class:lit={hoverCol === colIndex || hotCol === colIndex}
										title="Column base-3 “{cMeta.displayStr || '0'}”₃ = {cMeta.value}{cMeta.twos > 0
											? ` = ${cMeta.odd} × 2^${cMeta.twos}`
											: ''} (decimal → odd)"
									>
										{colDecLabel}
									</span>
								{/if}
								<!-- Red: row decimal → odd core after the last active node of the row -->
								{#if isLastActive}
									<span
										class="float-dec float-dec-row"
										class:lit={rowLit}
										title="Row base-4 “{rMeta?.base4 || '0'}”₄ = {rMeta?.value ?? 0}{rMeta?.twos > 0
											? ` = ${rMeta.odd} × 2^${rMeta.twos}`
											: ''} (decimal → odd)"
									>
										{rowDecLabel}
									</span>
								{/if}
								<span class="row-idx">{rowIndex}</span>
								<GridCell
									{cell}
									active={hotCol === colIndex &&
										!isDimmed &&
										(hotRow === null ? partOfNumber : hotRow === rowIndex)}
									columnActive={hotCol === colIndex || hoverCol === colIndex}
									dimmed={isDimmed}
									wiresHidden={wireMode === 'off'}
									forceExpanded={wireMode === 'all' ||
										(wireMode === 'hover' &&
											(hoverCol === colIndex ||
												hoverRow === rowIndex ||
												(animating && hotCol === colIndex && !isDimmed)))}
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
							class:row-hovered={hoverRow === rowIndex}
							class:has-value={rv.value !== 0}
						>
							<span class="row-idx">{rowIndex}</span>
							<div class="base4-cell">
								<label
									class="digit-edit row-digit-edit"
									title="Base-4 digits across the row (0–3). Edit to patch nodes; clear then retype for a fresh number."
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
										<span class="rad-tag rad-4">₄</span>
									</span>
								</label>
								<div
									class="b4-result"
									title={rv.halved
										? `“${rv.base4 || '0'}”₄ = ${rv.value} ÷ 2 (ends in 2₄) → ${rv.result}`
										: `“${rv.base4 || '0'}”₄ = ${rv.result}`}
								>
									<span class="eq">=</span>
									{#if rv.halved}
										<span class="raw">{rv.value}</span>
										<span class="div2">÷2</span>
										<span class="eq">→</span>
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
					<strong>Cascade</strong> — always right→left
					(<code>left.shift[i] = ⌊num[i]/4⌋</code>). <strong>Animate</strong>: Instant (no
					playback), Column (one column per step), or Row (walk downward inside each column).
					Leading zeros that do not change are skipped; trailing inert zeros jump the highlight to
					the next column.
				</li>
				<li>
					<strong>Seed n</strong> loads base-3 digits into the <em>rightmost</em> column and
					cascades left instantly (then you can drag from anywhere). Column headers show the odd
					part of each column’s base-3 value (÷2 until odd), with editable base-3 digits.
				</li>
				<li>
					<strong>Editable base 3 / base 4</strong> — column headers edit ternary digits (0–2);
					the right panel edits each row’s base-4 digits (0–3 from <code>num % 4</code>). Edits
					patch the matching nodes only (change / append / delete digits). Clear the field
					completely, then type again, to rewrite the column or row from scratch. Neighbors update
					instantly leftward.
				</li>
				<li>
					<strong>Scale</strong> — auto-fits on load; use the slider or Fit anytime. Growing cols
					adds empty columns on the <em>left</em>; growing rows adds empty rows at the
					<em>bottom</em>.
				</li>
				<li>
					<strong>Drag</strong> only changes that node’s shift (0–2). It no longer carries into
					nodes above.
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
		<a href="{base}/maths">Maths hub</a>
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
		padding: 8px 12px 32px;
	}

	.top {
		display: flex;
		flex-direction: column;
		gap: 6px;
		margin-bottom: 4px;
	}

	.top-bar {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 8px 12px;
	}

	.home-btn {
		display: inline-flex;
		align-items: center;
		padding: 4px 10px;
		border-radius: 6px;
		border: 1px solid #334155;
		background: #1e293b;
		color: #e2e8f0;
		text-decoration: none;
		font-size: 0.82rem;
		font-weight: 600;
		line-height: 1.2;
		flex-shrink: 0;
	}

	.home-btn:hover {
		background: #334155;
		border-color: #38bdf8;
		color: #f8fafc;
	}

	.title {
		margin: 0;
		font-size: 1.15rem;
		color: #f8fafc;
		line-height: 1.2;
	}

	.sub {
		margin: 0;
		color: #64748b;
		font-size: 0.78rem;
		line-height: 1.3;
		flex: 1 1 12rem;
		min-width: 0;
	}

	.controls {
		display: flex;
		flex-wrap: wrap;
		gap: 6px 8px;
		align-items: flex-end;
		padding: 6px 8px;
		background: #111827;
		border-radius: 8px;
		border: 1px solid #1f2937;
	}

	.ctrl-sep {
		width: 1px;
		align-self: stretch;
		min-height: 28px;
		background: #334155;
		margin: 0 2px;
		flex-shrink: 0;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 2px;
		font-size: 0.62rem;
		color: #94a3b8;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.field input,
	.field select {
		font-size: 0.88rem;
		padding: 5px 8px;
		border-radius: 6px;
		border: 1px solid #334155;
		background: #0f172a;
		color: #f1f5f9;
		min-width: 0;
		height: 30px;
		box-sizing: border-box;
	}

	.field.narrow input {
		width: 56px;
	}

	.field input {
		width: 88px;
	}

	.field select {
		width: auto;
		max-width: 7.5rem;
	}

	/* Hide number spinners (seed / cols / rows / ms) */
	.no-spin {
		-moz-appearance: textfield;
		appearance: textfield;
	}
	.no-spin::-webkit-outer-spin-button,
	.no-spin::-webkit-inner-spin-button {
		-webkit-appearance: none;
		margin: 0;
	}

	.wire-mode,
	.anim-opts {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 2px 8px;
		margin: 0;
		padding: 2px 8px 4px;
		border: 1px solid #334155;
		border-radius: 6px;
		background: #0f172a;
		color: #cbd5e1;
		font-size: 0.8rem;
	}

	.wire-mode legend,
	.anim-opts legend {
		padding: 0 3px;
		font-size: 0.62rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: #64748b;
	}

	.wire-mode .radio,
	.anim-opts .radio {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		cursor: pointer;
		user-select: none;
		white-space: nowrap;
	}

	.wire-mode .radio input,
	.anim-opts .radio input {
		accent-color: #38bdf8;
		cursor: pointer;
		margin: 0;
	}

	.wire-mode .radio:has(input:checked),
	.anim-opts .radio:has(input:checked) {
		color: #e2e8f0;
		font-weight: 700;
	}

	.scale-field {
		min-width: 7.5rem;
	}

	.scale-field > span {
		text-transform: none;
		letter-spacing: 0;
		font-variant-numeric: tabular-nums;
	}

	.scale-field input[type='range'] {
		width: 96px;
		height: 30px;
		padding: 0;
		border: none;
		background: transparent;
		accent-color: #38bdf8;
		cursor: pointer;
	}

	.btn {
		border: 1px solid #334155;
		background: #1e293b;
		color: #e2e8f0;
		border-radius: 6px;
		padding: 5px 10px;
		font-size: 0.82rem;
		cursor: pointer;
		height: 30px;
		box-sizing: border-box;
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

	.muted {
		color: #64748b;
	}

	.status {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 4px 10px;
		border-radius: 6px;
		background: #0f172a;
		border: 1px solid #1e293b;
		font-size: 0.8rem;
		color: #cbd5e1;
		min-height: 1.2em;
		line-height: 1.3;
	}

	.status.busy {
		border-color: #fbbf24;
		color: #fde68a;
	}

	.pulse {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: #fbbf24;
		animation: pulse 0.8s ease infinite;
		flex-shrink: 0;
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
		gap: 8px 12px;
		font-size: 0.72rem;
		color: #94a3b8;
		margin: 4px 0 8px;
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
		padding: 10px;
		max-height: calc(100vh - 148px);
	}

	.grid {
		display: grid;
		gap: 10px;
		width: max-content;
		min-width: 100%;
		align-items: start;
		/* zoom scales layout box too (scrollbars stay correct) */
		zoom: var(--grid-zoom, 1);
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

	.panel-slot.hot-row .base4-cell,
	.panel-slot.row-hovered .base4-cell {
		outline-color: #fbbf24;
		background: #5c4e32;
	}

	.panel-slot.has-value .b4-result .n {
		color: #fecaca;
	}

	.base4-cell {
		flex: 1;
		min-width: 0;
		box-sizing: border-box;
		padding: 4px 6px;
		background: #1a1214;
		border: 1px solid #3f1f1f;
		outline: 2px solid transparent;
		border-radius: 4px;
		font-variant-numeric: tabular-nums;
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 3px;
		/* Match residue-strip cell height (~labels + wires) */
		min-height: 74px;
	}

	.b4-result {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		justify-content: center;
		gap: 3px;
		font-size: 0.9rem;
		font-weight: 800;
		color: #fca5a5;
		line-height: 1.2;
	}

	.b4-result .raw {
		color: #f87171;
		font-weight: 700;
		font-size: 0.8rem;
	}

	.b4-result .div2 {
		color: #fbbf24;
		font-size: 0.72rem;
		font-weight: 700;
	}

	.b4-result .eq {
		color: #ef444488;
		font-size: 0.75rem;
	}

	.b4-result .n {
		color: #fecaca;
		font-size: 1.05rem;
		font-weight: 900;
		text-shadow: 0 0 8px #ef444466;
	}

	.column {
		background: #2a2a2a;
		border-radius: 8px;
		border: 1px solid #3a3a3a;
		/* Visible so column/row float decimals can sit outside the cell box */
		overflow: visible;
		transition: border-color 0.2s, box-shadow 0.2s;
		min-width: 0;
		position: relative;
	}

	.column.col-hovered {
		z-index: 6;
	}

	.column.hot {
		border-color: #38bdf8;
		box-shadow: 0 0 0 1px #38bdf888, 0 0 20px #38bdf822;
		z-index: 5;
	}

	/* Clip header chrome only; body needs visible floats */
	.column > .col-head {
		border-radius: 8px 8px 0 0;
	}

	.column.source-hint .col-head {
		background: #1a2332;
	}

	.col-head {
		padding: 6px 6px 4px;
		background: #1a1a1a;
		border-bottom: 1px solid #333;
		text-align: center;
		/* Fixed height so /2^n (and other value churn) never reflows the grid */
		height: 118px;
		min-height: 118px;
		max-height: 118px;
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: flex-start;
		gap: 1px;
		overflow: hidden;
		flex-shrink: 0;
	}

	/* Panel header can use the same height for row alignment */
	.row-panel .col-head {
		height: 118px;
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
		gap: 3px;
		width: 100%;
	}

	.digit-input {
		width: 100%;
		max-width: 200px;
		box-sizing: border-box;
		padding: 4px 6px;
		border-radius: 6px;
		border: 1px solid #1a3a1a;
		background: #07140a;
		color: #7cff4a;
		font-family: ui-monospace, 'Cascadia Code', 'Fira Code', monospace;
		font-size: 1.05rem;
		font-weight: 800;
		text-align: center;
		letter-spacing: 0.08em;
		text-shadow: 0 0 10px #7cff4a99, 0 0 2px #7cff4a;
	}

	/* Column base-3: neon green hero */
	.digit-input.base3 {
		font-size: 1.2rem;
		padding: 5px 6px;
		border-color: #2a5a2a;
		background: #051208;
		color: #7cff4a;
		text-shadow: 0 0 12px #7cff4acc, 0 0 3px #b6f5a0;
	}

	/* Row base-4: red hero (matches residue selection colour) */
	.digit-input.base4 {
		max-width: 100%;
		font-size: 1.05rem;
		padding: 4px 5px;
		border: 1px solid #5a2020;
		background: #140808;
		color: #ff4d4d;
		text-shadow: 0 0 12px #ef4444cc, 0 0 3px #fca5a5;
		letter-spacing: 0.1em;
	}

	.digit-input:focus {
		outline: none;
		border-color: #38bdf8;
		box-shadow: 0 0 0 1px #38bdf866, 0 0 12px #38bdf833;
		background: #0c1520;
	}

	.digit-input.base3:focus {
		background: #071a0c;
		border-color: #7cff4a;
		box-shadow: 0 0 0 1px #7cff4a66, 0 0 14px #7cff4a33;
	}

	.digit-input.base4:focus {
		background: #1a0a0a;
		border-color: #ef4444;
		box-shadow: 0 0 0 1px #ef444466, 0 0 14px #ef444433;
	}

	.digit-input::placeholder {
		color: #475569;
		font-weight: 500;
		text-shadow: none;
		letter-spacing: 0;
	}

	.rad-tag {
		font-size: 0.95rem;
		font-weight: 800;
		flex-shrink: 0;
		line-height: 1;
	}

	.rad-tag.rad-3 {
		color: #7cff4a;
		text-shadow: 0 0 8px #7cff4aaa;
	}

	.rad-tag.rad-4 {
		color: #ff4d4d;
		text-shadow: 0 0 8px #ef4444aa;
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
		font-size: 1.05rem;
		font-weight: 800;
		font-variant-numeric: tabular-nums;
		color: #e2e8f0;
		line-height: 1.15;
		/* = decimal + reserved /2^n — fixed footprint */
		min-height: 2.15em;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: flex-start;
		gap: 0;
	}

	.col-val .dec-eq {
		display: none;
	}

	.col-val .odd-num {
		line-height: 1.1;
		min-height: 1.1em;
		font-size: 1.05rem;
		font-weight: 900;
		color: #f8fafc;
		letter-spacing: 0.02em;
	}

	.column.hot .col-val .odd-num {
		color: #fbbf24;
		text-shadow: 0 0 10px #fbbf2466;
	}

	.column.hot .digit-input.base3 {
		border-color: #7cff4a88;
		box-shadow: 0 0 10px #7cff4a22;
	}

	.col-b3 {
		margin-top: 0;
		margin-bottom: 0;
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
		margin-top: 2px;
		border: none;
		background: none;
		color: #38bdf8;
		font-size: 0.65rem;
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
		position: relative;
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
		border-radius: 6px;
		transition: background 0.15s, box-shadow 0.15s;
	}

	/* Always paint slots that host float labels or a lit row */
	.row-slot.top-active,
	.row-slot.last-active,
	.row-slot.row-hovered,
	.row-slot.row-hot {
		content-visibility: visible;
	}

	/* Cross-column row highlight (hover or cascade hot row) */
	.row-slot.row-hovered:not(.panel-slot) {
		background: #3a3420aa;
		box-shadow: inset 0 0 0 1px #fbbf2466;
		z-index: 4;
	}

	.row-slot.row-hot:not(.panel-slot) {
		background: #3a3020bb;
		box-shadow: inset 0 0 0 1px #fbbf2488;
		z-index: 4;
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

	/* Floating decimal readouts — always on; full → odd core (e.g. 68→17) */
	.float-dec {
		position: absolute;
		z-index: 10;
		pointer-events: none;
		font-family: ui-monospace, 'Cascadia Code', 'Fira Code', monospace;
		font-weight: 900;
		font-variant-numeric: tabular-nums;
		line-height: 1;
		white-space: nowrap;
		padding: 2px 6px;
		border-radius: 5px;
		letter-spacing: 0.02em;
		opacity: 0.85;
		transition: opacity 0.12s, box-shadow 0.12s, transform 0.12s;
	}

	.float-dec.lit {
		opacity: 1;
		z-index: 12;
	}

	/* Green: column base-3 decimal → odd, above every top active node */
	.float-dec-col {
		top: 0;
		left: 50%;
		transform: translate(-50%, calc(-100% - 2px));
		font-size: 0.82rem;
		color: #7cff4a;
		background: #051208ee;
		border: 1px solid #2a5a2a;
		text-shadow: 0 0 10px #7cff4acc, 0 0 2px #b6f5a0;
		box-shadow: 0 0 10px #7cff4a28, 0 2px 6px #000a;
	}

	.float-dec-col.lit {
		transform: translate(-50%, calc(-100% - 3px)) scale(1.05);
		box-shadow: 0 0 14px #7cff4a55, 0 2px 8px #000a;
	}

	/* Red: row base-4 decimal → odd, just after the last active (non-zero) node */
	.float-dec-row {
		left: auto;
		right: 0;
		top: 50%;
		transform: translate(calc(100% + 4px), -50%);
		font-size: 0.78rem;
		color: #ff4d4d;
		background: #140808f2;
		border: 1px solid #5a2020;
		text-shadow: 0 0 10px #ef4444cc, 0 0 2px #fca5a5;
		box-shadow: 0 0 10px #ef444428, 0 2px 6px #000a;
		z-index: 14;
	}

	.float-dec-row.lit {
		transform: translate(calc(100% + 4px), -50%) scale(1.05);
		box-shadow: 0 0 14px #ef444455, 0 2px 8px #000a;
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
