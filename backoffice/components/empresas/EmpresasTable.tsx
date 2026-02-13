'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { EmpresaEstadoBadge } from './EmpresaEstadoBadge'
import type { EmpresaPagadora } from '@/lib/types'
import { ESTADOS_EMPRESA, type EstadoEmpresa } from '@/constants/estados'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Eye, Calendar } from 'lucide-react'

interface EmpresasTableProps {
  empresas: EmpresaPagadora[]
}

export function EmpresasTable({ empresas }: EmpresasTableProps) {
  const [filtroEstado, setFiltroEstado] = useState<EstadoEmpresa | 'todos'>('todos')

  const empresasFiltradas = filtroEstado === 'todos'
    ? empresas
    : empresas.filter(e => e.estado === filtroEstado)

  return (
    <>
      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle>Filtrar por estado</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={filtroEstado === 'todos' ? 'default' : 'outline'}
              onClick={() => setFiltroEstado('todos')}
              size="sm"
            >
              Todos ({empresas.length})
            </Button>
            {Object.entries(ESTADOS_EMPRESA).map(([key, value]) => {
              const count = empresas.filter(e => e.estado === value).length
              return (
                <Button
                  key={key}
                  variant={filtroEstado === value ? 'default' : 'outline'}
                  onClick={() => setFiltroEstado(value)}
                  size="sm"
                >
                  {key.charAt(0) + key.slice(1).toLowerCase().replace(/_/g, ' ')} ({count})
                </Button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Tabla */}
      <Card>
        <CardHeader>
          <CardTitle>Empresas ({empresasFiltradas.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="pb-3 text-left text-sm font-medium text-gray-500">NIT</th>
                  <th className="pb-3 text-left text-sm font-medium text-gray-500">Razón Social</th>
                  <th className="pb-3 text-left text-sm font-medium text-gray-500">Ciudad</th>
                  <th className="pb-3 text-left text-sm font-medium text-gray-500">Estado</th>
                  <th className="pb-3 text-left text-sm font-medium text-gray-500">Fecha</th>
                  <th className="pb-3 text-left text-sm font-medium text-gray-500">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {empresasFiltradas.map((empresa) => (
                  <tr key={empresa.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-4 text-sm font-medium text-gray-900">
                      {empresa.nit}
                    </td>
                    <td className="py-4">
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {empresa.razon_social}
                        </p>
                        <p className="text-sm text-gray-500">
                          {empresa.representante_legal_nombre}
                        </p>
                      </div>
                    </td>
                    <td className="py-4 text-sm text-gray-500">
                      {empresa.ciudad}, {empresa.departamento}
                    </td>
                    <td className="py-4">
                      <EmpresaEstadoBadge estado={empresa.estado} />
                    </td>
                    <td className="py-4 text-sm text-gray-500">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {format(new Date(empresa.created_at), 'dd MMM yyyy', { locale: es })}
                      </div>
                    </td>
                    <td className="py-4">
                      <Link href={`/dashboard/empresas/${empresa.id}`}>
                        <Button variant="outline" size="sm">
                          <Eye className="mr-2 h-4 w-4" />
                          Ver detalle
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {empresasFiltradas.length === 0 && (
              <div className="py-12 text-center">
                <p className="text-gray-500">No hay empresas con el filtro seleccionado</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </>
  )
}
