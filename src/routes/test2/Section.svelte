<script>
	import { createEventDispatcher } from 'svelte';
	import Node from './Node.svelte';

	export let index;
	export let streamId;
	export let position; // Horizontal position (0, 1, or 2)
	export let node;

	const dispatch = createEventDispatcher();

	let startX = 0; // Initial mouse position when drag starts
	let currentX = 0; // Track current mouse position during drag
	let dragging = false; // Whether dragging is active
	let pixelsToMove = 50;

	function handleMouseDown(event) {
		startX = event.clientX;
		dragging = true;

		// Listen for mouse movement and mouse release
		window.addEventListener('mousemove', handleMouseMove);
		window.addEventListener('mouseup', handleMouseUp);
	}

	function handleMouseMove(event) {
		if (!dragging) return;

		currentX = event.clientX;
		const deltaX = currentX - startX;

		if (deltaX > pixelsToMove) {
			startX += pixelsToMove;
			move('right');
		} else if (deltaX < -pixelsToMove) {
			startX -= pixelsToMove;
			move('left');
		}

		return;
	}

	function handleMouseUp() {
		dragging = false;
		window.removeEventListener('mousemove', handleMouseMove);
		window.removeEventListener('mouseup', handleMouseUp);
	}

	const move = (direction) => {
		dispatch('move', { index, direction, streamId });
	};
</script>

<!-- Div listens for mousedown to begin dragging -->
<div>
	<div
		role="button"
		tabindex="0"
		class="section"
		style="transform: translateX({(position * 250) / 12}px); padding: 0px; margin-left: {Math.floor(
			node.shiftTotal / 12
		) * -250}px;"
		on:mousedown={handleMouseDown}
	>
		<!-- TODO:Revolve margin-left: {Math.floor(node.shiftTotal / 12) * -300}px;-->
		<span style="display: inline-block; margin-left:-250px"><Node {streamId} {node}></Node></span>
		<span style="display: inline-block;"><Node {streamId} {node}></Node></span>
		<!--img src={'/collNode.png'} draggable="false" height="80" alt="Drag left or right to move" /-->
	</div>
</div>

<style>
	.section {
		padding: 0px;
		transition: transform 0.25s ease;
		user-select: none; /* Disable text selection while dragging */
		cursor: grab;
		display: flex;
	}

	.section:active {
		cursor: grabbing;
	}
</style>
