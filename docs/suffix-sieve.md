# Collatz suffix sieve (base 4)

An interactive visualizer that searches **all integers at once** for Collatz
trajectories that could fail to decrease — using only their trailing base-4
digits.

In this app: open **`/sieve`**. Engine: `src/lib/suffixSieve.js`.

---

## The point (read this first)

Popular Collatz talk often sounds like a **random hailstorm**: each step is a
coin flip (odd → grow, even → shrink), so you cannot know whether a number is
about to increase or decrease.

**That slogan is the wrong difficulty model.**

For any fixed trailing suffix of \(k\) base-4 digits — equivalently the residue
class \(n \equiv v \pmod{4^k}\) — the next stretch of Collatz steps is
**completely forced**. Whether large members of that class are still above the
start, or already certified below it, is a **deterministic** verdict from those
digits alone.

| Idea people say | What is actually true |
|-----------------|------------------------|
| “We don’t know if it will go up or down” | Low bits **force** the next ops until certainty runs out |
| “The path is pure randomness” | Paths look wild because **higher digits keep getting pulled in**, not because each step is lawless |
| “Finding grow/shrink rules would solve Collatz” | Grow/shrink for a **finite** suffix is classical local theory; the open part is that **no finite depth kills every class** |

This sieve makes that local law visible as a tree: green = still allowed to grow
(on the forced prefix), rust = proven to decrease (for large \(n\)).

This is **not** a new proof of the conjecture. It is classical stopping-time /
coefficient reasoning (Terras-type), drawn so the structure is obvious.

---

## 1. Base 4 makes both halves of Collatz legible

Write \(n\) in base 4 (bit-pairs of binary):

| Trailing digit | Meaning | First forced move |
|----------------|---------|-------------------|
| **0** | \(n \equiv 0 \pmod 4\) | two free ÷2 available; first ÷2 already drops large \(n\) |
| **2** | \(n \equiv 2 \pmod 4\) | exactly one forced ÷2 |
| **1** | \(n \equiv 1 \pmod 4\) | odd → \(3n+1\), then enough ÷2 that large \(n\) fall: \((3n+1)/4 < n\) |
| **3** | \(n \equiv 3 \pmod 4\) | odd → \((3n+1)/2\) then more; **only** class that can still grow |

So the **last digit alone** decides the first rule. Level 1 of the tree:

- **Pruned (decreasing):** `…0`, `…1`, `…2`
- **Alive (still can increase):** only **`…3`**

Three quarters of all integers are certified “large members decrease” from a
single base-4 digit.

---

## 2. Growth accounting: the score

Track two counters on the **forced** prefix of a residue class:

- **\(a\)** = number of odd steps (\(3n+1\)) — each adds \(\log_2 3 \approx 1.585\) bits
- **\(d\)** = number of halvings (÷2) — each removes 1 bit

After those steps the value is exactly

\[
\frac{3^a \cdot n + c}{2^d}
\]

for some path-dependent constant \(c \ge 0\). Net width change in bits:

```
score = a · log₂ 3 − d
```

**Rule:**

- If at any point **`score < 0`** (equivalently \(3^a < 2^d\) in the large-\(n\)
  limit), then for every **sufficiently large** \(n\) in the class the current
  value is **below the start**. Prune the node (rust).
- If certainty runs out with **`score ≥ 0` throughout**, the class is **alive**
  (green): the digits we know have **not** forced a decrease. Reveal one more
  trailing digit and branch into four children.

The `+c` term only matters for finitely many small \(n\) (checkable separately;
exhaustive verification already covers huge ranges). This is the classical
**Terras / stopping-time coefficient** argument, not a new criterion.

### What “alive” and “pruned” mean

| Label | Meaning | Does **not** mean |
|-------|---------|-------------------|
| **Pruned** | Forced prefix proves large members **decrease** | Every tiny member checked by hand here |
| **Alive** | Forced prefix never went negative — class **still may** grow on that window | Diverges, or is a counterexample |
| **Score \(> 0\) (alive)** | Large members **increase** during the forced prefix | They stay large forever |

Alive nodes through depth 8 in this engine always end the forced window with
**final score \(> 0\)** and spend **all** known bits (\(d = 2k\) for \(k\) base-4
digits). Survival is exactly: enough odd steps relative to halvings,

\[
a > \frac{2k}{\log_2 3} \approx 1.26\,k.
\]

---

## 3. How the sieve runs

A **node** = a known suffix of \(k\) trailing base-4 digits  
= residue class \(n \equiv v \pmod{4^k}\)  
= \(2k\) known low bits.

1. Simulate only steps **forced for every** member of the class (parity known
   while at least one bit of certainty remains).
2. Each ÷2 spends one known bit; \(3n+1\) preserves the modulus size
   (multiply-by-3 is invertible mod \(2^m\)).
3. Track running `score`; **prune** the instant it dips below 0.
4. **Alive** → spawn four children by revealing one more **more-significant**
   trailing digit: suffix \(s \mapsto 0s, 1s, 2s, 3s\).

Implementation note: this app’s tree engine (`simulateClass` in
`suffixSieve.js`) runs that modular Collatz on the residue with BigInt. It is
equivalent in width accounting to a pure base-4 / carry transducer; the carry
wheel panel shows the digit form of the same ×3+c arithmetic.

### Survivor counts (verified)

| \(k\) | alive | share of \(4^k\) |
|------:|------:|-----------------:|
| 1 | 1 | 25% |
| 2 | 3 | 18.75% |
| 3 | 8 | 12.5% |
| 4 | 19 | 7.42% |
| 6 | 226 | 5.52% |
| 8 | 2,114 | 3.23% |

Density falls with \(k\) (Terras-type thinning). The frontier still grows in raw
count, but far slower than \(4^k\).

Re-check against real Collatz anytime:

```bash
cd collatz && node scripts/verify-suffix-sieve.mjs
```

---

## 4. Patterns: who increases, who decreases

These are **empirical regularities of the forced prefix**, visible step by step
in the tree — not a claim that the infinite path is solved.

### Hard filter (every depth)

Every **alive** node ends with trailing digit **3** (\(n \equiv 3 \pmod 4\)).
Nothing ending in 0, 1, or 2 ever stays alive.

Binary view after a little depth: survivors sit in \(\equiv 7,11,15 \pmod{16}\)
— never \(\equiv 3 \pmod{16}\) (that is the dead suffix `…03`).

### First levels (hand-checkable)

**\(k = 1\)**

- Alive: `…3`
- Dead: `…0`, `…1`, `…2`

**\(k = 2\)** (children of `…3`)

- Alive: `…13`, `…23`, `…33`
- Dead: **`…03` only**

**\(k = 3\)** — eight survivors; immediate new deaths include  
`…113`, `…313`, `…023`, `…223`.

**Strong family:** denser in digit **3** → higher typical score.  
All-`3`s (`…333…`) is consistently among the **most increasing** suffixes
(many odd steps, almost always valuation \(v_2(3n+1) = 1\)).

### The dynamical pattern: strips after each odd step

Write each odd step as \(T\) then \(H^v\) where \(v = v_2(3n+1)\) is the forced
run of ÷2.

- **Most increasing:** long runs of valuation **1** — almost always \((3n+1)/2\).
- **Barely alive / near prune:** a late **long** strip run (valuation 4–5+).
- Among deep survivors, mean valuation is **well below 2** (the mean for a
  “random” odd integer). Survivors are biased toward **stingy halvings**.

Mental model:

```
decreasing  =  forced path spends ÷2 faster than log₂3 per odd step
increasing  =  mostly short TH blocks; few long /16 or /32 runs
must end in  …3
stronger if  denser in 3’s; weaker if high 2-valuations appear early
```

### What is **not** patterned away

After \(k \approx 3\), the **newly revealed** high digit is only a weak filter
(survival rates by new digit 0/1/2/3 become similar). Almost all pruning is
decided by the **low digits already fixed**. Each new digit still thins the set;
it does not reintroduce a free coin flip at every step.

---

## 5. The carry wheel (digit form of ×3+c)

Because **\(3 \equiv -1 \pmod 4\)**, one ×3+c pass on a base-4 digit is

```
d  ↦  c − d  (mod 4)        c ∈ {∅, +, ++} = {0, 1, 2}
```

— a **reflection** of the digit wheel:

- **∅** swaps 1↔3, fixes 0 and 2  
- **+** swaps 0↔1 and 2↔3  
- **++** swaps 0↔2, fixes 1 and 3  

Emitted carry: \(\lfloor(3d + c)/4\rfloor\) (never 3: max \(3\cdot3+2 = 11\)).

Consequences:

1. Two successive steps compose to a **rotation**.
2. Any carry chain collapses to **one** reflection or rotation.
3. New leading digits are steered by the base-3 string of carries flowing up.

In the UI, **Carry wheel** shows that diagram. The staircase on the right uses
the **explainer column engine** (`collatz.js`: `realignStream`,
`dropStreamToZeroAt`, `deriveLeftInto`) — digit-aligned paths for lanes. The
**sieve tree** uses modular bit Collatz (`simulateClass`). Both agree on width
accounting; they interleave ÷2 half-steps differently. Do not mix their rules.

---

## 6. Reading the visualizer (`/sieve`)

- **Tree grows downward**, one level per revealed trailing digit; label = digit
  just revealed. Drag to pan, scroll to zoom.
- **Green** = alive; small `+x.xx` = net score in bits so far.  
  **Rust** = pruned (forced decrease for large \(n\)).
- **Click a node** → inspector: forced steps, \(a\), \(d\), score, min score,
  known bits left.
- **Reveal next digit** / **Auto-run** expand the frontier (depth / node budget
  caps apply). **Ghost mode** expands dead branches too (full 4-ary).

---

## 7. Honest caveats (what this does **not** settle)

1. **`score < 0` is asymptotic in the class.** It certifies decrease for
   sufficiently large members. Finitely many small members of a pruned class are
   not certified by the score alone (they are covered by existing exhaustive
   checks up to enormous bounds).

2. **Alive ≠ counterexample.** A class stays green because its *determined
   prefix* has not decreased. Reveal more digits and almost all of those classes
   die. Density of survivors → 0 as \(k → ∞\) (Terras-type). Surviving at every
   finite \(k\) would still not automatically be a divergent trajectory without
   further argument.

3. **The open core is unbounded residual suffixes.**  
   There is always some alive frontier at finite depth. The hard problem is not
   “is there a grow/shrink pattern for fixed digits?” (there is) but “can every
   integer be forced down with only **bounded** local information?” — and the
   answer in this framework is no: you may need arbitrarily many trailing digits
   in the worst case. That non-local residual is why the conjecture stays open.

4. **No claim of a new Collatz proof.** The local forced-prefix + score prune
   picture is standard coefficient / stopping-time reasoning. The contribution
   of this tool is **clarity**: the “random hailstorm” is residual uncertainty
   after low bits are spent, not lawlessness at each step.

5. **Step semantics** keep every factor of 2 explicit (trailing 2 → one
   halving; trailing 0 → two). Statistics differ from the shortcut map
   \(T(n)=(3n+1)/2\) common in the literature; convert before comparing counts.

---

## 8. Files in this project

| Path | Role |
|------|------|
| `src/lib/suffixSieve.js` | Modular sieve (`simulateClass`), tree expand, carry-wheel helpers, explainer-backed `runAligned` |
| `src/lib/collatz.js` | Explainer residue-grid engine (digit-aligned paths / last-node drop) |
| `src/routes/sieve/+page.svelte` | Tree UI + carry wheel |
| `docs/suffix-sieve.md` | This write-up |
| `scripts/verify-suffix-sieve.mjs` | Independent checks vs real Collatz |

Hub links: `/` → Residue grid (`/explainer`), base-4 tree (`/explainer2`), suffix sieve (`/sieve`).
