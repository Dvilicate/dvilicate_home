<script>
	import { createEventDispatcher } from 'svelte';

	export let index;
	export let position; // Horizontal position (0, 1, or 2)

	const dispatch = createEventDispatcher();

	let startX = 0; // Initial mouse position when drag starts
	let currentX = 0; // Track current mouse position during drag
	let dragging = false; // Whether dragging is active
	let lockPos = 0;

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
		let isMovable = true;

		// Set thresholds for movement (e.g., 100px to trigger left or right move)
		console.log(lockPos, lockPos < 1);
		if (deltaX > 30 && lockPos < 1) {
			lockPos = 1;
			move('right');
			console.log('max 1', deltaX);
			//handleMouseUp();  // Stop dragging after moving
		} else if (deltaX < -30 && lockPos > -1) {
			lockPos = -1;
			move('left');
			console.log('min 1', deltaX);
			//handleMouseUp();  // Stop dragging after moving
		}

		if (deltaX > 200 && lockPos < 2) {
			lockPos = 2;
			console.log('min 2', deltaX);
			move('right');
		} else if (deltaX < -200 && lockPos > -2) {
			lockPos = -2;
			console.log('max 2', deltaX);
			move('left');
		}
	}

	function handleMouseUp() {
		dragging = false;
		window.removeEventListener('mousemove', handleMouseMove);
		window.removeEventListener('mouseup', handleMouseUp);
	}

	const move = (direction) => {
		dispatch('move', { index, direction });
	};
</script>

<!-- Div listens for mousedown to begin dragging -->
<div
	role="button"
	tabindex="0"
	class="section"
	style="transform: translateX({position * 60}px); padding: 0px; background-color: grey"
	on:mousedown={handleMouseDown}
>
	<!--h2>Section {index + 1}</h2-->
	<img src={'/collNode.png'} draggable="false" height="160" alt="Drag left or right to move" />
</div>

<style>
	.section {
		border: 2px solid #ccc;
		padding: 0px;
		background-color: #f9f9f9;
		transition: transform 0.25s ease;
		user-select: none; /* Disable text selection while dragging */
		cursor: grab;
	}

	.section:active {
		cursor: grabbing;
	}
</style>
