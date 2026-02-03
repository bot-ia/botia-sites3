# 📊 Especificación: Monitor de Eventos - Event Registrations

## Resumen
Sistema completo para monitorear y consultar inscripciones a eventos, permitiendo ver en tiempo real quiénes han sido invitados, confirmaron y asistieron a eventos programados.

---

## 🗄️ Tabla Existente: `botia.event_registrations`

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

---

## 📍 Endpoints Existentes (Ya Funcionan)

### `GET /api/bots/{bot_id}/event_registrations`

**Query Parameters:**
- `event_id` (optional): Filtrar por evento
- `event_session_id` (optional): Filtrar por sesión específica

**Response:**
```json
[
  {
    "id": 1,
    "event_session_id": 3,
    "contact_id": "3474",
    "account_tier": "standard",
    "source": "whatsapp_campaign",
    "registration_status": "canceled",
    "registered_at": "2026-02-03T21:50:33.502313Z",
    "confirmed_at": null,
    "canceled_at": "2026-02-03T23:03:35.014495Z",
    "attended_at": null,
    "notes": null,
    "utm_campaign": "Webinar en vivo",
    "utm_source": null,
    "created_at": "2026-02-03T21:50:33.502313Z",
    "updated_at": "2026-02-03T23:03:35.014495Z"
  }
]
```

✅ **Este endpoint ya existe y funciona correctamente.**

⚠️ **Nota Importante sobre Estados**: El backend devuelve estados en minúsculas inglés (`"canceled"`, `"confirmed"`, etc.), pero el frontend ha sido actualizado para normalizarlos automáticamente a formato español mayúsculas (`"CANCELADO"`, `"CONFIRMADO"`, etc.) para una mejor experiencia de usuario.

### Mapeo de Estados Backend → Frontend

| Backend (API) | Frontend (UI) | Traducción ES |
|---------------|---------------|---------------|
| `canceled` / `cancelado` | `CANCELADO` | Cancelado |
| `confirmed` / `confirmado` | `CONFIRMADO` | Confirmado |
| `pre_registro` | `PRE_REGISTRO` | Pre-registro |
| `attended` / `asistio` | `ASISTIO` | Asistió |
| `no_show` | `NO_SHOW` | No Asistió |

---

## 🆕 Endpoints Adicionales Requeridos

### 1. `GET /api/bots/{bot_id}/events/{event_id}/stats`

**Descripción**: Obtener estadísticas agregadas de un evento completo.

**Response:**
```json
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
  "event_session_id": 10,
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

**Response:**
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

| Endpoint | Prioridad | Complejidad | Tiempo Est. |
|----------|-----------|-------------|-------------|
| `GET /events/{id}/stats` | Alta | Media | 2h |
| `GET /event_sessions/{id}/stats` | Alta | Media | 2h |
| `PATCH /registrations/{id}/status` | Media | Baja | 1h |
| `POST /sessions/{id}/bulk-mark-attendance` | Media | Media | 1.5h |
| `GET /event_registrations/export` | Baja | Media | 2h |

**Total estimado**: ~8.5 horas de desarrollo backend

---

## ✅ Estado Actual

### Frontend (Completado) ✅
- [x] Nueva pestaña "Monitor de Eventos"
- [x] Selector de Evento/Sesión
- [x] Detección de evento pasado vs futuro
- [x] 6 tarjetas de estadísticas
- [x] Tabla de registros con colores
- [x] Botón refrescar
- [x] Traducciones ES/EN
- [x] Integración con contactos

### Backend (Pendiente)
- [x] Endpoint GET `/event_registrations` ✅ Ya existe
- [ ] Endpoint GET `/events/{id}/stats` ⏳
- [ ] Endpoint GET `/event_sessions/{id}/stats` ⏳
- [ ] Endpoint PATCH `/registrations/{id}/status` ⏳
- [ ] Endpoint POST `/bulk-mark-attendance` ⏳
- [ ] Endpoint GET `/registrations/export` ⏳

---

## 🚀 Próximos Pasos

1. **Implementar endpoints de estadísticas** (`/stats`)
2. **Implementar actualización de estado** (`PATCH`)
3. **Implementar asistencia masiva** (bulk)
4. **Implementar exportación CSV** (export)
5. **Testing con datos reales**
6. **Documentación API** (Swagger/OpenAPI)

¡El frontend ya está listo y esperando! 🎉
