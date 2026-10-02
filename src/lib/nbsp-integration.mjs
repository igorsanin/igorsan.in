// After build: glue short English words to the next word in every HTML page's text,
// outside <script>, <style>, <pre>, <code>, <textarea> and tag attributes.
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SHORT = 'a|an|the|of|in|on|at|to|for|by|with|from|into|onto|as|and|or|but|nor|is|was|be|we|our|its|it|my|me|i|no|not|via|per|up|off|out|so|if|в|во|и|с|со|к|ко|о|об|у|а|но|не|ни|на|по|за|из|от|до|для|без|при|про|что|как|я|мы|вы|их|это|&amp;|×';
const RE_SHORT = new RegExp(`(^|[\\s(«“"])(${SHORT}) +(?=\\S)`, 'gi');
const RE_NUM = /(\d) +(?=(?:sec|min|px|K|M|tonnes|tons|years?|days?|LED|%|×|лет|часов|минут|занятий|человек)(?![\wа-яё]))/g;
const RE_DASH = / +(—|–)(?= )/g;
const glue = (t) => t.replace(RE_DASH, '\u00A0$1').replace(RE_SHORT, '$1$2 ').replace(RE_SHORT, '$1$2 ').replace(RE_NUM, '$1 ');

export function processHtml(html) {
  // set aside blocks whose content must not be touched (CSS may contain "<" in media queries)
  const kept = [];
  const masked = html.replace(/<(script|style|pre|code|textarea)\b[\s\S]*?<\/\1>/gi, (m) => `\u0000${kept.push(m) - 1}\u0000`);
  const out = masked.split(/(<[^>]+>)/).map((p) => (p.startsWith('<') || !p.trim() ? p : glue(p))).join('');
  return out.replace(/\u0000(\d+)\u0000/g, (_, i) => kept[+i]);
}

async function* htmlFiles(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* htmlFiles(p);
    else if (e.name.endsWith('.html')) yield p;
  }
}

export default function nbsp() {
  return {
    name: 'nbsp',
    hooks: {
      'astro:build:done': async ({ dir }) => {
        let n = 0;
        for await (const f of htmlFiles(fileURLToPath(dir))) {
          if (f.includes('/admin/')) continue;
          const src = await readFile(f, 'utf8');
          const out = processHtml(src);
          if (out !== src) { await writeFile(f, out); n++; }
        }
        console.log(`[nbsp] glued short words in ${n} pages`);
      },
    },
  };
}
