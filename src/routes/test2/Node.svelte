<script>
	export let streamId;
	export let node;

	let width = 250;
	let height = 40;
	let nodeWidth = width / 12;

	function endPoint(index) {
		let end = ((index % 4) * 3 + 2) * nodeWidth + nodeWidth / 2;
		return end;
	}

	function startPoint(index) {
		return index * nodeWidth + nodeWidth / 2;
	}
</script>

<div class="custom-row">
	{#each Array(12) as _, index}
		<span class:circle={node.num == 11 - index}>
			{3 - (index % 4)}{index > 3 ? (index > 7 ? '' : '¹') : '²'}
		</span>
	{/each}
	<svg {height} {width}>
		{#each Array(12) as _, index}
			<line
				x1={startPoint(index)}
				y1="0"
				x2={endPoint(index)}
				y2={height}
				class={node.num == 11 - index ? 'highlighted' : 'regular'}
			/>
		{/each}
	</svg>
	<div class="floating3s">
		|{node.nodeShift > 0 ? node.nodeShift : ''}{'>'.repeat(node.nodeShift)}
	</div>
	<div class="floating2s">
		{Math.floor(node.num / 4) > 0
			? '<'.repeat(Math.floor(node.num / 4)) + Math.floor(node.num / 4)
			: ''}
	</div>
</div>

<style>
	.custom-row {
		position: relative;
		width: 250px;
		background-color: #666;
	}

	span {
		width: 8.33%;
		display: inline-block;
		text-align: center;
		box-sizing: border-box;
		font-size: larger;
	}

	span.circle {
		border-radius: 8px 8px 8px;
		border: 2px solid red;
		font-weight: bold;
	}

	line.regular {
		stroke: black;
		stroke-width: 1;
	}

	line.highlighted {
		stroke: red;
		stroke-width: 3;
	}

	.floating3s {
		position: absolute;
		bottom: 10px;
		left: 10px;
		font-size: xx-large;
		font-weight: bold;
		color: chartreuse;
	}

	.floating2s {
		position: absolute;
		bottom: 10px;
		right: 10px;
		font-size: xx-large;
		font-weight: bold;
		color: rgb(86, 132, 98);
	}
</style>
