import sharp from 'sharp';

// Umbrales de similitud (SSIM): "mean" = media de toda la imagen, "worst" = media del 10 % de zonas peores (texto, bordes).
export const MODES = { maxima: { ssim: 0.99, worst: 0.96 }, alta: { ssim: 0.98, worst: 0.93 }, ligera: { ssim: 0.96, worst: 0.88 } };
const C1 = 6.5025, C2 = 58.5225;

function ssim(a, b, w, h) {
  const s = [];
  for (let y = 0; y + 8 <= h; y += 8) for (let x = 0; x + 8 <= w; x += 8) {
    let ma = 0, mb = 0;
    for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) { const p = (y + j) * w + x + i; ma += a[p]; mb += b[p]; }
    ma /= 64; mb /= 64;
    let va = 0, vb = 0, c = 0;
    for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) { const p = (y + j) * w + x + i, da = a[p] - ma, db = b[p] - mb; va += da * da; vb += db * db; c += da * db; }
    s.push(((2 * ma * mb + C1) * (2 * (c / 63) + C2)) / ((ma * ma + mb * mb + C1) * (va / 63 + vb / 63 + C2)));
  }
  if (!s.length) return { mean: 1, worst: 1 };
  s.sort((p, q) => p - q);
  const avg = (arr) => arr.reduce((t, v) => t + v, 0) / arr.length;
  return { mean: avg(s), worst: avg(s.slice(0, Math.max(1, Math.floor(s.length * 0.1)))) };
}
const gray = (input, opts, cw) => sharp(input, opts).flatten({ background: '#ffffff' }).greyscale().extractChannel(0)
  .resize({ width: cw, withoutEnlargement: true }).raw().toBuffer({ resolveWithObject: true });

const WEBP = { smartSubsample: true, alphaQuality: 100 };

// Busca la calidad WebP más baja que cumple el nivel de similitud pedido.
export async function encode(orig, width, modoName = 'alta') {
  const mode = MODES[modoName] || MODES.alta;
  // rotate() aplica la orientación EXIF: sin ella, algunas fotos salen giradas al quitar los metadatos
  const { data, info } = await sharp(orig).rotate().resize({ width, withoutEnlargement: true }).raw().toBuffer({ resolveWithObject: true });
  const raw = { raw: { width: info.width, height: info.height, channels: info.channels } };
  const R = () => sharp(data, raw);
  const cw = Math.min(512, info.width), ref = await gray(data, raw, cw);
  const score = async (buf) => { const g = await gray(buf, undefined, cw); return ssim(ref.data, g.data, ref.info.width, ref.info.height); };

  let lo = 40, hi = 95, best = null;
  for (let k = 0; k < 6 && lo <= hi; k++) {
    const q = (lo + hi) >> 1, buf = await R().webp({ quality: q, ...WEBP, effort: 2 }).toBuffer(), s = await score(buf);
    if (s.mean >= mode.ssim && s.worst >= mode.worst) { best = { buf, q, ssim: s.mean }; hi = q - 1; } else lo = q + 1;
  }
  if (!best) { const buf = await R().webp({ quality: 95, ...WEBP, effort: 2 }).toBuffer(); best = { buf, q: 95, ssim: (await score(buf)).mean }; }

  best.buf = await R().webp({ quality: best.q, ...WEBP, effort: 5 }).toBuffer(); // codificación final más lenta y más pequeña

  // ¿Gráfico con pocos colores (logo, captura, texto)? Entonces probamos sin pérdida.
  const n = info.width * info.height, step = Math.max(1, Math.floor(n / 4000)), seen = new Set();
  for (let p = 0; p < n && seen.size <= 150; p += step) { const o = p * info.channels; seen.add(((data[o] >> 4) << 8) | ((data[o + 1] >> 4) << 4) | (data[o + 2] >> 4)); }
  const graphic = seen.size <= 150;
  if (graphic) {
    const buf = await R().webp({ lossless: true, effort: 5 }).toBuffer();
    if (buf.length <= best.buf.length * 1.3) return { buf, q: 'sin pérdida', ssim: 1, tipo: 'gráfico' };
  }
  return { buf: best.buf, q: best.q, ssim: best.ssim, tipo: graphic ? 'gráfico' : 'foto' };
}
