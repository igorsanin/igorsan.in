// Gallery layout from real pixel sizes.
// Sizes come from src/data/media-sizes.json, written before every build by src/lib/media-sizes.mjs
// (no filesystem access here, so this also runs in Cloudflare's prerender sandbox).
import sizes from '../data/media-sizes.json';

export type Size = 'auto' | 'full' | 'half' | 'third';
export interface GalleryItem { file: string; size: Size; top: boolean }
export interface Placed { file: string; video: boolean; w: number; h: number; span: 2 | 3 | 6 }

export const isVideo = (s: string) => /\.(mp4|webm)$/i.test(s);
export const posterOf = (s: string) => s.replace(/\.(mp4|webm)$/i, '.jpg');

const table = sizes as Record<string, [number, number]>;

/** Real size of a picture or video (falls back to the video's .jpg poster). */
export function dims(src: string): { w: number; h: number } | null {
  if (!src) return null;
  const s = table[src] ?? (isVideo(src) ? table[posterOf(src)] : undefined);
  return s ? { w: s[0], h: s[1] } : null;
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
export function normalize(list: (string | { file: string; size?: Size; top?: boolean })[]): GalleryItem[] {
  return (list ?? []).map((g) => (typeof g === 'string'
      ? { file: g, size: 'auto' as Size, top: false }
      : { file: g.file, size: g.size ?? 'auto', top: !!g.top }))
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
    const d = dims(g.file) ?? { w: 1920, h: 1080 };
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

// ---------- extra videos ("More videos") ----------
export interface VideoSlot { vimeo?: string; youtube?: string; span: 2 | 3 | 6 }

/** "vimeo:123", "yt:abc", a bare number, or a vimeo.com / youtube.com / youtu.be link. */
export function parseVideo(raw: string): { vimeo?: string; youtube?: string } | null {
  const s = (raw ?? '').trim();
  if (!s) return null;
  let m;
  if ((m = s.match(/^vimeo:\s*(\d+)/i))) return { vimeo: m[1] };
  if ((m = s.match(/^(?:yt|youtube):\s*([\w-]{6,})/i))) return { youtube: m[1] };
  if ((m = s.match(/^\d+$/))) return { vimeo: s };
  if ((m = s.match(/vimeo\.com\/(?:.*\/)?(\d+)/i))) return { vimeo: m[1] };
  if ((m = s.match(/(?:youtu\.be\/|[?&]v=|\/embed\/|\/shorts\/)([\w-]{6,})/i))) return { youtube: m[1] };
  return null;
}

/** Auto = two per row; an auto video left alone in its row goes full width. Manual sizes are used as set. */
export function layoutVideos(list: (string | { id: string; size?: Size })[]): VideoSlot[][] {
  const items = (list ?? []).map((v) => (typeof v === 'string' ? { id: v, size: 'auto' as Size } : { id: v.id, size: v.size ?? 'auto' }));
  const placed: (VideoSlot & { auto: boolean })[] = [];
  for (const it of items) {
    const p = parseVideo(it.id);
    if (!p) continue;
    const span = it.size === 'auto' ? 3 : SPAN[it.size];
    placed.push({ ...p, span, auto: it.size === 'auto' });
  }
  const rows: typeof placed[] = [];
  let row: typeof placed = [], used = 0;
  for (const p of placed) {
    if (used + p.span > 6 && row.length) { rows.push(row); row = []; used = 0; }
    row.push(p); used += p.span;
  }
  if (row.length) rows.push(row);
  for (const r of rows) if (r.length === 1 && r[0].auto) r[0].span = 6;
  return rows.map((r) => r.map(({ auto, ...p }) => p));
}
