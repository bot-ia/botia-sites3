# 📢 Especificación: Notificaciones Automáticas para Eventos

## Resumen
Adaptar el sistema de notificaciones automáticas para soportar eventos (programas, webinars, workshops) con mapeo inteligente de 8 parámetros usando IA, similar al sistema existente de campañas.

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

### Tabla `botia.notification_configs` (Existente - Modificar)

```sql
-- Agregar columnas necesarias para eventos
ALTER TABLE botia.notification_configs
ADD COLUMN IF NOT EXISTS event_id INTEGER REFERENCES botia.events(id),
ADD COLUMN IF NOT EXISTS event_session_id INTEGER REFERENCES botia.event_sessions(id),
ADD COLUMN IF NOT EXISTS parameters JSONB; -- Almacenar mapeo de parámetros

-- Índices recomendados
CREATE INDEX IF NOT EXISTS idx_notification_configs_event_id ON botia.notification_configs(event_id);
CREATE INDEX IF NOT EXISTS idx_notification_configs_event_session_id ON botia.notification_configs(event_session_id);
```

### Estructura de `parameters` (JSONB)

```json
[
  {
    "template_param_id": 123,
    "assign_type": "event_field",
    "assign_value": "title"
  },
  {
    "template_param_id": 124,
    "assign_type": "session_field",
    "assign_value": "start_at"
  },
  {
    "template_param_id": 125,
    "assign_type": "contact_field",
    "assign_value": "name"
  },
  {
    "template_param_id": 126,
    "assign_type": "fixed_value",
    "assign_value": "Bienvenido"
  }
]
```

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

**Descripción**: Crear configuración de notificación automática (ahora soporta eventos).

**Request Body Extendido:**
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

**Nuevos Campos:**
- `event_id` (optional): ID del evento al que aplica
- `event_session_id` (optional): ID de la sesión específica (o null para todas)
- `parameters` (optional): Mapeo de parámetros de la plantilla

**Nota**: Si ambos son `null`, aplica a **todos** los eventos del bot.

---

### 2. `PUT /api/bots/{bot_id}/notifications/configs/{config_id}` (Modificar)

**Descripción**: Actualizar configuración existente (incluye parámetros).

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

### 3. `POST /api/bots/{bot_id}/notifications/configs/suggest-event-mappings` (Nuevo)

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

### 2. Extender `NotificationConfig`

```typescript
// src/models.ts
export interface NotificationConfig {
  id: number;
  bot_id: string;
  notification_type: NotificationType;
  template_id: number;
  offset_minutes: number;
  is_active: boolean;
  
  // Existing (citas)
  apply_if_payment_status?: PaymentStatus;
  apply_if_confirmation_status?: ConfirmationStatus;
  
  // New (eventos)
  event_id?: number | null;
  event_session_id?: number | null;
  parameters?: Array<{
    template_param_id: number;
    assign_type: 'fixed_value' | 'contact_field' | 'event_field' | 'session_field';
    assign_value: string;
  }>;
  
  metadata?: any;
  health_status?: 'ok' | 'warning' | 'error';
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
- [ ] Agregar columnas `event_id`, `event_session_id`, `parameters` a `notification_configs`
- [ ] Modificar endpoint `POST /notifications/configs` para aceptar parámetros
- [ ] Modificar endpoint `PUT /notifications/configs/{id}` para actualizar parámetros
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

¡Frontend listo para eventos! 🎉
