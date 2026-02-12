# Plataforma de Confirming - Documentación del Proyecto

## Resumen Ejecutivo

Este proyecto es una plataforma de confirming para Colombia que permite a empresas grandes (pagadores) financiar anticipadamente las facturas de sus proveedores.

**Alcance actual:** Capa 1 - Onboarding digital de pagadores + Back office de aprobación

**Stack tecnológico:**
- Backend/DB: Supabase (PostgreSQL + Auth + Edge Functions)
- Storage: AWS S3
- Orquestación: n8n (self-hosted en GCP)
- Back office: Next.js 14 + Tailwind + shadcn/ui
- IA documental: Google Document AI
- Frontend onboarding: Lovable (desarrollo paralelo)

---

## Estructura del Proyecto

```
PROYECTO CONFIRMING/
├── README.md                          # Este archivo
├── PLAN_ARQUITECTURA_CAPA_1.md        # Plan completo (LEER PRIMERO)
├── schema_supabase.sql                # Schema SQL ejecutable
├── contrato_datos_lovable.json        # API contract para frontend
├── n8n_workflows_config.md            # Configuración de workflows
└── confirming-backoffice/             # (Se creará al ejecutar)
    └── [proyecto Next.js]
```

---

## Archivos de Documentación

### 1. PLAN_ARQUITECTURA_CAPA_1.md
**El documento más importante.** Contiene:
- Decisión arquitectónica: FastAPI vs Edge Functions
- Schema completo de base de datos
- Estructura de carpetas S3
- Contrato de datos para Lovable
- Webhooks para n8n
- Plan de construcción del back office
- Integración con Document AI

**Léelo completo antes de ejecutar.**

### 2. schema_supabase.sql
Schema SQL listo para ejecutar en Supabase SQL Editor. Incluye:
- 9 tablas (3 para Capa 1, 6 para preparación de Capas 2-3)
- Índices optimizados
- Triggers automáticos
- Row Level Security (RLS) configurado
- Funciones útiles (validación NIT, etc)

### 3. contrato_datos_lovable.json
Especificación completa para el equipo de Lovable:
- Endpoints de Supabase disponibles
- Estructura de cada tabla
- Validaciones requeridas
- Ejemplos de código
- Flujo de autenticación
- Manejo de errores

### 4. n8n_workflows_config.md
Guía paso a paso para configurar workflows en n8n:
- Workflow 1: Procesador de notificaciones
- Workflow 2: Recordatorios automáticos
- Workflow 3: Sincronización Google Sheets
- Variables de entorno
- Testing de workflows

---

## Decisiones Arquitectónicas Clave

### ✅ Usar Supabase + Edge Functions (NO FastAPI por ahora)
**Razón:** Capa 1 es simple, no necesita servidor dedicado. Migrar a FastAPI en Capa 3 cuando llegue el motor transaccional.

### ✅ Documentos en S3 privado (NO Supabase Storage)
**Razón:** Mejor control de acceso, presigned URLs temporales, escalabilidad, costos predecibles.

### ✅ RLS desde día 1
**Razón:** Seguridad by default. Pagadores solo ven sus datos, admins ven todo.

### ✅ Document AI en Lambda (NO integración directa)
**Razón:** Separa responsabilidades, permite escalar procesamiento independiente, usa créditos GCP.

### ✅ n8n para orquestación (NO triggers directos de Supabase)
**Razón:** Flexibilidad, visibilidad, debugging, no vendor lock-in.

---

## Flujo de Datos Simplificado

```
Usuario (Lovable)
    ↓ [Auth via Supabase]
    ↓ [Formulario empresa]
    ↓ [INSERT empresas_pagadoras]
    ↓
Lovable llama Edge Function "generar-url-subida"
    ↓ [Edge Function crea registro en tabla documentos]
    ↓ [Edge Function retorna presigned URL]
    ↓
Lovable sube archivo a S3 con presigned URL
    ↓
Trigger INSERT en documentos
    ↓
INSERT en notificaciones_enviadas
    ↓
n8n (polling cada 30s)
    ↓ [Procesa notificaciones]
    ├─ Envía emails (AWS SES)
    ├─ Envía WhatsApp (Twilio)
    ├─ Llama Lambda Document AI
    └─ Actualiza Google Sheets
    ↓
Admin (Back office Next.js)
    ↓ [Revisa empresa]
    ↓ [Ve documentos con presigned URLs]
    ↓ [Ve resumen de Document AI]
    ↓ [Cambia estado a "aprobado"]
    ↓
UPDATE empresas_pagadoras
    ↓
Trigger notificar_cambio_estado
    ↓
INSERT en notificaciones_enviadas
    ↓
n8n envía email de aprobación al usuario
```

---

## Próximos Pasos

### Cuando escribas "EJECUTAR", se ejecutarán en este orden:

**Día 1: Infraestructura**
1. Ejecutar `schema_supabase.sql` en Supabase
2. Crear bucket S3 `confirming-documentos-prod`
3. Configurar políticas de acceso S3
4. Crear IAM roles para Edge Functions y Lambda

**Día 2: Edge Functions**
5. Crear Edge Function `generar-url-subida`
6. Crear Edge Function `obtener-url-documento`
7. Probar Edge Functions con Postman/curl

**Día 3-4: Back Office (Semana 1)**
8. Inicializar proyecto Next.js 14
9. Configurar Supabase client
10. Implementar autenticación (login admins)
11. Dashboard básico (lista de empresas)

**Semana 2: Back Office (Vista detalle)**
12. Componentes de datos de empresa
13. Visor de documentos (PDF + imágenes)
14. Panel de comentarios internos
15. Historial de estados

**Semana 3: Back Office (Acciones + IA)**
16. Botones de aprobar/rechazar/solicitar docs
17. Integración con extracción Document AI
18. Comparación de datos extraídos vs ingresados
19. Filtros y búsqueda en dashboard

**Semana 4: Integraciones**
20. Crear Lambda `document-ai-processor`
21. Configurar Document AI en GCP
22. Configurar workflows en n8n
23. Testing integral
24. Ajustes finales

**Día Final:**
25. Entregar `contrato_datos_lovable.json` al equipo de Lovable
26. Documentación de deployment
27. Variables de entorno para producción

---

## Requisitos Previos (ANTES de ejecutar)

### Debes tener creados:

- [ ] Cuenta de Supabase (proyecto creado)
- [ ] Cuenta de AWS (con permisos S3, Lambda, SES, IAM)
- [ ] Cuenta de GCP (con créditos, Document AI habilitado)
- [ ] Dominio para n8n (ej: n8n.tudominio.com)
- [ ] Servidor para n8n (GCP Cloud Run o similar)
- [ ] Cuenta de Twilio (para WhatsApp) - opcional para MVP

### Credenciales que necesitarás:

```bash
# Supabase
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_KEY

# AWS
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
AWS_REGION
AWS_S3_BUCKET

# Google Cloud
GOOGLE_CLOUD_PROJECT_ID
GOOGLE_APPLICATION_CREDENTIALS (JSON key)

# n8n
N8N_WEBHOOK_BASE_URL
```

**Tip:** Copia `.env.example` (que se creará) y completa con tus valores reales.

---

## Preguntas Frecuentes

### ¿Por qué no usar Vercel Storage o Cloudflare R2?
- **S3:** Más maduro, mejor control de permisos, presigned URLs estándar, integración con Document AI más directa.

### ¿Por qué Next.js 14 y no Remix/SvelteKit?
- **Next.js 14:** App Router moderno, mejor integración con Supabase, shadcn/ui (componentes listos), ecosistema React maduro.

### ¿Puedo usar otro proveedor de emails en vez de AWS SES?
- **Sí:** n8n soporta SendGrid, Mailgun, Postmark. Solo cambia el nodo en el workflow.

### ¿Necesito configurar HTTPS para n8n?
- **Sí:** Los webhooks deben ser HTTPS. Usa Cloudflare Tunnel o Let's Encrypt.

### ¿Cuánto cuesta Document AI?
- **GCP:** Primeras 1,000 páginas/mes gratis. Luego $1.50 por 1,000 páginas. Para Capa 1, ~$5-10/mes.

### ¿Qué pasa si un admin accidentalmente aprueba una empresa?
- Puedes revertir el estado manualmente. El historial queda registrado en `historial_estados`.

---

## Validación de NIT Colombiano

El formato del NIT es: `XXXXXXXXX-X` (9 dígitos + guión + 1 dígito verificador)

**Ejemplos válidos:**
- `900123456-7`
- `800987654-3`

**Ejemplos inválidos:**
- `900123456` (falta guión y dígito verificador)
- `90012345-6` (solo 8 dígitos)
- `900.123.456-7` (puntos no permitidos)

La validación está implementada en:
- SQL: función `validar_nit(nit_input TEXT)`
- Frontend: regex `/^\d{9}-\d{1}$/`

---

## Estados de Empresa

| Estado | Descripción | Acciones disponibles |
|--------|-------------|---------------------|
| `pendiente` | Recién creada | Admin puede mover a `en_revision` |
| `en_revision` | Admin está revisando | Admin puede mover a `aprobado`, `rechazado`, o `documentos_incompletos` |
| `documentos_incompletos` | Faltan docs o hay errores | Usuario puede actualizar, admin puede volver a `en_revision` |
| `aprobado` | Onboarding completo | Usuario puede acceder a Capa 2 (convenios) |
| `rechazado` | Solicitud rechazada | Final (sin acciones) |

**Flujo ideal:** `pendiente` → `en_revision` → `aprobado`

---

## Tipos de Documentos Requeridos

1. **Cámara de Comercio** (`camara_comercio`)
   - Formato: PDF
   - Extrae: NIT, razón social, representante legal, fecha constitución

2. **Registro de Accionistas** (`registro_accionistas`)
   - Formato: PDF
   - Extrae: Lista de accionistas, % participación

3. **RUT** (`rut`)
   - Formato: PDF
   - Extrae: NIT, razón social, dirección, ciudad

4. **Cédula Representante Legal** (`cedula_representante_legal`)
   - Formato: JPG, PNG, PDF (frente y reverso)
   - Extrae: Número, nombre, fecha expedición

5. **Declaración de Renta** (`declaracion_renta`)
   - Formato: PDF
   - Extrae: NIT, año, ingresos, patrimonio

6. **Estados Financieros** (`estados_financieros`)
   - Formato: PDF
   - Extrae: Activos, pasivos, patrimonio, utilidad

---

## Seguridad

### Implementado:
- ✅ Row Level Security (RLS) en todas las tablas
- ✅ Presigned URLs con expiración de 15 minutos
- ✅ Validación de roles (solo admins en back office)
- ✅ S3 bucket privado (sin acceso público)
- ✅ Auth via Supabase (Google, Apple, Email)
- ✅ HTTPS obligatorio para webhooks

### Por implementar (Capa 2+):
- 🔜 2FA para admins
- 🔜 Audit logs detallados
- 🔜 Encriptación de datos sensibles en reposo
- 🔜 Rate limiting en Edge Functions
- 🔜 IP whitelisting para back office

---

## Escalabilidad

### Capa 1 (actual):
- Capacidad: ~100 empresas/mes
- Documentos: ~600 archivos/mes
- Storage: ~3 GB/mes
- Costo estimado: $50-100/mes

### Capa 2 (convenios):
- Capacidad: ~500 empresas, ~2,000 proveedores
- Costo estimado: $200-300/mes

### Capa 3 (transaccional):
- Capacidad: ~10,000 facturas/mes
- Migrar a FastAPI + Redis
- Costo estimado: $500-1,000/mes

---

## Soporte y Mantenimiento

### Logs a monitorear:
1. **Supabase:** Dashboard > Logs > SQL queries lentas
2. **Edge Functions:** Supabase > Edge Functions > Logs
3. **n8n:** Executions > Failed workflows
4. **AWS Lambda:** CloudWatch Logs
5. **S3:** S3 Access Logs (si se habilita)

### Backups:
- **Supabase:** Backups automáticos diarios (plan Pro)
- **S3:** Versioning habilitado + Glacier archival después de 1 año

### Actualizaciones:
- **Next.js:** Actualizar cada 3 meses
- **Supabase SDK:** Actualizar cada 2 meses
- **Dependencies:** Renovate/Dependabot automático

---

## Contacto y Recursos

### Documentación oficial:
- [Supabase Docs](https://supabase.com/docs)
- [Next.js 14 App Router](https://nextjs.org/docs)
- [AWS S3 Presigned URLs](https://docs.aws.amazon.com/AmazonS3/latest/userguide/PresignedUrlUploadObject.html)
- [Google Document AI](https://cloud.google.com/document-ai/docs)
- [n8n Docs](https://docs.n8n.io/)
- [shadcn/ui Components](https://ui.shadcn.com/)

### Comunidades:
- Supabase Discord: https://discord.supabase.com
- Next.js Discord: https://nextjs.org/discord
- n8n Community: https://community.n8n.io

---

## Licencia

Este proyecto es privado y confidencial.

---

## Changelog

### 2026-02-12 - v1.0
- ✅ Plan de arquitectura completo
- ✅ Schema SQL listo
- ✅ Contrato de datos para Lovable
- ✅ Configuración de n8n workflows
- ⏳ Pendiente: Ejecución del plan

---

**¿Listo para ejecutar?**

Lee el archivo `PLAN_ARQUITECTURA_CAPA_1.md` completo, verifica que tienes todos los requisitos previos, y cuando estés listo, escribe:

```
EJECUTAR
```

Empezaré la construcción siguiendo el plan semana a semana.
