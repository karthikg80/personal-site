// @ts-check
import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';

import { slugRedirects } from './src/generated/slug-redirects.mjs';

// https://astro.build/config
export default defineConfig({
  site: 'https://karthikg.in',
  adapter: vercel(),
  redirects: slugRedirects,
});
