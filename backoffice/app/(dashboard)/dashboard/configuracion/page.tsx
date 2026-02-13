import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export const dynamic = 'force-dynamic'

export default function ConfiguracionPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Configuracion</h1>
        <p className="text-muted-foreground">Ajustes del backoffice (en construccion)</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Proximo</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Aqui vamos a centralizar variables operativas, estados, plantillas de email, etc.
        </CardContent>
      </Card>
    </div>
  )
}

