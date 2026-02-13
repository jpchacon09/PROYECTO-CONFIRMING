# Coordinación Frontend ↔ Backend

**Fecha:** 2026-02-12
**Frontend:** Claude Terminal 2 (backoffice Next.js)
**Backend:** Claude Terminal 1

---

## ✅ Lo que ya tiene el Backend

### Edge Functions (Supabase)
- ✅ `generar-url-subida` - Genera presigned URL para subir docs a S3
- ✅ `obtener-url-documento` - Obtiene presigned URL para ver docs

### API Routes
- ✅ `GET /api/health` - Health check
- ✅ `GET /api/empresas/me` - Obtener empresa del usuario
- ✅ `PATCH /api/admin/empresas/[id]/estado` - Cambiar estado (solo admin)

---

## ❌ Lo que falta (según CONTRATO.md)

### API Routes faltantes:
- ❌ `GET /api/documentos/:id/url` - Wrapper de Edge Function para presigned URL
- ❌ `GET /api/empresas/:id/documentos` - Listar documentos de empresa
- ❌ `GET /api/empresas/:id/historial` - Historial de cambios de estado

**NOTA:** Estos endpoints los puedo implementar YO en el frontend como API routes de Next.js si es necesario, o puedo llamar directamente a Supabase usando RLS (que es lo recomendado en CONTRATO.md).

---

## 🔥 URGENTE - ¿Qué necesito del Backend AHORA?

### 1. **Credenciales de Supabase**

¿Ya está creado el proyecto en Supabase? Si sí, necesito:

```bash
# .env para el frontend
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<SUPABASE_ANON_KEY>
SUPABASE_SERVICE_KEY=<SUPABASE_SERVICE_ROLE_KEY> (para server)
```

### 2. **¿Schema ejecutado?**

¿Ya ejecutaste `schema_supabase.sql` en Supabase SQL Editor?

Si **NO**, necesitas:
1. Ir a Supabase Dashboard → SQL Editor
2. Copiar todo el contenido de `schema_supabase.sql`
3. Ejecutar (Cmd+Enter)
4. Verificar que se crearon las 9 tablas + triggers

### 3. **¿Edge Functions desplegadas?**

¿Ya desplegaste las Edge Functions en Supabase?

```bash
# Necesitas ejecutar:
supabase functions deploy generar-url-subida
supabase functions deploy obtener-url-documento
```

### 4. **Credenciales AWS S3**

Para que las Edge Functions funcionen, necesitan estas variables de entorno en Supabase:

```bash
AWS_ACCESS_KEY_ID=<AWS_ACCESS_KEY_ID>
	AWS_SECRET_ACCESS_KEY=<AWS_SECRET_ACCESS_KEY>
	AWS_REGION=us-east-1
	AWS_S3_BUCKET=n8nagentrobust
```

---

## 🎯 Mi plan de trabajo (Frontend)

Mientras espero tu respuesta, voy a:

### ✅ Ya hecho:
1. ✅ Setup de Next.js 14 + TypeScript + Tailwind
2. ✅ Tipos de Supabase
3. ✅ Constantes (estados, tipos documento)
4. ✅ Componentes UI base (Button, Card, Badge, etc)
5. ✅ Autenticación + Middleware (solo admins)
6. ✅ Página de Login

### 🚧 Siguiente (necesito credenciales):
7. ⏳ Layout principal con Sidebar + Header
8. ⏳ Dashboard con lista de empresas
9. ⏳ Vista detalle de empresa
10. ⏳ Visor de documentos con presigned URLs
11. ⏳ Panel de comentarios internos
12. ⏳ Timeline de historial
13. ⏳ Acciones de admin (aprobar/rechazar)

---

## 💡 Decisión de arquitectura

Según el CONTRATO.md, voy a:

- **Consultas SELECT:** Llamar directamente a Supabase via SDK (RLS protege)
- **Documentos (presigned URLs):** Llamar a Edge Functions de Supabase
- **Cambiar estado:** Usar tu API route `/api/admin/empresas/[id]/estado`
- **Comentarios:** INSERT directo a Supabase (RLS solo permite a admins)

Esto evita duplicar endpoints y aprovecha RLS de Supabase.

---

## 📞 Lo que necesito de ti AHORA:

**Por favor, responde:**

1. ✅ ¿Ya está creado el proyecto en Supabase? → **[SÍ / NO]**
2. ✅ ¿Ya ejecutaste `schema_supabase.sql`? → **[SÍ / NO]**
3. ✅ ¿Ya desplegaste las Edge Functions? → **[SÍ / NO]**
4. ✅ Si todo está listo, ¿me pasas las credenciales? → **[.env]**

Si la respuesta a todo es **NO**, déjame saber y te ayudo a priorizar qué hacer primero.

---

**Frontend esperando respuesta...**
