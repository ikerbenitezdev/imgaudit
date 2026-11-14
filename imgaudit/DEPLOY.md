# Desplegar el analizador en Coolify (VPS de 4 GiB compartido con otros proyectos)

Objetivo: que un pico de uso de ImgAudit NUNCA afecte a tus otros proyectos del servidor.

## 1. Repositorio
El código vive en un monorepo: esta carpeta es `imgaudit/` dentro del repositorio y ya incluye el `Dockerfile`.

## 2. Crear la aplicación en Coolify
- New Resource -> Application -> tu repositorio -> Build Pack: **Dockerfile**, con *Base Directory* `/imgaudit`.
- Puerto expuesto: **4000**.
- Dominio: por ejemplo `https://api.tudominio.com` (Coolify genera el certificado HTTPS; es obligatorio si la web va en HTTPS).
- Health check: ruta `/health`, puerto 4000.

## 3. Límites de recursos (lo más importante para proteger tus otros proyectos)
En la configuración de la aplicación, sección de límites de recursos (el nombre exacto puede variar según tu versión de Coolify):
- Memoria máxima: **1 GB** (si un análisis pesado la supera, se reinicia SOLO este contenedor y el resto del servidor no se entera).
- CPU: **1** (de tus 2).
Revisa unos días `docker stats` o la gráfica de Coolify y ajusta.

## 4. Variables de entorno
| Variable | Valor | Para qué |
|---|---|---|
| `CORS_ORIGIN` | `https://tuweb.netlify.app` (varios, separados por comas) | Solo esas webs pueden usar el analizador desde el navegador |
| `RATE_LIMIT` | `6` | Análisis por IP y hora (0 = sin límite) |
| `MAX_JOBS` | `5` | Análisis guardados en memoria a la vez (cada uno puede ocupar decenas de MB) |

## 5. La web
Si prefieres Google Cloud Run en vez de Coolify, mira DEPLOY-CLOUD-RUN.md.

Despliega `imgaudit-web` en Netlify (en *Build settings* pon *Base directory* `imgaudit-web`) y define allí `NEXT_PUBLIC_ANALYZER_URL=https://api.tudominio.com`.
Así las visitas a la landing nunca tocan tu VPS: solo lo hacen quienes pulsan "Auditar", y de uno en uno.

## Qué limita el consumo
- Solo se procesa **un análisis a la vez**; el resto recibe "inténtalo en unos segundos".
- Límite por IP y hora.
- Tope de 150 s por análisis (se cierra Chromium).
- El analizador no puede llamar a redes privadas (otros contenedores, Coolify, el propio servidor).
