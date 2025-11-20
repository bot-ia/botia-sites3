import { Component, ChangeDetectionStrategy, input, signal, inject, effect, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DataService } from '../../services/data.service';
import { LanguageService } from '../../services/language.service';
import { ToastService } from '../../services/toast.service';
import { Calendar, Professional, AppointmentType } from '../../models';

@Component({
  selector: 'app-calendars',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './calendars.component.html',
  styleUrl: './calendars.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CalendarsComponent {
  botId = input.required<string>();

  private dataService = inject(DataService);
  languageService = inject(LanguageService);
  private toastService = inject(ToastService);

  items = signal<Calendar[]>([]);
  professionals = signal<Professional[]>([]);
  isLoading = signal(true);
  searchTerm = signal('');

  isModalOpen = signal(false);
  editingItem = signal<Partial<Calendar> | null>(null);
  itemToDelete = signal<Calendar | null>(null);

  readonly appointmentTypes: AppointmentType[] = ['valoracion_paga', 'prevaloracion_gratis', 'control_medico', 'procedimiento'];

  filteredItems = computed(() => {
    const allItems = this.items();
    const term = this.searchTerm().toLowerCase();
    if (!term) return allItems;
    return allItems.filter(item => 
      item.name.toLowerCase().includes(term)
    );
  });
  
  constructor() {
    effect(() => {
      this.loadData(this.botId());
    }, { allowSignalWrites: true });
  }

  async loadData(botId: string) {
    this.isLoading.set(true);
    const [fetchedItems, fetchedProfessionals] = await Promise.all([
      this.dataService.getCalendars(botId),
      this.dataService.getProfessionals(botId)
    ]);
    this.items.set(fetchedItems);
    this.professionals.set(fetchedProfessionals.filter(p => p.is_active));
    this.isLoading.set(false);
  }

  openModal(item: Calendar | null = null) {
    if (item) {
      this.editingItem.set(JSON.parse(JSON.stringify(item))); // Deep copy
    } else {
      this.editingItem.set({
        bot_id: this.botId(),
        name: '',
        professional_id: null,
        appointment_type: 'valoracion_paga',
        google_calendar_link: '',
        google_calendar_id: '',
        price: 0,
        currency: 'COP',
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
      await this.dataService.saveCalendar(itemToSave);
      await this.loadData(this.botId());
      this.closeModal();
      this.toastService.showSuccess(this.languageService.T('saveSuccess'));
    } catch (error) {
      console.error("Failed to save calendar", error);
      this.toastService.showError(this.languageService.T('saveError'));
    }
  }

  requestDeleteItem(item: Calendar) {
    this.itemToDelete.set(item);
  }

  cancelDelete() {
    this.itemToDelete.set(null);
  }

  async confirmDelete() {
    const item = this.itemToDelete();
    if (!item) return;

    try {
      await this.dataService.deleteCalendar(item);
      await this.loadData(this.botId());
      this.toastService.showSuccess(this.languageService.T('deleteSuccess'));
    } catch (error) {
      console.error("Failed to delete calendar", error);
      this.toastService.showError(this.languageService.T('deleteError'));
    } finally {
      this.cancelDelete();
    }
  }
  
  getProfessionalName(professionalId: number | null): string {
    if (!professionalId) return 'N/A';
    return this.professionals().find(p => p.professional_id === professionalId)?.name || 'Unknown';
  }
}