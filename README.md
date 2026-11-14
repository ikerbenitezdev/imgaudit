# ImgAudit

Herramienta gratuita que audita las imágenes de una web: detecta peso excesivo, formatos antiguos, imágenes sobredimensionadas, recortes y fallos de carga, explica cada problema en lenguaje claro y genera versiones WebP optimizadas listas para descargar.

Pega una URL, elige qué tipo de web es (tienda, portfolio, blog, landing o SaaS) y recibe una lista ordenada por lo que más frena tu web. Funciona en tu propio ordenador: no hace falta cuenta ni servidor.

## Qué hace

- **Entiende el papel de cada imagen:** distingue hero, tarjetas, logos, avatares y fondos, y aplica pesos y proporciones razonables para cada uno según el tipo de web.
- **Prioriza:** muestra primero lo que merece la pena arreglar y deja plegado el resto.
- **Revisa en escritorio y móvil:** peso, formato, tamaño real frente a tamaño mostrado, distorsión, recortes, `width`/`height` (CLS), `srcset` y `loading="lazy"`.
- **Optimiza sin estropear:** busca la calidad WebP más baja que sigue pareciéndose al original (medido con SSIM) y deja subirla imagen a imagen.
- **Descarga:** ZIP con los WebP, variantes responsive (400/800/1200 px) y un `snippets.html` con las etiquetas listas.
- **Prompt para tu IA de código:** una lista compacta de cambios que tu asistente aplica sin gastar tokens analizando el proyecto.

## Requisitos

- [Node.js](https://nodejs.org) 20 o superior (probado con la versión 22).
- [Git](https://git-scm.com), para descargar el proyecto.
- Unos 500 MB libres: se descarga un Chromium para analizar las páginas.

## Ponerlo en marcha

### 1. Descargar el proyecto
```bash
git clone https://github.com/ikerbenitezdev/imgaudit.git
cd imgaudit
```

### 2. Instalar (solo la primera vez)
```bash
cd imgaudit
npm install
npm run setup        # descarga Chromium
cd ../imgaudit-web
npm install
```

### 3. Arrancar (dos terminales)
En una terminal, el analizador:
```bash
cd imgaudit
npm start            # http://localhost:4000
```
En otra terminal, la web:
```bash
cd imgaudit-web
npm run dev          # http://localhost:3000
```

Abre **http://localhost:3000**, pega la URL de una web pública y pulsa *Auditar*. Un análisis tarda entre 30 y 90 segundos. Para parar, pulsa `Ctrl + C` en cada terminal.

### Atajo: un solo comando
Desde la raíz del repositorio:
```bash
npm install
npm run setup        # instala las dos partes y descarga Chromium
npm run dev          # arranca analizador y web a la vez
```

## Cómo usarlo

1. Pega la URL, elige el tipo de web y, si quieres, la calidad (automática, máxima, alta o ligera).
2. Revisa *Lo que más frena tu web*. Cada problema tiene un desplegable "¿Qué significa?".
3. Marca las imágenes que quieras y pulsa *Descargar ZIP* o *Copiar prompt para tu IA*.

Los resultados se guardan en memoria solo 15 minutos y después se borran. Si el botón de descarga dice "caducado", vuelve a auditar.

## Ajustar los criterios

Los pesos máximos y las proporciones esperadas de cada tipo de imagen están en [`imgaudit/profiles.json`](imgaudit/profiles.json). Puedes cambiar los límites de un perfil existente o añadir uno nuevo; la web lo mostrará en el selector.

## Variables de entorno (opcionales)

Analizador (`imgaudit/`):

| Variable | Por defecto | Qué hace |
|---|---|---|
| `PORT` | `4000` | Puerto del analizador |
| `RATE_LIMIT` | `6` | Análisis por IP y hora. `0` lo desactiva |
| `MAX_JOBS` | `5` | Análisis que se conservan en memoria a la vez |
| `CORS_ORIGIN` | vacío | Webs autorizadas a llamar al analizador desde el navegador (separadas por comas) |
| `ALLOW_PRIVATE_HOSTS` | desactivado | `1` permite auditar webs de `localhost`. **Solo para uso local** |

Web (`imgaudit-web/`): consulta [`imgaudit-web/README.md`](imgaudit-web/README.md).

Cómo ponerlas según tu terminal:
```bash
# Mac / Linux
RATE_LIMIT=0 npm start
# Windows (PowerShell)
$env:RATE_LIMIT="0"; npm start
```

## Problemas habituales

- **"No se puede conectar con el servidor de análisis":** el analizador (`npm start` en `imgaudit/`) no está arrancado.
- **Windows: `npm.ps1 no se puede cargar porque la ejecución de scripts está deshabilitada`:** ejecuta `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` o usa una terminal de tipo *Command Prompt*.
- **Linux: falla Chromium por librerías que faltan:** ejecuta `npx playwright install --with-deps chromium` dentro de `imgaudit/`.
- **"Has alcanzado el límite de análisis por hora":** arranca el analizador con `RATE_LIMIT=0`.
- **Quieres auditar una web de tu ordenador (`localhost`):** arranca el analizador con `ALLOW_PRIVATE_HOSTS=1`.
- **El puerto 3000 o 4000 está ocupado:** cierra el programa que lo usa, o cambia el puerto del analizador con `PORT` y apunta la web a él con `ANALYZER_URL`.

## Cómo funciona

El analizador abre la página con Playwright (Chromium) en escritorio y en móvil, hace scroll para activar el lazy loading y recoge cada imagen con su tamaño real y el mostrado. Clasifica su papel con heurísticas, aplica las reglas del perfil elegido y recomprime cada imagen a WebP con Sharp, buscando la calidad más baja que mantiene la similitud con el original. La web en Next.js muestra el progreso y los resultados.

## Límites conocidos

- El papel de cada imagen (hero, tarjeta...) se detecta con heurísticas y puede fallar en diseños poco habituales. Todavía no se puede corregir a mano desde la interfaz.
- Las webs con inicio de sesión, banners de cookies que bloquean la carga o contenido muy dinámico pueden dar resultados incompletos.
- Solo se analizan URLs públicas.
- La "fidelidad" es una medida matemática y puede no coincidir con tu ojo: revisa la comparación antes de sustituir imágenes.

## Seguridad

El analizador abre páginas de terceros desde tu máquina. Por eso bloquea las peticiones a redes privadas (tu red local, otros servicios, direcciones de metadatos de nube) y limita el uso por IP. Si lo expones a internet, mantén esos límites, no actives `ALLOW_PRIVATE_HOSTS` y ponlo en un entorno aislado.

## Desplegarlo (opcional)

No es necesario para usarlo. Si quieres publicarlo, en `imgaudit/` hay guías para [Google Cloud Run](imgaudit/DEPLOY-CLOUD-RUN.md) y para [Coolify](imgaudit/DEPLOY.md), y la web se puede alojar en Netlify o similar.

## Licencia

[MIT](LICENSE)
