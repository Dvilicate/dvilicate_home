import adapter from '@sveltejs/adapter-static';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		adapter: adapter({
			// Static files go in `build/`
			pages: 'build',
			assets: 'build',
			// GitHub Pages serves 404.html for unknown paths — use it as the SPA fallback
			fallback: '404.html',
			precompress: false,
			strict: true
		}),
		paths: {
			// Set BASE_PATH=/collatz when deploying to a GitHub Pages project site
			base: process.env.BASE_PATH || ''
		},
		prerender: {
			entries: ['*']
		}
	}
};

export default config;
