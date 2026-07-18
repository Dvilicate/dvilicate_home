<script>
	import { writable } from 'svelte/store';
	import Section from './Section.svelte';

	let id = 0;
	let typedNum10 = $state('12');
	let typedNum3 = $state('12');
	let tempNum = $state('0');

	class Node {
		num = $state(0);
		nodeShift = $state(0);
		shiftTotal = $state(0);
		streamPosition = $state(1);
		first = $state(false);
		last = $state(false);

		constructor() {
			this.id = id++;
		}
	}

	// TODO: deep copy
	let stream1 = [
		new Node(),
		new Node(),
		new Node(),
		new Node(),
		new Node(),
		new Node(),
		new Node(),
		new Node(),
		new Node(),
		new Node(),
		new Node(),
		new Node(),
		new Node(),
		new Node(),
		new Node(),
		new Node(),
		new Node(),
		new Node(),
		new Node(),
		new Node(),
		new Node(),
		new Node(),
		new Node(),
		new Node(),
		new Node(),
		new Node(),
		new Node(),
		new Node(),
		new Node(),
		new Node(),
		new Node(),
		new Node(),
		new Node(),
		new Node(),
		new Node(),
		new Node(),
		new Node(),
		new Node(),
		new Node(),
		new Node(),
		new Node(),
		new Node(),
		new Node(),
		new Node(),
		new Node(),
		new Node(),
		new Node(),
		new Node(),
		new Node(),
		new Node(),
		new Node(),
		new Node(),
		new Node(),
		new Node(),
		new Node(),
		new Node()
	];

	let streams = $state([structuredClone(stream1)]);

	for (let s = 0; s < 40; s++) {
		addStream();
	}

	function typeNum(typedNum, base = 3) {
		typedNum = baseConvert(typedNum, base, 3);
		typedNum = '0' + typedNum;
		let lastStream = streams[streams.length - 1];
		console.log(typedNum);
		for (let x = 0; x < lastStream.length; x++) {
			let char;
			let temp;
			if (typedNum.length > x) {
				char = typedNum[x];
				temp = Number(char);
			} else {
				temp = 0;
			}
			console.log(temp);
			if (temp < 3) {
				lastStream[x].nodeShift = temp;
			}
		}
		dropStreamNodeToZeroAt(lastStream, typedNum.length - 1);
		//setStreamNodeToZeroAt(lastStream, typedNum.length);

		// for (let x = 0; x < streams[streams.length - 1].length; x++) {
		// 	console.log(JSON.stringify(streams[streams.length - 1].toString(), null, 2));
		// }
		streams[streams.length - 2].forEach((item) => {
			console.log('num:', item.num, 'nodeShift:', item.nodeShift, 'shiftTotal:', item.shiftTotal);
		});
		// for (let x = 0; x < streams[streams.length - 1].length; x++) {
		// 	const obj = streams[streams.length - 1][x];
		// 	console.log(Object.entries(obj)); // Log key-value pairs of the object
		// }
		//realignStream(lastStream);
		realignLeftStreams(streams, streams.length - 1);
	}

	function moveSection(event) {
		const { index, streamId, direction } = event.detail;

		if (direction === 'left') {
			moveStreamNodeSpaces(streamId, index, -1);
		} else if (direction === 'right') {
			moveStreamNodeSpaces(streamId, index, 1);
		}
	}

	// affects current and above shift. Needs shiftTotal to be updated
	function shiftStreamNode(stream, nodeIndex, shift) {
		let tempShift = shift + stream[nodeIndex].nodeShift;
		if (tempShift > 2) {
			if (stream[nodeIndex - 1]) {
				shiftStreamNode(stream, nodeIndex - 1, tempShift - stream[nodeIndex].nodeShift);
			}
			tempShift = 2;
		} else if (tempShift < 0) {
			if (stream[nodeIndex - 1]) {
				shiftStreamNode(stream, nodeIndex - 1, tempShift);
			}
			tempShift = 0;
		}
		stream[nodeIndex].nodeShift = tempShift;
	}

	function realignStream(stream) {
		var shiftTotal = 0;
		let lastNum = 0;
		for (let x = 0; x < stream.length; x++) {
			stream[x].shiftTotal = stream[x].nodeShift + shiftTotal;
			shiftTotal = stream[x].shiftTotal;

			//stream[x].carry = stream[x].nodeShift; // TODO: not this
			resolveNum(stream[x], lastNum);
			lastNum = stream[x].num;
			//stream[x].num = stream[x].shiftTotal % 12; // just a test
		}
	}

	function realignLeftStreams(streams, streamId) {
		let currentStream = streams[streamId];
		let leftStream = streams[streamId - 1];
		let lastChangeNodeId = 0;
		if (leftStream && currentStream) {
			// for (let x = 0; x < leftStream.length; x++) {
			// 	leftStream[x].num = 0;
			// 	leftStream[x].nodeShift = 0;
			// }

			for (let x = 0; x < currentStream.length; x++) {
				leftStream[x].nodeShift = Math.floor(currentStream[x].num / 4);
				if (!!currentStream[x].num) {
					lastChangeNodeId = x;
				}
			}
			//realignStream(currentStream);
			dropStreamNodeToZeroAt(leftStream, lastChangeNodeId);
			realignLeftStreams(streams, streamId - 1);
			realignStream(leftStream);
		}
	}

	// TODO: figure this out later
	function realignRightStreams(streams, streamId) {
		let currentStream = streams[streamId];
		let rightStream = streams[streamId + 1];
		let lastChangeNodeId = 0;
		if (rightStream && currentStream) {
			let tempNum = 0;
			for (var x = currentStream.length - 1; x >= 0; x--) {
				rightStream[x].nodeShift = tempNum;
				tempNum += currentStream[x].nodeShift;
				tempNum = tempNum % 3;
				if (currentStream[x].num != 0) {
					lastChangeNodeId = x;
				}
			}
			realignStream(rightStream);
			//dropStreamNodeToZeroAt(rightStream, lastChangeNodeId);
			realignRightStreams(streams, streamId + 1);
		}
	}

	// drop next node to 0
	function dropStreamNodeToZeroAt(stream, nodeId) {
		let trueNum = stream[nodeId].num % 4; // 0-3
		if (stream[nodeId + 1]) {
			if (trueNum == 3) {
				stream[nodeId + 1].nodeShift = 1; // Not final node, shift next.
				nodeId += 1; // go to next node
				trueNum = 2; // 3 goes to 1, +1 gives 2
			}
			if (stream[nodeId + 1]) {
				stream[nodeId + 1].nodeShift = trueNum;
			}
		} else {
			return stream.length;
		}

		for (var x = nodeId + 2; x < stream.length; x++) {
			stream[x].nodeShift = 0;
		}
		realignStream(stream);
		return nodeId;
	}

	// same as drop, except the last digit doesn't move here
	function setStreamNodeToZeroAt(stream, nodeId) {
		let trueNum = stream[nodeId].num % 4; // 0-3
		if (!stream[nodeId]) {
			return stream.length;
		}

		realignStream(stream);
		for (var x = nodeId; x < stream.length; x++) {
			stream[x].nodeShift = 0;
			stream[x].num = 0;
			stream[x].shiftTotal = 0;
		}
		return nodeId;
	}

	// 9, 6, 3, 0, 9, 6, 3, 0, 9, 6, 3, 0
	let indexToNum = [0, 3, 6, 9, 0, 3, 6, 9, 0, 3, 6, 9];
	function resolveNum(node, lastNum) {
		node.num = indexToNum[lastNum] + node.nodeShift;
	}

	function moveStreamNodeSpaces(streamId, nodeIndex, spacesToMove) {
		let stream = streams[streamId];
		if (!stream[nodeIndex] || spacesToMove == 0) {
			return;
		}
		shiftStreamNode(stream, nodeIndex, spacesToMove);
		realignStream(stream);
		let endNode = dropStreamNodeToZeroAt(stream, nodeIndex);
		// TODO drop to zero here?
		// TODO testing affecting other streams
		realignLeftStreams(streams, streamId);
	}

	function addNode(streamId) {
		let newNode = new Node();
		//newNode.shiftTotal = streams[streamId][streams[streamId].length - 1].nodeShift;
		streams[streamId].push(newNode);
		realignStream(streams[streamId]);
		// temp TODO

		//stream = stream;
		console.log('yo yo yo', streams);
	}

	function addStream() {
		let streamLength = streams[streams.length - 1].length;
		let newStream = [];
		for (var x = 0; x < streamLength; x++) {
			newStream.push(new Node());
		}
		streams.push(newStream);
	}

	function baseConvert(numStr, baseInit, baseFinal) {
		const b10 = parseInt(numStr, baseInit);
		return b10.toString(baseFinal);
	}
</script>

<main style="width: max-content;">
	<div
		style="display:flex; width: 1500px; height: 140px;
  right: 0; top: 0; margin-left: auto;"
	>
		<div style="width: 100%; height: 70px; width:33%;">
			<h1 style="color: chartreuse;">
				base10 to base3: {baseConvert(typedNum10, 10, 3)}
			</h1>
			<input
				onkeyup={() => typeNum(typedNum10, 10)}
				bind:value={typedNum10}
				style="font-size: 35px;"
			/>
		</div>
		<div style="width: 100%; height: 70px; width:33%;">
			<h1 style="color: chartreuse;">
				base3 to base10: {baseConvert(typedNum3, 3, 10)}
			</h1>
			<input onkeyup={() => typeNum(typedNum3, 3)} bind:value={typedNum3} style="font-size: 35px" />
		</div>
		<div style="width: 100%; height: 70px; width:33%;">
			<h1 style="color: aqua;">
				base3 to base10 checker: {baseConvert(tempNum, 3, 10)}
			</h1>
			<input bind:value={tempNum} style="font-size: 35px" />
		</div>
	</div>
	<div
		class="parent-container grid"
		style="grid-template-columns: repeat({streams.length +
			1}, minmax(0, 1fr)); width: {(streams.length + 1) *
			270}px; column-gap: 20px; background-color: #222;"
	>
		{#each streams as stream, streamId}
			<div style="padding-left: 0px; overflow: hidden;">
				<!-- TODO:Revolve overflow: hidden; here-->
				{#each stream as node, index}
					<Section {index} {streamId} {node} position={node.shiftTotal} on:move={moveSection} />
				{/each}
				<button class="nodeButton" onclick={() => addNode(streamId)}>Add node</button>
			</div>
		{/each}
		<button class="nodeButton" onclick={() => addStream()}>Add stream</button>
	</div>
</main>

<style>
	main {
		display: flex;
		flex-direction: column;
		gap: 3px;
	}

	.grid {
		display: grid;
	}

	.nodeButton {
		font-size: x-large;
		width: 100%;
		height: 70px;
	}
</style>
