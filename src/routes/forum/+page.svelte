<script>
	import { onMount } from 'svelte';
	import { site, giscus } from '$lib/site.js';

	const configured = Boolean(giscus.repoId && giscus.categoryId);
	let container;

	onMount(() => {
		if (!configured) return;
		const s = document.createElement('script');
		s.src = 'https://giscus.app/client.js';
		s.async = true;
		s.crossOrigin = 'anonymous';
		s.setAttribute('data-repo', giscus.repo);
		s.setAttribute('data-repo-id', giscus.repoId);
		s.setAttribute('data-category', giscus.category);
		s.setAttribute('data-category-id', giscus.categoryId);
		s.setAttribute('data-mapping', 'specific');
		s.setAttribute('data-term', 'Site forum');
		s.setAttribute('data-strict', '0');
		s.setAttribute('data-reactions-enabled', '1');
		s.setAttribute('data-emit-metadata', '0');
		s.setAttribute('data-input-position', 'top');
		s.setAttribute('data-theme', 'dark');
		s.setAttribute('data-lang', 'en');
		container.appendChild(s);
	});
</script>

<main>
	<h1>Forum</h1>
	<p class="intro">
		Discussion lives in this repo's GitHub Discussions — post below (a free GitHub account
		is all you need), or join the
		<a href={site.discord} target="_blank" rel="noopener">Discord server</a> for real-time chat.
	</p>

	{#if configured}
		<div class="giscus-wrap" bind:this={container}></div>
	{:else}
		<div class="setup-note">
			<h2>⚙️ Forum not wired up yet</h2>
			<p>To activate it (one-time, ~5 minutes):</p>
			<ol>
				<li>Enable <strong>Discussions</strong> on the GitHub repo (Settings → General → Features).</li>
				<li>Install the <a href="https://github.com/apps/giscus" target="_blank" rel="noopener">giscus app</a> on the repo.</li>
				<li>Visit <a href="https://giscus.app" target="_blank" rel="noopener">giscus.app</a>, enter the repo, pick a category, and copy the generated <code>repoId</code> / <code>categoryId</code> into <code>src/lib/site.js</code>.</li>
			</ol>
			<p>Until then, come chat on <a href={site.discord} target="_blank" rel="noopener">Discord</a>!</p>
		</div>
	{/if}
</main>

<style>
	main {
		max-width: 820px;
		margin: 0 auto;
		padding: 48px 20px 64px;
	}

	h1 {
		margin: 0 0 12px;
		font-size: 2rem;
		letter-spacing: -0.03em;
	}

	.intro {
		color: #94a3b8;
		line-height: 1.6;
		margin: 0 0 28px;
	}

	a {
		color: #38bdf8;
	}

	.giscus-wrap {
		min-height: 300px;
	}

	.setup-note {
		background: #1e293b;
		border: 1px solid #334155;
		border-radius: 12px;
		padding: 20px 24px;
		line-height: 1.7;
		color: #cbd5e1;
	}

	.setup-note h2 {
		margin: 0 0 8px;
		font-size: 1.15rem;
	}

	code {
		background: #0f172a;
		padding: 2px 6px;
		border-radius: 6px;
		font-size: 0.85em;
	}
</style>
