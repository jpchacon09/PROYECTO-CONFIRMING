# Instrucciones para Ejecutar el Schema en Supabase

## Paso 1: Acceder a Supabase SQL Editor

1. Ve a https://supabase.com/dashboard
2. Selecciona tu proyecto
3. En el menú lateral, haz clic en "SQL Editor"
4. Haz clic en "+ New query"

## Paso 2: Ejecutar el Schema

1. Abre el archivo `schema_supabase.sql`
2. Copia TODO el contenido (líneas 1-610)
3. Pega en el SQL Editor de Supabase
4. Haz clic en "Run" (o presiona Cmd/Ctrl + Enter)

**IMPORTANTE:** El script se ejecutará de forma secuencial y puede tardar 5-10 segundos.

## Paso 3: Verificar que todo se creó correctamente

Ejecuta esta query en el SQL Editor:

```sql
-- Verificar tablas creadas
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

Deberías ver estas tablas:
- comentarios_internos
- convenios
- convenios_proveedores
- documentos
- empresas_pagadoras
- historial_estados
- notificaciones_enviadas
- proveedores
- usuarios

## Paso 4: Verificar triggers

```sql
-- Verificar triggers
SELECT trigger_name, event_object_table
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;
```

Deberías ver:
- trigger_cambio_estado (empresas_pagadoras)
- trigger_notificar_estado (empresas_pagadoras)
- trigger_onboarding_completo (documentos)
- update_* triggers (para updated_at)

## Paso 5: Verificar RLS

```sql
-- Verificar que RLS está habilitado
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```

Todas las tablas deben tener `rowsecurity = true`

## Paso 6: Crear usuario admin inicial (OPCIONAL para testing)

**IMPORTANTE:** Primero crea un usuario en Supabase Auth (via UI o Google OAuth), luego agrega el rol:

```sql
-- Reemplaza 'UUID-DE-TU-USUARIO' con el ID real del usuario
-- Puedes obtenerlo de Authentication > Users en Supabase Dashboard
INSERT INTO public.usuarios (id, rol)
VALUES ('UUID-DE-TU-USUARIO', 'admin');
```

## Paso 7: Probar RLS con un query

```sql
-- Como admin, deberías poder ver todas las empresas
-- Como pagador, solo verías tu propia empresa
SELECT * FROM empresas_pagadoras;
```

## Troubleshooting

### Error: "extension uuid-ossp does not exist"
Supabase ya tiene esta extensión habilitada por defecto. Si ves este error, ignóralo.

### Error: "relation already exists"
Si ya ejecutaste el script antes, primero elimina las tablas:

```sql
-- CUIDADO: Esto elimina TODOS los datos
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;
```

Luego vuelve a ejecutar el schema completo.

### Error en políticas RLS
Si las políticas fallan, verifica que la tabla `usuarios` existe primero, ya que otras políticas hacen referencia a ella.

---

**Una vez completado, marca el primer todo como completado y continúa con CONTRATO.md**
