# 📊 Especificación: Monitor de Eventos - Event Registrations

## Resumen
Sistema completo para monitorear y consultar inscripciones a eventos, permitiendo ver en tiempo real quiénes han sido invitados, confirmaron y asistieron a eventos programados.

---

## 🗄️ Tablas Existentes

### `botia.event_invites` (Invitaciones Enviadas)
```sql
CREATE TABLE botia.event_invites (
    id SERIAL PRIMARY KEY,
    bot_id TEXT NOT NULL,
    contact_id TEXT NOT NULL,
    phone_number TEXT,
    event_session_id INTEGER NOT NULL REFERENCES botia.event_sessions(id),
    campaign_name TEXT,
    channel TEXT, -- 'whatsapp', 'email', 'sms'
    status TEXT, -- 'sent', 'delivered', 'read', 'failed', 'rechaza...'
    sent_at TIMESTAMP WITH TIME ZONE,
    last_updated_at TIMESTAMP WITH TIME ZONE,
    utm_campaign TEXT,
    utm_source TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### `botia.event_registrations` (Respuestas/Confirmaciones)
```sql
CREATE TABLE botia.event_registrations (
    id SERIAL PRIMARY KEY,
    event_session_id INTEGER NOT NULL REFERENCES botia.event_sessions(id),
    contact_id TEXT NOT NULL,
    account_tier TEXT,
    source TEXT, -- 'whatsapp_campaign', 'manual', 'web_form', etc.
    registration_status TEXT NOT NULL, -- 'PRE_REGISTRO', 'CONFIRMADO', 'CANCELADO', 'NO_SHOW', 'ASISTIO'
    registered_at TIMESTAMP WITH TIME ZONE,
    confirmed_at TIMESTAMP WITH TIME ZONE,
    canceled_at TIMESTAMP WITH TIME ZONE,
    attended_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    utm_campaign TEXT,
    utm_source TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### ⚠️ Problema Actual: Datos Desconectados

**Flujo Real:**
1. Se envía campaña → Registro en `event_invites` (status: 'sent', 'delivered', 'rechaza...')
2. Usuario responde → Registro en `event_registrations` (status: 'CONFIRMADO', 'CANCELADO', etc.)

**Problema:**
- El frontend solo consulta `event_registrations`
- **No cuenta las invitaciones sin respuesta** (perdiendo visibilidad de alcance real)
- Un usuario que rechazó aparece en `event_invites` pero no en `event_registrations`

---

## 📍 Endpoints Existentes

### ⚠️ `GET /api/bots/{bot_id}/event_registrations` (INCOMPLETO)

**Problema:** Solo devuelve usuarios que respondieron, ignora invitaciones sin respuesta.

**Query Parameters:**
- `event_id` (optional): Filtrar por evento
- `event_session_id` (optional): Filtrar por sesión específica

**Response Actual:**
```json
[]
```
*Nota: Devuelve vacío aunque existan invitaciones en `event_invites`*

**Ejemplo con Datos:**
```json
[
  {
    "id": 1,
    "event_session_id": 3,
    "contact_id": "3474",
    "registration_status": "canceled",
    "registered_at": "2026-02-03T21:50:33.502313Z",
    "canceled_at": "2026-02-03T23:03:35.014495Z"
  }
]
```

✅ **Este endpoint existe pero es INSUFICIENTE para el monitor.**

### ✅ `GET /api/bots/{bot_id}/event_invites` (Existe, confirmar acceso)

**Necesidad:** Consultar invitaciones enviadas.

**Query Parameters:**
- `event_session_id` (required): Filtrar por sesión

**Response Esperado:**
```json
[
  {
    "id": 4,
    "bot_id": "CONS_ASIS",
    "contact_id": "3474",
    "phone_number": "+573142376428",
    "event_session_id": 3,
    "campaign_name": "Webinar en vivo",
    🔥 PRIORIDAD CRÍTICA: Endpoint Consolidado

### 1. `GET /api/bots/{bot_id}/event_sessions/{session_id}/invites-and-registrations`

**Descripción**: Combinar datos de `event_invites` + `event_registrations` para monitor completo.

**Lógica:**
```sql
-- Pseudo-código SQL
SELECT 
  COALESCE(i.contact_id, r.contact_id) as contact_id,
  i.phone_number,
  i.campaign_name,
  i.status as invite_status,
  i.sent_at as invited_at,
  r.registration_status,
  r.confirmed_at,
  r.canceled_at,
  r.attended_at,
  CASE 
    WHEN r.id IS NOT NULL THEN 'responded'
    WHEN i.id IS NOT NULL THEN 'invited_no_response'
    ELSE 'unknown'
  END as participation_status
FROM botia.event_invites i
FULL OUTER JOIN botia.event_registrations r 
  ON i.contact_id = r.contact_id 
  AND i.event_session_id = r.event_session_id
WHERE i.event_session_id = :session_id 
  OR r.event_session_id = :session_id;
```

**Response:**
```json
[
  {
    "contact_id": "3474",
    "contact_name": "Orlando Prado",
    "contact_phone": "+573142376428",
    "participation_status": "invited_no_response",
    "invite_status": "rechaza...",
    "invited_at": "2026-02-03T23:42:03Z",
    "registration_status": null,
    "confirmed_at": null,
    "canceled_at": null,
    "attended_at": null,
    "source": "whatsapp_campaign",
    "campaign_name": "Webinar en vivo"
  }
]
```

**Casos Cubiertos:**
- ✅ Usuario invitado sin respuesta (solo en `event_invites`)
- ✅ Usuario invitado que respondió (ambas tablas)
- ✅ 3. `GET /api/bots/{bot_id}/event_sessions/{session_id}/stats`

**Descripción**: Obtener estadísticas de una sesión con datos consolidados.

**Lógica Mejorada:**
```sql
-- Contar invitaciones
total_invited = COUNT(DISTINCT event_invites.contact_id)

-- Contar respuestas por estado
pre_registro = COUNT(event_registrations WHERE status ILIKE 'pre%')
confirmado = COUNT(event_registrations WHERE status ILIKE 'confirm%')
asistio = COUNT(event_registrations WHERE status ILIKE 'attended%' OR status ILIKE 'asist%')
no_show = COUNT(event_registrations WHERE status ILIKE 'no_show%')
cancelado = COUNT(event_registrations WHERE status ILIKE 'cancel%')

-- Invitados sin respuesta
sin_respuesta = total_invited - COUNT(event_registrations)
```

**Response Mejorado:**
```json
{
  "session_id": 3,
  "session_name": "Workshop de casos 3D",
  "event_id": 5,
  "event_title": "Webinar en vivo",
  "start_at": "2026-03-28T19:00:00Z",
  "end_at": "2026-03-28T21:00:00Z",
  "is_past": false,
  "stats": {
    "total_invited": 1,
    "sin_respuesta": 1,
    "pre_registro": 0,
    "confirmado": 0,
    "asistio": 0,
    "no_show": 0,
    4cancelado": 0,
    "tasa_respuesta": "0%"
  },
  "invites_summary": {
    "sent": 1,
    "delivered": 1,
    "read": 1,
    "rejected": 1,
    "failed": 0
  }json
{
  "event_id": 5,
  "event_title": "Webinar en vivo",
  "total_sessions": 3,
  "total_registrations": 150,
  "by_status": {
    "PRE_REGISTRO": 45,
    "CONFIRMADO": 80,
    "ASISTIO": 15,
    "NO_SHOW": 8,
    "CANCELADO": 2
  },
  "by_session": [
    {
      "session_id": 10,
      "session_name": "Sesión 1: Introducción",
      "start_at": "2026-02-10T10:00:00Z",
      "total_registrations": 50,
      "confirmed": 30,
      "attended": 5
    }
  ]
}
```

---

### 2. `GET /api/bots/{bot_id}/event_sessions/{session_id}/stats`

**Descripción**: Obtener estadísticas de una sesión específica.

**Response:**
```json
{
  "session_id": 10,
  "session_name": "Workshop de casos 3D",
  "event_id": 5,
  "event_title": "Webinar en vivo",
  "start_at": "2026-02-10T10:00:00Z",
  "end_at": "2026-02-10T12:00:00Z",
  "is_past": false,
  "stats": {
    "total": 50,
    "pre_registro": 15,
    "confirmado": 30,
    "asistio": 0,
    "no_show": 0,
    "cancelado": 5
  },
  "recent_registrations": [
    {
      "id": 123,
      "contact_id": "3474",
      "contact_name": "Juan Pérez",
      "contact_phone": "+573001234567",
      "registration_status": "CONFIRMADO",
      "registered_at": "2026-02-03T21:50:33Z"
    }
  ]
}
```

---

### 3. `PATCH /api/bots/{bot_id}/event_registrations/{registration_id}/status`

**Descripción**: Actualizar el estado de una inscripción manualmente.

**Request Body:**
```json
{
  "status": "CONFIRMADO"
}
```

**Valid Status Values:**
- `PRE_REGISTRO`: Usuario pre-registrado (invitado)
- `CONFIRMADO`: Usuario confirmó asistencia
- `ASISTIO`: Usuario asistió al evento (marcar después del evento)
- `NO_SHOW`: Usuario no asistió (marcar después del evento)
- `CANCELADO`: Usuario canceló su inscripción

**Response:**
```json
{
  "id": 123,
  "e5ent_session_id": 10,
  "contact_id": "3474",
  "registration_status": "CONFIRMADO",
  "confirmed_at": "2026-02-04T10:30:00Z",
  "updated_at": "2026-02-04T10:30:00Z"
}
```

**Lógica Especial:**
- Si `status = 'CONFIRMADO'` → Actualizar `confirmed_at = NOW()`
- Si `status = 'ASISTIO'` → Actualizar `attended_at = NOW()`
- Si `status = 'CANCELADO'` → Actualizar `canceled_at = NOW()`

---

### 4. `POST /api/bots/{bot_id}/event_sessions/{session_id}/bulk-mark-attendance`

**Descripción**: Marcar asistencia masiva después del evento (útil para QR codes o lista física).

**Request Body:**
```json
{
  "contact_ids": ["3474", "3475", "3476"],
  "status": "ASISTIO"
}
```

**Re6ponse:**
```json
{
  "updated": 3,
  "failed": 0,
  "details": [
    {"contact_id": "3474", "status": "success"},
    {"contact_id": "3475", "status": "success"},
    {"contact_id": "3476", "status": "success"}
  ]
}
```

---

### 5. `GET /api/bots/{bot_id}/event_registrations/export`

**Descripción**: Exportar registros en formato CSV para análisis.

**Query Parameters:**
- `event_id` (optional)
- `event_session_id` (optional)
- `status` (optional): Filtrar por estado

**Response:**
- **Content-Type**: `text/csv`
- **Filename**: `event-registrations-{date}.csv`

**CSV Structure:**
```csv
ID,Contact ID,Contact Name,Contact Phone,Event,Session,Status,Registered At,Confirmed At,Attended At,Source
123,3474,Juan Pérez,+573001234567,Webinar en vivo,Workshop 3D,CONFIRMADO,2026-02-03 21:50:33,2026-02-04 10:30:00,,whatsapp_campaign
```

---

## 🔄 Flujos de Usuario

### Flujo 1: Consultar Evento Próximo (No ha pasado)
1. Usuario entra a "Monitor de Eventos"
2. Selecciona evento: "Webinar en vivo"
3. Selecciona sesión: "Workshop de casos 3D - 10 Feb 2026"
4. Sistema muestra:
   - **Banner azul**: "El evento aún no ha comenzado"
   - **Estadísticas**:
     - Total Invitados: 50
     - Pre-registrados: 15
     - Confirmados: 30
     - Asistieron: 0 (aún no aplica)
   - **Lista de contactos** con nombres, teléfonos y estados

### Flujo 2: Consultar Evento Pasado
1. Usuario entra a "Monitor de Eventos"
2. Selecciona evento: "Webinar Marketing 2025"
3. Selecciona sesión: "Sesión 1 - 15 Ene 2025"
4. Sistema muestra:
   - **Banner verde**: "El evento ya finalizó"
   - **Estadísticas**:
     - Total Invitados: 100
     - Pre-registrados: 20
     - Confirmados: 75
     - Asistieron: 60
     - No Asistieron: 15
     - Cancelados: 5
   - **Lista de contactos** con estados finales

### Flujo 3: Marcar Asistencia Manual
1. Evento finalizó
2. Usuario tiene lista física de asistentes
3. Usa endpoint `bulk-mark-attendance` con IDs de quienes asistieron
4. Sistema actualiza registros y muestra estadísticas actualizadas

---

## 📊 Consideraciones de Frontend (Ya Implementado)

El frontend ahora incluye:

### Vista "Monitor de Eventos"
- ✅ Selector de Evento y Sesión
- ✅ Detección automática si el evento ya pasó
- ✅ 6 tarjetas de estadísticas con gradientes de colores
- ✅ Tabla completa con información de contactos
- ✅ Badges de color según estado de inscripción
- ✅ Botón "Actualizar" para refrescar datos
- ✅ Integración con sistema de contactos existente
- ✅ **Normalización automática de estados del backend**
- ✅ **Formateo inteligente de fuentes de registro**

### Estados Visuales
- **Amarillo**: PRE_REGISTRO
- **Azul**: CONFIRMADO
- **Verde**: ASISTIO
- **Rojo**: NO_SHOW
- **Gris**: CANCELADO

### Formateo de Fuentes
El campo `source` se muestra en español:
- `whatsapp_campaign` → "Campaña WhatsApp"
- `manual` → "Manual"
- `web_form` → "Formulario Web"
- `api` → "API"
- `import` → "Importación"
- `null` / vacío → "Manual" (por defecto)

### Normalización de Estados
El frontend normaliza automáticamente todos los formatos de estado:
- Convierte minúsculas a MAYÚSCULAS
- Traduce inglés a español
- Maneja variantes (`canceled`, `cancelled`, `cancelado` → `CANCELADO`)
- Cuenta correctamente en estadísticas agregadas

---

## 💡 Casos de Uso Reales

### Caso 1: Webinar Marketing
- **Fecha**: 15 de marzo, 10:00 AM
- **Invitados**: 200 vía campaña de WhatsApp
- **Pre-registrados**: 180 (90%)
- **Confirmados**: 120 (60%)
- **Asistieron**: 95 (47.5%)
- **Conclusión**: Tasa de conversión del 79% (confirmados que asistieron)

### Caso 2: Workshop Presencial
- **Fecha**: 20 de marzo, 2:00 PM
- **Capacidad**: 50 personas
- **Invitados**: 80 (sobre-invitar)
- **Confirmados**: 55 (5 extra por lista de espera)
- **Asistieron**: 48 (87%)
- **No-Show**: 7 (13%)

---

## 🔐 Permisos y Seguridad

- ✅ Solo usuarios autenticados pueden ver registros
- ✅ Filtrar por `bot_id` para aislar datos entre bots
- ✅ Los contactos deben pertenecer al mismo bot
- ⚠️ No exponer información sensible en logs

---

## 🧪 Endpoints a Implementar (Prioridad)

| Endpoint | Prioridad | Complejidad | Tiempo Est. | Bloqueante |
|----------|-----------|-------------|-------------|------------|
| `GET /sessions/{id}/invites-and-registrations` | **CRÍTICA** | Alta | 3h | ✅ SÍ |
| `GET /event_sessions/{id}/stats` | **CRÍTICA** | Alta | 2.5h | ✅ SÍ |
| `GET /events/{id}/stats` | Alta | Media | 2h | No |
| `PATCH /registrations/{id}/status` | Media | Baja | 1h | No |
| `POST /sessions/{id}/bulk-mark-attendance` | Media | Media | 1.5h | No |
| `GET /event_registrations/export` | Baja | Media | 2h | No |

**Total estimado**: ~12 horas de desarrollo backend

### 🔥 Bloqueantes Críticos (Implementar PRIMERO)

1. **`/invites-and-registrations`**: Sin este endpoint, el monitor no muestra invitados sin respuesta
2. **`/stats` mejorado**: Estadísticas actuales están incorrectas (ignoran invitaciones)

---

## ✅ Estado Actual

### Frontend (Completado) ✅
- [x] Nueva pestaña "Monitor de Eventos"
- [x] Selector de Evento/Sesión
- [x] Detección de evento pasado vs futuro
- [x] 6 tarjetas de estadísticas con gradientes
- [x] Tabla de registros con información consolidada
- [x] Normalización de estados del backend
- [x] Formateo de fuentes de registro
- [x] **Actualizado para usar endpoint consolidado `/invites-and-registrations`**
- [x] Integración con contactos

### Backend (En Desarrollo)
- [x] Endpoint GET `/event_registrations` ✅ Existe (incompleto - solo registros)
- [x] Endpoint GET `/event_invites` ✅ Existe
- [x] 🔥 Endpoint GET `/event_sessions/{id}/invites-and-registrations` ✅ **IMPLEMENTADO**
- [ ] 🔥 Endpoint GET `/event_sessions/{id}/stats` ⏳ **CRÍTICO**
- [ ] Endpoint GET `/events/{id}/stats` (opcional)lan de Implementación Backend

### Fase 1: Crítico (Bloqueantes - 5.5h)
1. **Crear `/invites-and-registrations`** (3h)
   - Query SQL con FULL OUTER JOIN
   - Resolver nombres de contactos
   - Determinar `participation_status`
   - Normalizar estados a español/mayúsculas

2. **Mejorar `/event_sessions/{id}/stats`** (2.5h)
   - Integrar conteo de `event_invites`
   - Calcular `sin_respuesta = invited - registrations`
   - Agregar `invites_summary` con estados de envío
   - Calcular `tasa_respuesta`

### Fase 2: Alta Prioridad (4h)
3. **Crear `/events/{id}/stats`** (2h)
   - Agregación multi-sesión
   - Estadísticas consolidadas por evento

4. **Crear `PATCH /registrations/{id}/status`** (1h)
   - Actualizar estado manualmente
   - Auto-actualizar timestamps

5. **Crear `POST /bulk-mark-attendance`** (1h)
   - Marcar asistencia masiva

### Fase 3: Mejoras (2h)
6. **Crear `/registrations/export`** (2h)
   - Exportar CSV con datos consolidados

---

## 📋 Resumen de Cambios Necesarios

### SQL a Implementar

```sql
-- Vista consolidada recomendada
CREATE VIEW v_event_participation AS
SELECT 
  s.id as session_id,
  s.event_id,
  COALESCE(i.contact_id, r.contact_id) as contact_id,
  i.phone_number,
  i.campaign_name,
  i.channel as invite_channel,
  i.status as invite_status,
  i.sent_at as invited_at,
  r.registration_status,
  r.registered_at,
  r.confirmed_at,
  r.canceled_at,
  r.attended_at,
  r.source as registration_source,
  CASE 
    WHEN r.registration_status ILIKE '%cancel%' THEN 'cancelado'
    WHEN r.registration_status ILIKE '%confirm%' THEN 'confirmado'
    WHEN r.registration_status ILIKE '%asist%' OR r.registration_status ILIKE '%attend%' THEN 'asistio'
    WHEN r.registration_status ILIKE '%no_show%' THEN 'no_show'
    WHEN r.registration_status ILIKE '%pre%' THEN 'pre_registro'
    WHEN r.id IS NOT NULL THEN 'registrado'
    WHEN i.id IS NOT NULL THEN 'invitado_sin_respuesta'
    ELSE 'desconocido'
  END as participation_status
FROM botia.event_sessions s
LEFT JOIN botia.event_invites i ON i.event_session_id = s.id
LEFT JOIN botia.event_registrations r 
  ON r.event_session_id = s.id 
  AND r.contact_id = i.contact_id;
```

### Ejemplo de Response Correcto

**Caso Actual (Problema):**
```
Session ID: 3
GET /event_registrations?event_session_id=3 → []
Monitor muestra: Total Invitados: 0
```

**Caso Corregido (Solución):**
```
Session ID: 3
GET /invites-and-registrations/3 → [
  {
    "contact_id": "3474",
    "contact_name": "Orlando Prado",
    "contact_phone": "+573142376428",
    "participation_status": "invitado_sin_respuesta",
    "invite_status": "rechaza...",
    "invited_at": "2026-02-03T23:42:03Z",
    "registration_status": null
  }
]
Monitor muestra: Total Invitados: 1
```

---

## 🎯 Resultado Esperado

### Vista Monitor Correcta
- ✅ **Total Invitados: 1** (cuenta `event_invites`)
- ✅ **Sin Respuesta: 1** (invitados que no respondieron)
- ✅ **Pre-registrados: 0**
- ✅ **Confirmados: 0**
- ✅ **Cancelados: 0**
- ✅ **Asistieron: 0**

### Métricas de Negocio
- **Tasa de Respuesta**: 0% (0 respuestas / 1 invitado)
- **Tasa de Confirmación**: N/A (ninguno confirmó)
- **Alcance Total**: 1 contacto
- **Estado de Invitación**: "rechaza..." (visible en lista)

¡El frontend ya está listo y esperando estos endpoints
1. **Implementar endpoints de estadísticas** (`/stats`)
2. **Implementar actualización de estado** (`PATCH`)
3. **Implementar asistencia masiva** (bulk)
4. **Implementar exportación CSV** (export)
5. **Testing con datos reales**
6. **Documentación API** (Swagger/OpenAPI)

¡El frontend ya está listo y esperando! 🎉
