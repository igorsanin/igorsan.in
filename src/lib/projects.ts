import { getCollection, type CollectionEntry } from 'astro:content';
import site from '../data/site.json';

export type Project = CollectionEntry<'projects'>;

const byYearThenOrder = (a: Project, b: Project) =>
  b.data.year - a.data.year || a.data.order - b.data.order;

/** Everything that gets a page: public + private. Hidden is never built. */
export async function builtProjects() {
  return (await getCollection('projects', (p) => p.data.visibility !== 'hidden')).sort(byYearThenOrder);
}

export async function publicProjects() {
  return (await builtProjects()).filter((p) => p.data.visibility === 'public');
}

export async function featuredProjects() {
  return (await publicProjects())
    .filter((p) => p.data.featured)
    .sort((a, b) => a.data.order - b.data.order || b.data.year - a.data.year);
}

/** Public projects live at /work/<slug>, private ones at /<vault>/<slug> (noindex). */
export const projectUrl = (p: Project) =>
  p.data.visibility === 'public' ? `/work/${p.id}` : `/${site.vault}/${p.id}`;

export const metaLine = (p: Project) =>
  [p.data.year, p.data.client].filter(Boolean).join(' · ');
