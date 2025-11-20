import { Component, ChangeDetectionStrategy, input, signal, inject, effect, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DataService } from '../../services/data.service';
import { LanguageService } from '../../services/language.service';
import { Contact, CsvImportResult } from '../../models';
import { ToastService } from '../../services/toast.service';

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
  
  private dataService = inject(DataService);
  languageService = inject(LanguageService);
  private toastService = inject(ToastService);

  isLoading = signal(true);
  isSyncing = signal(false);
  contacts = signal<Contact[]>([]);
  
  // Modal State
  isModalOpen = signal(false);
  editingContact = signal<Partial<Contact> | null>(null);
  contactValidationErrors = signal<{ name?: string; phone_number?: string; email?: string }>({});
  contactToDelete = signal<Contact | null>(null);

  // Import Modal State
  isImportModalOpen = signal(false);
  selectedFile = signal<File | null>(null);
  isImporting = signal(false);
  importResult = signal<CsvImportResult | null>(null);
  isImportResultModalOpen = signal(false);
  
  // Filtering & Sorting
  searchTerm = signal('');
  sort = signal<{ column: keyof Contact, direction: 'asc' | 'desc' }>({ column: 'created_at', direction: 'desc' });
  
  filteredAndSortedContacts = computed(() => {
    const term = this.searchTerm().toLowerCase();
    const sortCol = this.sort().column;
    const sortDir = this.sort().direction === 'asc' ? 1 : -1;

    return this.contacts()
      .filter(c => 
        c.name?.toLowerCase().includes(term) ||
        c.phone_number?.toLowerCase().includes(term) ||
        c.email?.toLowerCase().includes(term)
      )
      .sort((a, b) => {
        const valA = a[sortCol] || '';
        const valB = b[sortCol] || '';
        if (valA < valB) return -1 * sortDir;
        if (valA > valB) return 1 * sortDir;
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

  openModal(contact: Contact | null = null) {
    this.contactValidationErrors.set({});
    this.editingContact.set(contact ? { ...contact } : {
      bot_id: this.botId(), name: '', phone_number: '', email: ''
    });
    this.isModalOpen.set(true);
  }

  closeModal() {
    this.isModalOpen.set(false);
  }
  
  validateContact(contact: Partial<Contact>): boolean {
    const errors: { name?: string; phone_number?: string; email?: string } = {};
    
    if (!contact.name || contact.name.trim().length < 2) {
      errors.name = this.languageService.T('contactNameInvalid');
    }

    if (contact.phone_number) {
      const phoneRegex = /^\+[1-9]\d{1,14}$/;
      if (!phoneRegex.test(contact.phone_number)) {
        errors.phone_number = this.languageService.T('contactPhoneInvalid');
      }
    } else if (!contact.contact_id) { // Required for new contacts
      errors.phone_number = this.languageService.T('contactPhoneRequired');
    }

    if (contact.email && contact.email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(contact.email)) {
        errors.email = this.languageService.T('contactEmailInvalid');
      }
    }

    this.contactValidationErrors.set(errors);
    return Object.keys(errors).length === 0;
  }

  async saveContact() {
    const contact = this.editingContact();
    if (!contact) return;

    contact.name = contact.name?.trim() ?? null;
    contact.email = contact.email?.trim() ?? null;
    contact.phone_number = contact.phone_number?.trim() ?? null;
    
    if (!this.validateContact(contact)) {
      return;
    }

    try {
      await this.dataService.saveContact(contact);
      this.contacts.set(await this.dataService.getContacts(this.botId()));
      this.closeModal();
      this.toastService.showSuccess(this.languageService.T('saveSuccess'));
    } catch(err: any) {
      console.error("Failed to save contact", err);
      if (err.status === 409) {
        this.contactValidationErrors.set({ phone_number: this.languageService.T('contactPhoneDuplicate') });
      } else if (err.status === 422 && err.error?.detail) {
        const serverErrors: { name?: string; phone_number?: string; email?: string } = {};
        try {
          const details = Array.isArray(err.error.detail) ? err.error.detail : [err.error.detail];
          details.forEach((e: any) => {
            if (e.loc && e.loc.includes('name')) serverErrors.name = e.msg;
            if (e.loc && e.loc.includes('phone_number')) serverErrors.phone_number = e.msg;
            if (e.loc && e.loc.includes('email')) serverErrors.email = e.msg;
          });
          this.contactValidationErrors.set(serverErrors);
        } catch {
          this.toastService.showError(err.error.detail || this.languageService.T('saveError'));
        }
      } else {
        this.toastService.showError(this.languageService.T('saveError'));
      }
    }
  }

  requestDelete(contact: Contact) {
    this.contactToDelete.set(contact);
  }

  cancelDelete() {
    this.contactToDelete.set(null);
  }

  async confirmDelete() {
    const contact = this.contactToDelete();
    if (!contact) return;

    try {
      await this.dataService.deleteContact(contact);
      await this.loadContacts(this.botId());
      this.toastService.showSuccess(this.languageService.T('deleteSuccess'));
    } catch (e) {
      console.error("Failed to delete contact", e);
      this.toastService.showError(this.languageService.T('deleteError'));
    } finally {
      this.cancelDelete();
    }
  }
  
  updateSort(column: keyof Contact) {
    this.sort.update(s => ({
      column,
      direction: s.column === column && s.direction === 'desc' ? 'asc' : 'desc'
    }));
  }
  
  async syncWithChatwood() {
    this.isSyncing.set(true);
    try {
      const response = await this.dataService.syncWithChatwood(this.botId());
      this.toastService.showSuccess(response.message || this.languageService.T('syncSuccessMessage'));
      setTimeout(() => this.loadContacts(this.botId()), 5000);
    } catch(e) {
       this.toastService.showError(this.languageService.T('syncErrorMessage'));
    } finally {
      this.isSyncing.set(false);
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      this.selectedFile.set(input.files[0]);
    }
  }

  async importCsv() {
    const file = this.selectedFile();
    if (!file) return;

    this.isImporting.set(true);
    try {
      const response = await this.dataService.importContactsFromCsv(this.botId(), file);
      this.toastService.showSuccess(response.message);
      if (response.result) {
        this.importResult.set(response.result);
        this.isImportResultModalOpen.set(true);
      }
      await this.loadContacts(this.botId());
      this.isImportModalOpen.set(false);
      this.selectedFile.set(null);
    } catch (e: any) {
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
    } finally {
      this.isImporting.set(false);
    }
  }
  
  closeImportResultModal() {
    this.isImportResultModalOpen.set(false);
    this.importResult.set(null);
  }

  formatDate(isoString: string): string {
    return new Date(isoString).toLocaleDateString(this.languageService.language());
  }
}