'use client';
import { useEffect, useState } from 'react';
import { GLOSS } from '../lib/gloss';
import { streamAudit, describe } from '../lib/stream';

// En producción: URL pública del analizador (Netlify -> tu VPS). En local: se reenvía mediante next.config.mjs
const ANALYZER = process.env.NEXT_PUBLIC_ANALYZER_URL;
const API = ANALYZER ? `${ANALYZER.replace(/\/$/, '')}/api` : '/api/engine';
const kb = (n) => (n >= 1024 ? (n / 1024).toFixed(1).replace('.', ',') + ' MB' : Math.round(n) + ' KB');
const SEV = { alta: ['Alta', 'text-bad'], media: ['Media', 'text-warn'], baja: ['Baja', 'text-mute'] };
const field = 'rounded-lg border border-line bg-white px-3 py-2.5';
const post = async (path, body) => {
  const r = await fetch(`${API}/${path}`, { method: 'POST', body: JSON.stringify(body) });
  const d = await r.json();
  if (d.error) throw new Error(d.error);
  return d;
};

function Loader({ prog, seconds }) {
  return (
    <div className="mt-8 rounded-2xl bg-paper p-6" role="status">
      <div className="flex items-center gap-4">
        <span className="size-6 shrink-0 rounded-full border-[3px] border-line border-t-teal motion-safe:animate-spin" aria-hidden="true" />
        <div className="min-w-0">
          <p className="font-semibold">{prog.label}…</p>
          <p className="text-sm text-mute" aria-hidden="true">{prog.detail && `${prog.detail} · `}{seconds} s · suele tardar entre 30 y 90 s. No cierres esta pestaña.</p>
        </div>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-line" aria-hidden="true">
        <div className="h-full rounded-full bg-teal transition-[width] duration-500" style={{ width: `${prog.pct}%` }} />
      </div>
    </div>
  );
}

function Why({ msg }) {
  const g = GLOSS.find(([re]) => re.test(msg));
  return g ? (
    <details className="ml-14 mt-1 text-sm text-mute"><summary className="w-max cursor-pointer">¿Qué significa?</summary><p className="mt-1 max-w-prose">{g[1]}</p></details>
  ) : null;
}

export default function Tool() {
  const [profiles, setProfiles] = useState([]);
  const [form, setForm] = useState({ url: '', profile: 'landing', modo: '' });
  const [data, setData] = useState(null);
  const [tab, setTab] = useState('desktop');
  const [sel, setSel] = useState(new Set());
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [prog, setProg] = useState({ pct: 0, label: 'Preparando el análisis', detail: '' });
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    fetch(`${API}/profiles`).then((r) => r.json()).then(setProfiles).catch(() => setErr('No se puede conectar con el servidor de análisis. ¿Está arrancado (npm start en imgaudit)?'));
  }, []);

  useEffect(() => {
    if (busy !== 'audit') return;
    setSeconds(0);
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [busy]);

  const run = async (key, fn) => { setBusy(key); setErr(''); try { await fn(); } catch (e) { setErr(e.message); } finally { setBusy(''); } };
  const audit = (e) => { e.preventDefault(); run('audit', async () => { setData(null); setSel(new Set()); setProg({ pct: 0, label: 'Preparando el análisis', detail: '' }); setData(await streamAudit(API, { url: form.url, profile: form.profile, modo: form.modo || undefined }, (ev) => setProg((p) => { const n = describe(ev); return { ...n, pct: Math.max(p.pct, n.pct) }; }))); }); };
  const requality = (i, modo) => run(i.id, async () => {
    const r = await post('requality', { job: data.jobId, id: i.id, modo });
    setData((d) => ({ ...d, [tab]: { ...d[tab], imagenes: d[tab].imagenes.map((x) => (x.id === i.id ? { ...x, optimizada: { ...x.optimizada, ...r } } : x)) } }));
  });
  const zip = () => run('zip', async () => {
    const r = await fetch(`${API}/zip`, { method: 'POST', body: JSON.stringify({ job: data.jobId, ids: [...sel] }) });
    if (!r.ok) throw new Error((await r.json()).error);
    const a = document.createElement('a'); a.href = URL.createObjectURL(await r.blob()); a.download = 'imagenes-optimizadas.zip'; a.click();
  });
  const copy = () => run('copy', async () => { await navigator.clipboard.writeText((await post('prompt', { job: data.jobId, ids: [...sel] })).prompt); setBusy('copied'); setTimeout(() => setBusy(''), 1800); });
  const toggle = (id) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const r = data?.[tab];
  const impact = (i) => (i.optimizada ? i.pesoKb - i.optimizada.pesoKb : 0);
  const important = r ? r.imagenes.filter((i) => impact(i) >= 20 || i.problemas.some((p) => p.sev === 'alta')) : [];
  const rest = r ? r.imagenes.filter((i) => !important.includes(i)) : [];
  const chosen = r ? r.imagenes.filter((i) => sel.has(i.id)) : [];
  const saved = chosen.reduce((a, i) => a + i.pesoKb - i.optimizada.pesoKb, 0);
  const pct = r?.totalKb ? Math.round((r.ahorroPotencialKb / r.totalKb) * 100) : 0;
  const high = r ? r.imagenes.filter((i) => i.problemas.some((p) => p.sev === 'alta')).length : 0;

  const row = (i) => {
              const o = i.optimizada, ok = o?.descargable, base = `${API}/job/${data.jobId}/${i.id}`, v = o ? `${o.modo}-${o.calidad}-${o.pesoKb}` : '';
    return (
      <div key={i.id} className="grid gap-4 border-b border-line py-5 md:grid-cols-[28px_310px_1fr]">
        <div>{ok && <input type="checkbox" checked={sel.has(i.id)} onChange={() => toggle(i.id)} aria-label="Seleccionar imagen" className="size-4 accent-teal" />}</div>
        <div className="flex gap-2">
          <figure className="min-w-0 flex-1">
            <img src={ok ? `${base}/original` : i.url} alt="Original" loading="lazy" className="aspect-square w-full rounded-md bg-paper object-contain" />
            <figcaption className="mt-1 text-xs">Original · {kb(i.pesoKb)}</figcaption>
          </figure>
          {ok && (
            <figure className="min-w-0 flex-1">
              <img src={`${base}/optimized?v=${v}`} alt="WebP optimizada" loading="lazy" className="aspect-square w-full rounded-md bg-paper object-contain" />
              <figcaption className="mt-1 text-xs font-semibold text-good">WebP · {kb(o.pesoKb)} (−{o.ahorroPct} %) · fidelidad {o.similitud} %</figcaption>
              <select aria-label="Calidad de esta imagen" disabled={busy === i.id} value={o.modo} onChange={(e) => requality(i, e.target.value)} className="mt-1 rounded border border-line bg-white px-1.5 py-0.5 text-xs">
                <option value="maxima">Máxima</option><option value="alta">Alta</option><option value="ligera">Ligera</option>
              </select>
            </figure>
          )}
        </div>
        <div>
          <p className="flex flex-wrap items-baseline gap-x-3"><span className="font-semibold">{i.rol}</span><span className="text-sm text-mute">{i.natural.join('×')} px, mostrada a {i.mostrada.join('×')} · {i.formato}</span></p>
          <p className="break-all text-xs text-mute">{i.url}</p>
          <ul className="mt-2 space-y-1 text-sm">
            {i.problemas.length === 0 && <li className="text-good">Sin problemas detectados</li>}
            {i.problemas.map((p) => (
              <li key={p.msg}><span className={`mr-2 inline-block min-w-12 rounded border border-current px-1.5 text-center text-xs font-semibold ${SEV[p.sev][1]}`}>{SEV[p.sev][0]}</span>{p.msg}<Why msg={p.msg} /></li>
            ))}
          </ul>
        </div>
      </div>
    );
  };

  return (
    <div id="herramienta" className="mx-auto max-w-5xl scroll-mt-6 px-5 pb-16">
      <form onSubmit={audit} className="grid gap-2 md:grid-cols-[1fr_190px_210px_auto]">
        <input required type="url" placeholder="https://tuweb.com" aria-label="URL de la web" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} className={field} />
        <select aria-label="Tipo de web" value={form.profile} onChange={(e) => setForm({ ...form, profile: e.target.value })} className={field}>
          {profiles.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
        <select aria-label="Calidad" value={form.modo} onChange={(e) => setForm({ ...form, modo: e.target.value })} className={field}>
          <option value="">Calidad: automática</option><option value="maxima">Máxima (casi sin pérdida)</option><option value="alta">Alta</option><option value="ligera">Ligera (más ahorro)</option>
        </select>
        <button disabled={busy === 'audit'} className="rounded-lg bg-teal px-6 py-2.5 font-semibold text-white hover:bg-ink disabled:opacity-50">{busy === 'audit' ? 'Analizando…' : 'Auditar'}</button>
      </form>
      {err && <p className="mt-4 text-bad" role="alert">{err}</p>}
      {busy === 'audit' && <Loader prog={prog} seconds={seconds} />}

      {r && (
        <>
          <section className="mt-8 grid items-end gap-6 rounded-2xl bg-paper p-6 md:grid-cols-[1.4fr_1fr]">
            <div><p className="text-mute">Ahorro potencial en {tab === 'desktop' ? 'escritorio' : 'móvil'}</p><p className="text-5xl font-bold tracking-tight text-teal">{kb(r.ahorroPotencialKb)} <span className="text-xl">({pct} %)</span></p></div>
            <dl className="flex flex-wrap gap-8 md:justify-end">
              <div><dd className="text-2xl font-semibold">{r.imagenes.length}</dd><dt className="text-sm text-mute">imágenes</dt></div>
              <div><dd className="text-2xl font-semibold">{kb(r.totalKb)}</dd><dt className="text-sm text-mute">peso total</dt></div>
              <div><dd className={`text-2xl font-semibold ${high ? 'text-bad' : 'text-good'}`}>{high}</dd><dt className="text-sm text-mute">con problemas altos</dt></div>
            </dl>
          </section>
          {r.avisos.map((a) => <p key={a} className="mt-3 text-warn">{a}</p>)}
          <p className="mt-4 text-sm text-mute">Fidelidad: cuánto se parece el WebP al original (100 % = idéntico). Por encima del 97 % la diferencia no suele notarse. Si una no te convence, sube su calidad con el selector bajo la miniatura.</p>

          <div className="mt-6 flex flex-wrap items-center gap-4">
            <div className="inline-flex overflow-hidden rounded-lg border border-line">
              {[['desktop', 'Escritorio'], ['mobile', 'Móvil']].map(([k, l]) => (
                <button key={k} aria-pressed={tab === k} onClick={() => { setTab(k); setSel(new Set()); }} className={`px-4 py-2 ${tab === k ? 'bg-ink text-white' : 'bg-white'}`}>{l}</button>
              ))}
            </div>
            <button className="ml-auto rounded-lg border border-line px-4 py-2 hover:border-ink" onClick={() => setSel(new Set(important.filter((i) => i.optimizada?.descargable).map((i) => i.id)))}>Seleccionar las que importan</button>
          </div>

          <h2 className="mt-8 text-xl font-semibold">Lo que más frena tu web</h2>
          <p className="text-sm text-mute">Ordenado por lo que ahorrarías. Empieza por arriba.</p>
          <div className="mt-2">
            {important.map(row)}
            {important.length === 0 && <p className="py-6 text-good">No hay fallos que merezca la pena arreglar: tus imágenes están en buen estado.</p>}
          </div>
          {rest.length > 0 && (
            <details className="mt-6 border-t border-line pt-4">
              <summary className="cursor-pointer text-mute">{rest.length} imágenes sin impacto relevante (ahorro pequeño y sin problemas graves)</summary>
              <div className="mt-2">{rest.map(row)}</div>
            </details>
          )}
        </>
      )}

      {chosen.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 flex flex-wrap items-center justify-center gap-3 border-t border-line bg-white px-5 py-3">
          <span>{chosen.length} seleccionadas · ahorras {kb(saved)}</span>
          <button onClick={copy} className="rounded-lg border border-line px-4 py-2 hover:border-ink">{busy === 'copied' ? '¡Copiado!' : 'Copiar prompt para tu IA'}</button>
          <button onClick={zip} disabled={busy === 'zip'} className="rounded-lg bg-teal px-5 py-2 font-semibold text-white hover:bg-ink disabled:opacity-50">{busy === 'zip' ? 'Preparando…' : 'Descargar ZIP'}</button>
        </div>
      )}
    </div>
  );
}
