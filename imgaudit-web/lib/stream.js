// Lee el progreso del análisis (NDJSON) y devuelve el resultado final.
export async function streamAudit(api, body, onEvent) {
  const r = await fetch(`${api}/analyze`, { method: 'POST', body: JSON.stringify({ ...body, stream: true }) });
  if (!r.ok || !r.body) {
    const d = await r.json().catch(() => ({}));
    throw new Error(d.error || 'No se pudo analizar la web');
  }
  // Analizador antiguo (sin progreso): responde un único JSON en vez de líneas NDJSON
  if ((r.headers.get('content-type') || '').includes('application/json')) {
    const d = await r.json();
    if (d.error) throw new Error(d.error);
    return d;
  }
  const reader = r.body.getReader(), dec = new TextDecoder();
  let buf = '', result = null;
  const handle = (line) => {
    if (!line.trim()) return;
    const ev = JSON.parse(line);
    if (ev.error) throw new Error(ev.error);
    if (ev.result) result = ev.result; else onEvent(ev); // ojo: los eventos de progreso también traen un campo 'done'
  };
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let nl;
    while ((nl = buf.indexOf('\n')) >= 0) { handle(buf.slice(0, nl)); buf = buf.slice(nl + 1); }
  }
  handle(buf);
  if (!result) throw new Error('El análisis se interrumpió. Inténtalo de nuevo.');
  return result;
}

const WHERE = { desktop: 'Escritorio', mobile: 'Móvil' };
// Traduce un evento de progreso en porcentaje (0-100) y textos. Escritorio ocupa la primera mitad y móvil la segunda.
export function describe(ev) {
  const base = ev.viewport === 'mobile' ? 0.5 : 0;
  const w = WHERE[ev.viewport];
  if (ev.stage === 'abriendo') return { pct: (base + 0.05 * 0.5) * 100, label: `${w}: abriendo la web`, detail: '' };
  if (ev.stage === 'scroll') return { pct: (base + 0.2 * 0.5) * 100, label: `${w}: recorriendo la página para cargar todas las imágenes`, detail: '' };
  if (ev.stage === 'imagenes') {
    const f = ev.total ? ev.done / ev.total : 1;
    return { pct: (base + (0.3 + 0.7 * f) * 0.5) * 100, label: `${w}: analizando y optimizando las imágenes`, detail: ev.total ? `imagen ${Math.min(ev.done + 1, ev.total)} de ${ev.total}` : '' };
  }
  return { pct: 0, label: 'Preparando el análisis', detail: '' };
}
