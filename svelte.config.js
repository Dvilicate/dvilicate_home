import adapter from '@sveltejs/adapter-static';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		adapter: adapter({
			// Static files go in `build/`
			pages: 'build',
			assets: 'build',
			// SPA fallback for hosts that don't rewrite unknown paths
			fallback: '200.html',
			precompress: false,
			strict: true
		}),
		prerender: {
			entries: ['*']
		}
	}
};

export default config;
