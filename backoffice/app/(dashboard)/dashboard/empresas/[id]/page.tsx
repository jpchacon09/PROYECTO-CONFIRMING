import { createServerSupabaseClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmpresaEstadoBadge } from '@/components/empresas/EmpresaEstadoBadge'
import { DocumentosList } from '@/components/detalle-empresa/DocumentosList'
import { ComentariosPanel } from '@/components/detalle-empresa/ComentariosPanel'
import { HistorialTimeline } from '@/components/detalle-empresa/HistorialTimeline'
import { AccionesAdmin } from '@/components/detalle-empresa/AccionesAdmin'
import { notFound } from 'next/navigation'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Building2, Mail, Phone, MapPin, Calendar, User, FileText } from 'lucide-react'
import type { EmpresaPagadora, Documento, HistorialEstado, ComentarioInterno } from '@/lib/types'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: {
    id: string
  }
}

async function getEmpresa(id: string): Promise<EmpresaPagadora | null> {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('empresas_pagadoras')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    console.error('Error fetching empresa:', error)
    return null
  }

  return data
}

async function getDocumentos(empresaId: string): Promise<Documento[]> {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('documentos')
    .select('*')
    .eq('empresa_id', empresaId)
    .eq('es_version_actual', true)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching documentos:', error)
    return []
  }

  return data || []
}

async function getHistorial(empresaId: string): Promise<HistorialEstado[]> {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('historial_estados')
    .select('*')
    .eq('empresa_id', empresaId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching historial:', error)
    return []
  }

  return data || []
}

async function getComentarios(empresaId: string): Promise<ComentarioInterno[]> {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('comentarios_internos')
    .select('*')
    .eq('empresa_id', empresaId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching comentarios:', error)
    return []
  }

  return data || []
}

export default async function EmpresaDetallePage({ params }: PageProps) {
  const [empresa, documentos, historial, comentarios] = await Promise.all([
    getEmpresa(params.id),
    getDocumentos(params.id),
    getHistorial(params.id),
    getComentarios(params.id)
  ])

  if (!empresa) {
    notFound()
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{empresa.razon_social}</h1>
          <p className="text-muted-foreground">NIT: {empresa.nit}</p>
        </div>
        <EmpresaEstadoBadge estado={empresa.estado} className="text-lg px-4 py-2" />
      </div>

      {/* Acciones de Admin */}
      <AccionesAdmin empresa={empresa} />

      {/* Información de la Empresa */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Información de la Empresa
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Razón Social</label>
              <p className="text-foreground">{empresa.razon_social}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">NIT</label>
              <p className="text-foreground">{empresa.nit}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">
                <MapPin className="inline h-4 w-4 mr-1" />
                Dirección
              </label>
              <p className="text-foreground">{empresa.direccion}</p>
              <p className="text-muted-foreground text-sm">{empresa.ciudad}, {empresa.departamento}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Actividad Económica</label>
              <p className="text-foreground">{empresa.actividad_economica}</p>
              <p className="text-muted-foreground text-sm">CIIU: {empresa.codigo_ciiu}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">
                <Calendar className="inline h-4 w-4 mr-1" />
                Fecha de Registro
              </label>
              <p className="text-foreground">
                {format(new Date(empresa.created_at), "dd 'de' MMMM 'de' yyyy", { locale: es })}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Representante Legal
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Nombre</label>
              <p className="text-foreground">{empresa.representante_legal_nombre}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Cédula</label>
              <p className="text-foreground">{empresa.representante_legal_cedula}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">
                <Mail className="inline h-4 w-4 mr-1" />
                Email
              </label>
              <p className="text-foreground">{empresa.representante_legal_email}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">
                <Phone className="inline h-4 w-4 mr-1" />
                Teléfono
              </label>
              <p className="text-foreground">{empresa.representante_legal_telefono}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Documentos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Documentos ({documentos.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DocumentosList documentos={documentos} />
        </CardContent>
      </Card>

      {/* Grid de Historial y Comentarios */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Historial de Estados */}
        <HistorialTimeline historial={historial} />

        {/* Comentarios Internos */}
        <ComentariosPanel comentarios={comentarios} empresaId={empresa.id} />
      </div>
    </div>
  )
}
