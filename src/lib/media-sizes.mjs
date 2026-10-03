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

export default function mediaSizes() {
  return {
    name: 'media-sizes',
    hooks: {
      'astro:config:setup': async ({ config, logger }) => {
        const n = await measure(new URL('.', config.root).pathname);
        logger.info(`measured ${n} media files`);
      },
    },
  };
}
