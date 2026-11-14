# ImgAudit Web (Next.js + Tailwind)

La interfaz de ImgAudit: la home es la propia herramienta (formulario, progreso y resultados). El análisis lo hace el analizador de `../imgaudit`, al que la web llama a través de `/api/engine/*` (configurado en `next.config.mjs`).

Las instrucciones para ponerlo todo en marcha están en el [README principal](../README.md).

## Variables de entorno (opcionales)
Copia `.env.example` a `.env.local` solo si necesitas cambiar algo.

| Variable | Para qué |
|---|---|
| `ANALYZER_URL` | Dónde está el analizador para el reenvío local (por defecto `http://localhost:4000`) |
| `NEXT_PUBLIC_ANALYZER_URL` | Si el analizador está en otra dirección pública, la web la llama directamente. Déjala vacía en local |
| `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` | Activa la analítica de visitas de Plausible (sin cookies) |
