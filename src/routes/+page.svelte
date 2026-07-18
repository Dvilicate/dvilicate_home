<script>
	import { base } from '$app/paths';
	import { site } from '$lib/site.js';

	const showcases = [
		{
			href: '/explainer',
			tag: 'Residue grid',
			title: 'Collatz Explainer',
			desc: 'Walk hailstone numbers on a base-3 / base-4 residue grid. Nudge digits, watch carries cascade left.',
			img: `${base}/showcase-explainer.png`,
			alt: 'Screenshot of the Collatz residue grid explainer'
		},
		{
			href: '/sieve',
			tag: 'Suffix sieve',
			title: 'Trailing-digit sieve',
			desc: 'Expand trailing base-4 digits. Green classes still grow; red ones are already forced to drop.',
			img: `${base}/showcase-sieve.svg`,
			alt: 'Suffix sieve tree expanded to four digit levels'
		},
		{
			href: '/sieve',
			tag: 'Carry wheel',
			title: 'The carry wheel',
			desc: 'How ×3+c turns base-4 digits into the next column — reflection, rotation, and carry symbols.',
			img: `${base}/showcase-wheel.png`,
			alt: 'Carry wheel diagram for base-4 Collatz digit steps'
		}
	];
</script>

<main>
	<section class="hero">
		<p class="eyebrow">Interactive Collatz tools</p>
		<h1>Dvilicate's home</h1>
		<p class="lead">
			Visual toys for the Collatz conjecture — residue grids, suffix sieves, and digit carry
			machines. Poke the demos, then dig into the maths.
		</p>
		<div class="cta">
			<a class="btn primary" href="{base}/explainer">Open the explainer →</a>
			<a class="btn" href="{base}/sieve">Try the sieve</a>
			<a class="btn ghost" href={site.discord} target="_blank" rel="noopener">Discord</a>
		</div>
	</section>

	<section class="showcase" aria-label="Featured tools">
		<header class="section-head">
			<h2>What you can explore</h2>
			<p>Three views of the same story — pick one and dive in.</p>
		</header>

		<div class="feature-grid">
			{#each showcases as item}
				<a class="feature" href="{base}{item.href}">
					<div class="preview">
						<img src={item.img} alt={item.alt} loading="lazy" />
					</div>
					<div class="body">
						<span class="tag">{item.tag}</span>
						<h3>{item.title}</h3>
						<p>{item.desc}</p>
						<span class="go">Open →</span>
					</div>
				</a>
			{/each}
		</div>
	</section>

	<section class="more">
		<a class="card" href="{base}/maths">
			<h2>🔢 All maths tools</h2>
			<p>Residue grid, base-4 digit tree, suffix sieve — full list.</p>
		</a>
		<a class="card" href="{base}/forum">
			<h2>💬 Forum</h2>
			<p>Discuss findings or suggest new visualisations.</p>
		</a>
		<a class="card" href="{base}/about">
			<h2>👋 About</h2>
			<p>What this site is and where it's headed.</p>
		</a>
		<a class="card kofi" href={site.kofi} target="_blank" rel="noopener">
			<h2>☕ Support</h2>
			<p>Buy me a coffee on Ko-fi if you like the toys.</p>
		</a>
	</section>
</main>

<style>
	main {
		max-width: 1100px;
		margin: 0 auto;
		padding: 40px 20px 72px;
	}

	.hero {
		max-width: 40rem;
		margin-bottom: 40px;
	}

	.eyebrow {
		margin: 0 0 8px;
		font-size: 0.8rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: #38bdf8;
	}

	.hero h1 {
		margin: 0 0 14px;
		font-size: clamp(2rem, 5vw, 2.6rem);
		letter-spacing: -0.03em;
		line-height: 1.15;
	}

	.lead {
		margin: 0;
		color: #94a3b8;
		line-height: 1.65;
		font-size: 1.08rem;
	}

	.cta {
		display: flex;
		gap: 10px;
		margin-top: 22px;
		flex-wrap: wrap;
	}

	.btn {
		display: inline-block;
		padding: 10px 18px;
		border-radius: 10px;
		text-decoration: none;
		color: #e2e8f0;
		background: #1e293b;
		border: 1px solid #334155;
		font-weight: 600;
		transition: border-color 0.15s, transform 0.15s, background 0.15s;
	}

	.btn:hover {
		border-color: #38bdf8;
		transform: translateY(-1px);
	}

	.btn.primary {
		background: #38bdf8;
		color: #0f172a;
		border-color: #38bdf8;
	}

	.btn.primary:hover {
		background: #7dd3fc;
		border-color: #7dd3fc;
	}

	.btn.ghost {
		background: transparent;
	}

	.section-head {
		margin-bottom: 18px;
	}

	.section-head h2 {
		margin: 0 0 6px;
		font-size: 1.35rem;
		letter-spacing: -0.02em;
	}

	.section-head p {
		margin: 0;
		color: #94a3b8;
		font-size: 0.95rem;
	}

	.feature-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 16px;
	}

	@media (max-width: 900px) {
		.feature-grid {
			grid-template-columns: 1fr;
		}
	}

	.feature {
		display: flex;
		flex-direction: column;
		border-radius: 14px;
		overflow: hidden;
		background: #1e293b;
		border: 1px solid #334155;
		text-decoration: none;
		color: inherit;
		transition: border-color 0.15s, transform 0.15s, box-shadow 0.15s;
		min-height: 100%;
	}

	.feature:hover {
		border-color: #38bdf8;
		transform: translateY(-3px);
		box-shadow: 0 12px 28px rgba(0, 0, 0, 0.35);
	}

	.preview {
		position: relative;
		aspect-ratio: 16 / 11;
		background: #0f172a;
		overflow: hidden;
		border-bottom: 1px solid #334155;
	}

	.preview img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		object-position: top center;
		display: block;
	}

	/* Sieve SVG is wide and short — show full tree */
	.feature:nth-child(2) .preview img {
		object-fit: contain;
		object-position: center;
		padding: 8px;
		box-sizing: border-box;
	}

	/* Wheel crop looks better contained */
	.feature:nth-child(3) .preview img {
		object-fit: contain;
		object-position: center top;
		padding: 6px 6px 0;
		box-sizing: border-box;
	}

	.body {
		padding: 16px 18px 18px;
		display: flex;
		flex-direction: column;
		flex: 1;
	}

	.tag {
		display: inline-block;
		align-self: flex-start;
		font-size: 0.68rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		padding: 2px 8px;
		border-radius: 999px;
		background: #334155;
		color: #cbd5e1;
		margin-bottom: 10px;
		font-weight: 600;
	}

	.body h3 {
		margin: 0 0 8px;
		font-size: 1.15rem;
	}

	.body p {
		margin: 0;
		font-size: 0.9rem;
		color: #94a3b8;
		line-height: 1.5;
		flex: 1;
	}

	.go {
		margin-top: 14px;
		font-size: 0.88rem;
		font-weight: 700;
		color: #38bdf8;
	}

	.feature:hover .go {
		color: #7dd3fc;
	}

	.more {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 12px;
		margin-top: 36px;
	}

	.card {
		display: block;
		padding: 18px;
		border-radius: 12px;
		background: #1e293b;
		border: 1px solid #334155;
		text-decoration: none;
		color: inherit;
		transition: border-color 0.15s, transform 0.15s;
	}

	.card:hover {
		border-color: #38bdf8;
		transform: translateY(-2px);
	}

	.card.kofi:hover {
		border-color: #f59e0b;
	}

	.card h2 {
		margin: 0 0 6px;
		font-size: 1.05rem;
	}

	.card p {
		margin: 0;
		font-size: 0.88rem;
		color: #94a3b8;
		line-height: 1.45;
	}
</style>
