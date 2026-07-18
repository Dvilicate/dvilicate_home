<script>
	import { writable } from 'svelte/store';
	import Section from './Section.svelte';

	export let sectionPositions = writable([0, 0, 0, 0, 0, 0, 0, 0]); // Track movement for each section

	function moveSection(event) {
		const { index, direction } = event.detail;

		sectionPositions.update((positions) => {
			const newPositions = [...positions];

			// Limit movement to 0, 1, or 2 positions
			if (direction === 'left' && newPositions[index] > 0) {
				newPositions[index] -= 1;
			} else if (direction === 'right' && newPositions[index] < 2) {
				newPositions[index] += 1;
			}

			// No need to reset children. They inherit parent movement naturally.
			return newPositions;
		});
	}

	function getCumulativePosition(index, positions) {
		// Get cumulative movement of all sections above the current one
		return positions.slice(index, positions.length).reduce((acc, pos) => acc + pos, 0);
	}
</script>

<main>
	{#each $sectionPositions as position, index}
		<Section
			{index}
			position={getCumulativePosition(index, $sectionPositions)}
			on:move={moveSection}
		/>
	{/each}
</main>

<style>
	main {
		display: flex;
		flex-direction: column;
		gap: 3px;
	}
</style>
