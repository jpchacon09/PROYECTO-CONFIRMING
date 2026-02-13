# Frontend Operativo (Cliente + Backoffice)

Fecha de actualización: 2026-02-13

Este documento es la referencia de operación para evitar bloqueos en frontend.

## URLs de producción

- **Cliente (onboarding):** https://confirming-onboarding.web.app (Firebase Hosting)
- **Backoffice (admin):** https://backoffice-confirming-741488896424.us-central1.run.app (Cloud Run, proyecto GCP `platam-analytics`)

## Alcance

- `cliente/`: portal de onboarding para empresas pagadoras (React + Vite).
- `backoffice/`: panel admin para revisión y gestión (Next.js App Router).

## Requisitos

- Node.js 20 o superior.
- npm 10 o superior.
- Proyecto Supabase activo y con tablas del `schema_supabase.sql`.

## Variables de entorno

### Cliente (`cliente/.env`)

Crear `cliente/.env` desde `cliente/.env.example`:

```bash
VITE_SUPABASE_URL=https://TU_PROYECTO.supabase.co
VITE_SUPABASE_ANON_KEY=TU_SUPABASE_ANON_KEY
```

### Backoffice (`backoffice/.env.local`)

Crear `backoffice/.env.local` desde `backoffice/.env.example`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://TU_PROYECTO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=TU_SUPABASE_ANON_KEY
SUPABASE_SERVICE_KEY=TU_SUPABASE_SERVICE_KEY
AWS_ACCESS_KEY_ID=TU_AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY=TU_AWS_SECRET_ACCESS_KEY
AWS_REGION=us-east-1
AWS_S3_BUCKET=TU_BUCKET
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Configuración de Auth en Supabase

En Supabase Auth, agregar estas URLs permitidas:

- `http://localhost:5173/auth/callback` (cliente local)
- `http://localhost:3000/auth/callback` (backoffice local)
- `https://confirming-onboarding.web.app/auth/callback` (cliente producción)
- `https://backoffice-confirming-741488896424.us-central1.run.app/login` (backoffice producción)

Sin estas URLs, OAuth/Magic Link no redirige correctamente.

## Arranque local

### Cliente

```bash
cd cliente
npm install
npm run dev
```

URL esperada: `http://localhost:5173`

### Backoffice

```bash
cd backoffice
npm install
npm run dev
```

URL esperada: `http://localhost:3000`

## Quality gate obligatorio antes de merge

### Cliente

```bash
cd cliente
npm run lint
npm run build
```

### Backoffice

```bash
cd backoffice
npm run lint
npm run type-check
npm run build
```

No subir cambios si alguno falla.

## Flujo funcional esperado

### Cliente

1. Login (`/login`).
2. Callback de auth (`/auth/callback`).
3. Onboarding datos (`/onboarding/datos-empresa`).
4. Subida de documentos (`/onboarding/documentos`).
5. Confirmación (`/onboarding/confirmacion`).
6. Seguimiento en dashboard (`/dashboard`).

### Backoffice

1. Login admin (`/login`).
2. Dashboard admin (`/dashboard`).
3. Detalle empresa (`/dashboard/empresas/[id]`).
4. Cambio de estado vía API interna `PATCH /api/admin/empresas/[id]/estado`.

## Checklist de datos mínimos en BD

- Tabla `usuarios` con roles correctos:
- `pagador` para usuarios del cliente.
- `admin` para usuarios del backoffice.
- Tabla `empresas_pagadoras` accesible con políticas RLS correctas.
- Edge Functions desplegadas:
- `generar-url-subida`
- `obtener-url-documento`

## Troubleshooting rápido

- Error `Missing Supabase environment variables`: revisar `.env` o `.env.local`.
- Login devuelve a `/login`: revisar URLs de callback permitidas en Supabase.
- No aparecen empresas en backoffice: validar rol `admin` y políticas RLS.
- Falla subida de documentos: validar secretos AWS en Supabase Functions y bucket.
- `next lint` pide configuración interactiva: ya está resuelto con `backoffice/.eslintrc.json`; si vuelve a salir, revisar que el archivo exista.

## Incidente 2026-02-13: 502/CORS en `/onboarding/documentos`

Síntoma reportado:

- `POST /functions/v1/generar-url-subida` devolviendo `502 Bad Gateway`.
- El navegador mostraba error CORS (`No 'Access-Control-Allow-Origin' header`), pero el origen era el `502`.

Cambio sensible aplicado (backend Supabase Functions):

- `supabase/functions/generar-url-subida/index.ts`: se eliminó `@aws-sdk/*` vía `esm.sh`, se implementó firma SigV4 nativa para URL presignada `PUT` y se mantuvo validación de JWT/autorización por empresa.
- `supabase/functions/obtener-url-documento/index.ts`: se eliminó `@aws-sdk/*` vía `esm.sh` y se implementó firma SigV4 nativa para URL presignada `GET`.
- `supabase/config.toml`: `verify_jwt = false` en ambas funciones y verificación fuerte se hace dentro de la función consultando `GET /auth/v1/user` con el token (evita 401 del gateway y evita JWTs falsificados).

Motivo técnico:

- reducir dependencia de imports remotos pesados en runtime de Edge Functions, que estaban correlacionados con fallos `502` antes de ejecutar la función.

Validación realizada después del deploy:

- `OPTIONS generar-url-subida`: `200`, con `Access-Control-Allow-Origin: *`.
- `POST generar-url-subida` con token inválido: `401`, con `Access-Control-Allow-Origin: *`.
- Logs recientes muestran ejecución sobre deployment actual (sin `502` en la ventana inmediatamente posterior al deploy).

Checklist frontend después de este cambio:

1. Abrir `http://127.0.0.1:5173/onboarding/documentos`.
2. Subir un PDF en `RUT`.
3. Confirmar que ya no aparece `502` en consola.
4. Confirmar que el documento aparece en la lista con estado subido.
5. Si falla, capturar `sb-request-id` del request a la function para traza rápida en logs.

## Despliegue a producción

### Cliente (Firebase Hosting)

```bash
cd cliente
npm run build
firebase deploy --only hosting --project confirming-onboarding
```

### Backoffice (Cloud Run)

```bash
cd backoffice
gcloud builds submit --config=cloudbuild.yaml --project=platam-analytics
gcloud run deploy backoffice-confirming \
  --image=gcr.io/platam-analytics/backoffice-confirming:latest \
  --platform=managed --region=us-central1 \
  --project=platam-analytics
```

Variables de entorno del runtime (ya configuradas en Cloud Run): `SUPABASE_SERVICE_KEY`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `AWS_S3_BUCKET`, `AWS_S3_PREFIX`.

Variables `NEXT_PUBLIC_*` se pasan como build args en `cloudbuild.yaml` (se embeben en el bundle de Next.js).

## Seguridad

- Nunca subir `.env`, `.env.local` ni archivos con credenciales.
- Usar únicamente `.env.example` con placeholders.
- Si una clave real se expone, rotarla inmediatamente en proveedor (AWS/Supabase).
