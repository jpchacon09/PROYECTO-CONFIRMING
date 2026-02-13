# 🚀 Frontend Cliente - Plataforma de Confirming

Referencia operativa obligatoria: `../FRONTEND_OPERATIVO.md`

**Fecha:** 2026-02-12
**Estado:** ✅ COMPLETO Y FUNCIONANDO
**URL Local:** http://localhost:5173

---

## 📋 DESCRIPCIÓN

Aplicación web moderna para el onboarding digital de empresas pagadoras. Los representantes legales pueden:

- ✅ Registrarse con Google OAuth o Magic Link
- ✅ Completar formulario con datos de la empresa
- ✅ Subir 6 documentos requeridos a S3 vía Edge Functions
- ✅ Hacer seguimiento del estado de su solicitud
- ✅ Ver historial de cambios y documentos procesados

---

## 🛠️ STACK TÉCNICO

- **Framework:** React 18 + TypeScript + Vite 7
- **Routing:** React Router v6
- **Styling:** Tailwind CSS
- **Autenticación:** Supabase Auth (Google OAuth + Magic Link)
- **Base de datos:** Supabase PostgreSQL
- **Storage:** AWS S3 (Presigned URLs vía Edge Functions)
- **Validación:** React Hook Form + Zod
- **Notificaciones:** Sonner
- **Iconos:** Lucide React
- **Fechas:** date-fns (español)

---

## 🚀 INICIO RÁPIDO

```bash
# Instalar dependencias (si no están)
npm install

# Iniciar servidor
npm run dev

# Abrir navegador en:
# http://localhost:5173
```

---

## 🔗 INTEGRACIÓN

### Supabase
- **URL:** `https://TU_PROYECTO.supabase.co`
- **Tablas:** usuarios, empresas_pagadoras, documentos, historial_estados

### Edge Functions
- **generar-url-subida:** Genera presigned URLs para S3

### AWS S3
- **Bucket:** `bucketn8n-platam`
- **Path:** `confirming/pagadores/{NIT}/{tipo_documento}/`

---

## 📱 FLUJO DE USUARIO

1. **Login** → Google OAuth o Magic Link
2. **Datos de Empresa** → Formulario con validación
3. **Documentos** → Subir 6 documentos (PDF/JPG/PNG)
4. **Confirmación** → Mensaje de éxito
5. **Dashboard** → Seguimiento de estado

---

## 🎯 ESTADOS

| Estado | Color | Acción del Usuario |
|--------|-------|-------------------|
| pendiente | 🟡 | Solo lectura |
| en_revision | 🔵 | Solo lectura |
| documentos_incompletos | 🟠 | Puede actualizar |
| aprobado | 🟢 | Acceso completo |
| rechazado | 🔴 | Solo lectura |

---

## ✅ CARACTERÍSTICAS

- ✅ Autenticación OAuth y Magic Link
- ✅ Validación robusta (NIT, email, teléfono)
- ✅ Subida a S3 con presigned URLs
- ✅ Dashboard con historial
- ✅ UI responsiva moderna
- ✅ Notificaciones toast
- ✅ Loading states
- ✅ Rutas protegidas

---

**Desarrollado con ❤️ por Claude Code**
