# Estado del Backend - Plataforma Confirming

**Última actualización:** 2026-02-13 00:20

---

## ✅ COMPLETADO

### 1. Base de Datos (Supabase)
- ✅ Schema ejecutado correctamente (9 tablas)
- ✅ Triggers configurados (historial, notificaciones)
- ✅ Row Level Security (RLS) activo
- ✅ Funciones SQL creadas

**URL:** https://supabase.com/dashboard/project/admmzddhtrvgzbbhkiqf

### 2. Edge Functions (Supabase)
- ✅ `generar-url-subida` desplegada
- ✅ `obtener-url-documento` desplegada
- ✅ Secrets de AWS configurados

**URL:** https://supabase.com/dashboard/project/admmzddhtrvgzbbhkiqf/functions

**Endpoints:**
```
POST https://admmzddhtrvgzbbhkiqf.supabase.co/functions/v1/generar-url-subida
POST https://admmzddhtrvgzbbhkiqf.supabase.co/functions/v1/obtener-url-documento
```

Notas (2026-02-13):

- Se corrigieron `502 Bad Gateway` intermitentes en `generar-url-subida` eliminando dependencias pesadas remotas (`@aws-sdk/*` vía `esm.sh`) y firmando URLs presignadas de S3 con SigV4 nativo.
- Se agregó CORS consistente en respuestas de error/éxito para evitar falsos positivos en frontend.

### 3. Backend Next.js
- ✅ Estructura de carpetas creada
- ✅ Dependencias instaladas (144 packages)
- ✅ Tipos TypeScript definidos
- ✅ API endpoints creados:
  - `/api/health`
  - `/api/empresas/me`
  - `/api/admin/empresas/[id]/estado`
- ✅ Archivo `.env.local` configurado

**Ubicación:** `/Users/jpchacon/PROYECTO CONFIRMING/backend`

### 4. Documentación
- ✅ CONTRATO.md (especificación completa del API)
- ✅ Schema SQL documentado
- ✅ Edge Functions documentadas

---

## ⏳ PENDIENTE

### 1. Permisos de S3
**Estado:** Esperando que agregues política al usuario IAM

**Usuario IAM actual:** `platam-api-user` (arn:aws:iam::150890185530:user/platam-api-user)

**Acción requerida:** Agregar esta política inline:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:ListBucket",
        "s3:GetObject",
        "s3:PutObject",
        "s3:PutObjectAcl",
        "s3:DeleteObject"
      ],
      "Resource": [
        "arn:aws:s3:::n8nagentrobust",
        "arn:aws:s3:::n8nagentrobust/CONFIRMING/*"
      ]
    }
  ]
}
```

**Dónde:**
1. https://console.aws.amazon.com/iam
2. Users → `platam-api-user`
3. Permissions → Add inline policy → JSON
4. Nombrar: `ConfirmingS3Access`

### 2. Configuración del bucket S3
**Estado:** Pendiente hasta tener permisos

**Acción requerida:** Ejecutar script de configuración:
```bash
bash aws-s3-setup.sh
```

Esto configurará:
- Bloqueo de acceso público
- Versionado
- Encriptación AES256
- CORS para presigned URLs
- Lifecycle policies
- Estructura de carpetas

---

## 🧪 TESTING

### Probar Edge Function (cuando S3 esté listo):

```bash
curl -X POST \
  https://admmzddhtrvgzbbhkiqf.supabase.co/functions/v1/generar-url-subida \
  -H "Authorization: Bearer TU-JWT-TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "empresa_id": "uuid-de-empresa",
    "tipo_documento": "rut",
    "nombre_archivo": "test.pdf",
    "mime_type": "application/pdf",
    "tamano_bytes": 12345
  }'
```

### Probar Backend Next.js:

```bash
cd backend
npm run dev
```

Luego:
```bash
curl http://localhost:3001/api/health
```

---

## 📋 PRÓXIMOS PASOS

### Inmediatos:
1. **Tú:** Agregar política de S3 al usuario IAM
2. **Yo:** Ejecutar script de configuración de S3
3. **Yo:** Verificar que presigned URLs funcionan
4. **Tú/Frontend:** Empezar desarrollo del frontend en Lovable

### Opcionales (pueden esperar):
5. Google Document AI (para extracción automática)
6. n8n webhooks (para notificaciones)
7. Back office Next.js (para admins)

---

## 🔑 Credenciales Configuradas

### Supabase:
- ✅ URL: `https://admmzddhtrvgzbbhkiqf.supabase.co`
- ✅ Anon Key: Configurada
- ⚠️ Service Key: Configurada (verificar si es la correcta)

### AWS:
- ✅ Access Key ID: `Configurada (oculta por seguridad)`
- ✅ Secret Access Key: Configurada
- ✅ Region: `us-east-1`
- ✅ Bucket: `n8nagentrobust`

### Supabase CLI:
- ✅ Access Token: Configurado
- ✅ Proyecto linkeado: `admmzddhtrvgzbbhkiqf`

---

## 📝 Notas

1. **Service Role Key:** Actualmente usando una clave secreta de Supabase; si ves errores en el backend, busca en Supabase Dashboard → Settings → API → `service_role` (debe ser un JWT largo).

2. **Vulnerabilidad:** Hay 1 vulnerabilidad high en las dependencias. No es crítica por ahora pero revisar después con `npm audit`.

3. **Backend Port:** El backend corre en puerto 3001 para no conflictuar con frontend (3000).

---

## 🆘 Si algo falla

1. **Edge Functions no responden:** Verificar logs en Supabase Dashboard
2. **Presigned URLs fallan:** Verificar permisos de S3
3. **Backend no inicia:** Verificar `.env.local` tiene todas las variables
4. **CORS errors:** Ejecutar configuración de S3

---

**¿Listo para agregar los permisos de S3?**

Cuando estén listos, avísame y ejecuto el script de configuración.
