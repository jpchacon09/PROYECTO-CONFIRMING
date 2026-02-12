# Configuración de Workflows en n8n - Plataforma Confirming

## Introducción

Este documento describe los workflows que debes configurar manualmente en n8n (via interfaz visual).
n8n se conectará a Supabase para leer notificaciones pendientes y ejecutar acciones.

---

## Workflow 1: Procesador de Notificaciones

**Propósito:** Leer tabla `notificaciones_enviadas` cada 30 segundos y procesar notificaciones pendientes

### Nodos del workflow:

```
1. [Trigger: Cron]
   - Expresión: */30 * * * * (cada 30 segundos)
   - Timezone: America/Bogota

   ↓

2. [Supabase Node: SELECT]
   - Operación: SELECT
   - Tabla: notificaciones_enviadas
   - Filtros:
     - enviado = false
   - Limit: 10
   - Order by: created_at ASC

   ↓

3. [Switch Node: Por tipo de evento]
   - Campo a evaluar: {{ $json.evento }}
   - Casos:
     - onboarding_completo → Rama A
     - estado_cambiado → Rama B
     - documento_subido → Rama C
     - comentario_interno → Rama D

   ↓ (Rama A: onboarding_completo)

4a. [Function Node: Parsear payload]
    - Code:
      ```javascript
      const payload = JSON.parse($json.payload);
      return {
        json: {
          ...payload,
          notificacion_id: $json.id
        }
      };
      ```

   ↓

5a. [Email Node: AWS SES - Equipo interno]
    - From: noreply@tudominio.com
    - To: equipo@confirming.com
    - Subject: Nueva solicitud de onboarding - {{ $json.razon_social }}
    - Body:
      ```
      Se ha registrado una nueva empresa:

      - NIT: {{ $json.nit }}
      - Razón social: {{ $json.razon_social }}
      - Ciudad: {{ $json.ciudad }}
      - Documentos subidos: {{ $json.total_documentos }}

      Revisar en: https://backoffice.tudominio.com/dashboard/empresas/{{ $json.empresa_id }}
      ```

   ↓

6a. [HTTP Node: WhatsApp (Twilio)]
    - Method: POST
    - URL: https://api.twilio.com/2010-04-01/Accounts/{{ $env.TWILIO_ACCOUNT_SID }}/Messages.json
    - Authentication: Basic Auth
    - Body:
      ```json
      {
        "From": "whatsapp:+14155238886",
        "To": "whatsapp:+573001234567",
        "Body": "Nueva solicitud de onboarding: {{ $json.razon_social }} (NIT {{ $json.nit }})"
      }
      ```

   ↓

7a. [Google Sheets Node: Agregar fila]
    - Operación: Append
    - Spreadsheet: Registro Onboardings
    - Sheet: Hoja 1
    - Datos:
      - Fecha: {{ $now }}
      - NIT: {{ $json.nit }}
      - Razón Social: {{ $json.razon_social }}
      - Ciudad: {{ $json.ciudad }}
      - Estado: {{ $json.estado }}

   ↓

8a. [Supabase Node: UPDATE]
    - Operación: UPDATE
    - Tabla: notificaciones_enviadas
    - Filtros:
      - id = {{ $json.notificacion_id }}
    - Datos:
      - enviado: true
      - fecha_envio: NOW()

   ↓ (Rama B: estado_cambiado)

4b. [Function Node: Parsear payload + determinar acción]
    - Code:
      ```javascript
      const payload = JSON.parse($json.payload);
      const estado = payload.estado_nuevo;

      let emailTemplate = '';
      let subject = '';

      if (estado === 'aprobado') {
        subject = '¡Tu solicitud fue aprobada!';
        emailTemplate = `
          Hola ${payload.empresa.razon_social},

          Nos complace informarte que tu solicitud de onboarding ha sido aprobada.
          Ya puedes empezar a usar nuestra plataforma de confirming.

          Ingresa a: https://app.tudominio.com

          Saludos,
          Equipo de Confirming
        `;
      } else if (estado === 'rechazado') {
        subject = 'Actualización sobre tu solicitud';
        emailTemplate = `
          Hola ${payload.empresa.razon_social},

          Lamentablemente tu solicitud no ha sido aprobada.
          Motivo: ${payload.cambio.motivo}

          Para más información, contáctanos en: soporte@tudominio.com

          Saludos,
          Equipo de Confirming
        `;
      } else if (estado === 'documentos_incompletos') {
        subject = 'Documentos incompletos - Acción requerida';
        emailTemplate = `
          Hola ${payload.empresa.razon_social},

          Necesitamos que completes o corrijas algunos documentos.
          Motivo: ${payload.cambio.motivo}

          Ingresa a tu portal para actualizar: https://app.tudominio.com

          Saludos,
          Equipo de Confirming
        `;
      }

      return {
        json: {
          ...payload,
          notificacion_id: $json.id,
          email_subject: subject,
          email_body: emailTemplate,
          email_to: payload.empresa.email_contacto
        }
      };
      ```

   ↓

5b. [Email Node: AWS SES - Cliente]
    - From: noreply@tudominio.com
    - To: {{ $json.email_to }}
    - Subject: {{ $json.email_subject }}
    - Body: {{ $json.email_body }}

   ↓

6b. [Supabase Node: UPDATE]
    - Operación: UPDATE
    - Tabla: notificaciones_enviadas
    - Filtros:
      - id = {{ $json.notificacion_id }}
    - Datos:
      - enviado: true
      - fecha_envio: NOW()

   ↓ (Rama C: documento_subido)

4c. [Function Node: Parsear payload]
    - Code:
      ```javascript
      const payload = JSON.parse($json.payload);
      return {
        json: {
          ...payload.documento,
          notificacion_id: $json.id
        }
      };
      ```

   ↓

5c. [AWS Lambda Node: Invoke document-ai-processor]
    - Function Name: document-ai-processor
    - Invocation Type: RequestResponse
    - Payload:
      ```json
      {
        "documento_id": "{{ $json.id }}",
        "s3_key": "{{ $json.s3_key }}",
        "tipo_documento": "{{ $json.tipo_documento }}"
      }
      ```

   ↓

6c. [IF Node: Verificar si Lambda tuvo éxito]
    - Condition: {{ $json.statusCode }} === 200
    - TRUE → Rama C1
    - FALSE → Rama C2

   ↓ Rama C1 (éxito)

7c1. [Supabase Node: UPDATE notificación]
     - Operación: UPDATE
     - Tabla: notificaciones_enviadas
     - Filtros:
       - id = {{ $json.notificacion_id }}
     - Datos:
       - enviado: true
       - fecha_envio: NOW()

   ↓ Rama C2 (error)

7c2. [Supabase Node: UPDATE notificación con error]
     - Operación: UPDATE
     - Tabla: notificaciones_enviadas
     - Filtros:
       - id = {{ $json.notificacion_id }}
     - Datos:
       - enviado: false
       - error: {{ $json.error }}

   ↓

8c2. [Email Node: Notificar error al equipo]
     - From: n8n@tudominio.com
     - To: equipo@confirming.com
     - Subject: Error en Document AI
     - Body: Error procesando documento {{ $json.documento_id }}: {{ $json.error }}
```

---

## Workflow 2: Recordatorios Automáticos

**Propósito:** Enviar recordatorios a empresas con estado 'pendiente' después de 3 días sin actividad

### Nodos del workflow:

```
1. [Trigger: Cron]
   - Expresión: 0 9 * * * (todos los días a las 9 AM)
   - Timezone: America/Bogota

   ↓

2. [Supabase Node: SELECT empresas pendientes]
   - Operación: SELECT
   - Tabla: empresas_pagadoras
   - Filtros:
     - estado = 'pendiente'
     - created_at < NOW() - INTERVAL '3 days'
   - Joins:
     - LEFT JOIN usuarios ON empresas_pagadoras.usuario_id = usuarios.id

   ↓

3. [Loop Over Items]
   - For each empresa:

   ↓

4. [Email Node: Recordatorio]
   - From: noreply@tudominio.com
   - To: {{ $json.representante_legal_email }}
   - Subject: Recordatorio: Completa tu solicitud de onboarding
   - Body:
     ```
     Hola {{ $json.razon_social }},

     Notamos que iniciaste tu solicitud de onboarding hace 3 días pero aún está pendiente.

     ¿Necesitas ayuda? Contáctanos en soporte@tudominio.com

     Ingresa a tu portal: https://app.tudominio.com

     Saludos,
     Equipo de Confirming
     ```

   ↓

5. [Supabase Node: INSERT notificación]
   - Operación: INSERT
   - Tabla: notificaciones_enviadas
   - Datos:
     - empresa_id: {{ $json.id }}
     - tipo: 'email'
     - evento: 'recordatorio_pendiente'
     - destinatario: {{ $json.representante_legal_email }}
     - enviado: true
     - fecha_envio: NOW()
```

---

## Workflow 3: Sincronización con Google Sheets (Reporte Gerencial)

**Propósito:** Actualizar Google Sheets con métricas diarias

### Nodos del workflow:

```
1. [Trigger: Cron]
   - Expresión: 0 18 * * * (todos los días a las 6 PM)
   - Timezone: America/Bogota

   ↓

2. [Supabase Node: Query métricas]
   - Operación: SQL Query
   - Query:
     ```sql
     SELECT
       COUNT(*) FILTER (WHERE estado = 'pendiente') as pendientes,
       COUNT(*) FILTER (WHERE estado = 'en_revision') as en_revision,
       COUNT(*) FILTER (WHERE estado = 'aprobado') as aprobados,
       COUNT(*) FILTER (WHERE estado = 'rechazado') as rechazados,
       COUNT(*) FILTER (WHERE DATE(created_at) = CURRENT_DATE) as nuevas_hoy
     FROM empresas_pagadoras
     ```

   ↓

3. [Google Sheets Node: Append]
   - Operación: Append
   - Spreadsheet: Métricas Diarias
   - Sheet: Resumen
   - Datos:
     - Fecha: {{ $now.format('YYYY-MM-DD') }}
     - Pendientes: {{ $json.pendientes }}
     - En Revisión: {{ $json.en_revision }}
     - Aprobados: {{ $json.aprobados }}
     - Rechazados: {{ $json.rechazados }}
     - Nuevas Hoy: {{ $json.nuevas_hoy }}
```

---

## Variables de Entorno en n8n

Configurar en n8n Settings → Variables:

```bash
# Supabase
SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# AWS
AWS_ACCESS_KEY_ID=AKIAXXXXXXXXXXXXX
AWS_SECRET_ACCESS_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
AWS_REGION=us-east-1

# Twilio (para WhatsApp)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Emails
FROM_EMAIL=noreply@tudominio.com
EQUIPO_EMAIL=equipo@confirming.com
EQUIPO_WHATSAPP=+573001234567

# URLs
BACKOFFICE_URL=https://backoffice.tudominio.com
APP_URL=https://app.tudominio.com
```

---

## Credenciales a configurar en n8n

1. **Supabase API:**
   - Type: Supabase
   - URL: {{ $env.SUPABASE_URL }}
   - Service Key: {{ $env.SUPABASE_SERVICE_KEY }}

2. **AWS (Lambda + SES):**
   - Type: AWS
   - Access Key ID: {{ $env.AWS_ACCESS_KEY_ID }}
   - Secret Access Key: {{ $env.AWS_SECRET_ACCESS_KEY }}
   - Region: {{ $env.AWS_REGION }}

3. **Twilio:**
   - Type: Twilio
   - Account SID: {{ $env.TWILIO_ACCOUNT_SID }}
   - Auth Token: {{ $env.TWILIO_AUTH_TOKEN }}

4. **Google Sheets:**
   - Type: Google OAuth2
   - Scopes: https://www.googleapis.com/auth/spreadsheets
   - (Seguir flujo OAuth de n8n)

---

## Testing de Workflows

### Test Workflow 1 (Notificaciones):

1. Insertar manualmente una notificación de prueba:
   ```sql
   INSERT INTO notificaciones_enviadas (
     empresa_id,
     tipo,
     evento,
     destinatario,
     enviado,
     payload
   ) VALUES (
     'uuid-de-empresa-existente',
     'email',
     'onboarding_completo',
     'test@ejemplo.com',
     false,
     '{"nit": "900123456-7", "razon_social": "TEST S.A.S.", "ciudad": "Bogotá", "total_documentos": 6}'::jsonb
   );
   ```

2. Esperar 30 segundos o ejecutar workflow manualmente
3. Verificar que el email llegó y que `enviado = true`

### Test Workflow 2 (Recordatorios):

1. Crear empresa de prueba con fecha antigua:
   ```sql
   UPDATE empresas_pagadoras
   SET created_at = NOW() - INTERVAL '4 days'
   WHERE nit = '900123456-7';
   ```

2. Ejecutar workflow manualmente
3. Verificar email de recordatorio

### Test Workflow 3 (Google Sheets):

1. Ejecutar workflow manualmente
2. Verificar que se agregó fila en Google Sheets con métricas

---

## Monitoreo y Alertas

### Errores a monitorear:

1. **Workflow falla:**
   - Configurar notificación por email si workflow tiene >5 errores consecutivos

2. **Lambda timeout:**
   - Si Document AI tarda mucho, aumentar timeout de Lambda a 10 minutos

3. **Rate limits:**
   - AWS SES: 14 emails/segundo en sandbox, ilimitado en producción
   - Twilio WhatsApp: 60 mensajes/hora en trial

---

## Optimizaciones Futuras

1. **Batch processing:**
   - En lugar de procesar 10 notificaciones cada 30s, procesar todas las pendientes en batch cada 5 minutos

2. **Retry logic:**
   - Si un email falla, reintentar 3 veces con exponential backoff

3. **Priorización:**
   - Procesar primero notificaciones de tipo 'estado_cambiado' antes que 'documento_subido'

---

## Checklist de Implementación

- [ ] n8n desplegado en GCP Cloud Run
- [ ] Variables de entorno configuradas
- [ ] Credenciales agregadas (Supabase, AWS, Twilio, Google)
- [ ] Workflow 1 creado y probado
- [ ] Workflow 2 creado y probado
- [ ] Workflow 3 creado y probado
- [ ] Google Sheets creadas (Registro Onboardings, Métricas Diarias)
- [ ] AWS SES verificado (salir de sandbox si es necesario)
- [ ] Twilio WhatsApp configurado (número de prueba)
- [ ] Monitoreo configurado (alertas por errores)

---

**¿Dudas sobre algún workflow?**

Puedes modificar los templates de emails, frecuencias de cron, y lógica de los Function Nodes según tus necesidades.
