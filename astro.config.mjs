import { defineConfig } from 'astro/config';
import nbsp from './src/lib/nbsp-integration.mjs';

export default defineConfig({
  site: 'https://igorsan.in',
  trailingSlash: 'always',
  build: { format: 'directory' },
  integrations: [nbsp()],
});
