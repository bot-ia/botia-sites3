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

export type BotType = 'product' | 'appointment' | 'repair' | 'aesthetic_clinic';

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
}

// === CONTACTS ===
export interface Contact {
  contact_id: string; // from Chatwood
  bot_id: string;
  name: string | null;
  phone_number: string | null;
  email: string | null;
  created_at: string;
  updated_at: string;
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
  assign_type?: 'fixed_value' | 'contact_field';
  assign_value?: string;
}

export interface WATemplateDetail extends WATemplate {
  parameters: TemplateParameter[];
  meta_raw?: any;
}

export type NotificationType =
  | 'appointment_reminder'
  | 'payment_reminder'
  | 'pre_procedure_instructions'
  | 'post_procedure_followup'
  | 'birthday_greeting'
  | 'no_show_followup'
  | 'reactivation_campaign'
  | 'marketing_promo';

export interface NotificationConfig {
  id: number;
  bot_id: string;
  notification_type: NotificationType;
  template_id: number;
  offset_minutes: number;
  is_active: boolean;
  apply_if_payment_status?: PaymentStatus;
  apply_if_confirmation_status?: ConfirmationStatus;
  metadata?: any;
}

export type CampaignStatus = 'DRAFT' | 'READY' | 'RUNNING' | 'COMPLETED' | 'FINISHED';

export interface Campaign {
  id: number;
  bot_id: string;
  name: string;
  template_id: number;
  status: CampaignStatus;
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
  message: string;
  total_contacts: number;
  campaign_status: CampaignStatus;
}


export type ChangeLogEntity = 'Bot' | 'Prompt' | 'PortfolioItem' | 'KnowledgeItem' | 'SpecialLink' | 'BusinessRules' | 'ServiceOrder' | 'KnowledgeDocument' | 'Procedure' | 'Contact' | 'Professional' | 'Calendar' | 'PatientAppointment' | 'WATemplate' | 'NotificationConfig' | 'Campaign';
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