import './globals.css';
import Link from 'next/link';

export const metadata = {
  title: 'ImgAudit: haz que tu web vaya más rápido',
  description: 'Detecta los fallos en las imágenes que frenan tu web, sin perder tiempo en las que no importan, y descarga versiones WebP optimizadas gratis.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
        {process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN && <script defer data-domain={process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN} src="https://plausible.io/js/script.js" />}
      </head>
      <body className="font-sans antialiased">
        <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5">
          <Link href="/" className="text-lg font-bold tracking-tight">ImgAudit</Link>
          <nav className="flex items-center gap-6 text-sm">
            <Link href="/#que-revisa" className="text-mute hover:text-ink">Qué revisa</Link>
            <Link href="/#herramienta" className="rounded-lg bg-ink px-4 py-2 font-medium text-white hover:bg-teal">Auditar mi web</Link>
          </nav>
        </header>
        {children}
        <footer className="mt-24 border-t border-line py-8 text-center text-sm text-mute">ImgAudit · Las imágenes se borran del servidor a los 15 minutos.</footer>
      </body>
    </html>
  );
}
