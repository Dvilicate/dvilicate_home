# Collatz residue-grid workspace

Interactive Svelte app for exploring the **Collatz conjecture** via a custom **base-3 / base-4 residue grid** (from the “explainer 29” diagram).

## What it’s for

Not a Collatz solver. A spatial calculator: encode numbers so **×3** and **÷2** look like digit shifts/carries. Drag cylinder sections, watch cascades, read mixed-radix values.

The **suffix sieve** (`/sieve`) is the other half of the story: trailing base-4 digits **force** whether a residue class still grows or is already proven to decrease for large \(n\). That corrects the popular “random hailstorm / coin-flip each step” picture — local up/down is patterned; the open problem is unbounded residual suffixes. Full write-up: [`docs/suffix-sieve.md`](docs/suffix-sieve.md).

## Core model

| Concept | Meaning |
|--------|---------|
| **Column** | Vertical stream of cells (top → bottom) |
| **Cell** | `nodeShift` 0–2 (ternary), `num` residue, `shiftTotal` cumulative |
| **12 slots** | Labels `3² 2² 1² 0² · 3¹ 2¹ 1¹ 0¹ · 3 2 1 0` |
| **Wiring** | `num ≈ (prev%4)·3 + nodeShift` · left carry `⌊num/4⌋` |
| **Wire map** | Top slot `i` → bottom `end = ((i%4)·3+2)` (explainer diagonals) |
| **Base 3** | Column value = `nodeShift` digits MSD-top |
| **Base 4** | Row value = `num%4` digits MSD-left across columns |

## UI (`/explainer` — main app)

- **Grid:** wide columns of **rotating cylinder sections** (clipped drum; slides with `shiftTotal`, wraps every 12, slight `rotateY` on drag).
- **Per cell:** full 12-slot strip + mesh; **3 shift options** (0–2) highlighted — red = selected, green dashed = others. Only this node rotates (unless overflow carries up).
- **Column header:** odd part of base-3 value (÷2 until odd); **editable** base-3 digits (surgical patch; clear-all then retype = fresh write).
- **Right sticky panel:** per-row base-4; ÷2 if ends in `2`₄; **editable** digits (same patch rules).
- **Cascade:** edit → column settles → neighbors rewrite (left/right/both); row-by-row anim optional; **non-blocking** (new edit restarts from that column).
- **Seed n:** base-3 digits into rightmost column, cascade left. Presets: 7, 12, 17, 27, 29, 41.

## Key files

```
src/lib/collatz.js          # engine: realign, carry, seed, cascade, digit edit, base-3/4 reads
src/lib/suffixSieve.js      # trailing base-4 suffix sieve (score / prune)
src/lib/components/GridCell.svelte  # cylinder cell + wires + 3 options
src/routes/explainer/       # residue-grid UI
src/routes/explainer2/      # base-4 spawn tree
src/routes/sieve/           # suffix sieve visualizer
src/routes/+page.svelte     # hub
docs/suffix-sieve.md        # sieve math: forced prefixes, score, patterns, caveats
scripts/verify-suffix-sieve.mjs  # independent checks vs real Collatz
```

## Mental model (one sentence)

**Base 3** = digits you nudge on a column (`nodeShift`); **base 4** = residue carry across a row (`num%4` / `⌊num/4⌋`); the grid is columns of rotating 12-slot sections whose wires are the explainer map, cascading left when you change a node.

## Dev

```bash
cd collatz && npm install && npm run dev
```

Open `/explainer`.

## Performance (large grids e.g. 30×35)

- **Lite cells:** full cylinder DOM mounts on column hover, global “Connections: all”, focus, or cascade-active; idle cells are ~5-node stubs.
- **Cascade:** frame snapshots share unchanged columns (COW); UI applies frames via `patchStreams` (keeps cell identity).
- **CSS:** dim uses opacity only (no filter); `content-visibility` on cells.
- Tip: uncheck “Animate row-by-row” on huge grids for fewer steps (still fast either way).

## Don’t break

- Wire geometry = original `startPoint` / `endPoint` (not vertical stubs).
- Cylinder must **move** with `shiftTotal` (not static label swap only); wrap copies need **same** option highlights.
- Digit editors **patch** nodes; full rewrite only after clear → retype.
- Cascades interruptible; don’t lock the grid while animating.
- Keep lite/full cell swap; don’t reintroduce full SVG on every idle cell.
