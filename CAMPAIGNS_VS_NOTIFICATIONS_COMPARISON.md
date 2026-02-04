# 🔄 Comparación: Campañas vs Notificaciones Automáticas

## Arquitectura de Tablas

### Sistema de Campañas (Manual)
```
notification_campaigns
├── id
├── bot_id
├── name
├── template_id
├── status (DRAFT, READY, RUNNING, COMPLETED)
├── scheduled_at
├── event_id (opcional)
├── event_session_id (opcional)
└── created_at / updated_at

notification_campaign_parameters
├── id
├── campaign_id ──────> [notification_campaigns.id]
├── template_param_id ─> [wa_template_parameters.id]
├── assign_type (fixed_value, contact_field, event_field)
├── assign_value
└── created_at / updated_at
```

### Sistema de Notificaciones (Automático)
```
notification_configs
├── id
├── bot_id
├── notification_type (event_reminder, event_confirmation, etc.)
├── template_id
├── offset_minutes (-1440 = 24h antes)
├── is_active (true/false)
├── event_id (opcional)
├── event_session_id (opcional)
├── apply_if_payment_status (solo citas médicas)
├── apply_if_confirmation_status (solo citas médicas)
└── created_at / updated_at

notification_config_parameters
├── id
├── config_id ─────────> [notification_configs.id]
├── template_param_id ─> [wa_template_parameters.id]
├── assign_type (fixed_value, contact_field, event_field, session_field)
├── assign_value
└── created_at / updated_at
```

---

## Diferencias Clave

| Aspecto | Campañas | Notificaciones Automáticas |
|---------|----------|---------------------------|
| **Ejecución** | Manual (usuario presiona "ejecutar") | Automática (trigger por tiempo) |
| **Trigger** | `scheduled_at` timestamp | `offset_minutes` relativo al evento |
| **Estado** | `status`: DRAFT → READY → RUNNING → COMPLETED | `is_active`: true/false |
| **Uso** | Envío masivo puntual | Recordatorios recurrentes |
| **Ejemplo** | "Campaña Black Friday 2026" | "Recordatorio 24h antes de cada evento" |

---

## Similitudes

### ✅ Ambos usan tabla de parámetros separada
- `notification_campaign_parameters` ↔ `notification_config_parameters`
- Misma estructura: `template_param_id`, `assign_type`, `assign_value`
- Permite mapeo flexible de parámetros de plantilla

### ✅ Ambos soportan filtrado por evento
- `event_id` (nivel evento completo)
- `event_session_id` (nivel sesión específica)
- `null` = aplica a todos

### ✅ Mismos tipos de asignación
| assign_type | Descripción | Ejemplo |
|------------|-------------|---------|
| `fixed_value` | Valor estático | `"Bienvenido"`, `"GMT-5"` |
| `contact_field` | Campo del contacto | `name`, `email`, `phone`, `account_tier` |
| `event_field` | Campo del evento | `title`, `description`, `brand`, `category` |
| `session_field` | Campo de la sesión | `name`, `start_at`, `meeting_link`, `speaker_name` |

---

## Flujos de Uso

### Flujo Campaña (Manual)
```
1. Usuario crea campaña DRAFT
2. Selecciona plantilla con 8 parámetros
3. Presiona "Auto-llenar con IA"
4. IA sugiere mapeos:
   {{1}} nombre → contact_field: name
   {{2}} tipo → event_field: category
   {{3}} titulo → event_field: title
   (etc.)
5. Usuario revisa/edita mapeos
6. Usuario presiona "Ejecutar Campaña"
7. Sistema inserta 150 registros en notification_campaign_parameters
8. Worker envía mensajes
```

### Flujo Notificación Automática (Trigger)
```
1. Usuario crea config automation
2. Selecciona plantilla con 8 parámetros
3. Presiona "Auto-llenar con IA"
4. IA sugiere mapeos (igual que campañas)
5. Usuario guarda config con offset_minutes=-1440
6. Sistema inserta registros en notification_config_parameters
7. Worker revisa configs activas cada hora
8. Cuando falta 24h para un evento:
   - Resuelve parámetros dinámicamente
   - Encola notificación
   - Envía mensaje
```

---

## Ejemplo de Datos

### Campaña de Evento
```sql
-- Tabla principal
INSERT INTO notification_campaigns (bot_id, name, template_id, status, event_id)
VALUES ('CONS_ASIS', 'Campaña Webinar Marzo', 42, 'DRAFT', 5);
-- campaign_id = 100

-- Parámetros
INSERT INTO notification_campaign_parameters (campaign_id, template_param_id, assign_type, assign_value) VALUES
(100, 123, 'contact_field', 'name'),
(100, 124, 'event_field', 'category'),
(100, 125, 'event_field', 'title'),
(100, 126, 'session_field', 'start_at'),
(100, 127, 'session_field', 'start_at'),
(100, 128, 'fixed_value', 'GMT-5'),
(100, 129, 'session_field', 'delivery_mode'),
(100, 130, 'session_field', 'meeting_link');
```

### Notificación Automática de Evento
```sql
-- Tabla principal
INSERT INTO notification_configs (bot_id, notification_type, template_id, offset_minutes, is_active, event_id)
VALUES ('CONS_ASIS', 'event_reminder', 42, -1440, true, 5);
-- config_id = 15

-- Parámetros (idénticos a campaña)
INSERT INTO notification_config_parameters (config_id, template_param_id, assign_type, assign_value) VALUES
(15, 123, 'contact_field', 'name'),
(15, 124, 'event_field', 'category'),
(15, 125, 'event_field', 'title'),
(15, 126, 'session_field', 'start_at'),
(15, 127, 'session_field', 'start_at'),
(15, 128, 'fixed_value', 'GMT-5'),
(15, 129, 'session_field', 'delivery_mode'),
(15, 130, 'session_field', 'meeting_link');
```

---

## Ventajas de Usar Tabla Separada

### ✅ Normalización
- No duplicar datos en JSONB
- Fácil JOIN con `wa_template_parameters`

### ✅ Validación
- Foreign key constraints
- UNIQUE constraint (config_id, template_param_id)

### ✅ Consultas
```sql
-- Ver config con parámetros ordenados
SELECT 
    nc.*,
    json_agg(
        json_build_object(
            'param_index', wtp.param_index,
            'param_name', wtp.param_name,
            'assign_type', ncp.assign_type,
            'assign_value', ncp.assign_value
        ) ORDER BY wtp.param_index
    ) as parameters
FROM notification_configs nc
LEFT JOIN notification_config_parameters ncp ON ncp.config_id = nc.id
LEFT JOIN wa_template_parameters wtp ON wtp.id = ncp.template_param_id
WHERE nc.id = 15
GROUP BY nc.id;
```

### ✅ Mantenimiento
- Eliminar config → CASCADE elimina parámetros
- Actualizar parámetros sin tocar config
- Auditoría con created_at/updated_at

---

## Conclusión

Ambos sistemas comparten la **misma arquitectura de parámetros** porque ambos necesitan:
1. **Flexibilidad**: Mapear N parámetros de forma dinámica
2. **IA**: Auto-completar con Gemini
3. **Normalización**: Evitar JSONB masivos
4. **Mantenibilidad**: Separar config base de mapeos

La diferencia está en el **trigger**:
- Campañas = `scheduled_at` (fecha específica)
- Notificaciones = `offset_minutes` + `is_active` (trigger relativo)

¡Usar la misma estructura facilita el desarrollo frontend/backend! 🎯
