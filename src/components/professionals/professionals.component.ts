import { Component, ChangeDetectionStrategy, input, signal, inject, effect, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DataService } from '../../services/data.service';
import { LanguageService } from '../../services/language.service';
import { ToastService } from '../../services/toast.service';
import { Professional } from '../../models';

@Component({
  selector: 'app-professionals',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './professionals.component.html',
  styleUrl: './professionals.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfessionalsComponent {
  botId = input.required<string>();

  private dataService = inject(DataService);
  languageService = inject(LanguageService);
  private toastService = inject(ToastService);

  items = signal<Professional[]>([]);
  isLoading = signal(true);
  searchTerm = signal('');

  isModalOpen = signal(false);
  editingItem = signal<Partial<Professional> | null>(null);
  itemToDelete = signal<Professional | null>(null);

  filteredItems = computed(() => {
    const allItems = this.items();
    const term = this.searchTerm().toLowerCase();
    if (!term) return allItems;
    return allItems.filter(item => 
      item.name.toLowerCase().includes(term) ||
      item.specialty?.toLowerCase().includes(term)
    );
  });
  
  constructor() {
    effect(() => {
      this.loadProfessionals(this.botId());
    }, { allowSignalWrites: true });
  }

  async loadProfessionals(botId: string) {
    this.isLoading.set(true);
    const fetchedItems = await this.dataService.getProfessionals(botId);
    this.items.set(fetchedItems);
    this.isLoading.set(false);
  }

  openModal(item: Professional | null = null) {
    if (item) {
      this.editingItem.set(JSON.parse(JSON.stringify(item))); // Deep copy
    } else {
      this.editingItem.set({
        bot_id: this.botId(),
        name: '',
        specialty: '',
        is_active: true,
      });
    }
    this.isModalOpen.set(true);
  }

  closeModal() {
    this.isModalOpen.set(false);
    this.editingItem.set(null);
  }

  async saveItem() {
    const itemToSave = this.editingItem();
    if (!itemToSave || !itemToSave.name) return;
    
    try {
      await this.dataService.saveProfessional(itemToSave);
      await this.loadProfessionals(this.botId());
      this.closeModal();
      this.toastService.showSuccess(this.languageService.T('saveSuccess'));
    } catch (error) {
      console.error("Failed to save professional", error);
      this.toastService.showError(this.languageService.T('saveError'));
    }
  }

  requestDeleteItem(item: Professional) {
    this.itemToDelete.set(item);
  }

  cancelDelete() {
    this.itemToDelete.set(null);
  }

  async confirmDelete() {
    const item = this.itemToDelete();
    if (!item) return;

    try {
      await this.dataService.deleteProfessional(item);
      await this.loadProfessionals(this.botId());
      this.toastService.showSuccess(this.languageService.T('deleteSuccess'));
    } catch (error) {
      console.error("Failed to delete professional", error);
      this.toastService.showError(this.languageService.T('deleteError'));
    } finally {
      this.cancelDelete();
    }
  }
}
