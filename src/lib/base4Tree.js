/**
 * Base-4 Collatz digit tree.
 *
 * Each node is a digit in order 0 → 1 → 3 → 2. Expanding a node spawns
 * four children with the same order. Enable/disable prunes which branches
 * stay live (conditions can automate this later).
 */

/** Left→right spawn order for each generation. */
export const DIGIT_ORDER = Object.freeze([0, 1, 3, 2]);

/**
 * @typedef {{
 *   id: number,
 *   digit: number,
 *   enabled: boolean,
 *   expanded: boolean,
 *   children: TreeNode[]
 * }} TreeNode
 */

let _id = 1;
function nextId() {
	return _id++;
}

/**
 * @param {number} digit
 * @param {boolean} [enabled=true]
 * @returns {TreeNode}
 */
export function makeNode(digit, enabled = true) {
	return {
		id: nextId(),
		digit: digit | 0,
		enabled: !!enabled,
		expanded: false,
		children: []
	};
}

/** Four root nodes: 0, 1, 3, 2 — all enabled, not expanded. */
export function createRootNodes() {
	return DIGIT_ORDER.map((d) => makeNode(d, true));
}

/**
 * Spawn the four children if missing, mark expanded.
 * No-op when node is disabled.
 * @param {TreeNode} node
 * @returns {boolean} true if children are now shown
 */
export function expandNode(node) {
	if (!node || !node.enabled) return false;
	if (node.children.length === 0) {
		node.children = DIGIT_ORDER.map((d) => makeNode(d, true));
	}
	node.expanded = true;
	return true;
}

/**
 * Hide children (keeps them in memory so re-expand restores toggles).
 * @param {TreeNode} node
 */
export function collapseNode(node) {
	if (!node) return;
	node.expanded = false;
}

/**
 * Toggle expanded; expand creates children on first open.
 * @param {TreeNode} node
 */
export function toggleExpand(node) {
	if (!node) return;
	if (node.expanded) collapseNode(node);
	else expandNode(node);
}

/**
 * Enable or disable a node. Disabling collapses it (children hidden).
 * @param {TreeNode} node
 * @param {boolean} enabled
 */
export function setEnabled(node, enabled) {
	if (!node) return;
	node.enabled = !!enabled;
	if (!node.enabled) {
		node.expanded = false;
	}
}

/**
 * @param {TreeNode} node
 * @returns {boolean}
 */
export function toggleEnabled(node) {
	if (!node) return false;
	setEnabled(node, !node.enabled);
	return node.enabled;
}

/**
 * Walk visible (enabled + ancestor-expanded) nodes.
 * @param {TreeNode[]} roots
 * @param {(node: TreeNode, path: number[], depth: number) => void} visit
 */
export function walkVisible(roots, visit) {
	/** @param {TreeNode[]} nodes @param {number[]} path @param {number} depth */
	function go(nodes, path, depth) {
		for (const n of nodes) {
			const p = path.concat(n.digit);
			visit(n, p, depth);
			if (n.enabled && n.expanded && n.children.length) {
				go(n.children, p, depth + 1);
			}
		}
	}
	go(roots, [], 0);
}

/**
 * Count nodes currently shown (enabled chain from roots).
 * @param {TreeNode[]} roots
 */
export function countVisible(roots) {
	let n = 0;
	walkVisible(roots, () => {
		n++;
	});
	return n;
}

/**
 * Total nodes allocated (including collapsed/disabled subtrees).
 * @param {TreeNode[]} roots
 */
export function countAllocated(roots) {
	let n = 0;
	/** @param {TreeNode[]} nodes */
	function go(nodes) {
		for (const node of nodes) {
			n++;
			if (node.children.length) go(node.children);
		}
	}
	go(roots);
	return n;
}

/**
 * Max depth among visible nodes (0 = roots only).
 * @param {TreeNode[]} roots
 */
export function maxVisibleDepth(roots) {
	let m = -1;
	walkVisible(roots, (_n, _p, depth) => {
		if (depth > m) m = depth;
	});
	return m;
}

/**
 * Path digits → base-4 string (MSD first).
 * @param {number[]} path
 */
export function pathToBase4(path) {
	if (!path.length) return '∅';
	return path.join('');
}

/**
 * Path digits → decimal integer.
 * @param {number[]} path
 */
export function pathToDecimal(path) {
	let v = 0;
	for (const d of path) v = v * 4 + (d | 0);
	return v;
}

/**
 * Expand every currently visible+enabled leaf down to `targetDepth`
 * (root depth = 0). Caps growth so a single click cannot explode the tree.
 * @param {TreeNode[]} roots
 * @param {number} targetDepth
 * @param {number} [maxNodes=2000]
 * @returns {{ expanded: number, stopped: boolean }}
 */
export function expandToDepth(roots, targetDepth, maxNodes = 2000) {
	let expanded = 0;
	let stopped = false;
	let allocated = countAllocated(roots);

	/** @param {TreeNode[]} nodes @param {number} depth */
	function go(nodes, depth) {
		if (stopped) return;
		for (const node of nodes) {
			if (stopped) return;
			if (!node.enabled) continue;
			if (depth < targetDepth) {
				const wasEmpty = node.children.length === 0;
				if (!node.expanded || wasEmpty) {
					expandNode(node);
					expanded++;
					if (wasEmpty) allocated += DIGIT_ORDER.length;
				}
				if (allocated > maxNodes) {
					stopped = true;
					return;
				}
				go(node.children, depth + 1);
			}
		}
	}

	go(roots, 0);
	return { expanded, stopped };
}

/**
 * Collapse everything back to roots only (keeps root enable state).
 * @param {TreeNode[]} roots
 */
export function collapseAll(roots) {
	/** @param {TreeNode[]} nodes */
	function go(nodes) {
		for (const node of nodes) {
			node.expanded = false;
			if (node.children.length) go(node.children);
		}
	}
	go(roots);
}

/**
 * Set enabled on all currently allocated nodes.
 * @param {TreeNode[]} roots
 * @param {boolean} enabled
 */
export function setAllEnabled(roots, enabled) {
	/** @param {TreeNode[]} nodes */
	function go(nodes) {
		for (const node of nodes) {
			setEnabled(node, enabled);
			if (node.children.length) go(node.children);
		}
	}
	go(roots);
}

/**
 * Soft-reset: new roots, drop all history.
 * @returns {TreeNode[]}
 */
export function resetTree() {
	_id = 1;
	return createRootNodes();
}
