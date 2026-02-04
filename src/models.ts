export interface DayHours {
  enabled: boolean;
  start: string;
  end: string;
}

export interface Tariff {
  municipality: string;
  moto: number;
  carro: number;
}

export interface VehicleLimit {
  category: string;
  limit: string; // Can be a number or "carro", "carro_preferible"
}

export interface PeakSeason {
  from_mm_dd?: string;
  to_mm_dd?: string;
  month?: string;
}

export interface PaymentConfig {
  first_order_prepaid: boolean;
  card_link_fee_rate: number;
  vat: number;
}

export interface BusinessRulesConfig {
  botId: string;
  enabled: boolean;
  version: string;
  min_per_ref: number;
  delivery_windows: {
    monday: DayHours;
    tuesday: DayHours;
    wednesday: DayHours;
    thursday: DayHours;
    friday: DayHours;
    saturday: DayHours;
    sunday: DayHours;
  };
  support_windows: {
    monday: DayHours;
    tuesday: DayHours;
    wednesday: DayHours;
    thursday: DayHours;
    friday: DayHours;
    saturday: DayHours;
    sunday: DayHours;
  };
  anticipation_min_business_days: number;
  payment: PaymentConfig;
  cancellation_penalty: number;
  peak_season: PeakSeason[];
  portfolio_pdf_url: string;
  municipal_tariffs: Tariff[];
  moto_limits: VehicleLimit[];
}

export type BotType = 'product' | 'appointment' | 'repair' | 'aesthetic_clinic' | 'programs_events';

export interface CustomAttribute {
  key: string;
  label: string;
  type: 'text' | 'select';
  options?: string[]; // For 'select' type
}

export interface Bot {
  bot_id: string;
  nombre: string;
  company: string;
  status: 'Active' | 'Inactive';
  botType: BotType;
  // Product type specific
  portfolioMenuTitle?: string | null;
  // Core config
  key_openai: string;
  key_qdrant: string;
  meta_token: string;
  waba_id?: string;
  phone_number_id?: string;
  key_chatwood: string;
  account_id_chatwood: number | null;
  url_espo: string;
  api_key_espo: string;
  url_agent_ia: string;
  prompt_vision: string;
  modelo_ia: string;
  // New user knowledge base config
  userKnowledgeBaseEnabled?: boolean;
  userKnowledgeBaseN8nWebhook?: string | null;
  widget_script?: string;
  // Custom attributes configuration
  custom_attributes?: CustomAttribute[];
}

export interface User {
  id: string;
  email: string;
  accessibleBotIds: string[];
  role?: 'admin' | 'user';
}

export interface Prompt {
  id: string;
  botId: string;
  promptId: string; // Identifier for use within the bot
  content: string;
  createdAt: string;
}

export interface KnowledgeItem {
  id: string;
  botId: string;
  optionId: string;
  title: string;
  description: string;
  n8nUrl: string;
}

export interface SpecialLink {
  id: string;
  botId: string;
  label: string;
  url: string;
}

export interface PortfolioItem {
  id: string; // Internal UUID
  botId: string;
  itemType: 'product' | 'combo';
  sku: string;
  nombre: string;
  categoria_slug: string;
  presentacion: string;
  precio_unitario: number;
  impuesto: string;
  min_por_ref: number;
  // For 'product' type
  componentes?: {
    principal: string[];
    acompanamientos: string[];
    bebidas: string[];
  };
   // For 'combo' type
  combo_components?: {
      id: string; // unique id for the category row
      category_name: string;
      itemIds: string[]; // ids of products that can be chosen for this category
  }[];
  notas: string;
  imagen: string;
}

// === REPAIR BOT MODELS ===
export type ServiceOrderStatus = 'Received' | 'Evaluating' | 'Quote Ready' | 'In Progress' | 'Completed' | 'Cancelled';
export interface ServiceOrder {
  id: string;
  botId: string;
  orderId: string; // User-facing order ID
  clientName: string;
  clientContact: string;
  device: string;
  issue: string;
  status: ServiceOrderStatus;
  createdAt: string; // ISO String
}

// === USER KNOWLEDGE BASE ===
export interface KnowledgeDocument {
  id: string;
  botId: string;
  title: string;
  content: string;
  lastUpdatedAt: string;
}

// === AESTHETIC CLINIC BOT MODELS ===
export interface ProcedureMediaLink {
  id: string;
  type: 'image' | 'video';
  url: string;
}

export interface Procedure {
  id: string;
  bot_id: string;
  name: string;
  procedure_type: 'surgical' | 'non-surgical';
  description: string;
  pre_care_instructions: string;
  post_care_instructions: string;
  cost_min: number;
  cost_max: number;
  cost_note: string;
  media_links: ProcedureMediaLink[];
  recurrence_days?: number;
}

export interface Professional {
  professional_id: number;
  bot_id: string;
  name: string;
  specialty: string | null;
  is_active: boolean;
  created_at: string;
}

export type AppointmentType = 'valoracion_paga' | 'prevaloracion_gratis' | 'control_medico' | 'procedimiento';

export interface Calendar {
  calendar_id: number;
  bot_id: string;
  professional_id: number | null;
  name: string;
  appointment_type: AppointmentType;
  google_calendar_link: string | null;
  google_calendar_id: string | null;
  price: number;
  currency: string;
  is_active: boolean;
}

export type PaymentStatus = 'pendiente' | 'pagado';
export type ConfirmationStatus = 'agendada' | 'confirmada' | 'realizada' | 'cancelada';

export interface PatientAppointment {
    appointment_id: number;
    bot_id: string;
    user_id: string; // Chatwood ID
    calendar_id: number | null;
    procedure_id: string | null; // UUID
    appointment_date: string | null; // ISO String
    payment_status: PaymentStatus;
    confirmation_status: ConfirmationStatus;
    notes: string | null;
    google_event_id: string | null;
    created_at: string;
    updated_at: string;
    reminder_sent_at?: string | null;
    pre_instructions_sent_at?: string | null;
    post_instructions_sent_at?: string | null;
}

// === CONTACTS ===
export interface Contact {
  contact_id: string; // from Chatwood
  bot_id: string;
  name: string | null;
  phone_number: string | null;
  email: string | null;
  attributes?: Record<string, any>;
  created_at: string;
  updated_at: string;
  birth_date?: string | null;
}

// === SEGMENTATION ===
export type Operator =
  | 'is'
  | 'is_not'
  | 'contains'
  | 'does_not_contain'
  | 'starts_with'
  | 'ends_with'
  | 'is_empty'
  | 'is_not_empty'
  | 'equals'
  | 'greater_than'
  | 'less_than'
  | 'between'
  | 'is_one_of';

export interface FilterableField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'enum' | 'date';
  operators: Operator[];
  options?: string[];
}

export interface FilterCondition {
  id: number; // for unique tracking in UI
  fieldKey: string | null;
  operator: Operator | null;
  value: any;
  value2?: any; // for 'between' operator
}

export interface SegmentationPreviewResult {
    count: number;
    preview: Contact[];
}

export interface SavedSegment {
  segment_id: string;
  bot_id: string;
  name: string;
  filters: FilterCondition[];
}

// === NOTIFICATIONS & CAMPAIGNS MODULE ===
export interface WATemplate {
  id: number;
  bot_id: string;
  name: string;
  language: string;
  category?: string;
  status: string;
}

export interface TemplateParameter {
  id: number;
  param_index: number;
  component_type: string;
  param_key: string;
  param_name?: string;
  param_example?: string;
  assign_type?: 'fixed_value' | 'contact_field' | 'event_field';
  assign_value?: string;
}

export interface WATemplateDetail extends WATemplate {
  parameters: TemplateParameter[];
  meta_raw?: any;
}

export type NotificationType =
  // Citas médicas / Procedimientos
  | 'appointment_reminder'
  | 'payment_reminder'
  | 'pre_procedure_instructions'
  | 'post_procedure_followup'
  | 'birthday_greeting'
  | 'no_show_followup'
  | 'reactivation_campaign'
  | 'marketing_promo'
  // Eventos / Programas
  | 'event_reminder'
  | 'event_confirmation'
  | 'event_followup'
  | 'event_cancellation'
  | 'event_update';

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
  parameters?: Array<{
    template_param_id: number;
    assign_type: 'fixed_value' | 'contact_field' | 'event_field' | 'session_field';
    assign_value: string;
  }>;
  
  metadata?: any;
  health_status?: 'ok' | 'warning' | 'error'; 
}

export type CampaignStatus = 'DRAFT' | 'READY' | 'RUNNING' | 'COMPLETED' | 'FINISHED';

export interface Campaign {
  id: number;
  bot_id: string;
  name: string;
  template_id: number;
  status: CampaignStatus;
  event_id?: number | null;
  event_session_id?: number | null;
  scheduled_at?: string;
  total_contacts: number;
  created_at?: string;
  updated_at?: string;
  parameters?: Partial<TemplateParameter>[];
}

export interface CampaignContact {
  id: number;
  campaign_id: number;
  contact_phone: string;
  params: any;
  status: string; // 'PENDING', 'SENT', 'FAILED'
}

export interface NotificationQueueItem {
  id: number;
  bot_id: string;
  notification_type: string;
  template_name: string; // Custom field from backend JOIN
  contact_phone: string;
  send_at: string;
  params: any;
  status: string; // 'PENDING', 'SENT', 'FAILED', 'CANCELLED', 'SKIPPED'
}

export interface ExecuteCampaignResponse {
  message?: string;
  total_contacts?: number;
  campaign_status?: CampaignStatus;
  sent?: number;
  failed?: number;
  errors?: string[];
}

export interface NotificationHistory {
  history_id: number;
  bot_id: string;
  config_id: number;
  contact_phone: string;
  status: 'QUEUED' | 'SENT' | 'FAILED';
  created_at: string;
  sent_at: string | null;
  error_message: string | null;
}

// === PROGRAMS & EVENTS MODULE ===
export type AccountTier = 'A' | 'B' | 'C' | 'D';
export type EventAudienceLevel = 'AVANZADO' | 'INTERMEDIO' | 'INTRODUCTORIO';
export type EventCategory = 'EDUCACION' | 'MARCA' | 'NEGOCIO';
export type EventDeliveryMode = 'ONLINE' | 'PRESENCIAL' | 'HIBRIDO';
export type EventSessionStatus = 'PROGRAMADO' | 'EN_EJECUCION' | 'FINALIZADO' | 'CANCELADO';
export type EventRegistrationStatus = 'PRE_REGISTRO' | 'CONFIRMADO' | 'CANCELADO' | 'NO_SHOW' | 'ASISTIO';

export interface EventType {
  id: number;
  bot_id: string;
  code: string;
  name: string;
  description: string;
  has_schedule: boolean;
  has_location: boolean;
  has_capacity: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Event {
  id: number;
  bot_id: string;
  event_type_id: number;
  code: string;
  title: string;
  short_title?: string | null;
  topic: string;
  objective: string;
  audience_level: EventAudienceLevel;
  brand: string;
  category: EventCategory;
  description: string;
  content_notes?: string | null;
  default_duration_minutes?: number | null;
  default_language?: string | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface EventSession {
  id: number;
  event_id: number;
  name: string;
  start_at?: string | null;
  end_at?: string | null;
  duration_minutes?: number | null;
  time_zone?: string | null;
  delivery_mode: EventDeliveryMode;
  location_name?: string | null;
  location_address?: string | null;
  city?: string | null;
  country?: string | null;
  meeting_link?: string | null;
  speaker_name?: string | null;
  speaker_title?: string | null;
  speaker_bio?: string | null;
  capacity?: number | null;
  status: EventSessionStatus;
  registration_open: boolean;
  registration_deadline_at?: string | null;
  tags?: string[] | null;
  created_at?: string;
  updated_at?: string;
}

export interface EventRegistration {
  id: number;
  event_session_id: number;
  contact_id: string;
  account_tier: AccountTier;
  source?: string | null;
  registration_status: EventRegistrationStatus;
  registered_at?: string | null;
  confirmed_at?: string | null;
  canceled_at?: string | null;
  attended_at?: string | null;
  notes?: string | null;
  utm_campaign?: string | null;
  utm_source?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface EventMessageVariant {
  id: number;
  event_id: number;
  account_tier: AccountTier;
  meta_template_name: string;
  cta_label: string;
  cta_type: string;
  body_preview?: string | null;
  created_at?: string;
  updated_at?: string;
}


export type ChangeLogEntity = 'Bot' | 'Prompt' | 'PortfolioItem' | 'KnowledgeItem' | 'SpecialLink' | 'BusinessRules' | 'ServiceOrder' | 'KnowledgeDocument' | 'Procedure' | 'Contact' | 'Professional' | 'Calendar' | 'PatientAppointment' | 'WATemplate' | 'NotificationConfig' | 'Campaign' | 'EventType' | 'Event' | 'EventSession' | 'EventMessageVariant' | 'EventRegistration';
export type ChangeLogAction = 'Created' | 'Updated' | 'Deleted';

export interface ChangeLog {
  id: string;
  botId: string;
  timestamp: string;
  userEmail: string;
  entityType: ChangeLogEntity;
  entityId: string;
  entityName: string;
  action: ChangeLogAction;
  description: string;
}

export interface InteractionLog {
  id: string;
  botId: string;
  timestamp: string;
  channel: 'web' | 'whatsapp' | 'other';
  humanHandoff: boolean;
  outcome: 'none' | 'quote' | 'order' | 'appointment' | 'status_check';
  sessionId: string;
}

// === CONTACTS IMPORT ===
export interface CsvImportResult {
  total_rows: number;
  successful_imports: number;
  failed_imports: number;
  errors: string[];
}

export interface CsvImportResponse {
  message: string;
  result?: CsvImportResult;
}

// === EVENT METRICS ===
export interface SegmentMetric {
  tipo_cuenta: string;   // 'A' | 'B' | 'C' | 'D' | 'SIN_SEGMENTO'
  invitados: number;
  pre_registro: number;
  registrado: number;
  confirmado: number;
  cancelado: number;
  no_show: number;
  asistio: number;
}

export interface StatusMetric {
  status: string;   // 'pre_registro' | 'confirmed' | 'canceled' | 'no_show' | 'attended'
  total: number;
}

export interface SessionMetricsResponse {
  bot_id: string;
  event_id: number;
  event_code: string;
  event_title: string;
  event_session_id: number;
  session_name: string;
  segment_metrics: SegmentMetric[];
  status_metrics: StatusMetric[];
  totals: {
    invitados: number;
    pre_registro: number;
    registrado: number;
    confirmado: number;
    cancelado: number;
    no_show: number;
    asistio: number;
  };
}