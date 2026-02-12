# Plan de Arquitectura - Plataforma Confirming Capa 1

**Fecha:** 2026-02-12
**Versión:** 1.0
**Alcance:** Onboarding digital de pagadores + Back office de aprobación

---

## 1. DECISIÓN ARQUITECTÓNICA: FastAPI vs Supabase Edge Functions

### RECOMENDACIÓN: **Híbrido - Supabase + Edge Functions + Lambdas AWS**

#### Justificación:

**Para Capa 1 NO necesitas FastAPI todavía.** Razones:

1. **Simplicidad operacional**: Supabase maneja auth, DB y realtime sin servidor adicional
2. **Costo**: Edge Functions son serverless, pagas por uso (Capa 1 tendrá poco tráfico)
3. **Desarrollo paralelo**: Lovable puede conectarse directamente a Supabase SDK
4. **Escalabilidad progresiva**: Cuando llegues a Capa 3 (motor transaccional), podrás migrar lógica crítica a FastAPI sin refactor completo

#### Distribución de responsabilidades:

```
┌─────────────────────────────────────────────────────────────┐
│ FRONTEND LOVABLE (Onboarding Pagador)                      │
│ - Supabase JS SDK directo para auth y CRUD básico          │
│ - Valida en cliente, confía en RLS del servidor            │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ SUPABASE (PostgreSQL + Auth + Realtime)                    │
│ - Row Level Security (RLS) para seguridad                  │
│ - Database Functions para lógica compleja                  │
│ - Triggers para webhooks a n8n                             │
└─────────────────────────────────────────────────────────────┘
                           │
                           ├──────────────────┐
                           ▼                  ▼
┌──────────────────────────────────┐  ┌─────────────────────────┐
│ SUPABASE EDGE FUNCTIONS          │  │ AWS LAMBDA              │
│ - Generar presigned URLs S3      │  │ - Document AI processor │
│ - Validaciones complejas (NIT)   │  │ - Extracción documental │
│ - Orquestación de workflows      │  │ - (usa créditos GCP)    │
└──────────────────────────────────┘  └─────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ N8N (Orquestación)                                          │
│ - Escucha webhooks de Supabase                             │
│ - Envía emails (AWS SES)                                   │
│ - Notifica WhatsApp                                        │
│ - Actualiza Google Sheets                                  │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ NEXT.JS BACK OFFICE                                         │
│ - Auth via Supabase                                         │
│ - Lee/escribe directamente a Supabase                      │
│ - Consume Edge Functions para S3 URLs                      │
└─────────────────────────────────────────────────────────────┘
```

**Cuándo migrar a FastAPI:**
- Capa 3: cuando tengas motor de facturas con cálculos financieros pesados
- Cuando necesites >100 req/s sostenidas
- Cuando necesites WebSockets para estado de transacciones en tiempo real

---

## 2. SCHEMA DE SUPABASE (PostgreSQL)

### 2.1 Tablas principales

```sql
-- ============================================================================
-- EXTENSIONES
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- TABLA: usuarios (extiende auth.users de Supabase)
-- ============================================================================
CREATE TABLE public.usuarios (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    rol VARCHAR(20) NOT NULL CHECK (rol IN ('pagador', 'proveedor', 'admin')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_usuarios_rol ON public.usuarios(rol);

-- ============================================================================
-- TABLA: empresas_pagadoras
-- ============================================================================
CREATE TABLE public.empresas_pagadoras (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,

    -- Datos básicos
    nit VARCHAR(12) NOT NULL UNIQUE, -- Formato: XXXXXXXXX-X
    razon_social VARCHAR(255) NOT NULL,
    direccion TEXT NOT NULL,
    ciudad VARCHAR(100) NOT NULL,
    departamento VARCHAR(100) NOT NULL,
    actividad_economica VARCHAR(255) NOT NULL,
    codigo_ciiu VARCHAR(10) NOT NULL,

    -- Representante legal
    representante_legal_nombre VARCHAR(255) NOT NULL,
    representante_legal_cedula VARCHAR(15) NOT NULL,
    representante_legal_email VARCHAR(255) NOT NULL,
    representante_legal_telefono VARCHAR(20) NOT NULL,

    -- Estado del onboarding
    estado VARCHAR(30) NOT NULL DEFAULT 'pendiente' CHECK (
        estado IN (
            'pendiente',
            'en_revision',
            'documentos_incompletos',
            'aprobado',
            'rechazado'
        )
    ),
    estado_anterior VARCHAR(30),
    fecha_cambio_estado TIMESTAMPTZ,

    -- Metadatos
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    aprobado_por UUID REFERENCES public.usuarios(id),
    fecha_aprobacion TIMESTAMPTZ,

    -- Auditoría
    ip_registro INET,
    user_agent TEXT
);

CREATE INDEX idx_empresas_nit ON public.empresas_pagadoras(nit);
CREATE INDEX idx_empresas_estado ON public.empresas_pagadoras(estado);
CREATE INDEX idx_empresas_created ON public.empresas_pagadoras(created_at DESC);

-- ============================================================================
-- TABLA: documentos
-- ============================================================================
CREATE TABLE public.documentos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID NOT NULL REFERENCES public.empresas_pagadoras(id) ON DELETE CASCADE,

    -- Clasificación
    tipo_documento VARCHAR(50) NOT NULL CHECK (
        tipo_documento IN (
            'camara_comercio',
            'registro_accionistas',
            'rut',
            'cedula_representante_legal',
            'declaracion_renta',
            'estados_financieros',
            'otro'
        )
    ),

    -- Storage
    s3_bucket VARCHAR(100) NOT NULL,
    s3_key VARCHAR(500) NOT NULL,
    nombre_original VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    tamano_bytes BIGINT NOT NULL,

    -- Extracción IA (Document AI)
    extraccion_completa BOOLEAN DEFAULT FALSE,
    extraccion_data JSONB, -- Resultado raw de Document AI
    extraccion_resumen JSONB, -- Campos clave extraídos (NIT, nombre, etc)
    extraccion_confianza DECIMAL(3,2), -- 0.00 a 1.00
    extraccion_fecha TIMESTAMPTZ,

    -- Metadatos
    subido_por UUID NOT NULL REFERENCES public.usuarios(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Flags
    es_version_actual BOOLEAN DEFAULT TRUE,
    reemplaza_a UUID REFERENCES public.documentos(id)
);

CREATE INDEX idx_documentos_empresa ON public.documentos(empresa_id);
CREATE INDEX idx_documentos_tipo ON public.documentos(tipo_documento);
CREATE INDEX idx_documentos_actual ON public.documentos(es_version_actual) WHERE es_version_actual = TRUE;

-- ============================================================================
-- TABLA: comentarios_internos
-- ============================================================================
CREATE TABLE public.comentarios_internos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID NOT NULL REFERENCES public.empresas_pagadoras(id) ON DELETE CASCADE,
    usuario_id UUID NOT NULL REFERENCES public.usuarios(id),

    comentario TEXT NOT NULL,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_comentarios_empresa ON public.comentarios_internos(empresa_id, created_at DESC);

-- ============================================================================
-- TABLA: historial_estados
-- ============================================================================
CREATE TABLE public.historial_estados (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID NOT NULL REFERENCES public.empresas_pagadoras(id) ON DELETE CASCADE,

    estado_anterior VARCHAR(30),
    estado_nuevo VARCHAR(30) NOT NULL,

    cambiado_por UUID REFERENCES public.usuarios(id),
    motivo TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_historial_empresa ON public.historial_estados(empresa_id, created_at DESC);

-- ============================================================================
-- TABLA: notificaciones_enviadas
-- ============================================================================
CREATE TABLE public.notificaciones_enviadas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID REFERENCES public.empresas_pagadoras(id) ON DELETE CASCADE,

    tipo VARCHAR(50) NOT NULL CHECK (
        tipo IN ('email', 'whatsapp', 'sms', 'push')
    ),
    evento VARCHAR(100) NOT NULL, -- 'onboarding_completo', 'estado_cambiado', etc
    destinatario VARCHAR(255) NOT NULL,

    enviado BOOLEAN DEFAULT FALSE,
    fecha_envio TIMESTAMPTZ,
    error TEXT,

    payload JSONB, -- Metadata del mensaje enviado

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notificaciones_empresa ON public.notificaciones_enviadas(empresa_id);
CREATE INDEX idx_notificaciones_enviado ON public.notificaciones_enviadas(enviado, created_at);

-- ============================================================================
-- TABLA: convenios (para Capa 2 - preparación)
-- ============================================================================
CREATE TABLE public.convenios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_pagadora_id UUID NOT NULL REFERENCES public.empresas_pagadoras(id) ON DELETE CASCADE,

    nombre VARCHAR(255) NOT NULL,
    descripcion TEXT,

    -- Condiciones financieras
    tasa_descuento_anual DECIMAL(5,4), -- Ej: 0.1250 = 12.50%
    dias_anticipo_minimo INTEGER DEFAULT 1,
    dias_anticipo_maximo INTEGER DEFAULT 120,
    monto_minimo_factura DECIMAL(15,2),
    monto_maximo_factura DECIMAL(15,2),

    -- Estado
    estado VARCHAR(20) DEFAULT 'borrador' CHECK (
        estado IN ('borrador', 'activo', 'suspendido', 'terminado')
    ),

    fecha_inicio DATE,
    fecha_fin DATE,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES public.usuarios(id)
);

CREATE INDEX idx_convenios_pagadora ON public.convenios(empresa_pagadora_id);
CREATE INDEX idx_convenios_estado ON public.convenios(estado);

-- ============================================================================
-- TABLA: proveedores (para Capa 2 - preparación)
-- ============================================================================
CREATE TABLE public.proveedores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario_id UUID REFERENCES public.usuarios(id) ON DELETE CASCADE,

    nit VARCHAR(12) NOT NULL UNIQUE,
    razon_social VARCHAR(255) NOT NULL,

    -- Datos bancarios
    banco VARCHAR(100),
    tipo_cuenta VARCHAR(20) CHECK (tipo_cuenta IN ('ahorros', 'corriente')),
    numero_cuenta VARCHAR(50),

    estado VARCHAR(20) DEFAULT 'pendiente' CHECK (
        estado IN ('pendiente', 'verificado', 'rechazado', 'inactivo')
    ),

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_proveedores_nit ON public.proveedores(nit);

-- ============================================================================
-- TABLA: convenios_proveedores (relación muchos a muchos para Capa 2)
-- ============================================================================
CREATE TABLE public.convenios_proveedores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    convenio_id UUID NOT NULL REFERENCES public.convenios(id) ON DELETE CASCADE,
    proveedor_id UUID NOT NULL REFERENCES public.proveedores(id) ON DELETE CASCADE,

    estado VARCHAR(20) DEFAULT 'invitado' CHECK (
        estado IN ('invitado', 'aceptado', 'rechazado', 'inactivo')
    ),

    fecha_invitacion TIMESTAMPTZ DEFAULT NOW(),
    fecha_respuesta TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(convenio_id, proveedor_id)
);

CREATE INDEX idx_convenios_prov_convenio ON public.convenios_proveedores(convenio_id);
CREATE INDEX idx_convenios_prov_proveedor ON public.convenios_proveedores(proveedor_id);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Trigger: Actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_usuarios_updated_at BEFORE UPDATE ON public.usuarios
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_empresas_updated_at BEFORE UPDATE ON public.empresas_pagadoras
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_documentos_updated_at BEFORE UPDATE ON public.documentos
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_comentarios_updated_at BEFORE UPDATE ON public.comentarios_internos
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_convenios_updated_at BEFORE UPDATE ON public.convenios
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_proveedores_updated_at BEFORE UPDATE ON public.proveedores
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger: Registrar cambios de estado en historial
CREATE OR REPLACE FUNCTION registrar_cambio_estado()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.estado IS DISTINCT FROM NEW.estado THEN
        INSERT INTO public.historial_estados (
            empresa_id,
            estado_anterior,
            estado_nuevo,
            cambiado_por,
            motivo
        ) VALUES (
            NEW.id,
            OLD.estado,
            NEW.estado,
            NEW.aprobado_por, -- O usar current_user si tienes contexto
            'Cambio automático via trigger'
        );

        -- Actualizar campos de auditoría
        NEW.estado_anterior = OLD.estado;
        NEW.fecha_cambio_estado = NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_cambio_estado BEFORE UPDATE ON public.empresas_pagadoras
    FOR EACH ROW EXECUTE FUNCTION registrar_cambio_estado();

-- Trigger: Webhook a n8n cuando cambia estado
CREATE OR REPLACE FUNCTION notificar_cambio_estado()
RETURNS TRIGGER AS $$
DECLARE
    webhook_url TEXT := 'https://n8n.tudominio.com/webhook/cambio-estado';
    payload JSONB;
BEGIN
    IF OLD.estado IS DISTINCT FROM NEW.estado THEN
        payload := jsonb_build_object(
            'empresa_id', NEW.id,
            'nit', NEW.nit,
            'razon_social', NEW.razon_social,
            'estado_anterior', OLD.estado,
            'estado_nuevo', NEW.estado,
            'email_contacto', NEW.representante_legal_email,
            'timestamp', NOW()
        );

        -- Aquí insertarías en una tabla de cola de webhooks
        -- que n8n lee periódicamente, o usas pg_net si está disponible
        INSERT INTO public.notificaciones_enviadas (
            empresa_id,
            tipo,
            evento,
            destinatario,
            payload
        ) VALUES (
            NEW.id,
            'email',
            'estado_cambiado',
            NEW.representante_legal_email,
            payload
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_notificar_estado AFTER UPDATE ON public.empresas_pagadoras
    FOR EACH ROW EXECUTE FUNCTION notificar_cambio_estado();

-- ============================================================================
-- FUNCIONES ÚTILES
-- ============================================================================

-- Validar formato NIT colombiano
CREATE OR REPLACE FUNCTION validar_nit(nit_input TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    -- Formato: XXXXXXXXX-X (9 dígitos + guión + 1 dígito verificador)
    RETURN nit_input ~ '^\d{9}-\d{1}$';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Generar presigned URL (se llamará desde Edge Function)
CREATE OR REPLACE FUNCTION solicitar_presigned_url(
    documento_id UUID,
    expiracion_minutos INTEGER DEFAULT 15
)
RETURNS TEXT AS $$
DECLARE
    doc_record RECORD;
BEGIN
    -- Obtener documento
    SELECT * INTO doc_record FROM public.documentos WHERE id = documento_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Documento no encontrado';
    END IF;

    -- Aquí retornas la info necesaria para que la Edge Function genere el URL
    -- No puedes generar el presigned URL directamente en PostgreSQL por seguridad
    RETURN jsonb_build_object(
        's3_bucket', doc_record.s3_bucket,
        's3_key', doc_record.s3_key,
        'expiracion_minutos', expiracion_minutos
    )::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Habilitar RLS en todas las tablas
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.empresas_pagadoras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comentarios_internos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historial_estados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notificaciones_enviadas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.convenios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proveedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.convenios_proveedores ENABLE ROW LEVEL SECURITY;

-- Políticas para USUARIOS
CREATE POLICY "Usuarios pueden ver su propio perfil"
    ON public.usuarios FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Admins pueden ver todos los usuarios"
    ON public.usuarios FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.usuarios
            WHERE id = auth.uid() AND rol = 'admin'
        )
    );

-- Políticas para EMPRESAS PAGADORAS
CREATE POLICY "Pagadores ven solo su empresa"
    ON public.empresas_pagadoras FOR SELECT
    USING (usuario_id = auth.uid());

CREATE POLICY "Pagadores pueden crear su empresa"
    ON public.empresas_pagadoras FOR INSERT
    WITH CHECK (usuario_id = auth.uid());

CREATE POLICY "Pagadores pueden actualizar su empresa si está pendiente o incompleta"
    ON public.empresas_pagadoras FOR UPDATE
    USING (
        usuario_id = auth.uid()
        AND estado IN ('pendiente', 'documentos_incompletos')
    );

CREATE POLICY "Admins ven todas las empresas"
    ON public.empresas_pagadoras FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.usuarios
            WHERE id = auth.uid() AND rol = 'admin'
        )
    );

CREATE POLICY "Admins pueden actualizar cualquier empresa"
    ON public.empresas_pagadoras FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.usuarios
            WHERE id = auth.uid() AND rol = 'admin'
        )
    );

-- Políticas para DOCUMENTOS
CREATE POLICY "Usuarios ven documentos de su empresa"
    ON public.documentos FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.empresas_pagadoras
            WHERE id = documentos.empresa_id
            AND usuario_id = auth.uid()
        )
    );

CREATE POLICY "Usuarios pueden subir documentos a su empresa"
    ON public.documentos FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.empresas_pagadoras
            WHERE id = empresa_id
            AND usuario_id = auth.uid()
        )
        AND subido_por = auth.uid()
    );

CREATE POLICY "Admins ven todos los documentos"
    ON public.documentos FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.usuarios
            WHERE id = auth.uid() AND rol = 'admin'
        )
    );

-- Políticas para COMENTARIOS INTERNOS (solo admins)
CREATE POLICY "Solo admins pueden leer comentarios"
    ON public.comentarios_internos FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.usuarios
            WHERE id = auth.uid() AND rol = 'admin'
        )
    );

CREATE POLICY "Solo admins pueden crear comentarios"
    ON public.comentarios_internos FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.usuarios
            WHERE id = auth.uid() AND rol = 'admin'
        )
        AND usuario_id = auth.uid()
    );

-- Políticas para HISTORIAL (pagadores ven el suyo, admins ven todo)
CREATE POLICY "Usuarios ven historial de su empresa"
    ON public.historial_estados FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.empresas_pagadoras
            WHERE id = historial_estados.empresa_id
            AND usuario_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM public.usuarios
            WHERE id = auth.uid() AND rol = 'admin'
        )
    );

-- Políticas para CONVENIOS (Capa 2)
CREATE POLICY "Pagadores ven sus convenios"
    ON public.convenios FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.empresas_pagadoras
            WHERE id = convenios.empresa_pagadora_id
            AND usuario_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM public.usuarios
            WHERE id = auth.uid() AND rol = 'admin'
        )
    );

-- ============================================================================
-- DATOS INICIALES
-- ============================================================================

-- Insertar usuario admin de ejemplo (CAMBIAR en producción)
-- El id debe coincidir con un usuario creado en Supabase Auth
-- INSERT INTO public.usuarios (id, rol) VALUES
-- ('UUID-DE-TU-USUARIO-ADMIN', 'admin');

```

### 2.2 Consideraciones de escalabilidad

**Para Capa 2 (Convenios con proveedores):**
- Las tablas `convenios`, `proveedores` y `convenios_proveedores` ya están listas
- Solo necesitas agregar las pantallas en el back office

**Para Capa 3 (Motor transaccional):**
- Agregar tablas: `facturas`, `transacciones_descuento`, `pagos`, `movimientos_cuenta`
- Considerar particionamiento por fecha en `facturas` si esperas +1M registros/año
- Migrar cálculos financieros a FastAPI con Redis para cache

---

## 3. ESTRUCTURA DE CARPETAS EN AWS S3

### 3.1 Bucket principal

```
Bucket: confirming-documentos-prod
Region: us-east-1 (o la región GCP más cercana si usas Interoperability)

Estructura:
confirming-documentos-prod/
├── pagadores/
│   └── {nit}/                          # Ej: 900123456-7
│       ├── camara_comercio/
│       │   └── {timestamp}_{uuid}_{nombre_sanitizado}.pdf
│       ├── registro_accionistas/
│       │   └── {timestamp}_{uuid}_{nombre_sanitizado}.pdf
│       ├── rut/
│       │   └── {timestamp}_{uuid}_{nombre_sanitizado}.pdf
│       ├── cedula_representante_legal/
│       │   ├── {timestamp}_{uuid}_frente.{ext}
│       │   └── {timestamp}_{uuid}_reverso.{ext}
│       ├── declaracion_renta/
│       │   └── {timestamp}_{uuid}_{nombre_sanitizado}.pdf
│       ├── estados_financieros/
│       │   └── {timestamp}_{uuid}_{nombre_sanitizado}.pdf
│       └── otros/
│           └── {timestamp}_{uuid}_{nombre_sanitizado}.{ext}
│
├── proveedores/                        # Para Capa 2
│   └── {nit}/
│       └── ... (similar estructura)
│
└── facturas/                           # Para Capa 3
    └── {año}/
        └── {mes}/
            └── {nit_pagador}/
                └── {nit_proveedor}/
                    └── {timestamp}_{numero_factura}.pdf

Ejemplo real:
pagadores/900123456-7/rut/20260212_a3f2b1c4-5d6e-7f8g-9h0i-1j2k3l4m5n6o_rut_empresa_xyz_sas.pdf
```

### 3.2 Nomenclatura de archivos

**Formato:**
```
{timestamp}_{uuid}_{descripcion_sanitizada}.{extension}

Donde:
- timestamp: formato YYYYMMDD_HHMMSS (UTC)
- uuid: UUID v4 sin guiones (primeros 8 caracteres)
- descripcion: nombre original sin caracteres especiales, max 50 chars
- extension: pdf, jpg, png, etc
```

**Ejemplo:**
```
Original: "RUT Empresa XYZ S.A.S. (copia 2024).pdf"
S3 Key:   "20260212_153045_a3f2b1c4_rut_empresa_xyz_sas_copia_2024.pdf"
```

### 3.3 Políticas de acceso S3

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "DenyPublicAccess",
      "Effect": "Deny",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::confirming-documentos-prod/*",
      "Condition": {
        "StringNotEquals": {
          "aws:PrincipalArn": [
            "arn:aws:iam::ACCOUNT-ID:role/ConfirmingEdgeFunctionRole",
            "arn:aws:iam::ACCOUNT-ID:role/ConfirmingDocumentAIRole"
          ]
        }
      }
    },
    {
      "Sid": "AllowPresignedURLGeneration",
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::ACCOUNT-ID:role/ConfirmingEdgeFunctionRole"
      },
      "Action": [
        "s3:GetObject",
        "s3:PutObject"
      ],
      "Resource": "arn:aws:s3:::confirming-documentos-prod/*"
    },
    {
      "Sid": "AllowDocumentAIRead",
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::ACCOUNT-ID:role/ConfirmingDocumentAIRole"
      },
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::confirming-documentos-prod/*"
    }
  ]
}
```

### 3.4 Lifecycle policies

```json
{
  "Rules": [
    {
      "Id": "TransitionToIA",
      "Status": "Enabled",
      "Prefix": "pagadores/",
      "Transitions": [
        {
          "Days": 90,
          "StorageClass": "STANDARD_IA"
        },
        {
          "Days": 365,
          "StorageClass": "GLACIER_IR"
        }
      ]
    },
    {
      "Id": "DeleteTempFiles",
      "Status": "Enabled",
      "Prefix": "temp/",
      "Expiration": {
        "Days": 1
      }
    }
  ]
}
```

---

## 4. CONTRATO DE DATOS PARA LOVABLE (Frontend Onboarding)

### 4.1 Conexión a Supabase

**Configuración del cliente:**
```javascript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)
```

### 4.2 Flujo de autenticación

```javascript
// 1. Sign in con Google
const { data, error } = await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: {
    redirectTo: 'https://tuapp.com/onboarding/datos-empresa'
  }
})

// 2. Verificar si usuario ya existe en tabla usuarios
const { data: usuario } = await supabase
  .from('usuarios')
  .select('*')
  .eq('id', user.id)
  .single()

// 3. Si no existe, crear con rol 'pagador'
if (!usuario) {
  await supabase
    .from('usuarios')
    .insert({ id: user.id, rol: 'pagador' })
}
```

### 4.3 API de datos - empresas_pagadoras

**INSERT (crear empresa):**
```typescript
interface CrearEmpresaPayload {
  // Datos empresa
  nit: string;                          // REQUERIDO - validar formato
  razon_social: string;                 // REQUERIDO
  direccion: string;                    // REQUERIDO
  ciudad: string;                       // REQUERIDO
  departamento: string;                 // REQUERIDO
  actividad_economica: string;          // REQUERIDO
  codigo_ciiu: string;                  // REQUERIDO

  // Representante legal
  representante_legal_nombre: string;   // REQUERIDO
  representante_legal_cedula: string;   // REQUERIDO
  representante_legal_email: string;    // REQUERIDO - validar formato
  representante_legal_telefono: string; // REQUERIDO

  // Auto-completados
  usuario_id: string;                   // UUID del usuario auth
  estado: 'pendiente';                  // Siempre 'pendiente' al crear
  ip_registro?: string;                 // Opcional
  user_agent?: string;                  // Opcional
}

// Validaciones en cliente antes de enviar:
const validarNIT = (nit: string): boolean => {
  return /^\d{9}-\d{1}$/.test(nit);
}

const validarEmail = (email: string): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Ejemplo de insert:
const { data, error } = await supabase
  .from('empresas_pagadoras')
  .insert({
    usuario_id: user.id,
    nit: '900123456-7',
    razon_social: 'EMPRESA XYZ S.A.S.',
    direccion: 'Calle 123 # 45-67',
    ciudad: 'Bogotá',
    departamento: 'Cundinamarca',
    actividad_economica: 'Desarrollo de software',
    codigo_ciiu: '6201',
    representante_legal_nombre: 'Juan Pérez',
    representante_legal_cedula: '1234567890',
    representante_legal_email: 'juan@empresa.com',
    representante_legal_telefono: '+573001234567',
    ip_registro: clientIP,
    user_agent: navigator.userAgent
  })
  .select()
  .single()
```

**SELECT (obtener empresa del usuario):**
```typescript
const { data: empresa, error } = await supabase
  .from('empresas_pagadoras')
  .select('*')
  .eq('usuario_id', user.id)
  .single()

// RLS garantiza que solo vean su propia empresa
```

**UPDATE (actualizar datos antes de enviar):**
```typescript
// Solo permitido si estado es 'pendiente' o 'documentos_incompletos'
const { data, error } = await supabase
  .from('empresas_pagadoras')
  .update({
    ciudad: 'Medellín',
    departamento: 'Antioquia'
  })
  .eq('usuario_id', user.id)
  .eq('estado', 'pendiente') // Importante: validar estado
```

### 4.4 API de datos - documentos

**INSERT (subir documento):**

**IMPORTANTE:** Lovable NO sube directamente a S3. Debe llamar a una Edge Function.

```typescript
// Paso 1: Llamar Edge Function para obtener presigned URL
const { data: uploadData, error } = await supabase.functions.invoke(
  'generar-url-subida',
  {
    body: {
      empresa_id: empresaId,
      tipo_documento: 'rut',
      nombre_archivo: 'rut_empresa.pdf',
      mime_type: 'application/pdf',
      tamano_bytes: file.size
    }
  }
)

// uploadData contiene:
// {
//   presigned_url: "https://s3.amazonaws.com/...",
//   s3_bucket: "confirming-documentos-prod",
//   s3_key: "pagadores/900123456-7/rut/20260212_a3f2b1c4_rut_empresa.pdf",
//   documento_id: "uuid-del-registro-creado"
// }

// Paso 2: Subir archivo a S3 con presigned URL
const uploadResponse = await fetch(uploadData.presigned_url, {
  method: 'PUT',
  body: file,
  headers: {
    'Content-Type': file.type
  }
})

if (uploadResponse.ok) {
  // Paso 3: Marcar documento como subido (opcional, la Edge Function ya lo hizo)
  // El registro en tabla 'documentos' ya fue creado por la Edge Function
  console.log('Documento subido exitosamente')
}
```

**SELECT (listar documentos de la empresa):**
```typescript
const { data: documentos, error } = await supabase
  .from('documentos')
  .select('id, tipo_documento, nombre_original, created_at, extraccion_completa')
  .eq('empresa_id', empresaId)
  .eq('es_version_actual', true)
  .order('created_at', { ascending: false })
```

**¿Necesita Lovable leer un documento? NO DIRECTAMENTE.**
Para mostrar un documento, llamar Edge Function que devuelve presigned URL temporal:

```typescript
const { data, error } = await supabase.functions.invoke(
  'obtener-url-documento',
  {
    body: { documento_id: 'uuid-del-documento' }
  }
)

// data contiene:
// {
//   presigned_url: "https://s3.amazonaws.com/...?expires_in=900",
//   expira_en: 900 // segundos
// }

// Mostrar en iframe o descargar
window.open(data.presigned_url, '_blank')
```

### 4.5 API de datos - historial_estados

**SELECT (ver historial de estados):**
```typescript
const { data: historial, error } = await supabase
  .from('historial_estados')
  .select(`
    id,
    estado_anterior,
    estado_nuevo,
    motivo,
    created_at,
    usuarios:cambiado_por (
      id
    )
  `)
  .eq('empresa_id', empresaId)
  .order('created_at', { ascending: false })

// RLS permite a pagadores ver su historial y a admins ver todo
```

### 4.6 Realtime (opcional para Capa 1)

Si quieres que Lovable muestre cambios en tiempo real cuando un admin cambia el estado:

```typescript
const channel = supabase
  .channel('cambios-empresa')
  .on(
    'postgres_changes',
    {
      event: 'UPDATE',
      schema: 'public',
      table: 'empresas_pagadoras',
      filter: `id=eq.${empresaId}`
    },
    (payload) => {
      console.log('Estado cambió a:', payload.new.estado)
      // Actualizar UI
    }
  )
  .subscribe()
```

### 4.7 Checklist de implementación para Lovable

| Paso | Acción | Endpoint/Tabla |
|------|--------|----------------|
| 1 | Sign in con Google/Apple/Email | `supabase.auth.signInWithOAuth()` |
| 2 | Crear registro en `usuarios` si no existe | `INSERT INTO usuarios` |
| 3 | Formulario de datos de empresa | `INSERT INTO empresas_pagadoras` |
| 4 | Por cada documento: llamar Edge Function | `supabase.functions.invoke('generar-url-subida')` |
| 5 | Subir archivo a S3 con presigned URL | `fetch(presigned_url, { method: 'PUT' })` |
| 6 | Mostrar confirmación | Leer `empresas_pagadoras.estado` |
| 7 | Portal de seguimiento | SELECT de `empresas_pagadoras` y `historial_estados` |

---

## 5. WEBHOOKS PARA N8N

### 5.1 Arquitectura de webhooks

**Flujo:**
```
Supabase Trigger → INSERT en notificaciones_enviadas
                  → n8n polling (cada 30s)
                  → n8n procesa y marca como enviado
```

**Alternativa (si usas pg_net en Supabase):**
```
Supabase Trigger → HTTP POST a n8n webhook directamente
```

### 5.2 Webhook 1: Onboarding completo

**Trigger:** Cuando se crea una empresa con todos los documentos requeridos

**Endpoint n8n:** `POST https://n8n.tudominio.com/webhook/onboarding-completo`

**Payload:**
```json
{
  "evento": "onboarding_completo",
  "timestamp": "2026-02-12T15:30:45.123Z",
  "empresa": {
    "id": "uuid-empresa",
    "nit": "900123456-7",
    "razon_social": "EMPRESA XYZ S.A.S.",
    "representante_legal": {
      "nombre": "Juan Pérez",
      "email": "juan@empresa.com",
      "telefono": "+573001234567"
    },
    "ciudad": "Bogotá",
    "estado": "pendiente"
  },
  "documentos_subidos": [
    "camara_comercio",
    "registro_accionistas",
    "rut",
    "cedula_representante_legal",
    "declaracion_renta",
    "estados_financieros"
  ],
  "total_documentos": 6
}
```

**Acciones en n8n:**
1. Enviar email al equipo interno (AWS SES):
   ```
   Asunto: Nueva solicitud de onboarding - EMPRESA XYZ S.A.S.
   Body: Se ha registrado una nueva empresa [link al back office]
   ```
2. Enviar WhatsApp a número configurado (Twilio/similar)
3. Agregar fila en Google Sheet "Registro Onboardings"
4. Marcar notificación como enviada en Supabase

### 5.3 Webhook 2: Documento subido

**Trigger:** Cuando se inserta un documento en la tabla `documentos`

**Endpoint n8n:** `POST https://n8n.tudominio.com/webhook/documento-subido`

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

**Acciones en n8n:**
1. Llamar AWS Lambda que ejecuta Document AI
2. Lambda devuelve datos extraídos
3. n8n actualiza campo `extraccion_data` en Supabase
4. Si extracción falla, notificar a equipo interno

### 5.4 Webhook 3: Estado cambiado

**Trigger:** Cuando un admin cambia el estado de una empresa

**Endpoint n8n:** `POST https://n8n.tudominio.com/webhook/estado-cambiado`

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

**Acciones en n8n (según estado nuevo):**

**Si estado = 'aprobado':**
```
1. Enviar email a juan@empresa.com:
   Asunto: ¡Tu solicitud fue aprobada!
   Body: Bienvenido a [NOMBRE], ya puedes empezar a crear convenios...

2. Enviar WhatsApp de bienvenida

3. Actualizar Google Sheet con fecha de aprobación
```

**Si estado = 'rechazado':**
```
1. Enviar email explicando motivo de rechazo
2. Notificar a equipo comercial para seguimiento
```

**Si estado = 'documentos_incompletos':**
```
1. Enviar email listando documentos faltantes
2. Enviar WhatsApp recordatorio
```

### 5.5 Webhook 4: Nuevo comentario interno

**Trigger:** Cuando un admin agrega un comentario interno

**Endpoint n8n:** `POST https://n8n.tudominio.com/webhook/comentario-interno`

**Payload:**
```json
{
  "evento": "comentario_interno",
  "timestamp": "2026-02-12T16:15:30.123Z",
  "empresa": {
    "id": "uuid-empresa",
    "nit": "900123456-7",
    "razon_social": "EMPRESA XYZ S.A.S."
  },
  "comentario": {
    "id": "uuid-comentario",
    "texto": "Falta verificar cédula del representante legal",
    "usuario": {
      "id": "uuid-admin",
      "email": "admin@confirming.com"
    }
  }
}
```

**Acciones en n8n:**
1. Agregar a Slack/Discord canal #onboarding (opcional)
2. Si el comentario contiene "@mention", notificar a ese usuario

### 5.6 Configuración de polling en n8n

Si no usas webhooks HTTP directos, n8n puede leer la tabla `notificaciones_enviadas`:

**Workflow en n8n:**
```
[Trigger: Cron every 30s]
  ↓
[Supabase Node: SELECT * FROM notificaciones_enviadas WHERE enviado = false LIMIT 10]
  ↓
[Switch por tipo de evento]
  ├─ onboarding_completo → [Enviar emails/WhatsApp]
  ├─ documento_subido → [Llamar Document AI Lambda]
  ├─ estado_cambiado → [Enviar notificación personalizada]
  └─ comentario_interno → [Notificar Slack]
  ↓
[Supabase Node: UPDATE notificaciones_enviadas SET enviado = true, fecha_envio = NOW()]
```

---

## 6. PLAN DE CONSTRUCCIÓN - BACK OFFICE NEXT.JS

### 6.1 Estructura de carpetas del proyecto

```
confirming-backoffice/
├── .env.local
├── .env.example
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
├── package.json
│
├── src/
│   ├── app/
│   │   ├── layout.tsx                 # Layout principal con auth
│   │   ├── page.tsx                   # Redirect a /dashboard
│   │   │
│   │   ├── auth/
│   │   │   ├── login/
│   │   │   │   └── page.tsx           # Login con Supabase (solo admins)
│   │   │   └── callback/
│   │   │       └── route.ts           # Callback OAuth
│   │   │
│   │   ├── dashboard/
│   │   │   ├── layout.tsx             # Layout con sidebar
│   │   │   ├── page.tsx               # Dashboard principal (lista empresas)
│   │   │   │
│   │   │   └── empresas/
│   │   │       └── [id]/
│   │   │           └── page.tsx       # Vista detalle empresa
│   │   │
│   │   └── api/
│   │       ├── documentos/
│   │       │   └── [id]/
│   │       │       └── presigned-url/
│   │       │           └── route.ts   # Generar presigned URL
│   │       └── health/
│   │           └── route.ts
│   │
│   ├── components/
│   │   ├── ui/                        # shadcn/ui components
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── badge.tsx
│   │   │   ├── select.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── textarea.tsx
│   │   │   └── ...
│   │   │
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx
│   │   │   ├── Header.tsx
│   │   │   └── MobileNav.tsx
│   │   │
│   │   ├── empresas/
│   │   │   ├── EmpresasList.tsx       # Tabla con filtros
│   │   │   ├── EmpresaCard.tsx        # Card resumen
│   │   │   ├── EmpresaFilters.tsx     # Filtros por estado
│   │   │   └── EmpresaEstadoBadge.tsx # Badge de estado
│   │   │
│   │   ├── detalle-empresa/
│   │   │   ├── DatosEmpresa.tsx       # Sección datos básicos
│   │   │   ├── DocumentosViewer.tsx   # Grid de documentos
│   │   │   ├── DocumentoCard.tsx      # Card individual documento
│   │   │   ├── PDFViewer.tsx          # Visor PDF embebido
│   │   │   ├── ExtraccionIA.tsx       # Resumen Document AI
│   │   │   ├── ComentariosPanel.tsx   # Panel comentarios internos
│   │   │   ├── HistorialEstados.tsx   # Timeline de cambios
│   │   │   └── AccionesEmpresa.tsx    # Botones aprobar/rechazar
│   │   │
│   │   └── shared/
│   │       ├── LoadingSpinner.tsx
│   │       ├── ErrorBoundary.tsx
│   │       └── EmptyState.tsx
│   │
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts              # Cliente Supabase para cliente
│   │   │   ├── server.ts              # Cliente Supabase para server
│   │   │   └── middleware.ts          # Middleware auth
│   │   │
│   │   ├── aws/
│   │   │   └── s3.ts                  # Funciones S3 (presigned URLs)
│   │   │
│   │   ├── utils/
│   │   │   ├── validators.ts          # Validadores (NIT, email, etc)
│   │   │   ├── formatters.ts          # Formatear fechas, monedas, etc
│   │   │   └── cn.ts                  # Merge className (shadcn)
│   │   │
│   │   └── types/
│   │       ├── database.types.ts      # Tipos autogenerados de Supabase
│   │       └── index.ts
│   │
│   ├── hooks/
│   │   ├── useEmpresas.ts             # Hook para listar empresas
│   │   ├── useEmpresaDetalle.ts       # Hook para detalle empresa
│   │   ├── useDocumentos.ts           # Hook para documentos
│   │   ├── useCambiarEstado.ts        # Hook para cambiar estado
│   │   └── useComentarios.ts          # Hook para comentarios
│   │
│   └── constants/
│       ├── estados.ts                 # Enum de estados
│       └── documentos.ts              # Tipos de documentos
│
├── public/
│   ├── logo.svg
│   └── favicon.ico
│
└── supabase/
    └── types.ts                       # Tipos generados con Supabase CLI
```

### 6.2 Stack técnico del back office

```json
{
  "dependencies": {
    "next": "^14.2.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "@supabase/supabase-js": "^2.45.0",
    "@supabase/auth-helpers-nextjs": "^0.10.0",
    "@aws-sdk/client-s3": "^3.600.0",
    "@aws-sdk/s3-request-presigner": "^3.600.0",
    "react-pdf": "^9.0.0",
    "date-fns": "^3.6.0",
    "zod": "^3.23.0",
    "tailwindcss": "^3.4.0",
    "@radix-ui/react-*": "latest",
    "lucide-react": "^0.400.0",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.3.0"
  },
  "devDependencies": {
    "typescript": "^5.5.0",
    "@types/node": "^20.14.0",
    "@types/react": "^18.3.0",
    "supabase": "^1.190.0"
  }
}
```

### 6.3 Orden de construcción (4 semanas)

#### **Semana 1: Setup + Auth + Dashboard básico**

**Día 1-2:**
- [ ] Inicializar proyecto Next.js 14 con App Router
- [ ] Configurar Tailwind + shadcn/ui (instalar componentes base)
- [ ] Configurar variables de entorno (.env.local)
- [ ] Configurar Supabase client (client.ts y server.ts)
- [ ] Generar tipos TypeScript desde Supabase (`supabase gen types typescript`)

**Día 3-4:**
- [ ] Implementar autenticación:
  - Página de login (`/auth/login`)
  - Middleware para proteger rutas
  - Callback OAuth (`/auth/callback`)
  - Verificar rol = 'admin' en middleware
- [ ] Crear layout principal con sidebar y header

**Día 5:**
- [ ] Dashboard principal (`/dashboard`):
  - Componente `EmpresasList` (tabla básica)
  - Hook `useEmpresas` para fetch de Supabase
  - Mostrar: NIT, razón social, estado, fecha, botón "Ver detalle"
  - Sin filtros todavía

#### **Semana 2: Filtros + Vista detalle (parte 1)**

**Día 1-2:**
- [ ] Implementar filtros en dashboard:
  - Component `EmpresaFilters` (select de estados)
  - Búsqueda por NIT/razón social
  - Paginación (mostrar 20 por página)
  - Componente `EmpresaEstadoBadge` con colores

**Día 3:**
- [ ] Vista detalle empresa (`/dashboard/empresas/[id]`):
  - Layout de la página (grid 2 columnas)
  - Componente `DatosEmpresa` (mostrar todos los campos)
  - Hook `useEmpresaDetalle`

**Día 4-5:**
- [ ] Documentos (parte 1):
  - Componente `DocumentosViewer` (grid de cards)
  - Componente `DocumentoCard` (mostrar tipo, fecha, tamaño)
  - Listar documentos desde Supabase

#### **Semana 3: Visualización documentos + Extracción IA**

**Día 1-2:**
- [ ] Configurar AWS S3:
  - Crear bucket `confirming-documentos-prod`
  - Configurar políticas de acceso
  - Implementar función `generatePresignedUrl` en `lib/aws/s3.ts`

**Día 2-3:**
- [ ] API Route para presigned URLs:
  - `/api/documentos/[id]/presigned-url`
  - Validar que usuario sea admin
  - Validar que documento exista
  - Retornar URL con expiración 15 min

**Día 3-4:**
- [ ] Componente `PDFViewer`:
  - Usar react-pdf para renderizar PDFs
  - Mostrar imágenes (JPG, PNG) con zoom
  - Botón "Descargar"
  - Indicador de carga

**Día 5:**
- [ ] Componente `ExtraccionIA`:
  - Mostrar datos extraídos por Document AI
  - Comparar contra datos ingresados manualmente
  - Highlight de discrepancias (ej: NIT diferente)
  - Badge de confianza (% de certeza)

#### **Semana 4: Acciones + Comentarios + Historial**

**Día 1-2:**
- [ ] Componente `AccionesEmpresa`:
  - Botones: Aprobar / Rechazar / Solicitar documentos
  - Dialog de confirmación con textarea para motivo
  - Hook `useCambiarEstado` con mutación a Supabase
  - Validar que estado anterior sea válido

**Día 3:**
- [ ] Componente `ComentariosPanel`:
  - Lista de comentarios con timestamp y autor
  - Textarea para agregar nuevo comentario
  - Hook `useComentarios` con realtime (opcional)
  - Auto-scroll al último comentario

**Día 4:**
- [ ] Componente `HistorialEstados`:
  - Timeline vertical con estados previos
  - Mostrar: fecha, estado anterior → nuevo, quién cambió, motivo
  - Icono por tipo de cambio

**Día 5:**
- [ ] Pulido final:
  - Agregar loading states en todos los componentes
  - Error boundaries
  - Empty states ("No hay empresas pendientes")
  - Responsive mobile (sidebar colapsable)
  - Testing manual completo

---

## 7. INTEGRACIÓN GOOGLE DOCUMENT AI

### 7.1 Arquitectura de extracción

```
Usuario sube documento en Lovable
         ↓
Edge Function genera presigned URL
         ↓
Archivo se sube a S3
         ↓
Trigger INSERT en tabla 'documentos'
         ↓
n8n recibe webhook 'documento_subido'
         ↓
n8n llama AWS Lambda 'document-ai-processor'
         ↓
Lambda descarga archivo de S3
         ↓
Lambda llama Google Document AI API
         ↓
Lambda recibe resultado (JSON)
         ↓
Lambda guarda resultado en Supabase (UPDATE documentos)
         ↓
Si hay discrepancias, crear comentario interno automático
```

### 7.2 AWS Lambda - document-ai-processor

**Runtime:** Python 3.12
**Timeout:** 5 minutos
**Memory:** 1024 MB
**Trigger:** Invocación manual desde n8n

**Variables de entorno:**
```bash
GOOGLE_CLOUD_PROJECT_ID=tu-proyecto-gcp
GOOGLE_APPLICATION_CREDENTIALS=/var/task/credentials.json  # Montado en Lambda
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=eyJxxx...  # Service role key (secret)
AWS_S3_BUCKET=confirming-documentos-prod
```

**Código (pseudocódigo):**
```python
import boto3
from google.cloud import documentai_v1 as documentai
import json

def lambda_handler(event, context):
    # event = { "documento_id": "uuid", "s3_key": "...", "tipo_documento": "rut" }

    # 1. Descargar de S3
    s3 = boto3.client('s3')
    file_content = s3.get_object(
        Bucket=os.environ['AWS_S3_BUCKET'],
        Key=event['s3_key']
    )['Body'].read()

    # 2. Llamar Document AI
    client = documentai.DocumentProcessorServiceClient()
    processor_name = get_processor_by_type(event['tipo_documento'])

    request = documentai.ProcessRequest(
        name=processor_name,
        raw_document=documentai.RawDocument(
            content=file_content,
            mime_type='application/pdf'
        )
    )

    result = client.process_document(request=request)
    document = result.document

    # 3. Extraer campos clave
    extracted = extract_fields(document, event['tipo_documento'])

    # 4. Calcular confianza
    confidence = calculate_confidence(document)

    # 5. Guardar en Supabase
    supabase = create_supabase_client()
    supabase.table('documentos').update({
        'extraccion_completa': True,
        'extraccion_data': result.document.to_dict(),
        'extraccion_resumen': extracted,
        'extraccion_confianza': confidence,
        'extraccion_fecha': 'NOW()'
    }).eq('id', event['documento_id']).execute()

    # 6. Verificar discrepancias
    check_discrepancies(event['documento_id'], extracted)

    return {
        'statusCode': 200,
        'body': json.dumps({'extracted': extracted, 'confidence': confidence})
    }

def extract_fields(document, tipo):
    """Extrae campos según tipo de documento"""

    if tipo == 'rut':
        return {
            'nit': find_field(document, 'NIT'),
            'razon_social': find_field(document, 'Razón Social'),
            'direccion': find_field(document, 'Dirección')
        }

    elif tipo == 'camara_comercio':
        return {
            'nit': find_field(document, 'NIT'),
            'razon_social': find_field(document, 'Nombre'),
            'representante_legal': find_field(document, 'Representante Legal'),
            'fecha_constitucion': find_field(document, 'Fecha')
        }

    elif tipo == 'cedula_representante_legal':
        return {
            'numero_cedula': find_field(document, 'Número'),
            'nombre': find_field(document, 'Nombre'),
            'fecha_expedicion': find_field(document, 'Fecha de Expedición')
        }

    elif tipo == 'declaracion_renta':
        return {
            'nit': find_field(document, 'NIT'),
            'año_gravable': find_field(document, 'Año'),
            'total_ingresos': find_field(document, 'Total Ingresos'),
            'total_patrimonio': find_field(document, 'Patrimonio')
        }

    elif tipo == 'estados_financieros':
        return {
            'activos_totales': find_field(document, 'Activos Totales'),
            'pasivos_totales': find_field(document, 'Pasivos Totales'),
            'patrimonio': find_field(document, 'Patrimonio'),
            'utilidad_neta': find_field(document, 'Utilidad Neta')
        }

    else:
        return {}

def check_discrepancies(documento_id, extracted):
    """Compara datos extraídos vs datos ingresados"""

    supabase = create_supabase_client()

    # Obtener empresa asociada al documento
    doc = supabase.table('documentos').select('empresa_id').eq('id', documento_id).single().execute()
    empresa = supabase.table('empresas_pagadoras').select('*').eq('id', doc.data['empresa_id']).single().execute()

    discrepancies = []

    # Comparar NIT
    if 'nit' in extracted and extracted['nit'] != empresa.data['nit']:
        discrepancies.append(f"NIT no coincide: ingresado {empresa.data['nit']}, extraído {extracted['nit']}")

    # Comparar razón social
    if 'razon_social' in extracted:
        similarity = calculate_similarity(extracted['razon_social'], empresa.data['razon_social'])
        if similarity < 0.8:  # 80% de similitud
            discrepancies.append(f"Razón social difiere: {extracted['razon_social']}")

    # Si hay discrepancias, crear comentario automático
    if discrepancies:
        supabase.table('comentarios_internos').insert({
            'empresa_id': doc.data['empresa_id'],
            'usuario_id': 'SISTEMA',  # O crear un usuario especial 'bot'
            'comentario': f"⚠️ Discrepancias detectadas:\n" + "\n".join(discrepancies)
        }).execute()
```

### 7.3 Procesadores Document AI por tipo de documento

| Tipo Documento | Processor Type | Campos clave extraídos |
|----------------|----------------|------------------------|
| `rut` | `FORM_PARSER_PROCESSOR` | NIT, razón social, dirección, ciudad |
| `camara_comercio` | `FORM_PARSER_PROCESSOR` | NIT, nombre, rep. legal, fecha constitución |
| `cedula_representante_legal` | `ID_DOCUMENT_PROCESSOR` | Número, nombre, fecha expedición |
| `declaracion_renta` | `FORM_PARSER_PROCESSOR` | NIT, año, ingresos, patrimonio |
| `estados_financieros` | `FORM_PARSER_PROCESSOR` | Activos, pasivos, patrimonio, utilidad |
| `registro_accionistas` | `FORM_PARSER_PROCESSOR` | Lista de accionistas, % participación |

**Nota:** Necesitas crear estos procesadores en Google Cloud Console antes de usarlos.

### 7.4 Configuración Document AI en GCP

```bash
# 1. Habilitar API
gcloud services enable documentai.googleapis.com

# 2. Crear procesadores (uno por tipo)
gcloud alpha documentai processors create \
  --display-name="RUT Colombia Processor" \
  --type=FORM_PARSER_PROCESSOR \
  --location=us

# 3. Obtener el nombre del procesador (necesario para Lambda)
gcloud alpha documentai processors list --location=us

# 4. Crear service account para Lambda
gcloud iam service-accounts create lambda-document-ai \
  --display-name="Lambda Document AI"

# 5. Dar permisos
gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="serviceAccount:lambda-document-ai@PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/documentai.apiUser"

# 6. Generar key (guardar en AWS Secrets Manager)
gcloud iam service-accounts keys create credentials.json \
  --iam-account=lambda-document-ai@PROJECT_ID.iam.gserviceaccount.com
```

---

## 8. SUPABASE EDGE FUNCTIONS

### 8.1 Edge Function: generar-url-subida

**Propósito:** Generar presigned URL para que Lovable suba documentos a S3

**Ubicación:** `supabase/functions/generar-url-subida/index.ts`

**Código (pseudocódigo):**
```typescript
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { S3Client, PutObjectCommand } from 'npm:@aws-sdk/client-s3@3.600.0'
import { getSignedUrl } from 'npm:@aws-sdk/s3-request-presigner@3.600.0'
import { createClient } from 'npm:@supabase/supabase-js@2.45.0'

serve(async (req) => {
  const { empresa_id, tipo_documento, nombre_archivo, mime_type, tamano_bytes } = await req.json()

  // 1. Validar autenticación
  const authHeader = req.headers.get('Authorization')
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL'),
    Deno.env.get('SUPABASE_ANON_KEY'),
    { global: { headers: { Authorization: authHeader } } }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  // 2. Verificar que la empresa pertenezca al usuario
  const { data: empresa } = await supabase
    .from('empresas_pagadoras')
    .select('nit, usuario_id')
    .eq('id', empresa_id)
    .single()

  if (!empresa || empresa.usuario_id !== user.id) {
    return new Response('Forbidden', { status: 403 })
  }

  // 3. Generar S3 key
  const timestamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0]
  const uuid = crypto.randomUUID().split('-')[0]
  const nombre_sanitizado = sanitize_filename(nombre_archivo)
  const s3_key = `pagadores/${empresa.nit}/${tipo_documento}/${timestamp}_${uuid}_${nombre_sanitizado}`

  // 4. Crear registro en tabla documentos
  const { data: documento } = await supabase
    .from('documentos')
    .insert({
      empresa_id,
      tipo_documento,
      s3_bucket: 'confirming-documentos-prod',
      s3_key,
      nombre_original: nombre_archivo,
      mime_type,
      tamano_bytes,
      subido_por: user.id,
      extraccion_completa: false
    })
    .select()
    .single()

  // 5. Generar presigned URL
  const s3Client = new S3Client({
    region: 'us-east-1',
    credentials: {
      accessKeyId: Deno.env.get('AWS_ACCESS_KEY_ID'),
      secretAccessKey: Deno.env.get('AWS_SECRET_ACCESS_KEY')
    }
  })

  const command = new PutObjectCommand({
    Bucket: 'confirming-documentos-prod',
    Key: s3_key,
    ContentType: mime_type
  })

  const presigned_url = await getSignedUrl(s3Client, command, { expiresIn: 900 }) // 15 min

  return new Response(
    JSON.stringify({
      presigned_url,
      s3_bucket: 'confirming-documentos-prod',
      s3_key,
      documento_id: documento.id
    }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})
```

### 8.2 Edge Function: obtener-url-documento

**Propósito:** Generar presigned URL temporal para visualizar documentos en back office

**Ubicación:** `supabase/functions/obtener-url-documento/index.ts`

**Código (pseudocódigo):**
```typescript
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { S3Client, GetObjectCommand } from 'npm:@aws-sdk/client-s3@3.600.0'
import { getSignedUrl } from 'npm:@aws-sdk/s3-request-presigner@3.600.0'
import { createClient } from 'npm:@supabase/supabase-js@2.45.0'

serve(async (req) => {
  const { documento_id } = await req.json()

  // 1. Validar auth
  const authHeader = req.headers.get('Authorization')
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL'),
    Deno.env.get('SUPABASE_SERVICE_KEY') // Service key, no anon
  )

  const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
  if (!user) return new Response('Unauthorized', { status: 401 })

  // 2. Verificar que usuario sea admin
  const { data: usuario } = await supabase
    .from('usuarios')
    .select('rol')
    .eq('id', user.id)
    .single()

  if (usuario.rol !== 'admin') {
    return new Response('Forbidden - Admin only', { status: 403 })
  }

  // 3. Obtener documento
  const { data: documento } = await supabase
    .from('documentos')
    .select('s3_bucket, s3_key, mime_type')
    .eq('id', documento_id)
    .single()

  if (!documento) return new Response('Not found', { status: 404 })

  // 4. Generar presigned URL
  const s3Client = new S3Client({
    region: 'us-east-1',
    credentials: {
      accessKeyId: Deno.env.get('AWS_ACCESS_KEY_ID'),
      secretAccessKey: Deno.env.get('AWS_SECRET_ACCESS_KEY')
    }
  })

  const command = new GetObjectCommand({
    Bucket: documento.s3_bucket,
    Key: documento.s3_key
  })

  const presigned_url = await getSignedUrl(s3Client, command, { expiresIn: 900 })

  return new Response(
    JSON.stringify({
      presigned_url,
      expira_en: 900,
      mime_type: documento.mime_type
    }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})
```

---

## 9. VARIABLES DE ENTORNO

### 9.1 Supabase (proyecto)

```bash
# Disponibles en Supabase Dashboard > Settings > API
SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... # SECRETO, solo server
```

### 9.2 AWS (S3 + SES)

```bash
AWS_ACCESS_KEY_ID=AKIAXXXXXXXXXXXXX
AWS_SECRET_ACCESS_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
AWS_REGION=us-east-1
AWS_S3_BUCKET=confirming-documentos-prod
AWS_SES_FROM_EMAIL=noreply@tudominio.com
```

### 9.3 Google Cloud (Document AI)

```bash
GOOGLE_CLOUD_PROJECT_ID=tu-proyecto-gcp
GOOGLE_APPLICATION_CREDENTIALS=/path/to/credentials.json
GOOGLE_DOCUMENTAI_LOCATION=us
GOOGLE_DOCUMENTAI_PROCESSOR_RUT=projects/123/locations/us/processors/abc
GOOGLE_DOCUMENTAI_PROCESSOR_CAMARA=projects/123/locations/us/processors/def
# ... uno por tipo de documento
```

### 9.4 n8n

```bash
N8N_WEBHOOK_BASE_URL=https://n8n.tudominio.com/webhook
N8N_WEBHOOK_SECRET=tu-secret-para-validar-requests
```

### 9.5 Next.js Back Office (.env.local)

```bash
# Públicas (expuestas al cliente)
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
NEXT_PUBLIC_APP_URL=https://backoffice.tudominio.com

# Privadas (solo server-side)
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
AWS_ACCESS_KEY_ID=AKIAXXXXXXXXXXXXX
AWS_SECRET_ACCESS_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
AWS_S3_BUCKET=confirming-documentos-prod
```

---

## 10. CHECKLIST FINAL ANTES DE "EJECUTAR"

### 10.1 Infraestructura

- [ ] Proyecto Supabase creado
- [ ] Auth providers configurados (Google, Apple, Email)
- [ ] Bucket S3 creado con políticas de acceso
- [ ] IAM roles creados para Edge Functions y Lambda
- [ ] n8n desplegado en GCP Cloud Run
- [ ] Document AI procesadores creados en GCP
- [ ] Service account de GCP con permisos

### 10.2 Configuración

- [ ] Variables de entorno configuradas en Supabase (Secrets)
- [ ] Variables de entorno configuradas en n8n
- [ ] Credenciales de AWS guardadas en Secrets Manager
- [ ] Credenciales de GCP guardadas (JSON key)
- [ ] Dominio configurado para n8n webhooks

### 10.3 Desarrollo

- [ ] Schema SQL revisado y listo para ejecutar
- [ ] Tipos TypeScript de Supabase generados
- [ ] Proyecto Next.js inicializado
- [ ] shadcn/ui configurado

### 10.4 Validaciones

- [ ] Validador de NIT colombiano probado
- [ ] Flujo de presigned URLs S3 entendido
- [ ] RLS policies revisadas por seguridad
- [ ] Restricción de admins confirmada

---

## 11. CRONOGRAMA SUGERIDO (EJECUCIÓN POST-APROBACIÓN)

| Semana | Responsable | Entregables |
|--------|-------------|-------------|
| **S1** | Backend | Supabase schema + Edge Functions + AWS S3 configurado |
| **S1-S2** | Lovable | Frontend onboarding completo + integración Supabase |
| **S2-S4** | Backend | Back office Next.js completo |
| **S3** | DevOps | n8n workflows + Document AI Lambda |
| **S4** | QA | Testing integral + ajustes finales |

**Total estimado:** 4-5 semanas para Capa 1 funcional.

---

## 12. PRÓXIMOS PASOS (POST-APROBACIÓN)

Cuando escribas **"EJECUTAR"**, empezaré en este orden:

1. **Ejecutar schema SQL en Supabase** (crear todas las tablas)
2. **Crear estructura de carpetas del proyecto Next.js**
3. **Escribir Edge Functions de Supabase**
4. **Implementar componentes del back office en orden de dependencia**
5. **Crear Lambda de Document AI**
6. **Documentar workflows de n8n** (para que tú los configures visualmente)
7. **Generar archivo de contrato de datos para Lovable** (JSON con ejemplos)

---

**¿Tienes preguntas sobre alguna decisión arquitectónica?**
**¿Quieres que ajuste algo antes de ejecutar?**

Escribe tus comentarios o directamente **"EJECUTAR"** para empezar la construcción.
