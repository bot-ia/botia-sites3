import { Component, ChangeDetectionStrategy, input, signal, inject, effect, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DataService } from '../../services/data.service';
import { LanguageService } from '../../services/language.service';
import { ToastService } from '../../services/toast.service';
import { AuthService } from '../../services/auth.service';
import { WATemplate, NotificationConfig, Campaign, NotificationQueueItem, WATemplateDetail, NotificationType, PaymentStatus, ConfirmationStatus, TemplateParameter, Contact, CampaignContact, CampaignStatus, ExecuteCampaignResponse, FilterableField, FilterCondition, Operator, SavedSegment, NotificationHistory, Event as ProgramEvent, EventSession } from '../../models';

type NotificationSubView = 'templates' | 'configs' | 'campaigns' | 'queue';

interface CampaignDetails extends Campaign {
  contacts: CampaignContact[];
  template: WATemplateDetail | null;
}

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './notifications.component.html',
  styleUrl: './notifications.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificationsComponent {
  botId = input.required<string>();

  private dataService = inject(DataService);
  languageService = inject(LanguageService);
  private toastService = inject(ToastService);
  private authService = inject(AuthService);

  // Component State
  isLoading = signal(true);
  isSyncing = signal(false);
  activeSubView = signal<NotificationSubView>('configs');
  
  // Data Signals
  templates = signal<WATemplate[]>([]);
  configs = signal<NotificationConfig[]>([]);
  campaigns = signal<Campaign[]>([]);
  queueItems = signal<NotificationQueueItem[]>([]);
  allBotContacts = signal<Contact[]>([]);
  events = signal<ProgramEvent[]>([]);
  eventSessions = signal<EventSession[]>([]);

  // Modal State
  isModalOpen = signal(false);
  modalContent = signal<'templateParams' | 'notificationConfig' | 'newCampaign' | 'addContacts' | 'renameCampaign' | 'history' | 'test' | null>(null);

  editingTemplate = signal<WATemplateDetail | null>(null);
  editingConfig = signal<Partial<NotificationConfig> | null>(null);
  newCampaign = signal<{ name: string, template_id: number | null, event_id: number | null, event_session_id: number | null }>({ name: '', template_id: null, event_id: null, event_session_id: null });
  configToDelete = signal<NotificationConfig | null>(null);
  
  // Offset UI State for Automations
  offsetValue = signal(24);
  offsetUnit = signal<'minutes' | 'hours' | 'days'>('hours');
  offsetTimeframe = signal<'before' | 'after'>('before');

  // History Modal State
  historyForConfig = signal<NotificationConfig | null>(null);
  historyItems = signal<NotificationHistory[]>([]);
  isHistoryLoading = signal(false);

  // Test Modal State
  configToTest = signal<NotificationConfig | null>(null);
  selectedTestContactId = signal<string | null>(null);
  isTesting = signal(false);

  // Campaign Detail View State
  selectedCampaign = signal<CampaignDetails | null>(null);
  isCampaignLoading = signal(false);
  isExecuting = signal(false);
  isAiSuggesting = signal(false);
  
  // Add Contacts Modal State
  addContactsModalTab = signal<'manual' | 'segmentation'>('manual');
  contactSearchTerm = signal('');
  selectedContactIds = signal<Set<string>>(new Set());
  
  // Segmentation State
  filterableFields = signal<FilterableField[]>([]);
  segmentFilters = signal<FilterCondition[]>([]);
  segmentPreview = signal<{ count: number; preview: Contact[] } | null>(null);
  isSegmentLoading = signal(false);
  isAddingSegment = signal(false);
  savedSegments = signal<SavedSegment[]>([]);
  loadedSegment = signal<SavedSegment | null>(null);
  segmentToDelete = signal<SavedSegment | null>(null);
  isSavingSegment = signal(false);
  newSegmentName = signal('');


  // Delete States
  campaignToDelete = signal<Campaign | null>(null);
  campaignToExecute = signal<Campaign | null>(null);
  contactToRemove = signal<CampaignContact | null>(null);

  // Permissions & Computed Data
  isAdmin = computed(() => this.authService.currentUser()?.role === 'admin');
  approvedTemplates = computed(() => this.templates().filter(t => t.status === 'APPROVED'));

  isCampaignReady = computed(() => {
    const campaign = this.selectedCampaign();
    if (!campaign) return false;
    const hasContacts = campaign.contacts.length > 0;
    const allParamsAssigned = campaign.template?.parameters.every(p => p.assign_type && p.assign_value) ?? true;
    return hasContacts && allParamsAssigned;
  });

  executeButtonState = computed(() => {
    const campaign = this.selectedCampaign();
    if (!campaign || ['RUNNING', 'COMPLETED', 'FINISHED'].includes(campaign.status)) {
      return {
        disabled: true,
        tooltip: this.languageService.T('campaignAlreadyRunningTooltip')
      };
    }
    if (!this.isCampaignReady()) {
        return { 
            disabled: true, 
            tooltip: this.languageService.T('runCampaignDisabledTooltip') 
        };
    }
    return {
      disabled: false,
      tooltip: this.languageService.T('runCampaignNow')
    };
  });

  filteredBotContacts = computed(() => {
    const term = this.contactSearchTerm().toLowerCase();
    const assignedContactPhones = new Set(this.selectedCampaign()?.contacts.map(c => c.contact_phone));
    return this.allBotContacts().filter(c => 
      !assignedContactPhones.has(c.phone_number!) &&
      (c.name?.toLowerCase().includes(term) || c.phone_number?.includes(term))
    );
  });

  availableContactFields = computed(() => {
    const contacts = this.allBotContacts();
    if (!contacts || contacts.length === 0) {
      return ['name', 'phone_number', 'email']; // Valores por defecto
    }
    const fields = new Set<string>(['name', 'phone_number', 'email']);
    contacts.forEach(c => {
      if (c.attributes && typeof c.attributes === 'object') {
        Object.keys(c.attributes).forEach(k => fields.add(k));
      }
    });
    return Array.from(fields).sort();
  });

  readonly notificationTypes: NotificationType[] = [
    'appointment_reminder', 
    'payment_reminder', 
    'pre_procedure_instructions', 
    'post_procedure_followup',
    'birthday_greeting',
    'reactivation_campaign'
  ];
  readonly paymentStatuses: PaymentStatus[] = ['pendiente', 'pagado'];
  readonly confirmationStatuses: ConfirmationStatus[] = ['agendada', 'confirmada', 'realizada', 'cancelada'];
  
  readonly eventFields = [
    { key: 'event.title', label: 'Evento: Título' },
    { key: 'event.description', label: 'Evento: Descripción' },
    { key: 'event.brand', label: 'Evento: Marca' },
    { key: 'event.topic', label: 'Evento: Tema' },
    { key: 'session.name', label: 'Sesión: Nombre' },
    { key: 'session.start_at', label: 'Sesión: Fecha/Hora Inicio' },
    { key: 'session.end_at', label: 'Sesión: Fecha/Hora Fin' },
    { key: 'session.location_name', label: 'Sesión: Ubicación (Lugar)' },
    { key: 'session.location_address', label: 'Sesión: Dirección' },
    { key: 'session.meeting_link', label: 'Sesión: Link Reunión' },
    { key: 'session.speaker_name', label: 'Sesión: Speaker' },
    { key: 'session.time_zone', label: 'Sesión: Zona Horaria' }
  ];

  constructor() {
    effect(() => {
      this.loadAllData(this.botId());
    }, { allowSignalWrites: true });

    effect(() => {
      const filters = this.segmentFilters();
      if (!this.loadedSegment() || JSON.stringify(this.loadedSegment()?.filters) !== JSON.stringify(filters)) {
         this.loadedSegment.set(null); // Unset if filters change manually
      }
    }, { allowSignalWrites: true });
  }

  async loadAllData(botId: string) {
    this.isLoading.set(true);
    const [templates, configs, campaigns, queue, events] = await Promise.all([
      this.dataService.getWaTemplates(botId),
      this.dataService.getNotificationConfigs(botId),
      this.dataService.getCampaigns(botId),
      this.dataService.getNotificationQueue(botId),
      this.dataService.getEvents(botId)
    ]);
    this.templates.set(templates);
    this.configs.set(configs);
    this.campaigns.set(campaigns);
    this.queueItems.set(queue);
    this.events.set(events);
    this.isLoading.set(false);
  }

  async refreshCampaignData() {
    this.isCampaignLoading.set(true);
    try {
      const campaigns = await this.dataService.getCampaigns(this.botId());
      this.campaigns.set(campaigns);
      
      // Si hay una campaña seleccionada, recargarla
      const current = this.selectedCampaign();
      if (current) {
        const updated = campaigns.find(c => c.id === current.id);
        if (updated) {
          await this.selectCampaign(updated);
        }
      }
      
      this.toastService.showSuccess(this.languageService.T('dataRefreshed'));
    } catch(e) {
      this.toastService.showError(this.languageService.T('refreshError'));
    } finally {
      this.isCampaignLoading.set(false);
    }
  }

  async changeSubView(view: NotificationSubView) {
    this.activeSubView.set(view);
    if (view === 'queue') {
      await this.refreshQueue();
    }
  }
  
  async refreshQueue() {
    this.isCampaignLoading.set(true); // Re-use loading signal for visual feedback
    try {
      this.queueItems.set(await this.dataService.getNotificationQueue(this.botId()));
      this.toastService.showSuccess(this.languageService.T('queueRefreshed'));
    } catch(e) {
      this.toastService.showError(this.languageService.T('queueRefreshError'));
    } finally {
      this.isCampaignLoading.set(false);
    }
  }

  async syncTemplates() {
    this.isSyncing.set(true);
    try {
      await this.dataService.syncMetaTemplates(this.botId());
      this.toastService.showSuccess(this.languageService.T('syncTemplatesSuccess'));
      await this.loadAllData(this.botId());
    } catch (err: any) {
      console.error("Error syncing templates:", err);
      const errorMessage = err?.error?.detail || this.languageService.T('syncTemplatesError');
      this.toastService.showError(errorMessage);
    } finally {
      this.isSyncing.set(false);
    }
  }

  // --- TEMPLATES ---
  async openTemplateParamsModal(template: WATemplate) {
    const detail = await this.dataService.getWaTemplateDetail(this.botId(), template.id);
    if (detail) {
      this.editingTemplate.set(detail);
      this.modalContent.set('templateParams');
      this.isModalOpen.set(true);
    }
  }

  async saveTemplateParams() {
    const template = this.editingTemplate();
    if (!template) return;

    try {
      await this.dataService.updateTemplateParameters(this.botId(), template.id, template.parameters);
      this.toastService.showSuccess(this.languageService.T('saveSuccess'));
      this.closeModal();
    } catch (e) {
      this.toastService.showError(this.languageService.T('saveError'));
    }
  }

  // --- AUTOMATIONS ---
  openConfigModal(config: NotificationConfig | null = null) {
    if (config) { // Editing
      this.editingConfig.set({ ...config });
      
      if (this.isIntervalBased(config.notification_type)) {
        let minutes = Math.abs(config.offset_minutes);
        if (minutes % (60 * 24) === 0 && minutes > 0) {
          this.offsetValue.set(minutes / (60 * 24));
          this.offsetUnit.set('days');
        } else if (minutes % 60 === 0 && minutes > 0) {
          this.offsetValue.set(minutes / 60);
          this.offsetUnit.set('hours');
        } else {
          this.offsetValue.set(minutes);
          this.offsetUnit.set('minutes');
        }
        this.offsetTimeframe.set(config.offset_minutes < 0 ? 'before' : 'after');
      }
      
    } else { // Creating
      const firstTemplateId = this.approvedTemplates()[0]?.id;
      this.editingConfig.set({
        bot_id: this.botId(),
        notification_type: 'appointment_reminder',
        template_id: firstTemplateId,
        offset_minutes: -1440,
        is_active: true,
      });
      // Set UI defaults
      this.offsetValue.set(24);
      this.offsetUnit.set('hours');
      this.offsetTimeframe.set('before');
    }

    this.modalContent.set('notificationConfig');
    this.isModalOpen.set(true);
  }

  async saveConfig() {
    const config = this.editingConfig();
    if (!config || !config.template_id) return;
    
    if (this.isIntervalBased(config.notification_type)) {
      let multiplier = 1;
      if (this.offsetUnit() === 'hours') multiplier = 60;
      if (this.offsetUnit() === 'days') multiplier = 60 * 24;
      
      const calculatedMinutes = this.offsetValue() * multiplier;
      config.offset_minutes = this.offsetTimeframe() === 'before' ? -calculatedMinutes : calculatedMinutes;
    } else {
      config.offset_minutes = 0;
      config.apply_if_payment_status = undefined;
      config.apply_if_confirmation_status = undefined;
    }

    try {
      await this.dataService.saveNotificationConfig(config);
      this.configs.set(await this.dataService.getNotificationConfigs(this.botId()));
      this.toastService.showSuccess(this.languageService.T('saveSuccess'));
      this.closeModal();
    } catch (e) {
      this.toastService.showError(this.languageService.T('saveError'));
    }
  }

  async toggleConfigStatus(config: NotificationConfig) {
    const updatedConfig = { ...config, is_active: !config.is_active };
    
    try {
      await this.dataService.saveNotificationConfig({
        id: updatedConfig.id,
        bot_id: updatedConfig.bot_id,
        is_active: updatedConfig.is_active
      });
      this.configs.update(configs => 
        configs.map(c => c.id === updatedConfig.id ? updatedConfig : c)
      );
      this.toastService.showSuccess(this.languageService.T('saveSuccess'));
    } catch (e) {
      this.toastService.showError(this.languageService.T('saveError'));
      this.configs.update(c => [...c]); // Re-trigger view update to revert toggle
    }
  }

  requestDeleteConfig(config: NotificationConfig) {
    this.configToDelete.set(config);
  }

  cancelDeleteConfig() {
    this.configToDelete.set(null);
  }

  async confirmDeleteConfig() {
    const config = this.configToDelete();
    if (!config) return;

    try {
      await this.dataService.deleteNotificationConfig(config);
      this.configs.update(configs => configs.filter(c => c.id !== config.id));
      this.toastService.showSuccess(this.languageService.T('deleteSuccess'));
    } catch (e) {
      this.toastService.showError(this.languageService.T('deleteError'));
    } finally {
      this.cancelDeleteConfig();
    }
  }

  // --- HISTORY & TEST MODALS ---
  isIntervalBased(type: NotificationType): boolean {
    return !['birthday_greeting', 'reactivation_campaign'].includes(type);
  }

  async openHistoryModal(config: NotificationConfig) {
    this.historyForConfig.set(config);
    this.modalContent.set('history');
    this.isModalOpen.set(true);
    this.isHistoryLoading.set(true);
    try {
      const history = await this.dataService.getNotificationHistory(this.botId(), config.id);
      this.historyItems.set(history);
    } catch(e) {
      this.toastService.showError('Failed to load history.');
      this.historyItems.set([]);
    } finally {
      this.isHistoryLoading.set(false);
    }
  }

  async openTestModal(config: NotificationConfig) {
    this.configToTest.set(config);
    this.selectedTestContactId.set(null);
    this.modalContent.set('test');
    this.isModalOpen.set(true);
    if (this.allBotContacts().length === 0) {
      this.allBotContacts.set(await this.dataService.getContacts(this.botId()));
    }
  }
  
  async sendTestNotification() {
    const config = this.configToTest();
    const contactId = this.selectedTestContactId();
    if (!config || !contactId) {
      this.toastService.showError(this.languageService.T('noContactSelected'));
      return;
    }
    
    this.isTesting.set(true);
    try {
      await this.dataService.testNotificationConfig(this.botId(), config.id, contactId);
      this.toastService.showSuccess(this.languageService.T('testSuccessMessage'));
      this.closeModal();
    } catch(e) {
      this.toastService.showError(this.languageService.T('testErrorMessage'));
      console.error(e);
    } finally {
      this.isTesting.set(false);
    }
  }
  
  // --- CAMPAIGNS ---

  async selectCampaign(campaign: Campaign) {
    this.isCampaignLoading.set(true);
    this.selectedCampaign.set(null);

    const [campaignDetails, contacts, template, allBotContacts] = await Promise.all([
      this.dataService.getCampaign(this.botId(), campaign.id),
      this.dataService.getCampaignContacts(this.botId(), campaign.id),
      this.dataService.getWaTemplateDetail(this.botId(), campaign.template_id),
      this.dataService.getContacts(this.botId())
    ]);
    
    this.allBotContacts.set(allBotContacts);
    
    if (!campaignDetails || !template) {
      this.isCampaignLoading.set(false);
      this.toastService.showError('Error loading campaign details');
      return;
    }

    if (campaignDetails.parameters && campaignDetails.parameters.length > 0) {
      template.parameters = template.parameters.map(templateParam => {
        const campaignParam = (campaignDetails.parameters as any[]).find(p => p.template_param_id === templateParam.id);
        if (campaignParam) {
          return { ...templateParam, assign_type: campaignParam.assign_type, assign_value: campaignParam.assign_value };
        }
        return templateParam;
      });
    }

    await this.loadSessionsForCampaign(campaignDetails.event_id ?? null);
    this.selectedCampaign.set({ ...campaignDetails, contacts, template });
    this.isCampaignLoading.set(false);
  }

  backToCampaignsList() {
    this.selectedCampaign.set(null);
  }

  openNewCampaignModal() {
      this.newCampaign.set({ name: '', template_id: this.approvedTemplates()[0]?.id ?? null, event_id: null, event_session_id: null });
      this.eventSessions.set([]);
     this.modalContent.set('newCampaign');
     this.isModalOpen.set(true);
  }

  async createCampaign() {
    const campaignData = this.newCampaign();
    if (!campaignData.name || !campaignData.template_id) return;
    
    try {
      const newCampaign = await this.dataService.createCampaign(this.botId(), { name: campaignData.name, template_id: campaignData.template_id, event_id: campaignData.event_id, event_session_id: campaignData.event_session_id });
      
      // Get full campaign details from backend including template_name
      const fullCampaignList = await this.dataService.getCampaigns(this.botId());
      this.campaigns.set(fullCampaignList);
      
      this.toastService.showSuccess(this.languageService.T('saveSuccess'));
      this.closeModal();
      
      // Find and select the newly created campaign
      const createdCampaign = fullCampaignList.find(c => c.id === newCampaign.id);
      if (createdCampaign) {
        await this.selectCampaign(createdCampaign);
      }
    } catch (e) {
      this.toastService.showError(this.languageService.T('saveError'));
    }
  }

  async onCampaignEventChange(eventId: number | null) {
    if (!eventId) {
      this.eventSessions.set([]);
      this.newCampaign.update(c => ({ ...c, event_session_id: null }));
      return;
    }
    const sessions = await this.dataService.getEventSessions(this.botId(), { event_id: eventId });
    this.eventSessions.set(sessions);
    this.newCampaign.update(c => ({ ...c, event_session_id: sessions[0]?.id ?? null }));
  }

  getEventName(eventId?: number | null): string {
    if (!eventId) return this.languageService.T('noEventSelected');
    return this.events().find(e => e.id === eventId)?.title ?? this.languageService.T('noEventSelected');
  }

  getSessionName(sessionId?: number | null): string {
    if (!sessionId) return this.languageService.T('noSessionSelected');
    return this.eventSessions().find(s => s.id === sessionId)?.name ?? this.languageService.T('noSessionSelected');
  }

  async loadSessionsForCampaign(eventId?: number | null) {
    if (!eventId) {
      this.eventSessions.set([]);
      return;
    }
    this.eventSessions.set(await this.dataService.getEventSessions(this.botId(), { event_id: eventId }));
  }

  async openAddContactsModal() {
    this.addContactsModalTab.set('manual');
    this.contactSearchTerm.set('');
    this.selectedContactIds.set(new Set());
    this.clearSegmentFilters();
    this.filterableFields.set([]);
    this.savedSegments.set([]);
    this.segmentPreview.set(null);
    this.isSavingSegment.set(false);
    this.newSegmentName.set('');

    this.modalContent.set('addContacts');
    this.isModalOpen.set(true);
    
    const [contacts, fields, segments] = await Promise.all([
      this.dataService.getContacts(this.botId()),
      this.dataService.getFilterableFields(this.botId()),
      this.dataService.getSavedSegments(this.botId())
    ]);
    this.allBotContacts.set(contacts);
    this.filterableFields.set(fields);
    this.savedSegments.set(segments);
  }

  changeAddContactsTab(tab: 'manual' | 'segmentation') {
    this.addContactsModalTab.set(tab);
  }

  toggleContactSelection(contactId: string) {
    this.selectedContactIds.update(ids => {
      if (ids.has(contactId)) {
        ids.delete(contactId);
      } else {
        ids.add(contactId);
      }
      return new Set(ids);
    });
  }

  async addSelectedContacts() {
    const campaign = this.selectedCampaign();
    const contactIds = this.selectedContactIds();
    const templateParams = campaign?.template?.parameters;
    
    if (!campaign || contactIds.size === 0) return;

    // 1. Identify which keys are required (mapped to contact_field)
    const requiredParamKeys: string[] = [];
    if (templateParams) {
        templateParams.forEach(p => {
            if (p.assign_type === 'contact_field' && p.assign_value) {
                requiredParamKeys.push(p.assign_value);
            }
        });
    }

    const contactsToAdd = this.allBotContacts()
        .filter(c => contactIds.has(c.contact_id))
        .map(contact => {
             // 2. Build full params object including attributes
            const params: { [key: string]: any } = {
                name: contact.name,
                phone: contact.phone_number, 
                phone_number: contact.phone_number,
                email: contact.email,
            };
            if (contact.attributes) {
                Object.assign(params, contact.attributes);
            }
            return { phone_number: contact.phone_number!, params, contactName: contact.name }; 
        });

    // 3. Validation
    const invalidContacts: string[] = [];
    contactsToAdd.forEach(c => {
        const missingKeys = requiredParamKeys.filter(key => 
            c.params[key] === undefined || c.params[key] === null || c.params[key] === ''
        );
        if (missingKeys.length > 0) {
            invalidContacts.push(`${c.contactName || c.phone_number} (Faltan: ${missingKeys.join(', ')})`);
        }
    });

    if (invalidContacts.length > 0) {
        this.toastService.showError(
            `No se pueden añadir contactos porque faltan datos requeridos por la plantilla:\n${invalidContacts.slice(0, 3).join('\n')}${invalidContacts.length > 3 ? '...' : ''}`
        );
        return;
    }

    const payload = contactsToAdd.map(c => ({ phone_number: c.phone_number, params: c.params }));

    try {
        const result = await this.dataService.addContactsToCampaign(this.botId(), campaign.id, payload);
        this.toastService.showSuccess(this.languageService.T('addContactsSuccess'));
        this.closeModal();
        
        // Refresh campaign data immediately
        await this.selectCampaign(campaign);
        // Also update the main list count if needed (optional since detail view is authoritative)
        this.campaigns.update(cs => cs.map(c => c.id === campaign.id ? { ...c, total_contacts: c.total_contacts + payload.length } : c));
        
    } catch (e) {
        this.toastService.showError(this.languageService.T('addContactsError'));
    }
  }

  async saveParameterMappings() {
    const campaign = this.selectedCampaign();
    if (!campaign?.template?.parameters) return;

    const parametersToSave = campaign.template.parameters
      .filter(p => p.assign_type && p.assign_value)
      .map(p => ({
        template_param_id: p.id,
        assign_type: p.assign_type!,
        assign_value: p.assign_value!,
      }));

    try {
      await this.dataService.updateCampaignParameters(this.botId(), campaign.id, parametersToSave);
      this.toastService.showSuccess(this.languageService.T('saveSuccess'));
      
      // Recargar la campaña completa para actualizar el estado y activar botón
      await this.selectCampaign(campaign);
    } catch (e) {
      this.toastService.showError(this.languageService.T('saveError'));
    }
  }

  async autoFillParametersWithAI() {
    const campaign = this.selectedCampaign();
    if (!campaign?.template?.parameters) return;

    this.isAiSuggesting.set(true);
    
    try {
      // Preparar datos del evento y sesión
      const event = campaign.event_id ? this.events().find(e => e.id === campaign.event_id) : null;
      const session = campaign.event_session_id ? this.eventSessions().find(s => s.id === campaign.event_session_id) : null;

      const payload = {
        parameters: campaign.template.parameters.map(p => ({
          param_index: p.param_index,
          param_name: p.param_name || `param_${p.param_index}`,
          param_example: p.param_example
        })),
        available_contact_fields: this.availableContactFields(),
        event_data: event ? {
          title: event.title,
          description: event.description,
          brand: event.brand,
          topic: event.topic
        } : undefined,
        session_data: session ? {
          name: session.name,
          start_at: session.start_at,
          end_at: session.end_at,
          location_name: session.location_name,
          location_address: session.location_address,
          meeting_link: session.meeting_link,
          speaker_name: session.speaker_name
        } : undefined
      };

      const response = await this.dataService.suggestParameterMappings(this.botId(), payload);

      // Aplicar las sugerencias
      if (response.suggestions && response.suggestions.length > 0) {
        this.selectedCampaign.update(c => {
          if (!c?.template?.parameters) return c;
          
          const updatedParams = c.template.parameters.map(param => {
            const suggestion = response.suggestions.find(s => s.param_index === param.param_index);
            if (suggestion) {
              return {
                ...param,
                assign_type: suggestion.assign_type as any,
                assign_value: suggestion.assign_value
              };
            }
            return param;
          });

          return {
            ...c,
            template: { ...c.template, parameters: updatedParams }
          };
        });

        this.toastService.showSuccess(this.languageService.T('aiSuggestionsApplied'));
      } else {
        this.toastService.showError(this.languageService.T('noAiSuggestions'));
      }
    } catch (e: any) {
      console.error('Error en AI suggestions:', e);
      this.toastService.showError(this.languageService.T('aiSuggestionsError'));
    } finally {
      this.isAiSuggesting.set(false);
    }
  }

  requestExecuteCampaign() {
    const campaign = this.selectedCampaign();
    if (!campaign) return;
    if (campaign.status !== 'DRAFT' && campaign.status !== 'READY') {
      this.toastService.showError(this.languageService.T('validation_campaign_wrong_status'));
      return;
    }
    if (campaign.contacts.length === 0) {
      this.toastService.showError(this.languageService.T('validation_campaign_no_contacts'));
      return;
    }
    const allParamsAssigned = campaign.template?.parameters.every(p => p.assign_type && p.assign_value) ?? true;
    if (!allParamsAssigned) {
      this.toastService.showError(this.languageService.T('validation_campaign_missing_params'));
      return;
    }
    
    this.campaignToExecute.set(campaign);
  }

  cancelExecuteCampaign() {
    this.campaignToExecute.set(null);
  }

  async confirmExecuteCampaign() {
    const campaign = this.campaignToExecute();
    if (!campaign) return;

    this.isExecuting.set(true);
    this.campaignToExecute.set(null);

    try {
        const response = await this.dataService.executeCampaign(this.botId(), campaign.id);
        const sentCount = response.sent ?? response.total_contacts ?? 0;
        this.toastService.showSuccess(
          this.languageService.T('campaignExecutionSuccess').replace('{count}', String(sentCount))
        );
        
        if (response.campaign_status) {
          const newStatus = response.campaign_status;
          this.selectedCampaign.update(c => c ? { ...c, status: newStatus } : null);
          this.campaigns.update(cs => cs.map(c => c.id === campaign.id ? { ...c, status: newStatus } : c));
        }
        this.activeSubView.set('queue');
        this.queueItems.set(await this.dataService.getNotificationQueue(this.botId()));

    } catch(e) {
        this.toastService.showError(this.languageService.T('campaignExecutionError'));
    } finally {
        this.isExecuting.set(false);
    }
  }

  async forceDispatchFromQueue() {
    const campaign = this.selectedCampaign();
    if (!campaign) {
      this.toastService.showError(this.languageService.T('validation_campaign_select_first'));
      return;
    }

    this.isExecuting.set(true);
    try {
      const response = await this.dataService.dispatchCampaign(this.botId(), campaign.id);
      const sent = response.sent ?? 0;
      const failed = response.failed ?? 0;
      this.toastService.showSuccess(
        this.languageService.T('campaignDispatchSuccess')
          .replace('{sent}', String(sent))
          .replace('{failed}', String(failed))
      );
      this.queueItems.set(await this.dataService.getNotificationQueue(this.botId()));
    } catch (e) {
      this.toastService.showError(this.languageService.T('campaignDispatchError'));
    } finally {
      this.isExecuting.set(false);
    }
  }

  requestDeleteCampaign(campaign: Campaign) { this.campaignToDelete.set(campaign); }
  cancelDeleteCampaign() { this.campaignToDelete.set(null); }

  async confirmDeleteCampaign() {
    const campaign = this.campaignToDelete();
    if (!campaign) return;
    try {
      await this.dataService.deleteCampaign(this.botId(), campaign.id);
      this.toastService.showSuccess(this.languageService.T('deleteSuccess'));
      this.campaigns.update(cs => cs.filter(c => c.id !== campaign.id));
      if(this.selectedCampaign()?.id === campaign.id) {
        this.backToCampaignsList();
      }
    } catch (e) {
      this.toastService.showError(this.languageService.T('deleteError'));
    } finally {
      this.cancelDeleteCampaign();
    }
  }
  
  requestRemoveContact(contact: CampaignContact) { this.contactToRemove.set(contact); }
  cancelRemoveContact() { this.contactToRemove.set(null); }

  async confirmRemoveContact() {
    const contact = this.contactToRemove();
    const campaign = this.selectedCampaign();
    if (!contact || !campaign) return;
    try {
      await this.dataService.removeContactFromCampaign(this.botId(), campaign.id, contact.id);
      this.toastService.showSuccess(this.languageService.T('deleteSuccess'));
      
      this.selectedCampaign.update(c => {
        if (!c) return null;
        const updatedContacts = c.contacts.filter(ct => ct.id !== contact.id);
        return { ...c, contacts: updatedContacts };
      });
      this.campaigns.update(cs => cs.map(c => 
          c.id === campaign.id ? { ...c, total_contacts: Math.max(0, c.total_contacts - 1) } : c
      ));

    } catch (e) {
      this.toastService.showError(this.languageService.T('deleteError'));
    } finally {
      this.cancelRemoveContact();
    }
  }

  // --- SEGMENTATION ---
  addSegmentFilter() { this.segmentFilters.update(filters => [...filters, { id: Date.now(), fieldKey: null, operator: null, value: '' }]); }
  removeSegmentFilter(id: number) { this.segmentFilters.update(filters => filters.filter(f => f.id !== id)); }
  clearSegmentFilters() {
    this.segmentFilters.set([]);
    this.loadedSegment.set(null);
    this.segmentPreview.set(null);
  }
  updateFilterField(id: number, fieldKey: string) { this.segmentFilters.update(filters => filters.map(f => f.id === id ? { ...f, fieldKey, operator: null, value: '' } : f)); }
  updateFilterOperator(id: number, operator: Operator) { this.segmentFilters.update(filters => filters.map(f => f.id === id ? { ...f, operator } : f)); }

  async runSegmentPreview() {
    const filters = this.segmentFilters();
    const validFilters = filters.filter(f => f.fieldKey && f.operator && (f.value !== null && f.value !== '' || ['is_empty', 'is_not_empty'].includes(f.operator)));
    if (validFilters.length > 0) {
      this.isSegmentLoading.set(true);
      try {
        const result = await this.dataService.previewSegment(this.botId(), validFilters);
        this.segmentPreview.set(result);
      } catch (e) {
        this.toastService.showError('Error fetching segment preview.');
      } finally {
        this.isSegmentLoading.set(false);
      }
    } else {
      this.segmentPreview.set(null);
    }
  }

  async addSegmentToCampaign() {
    const campaign = this.selectedCampaign();
    const validFilters = this.segmentFilters().filter(f => f.fieldKey && f.operator && (f.value !== null && f.value !== '' || ['is_empty', 'is_not_empty'].includes(f.operator)));
    if (!campaign || validFilters.length === 0) return;
    this.isAddingSegment.set(true);
    try {
        const result = await this.dataService.addSegmentToCampaign(this.botId(), campaign.id, validFilters);
        this.toastService.showSuccess(this.languageService.T('addSegmentContactsSuccess').replace('{count}', String(result.added_count)));
        this.closeModal();
        this.selectCampaign(campaign);
    } catch (e) {
        this.toastService.showError(this.languageService.T('addSegmentContactsError'));
    } finally {
        this.isAddingSegment.set(false);
    }
  }

  loadSegment(event: Event) {
    const segmentId = (event.target as HTMLSelectElement).value;
    if (!segmentId) { this.clearSegmentFilters(); return; }
    const segment = this.savedSegments().find(s => s.segment_id === segmentId);
    if (segment) {
      this.segmentFilters.set(segment.filters.map((f, i) => ({...f, id: Date.now() + i })));
      this.loadedSegment.set(segment);
      this.segmentPreview.set(null);
    }
  }
  
  startSaveSegment() {
    const validFilters = this.segmentFilters().filter(f => f.fieldKey && f.operator);
    if (validFilters.length === 0) return;
    this.isSavingSegment.set(true);
    this.newSegmentName.set(this.loadedSegment()?.name || '');
  }

  cancelSaveSegment() { this.isSavingSegment.set(false); }

  async confirmSaveSegment() {
    const name = this.newSegmentName().trim();
    const validFilters = this.segmentFilters().filter(f => f.fieldKey && f.operator);
    if (!name || validFilters.length === 0) return;
    try {
      const newSegment = await this.dataService.saveSegment(this.botId(), { name, filters: validFilters });
      this.savedSegments.update(segments => {
        const existingIndex = segments.findIndex(s => s.segment_id === newSegment.segment_id);
        if (existingIndex > -1) { segments[existingIndex] = newSegment; return [...segments]; }
        return [...segments, newSegment];
      });
      this.loadedSegment.set(newSegment);
      this.isSavingSegment.set(false);
      this.toastService.showSuccess(this.languageService.T('segmentSaveSuccess'));
    } catch(e) {
      this.toastService.showError(this.languageService.T('segmentSaveError'));
    }
  }
  
  requestDeleteSegment() {
      const segment = this.loadedSegment();
      if (segment) { this.segmentToDelete.set(segment); }
  }
  cancelDeleteSegment() { this.segmentToDelete.set(null); }
  async confirmDeleteSegment() {
    const segment = this.segmentToDelete();
    if (!segment) return;
    try {
      await this.dataService.deleteSegment(this.botId(), segment.segment_id);
      this.savedSegments.update(segments => segments.filter(s => s.segment_id !== segment.segment_id));
      this.clearSegmentFilters();
      this.toastService.showSuccess(this.languageService.T('segmentDeleteSuccess'));
    } catch(e) {
      this.toastService.showError(this.languageService.T('segmentDeleteError'));
    } finally {
      this.cancelDeleteSegment();
    }
  }
  getFieldForFilter(filter: FilterCondition): FilterableField | undefined { return this.filterableFields().find(f => f.key === filter.fieldKey); }

  // --- GENERAL ---
  closeModal() {
    this.isModalOpen.set(false);
    this.modalContent.set(null);
  }

  getTemplateName(templateId: number): string { return this.templates().find(t => t.id === templateId)?.name || 'Unknown'; }
  getContactNameByPhone(phone: string): string { return this.allBotContacts().find(c => c.phone_number === phone)?.name || this.languageService.T('unidentifiedContact'); }
  
  formatDate(isoString: string | null | undefined): string {
    if (!isoString) return 'N/A';
    return new Date(isoString).toLocaleString(this.languageService.language(), {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  }
  
  formatOffset(minutes: number): string {
    const lang = this.languageService;
    const isBefore = minutes < 0;
    const absMinutes = Math.abs(minutes);
    if (absMinutes === 0) return 'At time of event';
    const days = Math.floor(absMinutes / 1440);
    const hours = Math.floor((absMinutes % 1440) / 60);
    const mins = absMinutes % 60;
    let parts = [];
    if (days > 0) parts.push(`${days} ${lang.T(days > 1 ? 'days' : 'day')}`);
    if (hours > 0) parts.push(`${hours} ${lang.T(hours > 1 ? 'hours' : 'hour')}`);
    if (mins > 0) parts.push(`${mins} ${lang.T(mins > 1 ? 'minutes' : 'minute')}`);
    if (parts.length === 0) return 'N/A';
    const timeString = parts.join(', ');
    const timeframe = isBefore ? lang.T('beforeEvent') : lang.T('afterEvent');
    return `${timeString} ${timeframe}`;
  }

  formatFilters(config: NotificationConfig): string {
    const lang = this.languageService;
    let filters: string[] = [];
    if (config.apply_if_payment_status) { filters.push(`${lang.T('paymentStatus')}: ${lang.T('paymentStatus_' + config.apply_if_payment_status)}`); }
    if (config.apply_if_confirmation_status) { filters.push(`${lang.T('confirmationStatus')}: ${lang.T('confirmationStatus_' + config.apply_if_confirmation_status)}`); }
    return filters.join(', ');
  }

  getCampaignStatusColor(status: CampaignStatus): string {
    switch (status) {
      case 'DRAFT': return 'bg-gray-700 text-gray-300';
      case 'READY': return 'bg-blue-900 text-blue-300';
      case 'RUNNING': return 'bg-yellow-900 text-yellow-300';
      case 'COMPLETED':
      case 'FINISHED': return 'bg-green-900 text-green-300';
      default: return 'bg-gray-700 text-gray-300';
    }
  }

  getQueueStatusColor(status: string): string {
    switch (status) {
      case 'PENDING': return 'bg-yellow-900 text-yellow-300';
      case 'SENT': return 'bg-green-900 text-green-300';
      case 'FAILED': return 'bg-red-900 text-red-300';
      case 'CANCELLED': return 'bg-gray-700 text-gray-300';
      case 'SKIPPED': return 'bg-blue-900 text-blue-300';
      default: return 'bg-gray-700 text-gray-300';
    }
  }
}
