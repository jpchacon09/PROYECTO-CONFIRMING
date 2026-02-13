import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export const dynamic = 'force-dynamic'

export default function DocumentosPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Documentos</h1>
        <p className="text-muted-foreground">Vista global de documentos (en construccion)</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Proximo</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Aqui vamos a listar documentos por empresa, filtros, y accesos rapidos al visor.
          Por ahora usa el detalle de empresa para ver documentos.
        </CardContent>
      </Card>
    </div>
  )
}

