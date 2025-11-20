import { Component, ChangeDetectionStrategy, input, signal, inject, effect, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DataService } from '../../services/data.service';
import { LanguageService } from '../../services/language.service';
import { ToastService } from '../../services/toast.service';
import { AuthService } from '../../services/auth.service';
import { WATemplate, NotificationConfig, Campaign, NotificationQueueItem, WATemplateDetail, NotificationType, PaymentStatus, ConfirmationStatus, TemplateParameter, Contact, CampaignContact, CampaignStatus, ExecuteCampaignResponse } from '../../models';

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
  activeSubView = signal<NotificationSubView>('campaigns');
  
  // Data Signals
  templates = signal<WATemplate[]>([]);
  configs = signal<NotificationConfig[]>([]);
  campaigns = signal<Campaign[]>([]);
  queueItems = signal<NotificationQueueItem[]>([]);
  allBotContacts = signal<Contact[]>([]);

  // Modal State
  isModalOpen = signal(false);
  modalContent = signal<'templateParams' | 'notificationConfig' | 'newCampaign' | 'addContacts' | 'renameCampaign' | null>(null);

  editingTemplate = signal<WATemplateDetail | null>(null);
  editingConfig = signal<Partial<NotificationConfig> | null>(null);
  newCampaign = signal<{ name: string, template_id: number | null }>({ name: '', template_id: null });
  configToDelete = signal<NotificationConfig | null>(null);
  
  // Offset UI State for Automations
  offsetValue = signal(24);
  offsetUnit = signal<'minutes' | 'hours' | 'days'>('hours');
  offsetTimeframe = signal<'before' | 'after'>('before');

  // Campaign Detail View State
  selectedCampaign = signal<CampaignDetails | null>(null);
  isCampaignLoading = signal(false);
  isExecuting = signal(false);
  
  // Add Contacts Modal State
  contactSearchTerm = signal('');
  selectedContactIds = signal<Set<string>>(new Set());

  // Delete Campaign State
  campaignToDelete = signal<Campaign | null>(null);
  campaignToExecute = signal<Campaign | null>(null);

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

  readonly notificationTypes: NotificationType[] = ['appointment_reminder', 'payment_reminder', 'pre_procedure_instructions', 'post_procedure_followup'];
  readonly paymentStatuses: PaymentStatus[] = ['pendiente', 'pagado'];
  readonly confirmationStatuses: ConfirmationStatus[] = ['agendada', 'confirmada', 'realizada', 'cancelada'];
  readonly contactFields: (keyof Contact)[] = ['name', 'phone_number', 'email'];

  constructor() {
    effect(() => {
      this.loadAllData(this.botId());
    }, { allowSignalWrites: true });
  }

  async loadAllData(botId: string) {
    this.isLoading.set(true);
    const [templates, configs, campaigns, queue] = await Promise.all([
      this.dataService.getWaTemplates(botId),
      this.dataService.getNotificationConfigs(botId),
      this.dataService.getCampaigns(botId),
      this.dataService.getNotificationQueue(botId)
    ]);
    this.templates.set(templates);
    this.configs.set(configs);
    this.campaigns.set(campaigns);
    this.queueItems.set(queue);
    this.isLoading.set(false);
  }

  changeSubView(view: NotificationSubView) {
    this.activeSubView.set(view);
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

    // Calculate offset_minutes from UI
    let multiplier = 1;
    if (this.offsetUnit() === 'hours') multiplier = 60;
    if (this.offsetUnit() === 'days') multiplier = 60 * 24;
    
    const calculatedMinutes = this.offsetValue() * multiplier;
    config.offset_minutes = this.offsetTimeframe() === 'before' ? -calculatedMinutes : calculatedMinutes;

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
  
  // --- CAMPAIGNS ---

  async selectCampaign(campaign: Campaign) {
    this.isCampaignLoading.set(true);
    this.selectedCampaign.set(null);

    const [campaignDetails, contacts, template] = await Promise.all([
      this.dataService.getCampaign(this.botId(), campaign.id),
      this.dataService.getCampaignContacts(this.botId(), campaign.id),
      this.dataService.getWaTemplateDetail(this.botId(), campaign.template_id),
    ]);
    
    if (!campaignDetails || !template) {
      this.isCampaignLoading.set(false);
      this.toastService.showError('Error loading campaign details');
      return;
    }

    // Merge parameters from campaign into the template's parameter structure
    if (campaignDetails.parameters && campaignDetails.parameters.length > 0) {
      template.parameters = template.parameters.map(templateParam => {
        const campaignParam = (campaignDetails.parameters as any[]).find(p => p.template_param_id === templateParam.id);
        if (campaignParam) {
          return { ...templateParam, assign_type: campaignParam.assign_type, assign_value: campaignParam.assign_value };
        }
        return templateParam;
      });
    }

    this.selectedCampaign.set({ ...campaignDetails, contacts, template });
    this.isCampaignLoading.set(false);
  }

  backToCampaignsList() {
    this.selectedCampaign.set(null);
  }

  openNewCampaignModal() {
     this.newCampaign.set({ name: '', template_id: this.approvedTemplates()[0]?.id ?? null });
     this.modalContent.set('newCampaign');
     this.isModalOpen.set(true);
  }

  async createCampaign() {
    const campaignData = this.newCampaign();
    if (!campaignData.name || !campaignData.template_id) return;
    
    try {
      const newCampaign = await this.dataService.createCampaign(this.botId(), { name: campaignData.name, template_id: campaignData.template_id });
      this.campaigns.set(await this.dataService.getCampaigns(this.botId()));
      this.toastService.showSuccess(this.languageService.T('saveSuccess'));
      this.closeModal();
      this.selectCampaign(newCampaign); // Automatically go to edit view
    } catch (e) {
      this.toastService.showError(this.languageService.T('saveError'));
    }
  }

  async openAddContactsModal() {
    this.contactSearchTerm.set('');
    this.selectedContactIds.set(new Set());
    this.allBotContacts.set(await this.dataService.getContacts(this.botId()));
    this.modalContent.set('addContacts');
    this.isModalOpen.set(true);
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

    const contactsToAdd = this.allBotContacts()
        .filter(c => contactIds.has(c.contact_id))
        .map(contact => {
            const params: { [key: string]: any } = {};
            if (templateParams) {
                templateParams.forEach(p => {
                    if (p.assign_type === 'fixed_value') {
                        params[p.param_index] = p.assign_value;
                    } else if (p.assign_type === 'contact_field' && p.assign_value) {
                        params[p.param_index] = contact[p.assign_value as keyof Contact];
                    }
                });
            }
            return { phone_number: contact.phone_number!, params };
        });

    try {
        await this.dataService.addContactsToCampaign(this.botId(), campaign.id, contactsToAdd);
        this.toastService.showSuccess('Contacts added successfully.');
        this.closeModal();
        this.selectCampaign(campaign); // Refresh details
    } catch (e) {
        this.toastService.showError('Failed to add contacts.');
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
    } catch (e) {
      this.toastService.showError(this.languageService.T('saveError'));
    }
  }

  requestExecuteCampaign() {
    const campaign = this.selectedCampaign();
    if (!campaign) return;

    // Frontend Validations
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
    this.campaignToExecute.set(null); // Close modal

    try {
        const response = await this.dataService.executeCampaign(this.botId(), campaign.id);

        this.toastService.showSuccess(
          this.languageService.T('campaignExecutionSuccess').replace('{count}', String(response.total_contacts))
        );
        
        // Update local state
        const newStatus = response.campaign_status;
        this.selectedCampaign.update(c => c ? { ...c, status: newStatus } : null);
        this.campaigns.update(cs => cs.map(c => c.id === campaign.id ? { ...c, status: newStatus } : c));

        // Navigate and refresh queue
        this.activeSubView.set('queue');
        this.queueItems.set(await this.dataService.getNotificationQueue(this.botId()));

    } catch(e) {
        this.toastService.showError(this.languageService.T('campaignExecutionError'));
    } finally {
        this.isExecuting.set(false);
    }
  }

  requestDeleteCampaign(campaign: Campaign) {
    this.campaignToDelete.set(campaign);
  }

  cancelDeleteCampaign() {
    this.campaignToDelete.set(null);
  }

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

  // --- GENERAL ---
  closeModal() {
    this.isModalOpen.set(false);
    this.modalContent.set(null);
  }

  getTemplateName(templateId: number): string {
    return this.templates().find(t => t.id === templateId)?.name || 'Unknown';
  }
  
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
    if (config.apply_if_payment_status) {
      filters.push(`${lang.T('paymentStatus')}: ${lang.T('paymentStatus_' + config.apply_if_payment_status)}`);
    }
    if (config.apply_if_confirmation_status) {
      filters.push(`${lang.T('confirmationStatus')}: ${lang.T('confirmationStatus_' + config.apply_if_confirmation_status)}`);
    }
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
