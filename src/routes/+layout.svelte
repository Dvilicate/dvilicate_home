<script>
	import { base } from '$app/paths';
	import { page } from '$app/stores';
	import { site } from '$lib/site.js';

	const nav = [
		{ href: '/', label: 'Home' },
		{ href: '/about', label: 'About' },
		{ href: '/maths', label: 'Maths' },
		{ href: '/forum', label: 'Forum' }
	];

	function isActive(href, pathname) {
		const full = base + href;
		return href === '/' ? pathname === (base || '/') || pathname === base + '/' : pathname.startsWith(full);
	}
</script>

<div class="shell">
	<nav class="topnav">
		<a class="brand" href="{base}/">{site.name}</a>
		<div class="links">
			{#each nav as item}
				<a href="{base}{item.href}" class:active={isActive(item.href, $page.url.pathname)}>{item.label}</a>
			{/each}
			<a class="ext discord" href={site.discord} target="_blank" rel="noopener">Discord</a>
			<a class="ext kofi" href={site.kofi} target="_blank" rel="noopener">☕ Ko-fi</a>
		</div>
	</nav>

	<slot />

	<footer>
		<p>
			Made by Dvilicate ·
			<a href={site.repo} target="_blank" rel="noopener">Source on GitHub</a> ·
			<a href={site.discord} target="_blank" rel="noopener">Join the Discord</a>
		</p>
		<p class="support">
			Enjoying this? <a href={site.kofi} target="_blank" rel="noopener">Buy me a coffee on Ko-fi ☕</a>
		</p>
	</footer>
</div>

<style>
	:global(html),
	:global(body) {
		margin: 0;
		/* Explainer grey — single source of truth for the whole site */
		background: #1a1a1a;
		color: #e5e5e5;
		font-family: 'Segoe UI', system-ui, sans-serif;
	}

	.shell {
		min-height: 100vh;
		display: flex;
		flex-direction: column;
		background: #1a1a1a;
	}

	.shell > :global(main) {
		flex: 1;
	}

	.topnav {
		display: flex;
		align-items: center;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: 10px;
		padding: 14px 20px;
		border-bottom: 1px solid #2a2a2a;
		background: rgba(26, 26, 26, 0.92);
		position: sticky;
		top: 0;
		backdrop-filter: blur(6px);
		z-index: 50;
	}

	.brand {
		font-weight: 700;
		font-size: 1.05rem;
		color: #e2e8f0;
		text-decoration: none;
		letter-spacing: -0.02em;
	}

	.links {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 4px;
	}

	.links a {
		color: #94a3b8;
		text-decoration: none;
		padding: 6px 12px;
		border-radius: 8px;
		font-size: 0.92rem;
		transition: color 0.15s, background 0.15s;
	}

	.links a:hover {
		color: #e2e8f0;
		background: #1e293b;
	}

	.links a.active {
		color: #38bdf8;
		background: #1e293b;
	}

	.links a.discord {
		color: #a5b4fc;
	}

	.links a.kofi {
		color: #0f172a;
		background: #38bdf8;
		font-weight: 600;
	}

	.links a.kofi:hover {
		background: #7dd3fc;
	}

	footer {
		border-top: 1px solid #2a2a2a;
		padding: 20px;
		text-align: center;
		color: #888;
		font-size: 0.85rem;
	}

	footer p {
		margin: 4px 0;
	}

	footer a {
		color: #94a3b8;
	}

	footer a:hover {
		color: #38bdf8;
	}

	.support a {
		color: #38bdf8;
		font-weight: 600;
	}
</style>
