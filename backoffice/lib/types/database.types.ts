// TODO: Generar con `supabase gen types typescript --project-id <project-id> > lib/types/database.types.ts`
// Por ahora, definimos manualmente basados en CONTRATO.md

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      usuarios: {
        Row: {
          id: string
          rol: 'pagador' | 'proveedor' | 'admin'
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          rol: 'pagador' | 'proveedor' | 'admin'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          rol?: 'pagador' | 'proveedor' | 'admin'
          created_at?: string
          updated_at?: string
        }
      }
      empresas_pagadoras: {
        Row: {
          id: string
          usuario_id: string
          nit: string
          razon_social: string
          direccion: string
          ciudad: string
          departamento: string
          actividad_economica: string
          codigo_ciiu: string
          representante_legal_nombre: string
          representante_legal_cedula: string
          representante_legal_email: string
          representante_legal_telefono: string
          estado: 'pendiente' | 'en_revision' | 'documentos_incompletos' | 'aprobado' | 'rechazado'
          estado_anterior: string | null
          fecha_cambio_estado: string | null
          created_at: string
          updated_at: string
          aprobado_por: string | null
          fecha_aprobacion: string | null
          ip_registro: string | null
          user_agent: string | null
        }
        Insert: {
          id?: string
          usuario_id: string
          nit: string
          razon_social: string
          direccion: string
          ciudad: string
          departamento: string
          actividad_economica: string
          codigo_ciiu: string
          representante_legal_nombre: string
          representante_legal_cedula: string
          representante_legal_email: string
          representante_legal_telefono: string
          estado?: 'pendiente' | 'en_revision' | 'documentos_incompletos' | 'aprobado' | 'rechazado'
          estado_anterior?: string | null
          fecha_cambio_estado?: string | null
          created_at?: string
          updated_at?: string
          aprobado_por?: string | null
          fecha_aprobacion?: string | null
          ip_registro?: string | null
          user_agent?: string | null
        }
        Update: {
          id?: string
          usuario_id?: string
          nit?: string
          razon_social?: string
          direccion?: string
          ciudad?: string
          departamento?: string
          actividad_economica?: string
          codigo_ciiu?: string
          representante_legal_nombre?: string
          representante_legal_cedula?: string
          representante_legal_email?: string
          representante_legal_telefono?: string
          estado?: 'pendiente' | 'en_revision' | 'documentos_incompletos' | 'aprobado' | 'rechazado'
          estado_anterior?: string | null
          fecha_cambio_estado?: string | null
          created_at?: string
          updated_at?: string
          aprobado_por?: string | null
          fecha_aprobacion?: string | null
          ip_registro?: string | null
          user_agent?: string | null
        }
      }
      documentos: {
        Row: {
          id: string
          empresa_id: string
          tipo_documento: 'camara_comercio' | 'registro_accionistas' | 'rut' | 'cedula_representante_legal' | 'declaracion_renta' | 'estados_financieros' | 'otro'
          s3_bucket: string
          s3_key: string
          nombre_original: string
          mime_type: string
          tamano_bytes: number
          extraccion_completa: boolean
          extraccion_data: Json | null
          extraccion_resumen: Json | null
          extraccion_confianza: number | null
          extraccion_fecha: string | null
          subido_por: string
          created_at: string
          updated_at: string
          es_version_actual: boolean
          reemplaza_a: string | null
        }
        Insert: {
          id?: string
          empresa_id: string
          tipo_documento: 'camara_comercio' | 'registro_accionistas' | 'rut' | 'cedula_representante_legal' | 'declaracion_renta' | 'estados_financieros' | 'otro'
          s3_bucket: string
          s3_key: string
          nombre_original: string
          mime_type: string
          tamano_bytes: number
          extraccion_completa?: boolean
          extraccion_data?: Json | null
          extraccion_resumen?: Json | null
          extraccion_confianza?: number | null
          extraccion_fecha?: string | null
          subido_por: string
          created_at?: string
          updated_at?: string
          es_version_actual?: boolean
          reemplaza_a?: string | null
        }
        Update: {
          id?: string
          empresa_id?: string
          tipo_documento?: 'camara_comercio' | 'registro_accionistas' | 'rut' | 'cedula_representante_legal' | 'declaracion_renta' | 'estados_financieros' | 'otro'
          s3_bucket?: string
          s3_key?: string
          nombre_original?: string
          mime_type?: string
          tamano_bytes?: number
          extraccion_completa?: boolean
          extraccion_data?: Json | null
          extraccion_resumen?: Json | null
          extraccion_confianza?: number | null
          extraccion_fecha?: string | null
          subido_por?: string
          created_at?: string
          updated_at?: string
          es_version_actual?: boolean
          reemplaza_a?: string | null
        }
      }
      historial_estados: {
        Row: {
          id: string
          empresa_id: string
          estado_anterior: string | null
          estado_nuevo: string
          cambiado_por: string | null
          motivo: string | null
          created_at: string
        }
        Insert: {
          id?: string
          empresa_id: string
          estado_anterior?: string | null
          estado_nuevo: string
          cambiado_por?: string | null
          motivo?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          empresa_id?: string
          estado_anterior?: string | null
          estado_nuevo?: string
          cambiado_por?: string | null
          motivo?: string | null
          created_at?: string
        }
      }
      comentarios_internos: {
        Row: {
          id: string
          empresa_id: string
          usuario_id: string
          comentario: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          empresa_id: string
          usuario_id: string
          comentario: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          empresa_id?: string
          usuario_id?: string
          comentario?: string
          created_at?: string
          updated_at?: string
        }
      }
      notificaciones_enviadas: {
        Row: {
          id: string
          empresa_id: string | null
          tipo: 'email' | 'whatsapp' | 'sms' | 'push'
          evento: string
          destinatario: string
          enviado: boolean
          fecha_envio: string | null
          error: string | null
          payload: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          empresa_id?: string | null
          tipo: 'email' | 'whatsapp' | 'sms' | 'push'
          evento: string
          destinatario: string
          enviado?: boolean
          fecha_envio?: string | null
          error?: string | null
          payload?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          empresa_id?: string | null
          tipo?: 'email' | 'whatsapp' | 'sms' | 'push'
          evento?: string
          destinatario?: string
          enviado?: boolean
          fecha_envio?: string | null
          error?: string | null
          payload?: Json | null
          created_at?: string
        }
      }
      convenios: {
        Row: {
          id: string
          empresa_pagadora_id: string
          nombre: string
          descripcion: string | null
          tasa_descuento_anual: number | null
          dias_anticipo_minimo: number | null
          dias_anticipo_maximo: number | null
          monto_minimo_factura: number | null
          monto_maximo_factura: number | null
          estado: 'borrador' | 'activo' | 'suspendido' | 'terminado'
          fecha_inicio: string | null
          fecha_fin: string | null
          created_at: string
          updated_at: string
          created_by: string | null
        }
        Insert: {
          id?: string
          empresa_pagadora_id: string
          nombre: string
          descripcion?: string | null
          tasa_descuento_anual?: number | null
          dias_anticipo_minimo?: number | null
          dias_anticipo_maximo?: number | null
          monto_minimo_factura?: number | null
          monto_maximo_factura?: number | null
          estado?: 'borrador' | 'activo' | 'suspendido' | 'terminado'
          fecha_inicio?: string | null
          fecha_fin?: string | null
          created_at?: string
          updated_at?: string
          created_by?: string | null
        }
        Update: {
          id?: string
          empresa_pagadora_id?: string
          nombre?: string
          descripcion?: string | null
          tasa_descuento_anual?: number | null
          dias_anticipo_minimo?: number | null
          dias_anticipo_maximo?: number | null
          monto_minimo_factura?: number | null
          monto_maximo_factura?: number | null
          estado?: 'borrador' | 'activo' | 'suspendido' | 'terminado'
          fecha_inicio?: string | null
          fecha_fin?: string | null
          created_at?: string
          updated_at?: string
          created_by?: string | null
        }
      }
      proveedores: {
        Row: {
          id: string
          usuario_id: string | null
          nit: string
          razon_social: string
          banco: string | null
          tipo_cuenta: 'ahorros' | 'corriente' | null
          numero_cuenta: string | null
          estado: 'pendiente' | 'verificado' | 'rechazado' | 'inactivo'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          usuario_id?: string | null
          nit: string
          razon_social: string
          banco?: string | null
          tipo_cuenta?: 'ahorros' | 'corriente' | null
          numero_cuenta?: string | null
          estado?: 'pendiente' | 'verificado' | 'rechazado' | 'inactivo'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          usuario_id?: string | null
          nit?: string
          razon_social?: string
          banco?: string | null
          tipo_cuenta?: 'ahorros' | 'corriente' | null
          numero_cuenta?: string | null
          estado?: 'pendiente' | 'verificado' | 'rechazado' | 'inactivo'
          created_at?: string
          updated_at?: string
        }
      }
      convenios_proveedores: {
        Row: {
          id: string
          convenio_id: string
          proveedor_id: string
          estado: 'invitado' | 'aceptado' | 'rechazado' | 'inactivo'
          fecha_invitacion: string
          fecha_respuesta: string | null
          created_at: string
        }
        Insert: {
          id?: string
          convenio_id: string
          proveedor_id: string
          estado?: 'invitado' | 'aceptado' | 'rechazado' | 'inactivo'
          fecha_invitacion?: string
          fecha_respuesta?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          convenio_id?: string
          proveedor_id?: string
          estado?: 'invitado' | 'aceptado' | 'rechazado' | 'inactivo'
          fecha_invitacion?: string
          fecha_respuesta?: string | null
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}
