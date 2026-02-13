import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Textarea } from '@/components/ui/Textarea'
import { Select } from '@/components/ui/Select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { DEPARTAMENTOS_COLOMBIA } from '@/constants/estados'
import { toast } from 'sonner'
import { getErrorMessage } from '@/lib/errors'

// Schema de validación
const empresaSchema = z.object({
  nit: z.string().regex(/^\d{9}-\d{1}$/, {
    message: 'El NIT debe tener el formato XXXXXXXXX-X (ej: 900123456-7)',
  }),
  razon_social: z.string().min(3, 'La razón social es requerida'),
  direccion: z.string().min(5, 'La dirección es requerida'),
  ciudad: z.string().min(2, 'La ciudad es requerida'),
  departamento: z.string().min(2, 'El departamento es requerido'),
  actividad_economica: z.string().min(3, 'La actividad económica es requerida'),
  codigo_ciiu: z.string().regex(/^\d{4}$/, {
    message: 'El código CIIU debe tener 4 dígitos',
  }),
  representante_legal_nombre: z.string().min(3, 'El nombre del representante legal es requerido'),
  representante_legal_cedula: z.string().regex(/^\d{5,15}$/, {
    message: 'La cédula debe tener entre 5 y 15 dígitos',
  }),
  representante_legal_email: z.string().email('Ingresa un email válido'),
  representante_legal_telefono: z.string().regex(/^\+57\d{10}$/, {
    message: 'El teléfono debe tener el formato +57XXXXXXXXXX',
  }),
})

type EmpresaFormData = z.infer<typeof empresaSchema>

export function DatosEmpresa() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    async function getUser() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        navigate('/login')
        return
      }
      setUser(session.user)
    }
    getUser()
  }, [navigate])

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<EmpresaFormData>({
    resolver: zodResolver(empresaSchema),
    defaultValues: {
      representante_legal_telefono: '+57',
    },
  })

  const onSubmit = async (values: EmpresaFormData) => {
    if (!user) {
      toast.error('No estás autenticado')
      navigate('/login')
      return
    }

    try {
      setLoading(true)

      const { error } = await supabase
        .from('empresas_pagadoras')
        .insert({
          usuario_id: user.id,
          ...values,
          ip_registro: null, // Obtener del navegador si es necesario
          user_agent: navigator.userAgent,
        })

      if (error) {
        if (error.code === '23505') {
          toast.error('Ya existe una empresa registrada con este NIT')
        } else {
          toast.error('Error al guardar los datos: ' + error.message)
        }
        return
      }

      toast.success('Datos guardados correctamente')
      navigate('/onboarding/documentos')
    } catch (error: unknown) {
      toast.error(`Error inesperado: ${getErrorMessage(error, 'error desconocido')}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Datos de tu empresa</h1>
          <p className="text-gray-600 mt-2">Paso 1 de 2 - Información básica</p>
          <div className="mt-4 h-2 bg-gray-200 rounded-full">
            <div className="h-2 bg-primary rounded-full w-1/2" />
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Datos de la Empresa</CardTitle>
              <CardDescription>Información legal y fiscal</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="nit">NIT *</Label>
                <Input
                  id="nit"
                  placeholder="900123456-7"
                  {...register('nit')}
                  className={errors.nit ? 'border-red-500' : ''}
                />
                {errors.nit && <p className="text-sm text-red-500 mt-1">{errors.nit.message}</p>}
              </div>

              <div>
                <Label htmlFor="razon_social">Razón Social *</Label>
                <Input
                  id="razon_social"
                  placeholder="EMPRESA XYZ S.A.S."
                  {...register('razon_social')}
                  className={errors.razon_social ? 'border-red-500' : ''}
                />
                {errors.razon_social && <p className="text-sm text-red-500 mt-1">{errors.razon_social.message}</p>}
              </div>

              <div>
                <Label htmlFor="direccion">Dirección *</Label>
                <Textarea
                  id="direccion"
                  placeholder="Calle 123 # 45-67"
                  {...register('direccion')}
                  className={errors.direccion ? 'border-red-500' : ''}
                  rows={2}
                />
                {errors.direccion && <p className="text-sm text-red-500 mt-1">{errors.direccion.message}</p>}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="departamento">Departamento *</Label>
                  <Select
                    id="departamento"
                    {...register('departamento')}
                    className={errors.departamento ? 'border-red-500' : ''}
                  >
                    <option value="">Selecciona un departamento</option>
                    {DEPARTAMENTOS_COLOMBIA.map((dep) => (
                      <option key={dep} value={dep}>
                        {dep}
                      </option>
                    ))}
                  </Select>
                  {errors.departamento && <p className="text-sm text-red-500 mt-1">{errors.departamento.message}</p>}
                </div>

                <div>
                  <Label htmlFor="ciudad">Ciudad *</Label>
                  <Input
                    id="ciudad"
                    placeholder="Bogotá"
                    {...register('ciudad')}
                    className={errors.ciudad ? 'border-red-500' : ''}
                  />
                  {errors.ciudad && <p className="text-sm text-red-500 mt-1">{errors.ciudad.message}</p>}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="actividad_economica">Actividad Económica *</Label>
                  <Input
                    id="actividad_economica"
                    placeholder="Desarrollo de software"
                    {...register('actividad_economica')}
                    className={errors.actividad_economica ? 'border-red-500' : ''}
                  />
                  {errors.actividad_economica && <p className="text-sm text-red-500 mt-1">{errors.actividad_economica.message}</p>}
                </div>

                <div>
                  <Label htmlFor="codigo_ciiu">Código CIIU *</Label>
                  <Input
                    id="codigo_ciiu"
                    placeholder="6201"
                    {...register('codigo_ciiu')}
                    className={errors.codigo_ciiu ? 'border-red-500' : ''}
                  />
                  {errors.codigo_ciiu && <p className="text-sm text-red-500 mt-1">{errors.codigo_ciiu.message}</p>}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Representante Legal</CardTitle>
              <CardDescription>Información del representante legal de la empresa</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="representante_legal_nombre">Nombre Completo *</Label>
                <Input
                  id="representante_legal_nombre"
                  placeholder="Juan Pérez García"
                  {...register('representante_legal_nombre')}
                  className={errors.representante_legal_nombre ? 'border-red-500' : ''}
                />
                {errors.representante_legal_nombre && <p className="text-sm text-red-500 mt-1">{errors.representante_legal_nombre.message}</p>}
              </div>

              <div>
                <Label htmlFor="representante_legal_cedula">Número de Cédula *</Label>
                <Input
                  id="representante_legal_cedula"
                  placeholder="1234567890"
                  {...register('representante_legal_cedula')}
                  className={errors.representante_legal_cedula ? 'border-red-500' : ''}
                />
                {errors.representante_legal_cedula && <p className="text-sm text-red-500 mt-1">{errors.representante_legal_cedula.message}</p>}
              </div>

              <div>
                <Label htmlFor="representante_legal_email">Email *</Label>
                <Input
                  id="representante_legal_email"
                  type="email"
                  placeholder="juan@empresa.com"
                  {...register('representante_legal_email')}
                  className={errors.representante_legal_email ? 'border-red-500' : ''}
                />
                {errors.representante_legal_email && <p className="text-sm text-red-500 mt-1">{errors.representante_legal_email.message}</p>}
              </div>

              <div>
                <Label htmlFor="representante_legal_telefono">Teléfono *</Label>
                <Input
                  id="representante_legal_telefono"
                  type="tel"
                  placeholder="+573001234567"
                  {...register('representante_legal_telefono')}
                  className={errors.representante_legal_telefono ? 'border-red-500' : ''}
                />
                {errors.representante_legal_telefono && <p className="text-sm text-red-500 mt-1">{errors.representante_legal_telefono.message}</p>}
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-4">
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? 'Guardando...' : 'Guardar y continuar'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
