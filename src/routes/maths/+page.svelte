<script>
	import { base } from '$app/paths';

	const sections = [
		{
			title: 'Collatz conjecture',
			desc: 'Tools for exploring the Collatz conjecture — hailstone sequences and the base-3 / residue-grid encoding.',
			links: [
				{
					href: '/explainer',
					title: 'Collatz Explainer',
					desc: 'Interactive hailstone sequence + base-3 / 12-slot residue grid. Full column walk, real numbers, step-through play.',
					tag: 'Residue grid',
					primary: true
				},
				{
					href: '/explainer2',
					title: 'Base-4 digit tree',
					desc: 'Starts with digits 0 · 1 · 3 · 2; each node spawns the same four. Enable/disable branches so the tree stays manageable.',
					tag: 'Tree',
					primary: false
				},
				{
					href: '/sieve',
					title: 'Suffix sieve',
					desc: 'Search all integers by trailing base-4 digits. Pure digit machine: prune when a·log₂3 − d dips below zero.',
					tag: 'Sieve',
					primary: false
				}
			]
		}
	];
</script>

<main>
	<header>
		<h1>Cool maths stuff</h1>
		<p>Interactive tools and visualisations. More topics coming — suggestions welcome on the forum or Discord.</p>
	</header>

	{#each sections as section}
		<section>
			<h2>{section.title}</h2>
			<p class="section-desc">{section.desc}</p>
			<div class="cards">
				{#each section.links as link}
					<a class="card" class:primary={link.primary} href="{base}{link.href}">
						<span class="tag">{link.tag}</span>
						<h3>{link.title}</h3>
						<p>{link.desc}</p>
					</a>
				{/each}
			</div>
		</section>
	{/each}
</main>

<style>
	main {
		max-width: 960px;
		margin: 0 auto;
		padding: 40px 20px 64px;
	}

	header h1 {
		margin: 0 0 8px;
		font-size: 2rem;
		letter-spacing: -0.03em;
	}

	header p,
	.section-desc {
		margin: 0;
		color: #94a3b8;
		line-height: 1.5;
		max-width: 52ch;
	}

	section {
		margin-top: 36px;
	}

	section h2 {
		margin: 0 0 6px;
		font-size: 1.35rem;
	}

	.cards {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
		gap: 14px;
		margin: 18px 0;
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

	.card.primary {
		background: linear-gradient(145deg, #0c4a6e, #1e293b);
		border-color: #38bdf8;
	}

	.tag {
		display: inline-block;
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		padding: 2px 8px;
		border-radius: 999px;
		background: #334155;
		color: #cbd5e1;
		margin-bottom: 10px;
	}

	.primary .tag {
		background: #38bdf8;
		color: #0f172a;
		font-weight: 700;
	}

	.card h3 {
		margin: 0 0 8px;
		font-size: 1.2rem;
	}

	.card p {
		margin: 0;
		font-size: 0.92rem;
		color: #94a3b8;
		line-height: 1.45;
	}
</style>
