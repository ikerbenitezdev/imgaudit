# ImgAudit Web (Next.js + Tailwind)

La home es la herramienta: título, formulario y resultados. El análisis lo hace `imgaudit` (Playwright + Sharp), que Next reenvía vía `/api/engine/*`.

## Arrancar en local
1. En `imgaudit/`: `npm install && npm run setup && npm start`  (puerto 4000)
2. Aquí: `cp .env.example .env.local`, `npm install`, `npm run dev`  (puerto 3000)

## Medir visitas
Pon tu dominio en `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` para activar Plausible (sin cookies). Vercel Analytics o Umami también sirven.

## Antes de publicar
- Despliegue del analizador en Coolify con límites de recursos: ver `imgaudit/DEPLOY.md`.
- Más adelante, si quieres cobrar: Stripe + login (se quitó de esta versión).
