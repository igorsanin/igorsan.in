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

/** Three related projects: same client, shared sectors/formats, same role; ties go to newer work. */
export function relatedProjects(p: Project, pool: Project[], n = 3): Project[] {
  const d = p.data;
  const score = (q: Project) => {
    const e = q.data;
    let s = 0;
    if (d.client && e.client === d.client) s += 4;
    s += 2 * e.sectors.filter((x) => d.sectors.includes(x)).length;
    s += 1.5 * e.formats.filter((x) => d.formats.includes(x)).length;
    if (d.role && e.role === d.role) s += 0.5;
    if (d.agency && e.agency === d.agency) s += 0.5;
    return s;
  };
  return pool
    .filter((q) => q.id !== p.id)
    .map((q) => ({ q, s: score(q) }))
    .sort((a, b) => b.s - a.s || b.q.data.year - a.q.data.year)
    .slice(0, n)
    .map((x) => x.q);
}
