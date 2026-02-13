import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export const dynamic = 'force-dynamic'

export default function UsuariosPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Usuarios</h1>
        <p className="text-muted-foreground">Administracion de usuarios (en construccion)</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Proximo</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Aqui vamos a ver roles (admin/pagador/proveedor) y gestion basica.
        </CardContent>
      </Card>
    </div>
  )
}

