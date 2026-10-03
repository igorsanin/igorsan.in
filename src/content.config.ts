import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

// One file per project in src/content/projects/<slug>.md
// Edited through /admin (Sveltia CMS); field names here must match public/admin/config.yml
const projects = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/projects' }),
  schema: z.object({
    title: z.string(),
    year: z.number(),
    client: z.string().default(''),          // shown on the site ('' = anonymised)
    agency: z.string().default(''),          // partner studio, e.g. "Digital Lab"
    role: z.string().default(''),            // "Script & Direction"
    production: z.string().default(''),      // "Production: Digital Lab" / "Igor Sanin & team"
    summary: z.string().default(''),         // one line for cards and meta
    // public  = listed on the site and indexed
    // private = reachable only by direct link (/p/slug) and via selections; noindex
    // hidden  = not built at all
    visibility: z.enum(['public', 'private', 'hidden']).default('private'),
    tier: z.enum(['A', 'B', 'C', 'D']).default('C'), // risk tier from the catalog, internal only
    featured: z.boolean().default(false),    // shown in "Selected" on the home page
    order: z.number().default(100),          // lower = earlier within Selected
    sectors: z.array(z.string()).default([]),
    formats: z.array(z.string()).default([]),
    cover: z.string().default(''),           // /media/<slug>/cover.jpg
    video: z.object({
      vimeo: z.string().default(''),
      youtube: z.string().default(''),
      legacy: z.string().default(''),        // old Adobe Portfolio player id, until re-uploaded to Vimeo
      // extra videos: "vimeo:123456", "yt:abcDEF" or a Vimeo/YouTube link; size like the gallery
      // (old plain strings still accepted)
      more: z.array(z.union([
        z.string(),
        z.object({ id: z.string(), size: z.enum(['auto', 'full', 'half', 'third']).default('auto') }),
      ])).default([]),
    }).default({ vimeo: '', youtube: '', legacy: '', more: [] }),
    // /media/<slug>/NN.webp or .mp4; size: auto | full | half | third (old plain strings still accepted)
    gallery: z.array(z.union([
      z.string(),
      z.object({ file: z.string(), size: z.enum(['auto', 'full', 'half', 'third']).default('auto'), top: z.boolean().default(false) }),
    ])).default([]),
    credits: z.string().default(''),
    showCredits: z.boolean().default(true),
    award: z.string().default(''),
  }),
});

// Private selections: /s/<slug>, e.g. "gulf-pavilions"
const selections = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/selections' }),
  schema: z.object({
    title: z.string(),
    intro: z.string().default(''),
    projects: z.array(z.string()).default([]), // project slugs in display order
  }),
});

// Free-text pages (About)
const pages = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/pages' }),
  schema: z.object({
    title: z.string(),
    headline: z.string().default(''),
    portrait: z.string().default(''),
  }),
});

export const collections = { projects, selections, pages };
