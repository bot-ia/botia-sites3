-- =====================================================
-- ESQUEMA: Notificaciones Automáticas para Eventos
-- Similar a notification_campaigns + notification_campaign_parameters
-- =====================================================

-- 1. Tabla principal de configuraciones
CREATE TABLE IF NOT EXISTS botia.notification_configs (
    id SERIAL PRIMARY KEY,
    bot_id TEXT NOT NULL,
    notification_type TEXT NOT NULL, 
    -- 'appointment_reminder', 'payment_reminder', 'event_reminder', 'event_confirmation', etc.
    
    template_id INTEGER NOT NULL REFERENCES botia.wa_templates(id),
    offset_minutes INTEGER NOT NULL DEFAULT -1440, -- -24 horas por defecto (notificar antes del evento)
    is_active BOOLEAN NOT NULL DEFAULT true,
    
    -- Filtros para citas médicas (opcional, se deja null para eventos)
    apply_if_payment_status TEXT,
    apply_if_confirmation_status TEXT,
    
    -- Filtros para eventos (opcional, se deja null para citas médicas)
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
CREATE INDEX IF NOT EXISTS idx_notification_configs_type ON botia.notification_configs(notification_type);

-- 2. Tabla de parámetros mapeados (similar a notification_campaign_parameters)
CREATE TABLE IF NOT EXISTS botia.notification_config_parameters (
    id SERIAL PRIMARY KEY,
    config_id INTEGER NOT NULL REFERENCES botia.notification_configs(id) ON DELETE CASCADE,
    template_param_id INTEGER NOT NULL REFERENCES botia.wa_template_parameters(id),
    
    assign_type TEXT NOT NULL, 
    -- 'fixed_value': Valor fijo como "Bienvenido"
    -- 'contact_field': Campo del contacto (name, email, phone, account_tier)
    -- 'event_field': Campo del evento (title, description, brand, category, topic)
    -- 'session_field': Campo de la sesión (name, start_at, end_at, location_name, meeting_link, speaker_name)
    
    assign_value TEXT NOT NULL, -- El valor específico según el tipo
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(config_id, template_param_id) -- Un parámetro solo puede mapearse una vez por config
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_config_params_config_id ON botia.notification_config_parameters(config_id);
CREATE INDEX IF NOT EXISTS idx_config_params_template_param ON botia.notification_config_parameters(template_param_id);

-- =====================================================
-- EJEMPLOS DE USO
-- =====================================================

-- Ejemplo 1: Recordatorio de evento con 8 parámetros mapeados
INSERT INTO botia.notification_configs (bot_id, notification_type, template_id, offset_minutes, is_active, event_id, event_session_id)
VALUES ('CONS_ASIS', 'event_reminder', 42, -1440, true, 5, NULL); -- config_id = 15

-- Mapear los 8 parámetros típicos
INSERT INTO botia.notification_config_parameters (config_id, template_param_id, assign_type, assign_value) VALUES
(15, 123, 'contact_field', 'name'),          -- {{1}} nombre del contacto
(15, 124, 'event_field', 'category'),        -- {{2}} tipo (categoría del evento)
(15, 125, 'event_field', 'title'),           -- {{3}} título del evento
(15, 126, 'session_field', 'start_at'),      -- {{4}} fecha (se formatea en backend)
(15, 127, 'session_field', 'start_at'),      -- {{5}} hora (se formatea en backend)
(15, 128, 'fixed_value', 'GMT-5'),           -- {{6}} zona horaria fija
(15, 129, 'session_field', 'delivery_mode'), -- {{7}} modalidad (ONLINE/PRESENCIAL)
(15, 130, 'session_field', 'meeting_link');  -- {{8}} link de reunión

-- =====================================================
-- CONSULTAS ÚTILES
-- =====================================================

-- Ver configuraciones de eventos con sus parámetros
SELECT 
    nc.id,
    nc.bot_id,
    nc.notification_type,
    nc.offset_minutes,
    nc.is_active,
    nc.event_id,
    nc.event_session_id,
    wt.template_name,
    json_agg(
        json_build_object(
            'param_id', ncp.template_param_id,
            'assign_type', ncp.assign_type,
            'assign_value', ncp.assign_value
        ) ORDER BY wtp.param_index
    ) as parameters
FROM botia.notification_configs nc
LEFT JOIN botia.wa_templates wt ON wt.id = nc.template_id
LEFT JOIN botia.notification_config_parameters ncp ON ncp.config_id = nc.id
LEFT JOIN botia.wa_template_parameters wtp ON wtp.id = ncp.template_param_id
WHERE nc.bot_id = 'CONS_ASIS'
  AND nc.notification_type LIKE 'event_%'
GROUP BY nc.id, wt.template_name;

-- =====================================================
-- COMPARACIÓN CON CAMPAÑAS
-- =====================================================

/*
┌───────────────────────────────┬────────────────────────────────┐
│ CAMPAÑAS                      │ NOTIFICACIONES AUTOMÁTICAS     │
├───────────────────────────────┼────────────────────────────────┤
│ notification_campaigns        │ notification_configs           │
│ - Ejecución manual            │ - Ejecución automática         │
│ - status: DRAFT/RUNNING       │ - is_active: true/false        │
│ - scheduled_at                │ - offset_minutes (trigger)     │
├───────────────────────────────┼────────────────────────────────┤
│ notification_campaign_params  │ notification_config_parameters │
│ - campaign_id                 │ - config_id                    │
│ - template_param_id           │ - template_param_id            │
│ - assign_type                 │ - assign_type                  │
│ - assign_value                │ - assign_value                 │
└───────────────────────────────┴────────────────────────────────┘
*/
