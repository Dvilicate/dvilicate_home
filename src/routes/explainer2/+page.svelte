<script>
	import { base } from '$app/paths';
	import Base4TreeNode from '$lib/components/Base4TreeNode.svelte';
	import {
		DIGIT_ORDER,
		collapseAll,
		countAllocated,
		countVisible,
		createRootNodes,
		expandToDepth,
		maxVisibleDepth,
		resetTree,
		setAllEnabled
	} from '$lib/base4Tree.js';

	/** @type {import('$lib/base4Tree.js').TreeNode[]} */
	let roots = $state(createRootNodes());

	/** Bump to force re-read of derived stats after mutations. */
	let rev = $state(0);

	let expandDepth = $state(2);
	let status = $state('Four root digits ready — expand a node to spawn 0, 1, 3, 2.');

	const MAX_ALLOC = 2000;

	let visible = $derived.by(() => {
		rev;
		return countVisible(roots);
	});
	let allocated = $derived.by(() => {
		rev;
		return countAllocated(roots);
	});
	let depth = $derived.by(() => {
		rev;
		return maxVisibleDepth(roots);
	});

	function bump(msg) {
		rev++;
		if (msg) status = msg;
	}

	function onTreeChange() {
		bump(
			`Visible ${countVisible(roots)} · allocated ${countAllocated(roots)} · max depth ${maxVisibleDepth(roots)}`
		);
	}

	function doExpandToDepth() {
		const target = Math.max(0, Math.min(8, Number(expandDepth) || 0));
		const { expanded, stopped } = expandToDepth(roots, target, MAX_ALLOC);
		bump(
			stopped
				? `Stopped at ~${MAX_ALLOC} nodes (safety cap). Expanded ${expanded} open steps to depth ${target}.`
				: `Expanded toward depth ${target} (${expanded} open steps).`
		);
	}

	function doCollapseAll() {
		collapseAll(roots);
		bump('Collapsed to roots only (subtree toggles kept in memory).');
	}

	function doEnableAll() {
		setAllEnabled(roots, true);
		bump('All allocated nodes enabled.');
	}

	function doDisableLeaves() {
		// Keep roots; disable every non-root allocated node
		/** @param {import('$lib/base4Tree.js').TreeNode[]} nodes @param {boolean} isRoot */
		function go(nodes, isRoot) {
			for (const n of nodes) {
				if (!isRoot) {
					n.enabled = false;
					n.expanded = false;
				}
				if (n.children.length) go(n.children, false);
			}
		}
		go(roots, true);
		bump('Disabled all non-root nodes.');
	}

	function doReset() {
		roots = resetTree();
		bump('Tree reset — four fresh roots (0, 1, 3, 2).');
	}
</script>

<svelte:head>
	<title>Base-4 digit tree — Collatz explainer</title>
</svelte:head>

<div class="page">
	<header class="top">
		<div class="top-bar">
			<a class="home-btn" href="{base}/maths" title="Back to maths section">← Maths</a>
			<h1 class="title">Base-4 digit tree</h1>
			<p class="sub">
				Spawn order <strong>0 · 1 · 3 · 2</strong> · enable/disable to prune · path =
				base-4 value
			</p>
		</div>

		<form
			class="controls"
			onsubmit={(e) => {
				e.preventDefault();
				doExpandToDepth();
			}}
		>
			<label class="field narrow">
				<span>To depth</span>
				<input
					class="no-spin"
					type="number"
					min="0"
					max="8"
					bind:value={expandDepth}
				/>
			</label>
			<button type="submit" class="btn primary" title="Expand enabled branches down to this depth">
				Expand
			</button>
			<button type="button" class="btn" onclick={doCollapseAll}>Collapse all</button>
			<button type="button" class="btn" onclick={doEnableAll}>Enable all</button>
			<button type="button" class="btn" onclick={doDisableLeaves}>Disable non-roots</button>
			<button type="button" class="btn danger" onclick={doReset}>Reset</button>

			<span class="stats" title="Visible = on-screen · Allocated = including collapsed memory">
				<span><b>{visible}</b> visible</span>
				<span><b>{allocated}</b> allocated</span>
				<span>depth <b>{depth < 0 ? '—' : depth}</b></span>
			</span>
		</form>

		<p class="status" role="status">{status}</p>
	</header>

	<section class="legend">
		<span class="leg-title">Digits</span>
		{#each DIGIT_ORDER as d}
			<span class="chip d{d}">{d}</span>
		{/each}
		<span class="leg-hint">
			Click a node (or ▸) to spawn four children · uncheck <em>on</em> to disable and hide
			its branch · future automation can flip enable by condition
		</span>
	</section>

	<div class="tree-scroll">
		<div class="tree-root" role="tree">
			{#each roots as node (node.id)}
				<Base4TreeNode {node} parentPath={[]} depth={0} onChange={onTreeChange} />
			{/each}
		</div>
	</div>

	<footer class="foot">
		<a href="{base}/maths">Maths hub</a>
		<span class="dot">·</span>
		<a href="{base}/explainer">Residue grid</a>
		<span class="dot">·</span>
		<span class="muted">Base-4 tree explainer</span>
	</footer>
</div>

<style>
	:global(body) {
		margin: 0;
		background: #0f172a;
		color: #e2e8f0;
		font-family: 'Segoe UI', system-ui, sans-serif;
	}

	.page {
		min-height: 100vh;
		display: flex;
		flex-direction: column;
		padding: 0 0 32px;
	}

	.top {
		position: sticky;
		top: 0;
		z-index: 20;
		background: linear-gradient(180deg, #0f172af2 70%, #0f172a00);
		padding: 14px 18px 8px;
		backdrop-filter: blur(6px);
	}

	.top-bar {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 10px 16px;
		margin-bottom: 10px;
	}

	.home-btn {
		color: #7dd3fc;
		text-decoration: none;
		font-size: 0.9rem;
		font-weight: 600;
	}

	.home-btn:hover {
		color: #bae6fd;
	}

	.title {
		margin: 0;
		font-size: 1.25rem;
		letter-spacing: -0.02em;
	}

	.sub {
		margin: 0;
		color: #94a3b8;
		font-size: 0.88rem;
		flex: 1 1 200px;
	}

	.sub strong {
		color: #cbd5e1;
		font-weight: 700;
		letter-spacing: 0.04em;
	}

	.controls {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		gap: 8px 10px;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 3px;
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: #64748b;
	}

	.field.narrow input {
		width: 4.5rem;
	}

	input {
		background: #1e293b;
		border: 1px solid #334155;
		color: #e2e8f0;
		border-radius: 6px;
		padding: 6px 8px;
		font: inherit;
	}

	.no-spin::-webkit-outer-spin-button,
	.no-spin::-webkit-inner-spin-button {
		-webkit-appearance: none;
		margin: 0;
	}
	.no-spin {
		-moz-appearance: textfield;
		appearance: textfield;
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

	.btn.danger {
		border-color: #7f1d1d;
		color: #fca5a5;
	}

	.btn.danger:hover {
		border-color: #ef4444;
	}

	.stats {
		display: inline-flex;
		flex-wrap: wrap;
		gap: 10px 14px;
		margin-left: 6px;
		padding: 6px 10px;
		background: #1e293b88;
		border-radius: 8px;
		font-size: 0.82rem;
		color: #94a3b8;
	}

	.stats b {
		color: #e2e8f0;
		font-variant-numeric: tabular-nums;
	}

	.status {
		margin: 8px 0 0;
		font-size: 0.82rem;
		color: #64748b;
		min-height: 1.2em;
	}

	.legend {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px 10px;
		padding: 4px 18px 12px;
		font-size: 0.85rem;
		color: #94a3b8;
	}

	.leg-title {
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: #64748b;
	}

	.chip {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.6rem;
		height: 1.6rem;
		border-radius: 6px;
		border: 2px solid;
		font-weight: 800;
		font-variant-numeric: tabular-nums;
	}

	.chip.d0 {
		border-color: #64748b;
		color: #94a3b8;
	}
	.chip.d1 {
		border-color: #38bdf8;
		color: #7dd3fc;
	}
	.chip.d3 {
		border-color: #f59e0b;
		color: #fbbf24;
	}
	.chip.d2 {
		border-color: #34d399;
		color: #6ee7b7;
	}

	.leg-hint {
		flex: 1 1 220px;
		font-size: 0.8rem;
		line-height: 1.4;
	}

	.tree-scroll {
		flex: 1;
		overflow: auto;
		padding: 12px 18px 28px;
	}

	.tree-root {
		display: flex;
		flex-wrap: nowrap;
		justify-content: center;
		align-items: flex-start;
		gap: 18px;
		min-width: min-content;
		padding: 8px 12px 40px;
	}

	.foot {
		padding: 8px 18px;
		font-size: 0.85rem;
		color: #64748b;
	}

	.foot a {
		color: #7dd3fc;
		text-decoration: none;
	}

	.foot a:hover {
		text-decoration: underline;
	}

	.dot {
		margin: 0 6px;
		opacity: 0.5;
	}

	.muted {
		color: #475569;
	}
</style>
