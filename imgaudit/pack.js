import sharp from 'sharp';
import { encode } from './optimize.js';
import { zipSync, strToU8 } from 'fflate';

const WIDTHS = [400, 800, 1200];
const baseName = (u) => {
  let n = 'imagen';
  try { n = decodeURIComponent(new URL(u).pathname.split('/').pop() || 'imagen'); } catch {}
  return (n.replace(/\.[^.]+$/, '').replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '') || 'imagen').slice(0, 60);
};
const pathOf = (u) => { try { return new URL(u).pathname; } catch { return u; } };

const buildPrompt = (lines) => `Actualiza las imágenes de este proyecto. Es una tarea mecánica: no analices el diseño ni refactorices nada más.

Para cada línea de la lista, busca (grep) el nombre del archivo original en HTML/JSX/Vue/CSS y cámbialo por el WebP nuevo (misma carpeta, nuevo nombre).

Formato de línea: original → nuevo | ancho×alto | tipo | variantes | ancho mostrado

Reglas:
- Siempre: width y height con el ancho×alto indicado. No toques alt, clases ni estilos.
- tipo hero: sin loading="lazy" y con fetchpriority="high".
- tipo lazy: añade loading="lazy" decoding="async".
- tipo css-bg: cambia solo el url().
- Si hay variantes: srcset="nuevo-V.webp Vw, ..., nuevo.webp Aw" (A = ancho indicado) y sizes="(max-width: Mpx) 100vw, Mpx" (M = ancho mostrado).
- Si el proyecto usa <Image> de un framework (Next, Nuxt, Astro), aplica lo equivalente con sus props.

No leas archivos que no contengan estas imágenes. Responde solo con la lista de archivos modificados, una línea por archivo.

Lista:
${lines.join('\n')}
`;

export async function pack(items, { dryRun = false } = {}) {
  const files = {}, snippets = [], lines = [], used = new Set();
  for (const it of items) {
    let base = baseName(it.url), n = 2;
    while (used.has(base)) base = `${baseName(it.url)}-${n++}`;
    used.add(base);

    const main = await sharp(it.opt).metadata();
    files[`${base}.webp`] = it.opt;
    const widths = WIDTHS.filter((w) => w < main.width * 0.9);
    if (!dryRun) for (const w of widths) files[`${base}-${w}.webp`] = (await encode(it.orig, w, it.modo)).buf;

    const hero = it.role === 'hero', css = it.kind === 'css';
    const srcset = [...widths.map((w) => `${base}-${w}.webp ${w}w`), `${base}.webp ${main.width}w`].join(', ');
    snippets.push(`<!-- ${it.url} (${it.role}) -->\n` + (css
      ? `/* CSS */ background-image: url("${base}.webp");`
      : `<img src="${base}.webp" srcset="${srcset}" sizes="(max-width: ${it.w}px) 100vw, ${it.w}px" width="${main.width}" height="${main.height}" alt=""${hero ? ' fetchpriority="high"' : ' loading="lazy"'} decoding="async">`));
    lines.push(`${pathOf(it.url)} → ${base}.webp | ${main.width}×${main.height} | ${css ? 'css-bg' : hero ? 'hero' : 'lazy'} | ${widths.join(',') || '-'} | ${it.w}px`);
  }
  const prompt = buildPrompt(lines);
  if (dryRun) return { prompt };
  files['snippets.html'] = strToU8(`<!-- Rellena el alt de cada imagen. Sube los .webp junto a tu HTML o ajusta las rutas. -->\n\n${snippets.join('\n\n')}\n`);
  files['prompt-ia.md'] = strToU8(prompt);
  return { zip: zipSync(files, { level: 0 }), prompt };
}
