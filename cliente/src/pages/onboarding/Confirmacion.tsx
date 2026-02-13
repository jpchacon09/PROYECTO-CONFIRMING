import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { Check } from 'lucide-react'

export function Confirmacion() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-4">
      <Card className="max-w-2xl w-full">
        <CardContent className="pt-12 pb-8 text-center">
          <div className="mx-auto w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mb-6">
            <Check className="h-10 w-10 text-white" />
          </div>

          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            ¡Solicitud enviada correctamente!
          </h1>

          <div className="max-w-lg mx-auto space-y-4 text-gray-600 mb-8">
            <p>Hemos recibido tu solicitud de onboarding.</p>
            <p>
              Nuestro equipo revisará la información y los documentos que subiste.
              Te notificaremos por email cuando haya novedades sobre tu solicitud.
            </p>
            <p className="text-sm">
              <strong>Tiempo estimado de revisión:</strong> 2 a 3 días hábiles
            </p>
          </div>

          <Button onClick={() => navigate('/dashboard')} size="lg">
            Ir a mi panel
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
