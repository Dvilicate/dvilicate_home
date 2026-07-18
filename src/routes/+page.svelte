<script>
	const links = [
		{
			href: '/explainer',
			title: 'Collatz Explainer',
			desc: 'Interactive hailstone sequence + base-3 / 12-slot residue grid. Full column walk, real numbers, step-through play.',
			tag: 'Recommended',
			primary: true
		}
	];
</script>

<main>
	<header>
		<h1>Collatz workspace</h1>
		<p>
			Tools for exploring the Collatz conjecture — hailstone sequences and the
			base-3 / residue-grid encoding.
		</p>
	</header>

	<div class="cards">
		{#each links as link}
			<a class="card" class:primary={link.primary} href={link.href}>
				<span class="tag">{link.tag}</span>
				<h2>{link.title}</h2>
				<p>{link.desc}</p>
			</a>
		{/each}
	</div>
</main>

<style>
	:global(body) {
		margin: 0;
		background: #0f172a;
		color: #e2e8f0;
		font-family: 'Segoe UI', system-ui, sans-serif;
	}

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

	header p {
		margin: 0;
		color: #94a3b8;
		line-height: 1.5;
		max-width: 52ch;
	}

	.cards {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
		gap: 14px;
		margin: 28px 0;
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

	.card h2 {
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
