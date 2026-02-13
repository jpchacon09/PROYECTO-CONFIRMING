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
- validaciones_sarlaft
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

## SARLAFT (Validación)

### Crear tabla y policies (si ya ejecutaste el schema antes)
Si tu proyecto ya tenia el schema aplicado, agrega SARLAFT con:

```sql
-- Agregar tipo de documento del representante legal (CC/CE)
alter table public.empresas_pagadoras
add column if not exists representante_legal_tipo_documento varchar(2);

update public.empresas_pagadoras
set representante_legal_tipo_documento = 'CC'
where representante_legal_tipo_documento is null;

alter table public.empresas_pagadoras
alter column representante_legal_tipo_documento set default 'CC';

alter table public.empresas_pagadoras
alter column representante_legal_tipo_documento set not null;

alter table public.empresas_pagadoras
drop constraint if exists empresas_pagadoras_representante_legal_tipo_documento_check;

alter table public.empresas_pagadoras
add constraint empresas_pagadoras_representante_legal_tipo_documento_check
check (representante_legal_tipo_documento in ('CC','CE'));

-- Tabla
create table if not exists public.validaciones_sarlaft (
  id uuid primary key default uuid_generate_v4(),
  empresa_id uuid not null references public.empresas_pagadoras(id) on delete cascade,
  usuario_id uuid not null references public.usuarios(id) on delete cascade,
  scope varchar(20) not null default 'representante' check (scope in ('empresa','representante')),
  tipo_documento varchar(10) not null,
  documento varchar(32) not null,
  nombres text not null,
  user_id varchar(100),
  ip_address inet,
  force_refresh boolean default false,
  provider_status integer,
  resultado jsonb not null default '{}'::jsonb,
  created_at timestamptz default now()
);

create index if not exists idx_sarlaft_empresa on public.validaciones_sarlaft(empresa_id, created_at desc);
create index if not exists idx_sarlaft_documento on public.validaciones_sarlaft(tipo_documento, documento);

alter table public.validaciones_sarlaft enable row level security;

drop policy if exists "Usuarios ven validaciones SARLAFT de su empresa" on public.validaciones_sarlaft;
create policy "Usuarios ven validaciones SARLAFT de su empresa"
on public.validaciones_sarlaft for select
using (
  exists (
    select 1 from public.empresas_pagadoras
    where id = validaciones_sarlaft.empresa_id
    and usuario_id = auth.uid()
  )
  or exists (select 1 from public.usuarios where id = auth.uid() and rol = 'admin')
);

drop policy if exists "Usuarios pueden insertar validaciones SARLAFT de su empresa" on public.validaciones_sarlaft;
create policy "Usuarios pueden insertar validaciones SARLAFT de su empresa"
on public.validaciones_sarlaft for insert
with check (
  (
    usuario_id = auth.uid()
    and exists (
      select 1 from public.empresas_pagadoras ep
      where ep.id = validaciones_sarlaft.empresa_id
      and ep.usuario_id = auth.uid()
    )
  )
  or exists (select 1 from public.usuarios where id = auth.uid() and rol = 'admin')
);
```

### Error en backoffice al aprobar/rechazar (500): "new row violates row-level security policy for table historial_estados"
Esto pasa si ejecutaste una version del schema sin policies de INSERT para tablas que reciben inserts desde triggers.

Ejecuta en Supabase SQL Editor:

```sql
-- Postgres no soporta CREATE POLICY IF NOT EXISTS, usamos DROP + CREATE.

drop policy if exists "Admins pueden insertar historial" on public.historial_estados;
create policy "Admins pueden insertar historial"
on public.historial_estados for insert
with check (
  exists (select 1 from public.usuarios where id = auth.uid() and rol = 'admin')
);

drop policy if exists "Admins pueden insertar notificaciones" on public.notificaciones_enviadas;
create policy "Admins pueden insertar notificaciones"
on public.notificaciones_enviadas for insert
with check (
  exists (select 1 from public.usuarios where id = auth.uid() and rol = 'admin')
  or (
    notificaciones_enviadas.empresa_id is not null
    and exists (
      select 1 from public.empresas_pagadoras ep
      where ep.id = notificaciones_enviadas.empresa_id
      and ep.usuario_id = auth.uid()
    )
  )
);
```

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
