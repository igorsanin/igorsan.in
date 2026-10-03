// Runs in Node before the build (see astro.config.mjs): measures every picture and video
// in public/media and writes src/data/media-sizes.json  { "/media/x/01.webp": [w, h], ... }.
// Pages read that file instead of touching the filesystem, so the build also works inside
// Cloudflare's prerender sandbox, where sharp and node:fs are not available.
import sharp from 'sharp';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';

async function* walk(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else yield p;
  }
}

// mp4 track header ('tkhd'): width/height as 16.16 fixed point at the end of the box
function mp4Size(b) {
  let best = null;
  for (let i = b.indexOf('tkhd'); i !== -1; i = b.indexOf('tkhd', i + 4)) {
    const size = b.readUInt32BE(i - 4), end = i - 4 + size;
    if (size < 84 || end > b.length) continue;
    const w = b.readUInt32BE(end - 8) >>> 16, h = b.readUInt32BE(end - 4) >>> 16;
    if (w && h && (!best || w > best[0])) best = [w, h];
  }
  return best;
}

export async function measure(root) {
  const pub = join(root, 'public');
  const out = {};
  for await (const f of walk(join(pub, 'media'))) {
    const key = '/' + relative(pub, f).split(sep).join('/');
    try {
      if (/\.(mp4|webm)$/i.test(f)) {
        const s = /\.mp4$/i.test(f) ? mp4Size(await readFile(f)) : null;
        if (s) out[key] = s;
      } else if (/\.(jpe?g|png|webp|avif|gif)$/i.test(f)) {
        const m = await sharp(f).metadata();
        const w = m.autoOrient?.width ?? m.width, h = m.autoOrient?.height ?? m.height;
        if (w && h) out[key] = [w, h];
      }
    } catch { /* unreadable file: left unsized */ }
  }
  await writeFile(join(root, 'src/data/media-sizes.json'), JSON.stringify(out));
  return Object.keys(out).length;
}

// Real proportions of every Vimeo video used in the projects, from Vimeo's public oEmbed
// endpoint ({ "123456": [w, h], ... } in src/data/video-sizes.json), so each player gets the
// video's own aspect ratio instead of a fixed 16:9 with bars. Anything that can't be fetched
// (no network, private video) is simply left out and falls back to 16:9.
export async function measureVideos(root) {
  const ids = new Set();
  const dir = join(root, 'src/content/projects');
  for (const f of await readdir(dir)) {
    if (!f.endsWith('.md')) continue;
    const text = await readFile(join(dir, f), 'utf8');
    for (const m of text.matchAll(/vimeo(?::\s*["']?|\.com\/(?:[^\s"']*\/)?)(\d{5,})/gi)) ids.add(m[1]);
  }
  try {
    const site = JSON.parse(await readFile(join(root, 'src/data/site.json'), 'utf8'));
    if (site.reelVimeo) ids.add(String(site.reelVimeo));
  } catch { /* no site.json */ }
  // start from the last known sizes, so an offline build keeps them
  let out = {};
  try { out = JSON.parse(await readFile(join(root, 'src/data/video-sizes.json'), 'utf8')); } catch { /* first run */ }
  let fetched = 0;
  const queue = [...ids];
  async function worker() {
    while (queue.length) {
      const id = queue.shift();
      try {
        const r = await fetch(`https://vimeo.com/api/oembed.json?url=${encodeURIComponent('https://vimeo.com/' + id)}`, { signal: AbortSignal.timeout(8000) });
        if (!r.ok) continue;
        const j = await r.json();
        if (j.width > 0 && j.height > 0) { out[id] = [j.width, j.height]; fetched++; }
      } catch { /* offline or private: stays 16:9 */ }
    }
  }
  await Promise.all(Array.from({ length: 8 }, worker));
  await writeFile(join(root, 'src/data/video-sizes.json'), JSON.stringify(out));
  return [fetched, ids.size];
}

export default function mediaSizes() {
  return {
    name: 'media-sizes',
    hooks: {
      'astro:config:setup': async ({ config, logger }) => {
        const n = await measure(new URL('.', config.root).pathname);
        logger.info(`measured ${n} media files`);
        const [v, all] = await measureVideos(new URL('.', config.root).pathname);
        logger.info(`video proportions fetched for ${v} of ${all} Vimeo videos (unknown ones stay 16:9)`);
      },
    },
  };
}
