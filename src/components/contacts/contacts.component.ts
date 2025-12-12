import { Component, ChangeDetectionStrategy, input, signal, inject, effect, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DataService } from '../../services/data.service';
import { LanguageService } from '../../services/language.service';
import { Bot, Contact, CsvImportResult } from '../../models';
import { ToastService } from '../../services/toast.service';

type CsvImportStep = 1 | 2;

@Component({
  selector: 'app-contacts',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './contacts.component.html',
  styleUrl: './contacts.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContactsComponent {
  botId = input.required<string>();
  selectedBot = input.required<Bot | null>();
  
  private dataService = inject(DataService);
  languageService = inject(LanguageService);
  private toastService = inject(ToastService);

  isLoading = signal(true);
  isSyncing = signal(false);
  contacts = signal<Contact[]>([]);
  
  // === Modal de Creación/Edición ===
  isModalOpen = signal(false);
  editingContact = signal<Partial<Contact> | null>(null);
  contactValidationErrors = signal<{ name?: string; phone_number?: string; email?: string }>({});
  contactToDelete = signal<Contact | null>(null);

  // === Modal de Importación (Asistente) ===
  isImportModalOpen = signal(false);
  importStep = signal<CsvImportStep>(1);
  selectedFile = signal<File | null>(null);
  csvHeaders = signal<string[]>([]);
  csvColumnMapping = signal<Record<string, { target: string }>>({});
  isImporting = signal(false);
  importResult = signal<CsvImportResult | null>(null);
  isImportResultModalOpen = signal(false);

  // === Filtrado y Ordenación ===
  searchTerm = signal('');
  sort = signal<{ column: keyof Contact | string, direction: 'asc' | 'desc' }>({ column: 'created_at', direction: 'desc' });
  
  filteredAndSortedContacts = computed(() => {
    const term = this.searchTerm().toLowerCase();
    const sortCol = this.sort().column;
    const sortDir = this.sort().direction === 'asc' ? 1 : -1;
    const customAttributes = this.selectedBot()?.custom_attributes?.map(a => a.key) || [];

    return this.contacts()
      .filter(c => 
        (c.name || '').toLowerCase().includes(term) ||
        (c.phone_number || '').toLowerCase().includes(term) ||
        (c.email || '').toLowerCase().includes(term) ||
        customAttributes.some(key => (c.attributes?.[key] ?? '').toString().toLowerCase().includes(term))
      )
      .sort((a, b) => {
        const valA = (sortCol in a) ? (a as any)[sortCol] : a.attributes?.[sortCol];
        const valB = (sortCol in b) ? (b as any)[sortCol] : b.attributes?.[sortCol];
        
        const safeValA = valA ?? '';
        const safeValB = valB ?? '';

        if (safeValA < safeValB) return -1 * sortDir;
        if (safeValA > safeValB) return 1 * sortDir;
        return 0;
      });
  });

  constructor() {
    effect(() => {
      this.loadContacts(this.botId());
    }, { allowSignalWrites: true });
  }

  async loadContacts(botId: string) {
    this.isLoading.set(true);
    const fetchedContacts = await this.dataService.getContacts(botId);
    this.contacts.set(fetchedContacts);
    this.isLoading.set(false);
  }

  // === Lógica del Modal de Creación/Edición ===

  openModal(contact: Contact | null = null) {
    this.contactValidationErrors.set({});
    if (contact) {
      this.editingContact.set({ ...contact });
    } else {
      // Pre-initialize attributes object for new contacts
      const initialAttributes: Record<string, any> = {};
      this.selectedBot()?.custom_attributes?.forEach(attr => {
        initialAttributes[attr.key] = '';
      });
      this.editingContact.set({
        bot_id: this.botId(), name: '', phone_number: '', email: '', attributes: initialAttributes
      });
    }
    this.isModalOpen.set(true);
  }

  closeModal() {
    this.isModalOpen.set(false);
  }
  
  validateContact(contact: Partial<Contact>): boolean {
    const errors: { name?: string; phone_number?: string; email?: string } = {};
    if (!contact.name || contact.name.trim().length < 2) errors.name = this.languageService.T('contactNameInvalid');
    if (!contact.phone_number) errors.phone_number = this.languageService.T('contactPhoneRequired');
    else if (!/^\+[1-9]\d{1,14}$/.test(contact.phone_number)) errors.phone_number = this.languageService.T('contactPhoneInvalid');
    if (contact.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email)) errors.email = this.languageService.T('contactEmailInvalid');
    this.contactValidationErrors.set(errors);
    return Object.keys(errors).length === 0;
  }

  async saveContact() {
    const contact = this.editingContact();
    if (!contact) return;
    
    if (!this.validateContact(contact)) return;

    try {
      await this.dataService.saveContact(contact);
      await this.loadContacts(this.botId());
      this.closeModal();
      this.toastService.showSuccess(this.languageService.T('saveSuccess'));
    } catch(err: any) {
      this.handleSaveError(err);
    }
  }
  
  // === Lógica de Borrado ===

  requestDelete(contact: Contact) { this.contactToDelete.set(contact); }
  cancelDelete() { this.contactToDelete.set(null); }

  async confirmDelete() {
    const contact = this.contactToDelete();
    if (!contact) return;
    try {
      await this.dataService.deleteContact(contact);
      await this.loadContacts(this.botId());
      this.toastService.showSuccess(this.languageService.T('deleteSuccess'));
    } catch (e) {
      this.toastService.showError(this.languageService.T('deleteError'));
    } finally {
      this.cancelDelete();
    }
  }
  
  // === Lógica del Asistente de Importación CSV ===

  resetImportWizard() {
    this.importStep.set(1);
    this.selectedFile.set(null);
    this.csvHeaders.set([]);
    this.csvColumnMapping.set({});
    const fileInput = document.getElementById('csvFile') as HTMLInputElement;
    if(fileInput) fileInput.value = '';
  }

  closeImportModal() {
    this.isImportModalOpen.set(false);
    this.resetImportWizard();
  }
  
  async onFileSelected(event: Event) {
    // FIX: Explicitly cast event.target to HTMLInputElement to resolve potential type ambiguity.
    const target = event.target as HTMLInputElement | null;
    if (target?.files && target.files.length > 0) {
      const file = target.files[0];
      this.selectedFile.set(file);
      try {
        const headers = await this.parseCsvHeaders(file);
        this.csvHeaders.set(headers);
        this.csvColumnMapping.set(headers.reduce((acc, header) => ({ ...acc, [header]: { target: 'ignore' } }), {} as Record<string, { target: string }>));
        this.importStep.set(2);
      } catch (error) {
        this.toastService.showError('Error reading file headers');
      }
    }
  }

  private parseCsvHeaders(file: File): Promise<string[]> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const text = reader.result as string;
        const firstLine = text.split('\n')[0].trim();
        if (!firstLine) resolve([]);
        const headers = firstLine.split(',').map(h => h.trim().replace(/^"|"$/g, ''));
        resolve(headers);
      };
      reader.onerror = () => reject('Error reading file');
      reader.readAsText(file, 'UTF-8');
    });
  }

  updateMapping(header: string, target: string) {
    this.csvColumnMapping.update(map => ({...map, [header]: { target }}));
  }

  async importCsv() {
    const file = this.selectedFile();
    if (!file) return;

    const finalMapping: Record<string, string> = {};
    Object.entries(this.csvColumnMapping()).forEach(([header, mapping]) => {
      // FIX: Object.entries can return `unknown` for values, so we cast it to the expected type.
      const typedMapping = mapping as { target: string };
      if (typedMapping.target !== 'ignore') {
        finalMapping[header] = typedMapping.target;
      }
    });

    this.isImporting.set(true);
    try {
      const response = await this.dataService.importContactsFromCsv(this.botId(), file, finalMapping);
      if (response.result) {
        this.importResult.set(response.result);
        this.isImportResultModalOpen.set(true);
      } else {
        this.toastService.showSuccess(response.message);
      }
      await this.loadContacts(this.botId());
      this.closeImportModal();
    } catch (e: any) {
      this.handleImportError(e);
    } finally {
      this.isImporting.set(false);
    }
  }
  
  closeImportResultModal() {
    this.isImportResultModalOpen.set(false);
    this.importResult.set(null);
  }

  // === Utilidades ===

  updateSort(column: keyof Contact | string) {
    this.sort.update(s => ({ column, direction: s.column === column && s.direction === 'desc' ? 'asc' : 'desc' }));
  }
  
  async syncWithChatwood() {
    this.isSyncing.set(true);
    try {
      const response = await this.dataService.syncWithChatwood(this.botId());
      this.toastService.showSuccess(response.message || this.languageService.T('syncSuccessMessage'));
      setTimeout(() => this.loadContacts(this.botId()), 5000);
    } catch(e) { this.toastService.showError(this.languageService.T('syncErrorMessage')); }
    finally { this.isSyncing.set(false); }
  }

  formatDate(isoString: string): string {
    return new Date(isoString).toLocaleDateString(this.languageService.language());
  }

  private handleSaveError(err: any) {
    console.error("Failed to save contact", err);
    if (err.status === 409) {
      this.contactValidationErrors.set({ phone_number: this.languageService.T('contactPhoneDuplicate') });
    } else {
      this.toastService.showError(err.error?.detail || this.languageService.T('saveError'));
    }
  }

  private handleImportError(e: any) {
    console.error(e);
    let errorMessage = this.languageService.T('importError');
    if (e.error?.detail) {
      errorMessage = e.error.detail;
    } else if (e.error?.result) {
      this.importResult.set(e.error.result);
      this.isImportResultModalOpen.set(true);
      errorMessage = e.error.message || errorMessage;
    }
    this.toastService.showError(errorMessage);
  }
}