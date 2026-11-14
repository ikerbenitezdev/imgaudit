# Desplegar el analizador en Google Cloud Run

Requisitos: cuenta de Google Cloud con facturación activada (pide tarjeta) y la CLI `gcloud` instalada.

## 1. Preparar el proyecto
```bash
gcloud auth login
gcloud projects create imgaudit-TUNOMBRE          # o usa uno existente
gcloud config set project imgaudit-TUNOMBRE
# Vincula la facturación en https://console.cloud.google.com/billing (Cloud Run la exige)
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com
```

## 2. Desplegar (desde la carpeta `imgaudit/` del repositorio, donde está el Dockerfile)
```bash
cd imgaudit
gcloud run deploy imgaudit-api \
  --source . \
  --region europe-west1 \
  --allow-unauthenticated \
  --execution-environment gen2 \
  --memory 2Gi --cpu 1 \
  --concurrency 40 \
  --max-instances 1 \
  --timeout 300 \
  --set-env-vars "^@^CORS_ORIGIN=https://TUWEB.netlify.app,http://localhost:3000@RATE_LIMIT=6@MAX_JOBS=3"
```
La primera construcción tarda varios minutos (descarga Chromium). Al terminar, `gcloud` imprime la URL del servicio, del estilo `https://imgaudit-api-xxxx.a.run.app`.

Por qué estos valores:
- `--max-instances 1`: limita el gasto máximo y mantiene todos los datos del análisis (imágenes para descargar) en la misma instancia. Con más instancias, las descargas podrían caer en otra y dar "caducado".
- `--concurrency 40`: la instancia atiende varias peticiones (miniaturas, descargas), pero el propio servidor solo deja correr un análisis a la vez.
- `--timeout 300`: un análisis puede tardar hasta unos 2-3 minutos.
- `--memory 2Gi`: Chromium necesita holgura.
- El separador `^@^` permite poner comas dentro de `CORS_ORIGIN`.
- Pon en `CORS_ORIGIN` el origen exacto de tu web (sin barra final). Quita `http://localhost:3000` cuando termines de probar.

## 3. Conectar la web
En Netlify (o en `.env.local` para probar en local): `NEXT_PUBLIC_ANALYZER_URL=https://imgaudit-api-xxxx.a.run.app` y vuelve a desplegar la web.

## 4. Control del gasto
- En Facturación -> Presupuestos y alertas, crea un presupuesto bajo (por ejemplo 5 EUR) con avisos por correo. Ojo: las alertas AVISAN, no cortan el gasto.
- El tope real lo ponen `--max-instances 1` y `RATE_LIMIT`.
- Revisa en la página de precios de Cloud Run que tu región entra en el uso gratuito mensual.

## 5. Actualizar o ver registros
```bash
gcloud run deploy imgaudit-api --source . --region europe-west1   # actualizar (conserva el resto de opciones)
gcloud run services logs read imgaudit-api --region europe-west1  # registros
```
