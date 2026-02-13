import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import type { User } from '@supabase/supabase-js'
import { AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Textarea } from '@/components/ui/Textarea'
import { Select } from '@/components/ui/Select'
import { DEPARTAMENTOS_COLOMBIA } from '@/constants/estados'
import { toast } from 'sonner'
import { getErrorMessage } from '@/lib/errors'
import { TypeformStep } from '@/components/typeform/TypeformStep'
import { TypeformProgress } from '@/components/typeform/TypeformProgress'
import { TypeformNavigation } from '@/components/typeform/TypeformNavigation'
import { useTypeformNavigation } from '@/hooks/useTypeformNavigation'

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

type StepConfig = { fields: (keyof EmpresaFormData)[] }

const STEPS: StepConfig[] = [
  { fields: ['nit'] },
  { fields: ['razon_social'] },
  { fields: ['direccion'] },
  { fields: ['departamento', 'ciudad'] },
  { fields: ['actividad_economica', 'codigo_ciiu'] },
  { fields: ['representante_legal_nombre'] },
  { fields: ['representante_legal_cedula'] },
  { fields: ['representante_legal_email'] },
  { fields: ['representante_legal_telefono'] },
]

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
    trigger,
    formState: { errors },
  } = useForm<EmpresaFormData>({
    resolver: zodResolver(empresaSchema),
    defaultValues: {
      representante_legal_telefono: '+57',
    },
  })

  const {
    currentStep,
    goToNext,
    goToPrev,
    isFirstStep,
    isLastStep,
    totalSteps,
  } = useTypeformNavigation(STEPS, trigger)

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
          ip_registro: null,
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
    <div className="min-h-screen bg-background">
      <TypeformProgress current={currentStep + 1} total={totalSteps} />

      <form onSubmit={handleSubmit(onSubmit)}>
        <AnimatePresence mode="wait">
          {currentStep === 0 && (
            <TypeformStep key="nit" stepNumber={1} totalSteps={totalSteps}>
              <Label variant="typeform" htmlFor="nit">
                ¿Cuál es el NIT de tu empresa?
              </Label>
              <Input
                variant="typeform"
                id="nit"
                placeholder="900123456-7"
                {...register('nit')}
                autoFocus
              />
              {errors.nit && <p className="typeform-error">{errors.nit.message}</p>}
              <p className="typeform-hint">Formato: XXXXXXXXX-X</p>
            </TypeformStep>
          )}

          {currentStep === 1 && (
            <TypeformStep key="razon_social" stepNumber={2} totalSteps={totalSteps}>
              <Label variant="typeform" htmlFor="razon_social">
                ¿Cuál es la razón social?
              </Label>
              <Input
                variant="typeform"
                id="razon_social"
                placeholder="EMPRESA XYZ S.A.S."
                {...register('razon_social')}
                autoFocus
              />
              {errors.razon_social && (
                <p className="typeform-error">{errors.razon_social.message}</p>
              )}
            </TypeformStep>
          )}

          {currentStep === 2 && (
            <TypeformStep key="direccion" stepNumber={3} totalSteps={totalSteps}>
              <Label variant="typeform" htmlFor="direccion">
                ¿Cuál es la dirección de la empresa?
              </Label>
              <Textarea
                variant="typeform"
                id="direccion"
                placeholder="Calle 123 # 45-67"
                {...register('direccion')}
                rows={2}
                autoFocus
              />
              {errors.direccion && (
                <p className="typeform-error">{errors.direccion.message}</p>
              )}
            </TypeformStep>
          )}

          {currentStep === 3 && (
            <TypeformStep key="ubicacion" stepNumber={4} totalSteps={totalSteps}>
              <Label variant="typeform">
                ¿Dónde está ubicada tu empresa?
              </Label>
              <div className="space-y-6 mt-2">
                <div>
                  <span className="typeform-sublabel">Departamento</span>
                  <Select
                    variant="typeform"
                    id="departamento"
                    {...register('departamento')}
                    autoFocus
                  >
                    <option value="">Selecciona un departamento</option>
                    {DEPARTAMENTOS_COLOMBIA.map((dep) => (
                      <option key={dep} value={dep}>
                        {dep}
                      </option>
                    ))}
                  </Select>
                  {errors.departamento && (
                    <p className="typeform-error">{errors.departamento.message}</p>
                  )}
                </div>
                <div>
                  <span className="typeform-sublabel">Ciudad</span>
                  <Input
                    variant="typeform"
                    id="ciudad"
                    placeholder="Bogotá"
                    {...register('ciudad')}
                  />
                  {errors.ciudad && (
                    <p className="typeform-error">{errors.ciudad.message}</p>
                  )}
                </div>
              </div>
            </TypeformStep>
          )}

          {currentStep === 4 && (
            <TypeformStep key="actividad" stepNumber={5} totalSteps={totalSteps}>
              <Label variant="typeform">
                ¿A qué se dedica tu empresa?
              </Label>
              <div className="space-y-6 mt-2">
                <div>
                  <span className="typeform-sublabel">Actividad Económica</span>
                  <Input
                    variant="typeform"
                    id="actividad_economica"
                    placeholder="Desarrollo de software"
                    {...register('actividad_economica')}
                    autoFocus
                  />
                  {errors.actividad_economica && (
                    <p className="typeform-error">{errors.actividad_economica.message}</p>
                  )}
                </div>
                <div>
                  <span className="typeform-sublabel">Código CIIU</span>
                  <Input
                    variant="typeform"
                    id="codigo_ciiu"
                    placeholder="6201"
                    {...register('codigo_ciiu')}
                  />
                  {errors.codigo_ciiu && (
                    <p className="typeform-error">{errors.codigo_ciiu.message}</p>
                  )}
                </div>
              </div>
            </TypeformStep>
          )}

          {currentStep === 5 && (
            <TypeformStep key="rep_nombre" stepNumber={6} totalSteps={totalSteps}>
              <Label variant="typeform" htmlFor="representante_legal_nombre">
                ¿Cómo se llama el representante legal?
              </Label>
              <Input
                variant="typeform"
                id="representante_legal_nombre"
                placeholder="Juan Pérez García"
                {...register('representante_legal_nombre')}
                autoFocus
              />
              {errors.representante_legal_nombre && (
                <p className="typeform-error">{errors.representante_legal_nombre.message}</p>
              )}
            </TypeformStep>
          )}

          {currentStep === 6 && (
            <TypeformStep key="rep_cedula" stepNumber={7} totalSteps={totalSteps}>
              <Label variant="typeform" htmlFor="representante_legal_cedula">
                ¿Cuál es la cédula del representante legal?
              </Label>
              <Input
                variant="typeform"
                id="representante_legal_cedula"
                placeholder="1234567890"
                {...register('representante_legal_cedula')}
                autoFocus
              />
              {errors.representante_legal_cedula && (
                <p className="typeform-error">{errors.representante_legal_cedula.message}</p>
              )}
            </TypeformStep>
          )}

          {currentStep === 7 && (
            <TypeformStep key="rep_email" stepNumber={8} totalSteps={totalSteps}>
              <Label variant="typeform" htmlFor="representante_legal_email">
                ¿Cuál es el email del representante legal?
              </Label>
              <Input
                variant="typeform"
                id="representante_legal_email"
                type="email"
                placeholder="juan@empresa.com"
                {...register('representante_legal_email')}
                autoFocus
              />
              {errors.representante_legal_email && (
                <p className="typeform-error">{errors.representante_legal_email.message}</p>
              )}
            </TypeformStep>
          )}

          {currentStep === 8 && (
            <TypeformStep key="rep_telefono" stepNumber={9} totalSteps={totalSteps}>
              <Label variant="typeform" htmlFor="representante_legal_telefono">
                ¿Cuál es el teléfono del representante legal?
              </Label>
              <Input
                variant="typeform"
                id="representante_legal_telefono"
                type="tel"
                placeholder="+573001234567"
                {...register('representante_legal_telefono')}
                autoFocus
              />
              {errors.representante_legal_telefono && (
                <p className="typeform-error">{errors.representante_legal_telefono.message}</p>
              )}
              <p className="typeform-hint">Formato: +57XXXXXXXXXX</p>
            </TypeformStep>
          )}
        </AnimatePresence>

        <TypeformNavigation
          onPrev={goToPrev}
          onNext={() => void goToNext()}
          canGoPrev={!isFirstStep}
          canGoNext={!isLastStep}
          showSubmit={isLastStep}
          submitLabel={loading ? 'Guardando...' : 'Guardar y continuar'}
          loading={loading}
        />
      </form>
    </div>
  )
}
