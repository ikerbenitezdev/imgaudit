import dns from 'node:dns/promises';

// Redes que nunca deben ser accesibles desde el analizador (red local, Docker, metadatos de nube, CGNAT).
const PRIVATE = /^(10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|0\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.|::1$|::$|f[cd]|fe80)/i;
const cache = new Map();

const isPrivateAddr = (a) => PRIVATE.test(a.replace(/^::ffff:/i, ''));

export async function isPublicHost(host) {
  if (process.env.ALLOW_PRIVATE_HOSTS === '1') return true; // SOLO para desarrollo local (auditar localhost). Nunca en producción.
  const h = host.replace(/^\[|\]$/g, '').toLowerCase();
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.internal') || h.endsWith('.local')) return false;
  if (cache.has(h)) return cache.get(h);
  let ok = false;
  try {
    const addrs = await dns.lookup(h, { all: true });
    ok = addrs.length > 0 && !addrs.some((a) => isPrivateAddr(a.address));
  } catch {}
  if (cache.size > 2000) cache.clear();
  cache.set(h, ok);
  setTimeout(() => cache.delete(h), 5 * 60e3).unref(); // las IP pueden cambiar: se revalida cada 5 min
  return ok;
}

export async function safeUrl(u) {
  const x = new URL(u);
  if (!/^https?:$/.test(x.protocol)) throw new Error('Solo se admiten URLs http(s)');
  if (!(await isPublicHost(x.hostname))) throw new Error('Host no permitido');
  return x.href;
}
