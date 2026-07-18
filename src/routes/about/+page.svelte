<script>
	import { base } from '$app/paths';
	import { site } from '$lib/site.js';
</script>

<main>
	<h1>About</h1>
	<p>
		Hi — I'm Dvilicate. This site is my home for interactive maths experiments: things
		that are easier to <em>play with</em> than to read about.
	</p>
	<p>
		Right now it's all about the <strong>Collatz conjecture</strong> — the deceptively
		simple "3n + 1" problem that nobody has managed to prove. The
		<a href="{base}/maths">maths section</a> has interactive tools for exploring hailstone
		sequences, residue grids, base-4 digit trees, and suffix sieves. More topics may show
		up over time.
	</p>
	<p>
		Everything here is free and open source —
		<a href={site.repo} target="_blank" rel="noopener">the code lives on GitHub</a>.
		If you spot a bug, have an idea, or just want to talk maths, drop into the
		<a href="{base}/forum">forum</a> or the
		<a href={site.discord} target="_blank" rel="noopener">Discord server</a>.
	</p>
	<p>
		If you'd like to support the site, you can
		<a href={site.kofi} target="_blank" rel="noopener">buy me a coffee on Ko-fi ☕</a> —
		entirely optional, always appreciated.
	</p>
</main>

<style>
	main {
		max-width: 720px;
		margin: 0 auto;
		padding: 48px 20px 64px;
		line-height: 1.7;
	}

	h1 {
		margin: 0 0 16px;
		font-size: 2rem;
		letter-spacing: -0.03em;
	}

	p {
		color: #cbd5e1;
		margin: 0 0 16px;
	}

	a {
		color: #38bdf8;
	}
</style>
