import http from 'node:http';
import fs from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { analyze, profileList } from './analyze.js';
import { pack } from './pack.js';
import { encode, MODES } from './optimize.js';
import { isPublicHost, safeUrl } from './net-guard.js';

// Configuración por variables de entorno (útil en Coolify)
const PORT = process.env.PORT || 4000;
const RATE_LIMIT = +(process.env.RATE_LIMIT || 6);       // análisis por IP y hora (0 = sin límite)
const MAX_JOBS = +(process.env.MAX_JOBS || 5);           // análisis guardados a la vez en memoria
const CORS = (process.env.CORS_ORIGIN || '').split(',').map((s) => s.trim()).filter(Boolean);
const TTL = 15 * 60e3;                                   // las imágenes se guardan en memoria solo 15 min

const jobs = new Map();
const hits = new Map();
setInterval(() => {
  for (const [k, j] of jobs) if (Date.now() - j.t > TTL) jobs.delete(k);
  for (const [ip, list] of hits) { const f = list.filter((t) => Date.now() - t < 3600e3); f.length ? hits.set(ip, f) : hits.delete(ip); }
}, 60e3).unref();
let busy = false;

// Detrás de un proxy (Traefik en Coolify) la IP real es la ÚLTIMA de X-Forwarded-For; las anteriores las puede falsear el cliente.
const clientIp = (req) => (req.headers['x-forwarded-for'] || '').split(',').map((s) => s.trim()).filter(Boolean).at(-1) || req.socket.remoteAddress;
function rateLimited(ip) {
  if (!RATE_LIMIT) return false;
  const list = (hits.get(ip) || []).filter((t) => Date.now() - t < 3600e3);
  if (list.length >= RATE_LIMIT) { hits.set(ip, list); return true; }
  list.push(Date.now()); hits.set(ip, list);
  return false;
}

const send = (res, code, data, type = 'application/json', extra = {}) => {
  res.writeHead(code, { 'Content-Type': type, ...extra });
  res.end(type === 'application/json' ? JSON.stringify(data) : data);
};
const readBody = async (req) => {
  let b = '';
  for await (const c of req) { b += c; if (b.length > 100_000) throw new Error('Petición demasiado grande'); }
  return JSON.parse(b || '{}');
};

http.createServer(async (req, res) => {
  const origin = req.headers.origin;
  if (origin && CORS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  try {
    if (req.method === 'GET' && req.url === '/health') return send(res, 200, 'ok', 'text/plain');
    if (req.method === 'GET' && req.url === '/') return send(res, 200, await fs.readFile(new URL('./index.html', import.meta.url)), 'text/html; charset=utf-8');
    if (req.method === 'GET' && req.url === '/api/profiles') return send(res, 200, profileList());

    const path = req.url.split('?')[0]; // ignora ?v=... (evita la caché del navegador)
    const img = path.match(/^\/api\/job\/([\w-]+)\/([\w-]+)\/(original|optimized)$/);
    if (req.method === 'GET' && img) {
      const it = jobs.get(img[1])?.items.get(img[2]);
      if (!it) return send(res, 404, { error: 'Caducado' });
      return send(res, 200, img[3] === 'original' ? it.orig : it.opt, img[3] === 'original' ? it.type || 'image/jpeg' : 'image/webp');
    }

    if (req.method === 'POST' && req.url === '/api/analyze') {
      if (busy) return send(res, 429, { error: 'Hay otro análisis en curso, inténtalo en unos segundos' });
      busy = true; // se marca antes de cualquier await para que dos peticiones simultáneas no se cuelen
      try {
        if (rateLimited(clientIp(req))) return send(res, 429, { error: `Has alcanzado el límite de ${RATE_LIMIT} análisis por hora. Vuelve más tarde.` });
        const { url, profile, modo, stream } = await readBody(req);
        const safe = await safeUrl(url), items = new Map();
        // Con stream:true se envía el progreso como líneas JSON (NDJSON); sin él, responde un único JSON como antes.
        if (stream) res.writeHead(200, { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', 'X-Accel-Buffering': 'no' });
        const emit = stream ? (o) => res.write(JSON.stringify(o) + '\n') : undefined;
        emit?.({ stage: 'inicio' });
        const opts = { store: items, modo, guard: isPublicHost, onProgress: emit };
        const desktop = await analyze(safe, profile, { ...opts, viewport: 'desktop' });
        const mobile = await analyze(safe, profile, { ...opts, viewport: 'mobile' });
        while (jobs.size >= MAX_JOBS) jobs.delete(jobs.keys().next().value);
        const jobId = randomUUID();
        jobs.set(jobId, { t: Date.now(), items });
        if (stream) { res.end(JSON.stringify({ result: { jobId, desktop, mobile } }) + '\n'); return; }
        return send(res, 200, { jobId, desktop, mobile });
      } finally { busy = false; }
    }

    if (req.method === 'POST' && req.url === '/api/zip') {
      const { job, ids } = await readBody(req);
      const j = jobs.get(job);
      if (!j) return send(res, 410, { error: 'El análisis ha caducado (15 min). Vuelve a auditar la web.' });
      const items = (ids || []).slice(0, 200).map((id) => j.items.get(id)).filter(Boolean);
      if (!items.length) return send(res, 400, { error: 'No hay imágenes seleccionadas' });
      const zip = Buffer.from((await pack(items)).zip);
      return send(res, 200, zip, 'application/zip', { 'Content-Disposition': 'attachment; filename="imagenes-optimizadas.zip"' });
    }
    if (req.method === 'POST' && req.url === '/api/requality') {
      const { job, id, modo } = await readBody(req);
      const it = jobs.get(job)?.items.get(id);
      if (!it) return send(res, 410, { error: 'El análisis ha caducado (15 min). Vuelve a auditar la web.' });
      if (!MODES[modo]) return send(res, 400, { error: 'Calidad no válida' });
      const enc = await encode(it.orig, it.width, modo);
      it.opt = enc.buf; it.modo = modo;
      const optKb = enc.buf.length / 1024;
      return send(res, 200, { modo, calidad: enc.q, similitud: Math.round(enc.ssim * 100), tipo: enc.tipo, pesoKb: +optKb.toFixed(1), ahorroPct: Math.round((1 - optKb / (it.orig.length / 1024)) * 100) });
    }
    if (req.method === 'POST' && req.url === '/api/prompt') {
      const { job, ids } = await readBody(req);
      const j = jobs.get(job);
      if (!j) return send(res, 410, { error: 'El análisis ha caducado (15 min). Vuelve a auditar la web.' });
      const items = (ids || []).slice(0, 200).map((id) => j.items.get(id)).filter(Boolean);
      if (!items.length) return send(res, 400, { error: 'No hay imágenes seleccionadas' });
      return send(res, 200, { prompt: (await pack(items, { dryRun: true })).prompt });
    }
    send(res, 404, { error: 'No encontrado' });
  } catch (e) {
    const timeout = /Timeout|closed|Target|net::/i.test(e.message);
    const msg = timeout ? 'La web tardó demasiado en responder o no se pudo analizar.' : e.message;
    if (res.headersSent) { res.end(JSON.stringify({ error: msg }) + '\n'); return; } // el análisis ya había empezado a enviar progreso
    send(res, timeout ? 504 : 400, { error: msg });
  }
}).listen(PORT, () => console.log(`Analizador en http://localhost:${PORT}`));
