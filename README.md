# ImgAudit

Herramienta gratuita que audita las imágenes de una web (peso, formato, tamaño, proporción y carga), explica cada problema en claro y genera versiones WebP optimizadas con un prompt para que tu IA de programación las aplique.

Es un monorepo con dos partes independientes:

| Carpeta | Qué es | Dónde se despliega |
|---|---|---|
| [`imgaudit/`](imgaudit) | Analizador: Node + Playwright (Chromium) + Sharp. Expone la API. | Contenedor Docker (Google Cloud Run, Coolify...). Ver `DEPLOY-CLOUD-RUN.md` y `DEPLOY.md` |
| [`imgaudit-web/`](imgaudit-web) | Web: Next.js + Tailwind. Landing con la herramienta. | Netlify o similar (*Base directory* `imgaudit-web`) |

## Probarlo en local
Necesitas Node 18 o superior y dos terminales.

```bash
# Terminal 1: analizador (puerto 4000)
cd imgaudit
npm install
npm run setup        # descarga Chromium, solo la primera vez
npm start

# Terminal 2: web (puerto 3000)
cd imgaudit-web
cp .env.example .env.local
npm install
npm run dev
```

Abre http://localhost:3000. Para auditar una web que corre en tu propio ordenador, arranca el analizador con `ALLOW_PRIVATE_HOSTS=1 npm start` (solo en local; en producción debe estar desactivado).

## Variables de entorno
- Analizador: `PORT`, `CORS_ORIGIN`, `RATE_LIMIT`, `MAX_JOBS` (ver `imgaudit/DEPLOY.md`).
- Web: `NEXT_PUBLIC_ANALYZER_URL` (URL pública del analizador en producción), `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` (analítica opcional).

No hay claves ni secretos en el repositorio.
