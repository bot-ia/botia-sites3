# 📢 Especificación: Notificaciones Automáticas para Eventos

## Resumen
Adaptar el sistema de notificaciones automáticas para soportar eventos (programas, webinars, workshops) con mapeo inteligente de 8 parámetros usando IA, similar al sistema existente de campañas.

**Estructura de Tablas:** Igual que campañas con tabla principal + tabla de parámetros separada:
- `notification_configs` (configuración base)
- `notification_config_parameters` (mapeo de parámetros)

---

## 🎯 Objetivo

### Problema Actual
Las notificaciones automáticas (`NotificationConfig`) están diseñadas para **citas médicas** con campos específicos como:
- `appointment_reminder`
- `payment_reminder`
- `pre_procedure_instructions`
- `apply_if_payment_status`
- `apply_if_confirmation_status`

### Solución Required
Adaptar para **eventos** (programas,webinars, workshops) con:
- Nuevos tipos de notificación relacionados a eventos
- **Mapeo de parámetros dinámicos** (igual que campañas)
- Auto-completado con IA usando datos de eventos/sesiones
- 8 parámetros típicos: `{{1}}` nombre, `{{2}}` tipo, `{{3}}` titulo, `{{4}}` fecha, `{{5}}` hora, `{{6}}` zona, `{{7}}` modalidad, `{{8}}` link

---

## 🗄️ Cambios en Base de Datos

### Tabla `botia.notification_configs` (CREAR - No existe)

```sql
-- Tabla principal de configuraciones de notificaciones automáticas
CREATE TABLE IF NOT EXISTS botia.notification_configs (
    id SERIAL PRIMARY KEY,
    bot_id TEXT NOT NULL,
    notification_type TEXT NOT NULL,
    template_id INTEGER NOT NULL REFERENCES botia.wa_templates(id),
    offset_minutes INTEGER NOT NULL DEFAULT -1440, -- -24 horas por defecto
    is_active BOOLEAN NOT NULL DEFAULT true,
    
    -- Filtros para citas médicas (opcional)
    apply_if_payment_status TEXT,
    apply_if_confirmation_status TEXT,
    
    -- Campos para eventos (opcional)
    event_id INTEGER REFERENCES botia.events(id),
    event_session_id INTEGER REFERENCES botia.event_sessions(id),
    
    metadata JSONB,
    health_status TEXT DEFAULT 'ok', -- 'ok', 'warning', 'error'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices recomendados
CREATE INDEX IF NOT EXISTS idx_notification_configs_bot_id ON botia.notification_configs(bot_id);
CREATE INDEX IF NOT EXISTS idx_notification_configs_event_id ON botia.notification_configs(event_id);
CREATE INDEX IF NOT EXISTS idx_notification_configs_event_session_id ON botia.notification_configs(event_session_id);
CREATE INDEX IF NOT EXISTS idx_notification_configs_is_active ON botia.notification_configs(is_active);
```

### Tabla `botia.notification_config_parameters` (CREAR - Similar a campañas)

```sql
-- Tabla de parámetros mapeados (similar a notification_campaign_parameters)
CREATE TABLE IF NOT EXISTS botia.notification_config_parameters (
    id SERIAL PRIMARY KEY,
    config_id INTEGER NOT NULL REFERENCES botia.notification_configs(id) ON DELETE CASCADE,
    template_param_id INTEGER NOT NULL REFERENCES botia.wa_template_parameters(id),
    assign_type TEXT NOT NULL, -- 'fixed_value', 'contact_field', 'event_field', 'session_field'
    assign_value TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(config_id, template_param_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_config_params_config_id ON botia.notification_config_parameters(config_id);
CREATE INDEX IF NOT EXISTS idx_config_params_template_param ON botia.notification_config_parameters(template_param_id);
```

### Comparación con Campañas

| Campañas | Notificaciones Automáticas |
|----------|---------------------------|
| `notification_campaigns` | `notification_configs` |
| `notification_campaign_parameters` | `notification_config_parameters` |
| Ejecución manual | Ejecución automática por evento |
| `status`: DRAFT, READY, RUNNING | `is_active`: true/false |

### Tipos de Asignación (`assign_type`)

| Tipo | Descripción | Ejemplo `assign_value` |
|------|-------------|------------------------|
| `contact_field` | Campo del contacto | `name`, `email`, `phone`, `account_tier` |
| `event_field` | Campo del evento | `title`, `description`, `brand`, `category`, `topic` |
| `session_field` | Campo de la sesión | `name`, `start_at`, `end_at`, `location_name`, `location_address`, `meeting_link`, `speaker_name`, `duration_minutes` |
| `fixed_value` | Valor fijo/hardcoded | `"Bienvenido"`, `"Confirma tu asistencia"` |

---

## 📡 Endpoints Nuevos/Modificados

### 1. `POST /api/bots/{bot_id}/notifications/configs` (Modificar)

**Descripción**: Crear configuración de notificación automática con parámetros.

**Lógica Backend:**
1. Crear registro en `notification_configs`
2. Si vienen `parameters`, crear registros en `notification_config_parameters`
3. Retornar config completo con parámetros unidos

**Request Body:**
```json
{
  "notification_type": "event_reminder",
  "template_id": 42,
  "offset_minutes": -1440,
  "is_active": true,
  "event_id": 5,
  "event_session_id": null,
  "parameters": [
    {
      "template_param_id": 123,
      "assign_type": "contact_field",
      "assign_value": "name"
    },
    {
      "template_param_id": 124,
      "assign_type": "event_field",
      "assign_value": "title"
    },
    {
      "template_param_id": 125,
      "assign_type": "session_field",
      "assign_value": "start_at"
    }
  ]
}
```

**Response:**
```json
{
  "id": 15,
  "bot_id": "CONS_ASIS",
  "notification_type": "event_reminder",
  "template_id": 42,
  "offset_minutes": -1440,
  "is_active": true,
  "event_id": 5,
  "event_session_id": null,
  "parameters": [
    {
      "id": 1,
      "config_id": 15,
      "template_param_id": 123,
      "assign_type": "contact_field",
      "assign_value": "name"
    },
    {
      "id": 2,
      "config_id": 15,
      "template_param_id": 124,
      "assign_type": "event_field",
      "assign_value": "title"
    }
  ],
  "created_at": "2026-02-04T10:00:00Z"
}
```

---

### 2. `PUT /api/bots/{bot_id}/notifications/configs/{config_id}` (Modificar)

**Descripción**: Actualizar configuración completa (reemplaza parámetros).

**Lógica Backend:**
1. Actualizar registro en `notification_configs`
2. Eliminar parámetros antiguos: `DELETE FROM notification_config_parameters WHERE config_id = X`
3. Insertar nuevos parámetros si vienen en `parameters`
4. Retornar config actualizado con parámetros

**Request Body:**
```json
{
  "offset_minutes": -2880,
  "is_active": false,
  "parameters": [
    {
      "template_param_id": 123,
      "assign_type": "fixed_value",
      "assign_value": "Estimado participante"
    }
  ]
}
```

**Request Body:**
```json
{
  "is_active": true,
  "offset_minutes": -2880,
  "event_id": 5,
  "event_session_id": 12,
  "parameters": [
    {
      "template_param_id": 123,
      "assign_type": "contact_field",
      "assign_value": "name"
    }
  ]
}
```

---

### 3. `POST /api/bots/{bot_id}/notifications/configs/{config_id}/test` (NUEVO)

**Descripción**: Enviar notificación de prueba para validar configuración.

**Diferencia con Citas Médicas:**
- Citas médicas: Usa datos reales de appointment + contact
- Eventos: Usa datos reales de event + session + contact

**Lógica Backend:**
1. Obtener `notification_config` con ID especificado
2. Validar que `config.bot_id == bot_id`
3. Obtener template y parámetros de la config
4. Resolver parámetros según tipo de notificación:
   - Si es `event_*` tipo → Usar datos de evento/sesión
   - Si es `appointment_*` tipo → Usar datos de cita médica
5. Enviar notificación al teléfono especificado

**Request Body:**
```json
{
  "phone_number": "+573142376428"
}
```

**Alternativa Compatible:**
```json
{
  "phone": "+573142376428"
}
```

**Nota Backend:** El backend acepta tanto `phone_number` (recomendado) como `phone` por compatibilidad.

**Response:**
```json
{
  "success": true,
  "message": "Test notification sent successfully",
  "phone": "+573142376428",
  "resolved_params": {
    "1": "Orlando Prado",
    "2": "Webinar",
    "3": "Marketing Digital 2026",
    "4": "15 de Marzo, 2026",
    "5": "10:00 AM",
    "6": "GMT-5",
    "7": "Virtual",
    "8": "https://zoom.us/j/123456"
  }
}
```

**Casos de Error:**
```json
{
  "success": false,
  "error": "No event data found for config",
  "detail": "Config type is 'event_reminder' but no event_id or event_session_id specified"
}
```

**Implementación Backend:**
```python
@router.post("/bots/{bot_id}/notifications/configs/{config_id}/test")
async def test_notification_config(
    bot_id: str,
    config_id: int,
    request: TestNotificationRequest,
    db: Session = Depends(get_db)
):
    """Enviar notificación de prueba"""
    
    # 1. Obtener config
    config = db.query(NotificationConfig).filter_by(
        id=config_id,
        bot_id=bot_id
    ).first()
    if not config:
        raise HTTPException(404, "Config not found")
    
    # 2. Obtener template
    template = db.query(WATemplate).filter_by(id=config.template_id).first()
    if not template:
        raise HTTPException(404, "Template not found")
    
    # 3. Obtener parámetros de la config
    config_params = db.query(NotificationConfigParameter).filter_by(
        config_id=config.id
    ).order_by(NotificationConfigParameter.template_param_id).all()
    
    # 4. Resolver parámetros según tipo
    resolved_params = {}
    
    if config.notification_type.startswith('event_'):
        # Tipo evento - necesitamos datos de evento/sesión
        event = None
        session = None
        
        if config.event_id:
            event = db.query(Event).filter_by(id=config.event_id).first()
        
        if config.event_session_id:
            session = db.query(EventSession).filter_by(id=config.event_session_id).first()
        elif event:
            # Usar primera sesión del evento
            session = db.query(EventSession).filter_by(event_id=event.id).first()
        
        if not event and not session:
            raise HTTPException(400, {
                "success": False,
                "error": "No event data found",
                "detail": "Config is event-based but no event/session specified"
            })
        
        # Obtener contacto de prueba (primero del bot o crear uno ficticio)
        contact = db.query(Contact).filter_by(
            bot_id=bot_id,
            phone=request.phone
        ).first()
        
        contact_data = {
            "name": contact.name if contact else "Usuario Prueba",
            "email": contact.email if contact else "test@example.com",
            "phone": request.phone,
            "account_tier": contact.account_tier if contact else "A"
        }
        
        # Resolver cada parámetro
        for param in config_params:
            template_param = db.query(TemplateParameter).filter_by(
                id=param.template_param_id
            ).first()
            
            value = None
            
            if param.assign_type == 'contact_field':
                value = contact_data.get(param.assign_value, '')
            
            elif param.assign_type == 'event_field' and event:
                value = getattr(event, param.assign_value, '')
            
            elif param.assign_type == 'session_field' and session:
                raw_value = getattr(session, param.assign_value, '')
                
                # Formateo especial para fechas/horas
                if param.assign_value == 'start_at' and session.start_at:
                    # Determinar si es fecha u hora según nombre del parámetro
                    param_name = template_param.param_name.lower() if template_param else ''
                    if 'fecha' in param_name or 'date' in param_name:
                        value = session.start_at.strftime('%d de %B, %Y')
                    elif 'hora' in param_name or 'time' in param_name:
                        value = session.start_at.strftime('%I:%M %p')
                    else:
                        value = session.start_at.strftime('%d/%m/%Y %I:%M %p')
                
                elif param.assign_value == 'meeting_link':
                    value = raw_value if raw_value else 'No disponible'
                
                else:
                    value = raw_value
            
            elif param.assign_type == 'fixed_value':
                value = param.assign_value
            
            resolved_params[str(template_param.param_index)] = value or ''
    
    else:
        # Tipo appointment - lógica existente de citas médicas
        # ... (código existente)
        pass
    
    # 5. Enviar notificación
    try:
        await send_whatsapp_template(
            phone=request.phone,
            template_name=template.template_name,
            params=list(resolved_params.values())
        )
        
        return {
            "success": True,
            "message": "Test notification sent successfully",
            "phone": request.phone,
            "resolved_params": resolved_params
        }
    
    except Exception as e:
        raise HTTPException(500, {
            "success": False,
            "error": "Failed to send notification",
            "detail": str(e)
        })
```

---

### 4. `POST /api/bots/{bot_id}/notifications/configs/suggest-event-mappings` (Nuevo)

**Descripción**: Usar IA (Gemini) para sugerir mapeo de parámetros de plantilla basado en datos de evento/sesión.

**Request Body:**
```json
{
  "template_id": 42,
  "event_id": 5,
  "event_session_id": 12
}
```

**Response:**
```json
{
  "suggestions": [
    {
      "param_index": 1,
      "template_param_id": 123,
      "param_name": "name",
      "assign_type": "contact_field",
      "assign_value": "name",
      "reasoning": "El parámetro se llama 'name', mapeo directo con contact.name"
    },
    {
      "param_index": 2,
      "template_param_id": 124,
      "param_name": "tipo",
      "assign_type": "event_field",
      "assign_value": "category",
      "reasoning": "'tipo' coincide con la categoría del evento"
    },
    {
      "param_index": 3,
      "template_param_id": 125,
      "param_name": "titulo",
      "assign_type": "event_field",
      "assign_value": "title",
      "reasoning": "Mapeo directo con event.title"
    },
    {
      "param_index": 4,
      "template_param_id": 126,
      "param_name": "fecha",
      "assign_type": "session_field",
      "assign_value": "start_at",
      "reasoning": "La fecha del evento viene de session.start_at"
    },
    {
      "param_index": 5,
      "template_param_id": 127,
      "param_name": "hora",
      "assign_type": "session_field",
      "assign_value": "start_at",
      "reasoning": "La hora se extrae de session.start_at"
    },
    {
      "param_index": 6,
      "template_param_id": 128,
      "param_name": "zona",
      "assign_type": "session_field",
      "assign_value": "timezone",
      "reasoning": "Zona horaria de la sesión"
    },
    {
      "param_index": 7,
      "template_param_id": 129,
      "param_name": "modalidad",
      "assign_type": "session_field",
      "assign_value": "meeting_link",
      "reasoning": "Si hay meeting_link es 'Virtual', sino 'Presencial'"
    },
    {
      "param_index": 8,
      "template_param_id": 130,
      "param_name": "link",
      "assign_type": "session_field",
      "assign_value": "meeting_link",
      "reasoning": "Link de la reunión virtual"
    }
  ]
}
```

---

## 🧠 Lógica de IA (Gemini)

### Prompt para Auto-completado de Eventos

```
Eres un asistente experto en mapear parámetros de plantillas de WhatsApp para notificaciones de eventos.

Tienes una plantilla de WhatsApp con {N} parámetros que deben ser llenados automáticamente.

DATOS DISPONIBLES:

1. CONTACTO (contact_field):
   - name: Nombre completo del contacto
   - email: Correo electrónico
   - phone: Número de teléfono
   - account_tier: Tipo de cuenta (A, B, C, D)

2. EVENTO (event_field):
   - title: Título del evento (ej. "Webinar de Marketing Digital")
   - description: Descripción completa
   - brand: Marca/empresa organizadora
   - category: Categoría (ej. "Webinar", "Workshop", "Conferencia")
   - topic: Tema principal

3. SESIÓN (session_field):
   - name: Nombre de la sesión específica
   - start_at: Fecha y hora de inicio (ISO 8601)
   - end_at: Fecha y hora de fin
   - location_name: Nombre del lugar
   - location_address: Dirección física
   - meeting_link: URL para sesión virtual
   - speaker_name: Nombre del expositor
   - duration_minutes: Duración en minutos

4. FIJO (fixed_value):
   - Cualquier texto estático

PLANTILLA:
{template_data}

PARÁMETROS:
{parameters}

EVENTO ACTUAL:
{event_data}

SESIÓN ACTUAL:
{session_data}

REGLAS:
1. Analiza el nombre/alias de cada parámetro (ej. "nombre", "titulo", "fecha")
2. Determina la mejor fuente de datos (contact_field, event_field, session_field, fixed_value)
3. Asigna el campo específico que corresponde
4. Si el parámetro es ambiguo, prioriza:
   - Datos del contacto para personalización
   - Datos de la sesión sobre el evento (son más específicos)
   - Valores fijos solo si no hay mejor opción

5. CASOS ESPECIALES:
   - "fecha" → session_field: start_at
   - "hora" → session_field: start_at (extraer solo hora)
   - "zona" → session_field: timezone
   - "modalidad" → session_field: meeting_link (si existe = "Virtual", sino = "Presencial")
   - "link" → session_field: meeting_link
   - "ubicación" → session_field: location_name o location_address
   - "expositor" o "speaker" → session_field: speaker_name

SALIDA:
Devuelve JSON con el siguiente formato para cada parámetro:
{
  "param_index": 1,
  "template_param_id": 123,
  "assign_type": "contact_field",
  "assign_value": "name",
  "reasoning": "Explicación breve"
}
```

---

## 🔄 Flujo de Ejecución

### Escenario: Recordatorio de Webinar

1. **Configuración Inicial**:
   - Admin crea evento "Webinar de Marketing 2026"
   - Evento tiene 3 sesiones: "Introducción", "Casos de Uso", "Q&A"
   - Se crea NotificationConfig:
     - `notification_type`: "event_reminder"
     - `template_id`: 42 (plantilla "recordatorio_webinar")
     - `offset_minutes`: -1440 (24 horas antes)
     - `event_id`: 5
     - `event_session_id`: null (aplica a todas las sesiones)

2. **Auto-completado de Parámetros con IA**:
   - Admin hace clic en "Autocompletar con IA"
   - Frontend envía: `POST /notifications/configs/suggest-event-mappings`
   - Backend usa Gemini para analizar:
     - Plantilla tiene 8 parámetros: {{1}} - {{8}}
     - Nombres: name, tipo, titulo, fecha, hora, zona, modalidad, link
     - Contexto del evento y sesión
   - Gemini responde con mapeos sugeridos
   - Frontend aplica sugerencias automáticamente

3. **Guardado**:
   - Admin revisa y guarda la configuración
   - Backend almacena `parameters` en JSONB:
     ```json
     [
       {"template_param_id": 123, "assign_type": "contact_field", "assign_value": "name"},
       {"template_param_id": 124, "assign_type": "event_field", "assign_value": "category"},
       {"template_param_id": 125, "assign_type": "event_field", "assign_value": "title"},
       {"template_param_id": 126, "assign_type": "session_field", "assign_value": "start_at"},
       {"template_param_id": 127, "assign_type": "session_field", "assign_value": "start_at"},
       {"template_param_id": 128, "assign_type": "fixed_value", "assign_value": "GMT-5"},
       {"template_param_id": 129, "assign_type": "session_field", "assign_value": "meeting_link"},
       {"template_param_id": 130, "assign_type": "session_field", "assign_value": "meeting_link"}
     ]
     ```

4. **Ejecución Automática**:
   - Worker/Cron ejecuta cada hora
   - Busca `event_sessions` con:
     - `start_at` dentro de los próximos 1440 minutos (24 horas)
     - Tiene `NotificationConfig` activa
   - Para cada sesión encontrada:
     - Obtiene lista de `event_invites` o `event_registrations`
     - Para cada contacto:
       - Resuelve parámetros dinámicamente:
         ```python
         params = []
         for p in config.parameters:
             if p.assign_type == 'contact_field':
                 value = contact[p.assign_value]
             elif p.assign_type == 'event_field':
                 value = event[p.assign_value]
             elif p.assign_type == 'session_field':
                 value = session[p.assign_value]
                 # Formateo especial para fechas/horas
                 if p.assign_value == 'start_at':
                     value = format_datetime(value)
             elif p.assign_type == 'fixed_value':
                 value = p.assign_value
             params.append(value)
         ```
       - Encola notificación en `notification_queue`

---

## 🎨 Cambios en Frontend

### 1. Extender `NotificationType`

```typescript
// src/models.ts
export type NotificationType =
  // Existing (citas médicas)
  | 'appointment_reminder'
  | 'payment_reminder'
  | 'pre_procedure_instructions'
  | 'post_procedure_followup'
  | 'birthday_greeting'
  | 'no_show_followup'
  | 'reactivation_campaign'
  | 'marketing_promo'
  // New (eventos)
  | 'event_reminder'
  | 'event_confirmation'
  | 'event_followup'
  | 'event_cancellation'
  | 'event_update';
```

### 2. Extender `NotificationConfig` y Crear `NotificationConfigParameter`

```typescript
// src/models.ts

// Ya existe en models.ts
export interface NotificationConfig {
  id: number;
  bot_id: string;
  notification_type: NotificationType;
  template_id: number;
  offset_minutes: number;
  is_active: boolean;
  
  // Filtros para citas médicas
  apply_if_payment_status?: PaymentStatus;
  apply_if_confirmation_status?: ConfirmationStatus;
  
  // Campos para eventos
  event_id?: number | null;
  event_session_id?: number | null;
  
  // Los parámetros se manejan en tabla separada (similar a campañas)
  parameters?: NotificationConfigParameter[];
  
  metadata?: any;
  health_status?: 'ok' | 'warning' | 'error'; 
}

// NUEVO: Interface para parámetros en tabla separada
export interface NotificationConfigParameter {
  id?: number;
  config_id: number;
  template_param_id: number;
  assign_type: 'fixed_value' | 'contact_field' | 'event_field' | 'session_field';
  assign_value: string;
  created_at?: string;
  updated_at?: string;
}
```

### 3. Modal de Configuración - Agregar Sección

```html
<!-- src/components/notifications/notifications.component.html -->
@case ('notificationConfig') {
  @if(editingConfig(); as config) {
    <div class="bg-white dark:bg-slate-800 rounded-lg shadow-2xl p-8 w-full max-w-4xl border border-slate-200 dark:border-slate-700">
      <h2 class="text-2xl font-bold mb-6 text-slate-900 dark:text-white">
        {{ languageService.T(config.id ? 'editAutomation' : 'createAutomation') }}
      </h2>
      <form #form="ngForm" (ngSubmit)="saveConfig()">
        <div class="space-y-6">
          <!-- Tipo de Notificación -->
          <div>...</div>
          
          <!-- Plantilla -->
          <div>...</div>
          
          <!-- NUEVO: Selector de Evento/Sesión -->
          @if (isEventBasedNotification(config.notification_type)) {
            <fieldset class="border border-slate-200 dark:border-slate-700 rounded-md p-4">
              <legend class="px-2 font-semibold text-slate-600 dark:text-slate-300">
                {{ languageService.T('eventScope') }}
              </legend>
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="block mb-2 text-sm font-medium text-slate-500 dark:text-slate-400">
                    {{ languageService.T('event') }}
                  </label>
                  <select [(ngModel)]="config.event_id" (ngModelChange)="onAutomationEventChange($event)" name="event_id" class="w-full bg-slate-100 dark:bg-slate-700 p-2 rounded-md border border-slate-300 dark:border-slate-600">
                    <option [ngValue]="null">{{ languageService.T('allEvents') }}</option>
                    @for(event of events(); track event.id) {
                      <option [ngValue]="event.id">{{ event.title }}</option>
                    }
                  </select>
                </div>
                <div>
                  <label class="block mb-2 text-sm font-medium text-slate-500 dark:text-slate-400">
                    {{ languageService.T('selectSession') }}
                  </label>
                  <select [(ngModel)]="config.event_session_id" name="event_session_id" [disabled]="!config.event_id" class="w-full bg-slate-100 dark:bg-slate-700 p-2 rounded-md border border-slate-300 dark:border-slate-600 disabled:opacity-50">
                    <option [ngValue]="null">{{ languageService.T('allSessions') }}</option>
                    @for(session of automationEventSessions(); track session.id) {
                      <option [ngValue]="session.id">{{ session.name }}</option>
                    }
                  </select>
                </div>
              </div>
            </fieldset>

            <!-- NUEVO: Mapeo de Parámetros -->
            @if (selectedAutomationTemplate(); as template) {
              @if (template.parameters && template.parameters.length > 0) {
                <fieldset class="border border-slate-200 dark:border-slate-700 rounded-md p-4">
                  <legend class="px-2 font-semibold text-slate-600 dark:text-slate-300">
                    {{ languageService.T('templateParams') }}
                  </legend>
                  
                  <button type="button" (click)="autoFillAutomationParameters()" [disabled]="isAiSuggesting()" class="mb-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold py-2 px-4 rounded-lg text-sm flex items-center disabled:opacity-50 disabled:cursor-not-allowed shadow-md">
                    @if(isAiSuggesting()) {
                      <svg class="animate-spin h-5 w-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      {{ languageService.T('analyzingWithAI') }}
                    } @else {
                      <svg class="w-5 h-5 mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/>
                      </svg>
                      {{ languageService.T('autoFillWithAI') }}
                    }
                  </button>

                  <div class="space-y-4">
                    @for(param of template.parameters; track param.id) {
                      <div class="bg-slate-50 dark:bg-slate-900/50 rounded p-3">
                        <label class="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">
                          {{ '{' + '{' + (param.param_name || param.param_index) + '}' + '}' }}
                        </label>
                        <div class="grid grid-cols-2 gap-2">
                          <select [(ngModel)]="param.assign_type" [name]="'assign_type_' + param.id" class="bg-slate-100 dark:bg-slate-700 p-2 rounded-md border border-slate-300 dark:border-slate-600 text-sm">
                            <option value="">{{ languageService.T('selectType') }}</option>
                            <option value="contact_field">{{ languageService.T('contactField') }}</option>
                            <option value="event_field">{{ languageService.T('eventField') }}</option>
                            <option value="session_field">{{ languageService.T('sessionField') }}</option>
                            <option value="fixed_value">{{ languageService.T('fixedValue') }}</option>
                          </select>
                          @if (param.assign_type === 'contact_field') {
                            <select [(ngModel)]="param.assign_value" [name]="'assign_value_' + param.id" class="bg-slate-100 dark:bg-slate-700 p-2 rounded-md border border-slate-300 dark:border-slate-600 text-sm">
                              <option value="">{{ languageService.T('selectField') }}</option>
                              @for(field of availableContactFields(); track field) {
                                <option [value]="field">{{ field }}</option>
                              }
                            </select>
                          }
                          @if (param.assign_type === 'event_field') {
                            <select [(ngModel)]="param.assign_value" [name]="'assign_value_' + param.id" class="bg-slate-100 dark:bg-slate-700 p-2 rounded-md border border-slate-300 dark:border-slate-600 text-sm">
                              <option value="">{{ languageService.T('selectField') }}</option>
                              <option value="title">title</option>
                              <option value="description">description</option>
                              <option value="brand">brand</option>
                              <option value="category">category</option>
                              <option value="topic">topic</option>
                            </select>
                          }
                          @if (param.assign_type === 'session_field') {
                            <select [(ngModel)]="param.assign_value" [name]="'assign_value_' + param.id" class="bg-slate-100 dark:bg-slate-700 p-2 rounded-md border border-slate-300 dark:border-slate-600 text-sm">
                              <option value="">{{ languageService.T('selectField') }}</option>
                              <option value="name">name</option>
                              <option value="start_at">start_at (fecha/hora)</option>
                              <option value="end_at">end_at</option>
                              <option value="location_name">location_name</option>
                              <option value="location_address">location_address</option>
                              <option value="meeting_link">meeting_link</option>
                              <option value="speaker_name">speaker_name</option>
                              <option value="duration_minutes">duration_minutes</option>
                            </select>
                          }
                          @if (param.assign_type === 'fixed_value') {
                            <input type="text" [(ngModel)]="param.assign_value" [name]="'assign_value_' + param.id" class="bg-slate-100 dark:bg-slate-700 p-2 rounded-md border border-slate-300 dark:border-slate-600 text-sm" [placeholder]="languageService.T('enterFixedValue')">
                          }
                        </div>
                      </div>
                    }
                  </div>
                </fieldset>
              }
            }
          }

          <!-- Intervalo de Tiempo -->
          @if (isIntervalBased(config.notification_type)) {
            <fieldset>...</fieldset>
          }

          <!-- Filtros Opcionales (solo citas) -->
          @if (!isEventBasedNotification(config.notification_type)) {
            <fieldset>...</fieldset>
          }

          <!-- Activar -->
          <div>...</div>
        </div>

        <div class="flex justify-end gap-4 mt-8 pt-6 border-t border-slate-200 dark:border-slate-700">
          <button type="button" (click)="closeModal()" class="bg-slate-200 hover:bg-slate-300 dark:bg-slate-600 dark:hover:bg-slate-700 text-slate-800 dark:text-white font-bold py-2 px-4 rounded-lg">{{ languageService.T('cancel') }}</button>
          <button type="submit" [disabled]="form.invalid || !config.template_id" class="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg disabled:bg-slate-400 dark:disabled:bg-slate-500 disabled:cursor-not-allowed">{{ languageService.T('saveAutomation') }}</button>
        </div>
      </form>
    </div>
  }
}
```

### 4. TypeScript - Nuevas Funciones

```typescript
// src/components/notifications/notifications.component.ts

// Signal para sesiones del evento seleccionado en automaciones
automationEventSessions = signal<EventSession[]>([]);
selectedAutomationTemplate = signal<WATemplateDetail | null>(null);

isEventBasedNotification(type: NotificationType): boolean {
  return ['event_reminder', 'event_confirmation', 'event_followup', 'event_cancellation', 'event_update'].includes(type);
}

async onAutomationEventChange(eventId: number | null) {
  if (eventId) {
    const sessions = await this.dataService.getEventSessions(this.botId());
    this.automationEventSessions.set(sessions.filter(s => s.event_id === eventId));
  } else {
    this.automationEventSessions.set([]);
  }
  
  // Reset session selection
  const config = this.editingConfig();
  if (config) {
    config.event_session_id = null;
  }
}

async autoFillAutomationParameters() {
  const config = this.editingConfig();
  if (!config?.template_id) return;

  this.isAiSuggesting.set(true);

  try {
    const response = await this.dataService.suggestEventParameterMappings(
      this.botId(),
      config.template_id,
      config.event_id ?? undefined,
      config.event_session_id ?? undefined
    );

    if (response.suggestions && response.suggestions.length > 0) {
      const template = this.selectedAutomationTemplate();
      if (template) {
        template.parameters = template.parameters.map(param => {
          const suggestion = response.suggestions.find(s => s.template_param_id === param.id);
          if (suggestion) {
            return {
              ...param,
              assign_type: suggestion.assign_type as any,
              assign_value: suggestion.assign_value
            };
          }
          return param;
        });
        this.selectedAutomationTemplate.set({ ...template });
      }

      this.toastService.showSuccess(this.languageService.T('aiSuggestionsApplied'));
    }
  } catch (error: any) {
    console.error('AI suggestion error:', error);
    this.toastService.showError(error?.error?.detail || this.languageService.T('aiSuggestionError'));
  } finally {
    this.isAiSuggesting.set(false);
  }
}
```

### 5. DataService - Nuevo Endpoint

```typescript
// src/services/data.service.ts

async suggestEventParameterMappings(
  botId: string,
  templateId: number,
  eventId?: number,
  eventSessionId?: number
): Promise<{ suggestions: Array<{ template_param_id: number; param_index: number; assign_type: string; assign_value: string; reasoning?: string }> }> {
  const body: any = { template_id: templateId };
  if (eventId) body.event_id = eventId;
  if (eventSessionId) body.event_session_id = eventSessionId;
  
  return firstValueFrom(
    this.http.post<any>(
      `${this.apiService.baseUrl}/bots/${botId}/notifications/configs/suggest-event-mappings`,
      body
    )
  );
}

// NUEVO: Método para probar notificación automática
async testNotificationConfig(
  botId: string,
  configId: number,
  phone: string
): Promise<{ success: boolean; message: string; resolved_params?: any }> {
  return firstValueFrom(
    this.http.post<any>(
      `${this.apiService.baseUrl}/bots/${botId}/notifications/configs/${configId}/test`,
      { phone }
    )
  );
}
```

---

## 🔧 Implementación Backend (Python/FastAPI)

### Endpoint de Sugerencias con IA

```python
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import google.generativeai as genai

router = APIRouter()

class SuggestEventMappingsRequest(BaseModel):
    template_id: int
    event_id: Optional[int] = None
    event_session_id: Optional[int] = None

class ParameterSuggestion(BaseModel):
    param_index: int
    template_param_id: int
    assign_type: str
    assign_value: str
    reasoning: Optional[str] = None

class SuggestEventMappingsResponse(BaseModel):
    suggestions: List[ParameterSuggestion]

@router.post("/bots/{bot_id}/notifications/configs/suggest-event-mappings")
async def suggest_event_parameter_mappings(
    bot_id: str,
    request: SuggestEventMappingsRequest,
    db: Session = Depends(get_db)
) -> SuggestEventMappingsResponse:
    """
    Usar Gemini para sugerir mapeo de parámetros de plantilla para eventos.
    """
    
    # 1. Obtener template y sus parámetros
    template = db.query(WATemplate).filter_by(id=request.template_id, bot_id=bot_id).first()
    if not template:
        raise HTTPException(404, "Template not found")
    
    params = db.query(TemplateParameter).filter_by(template_id=template.id).order_by(TemplateParameter.param_index).all()
    if not params:
        return SuggestEventMappingsResponse(suggestions=[])
    
    # 2. Obtener datos del evento/sesión si existen
    event_data = None
    session_data = None
    
    if request.event_id:
        event = db.query(Event).filter_by(id=request.event_id, bot_id=bot_id).first()
        if event:
            event_data = {
                "title": event.title,
                "description": event.description,
                "brand": event.brand,
                "category": event.category,
                "topic": event.topic
            }
    
    if request.event_session_id:
        session = db.query(EventSession).filter_by(id=request.event_session_id).first()
        if session:
            session_data = {
                "name": session.name,
                "start_at": session.start_at.isoformat() if session.start_at else None,
                "end_at": session.end_at.isoformat() if session.end_at else None,
                "location_name": session.location_name,
                "location_address": session.location_address,
                "meeting_link": session.meeting_link,
                "speaker_name": session.speaker_name
            }
    
    # 3. Construir prompt para Gemini
    params_info = "\n".join([
        f"- Parámetro {{{{{{param.param_index}}}}}}: '{param.param_name or 'sin nombre'}' (ejemplo: '{param.param_example or 'N/A'}')"
        for param in params
    ])
    
    event_info = f"EVENTO:\n{json.dumps(event_data, indent=2, ensure_ascii=False)}" if event_data else "EVENTO: No especificado"
    session_info = f"SESIÓN:\n{json.dumps(session_data, indent=2, ensure_ascii=False)}" if session_data else "SESIÓN: No especificada"
    
    prompt = f"""Eres un asistente experto en mapear parámetros de plantillas de WhatsApp para notificaciones de eventos.

DATOS DISPONIBLES:

1. CONTACTO (contact_field):
   - name, email, phone, account_tier

2. EVENTO (event_field):
   - title, description, brand, category, topic

3. SESIÓN (session_field):
   - name, start_at (fecha/hora), end_at, location_name, location_address, meeting_link, speaker_name

4. FIJO (fixed_value):
   - Cualquier texto estático

PLANTILLA: {template.name}
{params_info}

{event_info}
{session_info}

REGLAS:
1. Mapea cada parámetro a la mejor fuente: contact_field, event_field, session_field, o fixed_value
2. CASOS ESPECIALES:
   - "fecha" → session_field: start_at
   - "hora" → session_field: start_at
   - "zona" → fixed_value: "GMT-5" (o timezone si existe)
   - "modalidad" → session_field: meeting_link (si existe="Virtual", sino="Presencial")
   - "link" → session_field: meeting_link

Devuelve SOLO un JSON array con este formato:
[
  {{
    "param_index": 1,
    "template_param_id": {params[0].id},
    "assign_type": "contact_field",
    "assign_value": "name",
    "reasoning": "Explicación breve"
  }}
]
"""

    # 4. Llamar a Gemini
    genai.configure(api_key=settings.GEMINI_API_KEY)
    model = genai.GenerativeModel('gemini-1.5-flash')
    
    response = model.generate_content(prompt)
    response_text = response.text.strip()
    
    # Limpiar markdown si existe
    if response_text.startswith("```json"):
        response_text = response_text[7:]
    if response_text.startswith("```"):
        response_text = response_text[3:]
    if response_text.endswith("```"):
        response_text = response_text[:-3]
    response_text = response_text.strip()
    
    # 5. Parsear respuesta
    try:
        suggestions_raw = json.loads(response_text)
        suggestions = [ParameterSuggestion(**s) for s in suggestions_raw]
        return SuggestEventMappingsResponse(suggestions=suggestions)
    except Exception as e:
        raise HTTPException(500, f"Error parsing AI response: {str(e)}")
```

---

## ✅ Checklist de Implementación

### Backend
- [ ] Crear tablas `notification_configs` y `notification_config_parameters`
- [ ] Modificar endpoint `POST /notifications/configs` para aceptar parámetros
- [ ] Modificar endpoint `PUT /notifications/configs/{id}` para actualizar parámetros
- [ ] **Crear endpoint `POST /notifications/configs/{config_id}/test`** (prueba)
- [ ] Crear endpoint `POST /notifications/configs/suggest-event-mappings`
- [ ] Actualizar worker/cron para resolver parámetros dinámicamente al enviar
- [ ] Agregar lógica de formateo para fechas/horas (`start_at` → "10 de Marzo, 2026 a las 3:00 PM")

### Frontend
- [ ] Extender `NotificationType` con tipos de eventos
- [ ] Extender interface `NotificationConfig` con campos de eventos
- [ ] Agregar sección de evento/sesión en modal de configuración
- [ ] Agregar sección de mapeo de parámetros
- [ ] Implementar botón "Autocompletar con IA"
- [ ] Agregar método `isEventBasedNotification()`
- [ ] Agregar método `autoFillAutomationParameters()`
- [ ] **Agregar método `testNotificationConfig()` al DataService**
- [ ] **Actualizar botón "Probar" para usar endpoint correcto según tipo**
- [ ] Agregar `suggestEventParameterMappings()` al DataService
- [ ] Agregar traducciones para nuevos campos

### Traducciones
- [ ] `eventScope`: "Alcance del Evento"
- [ ] `allEvents`: "Todos los Eventos"
- [ ] `allSessions`: "Todas las Sesiones"
- [ ] `contactField`: "Campo del Contacto"
- [ ] `eventField`: "Campo del Evento"
- [ ] `sessionField`: "Campo de la Sesión"
- [ ] `fixedValue`: "Valor Fijo"
- [ ] `selectType`: "Seleccionar Tipo"
- [ ] `selectField`: "Seleccionar Campo"
- [ ] `enterFixedValue`: "Ingresar valor..."

---

## 🎯 Resultado Esperado

1. **Admin puede configurar notificaciones para eventos** con la misma facilidad que las campañas
2. **IA mapea automáticamente** los 8 parámetros típicos (nombre, tipo, titulo, fecha, hora, zona, modalidad, link)
3. **Sistema envía notificaciones** 24h antes del evento con datos personalizados de cada contacto
4. **Compatible con flujo existente** de citas médicas (no rompe nada)
5. **Botón "Probar" funciona correctamente** usando datos de eventos cuando corresponde

---

## 📊 Comparación de Endpoints de Prueba

| Aspecto | Citas Médicas | Eventos (NUEVO) |
|---------|--------------|-----------------|
| **Endpoint** | `POST /appointments/{appointment_id}/test-notification` | `POST /notifications/configs/{config_id}/test` |
| **Origen de Datos** | `patient_appointments` tabla | `events` + `event_sessions` tablas |
| **Parámetros Resueltos** | Desde cita médica (doctor, fecha, consultorio) | Desde evento (título, sesión, speaker, link) |
| **Campos del Contacto** | `contact.name`, `contact.phone` | `contact.name`, `contact.phone`, `contact.account_tier` |
| **Fechas/Horas** | `appointment.scheduled_at` | `session.start_at` (formateado) |
| **Campos Especiales** | `doctor_name`, `office_location`, `payment_status` | `meeting_link`, `speaker_name`, `delivery_mode` |
| **Validación** | Requiere `appointment_id` existente | Requiere `event_id` o `event_session_id` en config |
| **Uso Frontend** | Modal de citas médicas | Modal de notificaciones automáticas |

### Ejemplo de Uso en Frontend

```typescript
// notifications.component.ts

async testAutomationConfig(config: NotificationConfig) {
  if (!config.id) return;
  
  const phone = prompt('Ingrese número de teléfono para prueba:');
  if (!phone) return;
  
  try {
    this.isTestingSending.set(true);
    
    // IMPORTANTE: Usar endpoint correcto según tipo de bot
    const response = await this.dataService.testNotificationConfig(
      this.botId(),
      config.id,
      phone
    );
    
    if (response.success) {
      this.toastService.showSuccess(
        `Notificación de prueba enviada a ${phone}`
      );
      
      // Opcional: Mostrar parámetros resueltos
      if (response.resolved_params) {
        console.log('Parámetros resueltos:', response.resolved_params);
      }
    }
  } catch (error: any) {
    console.error('Test error:', error);
    this.toastService.showError(
      error?.error?.detail || 'Error al enviar notificación de prueba'
    );
  } finally {
    this.isTestingSending.set(false);
  }
}
```

### Diferencia Clave

**Citas Médicas:**
```
Usuario → Selecciona cita específica → Test usa datos de ESA cita
```

**Eventos (Nuevo):**
```
Usuario → Configura automation con event_id → Test usa datos del EVENTO configurado
```

¡Frontend listo para eventos! 🎉
