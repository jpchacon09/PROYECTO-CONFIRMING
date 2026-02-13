# Back Office - Confirming Platam

Referencia operativa obligatoria: `../FRONTEND_OPERATIVO.md`

Panel de administración para la gestión del onboarding de empresas pagadoras.

## 🚀 Stack Tecnológico

- **Framework:** Next.js 14 (App Router)
- **Lenguaje:** TypeScript
- **Estilos:** Tailwind CSS
- **Componentes:** shadcn/ui + Radix UI
- **Base de datos:** Supabase (PostgreSQL)
- **Autenticación:** Supabase Auth
- **Storage:** AWS S3 (via presigned URLs)

## 📁 Estructura del Proyecto

```
backoffice/
├── app/
│   ├── (auth)/
│   │   ├── login/          # Página de login
│   │   └── auth/callback/  # OAuth callback
│   ├── (dashboard)/
│   │   ├── dashboard/      # Dashboard principal
│   │   └── layout.tsx      # Layout con Sidebar + Header
│   ├── globals.css         # Estilos globales
│   └── layout.tsx          # Root layout
│
├── components/
│   ├── ui/                 # Componentes shadcn/ui
│   ├── layout/             # Sidebar, Header
│   ├── empresas/           # Componentes de empresas
│   ├── detalle-empresa/    # Componentes de detalle
│   └── shared/             # Componentes compartidos
│
├── lib/
│   ├── supabase/           # Clientes de Supabase
│   ├── aws/                # Cliente S3
│   ├── utils/              # Utilidades
│   └── types/              # Tipos TypeScript
│
├── hooks/                  # Custom React hooks
├── constants/              # Constantes (estados, documentos)
└── middleware.ts           # Middleware de autenticación
```

## 🔑 Variables de Entorno

Copia `.env.example` a `.env.local` y configura:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<SUPABASE_ANON_KEY>
SUPABASE_SERVICE_KEY=<SUPABASE_SERVICE_ROLE_KEY>

# AWS S3
AWS_ACCESS_KEY_ID=<AWS_ACCESS_KEY_ID>
AWS_SECRET_ACCESS_KEY=<AWS_SECRET_ACCESS_KEY>
AWS_REGION=us-east-1
AWS_S3_BUCKET=bucketn8n-platam

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## 🏗️ Instalación

```bash
# Instalar dependencias
npm install

# Ejecutar en desarrollo
npm run dev

# Build para producción
npm run build

# Iniciar en producción
npm start
```

## 🔐 Autenticación

Solo usuarios con `rol = 'admin'` en la tabla `usuarios` pueden acceder.

El middleware verifica:
1. ✅ Usuario autenticado
2. ✅ Registro en tabla `usuarios`
3. ✅ Rol = 'admin'

Si alguna validación falla → redirect a `/login`

## 📊 Estados del Onboarding

Según `CONTRATO.md`:

- `pendiente` → Recién registrada
- `en_revision` → En proceso de revisión
- `documentos_incompletos` → Faltan documentos
- `aprobado` → Onboarding completado ✅
- `rechazado` → Solicitud rechazada ❌

## 🧪 Datos de Prueba (Mock)

Mientras no estén las credenciales de Supabase, el dashboard usa datos mock en `lib/mock-data.ts`.

Una vez conectado a Supabase, reemplazar las llamadas mock por:

```typescript
// Antes (mock)
import { mockEmpresas } from '@/lib/mock-data'

// Después (Supabase)
const { data: empresas } = await supabase
  .from('empresas_pagadoras')
  .select('*')
  .order('created_at', { ascending: false })
```

## 🔗 Integración con Backend

Ver `COORDINACION_FRONTEND_BACKEND.md` en la raíz del proyecto.

**Endpoints del backend que consume:**
- ✅ `PATCH /api/admin/empresas/[id]/estado` - Cambiar estado
- ⏳ `GET /api/documentos/:id/url` - Obtener presigned URL
- ⏳ `GET /api/empresas/:id/documentos` - Listar documentos
- ⏳ `GET /api/empresas/:id/historial` - Historial de estados

**Edge Functions de Supabase:**
- ✅ `generar-url-subida` - Para subir documentos
- ✅ `obtener-url-documento` - Para visualizar documentos

## 📋 Funcionalidades

### ✅ Implementadas
- [x] Login con Google OAuth y email/password
- [x] Middleware de autenticación (solo admins)
- [x] Dashboard con estadísticas
- [x] Lista de empresas con filtros por estado
- [x] Layout con Sidebar + Header
- [x] Componentes UI base (shadcn/ui)

### 🚧 En Progreso
- [ ] Vista detalle de empresa
- [ ] Visor de documentos PDF
- [ ] Panel de comentarios internos
- [ ] Timeline de historial de estados
- [ ] Acciones de admin (aprobar/rechazar)
- [ ] Integración con Supabase real

### 📝 Por Hacer
- [ ] Paginación de empresas
- [ ] Búsqueda avanzada
- [ ] Notificaciones en tiempo real
- [ ] Export a Excel/PDF
- [ ] Métricas y reportes

## 🎨 Componentes de UI

Basados en shadcn/ui:

- `Button` - Botones con variantes
- `Card` - Tarjetas con header/content/footer
- `Badge` - Etiquetas de estado
- `Input` - Inputs de formulario
- `Textarea` - Text areas
- `Label` - Labels de formulario
- `Separator` - Separadores

## 📞 Coordinación con Backend

**Estado actual:**
- ✅ Backend tiene Edge Functions listas
- ✅ Backend tiene algunos API routes
- ⏳ Falta ejecutar schema en Supabase
- ⏳ Falta desplegar Edge Functions
- ⏳ Falta configurar credenciales

Ver archivo `COORDINACION_FRONTEND_BACKEND.md` para más detalles.

## 🐛 Troubleshooting

### Error: "Cannot find module @supabase/ssr"
```bash
npm install @supabase/ssr
```

### Error: Middleware loop infinito
Verifica que el middleware no redirija a la misma ruta.

### Error: RLS policies impiden SELECT
Verifica que tu usuario tenga rol 'admin' en tabla `usuarios`.

## 📚 Documentación Relacionada

- [CONTRATO.md](../CONTRATO.md) - Contrato backend-frontend
- [PLAN_ARQUITECTURA_CAPA_1.md](../PLAN_ARQUITECTURA_CAPA_1.md) - Plan general
- [COORDINACION_FRONTEND_BACKEND.md](../COORDINACION_FRONTEND_BACKEND.md) - Estado de coordinación

---

**Desarrollado con ❤️ por Claude Code (Terminal 2 - Frontend)**
