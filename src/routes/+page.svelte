<script>
	import { base } from '$app/paths';
	import { site } from '$lib/site.js';
</script>

<main>
	<section class="hero">
		<h1>Dvilicate's home</h1>
		<p>
			Interactive maths toys, visualisations, and rabbit holes — currently centred on the
			Collatz conjecture. Poke at the tools, argue about them on the forum, or come hang
			out on Discord.
		</p>
		<div class="cta">
			<a class="btn primary" href="{base}/maths">Explore the maths →</a>
			<a class="btn" href={site.discord} target="_blank" rel="noopener">Join the Discord</a>
		</div>
	</section>

	<section class="grid">
		<a class="card" href="{base}/maths">
			<h2>🔢 Cool maths stuff</h2>
			<p>Interactive Collatz explorers: hailstone sequences, residue grids, base-4 digit trees and suffix sieves.</p>
		</a>
		<a class="card" href="{base}/forum">
			<h2>💬 Forum</h2>
			<p>Discuss the tools, share findings, or suggest new visualisations — powered by GitHub Discussions.</p>
		</a>
		<a class="card" href="{base}/about">
			<h2>👋 About</h2>
			<p>What this site is, who makes it, and where it's headed.</p>
		</a>
		<a class="card kofi" href={site.kofi} target="_blank" rel="noopener">
			<h2>☕ Support</h2>
			<p>If something here made your day better, you can buy me a coffee on Ko-fi. No pressure — it's all free.</p>
		</a>
	</section>
</main>

<style>
	main {
		max-width: 960px;
		margin: 0 auto;
		padding: 48px 20px 64px;
	}

	.hero h1 {
		margin: 0 0 12px;
		font-size: 2.4rem;
		letter-spacing: -0.03em;
	}

	.hero p {
		margin: 0;
		color: #94a3b8;
		line-height: 1.6;
		max-width: 56ch;
		font-size: 1.05rem;
	}

	.cta {
		display: flex;
		gap: 12px;
		margin: 24px 0 8px;
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
		transition: border-color 0.15s, transform 0.15s;
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

	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
		gap: 14px;
		margin-top: 36px;
	}

	.card {
		display: block;
		padding: 20px;
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
		margin: 0 0 8px;
		font-size: 1.15rem;
	}

	.card p {
		margin: 0;
		font-size: 0.92rem;
		color: #94a3b8;
		line-height: 1.5;
	}
</style>
