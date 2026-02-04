import { Component, ChangeDetectionStrategy, input, signal, inject, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DataService } from '../../services/data.service';
import { LanguageService } from '../../services/language.service';
import { ToastService } from '../../services/toast.service';
import { AccountTier, Event, EventAudienceLevel, EventCategory, EventDeliveryMode, EventMessageVariant, EventRegistration, EventSession, EventSessionStatus, EventType, SessionMetricsResponse } from '../../models';

type ProgramsEventsTab = 'events' | 'sessions' | 'messages' | 'metrics' | 'monitor' | 'event_types';

type DeleteTarget =
  | { type: 'event_type'; item: EventType; label: string }
  | { type: 'event'; item: Event; label: string }
  | { type: 'session'; item: EventSession; label: string }
  | { type: 'message_variant'; item: EventMessageVariant; label: string };

type EditableEventSession = Partial<EventSession> & { tags_text?: string };

@Component({
  selector: 'app-programs-events',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './programs-events.component.html',
  styleUrl: './programs-events.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProgramsEventsComponent {
  botId = input.required<string>();

  private dataService = inject(DataService);
  languageService = inject(LanguageService);
  private toastService = inject(ToastService);

  isLoading = signal(true);
  activeTab = signal<ProgramsEventsTab>('events');

  eventTypes = signal<EventType[]>([]);
  events = signal<Event[]>([]);
  sessions = signal<EventSession[]>([]);
  messageVariants = signal<EventMessageVariant[]>([]);
  registrations = signal<EventRegistration[]>([]);
  contacts = signal<any[]>([]); // For monitor view

  // Filters
  eventSearch = signal('');
  eventTypeFilter = signal<number | 'all'>('all');
  eventCategoryFilter = signal<EventCategory | 'all'>('all');
  eventBrandFilter = signal<string>('');
  eventStatusFilter = signal<'all' | 'active' | 'inactive'>('all');

  sessionEventFilter = signal<number | 'all'>('all');
  sessionStatusFilter = signal<EventSessionStatus | 'all'>('all');
  sessionSearch = signal('');

  messageEventFilter = signal<number | 'all'>('all');

  metricsEventFilter = signal<number | 'all'>('all');
  metricsSessionFilter = signal<number | 'all'>('all');
  sessionMetrics = signal<SessionMetricsResponse | null>(null);
  isLoadingMetrics = signal(false);

  // Monitor State
  monitorEventFilter = signal<number | 'all'>('all');
  monitorSessionFilter = signal<number | 'all'>('all');
  selectedEventForMonitor = signal<Event | null>(null);
  selectedSessionForMonitor = signal<EventSession | null>(null);
  monitorRegistrations = signal<EventRegistration[]>([]);
  isLoadingMonitor = signal(false);

  // Modal State
  isModalOpen = signal(false);
  modalContent = signal<'event_type' | 'event' | 'session' | 'message_variant' | null>(null);

  editingEventType = signal<Partial<EventType> | null>(null);
  editingEvent = signal<Partial<Event> | null>(null);
  editingSession = signal<EditableEventSession | null>(null);
  editingMessageVariant = signal<Partial<EventMessageVariant> | null>(null);

  deleteTarget = signal<DeleteTarget | null>(null);

  readonly audienceLevels: EventAudienceLevel[] = ['AVANZADO', 'INTERMEDIO', 'INTRODUCTORIO'];
  readonly categories: EventCategory[] = ['EDUCACION', 'MARCA', 'NEGOCIO'];
  readonly deliveryModes: EventDeliveryMode[] = ['ONLINE', 'PRESENCIAL', 'HIBRIDO'];
  readonly sessionStatuses: EventSessionStatus[] = ['PROGRAMADO', 'EN_EJECUCION', 'FINALIZADO', 'CANCELADO'];
  readonly accountTiers: AccountTier[] = ['A', 'B', 'C', 'D'];

  constructor() {
    effect(() => {
      this.loadAllData(this.botId());
    }, { allowSignalWrites: true });

    effect(() => {
      if (this.activeTab() === 'metrics') {
        this.loadRegistrationsForMetrics();
      }
    }, { allowSignalWrites: true });
  }

  async loadAllData(botId: string) {
    this.isLoading.set(true);
    try {
      const [eventTypes, events, sessions, messageVariants] = await Promise.all([
        this.dataService.getEventTypes(botId),
        this.dataService.getEvents(botId),
        this.dataService.getEventSessions(botId),
        this.dataService.getEventMessageVariants(botId),
      ]);
      this.eventTypes.set(eventTypes);
      this.events.set(events);
      this.sessions.set(sessions);
      this.messageVariants.set(messageVariants);
    } catch (e) {
      this.toastService.showError(this.languageService.T('loadError'));
    } finally {
      this.isLoading.set(false);
    }
  }

  async refreshEvents() {
    this.events.set(await this.dataService.getEvents(this.botId()));
  }

  async refreshSessions() {
    this.sessions.set(await this.dataService.getEventSessions(this.botId()));
  }

  async refreshEventTypes() {
    this.eventTypes.set(await this.dataService.getEventTypes(this.botId()));
  }

  async refreshMessageVariants() {
    this.messageVariants.set(await this.dataService.getEventMessageVariants(this.botId()));
  }

  async loadRegistrationsForMetrics() {
    const eventId = this.metricsEventFilter();
    const filters = eventId === 'all' ? undefined : { event_id: eventId };
    this.registrations.set(await this.dataService.getEventRegistrations(this.botId(), filters));
  }

  async loadSessionMetrics(sessionId: number) {
    this.isLoadingMetrics.set(true);
    try {
      const metrics = await this.dataService.getSessionMetrics(this.botId(), sessionId);
      this.sessionMetrics.set(metrics);
    } catch (e) {
      this.toastService.showError(this.languageService.T('loadError'));
      this.sessionMetrics.set(null);
    } finally {
      this.isLoadingMetrics.set(false);
    }
  }

  selectSessionForMetrics(sessionId: number) {
    this.metricsSessionFilter.set(sessionId);
    this.loadSessionMetrics(sessionId);
  }

  clearMetricsSelection() {
    this.metricsSessionFilter.set('all');
    this.sessionMetrics.set(null);
  }

  getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      'pre_registro': this.languageService.T('registrationStatus_PRE_REGISTRO'),
      'registered': this.languageService.T('metrics_registered'),
      'confirmed': this.languageService.T('registrationStatus_CONFIRMADO'),
      'canceled': this.languageService.T('registrationStatus_CANCELADO'),
      'no_show': this.languageService.T('registrationStatus_NO_SHOW'),
      'attended': this.languageService.T('registrationStatus_ASISTIO')
    };
    return labels[status] || status;
  }

  // Monitor Methods
  async selectEventForMonitor(eventId: number) {
    this.monitorEventFilter.set(eventId);
    const event = this.events().find(e => e.id === eventId);
    this.selectedEventForMonitor.set(event ?? null);
    
    // Auto-select first session if available
    const sessions = this.monitorSessions();
    if (sessions.length > 0) {
      await this.selectSessionForMonitor(sessions[0].id);
    } else {
      this.selectedSessionForMonitor.set(null);
      this.monitorRegistrations.set([]);
    }
  }

  async selectSessionForMonitor(sessionId: number) {
    this.isLoadingMonitor.set(true);
    try {
      this.monitorSessionFilter.set(sessionId);
      const session = this.sessions().find(s => s.id === sessionId);
      this.selectedSessionForMonitor.set(session ?? null);
      
      // Load registrations for this session
      const registrations = await this.dataService.getEventRegistrations(this.botId(), { event_session_id: sessionId });
      this.monitorRegistrations.set(registrations);
      
      // Load contacts if not loaded yet
      if (this.contacts().length === 0) {
        this.contacts.set(await this.dataService.getContacts(this.botId()));
      }
    } catch (e) {
      this.toastService.showError(this.languageService.T('loadError'));
    } finally {
      this.isLoadingMonitor.set(false);
    }
  }

  clearMonitorSelection() {
    this.monitorEventFilter.set('all');
    this.monitorSessionFilter.set('all');
    this.selectedEventForMonitor.set(null);
    this.selectedSessionForMonitor.set(null);
    this.monitorRegistrations.set([]);
  }

  // Filters
  filteredEvents = computed(() => {
    const term = this.eventSearch().toLowerCase().trim();
    const typeFilter = this.eventTypeFilter();
    const categoryFilter = this.eventCategoryFilter();
    const brandFilter = this.eventBrandFilter().toLowerCase().trim();
    const statusFilter = this.eventStatusFilter();

    return this.events().filter(event => {
      if (typeFilter !== 'all' && event.event_type_id !== typeFilter) return false;
      if (categoryFilter !== 'all' && event.category !== categoryFilter) return false;
      if (brandFilter && !event.brand.toLowerCase().includes(brandFilter)) return false;
      if (statusFilter === 'active' && !event.is_active) return false;
      if (statusFilter === 'inactive' && event.is_active) return false;
      if (term) {
        const blob = `${event.title} ${event.short_title ?? ''} ${event.code} ${event.topic}`.toLowerCase();
        if (!blob.includes(term)) return false;
      }
      return true;
    });
  });

  filteredSessions = computed(() => {
    const eventFilter = this.sessionEventFilter();
    const statusFilter = this.sessionStatusFilter();
    const term = this.sessionSearch().toLowerCase().trim();

    return this.sessions().filter(session => {
      if (eventFilter !== 'all' && session.event_id !== eventFilter) return false;
      if (statusFilter !== 'all' && session.status !== statusFilter) return false;
      if (term) {
        const blob = `${session.name} ${session.city ?? ''} ${session.country ?? ''}`.toLowerCase();
        if (!blob.includes(term)) return false;
      }
      return true;
    });
  });

  filteredMessageVariants = computed(() => {
    const eventFilter = this.messageEventFilter();
    return this.messageVariants().filter(variant =>
      eventFilter === 'all' ? true : variant.event_id === eventFilter
    );
  });

  metricsSessions = computed(() => {
    const eventFilter = this.metricsEventFilter();
    return this.sessions().filter(session => eventFilter === 'all' ? true : session.event_id === eventFilter);
  });

  hasMetricsData = computed(() => this.sessionMetrics() !== null);

  // Monitor Computed
  monitorSessions = computed(() => {
    const eventFilter = this.monitorEventFilter();
    return this.sessions().filter(session => eventFilter === 'all' ? true : session.event_id === eventFilter);
  });

  monitorStats = computed(() => {
    const registrations = this.monitorRegistrations();
    return {
      total: registrations.length,
      preRegistro: registrations.filter(r => this.normalizeRegistrationStatus(r.registration_status) === 'PRE_REGISTRO').length,
      confirmado: registrations.filter(r => this.normalizeRegistrationStatus(r.registration_status) === 'CONFIRMADO').length,
      asistio: registrations.filter(r => this.normalizeRegistrationStatus(r.registration_status) === 'ASISTIO').length,
      noShow: registrations.filter(r => this.normalizeRegistrationStatus(r.registration_status) === 'NO_SHOW').length,
      cancelado: registrations.filter(r => this.normalizeRegistrationStatus(r.registration_status) === 'CANCELADO').length,
    };
  });

  isEventPast = computed(() => {
    const session = this.selectedSessionForMonitor();
    if (!session?.start_at) return false;
    return new Date(session.start_at) < new Date();
  });

  // UI helpers
  getEventTypeName(id: number): string {
    return this.eventTypes().find(t => t.id === id)?.name ?? '—';
  }

  getEventTitle(id: number): string {
    return this.events().find(e => e.id === id)?.title ?? '—';
  }

  getContactInfo(contactId: string): { name: string; phone: string } {
    const contact = this.contacts().find((c: any) => c.contact_id === contactId);
    return {
      name: contact?.name || 'Desconocido',
      phone: contact?.phone_number || contactId
    };
  }

  // Normalize registration status from backend (lowercase English) to expected format (uppercase Spanish)
  normalizeRegistrationStatus(status: string): string {
    const statusMap: Record<string, string> = {
      'pre_registro': 'PRE_REGISTRO',
      'pre-registro': 'PRE_REGISTRO',
      'confirmado': 'CONFIRMADO',
      'confirmed': 'CONFIRMADO',
      'asistio': 'ASISTIO',
      'attended': 'ASISTIO',
      'no_show': 'NO_SHOW',
      'no-show': 'NO_SHOW',
      'cancelado': 'CANCELADO',
      'canceled': 'CANCELADO',
      'cancelled': 'CANCELADO'
    };
    return statusMap[status.toLowerCase()] || status.toUpperCase();
  }

  // Format source for display
  formatSource(source: string | null): string {
    if (!source) return 'Manual';
    const sourceMap: Record<string, string> = {
      'whatsapp_campaign': 'Campaña WhatsApp',
      'manual': 'Manual',
      'web_form': 'Formulario Web',
      'api': 'API',
      'import': 'Importación'
    };
    return sourceMap[source] || source;
  }

  formatDate(iso?: string | null): string {
    if (!iso) return '—';
    const local = this.toDatetimeLocal(iso);
    if (local) {
      const parts = this.parseNaiveDate(local);
      if (parts) {
        const date = new Date(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
        return isNaN(date.getTime()) ? '—' : date.toLocaleString();
      }
    }
    const date = new Date(iso);
    return isNaN(date.getTime()) ? '—' : date.toLocaleString();
  }

  private normalizeYear(value: string): string {
    if (/^\d{6}-/.test(value)) {
      return `${value.slice(0, 4)}${value.slice(6)}`;
    }
    return value;
  }

  private parseNaiveDate(value?: string | null) {
    if (!value) return null;
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
    if (!match) return null;
    return {
      year: Number(match[1]),
      month: Number(match[2]),
      day: Number(match[3]),
      hour: Number(match[4]),
      minute: Number(match[5]),
    };
  }

  private toDatetimeLocal(value?: string | null): string | null {
    if (!value) return null;
    const normalized = this.normalizeYear(value);
    const match = normalized.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
    if (match) return `${match[1]}T${match[2]}`;
    const date = new Date(normalized);
    if (isNaN(date.getTime())) return null;
    const pad = (n: number) => String(n).padStart(2, '0');
    const yyyy = date.getFullYear();
    const mm = pad(date.getMonth() + 1);
    const dd = pad(date.getDate());
    const hh = pad(date.getHours());
    const mi = pad(date.getMinutes());
    return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
  }

  private normalizeDatetimeForApi(value?: string | null): string | null {
    if (!value) return null;
    const normalized = this.toDatetimeLocal(value);
    return normalized ?? null;
  }

  formatTags(tags?: string[] | null): string {
    return tags?.length ? tags.join(', ') : '—';
  }

  getSessionCounts(sessionId: number) {
    const regs = this.registrations().filter(r => r.event_session_id === sessionId);
    const total = regs.length;
    const byTier = this.accountTiers.reduce((acc, tier) => ({ ...acc, [tier]: regs.filter(r => r.account_tier === tier).length }), {} as Record<AccountTier, number>);
    const byStatus = regs.reduce<Record<string, number>>((acc, reg) => {
      acc[reg.registration_status] = (acc[reg.registration_status] || 0) + 1;
      return acc;
    }, {});
    return { total, byTier, byStatus };
  }

  // Modals
  openEventTypeModal(eventType?: EventType) {
    this.editingEventType.set(eventType ? { ...eventType } : { bot_id: this.botId(), code: '', name: '', description: '', has_schedule: true, has_location: true, has_capacity: false });
    this.modalContent.set('event_type');
    this.isModalOpen.set(true);
  }

  openEventModal(event?: Event) {
    this.editingEvent.set(event ? { ...event } : { bot_id: this.botId(), event_type_id: this.eventTypes()[0]?.id, code: '', title: '', short_title: '', topic: '', objective: '', audience_level: 'INTRODUCTORIO', brand: '', category: 'EDUCACION', description: '', content_notes: '', default_duration_minutes: null, default_language: 'es', is_active: true });
    this.modalContent.set('event');
    this.isModalOpen.set(true);
  }

  openSessionModal(session?: EventSession) {
    const tagsText = session?.tags?.join(', ') ?? '';
    this.editingSession.set(session ? {
      ...session,
      start_at: this.toDatetimeLocal(session.start_at),
      end_at: this.toDatetimeLocal(session.end_at),
      registration_deadline_at: this.toDatetimeLocal(session.registration_deadline_at),
      tags_text: tagsText,
    } : { event_id: this.events()[0]?.id, name: '', start_at: null, end_at: null, duration_minutes: null, time_zone: 'America/Bogota', delivery_mode: 'ONLINE', location_name: '', location_address: '', city: '', country: '', meeting_link: '', speaker_name: '', speaker_title: '', speaker_bio: '', capacity: null, status: 'PROGRAMADO', registration_open: true, registration_deadline_at: null, tags_text: '' });
    this.modalContent.set('session');
    this.isModalOpen.set(true);
  }

  openMessageVariantModal(variant?: EventMessageVariant) {
    this.editingMessageVariant.set(variant ? { ...variant } : { event_id: this.events()[0]?.id, account_tier: 'A', meta_template_name: '', cta_label: '', cta_type: '', body_preview: '' });
    this.modalContent.set('message_variant');
    this.isModalOpen.set(true);
  }

  closeModal() {
    this.isModalOpen.set(false);
    this.modalContent.set(null);
  }

  async saveEventType() {
    const payload = this.editingEventType();
    if (!payload) return;
    try {
      await this.dataService.saveEventType(this.botId(), payload);
      await this.refreshEventTypes();
      this.toastService.showSuccess(this.languageService.T('saveSuccess'));
      this.closeModal();
    } catch (e) {
      this.toastService.showError(this.languageService.T('saveError'));
    }
  }

  async saveEvent() {
    const payload = this.editingEvent();
    if (!payload) return;
    try {
      await this.dataService.saveEvent(this.botId(), payload);
      await this.refreshEvents();
      this.toastService.showSuccess(this.languageService.T('saveSuccess'));
      this.closeModal();
    } catch (e) {
      this.toastService.showError(this.languageService.T('saveError'));
    }
  }

  async saveSession() {
    const payload = this.editingSession();
    if (!payload) return;
    const tags = payload.tags_text?.split(',').map(t => t.trim()).filter(Boolean) ?? [];
    const finalPayload: Partial<EventSession> = {
      ...payload,
      start_at: this.normalizeDatetimeForApi(payload.start_at ?? null),
      end_at: this.normalizeDatetimeForApi(payload.end_at ?? null),
      registration_deadline_at: this.normalizeDatetimeForApi(payload.registration_deadline_at ?? null),
      tags,
    };
    delete (finalPayload as EditableEventSession).tags_text;
    try {
      await this.dataService.saveEventSession(this.botId(), finalPayload);
      await this.refreshSessions();
      this.toastService.showSuccess(this.languageService.T('saveSuccess'));
      this.closeModal();
    } catch (e) {
      this.toastService.showError(this.languageService.T('saveError'));
    }
  }

  async saveMessageVariant() {
    const payload = this.editingMessageVariant();
    if (!payload) return;
    try {
      await this.dataService.saveEventMessageVariant(this.botId(), payload);
      await this.refreshMessageVariants();
      this.toastService.showSuccess(this.languageService.T('saveSuccess'));
      this.closeModal();
    } catch (e) {
      this.toastService.showError(this.languageService.T('saveError'));
    }
  }

  requestDelete(target: DeleteTarget) {
    this.deleteTarget.set(target);
  }

  cancelDelete() {
    this.deleteTarget.set(null);
  }

  async confirmDelete() {
    const target = this.deleteTarget();
    if (!target) return;
    try {
      if (target.type === 'event_type') {
        await this.dataService.deleteEventType(this.botId(), target.item.id);
        await this.refreshEventTypes();
      }
      if (target.type === 'event') {
        await this.dataService.deleteEvent(this.botId(), target.item.id);
        await this.refreshEvents();
      }
      if (target.type === 'session') {
        await this.dataService.deleteEventSession(this.botId(), target.item.id);
        await this.refreshSessions();
      }
      if (target.type === 'message_variant') {
        await this.dataService.deleteEventMessageVariant(this.botId(), target.item.id);
        await this.refreshMessageVariants();
      }
      this.toastService.showSuccess(this.languageService.T('deleteSuccess'));
    } catch (e) {
      this.toastService.showError(this.languageService.T('deleteError'));
    } finally {
      this.cancelDelete();
    }
  }
}
