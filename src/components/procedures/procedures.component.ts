import { Component, ChangeDetectionStrategy, input, signal, inject, effect, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DataService } from '../../services/data.service';
import { LanguageService } from '../../services/language.service';
import { ToastService } from '../../services/toast.service';
import { Procedure } from '../../models';

@Component({
  selector: 'app-procedures',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './procedures.component.html',
  styleUrl: './procedures.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProceduresComponent {
  botId = input.required<string>();

  private dataService = inject(DataService);
  languageService = inject(LanguageService);
  private toastService = inject(ToastService);

  items = signal<Procedure[]>([]);
  isLoading = signal(true);
  searchTerm = signal('');

  isModalOpen = signal(false);
  editingItem = signal<Partial<Procedure> | null>(null);

  procedureToDelete = signal<Procedure | null>(null);

  filteredItems = computed(() => {
    const allItems = this.items();
    const term = this.searchTerm().toLowerCase();
    if (!term) return allItems;
    return allItems.filter(item => item.name.toLowerCase().includes(term));
  });
  
  constructor() {
    effect(() => {
      this.loadProcedures(this.botId());
    }, { allowSignalWrites: true });
  }

  async loadProcedures(botId: string) {
    this.isLoading.set(true);
    const fetchedItems = await this.dataService.getProcedures(botId);
    this.items.set(fetchedItems);
    this.isLoading.set(false);
  }

  openModal(item: Procedure | null = null) {
    if (item) {
      this.editingItem.set(JSON.parse(JSON.stringify(item))); // Deep copy
    } else {
      this.editingItem.set({
        bot_id: this.botId(),
        name: '',
        procedure_type: 'non-surgical',
        description: '',
        pre_care_instructions: '',
        post_care_instructions: '',
        cost_min: 0,
        cost_max: 0,
        cost_note: '',
        media_links: []
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
      await this.dataService.saveProcedure(itemToSave);
      await this.loadProcedures(this.botId());
      this.closeModal();
      this.toastService.showSuccess(this.languageService.T('saveSuccess'));
    } catch (error) {
      console.error("Failed to save procedure", error);
      this.toastService.showError(this.languageService.T('saveError'));
    }
  }

  requestDeleteItem(item: Procedure) {
    this.procedureToDelete.set(item);
  }

  cancelDelete() {
    this.procedureToDelete.set(null);
  }

  async confirmDelete() {
    const item = this.procedureToDelete();
    if (!item) return;

    try {
      await this.dataService.deleteProcedure(item);
      await this.loadProcedures(this.botId());
      this.toastService.showSuccess(this.languageService.T('deleteSuccess'));
    } catch (error) {
      console.error("Failed to delete procedure", error);
      this.toastService.showError(this.languageService.T('deleteError'));
    } finally {
      this.cancelDelete();
    }
  }

  addMediaLink() {
    this.editingItem.update(item => {
      if (!item) return item;
      if (!item.media_links) {
        item.media_links = [];
      }
      item.media_links.push({
        id: `media-${Date.now()}`,
        type: 'image',
        url: ''
      });
      return JSON.parse(JSON.stringify(item));
    });
  }

  removeMediaLink(index: number) {
     this.editingItem.update(item => {
      if (!item || !item.media_links) return item;
      item.media_links.splice(index, 1);
      return JSON.parse(JSON.stringify(item));
    });
  }
}
