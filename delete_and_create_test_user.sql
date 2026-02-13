-- ============================================================================
-- Eliminar usuario existente y crear uno nuevo
-- ============================================================================
-- Email: testing@platam.co
-- Password: Testing123!
-- ============================================================================
--
-- Nota importante:
-- Si creas usuarios directamente en `auth.users`, ciertas columnas NO pueden
-- quedar en NULL o el login por password puede fallar con:
--   500: "Database error querying schema"
-- Ver: https://github.com/supabase/auth/issues/1940
-- Por eso seteamos a '' (string vacio) los campos de tokens.

-- Paso 1: Eliminar usuario existente
DELETE FROM auth.users WHERE email = 'testing@platam.co';

-- Paso 2: Crear usuario nuevo
DO $$
DECLARE
  new_user_id uuid;
BEGIN
  -- Generar UUID
  new_user_id := gen_random_uuid();

  -- Insertar en auth.users
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    confirmation_sent_at,
    created_at,
    updated_at,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    new_user_id,
    'authenticated',
    'authenticated',
    'testing@platam.co',
    crypt('Testing123!', gen_salt('bf')),
    now(),
    now(),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    false,
    '',
    '',
    '',
    ''
  );

  -- Insertar en auth.identities
  INSERT INTO auth.identities (
    id,
    user_id,
    provider_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    new_user_id,
    new_user_id::text,
    format('{"sub":"%s","email":"testing@platam.co"}', new_user_id)::jsonb,
    'email',
    now(),
    now(),
    now()
  );

  -- Insertar en usuarios (tabla pública)
  INSERT INTO public.usuarios (id, rol)
  VALUES (new_user_id, 'pagador');

  RAISE NOTICE 'Usuario creado exitosamente con ID: %', new_user_id;
END $$;
