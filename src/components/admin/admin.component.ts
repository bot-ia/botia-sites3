import { Component, ChangeDetectionStrategy, signal, inject, computed, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { DataService } from '../../services/data.service';
import { AuthService } from '../../services/auth.service';
import { LanguageService } from '../../services/language.service';
import { ApiService } from '../../services/api.service';
import { Bot, User, Prompt, SpecialLink, KnowledgeItem, PortfolioItem, BotType } from '../../models';
import { ToastService } from '../../services/toast.service';

type AdminTab = 'users' | 'prompts' | 'links' | 'knowledge';
type ItemToDelete = { type: 'prompt' | 'link' | 'knowledge' | 'portfolio_item', item: any, displayName: string };

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminComponent {
  private dataService = inject(DataService);
  private authService = inject(AuthService);
  languageService = inject(LanguageService);
  apiService = inject(ApiService);
  private toastService = inject(ToastService);

  // Core State
  bots = signal<Bot[]>([]);
  users = signal<User[]>([]);
  selectedBot = signal<Bot | null>(null);
  isLoading = signal(true);
  selectedTab = signal<AdminTab>('users');

  // Bot Management State
  isBotModalOpen = signal(false);
  editingBot = signal<Partial<Bot> | null>(null);
  isEditingExistingBot = signal(false);
  botSearchTerm = signal('');
  botSort = signal<{ column: 'nombre' | 'bot_id' | 'status', direction: 'asc' | 'desc' }>({ column: 'nombre', direction: 'asc' });
  readonly botTypes: BotType[] = ['product', 'appointment', 'repair', 'aesthetic_clinic'];

  // Bot Delete State
  botToDelete = signal<Bot | null>(null);
  deleteConfirmationInput = signal('');
  isDeleteConfirmed = computed(() => this.botToDelete()?.bot_id === this.deleteConfirmationInput());

  // Data for selected bot
  prompts = signal<Prompt[]>([]);
  specialLinks = signal<SpecialLink[]>([]);
  knowledgeItems = signal<KnowledgeItem[]>([]);
  portfolioItems = signal<PortfolioItem[]>([]);

  // User Management State
  userSearchTerm = signal('');
  userSort = signal<{ column: 'email', direction: 'asc' | 'desc' }>({ column: 'email', direction: 'asc' });

  // Prompt Management State
  isPromptModalOpen = signal(false);
  editingPrompt = signal<Partial<Prompt> | null>(null);
  isPromptModalMaximized = signal(false);

  // Special Link Management State
  isLinkModalOpen = signal(false);
  editingLink = signal<Partial<SpecialLink> | null>(null);

  // Knowledge Base Management State
  isKnowledgeModalOpen = signal(false);
  editingKnowledgeItem = signal<Partial<KnowledgeItem> | null>(null);
  
  // Clone Bot State
  isCloneModalOpen = signal(false);
  botToClone = signal<Bot | null>(null);
  newBotIdForClone = signal('');
  cloneErrorMessage = signal<string | null>(null);

  // Delete Confirmation State
  itemToDelete = signal<ItemToDelete | null>(null);

  @ViewChild('botForm') botForm?: NgForm;

  // Computed signal for filtered and sorted bots
  filteredAndSortedBots = computed(() => {
    const bots = this.bots();
    const term = this.botSearchTerm().toLowerCase();
    const sort = this.botSort();
    return bots
      .filter(bot => 
        bot.nombre.toLowerCase().includes(term) || 
        bot.company.toLowerCase().includes(term) || 
        bot.bot_id.toLowerCase().includes(term)
      )
      .sort((a, b) => {
        const aVal = sort.column === 'nombre' ? `${a.nombre}${a.company}`.toLowerCase() : a[sort.column].toLowerCase();
        const bVal = sort.column === 'nombre' ? `${b.nombre}${b.company}`.toLowerCase() : b[sort.column].toLowerCase();
        const direction = sort.direction === 'asc' ? 1 : -1;
        if (aVal < bVal) return -1 * direction;
        if (aVal > bVal) return 1 * direction;
        return 0;
      });
  });

  // Computed signal for filtered and sorted users
  filteredAndSortedUsers = computed(() => {
    const users = this.users();
    const term = this.userSearchTerm().toLowerCase();
    return users
      .filter(user => user.email.toLowerCase().includes(term))
      .sort((a, b) => {
        const direction = this.userSort().direction === 'asc' ? 1 : -1;
        if (a.email.toLowerCase() < b.email.toLowerCase()) return -1 * direction;
        if (a.email.toLowerCase() > b.email.toLowerCase()) return 1 * direction;
        return 0;
      });
  });

  constructor() {
    this.loadData();
  }

  async loadData() {
    this.isLoading.set(true);
    const [bots, users] = await Promise.all([
      this.dataService.getAllBotsAdmin(),
      this.authService.getUsers(),
    ]);
    this.bots.set(bots);
    this.users.set(users);
    this.isLoading.set(false);
  }

  async selectBot(bot: Bot) {
    if (this.selectedBot()?.bot_id === bot.bot_id) {
        this.selectedBot.set(null);
        // Clear data when deselecting
        this.prompts.set([]);
        this.specialLinks.set([]);
        this.knowledgeItems.set([]);
        return;
    }
    this.selectedBot.set(bot);
    this.selectedTab.set('users');
    this.userSearchTerm.set('');
    
    // Conditionally fetch data relevant to the bot type to avoid 404 errors for unsupported features.
    if (bot.botType !== 'aesthetic_clinic') {
      const [prompts, links, items] = await Promise.all([
          this.dataService.getPrompts(bot.bot_id),
          this.dataService.getSpecialLinks(bot.bot_id),
          this.dataService.getKnowledgeItems(bot.bot_id),
      ]);
      this.prompts.set(prompts);
      this.specialLinks.set(links);
      this.knowledgeItems.set(items);
    } else {
      // Aesthetic clinic bots do not use these features, so clear the signals.
      this.prompts.set([]);
      this.specialLinks.set([]);
      this.knowledgeItems.set([]);
    }
  }

  changeTab(tab: AdminTab) {
    this.selectedTab.set(tab);
  }

  // BOT CRUD
  openBotModal(bot: Bot | null = null) {
    this.isEditingExistingBot.set(!!bot);
    const baseBot: Partial<Bot> = bot 
      ? JSON.parse(JSON.stringify(bot))
      : { 
          bot_id: '', 
          nombre: '', 
          company: '', 
          status: 'Active', 
          botType: 'product',
          portfolioMenuTitle: 'Portfolio',
          key_openai: '', 
          key_qdrant: '', 
          meta_token: '', 
          waba_id: '',
          key_chatwood: '',
          account_id_chatwood: null,
          url_espo: '',
          api_key_espo: '',
          url_agent_ia: '',
          prompt_vision: '', 
          modelo_ia: 'gemini-2.5-flash',
          userKnowledgeBaseEnabled: false,
          userKnowledgeBaseN8nWebhook: ''
        };
    
    this.editingBot.set(baseBot);
    this.isBotModalOpen.set(true);
  }
  closeBotModal() { this.isBotModalOpen.set(false); }
  
  async saveBot() {
    if (!this.botForm || !this.botForm.valid) {
      return;
    }

    const formBotData = this.editingBot();
    if (!formBotData) return;

    // Create a clean payload and ensure portfolioMenuTitle is only present for product bots.
    const botPayload = { ...formBotData };
    if (botPayload.botType !== 'product') {
      delete (botPayload as Partial<Bot>).portfolioMenuTitle;
    }

    this.isLoading.set(true);
    try {
      // Use the cleaned payload for the request.
      await this.dataService.saveBotAdmin(botPayload, this.isEditingExistingBot());
      const updatedBots = await this.dataService.getAllBotsAdmin();
      this.bots.set(updatedBots);
      
      // If the currently selected bot was the one being edited, re-select it to update its data.
      if(this.selectedBot()?.bot_id === botPayload.bot_id) {
          const reselectedBot = updatedBots.find(b => b.bot_id === botPayload.bot_id);
          if (reselectedBot) {
            // Re-selecting is async, so await it to ensure data is fresh.
            await this.selectBot(reselectedBot);
          } else {
            this.selectedBot.set(null);
          }
      }
      this.closeBotModal();
      this.toastService.showSuccess(this.languageService.T('saveSuccess'));
    } catch (e) {
      this.toastService.showError(this.languageService.T('saveError'));
      console.error(e);
    } finally {
      this.isLoading.set(false);
    }
  }

  requestCloneBot(bot: Bot) {
    this.botToClone.set(bot);
    this.newBotIdForClone.set(`${bot.bot_id}-copy`);
    this.cloneErrorMessage.set(null);
    this.isCloneModalOpen.set(true);
  }

  cancelCloneBot() {
    this.isCloneModalOpen.set(false);
    this.botToClone.set(null);
    this.newBotIdForClone.set('');
    this.cloneErrorMessage.set(null);
  }

  async confirmCloneBot() {
    const botToClone = this.botToClone();
    const newBotId = this.newBotIdForClone().trim();
    
    if (!botToClone) return;

    if (!newBotId) {
      this.cloneErrorMessage.set(this.languageService.T('cloneBotIdEmptyError'));
      return;
    }

    if (this.bots().some(b => b.bot_id === newBotId)) {
      this.cloneErrorMessage.set(this.languageService.T('cloneBotIdExistsError'));
      return;
    }
    
    this.cloneErrorMessage.set(null);
    this.isLoading.set(true);

    try {
      const clonedBot: Partial<Bot> = JSON.parse(JSON.stringify(botToClone));
      clonedBot.bot_id = newBotId;
      clonedBot.nombre = `${botToClone.nombre} (${this.languageService.T('copySuffix')})`;
      clonedBot.key_openai = '';
      clonedBot.key_qdrant = '';
      clonedBot.meta_token = '';
      clonedBot.key_chatwood = '';
      clonedBot.account_id_chatwood = null;
      clonedBot.api_key_espo = '';
      clonedBot.url_agent_ia = '';
      clonedBot.url_espo = '';
      clonedBot.status = 'Inactive';
      
      await this.dataService.saveBotAdmin(clonedBot, false);
      const updatedBots = await this.dataService.getAllBotsAdmin();
      this.bots.set(updatedBots);
      
      this.cancelCloneBot();
      this.toastService.showSuccess(this.languageService.T('cloneSuccess'));
    } catch (error) {
      console.error('Error cloning bot:', error);
      this.cloneErrorMessage.set(this.languageService.T('cloneError'));
      this.toastService.showError(this.languageService.T('cloneError'));
    } finally {
      this.isLoading.set(false);
    }
  }

  // BOT DELETE
  requestDeleteBot(bot: Bot) {
      this.botToDelete.set(bot);
  }

  cancelDeleteBot() {
      this.botToDelete.set(null);
      this.deleteConfirmationInput.set('');
  }

  async confirmDeleteBot() {
      const bot = this.botToDelete();
      if (!bot || !this.isDeleteConfirmed()) return;
      
      this.isLoading.set(true);
      try {
        await this.dataService.deleteBotAdmin(bot.bot_id);
        if (this.selectedBot()?.bot_id === bot.bot_id) {
            this.selectedBot.set(null);
        }
        const updatedBots = await this.dataService.getAllBotsAdmin();
        this.bots.set(updatedBots);
        this.cancelDeleteBot();
        this.toastService.showSuccess(this.languageService.T('deleteSuccess'));
      } catch(e) {
        this.toastService.showError(this.languageService.T('deleteError'));
        console.error(e);
      } finally {
        this.isLoading.set(false);
      }
  }


  // USER ACCESS
  userHasAccess(user: User): boolean {
    const bot = this.selectedBot();
    return bot ? user.accessibleBotIds.includes(bot.bot_id) : false;
  }
  async onAccessChange(user: User, event: Event) {
    const hasAccess = (event.target as HTMLInputElement).checked;
    const bot = this.selectedBot();
    if (!bot) return;
    try {
      await this.authService.updateUserBotAccess(user.id, bot.bot_id, hasAccess);
      const updatedUsers = await this.authService.getUsers(); // Refresh to reflect changes
      this.users.set(updatedUsers);
      this.toastService.showSuccess(this.languageService.T('updateAccessSuccess'));
    } catch(e) {
      this.toastService.showError(this.languageService.T('updateAccessError'));
      (event.target as HTMLInputElement).checked = !hasAccess; // Revert on failure
    }
  }
  
  // PROMPT CRUD
  openPromptModal(prompt: Prompt | null = null) {
    this.editingPrompt.set(prompt ? { ...prompt } : { botId: this.selectedBot()!.bot_id, promptId: '', content: '' });
    this.isPromptModalOpen.set(true);
  }
  closePromptModal() { 
    this.isPromptModalOpen.set(false);
    this.isPromptModalMaximized.set(false);
  }
  async savePrompt() {
    const promptToSave = this.editingPrompt();
    if (!promptToSave || !promptToSave.promptId || !promptToSave.content) return;
    try {
      await this.dataService.savePrompt(promptToSave);
      this.prompts.set(await this.dataService.getPrompts(this.selectedBot()!.bot_id));
      this.closePromptModal();
      this.toastService.showSuccess(this.languageService.T('saveSuccess'));
    } catch(e) {
       this.toastService.showError(this.languageService.T('saveError'));
    }
  }

  togglePromptModalMaximize() {
    this.isPromptModalMaximized.update(v => !v);
  }

  // LINK CRUD
  openLinkModal(link: SpecialLink | null = null) {
    this.editingLink.set(link ? { ...link } : { botId: this.selectedBot()!.bot_id, label: '', url: '' });
    this.isLinkModalOpen.set(true);
  }
  closeLinkModal() { this.isLinkModalOpen.set(false); }
  async saveLink() {
    const linkToSave = this.editingLink();
    if (!linkToSave || !linkToSave.label || !linkToSave.url) return;
    try {
      await this.dataService.saveSpecialLink(linkToSave);
      this.specialLinks.set(await this.dataService.getSpecialLinks(this.selectedBot()!.bot_id));
      this.closeLinkModal();
      this.toastService.showSuccess(this.languageService.T('saveSuccess'));
    } catch(e) {
      this.toastService.showError(this.languageService.T('saveError'));
    }
  }

  // KNOWLEDGE ITEM CRUD
  openKnowledgeModal(item: KnowledgeItem | null = null) {
    this.editingKnowledgeItem.set(item ? { ...item } : { botId: this.selectedBot()!.bot_id, title: '', description: '', n8nUrl: '' });
    this.isKnowledgeModalOpen.set(true);
  }
  closeKnowledgeModal() { this.isKnowledgeModalOpen.set(false); }
  async saveKnowledgeItem() {
    const itemToSave = this.editingKnowledgeItem();
    if (!itemToSave || !itemToSave.title || !itemToSave.n8nUrl) return;
    try {
      await this.dataService.saveKnowledgeItem(itemToSave);
      this.knowledgeItems.set(await this.dataService.getKnowledgeItems(this.selectedBot()!.bot_id));
      this.closeKnowledgeModal();
      this.toastService.showSuccess(this.languageService.T('saveSuccess'));
    } catch(e) {
      this.toastService.showError(this.languageService.T('saveError'));
    }
  }

  // DELETE FLOW
  requestDelete(type: ItemToDelete['type'], item: any) {
    let displayName = '';
    if (type === 'prompt') displayName = item.promptId;
    else if (type === 'link') displayName = item.label;
    else if (type === 'knowledge') displayName = item.title;
    else if (type === 'portfolio_item') displayName = item.nombre;
    
    this.itemToDelete.set({ type, item, displayName });
  }

  cancelDelete() {
    this.itemToDelete.set(null);
  }

  async confirmDelete() {
    const toDelete = this.itemToDelete();
    if (!toDelete) return;
    const botId = this.selectedBot()!.bot_id;

    try {
      switch (toDelete.type) {
        case 'prompt':
          await this.dataService.deletePrompt(toDelete.item);
          this.prompts.set(await this.dataService.getPrompts(botId));
          break;
        case 'link':
          await this.dataService.deleteSpecialLink(toDelete.item);
          this.specialLinks.set(await this.dataService.getSpecialLinks(botId));
          break;
        case 'knowledge':
          await this.dataService.deleteKnowledgeItem(toDelete.item);
          this.knowledgeItems.set(await this.dataService.getKnowledgeItems(botId));
          break;
      }
      this.toastService.showSuccess(this.languageService.T('deleteSuccess'));
    } catch(e) {
      this.toastService.showError(this.languageService.T('deleteError'));
    } finally {
      this.cancelDelete();
    }
  }

  // SORTING
  updateBotSort(column: 'nombre' | 'bot_id' | 'status') {
    this.botSort.update(s => ({ column, direction: s.column === column && s.direction === 'asc' ? 'desc' : 'asc' }));
  }
  updateUserSort(column: 'email') {
    this.userSort.update(s => ({ column, direction: s.column === column && s.direction === 'asc' ? 'desc' : 'asc' }));
  }
  
  // HELPERS
  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleString(this.languageService.language());
  }
  insertVariable(variable: string, promptContentRef: HTMLTextAreaElement) {
    if (this.editingPrompt()) {
      const currentContent = this.editingPrompt()!.content || '';
      const start = promptContentRef.selectionStart;
      const end = promptContentRef.selectionEnd;
      const text = currentContent.substring(0, start) + ` {{${variable}}} ` + currentContent.substring(end);
      this.editingPrompt.update(p => ({...p!, content: text}));
      setTimeout(() => {
        promptContentRef.focus();
        promptContentRef.selectionStart = promptContentRef.selectionEnd = start + variable.length + 5;
      }, 0);
    }
  }
}