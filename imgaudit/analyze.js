import { chromium } from 'playwright';
import sharp from 'sharp';
sharp.cache(false);   // sin caché interna: menos RAM
sharp.concurrency(1); // un hilo por operación
import { encode } from './optimize.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const profiles = JSON.parse(await fs.readFile(new URL('./profiles.json', import.meta.url)));
export const profileList = () => Object.entries(profiles).filter(([k]) => k[0] !== '_').map(([id, p]) => ({ id, label: p.label }));

const VIEWPORTS = {
  desktop: { viewport: { width: 1366, height: 900 } },
  mobile: { viewport: { width: 390, height: 844 }, isMobile: true, deviceScaleFactor: 2 },
};
const RATIOS = { '1:1': 1, '4:5': 0.8, '3:4': 0.75, '2:3': 0.667, '4:3': 1.333, '3:2': 1.5, '16:9': 1.778, '21:9': 2.333, '3:1': 3 };
const nearest = (r) => Object.entries(RATIOS).sort((a, b) => Math.abs(a[1] - r) - Math.abs(b[1] - r))[0][0];

function loadProfile(name) {
  const p = profiles[name]; if (!p || name[0] === '_') throw new Error(`Perfil desconocido: ${name}`);
  const roles = structuredClone(profiles._base.roles);
  for (const [k, v] of Object.entries(p.roles || {})) roles[k] = { ...roles[k], ...v };
  return { roles, modo: p.modo ?? profiles._base.modo };
}

// Se ejecuta dentro de la página
const scrape = () => {
  const out = [], lcp = window.__lcp || '';
  const repeated = (el) => {
    let p = el.parentElement;
    for (let i = 0; i < 4 && p && p.parentElement; i++, p = p.parentElement) {
      const sibs = [...p.parentElement.children].filter((c) => c.tagName === p.tagName && c.className === p.className);
      if (sibs.length >= 3) return true;
    }
    return false;
  };
  const push = (el, src, kind) => {
    const r = el.getBoundingClientRect();
    if (!src || src.startsWith('data:') || r.width < 2 || r.height < 2) return;
    out.push({
      src, kind, w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top + scrollY),
      nw: el.naturalWidth || 0, nh: el.naturalHeight || 0, fit: getComputedStyle(el).objectFit,
      lazy: el.getAttribute('loading'), hasDims: el.hasAttribute('width') && el.hasAttribute('height'),
      srcset: !!el.srcset || !!el.closest('picture')?.querySelector('source[srcset]'),
      inHeader: !!el.closest('header,footer,nav'), repeated: repeated(el), isLcp: src === lcp,
    });
  };
  document.querySelectorAll('img').forEach((i) => push(i, i.currentSrc || i.src, 'img'));
  document.querySelectorAll('*').forEach((el) => {
    const m = getComputedStyle(el).backgroundImage.match(/url\("?([^")]+)"?\)/);
    if (m) push(el, new URL(m[1], location.href).href, 'css');
  });
  return out;
};

function detectRole(i, vw) {
  if (i.kind === 'css') return 'fondo';
  if (i.isLcp || (i.top < 700 && i.w >= vw * 0.8 && !i.inHeader)) return 'hero';
  if (i.inHeader && i.w <= 240 && i.h <= 120) return 'logo';
  if (i.w <= 64 && i.h <= 64) return Math.abs(i.w - i.h) < 4 ? 'avatar' : 'miniatura';
  if (i.repeated) return 'tarjeta';
  if (i.w <= 160) return 'miniatura';
  return 'contenido';
}

export async function analyze(url, profileName = 'landing', { viewport = 'desktop', outDir, store, modo: modoOpt, guard, onProgress } = {}) {
  const { roles, modo: pm } = loadProfile(profileName);
  const modo = modoOpt || pm;
  const prog = (p) => { try { onProgress?.({ viewport, ...p }); } catch {} }; // el progreso nunca debe romper el análisis
  const vp = VIEWPORTS[viewport];
  const browser = await chromium.launch({ args: ['--disable-dev-shm-usage', '--disable-gpu'] });
  const killer = setTimeout(() => browser.close().catch(() => {}), 150_000); // tope duro por análisis
  try {
    const page = await (await browser.newContext(vp)).newPage();
    await page.route('**/*', async (route) => {
      const req = route.request();
      if (req.resourceType() === 'media') return route.abort(); // vídeo/audio: no aportan y pesan mucho
      if (guard) {
        const u = new URL(req.url());
        if (/^https?:$/.test(u.protocol) && !(await guard(u.hostname))) return route.abort('blockedbyclient');
      }
      return route.continue();
    });
    await page.addInitScript(() => {
      window.__lcp = '';
      new PerformanceObserver((l) => { window.__lcp = l.getEntries().at(-1)?.url || ''; })
        .observe({ type: 'largest-contentful-paint', buffered: true });
    });
    const bodies = new Map();
    page.on('response', async (r) => {
      if (r.request().resourceType() !== 'image') return;
      try { bodies.set(r.url(), { buf: await r.body(), type: r.headers()['content-type'] || '' }); } catch {}
    });
    prog({ stage: 'abriendo' });
    await page.goto(url, { waitUntil: 'load', timeout: 60000 });
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {}); // opcional: muchas webs nunca quedan en reposo
    prog({ stage: 'scroll' });
    await page.evaluate(() => new Promise((res) => {
      let y = 0;
      const t = setInterval(() => {
        scrollBy(0, 600); y += 600;
        if (y >= Math.min(document.body.scrollHeight, 30000)) { clearInterval(t); res(); }
      }, 150);
    }));
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(1000);
    await page.evaluate(() => scrollTo(0, 0));
    const raw = await page.evaluate(scrape);

    if (outDir) await fs.mkdir(outDir, { recursive: true });
    const seen = new Set(), images = [], cardRatios = new Set();
    const vw = vp.viewport.width, vh = vp.viewport.height;

    let k = 0;
    for (const i of raw) {
      prog({ stage: 'imagenes', done: k++, total: raw.length });
      const key = `${i.src}|${i.w}|${i.h}`;
      const b = bodies.get(i.src);
      if (seen.has(key) || !b) continue;
      seen.add(key);
      const role = detectRole(i, vw), rule = roles[role] || {};
      const kb = b.buf.length / 1024, isSvg = b.type.includes('svg');
      const meta = isSvg ? {} : await sharp(b.buf).metadata().catch(() => ({}));
      const nw = i.nw || meta.width || 0, nh = i.nh || meta.height || 0;
      const rec = { id: `${viewport}-${images.length}`, url: i.src, rol: role, formato: isSvg ? 'svg' : meta.format, pesoKb: +kb.toFixed(1), natural: [nw, nh], mostrada: [i.w, i.h], problemas: [] };
      const add = (sev, msg) => rec.problemas.push({ sev, msg });

      if (!isSvg && nw && nh) {
        const rn = nw / nh, rr = i.w / i.h, target = i.w * 2;
        rec.ratioNatural = nearest(rn);
        if (role === 'tarjeta') cardRatios.add(nearest(rr));
        if (rule.maxKb && kb > rule.maxKb) add('alta', `Pesa ${Math.round(kb)} KB; para "${role}" se recomienda ≤ ${rule.maxKb} KB`);
        if (['jpeg', 'png', 'gif'].includes(meta.format)) add('media', `Formato ${meta.format}: WebP/AVIF pesaría menos`);
        if (nw > target * 1.25) add('media', `Sobredimensionada: ${nw}px de ancho para un hueco de ${i.w}px (con 2x bastaría ${target}px)`);
        if (i.kind === 'img' && i.fit === 'fill' && Math.abs(rn / rr - 1) > 0.06) add('alta', `Distorsionada: proporción natural ${rec.ratioNatural} vs mostrada ${nearest(rr)}`);
        if (i.fit === 'cover' || i.kind === 'css') {
          const crop = 1 - Math.min(rn / rr, rr / rn);
          if (crop > 0.25) add('media', `Recorte de ~${Math.round(crop * 100)}% de la imagen por object-fit/cover`);
        }
        if (rule.ratios && !rule.ratios.includes(rec.ratioNatural)) add('baja', `Proporción ${rec.ratioNatural} atípica para "${role}" (esperadas: ${rule.ratios.join(', ')})`);
        if (i.kind === 'img' && !i.hasDims) add('media', 'Sin atributos width/height: riesgo de salto de layout (CLS)');
        if (i.kind === 'img' && !i.srcset && nw > 800) add('baja', 'Sin srcset: el móvil descarga la misma versión que el escritorio');
        if (i.kind === 'img' && role === 'hero' && i.lazy === 'lazy') add('alta', 'La imagen principal tiene loading="lazy": retrasa el LCP');
        if (i.kind === 'img' && role !== 'hero' && i.top > vh * 1.2 && i.lazy !== 'lazy') add('media', 'Fuera de pantalla sin loading="lazy"');

        if (meta.pages > 1) { add('media', 'Imagen animada: un vídeo MP4/WebM pesaría mucho menos'); rec.veredicto = 'optimizable'; images.push(rec); continue; }
        const width = Math.min(nw, target);
        const enc = await encode(b.buf, width, modo), opt = enc.buf;
        const optKb = opt.length / 1024, saving = 1 - optKb / kb;
        rec.optimizada = { ancho: width, formato: 'webp', modo, calidad: enc.q, similitud: Math.round(enc.ssim * 100), tipo: enc.tipo, pesoKb: +optKb.toFixed(1), ahorroPct: Math.round(saving * 100), descargable: saving >= 0.1 };
        if (store && saving >= 0.1) store.set(rec.id, { orig: b.buf, type: b.type, opt, modo, width, url: i.src, role, w: i.w, nw, nh, kind: i.kind });
        if (outDir && saving >= 0.15) {
          rec.optimizada.archivo = `${images.length}-${path.basename(new URL(i.src).pathname).replace(/\.[^.]+$/, '') || 'img'}.webp`;
          await fs.writeFile(path.join(outDir, rec.optimizada.archivo), opt);
        }
      } else if (rule.maxKb && kb > rule.maxKb) add('alta', `Pesa ${Math.round(kb)} KB; para "${role}" se recomienda ≤ ${rule.maxKb} KB`);

      rec.veredicto = rec.problemas.some((p) => p.sev === 'alta') || (rec.optimizada?.ahorroPct >= 15) ? 'optimizable' : 'ok';
      images.push(rec);
    }

    prog({ stage: 'imagenes', done: raw.length, total: raw.length });
    const ahorro = (r) => (r.optimizada ? r.pesoKb - r.optimizada.pesoKb : 0);
    images.sort((a, b) => ahorro(b) - ahorro(a));
    const warnings = cardRatios.size > 1 ? [`Las tarjetas mezclan proporciones (${[...cardRatios].join(', ')}): la rejilla se verá irregular`] : [];
    const total = images.reduce((s, r) => s + r.pesoKb, 0);
    const saving = images.reduce((s, r) => s + Math.max(0, ahorro(r)), 0);
    return { url, perfil: profileName, viewport, totalKb: Math.round(total), ahorroPotencialKb: Math.round(saving), imagenes: images, avisos: warnings };
  } finally { clearTimeout(killer); await browser.close().catch(() => {}); }
}

// CLI: node analyze.js <url> [perfil] [desktop|mobile]
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [, , url, perfil = 'landing', vpName = 'desktop'] = process.argv;
  if (!url) { console.log('Uso: node analyze.js <url> [ecommerce|portfolio|blog|landing|saas] [desktop|mobile]'); process.exit(1); }
  const r = await analyze(url, perfil, { viewport: vpName, outDir: './out' });
  console.table(r.imagenes.map((x) => ({ rol: x.rol, fmt: x.formato, kb: x.pesoKb, webpKb: x.optimizada?.pesoKb, ahorro: x.optimizada?.ahorroPct + '%', veredicto: x.veredicto, problemas: x.problemas.length })));
  console.log(`Total ${r.totalKb} KB · ahorro potencial ${r.ahorroPotencialKb} KB`, r.avisos);
  console.log('Versiones WebP guardadas en ./out');
}
