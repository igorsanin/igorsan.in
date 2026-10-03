// Build-time image sizes and gallery layout.
// Reads real pixel sizes from /public (images via sharp, mp4 from its track header, else its .jpg poster),
// so the page can (1) never stretch a picture past its real width and
// (2) pick a sensible size for "auto" gallery items.
import sharp from 'sharp';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export type Size = 'auto' | 'full' | 'half' | 'third';
export interface GalleryItem { file: string; size: Size }
export interface Placed { file: string; video: boolean; w: number; h: number; span: 2 | 3 | 6 }

const cache = new Map<string, { w: number; h: number } | null>();
export const isVideo = (s: string) => /\.(mp4|webm)$/i.test(s);
export const posterOf = (s: string) => s.replace(/\.(mp4|webm)$/i, '.jpg');

// Video frame size from the mp4 track header ('tkhd': width/height as 16.16 fixed point at its end).
function mp4Size(path: string): { w: number; h: number } | null {
  try {
    const b = readFileSync(path);
    let best: { w: number; h: number } | null = null;
    for (let i = b.indexOf('tkhd'); i !== -1; i = b.indexOf('tkhd', i + 4)) {
      const size = b.readUInt32BE(i - 4);
      const end = i - 4 + size;
      if (size < 84 || end > b.length) continue;
      const w = b.readUInt32BE(end - 8) >>> 16, h = b.readUInt32BE(end - 4) >>> 16;
      if (w && h && (!best || w > best.w)) best = { w, h };
    }
    return best;
  } catch { return null; }
}

export async function dims(src: string) {
  if (!src || !src.startsWith('/')) return null;
  if (isVideo(src)) {
    if (cache.has(src)) return cache.get(src)!;
    const p = join(process.cwd(), 'public', decodeURI(src));
    const v = existsSync(p) ? mp4Size(p) : null;
    if (v) { cache.set(src, v); return v; }
  }
  const file = isVideo(src) ? posterOf(src) : src;
  if (cache.has(file)) return cache.get(file)!;
  const p = join(process.cwd(), 'public', decodeURI(file));
  let out: { w: number; h: number } | null = null;
  if (existsSync(p)) {
    try {
      const m = await sharp(p).metadata();
      const w = m.autoOrient?.width ?? m.width, h = m.autoOrient?.height ?? m.height;
      if (w && h) out = { w, h };
    } catch { /* unreadable: leave unsized */ }
  }
  cache.set(file, out);
  return out;
}

// Columns out of 6: full = 6, half = 3, third = 2.
const SPAN = { full: 6, half: 3, third: 2 } as const;

// The widest slot a picture can fill without being blown up (container ~1344px: full / half ~660 / third ~430).
function maxSpan(w: number, h: number): 2 | 3 | 6 {
  const r = w / h;
  if (r < 0.9) return 2;                    // portrait: never wider than a third
  if (r < 1.3) return w >= 640 ? 3 : 2;     // square-ish: at most a half
  if (w >= 1600) return 6;
  if (w >= 640) return 3;
  return 2;
}
/** Accepts old string entries and new {file, size} objects. */
export function normalize(list: (string | { file: string; size?: Size })[]): GalleryItem[] {
  return (list ?? []).map((g) => (typeof g === 'string' ? { file: g, size: 'auto' } : { file: g.file, size: g.size ?? 'auto' }))
    .filter((g) => g.file);
}

/** Sizes every item and groups them into rows of up to 6 columns, in the original order. */
export async function layout(list: GalleryItem[]): Promise<Placed[][]> {
  // auto items follow the old rhythm — one wide, then two halves — but each is held
  // to the widest slot its real size allows; manual sizes are used as set
  const RHYTHM = [6, 3, 3] as const;
  let beat = 0;
  const placed: (Placed & { max: 2 | 3 | 6; auto: boolean })[] = [];
  for (const g of list) {
    const d = (await dims(g.file)) ?? { w: 1920, h: 1080 };
    const max = maxSpan(d.w, d.h);
    let span: 2 | 3 | 6;
    if (g.size === 'auto') { span = Math.min(RHYTHM[beat % 3], max) as 2 | 3 | 6; beat++; }
    else span = SPAN[g.size];
    placed.push({ file: g.file, video: isVideo(g.file), w: d.w, h: d.h, span, max, auto: g.size === 'auto' });
  }
  const rows: typeof placed[] = [];
  let row: typeof placed = [], used = 0;
  for (const p of placed) {
    if (used + p.span > 6 && row.length) { rows.push(row); row = []; used = 0; }
    row.push(p); used += p.span;
  }
  if (row.length) rows.push(row);
  // a half left alone in its row grows to full width if it is big enough
  for (const r of rows) if (r.length === 1 && r[0].auto && r[0].span === 3 && r[0].max === 6) r[0].span = 6;
  return rows.map((r) => r.map(({ max, auto, ...p }) => p));
}
