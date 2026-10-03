import { defineConfig } from 'astro/config';
import nbsp from './src/lib/nbsp-integration.mjs';
import mediaSizes from './src/lib/media-sizes.mjs';

export default defineConfig({
  site: 'https://igorsan.in',
  trailingSlash: 'always',
  build: { format: 'directory' },
  integrations: [mediaSizes(), nbsp()],
});
