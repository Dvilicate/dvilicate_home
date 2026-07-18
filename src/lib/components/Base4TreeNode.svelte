<script>
	import Base4TreeNode from './Base4TreeNode.svelte';
	import {
		pathToBase4,
		pathToDecimal,
		toggleEnabled,
		toggleExpand
	} from '$lib/base4Tree.js';

	/**
	 * Recursive base-4 digit node.
	 * @type {{
	 *   node: import('$lib/base4Tree.js').TreeNode,
	 *   parentPath?: number[],
	 *   depth?: number,
	 *   onChange?: () => void
	 * }}
	 */
	let { node, parentPath = [], depth = 0, onChange = () => {} } = $props();

	let path = $derived(parentPath.concat(node.digit));
	let base4 = $derived(pathToBase4(path));
	let decimal = $derived(pathToDecimal(path));
	let hasKids = $derived(node.expanded && node.enabled && node.children.length > 0);
	let digitClass = $derived(`d${node.digit}`);

	function onToggleEnable(e) {
		e.stopPropagation();
		toggleEnabled(node);
		onChange();
	}

	function onToggleExpand(e) {
		e.stopPropagation();
		if (!node.enabled) return;
		toggleExpand(node);
		onChange();
	}
</script>

<div
	class="branch"
	class:disabled={!node.enabled}
	class:expanded={node.expanded && node.enabled}
	class:is-root={depth === 0}
	style="--depth: {depth}"
>
	<div class="node-wrap">
		<button
			type="button"
			class="node {digitClass}"
			class:off={!node.enabled}
			class:open={node.expanded && node.enabled}
			title="{base4}₄ = {decimal} · depth {depth}"
			onclick={onToggleExpand}
			disabled={!node.enabled}
		>
			<span class="digit">{node.digit}</span>
			<span class="meta">
				<span class="b4">{base4}<sub>4</sub></span>
				<span class="dec">= {decimal}</span>
			</span>
		</button>

		<div class="actions">
			<label class="en" title={node.enabled ? 'Disable node (hide children)' : 'Enable node'}>
				<input type="checkbox" checked={node.enabled} onchange={onToggleEnable} />
				<span class="en-label">{node.enabled ? 'on' : 'off'}</span>
			</label>
			{#if node.enabled}
				<button
					type="button"
					class="exp-btn"
					onclick={onToggleExpand}
					title={node.expanded ? 'Collapse children' : 'Spawn 0, 1, 3, 2'}
				>
					{node.expanded ? '▾' : '▸'}
				</button>
			{/if}
		</div>
	</div>

	{#if hasKids}
		<div class="children" role="group" aria-label="Children of {base4}₄">
			{#each node.children as child (child.id)}
				<Base4TreeNode node={child} parentPath={path} depth={depth + 1} {onChange} />
			{/each}
		</div>
	{/if}
</div>

<style>
	.branch {
		display: flex;
		flex-direction: column;
		align-items: center;
		min-width: 0;
		font-size: calc(1rem - min(var(--depth), 4) * 0.03rem);
	}

	.branch.disabled {
		opacity: 0.45;
	}

	.node-wrap {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		position: relative;
		z-index: 1;
	}

	/* Connector stem into this node (non-roots) */
	.node-wrap::before {
		content: '';
		position: absolute;
		top: -14px;
		left: 50%;
		width: 2px;
		height: 14px;
		background: #334155;
		transform: translateX(-50%);
		pointer-events: none;
	}

	.branch.is-root > .node-wrap::before {
		display: none;
	}

	.node {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
		min-width: 64px;
		padding: 8px 10px 6px;
		border-radius: 10px;
		border: 2px solid #475569;
		background: #1e293b;
		color: #e2e8f0;
		cursor: pointer;
		font: inherit;
		transition:
			border-color 0.15s,
			box-shadow 0.15s,
			transform 0.12s,
			opacity 0.15s;
	}

	.node:hover:not(:disabled) {
		transform: translateY(-1px);
		box-shadow: 0 4px 14px #00000044;
	}

	.node:disabled,
	.node.off {
		cursor: not-allowed;
		border-style: dashed;
	}

	.node.open {
		box-shadow:
			0 0 0 1px #38bdf855,
			0 0 16px #38bdf822;
	}

	.digit {
		font-size: 1.35rem;
		font-weight: 800;
		line-height: 1;
		font-variant-numeric: tabular-nums;
	}

	.meta {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0;
		font-size: 0.65rem;
		line-height: 1.2;
		color: #94a3b8;
		font-variant-numeric: tabular-nums;
	}

	.meta sub {
		font-size: 0.55em;
	}

	.dec {
		opacity: 0.85;
	}

	/* Digit accent colours */
	.node.d0 {
		border-color: #64748b;
	}
	.node.d0 .digit {
		color: #94a3b8;
	}
	.node.d1 {
		border-color: #38bdf8;
	}
	.node.d1 .digit {
		color: #7dd3fc;
	}
	.node.d3 {
		border-color: #f59e0b;
	}
	.node.d3 .digit {
		color: #fbbf24;
	}
	.node.d2 {
		border-color: #34d399;
	}
	.node.d2 .digit {
		color: #6ee7b7;
	}

	.actions {
		display: flex;
		align-items: center;
		gap: 6px;
		min-height: 22px;
	}

	.en {
		display: inline-flex;
		align-items: center;
		gap: 3px;
		font-size: 0.65rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: #64748b;
		cursor: pointer;
		user-select: none;
	}

	.en input {
		margin: 0;
		accent-color: #38bdf8;
		cursor: pointer;
	}

	.en-label {
		min-width: 1.4em;
	}

	.exp-btn {
		border: 1px solid #334155;
		background: #0f172a;
		color: #94a3b8;
		border-radius: 4px;
		width: 22px;
		height: 20px;
		padding: 0;
		line-height: 1;
		cursor: pointer;
		font-size: 0.75rem;
	}

	.exp-btn:hover {
		border-color: #38bdf8;
		color: #e2e8f0;
	}

	/* Children row under a horizontal rail */
	.children {
		display: flex;
		flex-wrap: nowrap;
		justify-content: center;
		align-items: flex-start;
		gap: 10px;
		margin-top: 14px;
		padding-top: 14px;
		position: relative;
	}

	/* Horizontal rail connecting siblings */
	.children::before {
		content: '';
		position: absolute;
		top: 0;
		left: 12.5%;
		right: 12.5%;
		height: 2px;
		background: #334155;
		pointer-events: none;
	}

	@media (max-width: 720px) {
		.children {
			flex-wrap: wrap;
			max-width: 100vw;
		}

		.children::before {
			display: none;
		}
	}
</style>
