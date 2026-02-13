# CONTRATO BACKEND - Frontend API Specification

**Versión:** 1.0.0
**Última actualización:** 2026-02-12
**Responsable:** Backend Team

---

## Tabla de Contenidos

1. [Configuración de Supabase](#1-configuración-de-supabase)
2. [Schema de Base de Datos](#2-schema-de-base-de-datos)
3. [Estados y Transiciones](#3-estados-y-transiciones)
4. [Endpoints de API](#4-endpoints-de-api)
5. [Edge Functions de Supabase](#5-edge-functions-de-supabase)
6. [Estructura de S3](#6-estructura-de-s3)
7. [Webhooks para n8n](#7-webhooks-para-n8n)
8. [Convenciones de Nomenclatura](#8-convenciones-de-nomenclatura)
9. [Códigos de Error](#9-códigos-de-error)
10. [Ejemplos de Uso](#10-ejemplos-de-uso)

---

## 1. Configuración de Supabase

### Variables de Entorno Requeridas

```bash
# Frontend (públicas)
VITE_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Backend (privadas - NO exponer al cliente)
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Inicialización del Cliente

```typescript
// Frontend (cliente)
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

// Backend (servidor)
import { createClient } from '@supabase/supabase-js'

export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)
```

### Autenticación

**Proveedores soportados:**
- Google OAuth
- Apple OAuth
- Email Magic Link

**Headers requeridos para requests autenticados:**
```
Authorization: Bearer <jwt_token>
```

---

## 2. Schema de Base de Datos

### 2.1 Tabla: `usuarios`

| Campo | Tipo | Restricciones | Descripción |
|-------|------|---------------|-------------|
| `id` | UUID | PRIMARY KEY, REFERENCES auth.users(id) | ID del usuario (coincide con Supabase Auth) |
| `rol` | VARCHAR(20) | NOT NULL, CHECK (rol IN ('pagador', 'proveedor', 'admin')) | Rol del usuario |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | Fecha de creación |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() | Última actualización |

**RLS Policies:**
- `SELECT`: Usuario puede ver solo su propio perfil, admins ven todos
- `INSERT`: Permitido al crear cuenta
- `UPDATE`: Solo su propio registro

### 2.2 Tabla: `empresas_pagadoras`

| Campo | Tipo | Restricciones | Descripción |
|-------|------|---------------|-------------|
| `id` | UUID | PRIMARY KEY | ID único de la empresa |
| `usuario_id` | UUID | NOT NULL, REFERENCES usuarios(id) | ID del usuario propietario |
| `nit` | VARCHAR(12) | NOT NULL, UNIQUE | NIT colombiano (formato: XXXXXXXXX-X) |
| `razon_social` | VARCHAR(255) | NOT NULL | Nombre legal de la empresa |
| `direccion` | TEXT | NOT NULL | Dirección completa |
| `ciudad` | VARCHAR(100) | NOT NULL | Ciudad |
| `departamento` | VARCHAR(100) | NOT NULL | Departamento de Colombia |
| `actividad_economica` | VARCHAR(255) | NOT NULL | Descripción de actividad |
| `codigo_ciiu` | VARCHAR(10) | NOT NULL | Código CIIU (4 dígitos) |
| `representante_legal_nombre` | VARCHAR(255) | NOT NULL | Nombre completo del rep. legal |
| `representante_legal_cedula` | VARCHAR(15) | NOT NULL | Número de cédula |
| `representante_legal_email` | VARCHAR(255) | NOT NULL | Email de contacto |
| `representante_legal_telefono` | VARCHAR(20) | NOT NULL | Teléfono (formato: +57XXXXXXXXXX) |
| `estado` | VARCHAR(30) | NOT NULL, DEFAULT 'pendiente' | Estado actual del onboarding |
| `estado_anterior` | VARCHAR(30) | NULL | Estado previo (auto-actualizado) |
| `fecha_cambio_estado` | TIMESTAMPTZ | NULL | Fecha del último cambio de estado |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | Fecha de creación |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() | Última actualización |
| `aprobado_por` | UUID | NULL, REFERENCES usuarios(id) | Admin que aprobó |
| `fecha_aprobacion` | TIMESTAMPTZ | NULL | Fecha de aprobación |
| `ip_registro` | INET | NULL | IP desde donde se registró |
| `user_agent` | TEXT | NULL | User agent del navegador |

**RLS Policies:**
- `SELECT`: Usuario ve solo su empresa, admins ven todas
- `INSERT`: Usuario puede crear 1 empresa asociada a su cuenta
- `UPDATE`: Usuario solo si estado es 'pendiente' o 'documentos_incompletos', admins siempre

**Índices:**
- `idx_empresas_nit` (nit)
- `idx_empresas_estado` (estado)
- `idx_empresas_created` (created_at DESC)
- `idx_empresas_usuario` (usuario_id)

### 2.3 Tabla: `documentos`

| Campo | Tipo | Restricciones | Descripción |
|-------|------|---------------|-------------|
| `id` | UUID | PRIMARY KEY | ID único del documento |
| `empresa_id` | UUID | NOT NULL, REFERENCES empresas_pagadoras(id) | Empresa asociada |
| `tipo_documento` | VARCHAR(50) | NOT NULL, CHECK (tipo_documento IN (...)) | Tipo de documento |
| `s3_bucket` | VARCHAR(100) | NOT NULL | Nombre del bucket S3 |
| `s3_key` | VARCHAR(500) | NOT NULL | Path completo en S3 |
| `nombre_original` | VARCHAR(255) | NOT NULL | Nombre original del archivo |
| `mime_type` | VARCHAR(100) | NOT NULL | Tipo MIME del archivo |
| `tamano_bytes` | BIGINT | NOT NULL | Tamaño en bytes |
| `extraccion_completa` | BOOLEAN | DEFAULT FALSE | Si Document AI terminó |
| `extraccion_data` | JSONB | NULL | Datos raw de Document AI |
| `extraccion_resumen` | JSONB | NULL | Campos clave extraídos |
| `extraccion_confianza` | DECIMAL(3,2) | NULL | Confianza (0.00 a 1.00) |
| `extraccion_fecha` | TIMESTAMPTZ | NULL | Fecha de extracción |
| `subido_por` | UUID | NOT NULL, REFERENCES usuarios(id) | Usuario que subió |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | Fecha de subida |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() | Última actualización |
| `es_version_actual` | BOOLEAN | DEFAULT TRUE | Si es la versión más reciente |
| `reemplaza_a` | UUID | NULL, REFERENCES documentos(id) | Documento que reemplaza |

**Tipos de documento válidos:**
- `camara_comercio`
- `registro_accionistas`
- `rut`
- `cedula_representante_legal`
- `declaracion_renta`
- `estados_financieros`
- `otro`

**RLS Policies:**
- `SELECT`: Usuario ve documentos de su empresa, admins ven todos
- `INSERT`: **NO directo**, usar Edge Function `generar-url-subida`
- `UPDATE`: Solo admins (para actualizar extracción)

### 2.4 Tabla: `historial_estados`

| Campo | Tipo | Restricciones | Descripción |
|-------|------|---------------|-------------|
| `id` | UUID | PRIMARY KEY | ID único del registro |
| `empresa_id` | UUID | NOT NULL, REFERENCES empresas_pagadoras(id) | Empresa asociada |
| `estado_anterior` | VARCHAR(30) | NULL | Estado previo |
| `estado_nuevo` | VARCHAR(30) | NOT NULL | Nuevo estado |
| `cambiado_por` | UUID | NULL, REFERENCES usuarios(id) | Usuario que cambió |
| `motivo` | TEXT | NULL | Razón del cambio |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | Fecha del cambio |

**RLS Policies:**
- `SELECT`: Usuario ve historial de su empresa, admins ven todo
- `INSERT/UPDATE/DELETE`: Automático via trigger, no manual

### 2.5 Tabla: `comentarios_internos`

| Campo | Tipo | Restricciones | Descripción |
|-------|------|---------------|-------------|
| `id` | UUID | PRIMARY KEY | ID único del comentario |
| `empresa_id` | UUID | NOT NULL, REFERENCES empresas_pagadoras(id) | Empresa asociada |
| `usuario_id` | UUID | NOT NULL, REFERENCES usuarios(id) | Admin que comentó |
| `comentario` | TEXT | NOT NULL | Texto del comentario |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | Fecha de creación |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() | Última actualización |

**RLS Policies:**
- `SELECT`: Solo admins
- `INSERT`: Solo admins
- **NO visible para pagadores**

### 2.6 Tabla: `notificaciones_enviadas`

| Campo | Tipo | Restricciones | Descripción |
|-------|------|---------------|-------------|
| `id` | UUID | PRIMARY KEY | ID único de la notificación |
| `empresa_id` | UUID | NULL, REFERENCES empresas_pagadoras(id) | Empresa asociada |
| `tipo` | VARCHAR(50) | NOT NULL, CHECK (tipo IN ('email', 'whatsapp', 'sms', 'push')) | Tipo de notificación |
| `evento` | VARCHAR(100) | NOT NULL | Nombre del evento |
| `destinatario` | VARCHAR(255) | NOT NULL | Email, teléfono, etc |
| `enviado` | BOOLEAN | DEFAULT FALSE | Si fue enviada |
| `fecha_envio` | TIMESTAMPTZ | NULL | Fecha de envío |
| `error` | TEXT | NULL | Error si falló |
| `payload` | JSONB | NULL | Datos del evento |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | Fecha de creación |

**RLS Policies:**
- `SELECT`: Solo admins
- **Manejada por triggers y n8n**

---

## 3. Estados y Transiciones

### 3.1 Diagrama de Estados

```
          ┌─────────────┐
    START │             │
    ───────►  pendiente  │
          │             │
          └──────┬──────┘
                 │
                 ▼
          ┌─────────────┐
          │             │
          │ en_revision │
          │             │
          └──────┬──────┘
                 │
         ┌───────┼───────┐
         │       │       │
         ▼       ▼       ▼
    ┌─────┐  ┌──────┐  ┌─────────────────────┐
    │     │  │      │  │                     │
    │ ✓   │  │  ✗   │  │ documentos_         │
    │     │  │      │  │ incompletos         │
    │     │  │      │  │                     │
    └─────┘  └──────┘  └─────────┬───────────┘
   aprobado rechazado            │
     (END)    (END)               │
                                  │
                                  └──────┐
                                         │
                                         ▼
                                  (puede volver
                                   a en_revision)
```

### 3.2 Estados Válidos

| Estado | Descripción | Acciones permitidas al usuario | Próximos estados |
|--------|-------------|-------------------------------|------------------|
| `pendiente` | Solicitud recibida, esperando revisión inicial | Solo lectura | `en_revision` (por admin) |
| `en_revision` | Equipo interno está revisando documentos | Solo lectura | `aprobado`, `rechazado`, `documentos_incompletos` |
| `documentos_incompletos` | Faltan documentos o hay errores | Puede actualizar datos y subir documentos | `en_revision` (automático al completar) |
| `aprobado` | Onboarding completado exitosamente | Acceso completo a plataforma | *(estado final)* |
| `rechazado` | Solicitud rechazada | Solo lectura | *(estado final)* |

### 3.3 Reglas de Transición

**Solo admins pueden cambiar estado**, excepto:
- Usuario puede actualizar datos → automáticamente vuelve a `en_revision` si estaba en `documentos_incompletos`

**Validaciones:**
- No se puede pasar a `aprobado` si faltan documentos requeridos
- Todo cambio de estado debe registrar `motivo` en historial
- Los cambios generan notificaciones automáticas

---

## 4. Endpoints de API

**Base URL:** `https://tudominio.com/api` (Next.js API Routes)

Todos los endpoints requieren autenticación via header `Authorization: Bearer <token>` excepto donde se indique.

### 4.1 Health Check

#### GET `/api/health`

**Descripción:** Verifica que el backend esté funcionando

**Auth:** No requerida

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-02-12T10:30:00.000Z",
  "services": {
    "supabase": "connected",
    "s3": "connected"
  }
}
```

---

### 4.2 Documentos

#### POST `/api/documentos/presigned-url`

**Descripción:** Genera presigned URL para subir documento a S3 (wrapper de Edge Function)

**Auth:** Requerida (usuario autenticado)

**Request Body:**
```json
{
  "empresa_id": "uuid-de-la-empresa",
  "tipo_documento": "rut",
  "nombre_archivo": "rut_empresa.pdf",
  "mime_type": "application/pdf",
  "tamano_bytes": 245678
}
```

**Validaciones:**
- `empresa_id`: Debe pertenecer al usuario autenticado (o ser admin)
- `tipo_documento`: Debe ser uno de los tipos válidos
- `mime_type`: Solo `application/pdf`, `image/jpeg`, `image/png`, `image/jpg`
- `tamano_bytes`: Máximo 10485760 (10 MB)

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "presigned_url": "https://s3.amazonaws.com/confirming-documentos-prod/...",
    "s3_bucket": "confirming-documentos-prod",
    "s3_key": "pagadores/900123456-7/rut/20260212_a3f2b1c4_rut.pdf",
    "documento_id": "uuid-del-registro-creado",
    "expires_in": 900
  }
}
```

**Response (400 Bad Request):**
```json
{
  "success": false,
  "error": {
    "code": "INVALID_FILE_SIZE",
    "message": "El archivo supera el tamaño máximo de 10 MB"
  }
}
```

**Response (403 Forbidden):**
```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED_EMPRESA",
    "message": "No tienes permiso para subir documentos a esta empresa"
  }
}
```

---

#### GET `/api/documentos/:id/url`

**Descripción:** Obtiene presigned URL temporal para visualizar/descargar documento

**Auth:** Requerida (usuario autenticado o admin)

**Path Parameters:**
- `id`: UUID del documento

**Query Parameters:**
- `expires_in` (opcional): Tiempo de expiración en segundos (default: 900, max: 900)

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "presigned_url": "https://s3.amazonaws.com/confirming-documentos-prod/...?expires=...",
    "expires_in": 900,
    "mime_type": "application/pdf",
    "nombre_original": "rut_empresa.pdf"
  }
}
```

**Response (404 Not Found):**
```json
{
  "success": false,
  "error": {
    "code": "DOCUMENTO_NOT_FOUND",
    "message": "El documento no existe"
  }
}
```

---

### 4.3 Empresas

#### GET `/api/empresas/me`

**Descripción:** Obtiene la empresa del usuario autenticado

**Auth:** Requerida

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "uuid-empresa",
    "nit": "900123456-7",
    "razon_social": "EMPRESA XYZ S.A.S.",
    "direccion": "Calle 123 # 45-67",
    "ciudad": "Bogotá",
    "departamento": "Cundinamarca",
    "actividad_economica": "Desarrollo de software",
    "codigo_ciiu": "6201",
    "representante_legal_nombre": "Juan Pérez",
    "representante_legal_cedula": "1234567890",
    "representante_legal_email": "juan@empresa.com",
    "representante_legal_telefono": "+573001234567",
    "estado": "pendiente",
    "created_at": "2026-02-12T10:00:00.000Z",
    "updated_at": "2026-02-12T10:00:00.000Z"
  }
}
```

**Response (404 Not Found):**
```json
{
  "success": false,
  "error": {
    "code": "EMPRESA_NOT_FOUND",
    "message": "No tienes una empresa registrada"
  }
}
```

---

#### GET `/api/empresas/:id/documentos`

**Descripción:** Lista documentos de una empresa

**Auth:** Requerida (usuario propietario o admin)

**Path Parameters:**
- `id`: UUID de la empresa

**Query Parameters:**
- `tipo_documento` (opcional): Filtrar por tipo
- `es_version_actual` (opcional): true/false (default: true)

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid-doc-1",
      "tipo_documento": "rut",
      "nombre_original": "rut_empresa.pdf",
      "mime_type": "application/pdf",
      "tamano_bytes": 245678,
      "extraccion_completa": true,
      "extraccion_confianza": 0.95,
      "created_at": "2026-02-12T10:15:00.000Z"
    },
    {
      "id": "uuid-doc-2",
      "tipo_documento": "camara_comercio",
      "nombre_original": "camara_comercio.pdf",
      "mime_type": "application/pdf",
      "tamano_bytes": 512345,
      "extraccion_completa": false,
      "extraccion_confianza": null,
      "created_at": "2026-02-12T10:20:00.000Z"
    }
  ],
  "meta": {
    "total": 2,
    "tipos_requeridos": 6,
    "onboarding_completo": false
  }
}
```

---

#### GET `/api/empresas/:id/historial`

**Descripción:** Obtiene historial de cambios de estado

**Auth:** Requerida (usuario propietario o admin)

**Path Parameters:**
- `id`: UUID de la empresa

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid-hist-1",
      "estado_anterior": null,
      "estado_nuevo": "pendiente",
      "cambiado_por": null,
      "motivo": "Registro inicial",
      "created_at": "2026-02-12T10:00:00.000Z"
    },
    {
      "id": "uuid-hist-2",
      "estado_anterior": "pendiente",
      "estado_nuevo": "en_revision",
      "cambiado_por": "uuid-admin",
      "motivo": "Inicio de revisión de documentos",
      "created_at": "2026-02-13T09:00:00.000Z"
    }
  ]
}
```

---

### 4.4 Admin - Cambiar Estado de Empresa

#### PATCH `/api/admin/empresas/:id/estado`

**Descripción:** Cambiar el estado de una empresa (solo admins)

**Auth:** Requerida (rol: admin)

**Path Parameters:**
- `id`: UUID de la empresa

**Request Body:**
```json
{
  "nuevo_estado": "aprobado",
  "motivo": "Todos los documentos han sido verificados correctamente"
}
```

**Validaciones:**
- Solo admins pueden ejecutar este endpoint
- `nuevo_estado` debe ser uno de los estados válidos
- `motivo` es obligatorio si el estado es `rechazado` o `documentos_incompletos`

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "empresa_id": "uuid-empresa",
    "estado_anterior": "en_revision",
    "estado_nuevo": "aprobado",
    "cambiado_por": "uuid-admin",
    "fecha_cambio": "2026-02-13T15:30:00.000Z"
  }
}
```

**Response (403 Forbidden):**
```json
{
  "success": false,
  "error": {
    "code": "ADMIN_REQUIRED",
    "message": "Solo administradores pueden cambiar el estado"
  }
}
```

---

## 5. Edge Functions de Supabase

### 5.1 `generar-url-subida`

**Descripción:** Genera presigned URL para subir documento a S3 y crea registro en DB

**Endpoint:** `https://xxxxx.supabase.co/functions/v1/generar-url-subida`

**Method:** POST

**Auth:** Required (Bearer token en header)

**Request Body:**
```json
{
  "empresa_id": "uuid-de-la-empresa",
  "tipo_documento": "rut",
  "nombre_archivo": "rut_empresa.pdf",
  "mime_type": "application/pdf",
  "tamano_bytes": 245678
}
```

**Response (200 OK):**
```json
{
  "presigned_url": "https://s3.amazonaws.com/confirming-documentos-prod/pagadores/900123456-7/rut/20260212_153045_a3f2b1c4_rut_empresa.pdf?X-Amz-Algorithm=...",
  "s3_bucket": "confirming-documentos-prod",
  "s3_key": "pagadores/900123456-7/rut/20260212_153045_a3f2b1c4_rut_empresa.pdf",
  "documento_id": "uuid-del-documento-creado"
}
```

**Flujo interno:**
1. Validar autenticación
2. Verificar que empresa pertenece al usuario
3. Generar S3 key con timestamp + UUID + nombre sanitizado
4. Crear registro en tabla `documentos` con `extraccion_completa = false`
5. Generar presigned URL de S3 (PUT) con expiración de 15 minutos
6. Retornar URL + metadata

**Error Codes:**
- `401`: No autenticado
- `403`: Empresa no pertenece al usuario
- `400`: Parámetros inválidos
- `500`: Error al generar presigned URL

---

### 5.2 `obtener-url-documento`

**Descripción:** Genera presigned URL temporal para visualizar/descargar documento

**Endpoint:** `https://xxxxx.supabase.co/functions/v1/obtener-url-documento`

**Method:** POST

**Auth:** Required (Bearer token en header)

**Request Body:**
```json
{
  "documento_id": "uuid-del-documento"
}
```

**Response (200 OK):**
```json
{
  "presigned_url": "https://s3.amazonaws.com/confirming-documentos-prod/...?expires=...",
  "expires_in": 900,
  "mime_type": "application/pdf"
}
```

**Flujo interno:**
1. Validar autenticación
2. Obtener documento de DB
3. Verificar permisos (usuario propietario o admin)
4. Generar presigned URL de S3 (GET) con expiración de 15 minutos
5. Retornar URL

**Error Codes:**
- `401`: No autenticado
- `403`: Sin permisos para ver este documento
- `404`: Documento no existe
- `500`: Error al generar presigned URL

---

## 6. Estructura de S3

### 6.1 Bucket Principal

**Nombre:** `bucketn8n-platam`
**Prefix:** `confirming/`
**Region:** `us-east-1`
**Acceso público:** **BLOQUEADO** (solo via presigned URLs)

### 6.2 Estructura de Carpetas

```
bucketn8n-platam/
└── confirming/
    │
    ├── pagadores/
│   └── {nit}/                                    # Ej: 900123456-7
│       ├── camara_comercio/
│       │   └── {timestamp}_{uuid}_{nombre}.pdf   # Ej: 20260212_153045_a3f2b1c4_camara.pdf
│       ├── registro_accionistas/
│       │   └── {timestamp}_{uuid}_{nombre}.pdf
│       ├── rut/
│       │   └── {timestamp}_{uuid}_{nombre}.pdf
│       ├── cedula_representante_legal/
│       │   ├── {timestamp}_{uuid}_frente.jpg
│       │   └── {timestamp}_{uuid}_reverso.jpg
│       ├── declaracion_renta/
│       │   └── {timestamp}_{uuid}_{nombre}.pdf
│       ├── estados_financieros/
│       │   └── {timestamp}_{uuid}_{nombre}.pdf
│       └── otros/
│           └── {timestamp}_{uuid}_{nombre}.{ext}
│
├── proveedores/                                  # Para Capa 2
│   └── {nit}/
│       └── ...
│
└── facturas/                                     # Para Capa 3
    └── {año}/
        └── {mes}/
            └── ...
```

### 6.3 Nomenclatura de Archivos

**Formato:**
```
{timestamp}_{uuid-corto}_{descripcion_sanitizada}.{extension}
```

**Componentes:**
- `timestamp`: `YYYYMMDD_HHMMSS` en UTC
- `uuid-corto`: Primeros 8 caracteres de UUID v4 (sin guiones)
- `descripcion_sanitizada`: Nombre original sin caracteres especiales, max 50 chars, lowercase
- `extension`: pdf, jpg, png, etc.

**Ejemplo:**
```
Original: "RUT Empresa XYZ S.A.S. (copia 2024).pdf"
S3 Key:   "pagadores/900123456-7/rut/20260212_153045_a3f2b1c4_rut_empresa_xyz_sas_copia_2024.pdf"
```

**Función de sanitización:**
```typescript
function sanitizeFilename(filename: string): string {
  return filename
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '_') // Reemplazar caracteres especiales
    .replace(/_+/g, '_')            // Múltiples _ a uno solo
    .substring(0, 50)               // Max 50 chars
}
```

### 6.4 Lifecycle Policies

- **0-90 días:** STANDARD (acceso frecuente)
- **90-365 días:** STANDARD_IA (acceso infrecuente)
- **365+ días:** GLACIER_IR (archivo)

---

## 7. Webhooks para n8n

### 7.1 Arquitectura

Los webhooks se disparan via triggers de Supabase que insertan registros en `notificaciones_enviadas`.
n8n hace polling cada 30 segundos y procesa las notificaciones pendientes.

### 7.2 Evento: `onboarding_completo`

**Trigger:** Cuando se suben los 6 documentos requeridos

**Payload en `notificaciones_enviadas.payload`:**
```json
{
  "evento": "onboarding_completo",
  "timestamp": "2026-02-12T15:30:45.123Z",
  "empresa": {
    "id": "uuid-empresa",
    "nit": "900123456-7",
    "razon_social": "EMPRESA XYZ S.A.S.",
    "ciudad": "Bogotá",
    "estado": "pendiente"
  },
  "representante_legal": {
    "nombre": "Juan Pérez",
    "email": "juan@empresa.com",
    "telefono": "+573001234567"
  },
  "total_documentos": 6
}
```

**Acciones de n8n:**
1. Enviar email al equipo interno
2. Enviar WhatsApp a número configurado
3. Agregar fila en Google Sheet "Registro Onboardings"

---

### 7.3 Evento: `estado_cambiado`

**Trigger:** Cuando un admin cambia el estado de una empresa

**Payload:**
```json
{
  "evento": "estado_cambiado",
  "timestamp": "2026-02-12T16:00:00.789Z",
  "empresa": {
    "id": "uuid-empresa",
    "nit": "900123456-7",
    "razon_social": "EMPRESA XYZ S.A.S.",
    "email_contacto": "juan@empresa.com"
  },
  "cambio": {
    "estado_anterior": "en_revision",
    "estado_nuevo": "aprobado",
    "cambiado_por": "uuid-admin",
    "motivo": "Documentos verificados correctamente"
  }
}
```

**Acciones de n8n (según estado nuevo):**

**Si `estado_nuevo = 'aprobado'`:**
- Enviar email de felicitación al usuario
- Enviar WhatsApp de bienvenida
- Actualizar Google Sheet

**Si `estado_nuevo = 'rechazado'`:**
- Enviar email explicando motivo
- Notificar a equipo comercial

**Si `estado_nuevo = 'documentos_incompletos'`:**
- Enviar email listando documentos faltantes
- Enviar WhatsApp recordatorio

---

### 7.4 Evento: `documento_subido`

**Trigger:** Cuando se inserta un documento en la tabla

**Payload:**
```json
{
  "evento": "documento_subido",
  "timestamp": "2026-02-12T15:35:12.456Z",
  "documento": {
    "id": "uuid-documento",
    "tipo_documento": "rut",
    "empresa_id": "uuid-empresa",
    "nit_empresa": "900123456-7",
    "s3_bucket": "confirming-documentos-prod",
    "s3_key": "pagadores/900123456-7/rut/20260212_153512_a3f2b1c4_rut.pdf",
    "mime_type": "application/pdf",
    "tamano_bytes": 245678
  }
}
```

**Acciones de n8n:**
1. Llamar AWS Lambda `document-ai-processor`
2. Lambda retorna datos extraídos
3. n8n actualiza `extraccion_data` en Supabase
4. Si hay discrepancias, crear comentario interno

---

## 8. Convenciones de Nomenclatura

### 8.1 Base de Datos

- **Tablas:** snake_case, plural (ej: `empresas_pagadoras`, `documentos`)
- **Columnas:** snake_case (ej: `razon_social`, `created_at`)
- **Funciones:** snake_case (ej: `validar_nit`, `registrar_cambio_estado`)
- **Índices:** `idx_{tabla}_{columna}` (ej: `idx_empresas_nit`)
- **Triggers:** `trigger_{accion}` (ej: `trigger_cambio_estado`)

### 8.2 API Endpoints

- **Routes:** kebab-case (ej: `/api/empresas-pagadoras`, `/api/documentos`)
- **Query params:** snake_case (ej: `?tipo_documento=rut`)
- **JSON keys:** snake_case (ej: `razon_social`, `created_at`)

### 8.3 TypeScript

- **Interfaces:** PascalCase (ej: `EmpresaPagadora`, `Documento`)
- **Types:** PascalCase (ej: `EstadoEmpresa`, `TipoDocumento`)
- **Variables:** camelCase (ej: `empresaId`, `presignedUrl`)
- **Funciones:** camelCase (ej: `generatePresignedUrl`, `validateNIT`)
- **Constantes:** SCREAMING_SNAKE_CASE (ej: `MAX_FILE_SIZE`, `DOCUMENTOS_REQUERIDOS`)

### 8.4 S3

- **Buckets:** kebab-case (ej: `confirming-documentos-prod`)
- **Keys:** snake_case con `/` para carpetas (ej: `pagadores/900123456-7/rut/20260212_a3f2b1c4_rut.pdf`)

---

## 9. Códigos de Error

### 9.1 Formato de Error

Todos los errores siguen este formato:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Descripción amigable del error",
    "details": {
      "campo": "valor"
    }
  }
}
```

### 9.2 Códigos Comunes

| Código | HTTP Status | Descripción |
|--------|-------------|-------------|
| `UNAUTHENTICATED` | 401 | No hay token de autenticación |
| `UNAUTHORIZED` | 403 | Token válido pero sin permisos |
| `ADMIN_REQUIRED` | 403 | Se requiere rol admin |
| `EMPRESA_NOT_FOUND` | 404 | La empresa no existe |
| `DOCUMENTO_NOT_FOUND` | 404 | El documento no existe |
| `INVALID_NIT` | 400 | Formato de NIT inválido |
| `INVALID_FILE_SIZE` | 400 | Archivo supera 10 MB |
| `INVALID_FILE_TYPE` | 400 | Tipo de archivo no permitido |
| `INVALID_ESTADO` | 400 | Estado no válido para transición |
| `MISSING_FIELD` | 400 | Falta un campo requerido |
| `DUPLICATE_NIT` | 409 | Ya existe empresa con ese NIT |
| `S3_ERROR` | 500 | Error al generar presigned URL |
| `DATABASE_ERROR` | 500 | Error de base de datos |

---

## 10. Ejemplos de Uso

### 10.1 Flujo Completo: Subir Documento

```typescript
// PASO 1: Obtener presigned URL (via Edge Function)
const { data: uploadData, error } = await supabase.functions.invoke(
  'generar-url-subida',
  {
    body: {
      empresa_id: 'uuid-de-mi-empresa',
      tipo_documento: 'rut',
      nombre_archivo: file.name,
      mime_type: file.type,
      tamano_bytes: file.size
    }
  }
)

if (error) {
  console.error('Error al generar URL:', error)
  return
}

// PASO 2: Subir archivo a S3
const uploadResponse = await fetch(uploadData.presigned_url, {
  method: 'PUT',
  body: file,
  headers: {
    'Content-Type': file.type
  }
})

if (uploadResponse.ok) {
  console.log('Documento subido exitosamente:', uploadData.documento_id)
  // El registro ya existe en tabla documentos
}
```

### 10.2 Flujo: Listar Documentos de Mi Empresa

```typescript
// Opción 1: Consulta directa a Supabase (RLS protege)
const { data: documentos, error } = await supabase
  .from('documentos')
  .select('id, tipo_documento, nombre_original, created_at, extraccion_completa')
  .eq('empresa_id', miEmpresaId)
  .eq('es_version_actual', true)
  .order('created_at', { ascending: false })

// Opción 2: Via API endpoint
const response = await fetch(`/api/empresas/${miEmpresaId}/documentos`, {
  headers: {
    'Authorization': `Bearer ${token}`
  }
})
const { data } = await response.json()
```

### 10.3 Flujo: Ver Documento (obtener presigned URL)

```typescript
// Llamar Edge Function
const { data, error } = await supabase.functions.invoke(
  'obtener-url-documento',
  {
    body: { documento_id: 'uuid-del-documento' }
  }
)

if (!error) {
  // Abrir en nueva pestaña o mostrar en iframe
  window.open(data.presigned_url, '_blank')
}
```

### 10.4 Flujo: Admin Cambia Estado

```typescript
// Solo admins pueden ejecutar esto
const response = await fetch(`/api/admin/empresas/${empresaId}/estado`, {
  method: 'PATCH',
  headers: {
    'Authorization': `Bearer ${adminToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    nuevo_estado: 'aprobado',
    motivo: 'Todos los documentos verificados correctamente'
  })
})

const { data, error } = await response.json()

if (data) {
  console.log('Estado cambiado:', data.estado_nuevo)
  // Trigger automáticamente envía notificación al usuario
}
```

---

## Changelog

### v1.0.0 (2026-02-12)
- Schema inicial de Supabase
- Edge Functions para S3 presigned URLs
- API endpoints básicos
- Webhooks para n8n
- Convenciones de nomenclatura definidas

---

**IMPORTANTE para el Frontend:**

1. **NO subir archivos directamente a Supabase Storage** - Siempre usar Edge Function `generar-url-subida`
2. **Confiar en RLS** - No validar permisos en frontend, Supabase lo maneja
3. **Presigned URLs expiran en 15 minutos** - No cachear URLs, regenerar cuando se necesiten
4. **Estados solo cambian via admin** - Usuarios NO pueden cambiar estado directamente
5. **Nomenclatura:** Siempre snake_case en DB y API, camelCase solo en código TS/JS interno

---

**Última actualización:** 2026-02-12
**Contacto Backend:** backend@confirming.com
