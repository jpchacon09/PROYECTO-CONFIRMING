-- ============================================================================
-- PLATAFORMA CONFIRMING - SCHEMA SUPABASE (CAPA 1)
-- ============================================================================
-- Ejecutar este archivo completo en Supabase SQL Editor
-- Orden: Extensiones → Tablas → Índices → Triggers → Functions → RLS
-- ============================================================================

-- EXTENSIONES
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- TABLAS PRINCIPALES
-- ============================================================================

-- usuarios (extiende auth.users de Supabase)
CREATE TABLE public.usuarios (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    rol VARCHAR(20) NOT NULL CHECK (rol IN ('pagador', 'proveedor', 'admin')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_usuarios_rol ON public.usuarios(rol);

-- empresas_pagadoras
CREATE TABLE public.empresas_pagadoras (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,

    -- Datos básicos
    nit VARCHAR(12) NOT NULL UNIQUE,
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
CREATE INDEX idx_empresas_usuario ON public.empresas_pagadoras(usuario_id);

-- documentos
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
    extraccion_data JSONB,
    extraccion_resumen JSONB,
    extraccion_confianza DECIMAL(3,2),
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
CREATE INDEX idx_documentos_s3 ON public.documentos(s3_bucket, s3_key);

-- comentarios_internos
CREATE TABLE public.comentarios_internos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID NOT NULL REFERENCES public.empresas_pagadoras(id) ON DELETE CASCADE,
    usuario_id UUID NOT NULL REFERENCES public.usuarios(id),

    comentario TEXT NOT NULL,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_comentarios_empresa ON public.comentarios_internos(empresa_id, created_at DESC);

-- historial_estados
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

-- notificaciones_enviadas
CREATE TABLE public.notificaciones_enviadas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID REFERENCES public.empresas_pagadoras(id) ON DELETE CASCADE,

    tipo VARCHAR(50) NOT NULL CHECK (
        tipo IN ('email', 'whatsapp', 'sms', 'push')
    ),
    evento VARCHAR(100) NOT NULL,
    destinatario VARCHAR(255) NOT NULL,

    enviado BOOLEAN DEFAULT FALSE,
    fecha_envio TIMESTAMPTZ,
    error TEXT,

    payload JSONB,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notificaciones_empresa ON public.notificaciones_enviadas(empresa_id);
CREATE INDEX idx_notificaciones_enviado ON public.notificaciones_enviadas(enviado, created_at);

-- TABLAS PARA CAPAS FUTURAS (preparación)
-- ============================================================================

-- convenios (Capa 2)
CREATE TABLE public.convenios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_pagadora_id UUID NOT NULL REFERENCES public.empresas_pagadoras(id) ON DELETE CASCADE,

    nombre VARCHAR(255) NOT NULL,
    descripcion TEXT,

    -- Condiciones financieras
    tasa_descuento_anual DECIMAL(5,4),
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

-- proveedores (Capa 2)
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
CREATE INDEX idx_proveedores_usuario ON public.proveedores(usuario_id);

-- convenios_proveedores (Capa 2)
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

-- FUNCIONES Y TRIGGERS
-- ============================================================================

-- Función: Actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para updated_at
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

-- Función: Registrar cambios de estado en historial
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
            NEW.aprobado_por,
            'Cambio de estado'
        );

        NEW.estado_anterior = OLD.estado;
        NEW.fecha_cambio_estado = NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_cambio_estado BEFORE UPDATE ON public.empresas_pagadoras
    FOR EACH ROW EXECUTE FUNCTION registrar_cambio_estado();

-- Función: Notificar cambio de estado (crea registro para n8n)
CREATE OR REPLACE FUNCTION notificar_cambio_estado()
RETURNS TRIGGER AS $$
DECLARE
    payload JSONB;
BEGIN
    IF OLD.estado IS DISTINCT FROM NEW.estado THEN
        payload := jsonb_build_object(
            'evento', 'estado_cambiado',
            'empresa_id', NEW.id,
            'nit', NEW.nit,
            'razon_social', NEW.razon_social,
            'estado_anterior', OLD.estado,
            'estado_nuevo', NEW.estado,
            'email_contacto', NEW.representante_legal_email,
            'timestamp', NOW()
        );

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

-- Función: Notificar onboarding completo
CREATE OR REPLACE FUNCTION verificar_onboarding_completo()
RETURNS TRIGGER AS $$
DECLARE
    total_documentos INTEGER;
    documentos_requeridos INTEGER := 6; -- Ajustar según tus necesidades
    empresa_record RECORD;
BEGIN
    -- Contar documentos de la empresa
    SELECT COUNT(DISTINCT tipo_documento) INTO total_documentos
    FROM public.documentos
    WHERE empresa_id = NEW.empresa_id
    AND es_version_actual = TRUE;

    -- Si tiene todos los documentos requeridos, notificar
    IF total_documentos >= documentos_requeridos THEN
        SELECT * INTO empresa_record
        FROM public.empresas_pagadoras
        WHERE id = NEW.empresa_id;

        -- Verificar que no se haya notificado antes
        IF NOT EXISTS (
            SELECT 1 FROM public.notificaciones_enviadas
            WHERE empresa_id = NEW.empresa_id
            AND evento = 'onboarding_completo'
        ) THEN
            INSERT INTO public.notificaciones_enviadas (
                empresa_id,
                tipo,
                evento,
                destinatario,
                payload
            ) VALUES (
                NEW.empresa_id,
                'email',
                'onboarding_completo',
                'equipo@confirming.com', -- Email del equipo interno
                jsonb_build_object(
                    'empresa_id', empresa_record.id,
                    'nit', empresa_record.nit,
                    'razon_social', empresa_record.razon_social,
                    'total_documentos', total_documentos
                )
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_onboarding_completo AFTER INSERT ON public.documentos
    FOR EACH ROW EXECUTE FUNCTION verificar_onboarding_completo();

-- FUNCIONES ÚTILES
-- ============================================================================

-- Validar formato NIT colombiano
CREATE OR REPLACE FUNCTION validar_nit(nit_input TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN nit_input ~ '^\d{9}-\d{1}$';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

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

CREATE POLICY "Usuarios pueden actualizar su perfil"
    ON public.usuarios FOR UPDATE
    USING (auth.uid() = id);

-- Políticas para EMPRESAS PAGADORAS
CREATE POLICY "Pagadores ven solo su empresa"
    ON public.empresas_pagadoras FOR SELECT
    USING (usuario_id = auth.uid());

CREATE POLICY "Pagadores pueden crear su empresa"
    ON public.empresas_pagadoras FOR INSERT
    WITH CHECK (usuario_id = auth.uid());

CREATE POLICY "Pagadores pueden actualizar su empresa si está pendiente"
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
        OR EXISTS (
            SELECT 1 FROM public.usuarios
            WHERE id = auth.uid() AND rol = 'admin'
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

CREATE POLICY "Admins pueden gestionar todos los documentos"
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

-- Políticas para HISTORIAL
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

-- Políticas para NOTIFICACIONES (solo sistema y admins)
CREATE POLICY "Admins ven todas las notificaciones"
    ON public.notificaciones_enviadas FOR SELECT
    USING (
        EXISTS (
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

CREATE POLICY "Admins gestionan convenios"
    ON public.convenios FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.usuarios
            WHERE id = auth.uid() AND rol = 'admin'
        )
    );

-- Políticas para PROVEEDORES (Capa 2)
CREATE POLICY "Proveedores ven su propio registro"
    ON public.proveedores FOR SELECT
    USING (usuario_id = auth.uid());

CREATE POLICY "Admins ven todos los proveedores"
    ON public.proveedores FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.usuarios
            WHERE id = auth.uid() AND rol = 'admin'
        )
    );

-- ============================================================================
-- SCHEMA COMPLETO - LISTO PARA PRODUCCIÓN
-- ============================================================================
-- Después de ejecutar este script:
-- 1. Verifica que todas las tablas se crearon correctamente
-- 2. Crea un usuario admin inicial en la tabla usuarios
-- 3. Prueba las políticas RLS con diferentes roles
-- ============================================================================
