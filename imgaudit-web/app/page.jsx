import Tool from '../components/Tool';

const checks = [
  ['Prioridad real', 'Separa lo que frena tu web de lo que no merece tu tiempo: ves primero las imágenes con un ahorro relevante o un fallo grave.'],
  ['Peso según el papel de cada imagen', 'Un hero, una tarjeta y un avatar no deberían pesar lo mismo. Los límites cambian según el tipo de web.'],
  ['Formato y tamaño real', 'Detecta JPEG/PNG antiguos y fotos de 3000 px que se muestran a 400 px.'],
  ['Proporciones y recortes', 'Distorsiones, recortes que cortan al sujeto y rejillas con proporciones mezcladas.'],
  ['Carga y estabilidad', 'Lazy loading mal puesto, falta de width/height (CLS) y falta de srcset.'],
  ['Calidad medida, no supuesta', 'Cada WebP se ajusta a la calidad más baja que se parece al original. Puedes subirla imagen a imagen.'],
  ['Prompt para tu IA de código', 'Una lista compacta de cambios que tu asistente aplica sin gastar tokens analizando el proyecto.'],
];

export default function Home() {
  return (
    <main>
      <section className="mx-auto max-w-5xl px-5 pb-8 pt-8 md:pt-14">
        <h1 className="max-w-3xl text-4xl font-bold leading-[1.05] tracking-tight md:text-6xl">Haz que tu web vaya más rápido.</h1>
        <p className="mt-5 max-w-2xl text-lg text-mute">Deja de perder tiempo optimizando cada imagen sin importancia. Visualiza los fallos en tus imágenes que de verdad pueden frenar el potencial de tu web.</p>
        <p className="mt-3 text-sm font-medium text-teal">Gratis y sin registro.</p>
      </section>

      <Tool />

      <section id="que-revisa" className="mx-auto max-w-5xl scroll-mt-8 px-5 py-16">
        <h2 className="max-w-xl text-3xl font-bold tracking-tight">Una auditoría que sabe para qué sirve cada imagen</h2>
        <dl className="mt-10 grid gap-x-12 md:grid-cols-2">
          {checks.map(([t, d]) => (
            <div key={t} className="border-t border-line py-5"><dt className="font-semibold">{t}</dt><dd className="mt-1 max-w-sm text-mute">{d}</dd></div>
          ))}
        </dl>
      </section>

      <section className="mx-auto max-w-5xl px-5 pb-8">
        <h2 className="text-3xl font-bold tracking-tight">Cómo funciona</h2>
        <ol className="mt-8 grid gap-8 md:grid-cols-3">
          {['Pega tu URL y elige el tipo de web (tienda, portfolio, blog, landing o SaaS).', 'Revisa los fallos que importan, en escritorio y móvil, cada uno explicado en claro.', 'Descarga las imágenes optimizadas y el prompt para que tu IA las cambie por ti.'].map((t, i) => (
            <li key={i} className="flex gap-4"><span className="grid size-8 shrink-0 place-items-center rounded-full bg-mint font-semibold text-teal">{i + 1}</span><p>{t}</p></li>
          ))}
        </ol>
      </section>
    </main>
  );
}
