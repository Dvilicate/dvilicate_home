<script>
	import { base } from '$app/paths';
	import { browser } from '$app/environment';
	import { onMount } from 'svelte';
	import {
		CARRY_SYM,
		EXPECTED_ALIVE,
		LOG2_3,
		createSieveTree,
		digitStep,
		expandLevel,
		laneChainOf,
		layoutTree,
		resolveChain,
		runAligned,
		suffixDigitsLsbFirst,
		suffixDisplay,
		suffixValue,
		walkNodes
	} from '$lib/suffixSieve.js';

	const MAX_NODES = 100000;
	const MAX_DEPTH = 14;
	const XGAP = 22;
	const YGAP = 70;
	const NR = 11;

	const COL = {
		bg: '#0f172a',
		grid: '#1e293b',
		ink: '#e2e8f0',
		soft: '#94a3b8',
		muted: '#64748b',
		alive: '#34d399',
		pruned: '#f87171',
		accent: '#38bdf8'
	};

	/**
	 * Tree lives outside $state so deep push/layout mutations aren't lost to
	 * proxy edge cases — `treeRev` is what triggers redraws.
	 * @type {{ root: import('$lib/suffixSieve.js').SieveNode, levels: import('$lib/suffixSieve.js').SieveNode[][], total: number } | null}
	 */
	let tree = null;
	let treeRev = $state(0);

	let ghostMode = $state(false);
	let selected = $state(/** @type {import('$lib/suffixSieve.js').SieveNode | null} */ (null));
	let status = $state('Loading…');
	let autoOn = $state(false);

	let canvasEl = $state(/** @type {HTMLCanvasElement | null} */ (null));
	let wrapEl = $state(/** @type {HTMLDivElement | null} */ (null));
	let view = $state({ x: 0, y: 0, k: 1 });
	let dpr = 1;
	/** @type {ReturnType<typeof setInterval> | null} */
	let timer = null;
	let drag = $state(/** @type {{ id: number, x: number, y: number, vx: number, vy: number } | null} */ (null));
	let moved = false;

	let showWheel = $state(false);
	let showInspector = $state(false);

	let manualChain = $state(/** @type {number[]} */ ([]));
	let wpStart = $state('31321');
	let wpRows = $state(/** @type {ReturnType<typeof runAligned> | null} */ (null));
	let wpLane = $state(/** @type {number | null} */ (null));
	let wpStepIdx = $state(0);
	let wpWalk = $state(/** @type {(number|null)[]} */ ([]));
	let wpChain = $state(/** @type {(number|null)[]} */ ([]));

	let levelsLen = $derived.by(() => {
		treeRev;
		return tree?.levels.length ?? 0;
	});
	let totalNodes = $derived.by(() => {
		treeRev;
		return tree?.total ?? 0;
	});

	let hud = $derived.by(() => {
		treeRev;
		if (!tree?.levels.length) return '—';
		const L = tree.levels[tree.levels.length - 1];
		const a = L.filter((n) => n.alive).length;
		const k = tree.levels.length;
		const share = (a / Math.pow(4, k)) * 100;
		const exp = EXPECTED_ALIVE[k];
		const expNote = exp != null ? (exp === a ? ' · matches table' : ` · expected ${exp}`) : '';
		return `k=${k} · frontier alive ${a}/${L.length} (${share.toPrecision(3)}% of 4^k) · nodes ${tree.total}${ghostMode ? ' · full 4-ary' : ''}${expNote}`;
	});

	function bump() {
		treeRev++;
	}

	function reset() {
		stopAuto();
		tree = createSieveTree();
		selected = null;
		showInspector = false;
		layoutTree(tree.root, XGAP);
		status = 'Level 1: only …3₄ survives (0·2 halve immediately; 1 → (3n+1)/4 < n). Click Reveal to spawn the next trailing digit.';
		bump();
		queueDraw(true);
	}

	/** @returns {boolean} */
	function stepOnce() {
		if (!tree) {
			status = 'Tree not ready — hit Reset.';
			return false;
		}
		const r = expandLevel(tree.levels, {
			ghost: ghostMode,
			maxDepth: MAX_DEPTH,
			maxNodes: MAX_NODES,
			total: tree.total
		});
		if (!r.grew) {
			status = r.reason ? `Cannot expand: ${r.reason}.` : 'Cannot expand.';
			return false;
		}
		tree.levels = r.levels;
		tree.total = r.total;
		layoutTree(tree.root, XGAP);
		const L = tree.levels[tree.levels.length - 1];
		const a = L.filter((n) => n.alive).length;
		status = `Revealed digit k=${tree.levels.length}: ${a} alive of ${L.length} on frontier (${L.length} new nodes).`;
		bump();
		return true;
	}

	function stepAndFit() {
		if (stepOnce()) queueDraw(true);
		else {
			stopAuto();
			queueDraw(false);
		}
	}

	function stopAuto() {
		if (timer) {
			clearInterval(timer);
			timer = null;
		}
		autoOn = false;
	}

	function toggleAuto() {
		if (autoOn) {
			stopAuto();
			return;
		}
		autoOn = true;
		timer = setInterval(() => {
			if (!stepOnce()) stopAuto();
			queueDraw(true);
		}, 650);
	}

	function rebuildKeepingDepth() {
		const d = tree?.levels.length || 1;
		const g = ghostMode;
		reset();
		ghostMode = g;
		while (tree && tree.levels.length < d && stepOnce()) {}
		if (tree) layoutTree(tree.root, XGAP);
		bump();
		queueDraw(true);
	}

	/* ---- canvas ---- */
	function resize() {
		if (!canvasEl || !wrapEl) return;
		dpr = window.devicePixelRatio || 1;
		const w = Math.max(1, wrapEl.clientWidth);
		const h = Math.max(1, wrapEl.clientHeight);
		canvasEl.width = Math.floor(w * dpr);
		canvasEl.height = Math.floor(h * dpr);
		canvasEl.style.width = w + 'px';
		canvasEl.style.height = h + 'px';
		draw();
	}

	function fitView() {
		if (!tree || !canvasEl) return;
		layoutTree(tree.root, XGAP);
		let minX = Infinity;
		let maxX = -Infinity;
		walkNodes(tree.root, (n) => {
			minX = Math.min(minX, n.x);
			maxX = Math.max(maxX, n.x);
		});
		if (!Number.isFinite(minX)) {
			minX = 0;
			maxX = 0;
		}
		const w = canvasEl.clientWidth || wrapEl?.clientWidth || 800;
		const h = canvasEl.clientHeight || wrapEl?.clientHeight || 500;
		const spanX = Math.max(maxX - minX + XGAP * 3, 120);
		const spanY = Math.max(tree.levels.length * YGAP + 100, 160);
		const kk = Math.min(w / spanX, h / spanY, 1.8);
		view = {
			k: kk,
			x: w / 2 - ((minX + maxX) / 2) * kk,
			y: 36 + NR * kk
		};
		draw();
	}

	/** @param {boolean} [fit] */
	function queueDraw(fit = false) {
		requestAnimationFrame(() => {
			if (fit) fitView();
			else draw();
		});
	}

	/** @param {number} score */
	function prunedColor(score) {
		const t = Math.max(0, Math.min(1, (score + 4) / 4));
		const a = [127, 29, 29];
		const b = [251, 191, 36];
		const c = a.map((v, i) => Math.round(v + (b[i] - v) * t));
		return `rgb(${c[0]},${c[1]},${c[2]})`;
	}

	function draw() {
		if (!canvasEl || !tree) return;
		const cx = canvasEl.getContext('2d');
		if (!cx) return;
		const W = canvasEl.clientWidth;
		const H = canvasEl.clientHeight;
		if (W < 2 || H < 2) return;

		cx.setTransform(dpr, 0, 0, dpr, 0, 0);
		cx.clearRect(0, 0, W, H);
		cx.fillStyle = COL.bg;
		cx.fillRect(0, 0, W, H);

		// faint grid
		cx.strokeStyle = COL.grid;
		cx.lineWidth = 1;
		const g = 28;
		const ox = ((view.x % g) + g) % g;
		const oy = ((view.y % g) + g) % g;
		for (let x = ox; x < W; x += g) {
			cx.beginPath();
			cx.moveTo(x, 0);
			cx.lineTo(x, H);
			cx.stroke();
		}
		for (let y = oy; y < H; y += g) {
			cx.beginPath();
			cx.moveTo(0, y);
			cx.lineTo(W, y);
			cx.stroke();
		}

		cx.save();
		cx.translate(view.x, view.y);
		cx.scale(view.k, view.k);

		/** @param {import('$lib/suffixSieve.js').SieveNode} n */
		function edges(n) {
			for (const ch of n.children) {
				if (n.depth > 0) {
					cx.strokeStyle = ch.alive ? COL.alive : COL.pruned;
					cx.globalAlpha = ch.alive ? 0.8 : n.alive ? 0.4 : 0.18;
					cx.lineWidth = 1.4;
					cx.beginPath();
					cx.moveTo(n.x, (n.depth - 1) * YGAP + NR);
					cx.lineTo(ch.x, (ch.depth - 1) * YGAP - NR);
					cx.stroke();
				} else {
					// root → level-1 stems
					cx.strokeStyle = ch.alive ? COL.alive : COL.pruned;
					cx.globalAlpha = ch.alive ? 0.55 : 0.25;
					cx.lineWidth = 1.2;
					cx.beginPath();
					cx.moveTo(ch.x, -NR - 8);
					cx.lineTo(ch.x, -NR);
					cx.stroke();
				}
				edges(ch);
			}
		}
		edges(tree.root);
		cx.globalAlpha = 1;
		cx.textAlign = 'center';
		cx.textBaseline = 'middle';

		walkNodes(tree.root, (n) => {
			const y = (n.depth - 1) * YGAP;
			const res = n.result;
			cx.beginPath();
			cx.arc(n.x, y, NR, 0, Math.PI * 2);
			cx.fillStyle = n.alive ? COL.alive : prunedColor(res?.score ?? -2);
			cx.fill();
			const isSel = selected && selected.id === n.id;
			if (view.k > 0.4 || isSel) {
				cx.strokeStyle = isSel ? COL.accent : n.alive ? COL.alive : COL.pruned;
				cx.lineWidth = isSel ? 3 : 1.2;
				cx.stroke();
			}
			if (view.k > 0.4) {
				cx.fillStyle = n.alive ? '#042f2e' : COL.ink;
				cx.font = '700 12px ui-monospace, SF Mono, Menlo, Consolas, monospace';
				cx.fillText(String(n.digit), n.x, y + 0.5);
			}
			if (n.alive && res && view.k > 1.0) {
				cx.fillStyle = COL.soft;
				cx.font = '8px ui-monospace, SF Mono, Menlo, Consolas, monospace';
				const sc = res.score;
				cx.fillText((sc >= 0 ? '+' : '') + sc.toFixed(2), n.x, y + NR + 9);
			}
		});

		// level labels
		let minX = Infinity;
		walkNodes(tree.root, (n) => {
			minX = Math.min(minX, n.x);
		});
		if (!Number.isFinite(minX)) minX = 0;
		cx.fillStyle = COL.muted;
		cx.font = '12px ui-monospace, SF Mono, Menlo, Consolas, monospace';
		cx.textAlign = 'left';
		for (let i = 0; i < tree.levels.length; i++) {
			cx.fillText('k=' + (i + 1), minX - XGAP - 32, i * YGAP);
		}
		cx.restore();
	}

	/** @param {PointerEvent} e */
	function onPointerDown(e) {
		if (!canvasEl) return;
		canvasEl.setPointerCapture(e.pointerId);
		drag = { id: e.pointerId, x: e.clientX, y: e.clientY, vx: view.x, vy: view.y };
		moved = false;
	}
	/** @param {PointerEvent} e */
	function onPointerMove(e) {
		if (!drag || e.pointerId !== drag.id) return;
		const dx = e.clientX - drag.x;
		const dy = e.clientY - drag.y;
		if (Math.abs(dx) + Math.abs(dy) > 4) moved = true;
		view = { ...view, x: drag.vx + dx, y: drag.vy + dy };
		draw();
	}
	/** @param {PointerEvent} e */
	function onPointerUp(e) {
		if (drag && !moved) clickAt(e.clientX, e.clientY);
		drag = null;
	}
	/** @param {WheelEvent} e */
	function onWheel(e) {
		if (!canvasEl) return;
		e.preventDefault();
		const f = Math.exp(-e.deltaY * 0.0015);
		const r = canvasEl.getBoundingClientRect();
		const mx = e.clientX - r.left;
		const my = e.clientY - r.top;
		view = {
			k: view.k * f,
			x: mx - (mx - view.x) * f,
			y: my - (my - view.y) * f
		};
		draw();
	}

	/** @param {number} cxp @param {number} cyp */
	function clickAt(cxp, cyp) {
		if (!canvasEl || !tree) return;
		const r = canvasEl.getBoundingClientRect();
		const wx = (cxp - r.left - view.x) / view.k;
		const wy = (cyp - r.top - view.y) / view.k;
		/** @type {import('$lib/suffixSieve.js').SieveNode | null} */
		let best = null;
		let bd = 1e9;
		walkNodes(tree.root, (n) => {
			const y = (n.depth - 1) * YGAP;
			const dist = Math.hypot(n.x - wx, y - wy);
			if (dist < bd) {
				bd = dist;
				best = n;
			}
		});
		if (best && bd < 18) {
			selected = best;
			showInspector = true;
			draw();
		}
	}

	/* ---- wheel helpers ---- */
	const WPOS = {
		0: [-78, -78],
		2: [78, -78],
		1: [-78, 78],
		3: [78, 78]
	};
	const CCOL = ['#64748b', '#38bdf8', '#f87171'];

	function wheelSvgMarkup() {
		const P = WPOS;
		/** @param {number[]} a @param {number[]} b @param {number} f */
		const mid = (a, b, f) => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
		/** @param {number[]} a @param {number[]} b @param {number} [rad] */
		function shrink(a, b, rad = 16) {
			const dx = b[0] - a[0];
			const dy = b[1] - a[1];
			const L = Math.hypot(dx, dy) || 1;
			return [
				[a[0] + (dx / L) * rad, a[1] + (dy / L) * rad],
				[b[0] - (dx / L) * rad, b[1] - (dy / L) * rad]
			];
		}
		/** @param {number[]} a @param {number[]} b @param {number[]} bulge @param {string} color @param {number} emit @param {number} id */
		function arrow(a, b, bulge, color, emit, id) {
			const mx = (a[0] + b[0]) / 2 + bulge[0];
			const my = (a[1] + b[1]) / 2 + bulge[1];
			const bx = mid([mx, my], b, 0.55);
			return (
				`<path d="M ${a[0]} ${a[1]} Q ${mx} ${my} ${b[0]} ${b[1]}" fill="none" stroke="${color}" stroke-width="2" marker-end="url(#ah${id})"/>` +
				`<g><circle cx="${bx[0]}" cy="${bx[1]}" r="10" fill="#0f172a" stroke="${CCOL[emit]}"/><text x="${bx[0]}" y="${bx[1] + 3.5}" text-anchor="middle" font-size="9" font-weight="700" fill="${CCOL[emit]}">${CARRY_SYM[emit]}</text></g>`
			);
		}
		/** @param {number[]} p @param {number[]} dir @param {string} color @param {number} emit */
		function loop(p, dir, color, emit) {
			const [x, y] = p;
			const sx = dir[0];
			const sy = dir[1];
			return `<path d="M ${x + sx * 12} ${y + sy * 8} C ${x + sx * 52} ${y + sy * 14}, ${x + sx * 44} ${y + sy * 54}, ${x + sx * 8} ${y + sy * 16}" fill="none" stroke="${color}" stroke-width="2" marker-end="url(#ah${color.slice(1)})"/>
				<g><circle cx="${x + sx * 44}" cy="${y + sy * 34}" r="10" fill="#0f172a" stroke="${CCOL[emit]}"/><text x="${x + sx * 44}" y="${y + sy * 34 + 3.5}" text-anchor="middle" font-size="9" font-weight="700" fill="${CCOL[emit]}">${CARRY_SYM[emit]}</text></g>`;
		}

		let defs =
			'<defs>' +
			CCOL.map(
				(c, i) =>
					`<marker id="ah${i}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="${c}"/></marker><marker id="ah${c.slice(1)}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="${c}"/></marker>`
			).join('') +
			'</defs>';

		let s = `<svg viewBox="-150 -150 300 300" width="100%" style="max-width:360px;display:block;margin:0 auto">${defs}`;
		const pairs = [
			[2, 0, 2, [0, -46]],
			[2, 2, 0, [0, -70]],
			[0, 1, 3, [0, 46]],
			[0, 3, 1, [0, 70]],
			[1, 0, 1, [-46, 0]],
			[1, 1, 0, [-70, 0]],
			[1, 2, 3, [70, 0]],
			[1, 3, 2, [46, 0]]
		];
		for (const [c, da, db, bu] of pairs) {
			const [a, b] = shrink(P[da], P[db]);
			s += arrow(a, b, bu, CCOL[c], digitStep(c, da).emit, c);
		}
		s += loop(P[0], [-1, -1], CCOL[0], digitStep(0, 0).emit);
		s += loop(P[2], [1, -1], CCOL[0], digitStep(0, 2).emit);
		s += loop(P[1], [-1, 1], CCOL[2], digitStep(2, 1).emit);
		s += loop(P[3], [1, 1], CCOL[2], digitStep(2, 3).emit);
		for (const d of [0, 1, 2, 3]) {
			s += `<circle cx="${WPOS[d][0]}" cy="${WPOS[d][1]}" r="15" fill="#1e293b" stroke="#e2e8f0" stroke-width="1.5"/><text x="${WPOS[d][0]}" y="${WPOS[d][1] + 5}" text-anchor="middle" font-size="15" font-weight="700" fill="#e2e8f0">${d}</text>`;
		}
		const tok = wpWalk[wpStepIdx];
		const txy = tok != null ? WPOS[/** @type {0|1|2|3} */ (tok)] : null;
		s += `<circle cx="${txy ? txy[0] : 0}" cy="${txy ? txy[1] : 0}" r="7" fill="${COL.alive}" opacity="${txy ? 0.9 : 0}"/>`;
		return s + '</svg>';
	}

	function pushCarry(c) {
		manualChain = manualChain.concat([c]);
	}
	function clearChain() {
		manualChain = [];
	}
	function demoChain() {
		manualChain = [1, 2, 0, 0, 2, 1];
	}
	function wpRun() {
		const txt = wpStart.trim();
		if (!/^[0-3]+$/.test(txt)) {
			wpRows = null;
			return;
		}
		// Explainer column: first digit = TOP of column (not LSB-first Collatz)
		wpRows = runAligned(
			txt.split('').map((ch) => Number(ch)),
			10,
			32,
			{ lsbFirst: false }
		);
		wpLane = null;
		wpWalk = [];
		wpChain = [];
		wpStepIdx = 0;
	}
	/** @param {number} P */
	function selectLane(P) {
		if (!wpRows) return;
		wpLane = P;
		wpStepIdx = 0;
		const { chain, walk } = laneChainOf(wpRows, P);
		wpChain = chain;
		wpWalk = walk;
	}
	/** @param {(number|null|undefined)[]} chain */
	function chainResolveText(chain) {
		const R = resolveChain(chain);
		if (!R.n) return 'empty chain — identity';
		const mapTxt = R.map.map((v, d) => `${d}→${v}`).join('  ');
		return (
			`carries as base 3: ${R.b3 || '—'} · ${R.n} steps → one ${R.kind}` +
			(R.kind === 'rotation' ? ` (rotate by ${R.map[0]})` : ` (d ↔ ${R.map[0]}−d)`) +
			` · ${mapTxt}` +
			(R.kind === 'rotation' && R.map[0] === 0 ? ' · identity' : '')
		);
	}

	onMount(() => {
		if (!browser) return;
		reset();
		resize();
		const ro = new ResizeObserver(() => {
			resize();
			fitView();
		});
		if (wrapEl) ro.observe(wrapEl);
		return () => {
			stopAuto();
			ro.disconnect();
		};
	});

	$effect(() => {
		treeRev;
		if (browser && canvasEl && tree) draw();
	});
</script>

<svelte:head>
	<title>Collatz suffix sieve</title>
</svelte:head>

<div class="page">
	<header class="top">
		<div class="top-bar">
			<a class="home-btn" href="{base}/maths">← Maths</a>
			<h1 class="title">Suffix sieve</h1>
			<p class="sub">
				Trailing base-4 digits · modular Collatz certainty · prune when a·log₂3 − d &lt; 0
				<span class="frac">+{LOG2_3.toFixed(3)} / odd step</span>
			</p>
		</div>

		<div class="controls">
			<button type="button" class="btn primary" onclick={stepAndFit}>Reveal next digit</button>
			<button type="button" class="btn" onclick={toggleAuto}>{autoOn ? 'Pause' : 'Auto-run'}</button>
			<button type="button" class="btn" onclick={reset}>Reset</button>
			<button
				type="button"
				class="btn"
				onclick={() => {
					showWheel = !showWheel;
					if (showWheel && !wpRows) wpRun();
				}}
			>
				{showWheel ? 'Close wheel' : 'Carry wheel'}
			</button>
			<button type="button" class="btn" onclick={() => fitView()}>Fit view</button>
			<label class="chk">
				<input type="checkbox" bind:checked={ghostMode} onchange={() => rebuildKeepingDepth()} />
				expand pruned
			</label>
			<span class="stats">{hud}</span>
		</div>
		<p class="status" role="status">{status}</p>
	</header>

	<div class="stage" bind:this={wrapEl}>
		<canvas
			bind:this={canvasEl}
			class="tree"
			class:panning={!!drag}
			onpointerdown={onPointerDown}
			onpointermove={onPointerMove}
			onpointerup={onPointerUp}
			onpointercancel={onPointerUp}
			onwheel={onWheel}
		></canvas>

		{#if showInspector && selected && selected.result}
			{@const n = selected}
			{@const res = n.result}
			{@const lsb = suffixDigitsLsbFirst(n)}
			{@const disp = suffixDisplay(n)}
			{@const v = suffixValue(lsb)}
			{@const mod = 4 ** lsb.length}
			<aside class="inspector">
				<button
					type="button"
					class="close"
					onclick={() => {
						showInspector = false;
						selected = null;
						draw();
					}}>×</button
				>
				<h2>…{disp}<sub>4</sub></h2>
				<div class="meta">
					n ≡ {v} (mod {mod}) · {lsb.length} digit{lsb.length === 1 ? '' : 's'} · odd steps {res.mults}
					· halvings {res.stripsTotal}
				</div>
				<div class="meta">
					net width <b>{res.score >= 0 ? '+' : ''}{res.score.toFixed(3)} bits</b> · lowest {res.minScore.toFixed(3)}
					· known bits left {res.knownLeft}
				</div>
				<div class="meta">representative after determined steps: <b>{res.finalVal}</b></div>

				<ol class="steps">
					{#each res.steps as st, i}
						<li class={st.op}>
							<span class="op">{st.op === 'odd' ? '3n+1' : '÷2'}</span>
							<span class="val">→ {st.val}</span>
							<span class="sc">{st.score >= 0 ? '+' : ''}{st.score.toFixed(2)} · {st.known}b</span>
						</li>
					{/each}
					{#if res.steps.length === 0}
						<li class="muted">No determined steps (empty class edge).</li>
					{/if}
				</ol>

				<p class="hint-inline">
					Only steps forced by the known low bits are applied — same spirit as the residue-grid tail
					settlement: once certainty runs out, the branch either prunes (width already down) or waits
					for another trailing digit.
				</p>
				<div class="verdict {res.alive ? 'alive' : 'pruned'}">
					{#if res.alive}
						Alive — width never fell below start on the determined prefix. Reveal the next digit to
						split this class into four finer residues.
					{:else}
						Pruned — halvings already outweigh log₂3 growth. Every large enough n ending in …{disp}₄
						shrinks below its start. Branch closed.
					{/if}
				</div>
			</aside>
		{/if}

		{#if showWheel}
			<div class="wheel-panel" role="dialog" aria-label="Carry wheel">
				<div class="wp-grid">
					<div class="wp-card">
						<h2>The carry wheel</h2>
						<div class="wheel-svg">{@html wheelSvgMarkup()}</div>
						<p class="wp-note">
							Digit paths use the <b>explainer engine only</b>: 
							<code>num = (prev%4)·3 + shift</code>, then
							<code>dropStreamToZeroAt</code> (if last residue is 3 → write shift 1 then residual 2;
							everything below → 0). Each next row is <code>deriveLeftInto</code> (⌊num/4⌋ + drop).
							Wheel on the left is the ×3+c identity diagram only.
						</p>
						<h3>Chain resolver</h3>
						<div class="chips">
							<button type="button" class="chip c0" onclick={() => pushCarry(0)}>∅</button>
							<button type="button" class="chip c1" onclick={() => pushCarry(1)}>+</button>
							<button type="button" class="chip c2" onclick={() => pushCarry(2)}>++</button>
							<button type="button" class="chip" onclick={clearChain}>clear</button>
							<button type="button" class="chip" onclick={demoChain}>demo +,++,∅,∅,++,+</button>
						</div>
						<div class="chips">
							{#each manualChain as c}
								<span class="chip c{c}">{CARRY_SYM[c]}</span>
							{/each}
						</div>
						<div class="resolve">{chainResolveText(manualChain)}</div>
					</div>
					<div class="wp-card">
						<h2>Digit-aligned paths</h2>
						<div class="wp-row">
							<label>
								start residues top→bottom (base 4)
								<input type="text" bind:value={wpStart} />
							</label>
							<button type="button" class="btn" onclick={wpRun}>Run</button>
						</div>
						<p class="wp-note">
							Each row = one settled explainer column (digits = <code>num%4</code>). Rightmost live
							digits are the tail after <code>dropStreamToZeroAt</code> — they must end in 0, not loop.
						</p>
						{#if wpRows}
							<div class="stair" role="list">
								{#each wpRows as r}
									{@const maxW = Math.max(...wpRows.map((row) => row.digits.length))}
									<div class="stair-row" role="listitem">
										{#each Array.from({ length: maxW }, (_, i) => i) as P}
											<button
												type="button"
												class="stair-cell"
												class:lane-hit={P === wpLane}
												class:tail-zero={P < r.digits.length && r.digits[P] === 0 && P > 0}
												onclick={() => selectLane(P)}
												title="column row {P} (top=0) · num%4"
											>
												{P < r.digits.length ? r.digits[P] : '0'}
											</button>
										{/each}
										<span class="stair-kind">{r.kind || ''}</span>
									</div>
								{/each}
							</div>
						{/if}
						{#if wpChain.length}
							<div class="resolve">{chainResolveText(wpChain)}</div>
						{/if}
						<div class="wp-row">
							<button
								type="button"
								class="btn"
								onclick={() => {
									wpStepIdx = Math.max(0, wpStepIdx - 1);
								}}>←</button
							>
							<button
								type="button"
								class="btn"
								onclick={() => {
									wpStepIdx = Math.min(Math.max(wpWalk.length - 1, 0), wpStepIdx + 1);
								}}>→</button
							>
							<span class="wp-note">step {wpStepIdx} / {Math.max(0, wpWalk.length - 1)}</span>
						</div>
					</div>
				</div>
			</div>
		{/if}

		<div class="hint">
			drag to pan · scroll to zoom · click a node · green = alive · rust = pruned · k={levelsLen} · nodes={totalNodes}
		</div>
	</div>

	<footer class="foot">
		<a href="{base}/maths">Maths hub</a>
		<span class="dot">·</span>
		<a href="{base}/explainer">Residue grid</a>
		<span class="dot">·</span>
		<a href="{base}/explainer2">Base-4 tree</a>
		<span class="dot">·</span>
		<span class="muted">Suffix sieve</span>
	</footer>
</div>

<style>
	/* Body background lives in +layout / app.html */

	.page {
		min-height: 100vh;
		height: 100vh;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.top {
		flex: 0 0 auto;
		z-index: 30;
		background: #0f172f;
		border-bottom: 1px solid #1e293b;
		padding: 12px 16px 8px;
	}

	.top-bar {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 10px 14px;
		margin-bottom: 8px;
	}

	.home-btn {
		color: #7dd3fc;
		text-decoration: none;
		font-weight: 600;
		font-size: 0.9rem;
	}

	.title {
		margin: 0;
		font-size: 1.2rem;
		letter-spacing: -0.02em;
	}

	.sub {
		margin: 0;
		color: #94a3b8;
		font-size: 0.85rem;
		flex: 1 1 200px;
	}

	.frac {
		font-family: ui-monospace, SF Mono, Menlo, Consolas, monospace;
		font-size: 0.78rem;
		color: #38bdf8;
		margin-left: 6px;
	}

	.controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
	}

	.btn {
		border: 1px solid #334155;
		background: #1e293b;
		color: #e2e8f0;
		border-radius: 6px;
		padding: 7px 12px;
		font: inherit;
		font-size: 0.88rem;
		cursor: pointer;
	}

	.btn:hover {
		border-color: #38bdf8;
	}

	.btn.primary {
		background: #0c4a6e;
		border-color: #38bdf8;
		font-weight: 600;
	}

	.chk {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: 0.82rem;
		color: #94a3b8;
		cursor: pointer;
		user-select: none;
	}

	.chk input {
		accent-color: #38bdf8;
	}

	.stats {
		font-family: ui-monospace, SF Mono, Menlo, Consolas, monospace;
		font-size: 0.78rem;
		color: #94a3b8;
		padding: 5px 10px;
		background: #1e293b88;
		border-radius: 8px;
	}

	.status {
		margin: 6px 0 0;
		font-size: 0.8rem;
		color: #94a3b8;
		min-height: 1.2em;
	}

	.stage {
		position: relative;
		flex: 1 1 auto;
		min-height: 320px;
		overflow: hidden;
	}

	.tree {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		cursor: grab;
		touch-action: none;
		display: block;
	}

	.tree.panning {
		cursor: grabbing;
	}

	.inspector {
		position: absolute;
		top: 12px;
		right: 12px;
		width: min(420px, 92vw);
		max-height: calc(100% - 24px);
		overflow: auto;
		background: #1e293bf5;
		border: 1px solid #334155;
		border-radius: 10px;
		box-shadow: 0 8px 28px #00000055;
		padding: 14px 16px;
		font-size: 12.5px;
		line-height: 1.55;
		z-index: 10;
	}

	.inspector h2 {
		font-size: 1.05rem;
		margin: 0 0 6px;
	}

	.meta {
		color: #94a3b8;
		margin: 2px 0;
		font-family: ui-monospace, SF Mono, Menlo, Consolas, monospace;
		font-size: 12px;
	}

	.meta b {
		color: #e2e8f0;
	}

	.steps {
		margin: 10px 0 0;
		padding: 0 0 0 1.1rem;
		font-family: ui-monospace, SF Mono, Menlo, Consolas, monospace;
		font-size: 11.5px;
		max-height: 220px;
		overflow: auto;
	}

	.steps li {
		margin: 3px 0;
		color: #cbd5e1;
	}

	.steps .op {
		display: inline-block;
		min-width: 2.8rem;
		font-weight: 700;
	}

	.steps .odd .op {
		color: #fbbf24;
	}

	.steps .halve .op {
		color: #38bdf8;
	}

	.steps .sc {
		color: #64748b;
		margin-left: 6px;
	}

	.hint-inline {
		color: #64748b;
		margin: 10px 0 0;
		font-size: 11.5px;
	}

	.verdict {
		margin-top: 10px;
		padding: 8px 10px;
		border-radius: 6px;
	}

	.verdict.alive {
		background: #064e3b88;
		color: #6ee7b7;
	}

	.verdict.pruned {
		background: #7f1d1d66;
		color: #fca5a5;
	}

	.close {
		position: absolute;
		top: 8px;
		right: 10px;
		border: none;
		background: none;
		color: #94a3b8;
		font-size: 18px;
		cursor: pointer;
		line-height: 1;
	}

	.wheel-panel {
		position: absolute;
		inset: 0;
		background: #0f172af5;
		overflow: auto;
		padding: 16px 18px 40px;
		z-index: 15;
	}

	.wp-grid {
		display: grid;
		grid-template-columns: minmax(280px, 380px) minmax(0, 1fr);
		gap: 18px;
		max-width: 1280px;
		margin: 0 auto;
	}

	@media (max-width: 880px) {
		.wp-grid {
			grid-template-columns: 1fr;
		}
	}

	.wp-card {
		background: #1e293b;
		border: 1px solid #334155;
		border-radius: 10px;
		padding: 14px 16px;
		font-size: 0.88rem;
		line-height: 1.55;
	}

	.wp-card h2 {
		margin: 0 0 8px;
		font-size: 1.05rem;
	}

	.wp-card h3 {
		margin: 12px 0 6px;
		font-size: 0.9rem;
		color: #94a3b8;
	}

	.wp-note {
		color: #64748b;
		font-size: 0.8rem;
		margin: 6px 0;
	}

	.wp-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
		margin: 6px 0;
	}

	.wp-row label {
		display: flex;
		flex-direction: column;
		gap: 3px;
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: #64748b;
	}

	.wp-row input {
		background: #0f172a;
		border: 1px solid #334155;
		color: #e2e8f0;
		border-radius: 6px;
		padding: 6px 8px;
		font-family: ui-monospace, SF Mono, Menlo, Consolas, monospace;
		width: 8rem;
	}

	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 5px;
		margin: 6px 0;
	}

	.chip {
		padding: 2px 9px;
		border-radius: 999px;
		font-weight: 700;
		font-size: 0.8rem;
		border: 1px solid #334155;
		background: #0f172a;
		color: #94a3b8;
		cursor: pointer;
		font-family: ui-monospace, SF Mono, Menlo, Consolas, monospace;
	}

	button.chip {
		font: inherit;
		font-weight: 700;
		font-size: 0.8rem;
	}

	.chip.c0 {
		background: #33415555;
		color: #94a3b8;
	}
	.chip.c1 {
		background: #0c4a6e88;
		color: #7dd3fc;
		border-color: #38bdf866;
	}
	.chip.c2 {
		background: #7f1d1d66;
		color: #fca5a5;
		border-color: #f8717166;
	}

	.resolve {
		margin-top: 8px;
		padding: 8px 10px;
		border-radius: 6px;
		background: #064e3b44;
		color: #a7f3d0;
		font-family: ui-monospace, SF Mono, Menlo, Consolas, monospace;
		font-size: 0.8rem;
	}

	.stair {
		overflow-x: auto;
		background: #0f172a;
		border-radius: 8px;
		padding: 10px;
		margin: 8px 0;
	}

	.stair-row {
		display: flex;
		flex-wrap: nowrap;
		line-height: 1.75;
	}

	.stair-cell {
		border: none;
		background: transparent;
		color: #cbd5e1;
		font-family: ui-monospace, SF Mono, Menlo, Consolas, monospace;
		font-size: 0.9rem;
		padding: 0 0.2em;
		cursor: pointer;
		min-width: 1.1em;
		text-align: center;
	}

	.stair-cell.lane-hit {
		background: #064e3b;
		border-radius: 2px;
		color: #6ee7b7;
	}

	.stair-cell.tail-zero {
		color: #475569;
	}

	.stair-kind {
		margin-left: 10px;
		font-size: 0.7rem;
		color: #64748b;
		font-family: ui-monospace, SF Mono, Menlo, Consolas, monospace;
	}

	.hint {
		position: absolute;
		left: 14px;
		bottom: 12px;
		font-family: ui-monospace, SF Mono, Menlo, Consolas, monospace;
		font-size: 11.5px;
		color: #475569;
		pointer-events: none;
		z-index: 5;
	}

	.foot {
		flex: 0 0 auto;
		padding: 8px 16px;
		font-size: 0.85rem;
		color: #64748b;
		border-top: 1px solid #1e293b;
	}

	.foot a {
		color: #7dd3fc;
		text-decoration: none;
	}

	.dot {
		margin: 0 6px;
		opacity: 0.5;
	}

	.muted {
		color: #475569;
	}
</style>
