import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://igorsan.in',
  trailingSlash: 'never',
  build: { format: 'directory' },
});
