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

function computeNitDv(nitBase: string): number {
  // Colombian NIT check digit (DV). For 9 digits, factors are:
  // 41, 37, 29, 23, 19, 17, 13, 7, 3 (left to right).
  const digits = nitBase.replace(/\D/g, '')
  if (digits.length !== 9) return NaN
  const factors = [41, 37, 29, 23, 19, 17, 13, 7, 3]
  let sum = 0
  for (let i = 0; i < 9; i += 1) sum += Number(digits[i]) * factors[i]
  const mod = sum % 11
  return mod > 1 ? 11 - mod : mod
}

function formatNitWithDv(nitBase: string): string {
  const digits = nitBase.replace(/\D/g, '')
  const dv = computeNitDv(digits)
  if (!Number.isFinite(dv)) return digits
  return `${digits}-${dv}`
}

// Schema de validación
const empresaSchema = z.object({
  nit: z.string().regex(/^\d{9}$/, {
    message: 'El NIT debe tener 9 dígitos (sin dígito de verificación)',
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
  representante_legal_tipo_documento: z.enum(['CC', 'CE']),
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
  { fields: ['representante_legal_tipo_documento', 'representante_legal_cedula'] },
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
    watch,
    formState: { errors },
  } = useForm<EmpresaFormData>({
    resolver: zodResolver(empresaSchema),
    defaultValues: {
      representante_legal_telefono: '+57',
      representante_legal_tipo_documento: 'CC',
    },
  })

  const nitBaseValue = watch('nit')
  const nitFullPreview = nitBaseValue ? formatNitWithDv(nitBaseValue) : ''

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

      const nitFull = formatNitWithDv(values.nit)

      const { data: inserted, error } = await supabase
        .from('empresas_pagadoras')
        .insert({
          usuario_id: user.id,
          ...values,
          nit: nitFull,
          ip_registro: null,
          user_agent: navigator.userAgent,
        })
        .select('id')
        .single()

      if (error) {
        if (error.code === '23505') {
          toast.error('Ya existe una empresa registrada con este NIT')
        } else {
          toast.error('Error al guardar los datos: ' + error.message)
        }
        return
      }

      // Validacion SARLAFT (server-side via Edge Function para evitar CORS).
      // No bloqueamos el flujo si falla: solo agrega valor al backoffice y al risk check.
      const empresaId = inserted?.id
      if (empresaId) {
        toast.message('Validando SARLAFT...', {
          description: 'Esto no detiene el proceso si falla temporalmente.',
        })

        void (async () => {
          const checks = [
            {
              scope: 'empresa',
              nombres: values.razon_social,
              documento: values.nit, // NIT sin DV
              tipo_documento: 'NIT',
            },
            {
              scope: 'representante',
              nombres: values.representante_legal_nombre,
              documento: values.representante_legal_cedula,
              tipo_documento: values.representante_legal_tipo_documento,
            },
          ]

          const results = await Promise.allSettled(
            checks.map((c) =>
              supabase.functions.invoke('validar-sarlaft', {
                body: {
                  empresa_id: empresaId,
                  ...c,
                  user_id: 'agentrobust',
                  ip_address: '',
                  force_refresh: false,
                },
              })
            )
          )

          const ok = results.some(
            (r) =>
              r.status === 'fulfilled' &&
              !r.value.error &&
              (r.value.data as any)?.success === true
          )

          if (ok) {
            toast.success('SARLAFT validado', {
              description: 'Resultado disponible para el equipo en backoffice.',
            })
          } else {
            toast.warning('No se pudo validar SARLAFT ahora', {
              description: 'Puedes continuar. Se puede reintentar luego desde backoffice.',
            })
          }
        })()
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
                placeholder="900123456"
                {...register('nit')}
                autoFocus
              />
              {errors.nit && <p className="typeform-error">{errors.nit.message}</p>}
              <p className="typeform-hint">
                9 dígitos sin DV. DV calculado automáticamente: <strong>{nitFullPreview || '...'}</strong>
              </p>
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
              <Label variant="typeform">
                Documento del representante legal
              </Label>
              <div className="space-y-6 mt-2">
                <div>
                  <span className="typeform-sublabel">Tipo</span>
                  <Select
                    variant="typeform"
                    id="representante_legal_tipo_documento"
                    {...register('representante_legal_tipo_documento')}
                    autoFocus
                  >
                    <option value="CC">CC</option>
                    <option value="CE">CE</option>
                  </Select>
                  {errors.representante_legal_tipo_documento && (
                    <p className="typeform-error">{errors.representante_legal_tipo_documento.message}</p>
                  )}
                </div>

                <div>
                  <span className="typeform-sublabel">Número</span>
                  <Input
                    variant="typeform"
                    id="representante_legal_cedula"
                    placeholder="1234567890"
                    {...register('representante_legal_cedula')}
                  />
                  {errors.representante_legal_cedula && (
                    <p className="typeform-error">{errors.representante_legal_cedula.message}</p>
                  )}
                </div>
              </div>
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
