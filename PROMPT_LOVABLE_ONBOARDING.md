# PROMPT PARA LOVABLE - FRONTEND ONBOARDING PAGADORES

**Copiar y pegar este prompt completo en Lovable sin modificaciones**

---

# Plataforma de Confirming - Frontend Onboarding de Pagadores

Construye una aplicación web moderna para el onboarding digital de empresas pagadoras en una plataforma de confirming en Colombia. El usuario (representante legal de la empresa) debe poder registrarse, completar un formulario con los datos de su empresa, subir documentos requeridos, y hacer seguimiento del estado de su solicitud.

## Stack Técnico Obligatorio

- **Framework:** React con TypeScript
- **Routing:** React Router v6
- **Styling:** Tailwind CSS con diseño moderno y limpio
- **Base de datos y Auth:** Supabase (PostgreSQL + Auth)
- **Storage de documentos:** AWS S3 (via presigned URLs desde Supabase Edge Function)
- **Validación de formularios:** React Hook Form + Zod
- **UI Components:** shadcn/ui o componentes custom con Tailwind
- **Iconos:** Lucide React
- **Toasts/Notificaciones:** Sonner o react-hot-toast

## Configuración de Supabase

### Variables de entorno necesarias:
```
VITE_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Inicializar cliente Supabase:
```typescript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)
```

## Estructura de Datos (Supabase)

### Tabla: `usuarios`
```typescript
interface Usuario {
  id: string; // UUID (coincide con auth.users.id)
  rol: 'pagador' | 'proveedor' | 'admin';
  created_at: string;
  updated_at: string;
}
```

**Permisos:**
- SELECT: Usuario puede ver solo su propio registro
- INSERT: Permitido al crear cuenta
- UPDATE: Solo su propio registro

### Tabla: `empresas_pagadoras`
```typescript
interface EmpresaPagadora {
  id: string; // UUID (auto-generado)
  usuario_id: string; // UUID del usuario autenticado

  // Datos básicos de la empresa
  nit: string; // REQUERIDO - Formato: "XXXXXXXXX-X" (ej: "900123456-7")
  razon_social: string; // REQUERIDO
  direccion: string; // REQUERIDO
  ciudad: string; // REQUERIDO
  departamento: string; // REQUERIDO
  actividad_economica: string; // REQUERIDO
  codigo_ciiu: string; // REQUERIDO

  // Datos del representante legal
  representante_legal_nombre: string; // REQUERIDO
  representante_legal_cedula: string; // REQUERIDO
  representante_legal_email: string; // REQUERIDO
  representante_legal_telefono: string; // REQUERIDO - Formato: "+573001234567"

  // Estado del onboarding
  estado: 'pendiente' | 'en_revision' | 'documentos_incompletos' | 'aprobado' | 'rechazado';
  estado_anterior: string | null;
  fecha_cambio_estado: string | null;

  // Metadatos (auto-completados)
  created_at: string;
  updated_at: string;
  aprobado_por: string | null;
  fecha_aprobacion: string | null;

  // Auditoría (opcionales)
  ip_registro: string | null;
  user_agent: string | null;
}
```

**Permisos:**
- SELECT: Usuario ve solo su empresa
- INSERT: Puede crear 1 empresa asociada a su usuario
- UPDATE: Solo si estado es 'pendiente' o 'documentos_incompletos'
- DELETE: No permitido

**Validaciones obligatorias en frontend:**
- NIT: Regex `/^\d{9}-\d{1}$/` (9 dígitos + guión + 1 dígito verificador)
- Email: Validación estándar
- Teléfono: Formato `+57` seguido de 10 dígitos
- Todos los campos marcados como REQUERIDO deben tener valor

### Tabla: `documentos`
```typescript
interface Documento {
  id: string; // UUID (auto-generado por Edge Function)
  empresa_id: string;

  tipo_documento:
    | 'camara_comercio'
    | 'registro_accionistas'
    | 'rut'
    | 'cedula_representante_legal'
    | 'declaracion_renta'
    | 'estados_financieros'
    | 'otro';

  s3_bucket: string;
  s3_key: string;
  nombre_original: string;
  mime_type: string;
  tamano_bytes: number;

  extraccion_completa: boolean; // true cuando Document AI termina
  extraccion_data: any | null; // JSON raw de Document AI
  extraccion_resumen: any | null; // Campos clave extraídos
  extraccion_confianza: number | null; // 0.00 a 1.00
  extraccion_fecha: string | null;

  subido_por: string; // UUID del usuario
  created_at: string;
  updated_at: string;

  es_version_actual: boolean;
  reemplaza_a: string | null;
}
```

**Permisos:**
- SELECT: Usuario ve documentos de su empresa
- INSERT: **NO DIRECTAMENTE** - Usar Edge Function
- UPDATE/DELETE: No permitido

**Tipos de archivo soportados:**
- PDF: `application/pdf`
- Imágenes: `image/jpeg`, `image/png`, `image/jpg`
- Tamaño máximo: 10 MB (10485760 bytes)

### Tabla: `historial_estados`
```typescript
interface HistorialEstado {
  id: string;
  empresa_id: string;
  estado_anterior: string | null;
  estado_nuevo: string;
  cambiado_por: string | null;
  motivo: string | null;
  created_at: string;
}
```

**Permisos:**
- SELECT: Usuario ve historial de su empresa
- INSERT/UPDATE/DELETE: No permitido (automático via trigger)

## Flujo de Subida de Documentos (IMPORTANTE)

**NO subir archivos directamente a Supabase Storage.** Usar el siguiente flujo:

### Paso 1: Llamar Edge Function para obtener presigned URL
```typescript
const { data, error } = await supabase.functions.invoke('generar-url-subida', {
  body: {
    empresa_id: empresaId,
    tipo_documento: 'rut', // uno de los tipos válidos
    nombre_archivo: file.name,
    mime_type: file.type,
    tamano_bytes: file.size
  }
})

if (error) {
  console.error('Error al generar URL:', error)
  return
}

// data contiene:
// {
//   presigned_url: "https://s3.amazonaws.com/...",
//   s3_bucket: "confirming-documentos-prod",
//   s3_key: "pagadores/900123456-7/rut/20260212_a3f2b1c4_rut.pdf",
//   documento_id: "uuid-del-registro-creado"
// }
```

### Paso 2: Subir archivo a S3 usando presigned URL
```typescript
const uploadResponse = await fetch(data.presigned_url, {
  method: 'PUT',
  body: file,
  headers: {
    'Content-Type': file.type
  }
})

if (uploadResponse.ok) {
  console.log('Documento subido exitosamente con ID:', data.documento_id)
  // Mostrar toast de éxito
  // El registro en tabla 'documentos' ya fue creado por la Edge Function
}
```

## Estados de la Empresa

| Estado | Descripción | Acciones del usuario |
|--------|-------------|---------------------|
| `pendiente` | Solicitud recibida, esperando revisión | Solo lectura |
| `en_revision` | Equipo interno está revisando | Solo lectura |
| `documentos_incompletos` | Faltan documentos o hay errores | Puede actualizar datos y subir documentos |
| `aprobado` | Onboarding completado exitosamente | Acceso completo a la plataforma |
| `rechazado` | Solicitud rechazada | Solo lectura, sin acciones |

**Flujo normal:** pendiente → en_revision → aprobado

**Flujo con errores:** pendiente → en_revision → documentos_incompletos → en_revision → aprobado

## Estructura de Páginas y Rutas

### 1. `/` - Landing Page (opcional, puede redirigir a /login)
- Mensaje de bienvenida a la plataforma
- Botón "Iniciar Solicitud" → redirige a `/login`
- Diseño atractivo con gradientes modernos

### 2. `/login` - Autenticación
Pantalla de login con opciones:
- **Botón "Continuar con Google"** (OAuth)
- **Botón "Continuar con Apple"** (OAuth)
- **Divisor "o"**
- **Input de email + botón "Enviar enlace mágico"** (Magic Link)

Después del login exitoso:
```typescript
// 1. Obtener usuario autenticado
const { data: { user } } = await supabase.auth.getUser()

// 2. Verificar si existe en tabla usuarios
const { data: usuario } = await supabase
  .from('usuarios')
  .select('*')
  .eq('id', user.id)
  .single()

// 3. Si no existe, crear con rol 'pagador'
if (!usuario) {
  await supabase
    .from('usuarios')
    .insert({ id: user.id, rol: 'pagador' })
}

// 4. Verificar si ya tiene una empresa registrada
const { data: empresa } = await supabase
  .from('empresas_pagadoras')
  .select('*')
  .eq('usuario_id', user.id)
  .single()

// 5. Redirigir según el caso
if (!empresa) {
  // Primera vez, ir a formulario
  navigate('/onboarding/datos-empresa')
} else if (empresa.estado === 'documentos_incompletos') {
  // Puede editar, ir a documentos
  navigate('/onboarding/documentos')
} else {
  // Ver estado de solicitud
  navigate('/dashboard')
}
```

### 3. `/onboarding/datos-empresa` - Formulario de Datos
Formulario con validación en tiempo real usando React Hook Form + Zod.

**Layout:**
- Título: "Datos de tu empresa"
- Subtítulo: "Paso 1 de 2 - Información básica"
- Progress bar: 50%

**Campos del formulario (todos obligatorios):**

**Sección: Datos de la Empresa**
- NIT (input text)
  - Placeholder: "900123456-7"
  - Validación: `/^\d{9}-\d{1}$/`
  - Mensaje error: "El NIT debe tener el formato XXXXXXXXX-X"

- Razón Social (input text)
  - Placeholder: "EMPRESA XYZ S.A.S."

- Dirección (textarea)
  - Placeholder: "Calle 123 # 45-67"

- Departamento (select)
  - Opciones: ["Cundinamarca", "Antioquia", "Valle del Cauca", "Atlántico", "Bolívar", "Santander", ...] (todos los departamentos de Colombia)

- Ciudad (input text)
  - Placeholder: "Bogotá"

- Actividad Económica (input text)
  - Placeholder: "Desarrollo de software"

- Código CIIU (input text)
  - Placeholder: "6201"
  - Validación: 4 dígitos

**Sección: Representante Legal**
- Nombre Completo (input text)
  - Placeholder: "Juan Pérez García"

- Número de Cédula (input text)
  - Placeholder: "1234567890"
  - Validación: solo números

- Email (input email)
  - Placeholder: "juan@empresa.com"
  - Validación: formato email válido

- Teléfono (input tel)
  - Placeholder: "+573001234567"
  - Validación: `/^\+57\d{10}$/`
  - Mensaje error: "El teléfono debe tener el formato +57XXXXXXXXXX"

**Botones:**
- "Guardar y continuar" (primario, azul)
- "Guardar borrador" (secundario, gris) - solo guarda sin avanzar

**Manejo de envío:**
```typescript
const onSubmit = async (values) => {
  const { data, error } = await supabase
    .from('empresas_pagadoras')
    .insert({
      usuario_id: user.id,
      nit: values.nit,
      razon_social: values.razon_social,
      direccion: values.direccion,
      ciudad: values.ciudad,
      departamento: values.departamento,
      actividad_economica: values.actividad_economica,
      codigo_ciiu: values.codigo_ciiu,
      representante_legal_nombre: values.representante_legal_nombre,
      representante_legal_cedula: values.representante_legal_cedula,
      representante_legal_email: values.representante_legal_email,
      representante_legal_telefono: values.representante_legal_telefono,
      // Opcionales
      ip_registro: clientIP, // obtener del navegador
      user_agent: navigator.userAgent
    })
    .select()
    .single()

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
}
```

### 4. `/onboarding/documentos` - Subida de Documentos
Pantalla para subir los 6 documentos requeridos.

**Layout:**
- Título: "Documentos requeridos"
- Subtítulo: "Paso 2 de 2 - Sube los documentos de tu empresa"
- Progress bar: 100%

**Lista de documentos (cards individuales):**

Cada documento debe tener un card con:
- Ícono del tipo de documento
- Nombre del documento
- Descripción de qué debe contener
- Estado: "Pendiente" | "Subiendo..." | "Completado"
- Botón "Subir" o checkmark si ya está subido

**Documentos requeridos:**

1. **Cámara de Comercio**
   - Descripción: "Certificado de existencia y representación legal vigente (máx 30 días)"
   - Formato: PDF
   - Tipo: `camara_comercio`

2. **Registro de Accionistas**
   - Descripción: "Composición accionaria actualizada"
   - Formato: PDF
   - Tipo: `registro_accionistas`

3. **RUT**
   - Descripción: "Registro Único Tributario actualizado"
   - Formato: PDF
   - Tipo: `rut`

4. **Cédula del Representante Legal**
   - Descripción: "Frente y reverso de la cédula (pueden ser 2 archivos o 1 PDF)"
   - Formato: JPG, PNG, PDF
   - Tipo: `cedula_representante_legal`

5. **Declaración de Renta**
   - Descripción: "Declaración del último año fiscal"
   - Formato: PDF
   - Tipo: `declaracion_renta`

6. **Estados Financieros**
   - Descripción: "Balance general y estado de resultados del último año"
   - Formato: PDF
   - Tipo: `estados_financieros`

**Componente de subida por documento:**
```typescript
const handleUpload = async (file: File, tipoDocumento: string) => {
  // 1. Validar tamaño
  if (file.size > 10485760) { // 10 MB
    toast.error('El archivo supera el tamaño máximo de 10 MB')
    return
  }

  // 2. Validar tipo MIME
  const tiposPermitidos = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg']
  if (!tiposPermitidos.includes(file.type)) {
    toast.error('Solo se permiten archivos PDF, JPG o PNG')
    return
  }

  // 3. Mostrar loading
  setUploadingDoc(tipoDocumento)

  try {
    // 4. Llamar Edge Function
    const { data, error } = await supabase.functions.invoke('generar-url-subida', {
      body: {
        empresa_id: empresaId,
        tipo_documento: tipoDocumento,
        nombre_archivo: file.name,
        mime_type: file.type,
        tamano_bytes: file.size
      }
    })

    if (error) throw error

    // 5. Subir a S3
    const uploadResponse = await fetch(data.presigned_url, {
      method: 'PUT',
      body: file,
      headers: {
        'Content-Type': file.type
      }
    })

    if (!uploadResponse.ok) throw new Error('Error al subir el archivo')

    // 6. Éxito
    toast.success('Documento subido correctamente')

    // 7. Refrescar lista de documentos
    await fetchDocumentos()

  } catch (error) {
    toast.error('Error al subir el documento: ' + error.message)
  } finally {
    setUploadingDoc(null)
  }
}
```

**Obtener lista de documentos subidos:**
```typescript
const fetchDocumentos = async () => {
  const { data, error } = await supabase
    .from('documentos')
    .select('id, tipo_documento, nombre_original, created_at, extraccion_completa')
    .eq('empresa_id', empresaId)
    .eq('es_version_actual', true)
    .order('created_at', { ascending: false })

  if (!error) {
    setDocumentos(data)
  }
}
```

**Botón final:**
- "Enviar solicitud" (deshabilitado hasta que se suban los 6 documentos)
- Al hacer clic, redirige a `/onboarding/confirmacion`

### 5. `/onboarding/confirmacion` - Confirmación de Envío
Pantalla de éxito después de enviar la solicitud.

**Contenido:**
- Ícono de checkmark grande (verde)
- Título: "¡Solicitud enviada correctamente!"
- Mensaje:
  ```
  Hemos recibido tu solicitud de onboarding.

  Nuestro equipo revisará la información y los documentos que subiste.
  Te notificaremos por email (representante_legal_email) cuando
  haya novedades sobre tu solicitud.

  Tiempo estimado de revisión: 2 a 3 días hábiles.
  ```
- Resumen de documentos subidos (lista con checkmarks)
- Botón: "Ir a mi panel" → redirige a `/dashboard`

### 6. `/dashboard` - Portal de Seguimiento
Dashboard personal del usuario para ver el estado de su solicitud.

**Layout:**
- Header con logo + nombre del usuario + botón "Cerrar sesión"
- Card principal con información de la empresa

**Card de Estado:**
- Badge de estado (coloreado según el estado actual):
  - `pendiente`: Amarillo
  - `en_revision`: Azul
  - `documentos_incompletos`: Naranja
  - `aprobado`: Verde
  - `rechazado`: Rojo

- Título: Razón social de la empresa
- Subtítulo: NIT

**Secciones:**

**1. Estado Actual**
- Badge + texto descriptivo del estado
- Fecha de creación de la solicitud
- Última actualización

**2. Documentos Subidos**
- Lista de documentos con:
  - Nombre del documento
  - Fecha de subida
  - Badge: "Procesado" si `extraccion_completa = true`, "Procesando..." si false

**3. Historial de Estados** (Timeline)
Obtener de tabla `historial_estados`:
```typescript
const { data: historial } = await supabase
  .from('historial_estados')
  .select('*')
  .eq('empresa_id', empresaId)
  .order('created_at', { ascending: false })
```

Mostrar como timeline vertical:
- Cada evento con fecha, estado anterior → estado nuevo, y motivo (si existe)

**4. Acciones según estado:**

**Si estado = `documentos_incompletos`:**
- Botón: "Actualizar documentos" → redirige a `/onboarding/documentos`
- Mensaje: Mostrar el motivo del cambio de estado (si existe en historial)

**Si estado = `aprobado`:**
- Botón: "Acceder a la plataforma" → redirige a app principal (fuera de scope)
- Mensaje de felicitación

**Si estado = `rechazado`:**
- Mostrar motivo del rechazo
- Email de contacto para más información

### 7. `/auth/callback` - Callback OAuth
Ruta para manejar el callback de Google/Apple OAuth.

```typescript
useEffect(() => {
  const handleCallback = async () => {
    const { data: { session }, error } = await supabase.auth.getSession()

    if (error) {
      toast.error('Error al autenticar')
      navigate('/login')
      return
    }

    if (session) {
      // Verificar/crear usuario en tabla usuarios
      // (mismo flujo que en /login)
      // Luego redirigir según estado de empresa
    }
  }

  handleCallback()
}, [])
```

## Diseño y UX

### Paleta de colores sugerida:
- **Primary:** Azul moderno (#2563EB)
- **Success:** Verde (#10B981)
- **Warning:** Naranja (#F59E0B)
- **Error:** Rojo (#EF4444)
- **Neutral:** Gris (#6B7280)

### Tipografía:
- **Títulos:** Font-bold, text-2xl o 3xl
- **Subtítulos:** Font-medium, text-lg
- **Body:** Font-normal, text-base
- **Labels:** Font-medium, text-sm

### Componentes clave:
- **Cards:** Bordes redondeados (rounded-lg), sombras sutiles (shadow-md)
- **Botones:** Redondeados (rounded-md), hover states, estados disabled
- **Inputs:** Bordes definidos, focus states con ring azul
- **Toasts:** Posición top-right, auto-dismiss en 3s
- **Progress bar:** Linear, muestra % del onboarding completado

### Responsive:
- Mobile-first
- Breakpoints: sm (640px), md (768px), lg (1024px)
- En mobile: formularios apilados verticalmente, cards full-width

### Loading states:
- Skeleton loaders para datos que se cargan de Supabase
- Spinners para acciones async (subida de archivos)
- Deshabilitar botones durante operaciones async

### Error handling:
- Validación inline en formularios (mostrar error debajo del campo)
- Toasts para errores globales (ej: error de red)
- Página 404 para rutas no encontradas
- Mensajes de error amigables en español colombiano

## Validaciones y Reglas de Negocio

### NIT Colombiano:
```typescript
const nitSchema = z.string().regex(/^\d{9}-\d{1}$/, {
  message: "El NIT debe tener el formato XXXXXXXXX-X (ej: 900123456-7)"
})
```

### Email:
```typescript
const emailSchema = z.string().email({
  message: "Ingresa un email válido"
})
```

### Teléfono Colombiano:
```typescript
const telefonoSchema = z.string().regex(/^\+57\d{10}$/, {
  message: "El teléfono debe tener el formato +57XXXXXXXXXX"
})
```

### Código CIIU:
```typescript
const ciiuSchema = z.string().regex(/^\d{4}$/, {
  message: "El código CIIU debe tener 4 dígitos"
})
```

### Archivos:
```typescript
const validateFile = (file: File) => {
  const maxSize = 10485760 // 10 MB
  const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg']

  if (file.size > maxSize) {
    return { valid: false, error: 'El archivo supera el tamaño máximo de 10 MB' }
  }

  if (!allowedTypes.includes(file.type)) {
    return { valid: false, error: 'Solo se permiten archivos PDF, JPG o PNG' }
  }

  return { valid: true }
}
```

## Textos en Español Colombiano

Usa lenguaje claro, formal pero amigable, típico de Colombia:

**Ejemplos:**
- "¡Hola! Bienvenido a nuestra plataforma"
- "Por favor, completa los siguientes datos de tu empresa"
- "Estamos revisando tu solicitud"
- "¡Listo! Tu solicitud fue enviada correctamente"
- "Necesitamos que actualices algunos documentos"
- "Si tienes dudas, contáctanos en..."

**Evitar:**
- Voseo (vos, vosotros) - usar "usted" o "tú" formal
- Modismos de otros países (che, güey, tío, etc)

## Protección de Rutas

Implementar middleware de autenticación:

```typescript
const ProtectedRoute = ({ children }) => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      setLoading(false)
    }

    getUser()

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null)
    })

    return () => {
      authListener.subscription.unsubscribe()
    }
  }, [])

  if (loading) return <div>Cargando...</div>

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return children
}
```

Rutas protegidas:
- `/onboarding/*`
- `/dashboard`

Rutas públicas:
- `/`
- `/login`
- `/auth/callback`

## Realtime (Opcional pero Recomendado)

Suscribirse a cambios en la tabla `empresas_pagadoras` para actualizar el estado en tiempo real:

```typescript
useEffect(() => {
  if (!empresaId) return

  const channel = supabase
    .channel('cambios-empresa')
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'empresas_pagadoras',
        filter: `id=eq.${empresaId}`
      },
      (payload) => {
        console.log('Empresa actualizada:', payload.new)
        setEmpresa(payload.new)

        // Si cambió el estado, mostrar toast
        if (payload.old.estado !== payload.new.estado) {
          toast.info(`El estado de tu solicitud cambió a: ${payload.new.estado}`)
        }
      }
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}, [empresaId])
```

## Testing de Usuario

Después de construir, probar estos escenarios:

1. **Flujo completo exitoso:**
   - Login con Google
   - Llenar formulario con datos válidos
   - Subir 6 documentos
   - Ver confirmación
   - Ver dashboard con estado "pendiente"

2. **Validaciones:**
   - Intentar enviar formulario con NIT inválido → debe mostrar error
   - Intentar subir archivo de 15 MB → debe rechazar
   - Intentar subir archivo .docx → debe rechazar

3. **Edge cases:**
   - Intentar crear 2 empresas con el mismo usuario → debe fallar
   - Logout y login nuevamente → debe redirigir al dashboard
   - Estado "documentos_incompletos" → debe permitir actualizar

4. **Responsive:**
   - Probar en mobile (375px)
   - Probar en tablet (768px)
   - Probar en desktop (1440px)

## Checklist Final

Antes de entregar, verifica que:

- [ ] Supabase está configurado correctamente
- [ ] Auth funciona con Google, Apple y Magic Link
- [ ] Validación de NIT colombiano funciona
- [ ] Los 6 tipos de documentos se pueden subir
- [ ] Subida de documentos usa Edge Function (no Supabase Storage)
- [ ] Dashboard muestra estado actual y historial
- [ ] Realtime actualiza el estado sin refrescar
- [ ] Todos los textos están en español colombiano
- [ ] Responsive en mobile, tablet y desktop
- [ ] Loading states en todas las operaciones async
- [ ] Error handling con mensajes amigables
- [ ] Rutas protegidas requieren autenticación
- [ ] Logout funciona correctamente

## Notas Adicionales

- **Seguridad:** Row Level Security (RLS) en Supabase ya está configurado. No necesitas validar permisos en frontend.
- **Performance:** Usar `React.memo` en componentes pesados como lista de documentos.
- **SEO:** No es crítico para onboarding privado, pero agregar meta tags básicos.
- **Analytics:** Opcional - agregar Google Analytics o Posthog para tracking.

---

**¡Listo para construir!**

Este prompt contiene toda la información necesaria para construir el frontend del onboarding de pagadores. Copia y pega directamente en Lovable y empieza a desarrollar.
