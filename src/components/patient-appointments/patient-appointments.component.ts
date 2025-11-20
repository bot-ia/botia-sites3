


import { Component, ChangeDetectionStrategy, input, signal, inject, effect, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DataService } from '../../services/data.service';
import { LanguageService } from '../../services/language.service';
import { ToastService } from '../../services/toast.service';
// FIX: Import 'Professional' model to use it in the component.
import { PatientAppointment, Contact, Calendar, Procedure, PaymentStatus, ConfirmationStatus, Professional } from '../../models';

@Component({
  selector: 'app-patient-appointments',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './patient-appointments.component.html',
  styleUrl: './patient-appointments.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PatientAppointmentsComponent {
  botId = input.required<string>();

  private dataService = inject(DataService);
  languageService = inject(LanguageService);
  private toastService = inject(ToastService);

  // Data Signals
  isLoading = signal(true);
  appointments = signal<PatientAppointment[]>([]);
  contacts = signal<Contact[]>([]);
  calendars = signal<Calendar[]>([]);
  procedures = signal<Procedure[]>([]);
  // FIX: Add professionals signal to store professional data.
  professionals = signal<Professional[]>([]);

  // Modal State
  isModalOpen = signal(false);
  editingAppointment = signal<Partial<PatientAppointment> | null>(null);
  itemToDelete = signal<PatientAppointment | null>(null);

  // Filtering
  filters = signal({
    startDate: '',
    endDate: '',
    calendarId: 'all',
    procedureId: 'all',
    paymentStatus: 'all',
    confirmationStatus: 'all',
  });

  readonly paymentStatuses: PaymentStatus[] = ['pendiente', 'pagado'];
  readonly confirmationStatuses: ConfirmationStatus[] = ['agendada', 'confirmada', 'realizada', 'cancelada'];

  filteredAppointments = computed(() => {
    return this.appointments().sort((a, b) => {
        const dateA = a.appointment_date ? new Date(a.appointment_date).getTime() : 0;
        const dateB = b.appointment_date ? new Date(b.appointment_date).getTime() : 0;
        return dateB - dateA;
    });
  });

  constructor() {
    effect(() => {
      this.loadAllData(this.botId());
    }, { allowSignalWrites: true });
    
    // Refetch when filters change
    effect(() => {
        const currentFilters = this.filters();
        this.loadAppointments(this.botId(), currentFilters);
    }, { allowSignalWrites: true });
  }
  
  async loadAllData(botId: string) {
      this.isLoading.set(true);
      // FIX: Fetch professionals along with other data.
      const [contacts, calendars, procedures, professionals] = await Promise.all([
          this.dataService.getContacts(botId),
          this.dataService.getCalendars(botId),
          this.dataService.getProcedures(botId),
          this.dataService.getProfessionals(botId)
      ]);
      this.contacts.set(contacts);
      this.calendars.set(calendars);
      this.procedures.set(procedures);
      // FIX: Set the professionals signal with fetched data.
      this.professionals.set(professionals);
      // Initial load of appointments
      await this.loadAppointments(botId, this.filters());
      this.isLoading.set(false);
  }
  
  async loadAppointments(botId: string, filters: any) {
    this.isLoading.set(true);
    const fetchedAppointments = await this.dataService.getPatientAppointments(botId, filters);
    // More robust sanitization: handle nulls, trim whitespace, and convert to lowercase.
    const sanitizedAppointments = fetchedAppointments.map(appt => ({
      ...appt,
      payment_status: (appt.payment_status || '').trim().toLowerCase() as PaymentStatus,
      confirmation_status: (appt.confirmation_status || '').trim().toLowerCase() as ConfirmationStatus,
    }));
    this.appointments.set(sanitizedAppointments);
    this.isLoading.set(false);
  }

  onFilterChange(filterName: keyof typeof this.filters.prototype, value: any) {
    this.filters.update(f => ({ ...f, [filterName]: value }));
  }

  // === MODAL MANAGEMENT ===
  openModal(item: PatientAppointment | null = null) {
    const appointmentTime = item?.appointment_date ? new Date(item.appointment_date).toISOString().substring(0, 16) : new Date().toISOString().substring(0, 16);
    this.editingAppointment.set(item ? { ...item, appointment_date: appointmentTime } : {
      bot_id: this.botId(),
      user_id: '',
      calendar_id: null,
      procedure_id: null,
      appointment_date: appointmentTime,
      payment_status: 'pendiente',
      confirmation_status: 'agendada',
      notes: '',
      google_event_id: ''
    });
    this.isModalOpen.set(true);
  }

  closeModal() {
    this.isModalOpen.set(false);
  }

  async saveItem() {
    const item = this.editingAppointment();
    if (!item || !item.user_id) return;

    // If the procedure field is not shown, ensure its value is null before saving.
    if (!this.isProcedureCalendar(item.calendar_id)) {
      item.procedure_id = null;
    }

    try {
      await this.dataService.savePatientAppointment(item);
      await this.loadAppointments(this.botId(), this.filters());
      this.closeModal();
      this.toastService.showSuccess(this.languageService.T('saveSuccess'));
    } catch(e) {
      console.error("Failed to save patient appointment", e);
      this.toastService.showError(this.languageService.T('saveError'));
    }
  }

  async updateStatus(item: PatientAppointment, type: 'payment' | 'confirmation', event: Event) {
    const newStatus = (event.target as HTMLSelectElement).value;
    const updatedItem = { ...item };
    if (type === 'payment') {
        updatedItem.payment_status = newStatus as PaymentStatus;
    } else {
        updatedItem.confirmation_status = newStatus as ConfirmationStatus;
    }

    try {
      const savedItem = await this.dataService.savePatientAppointment(updatedItem);
      // Sanitize the returned item before updating the state to prevent re-introducing bad data.
      const sanitizedSavedItem = {
        ...savedItem,
        payment_status: (savedItem.payment_status || '').trim().toLowerCase() as PaymentStatus,
        confirmation_status: (savedItem.confirmation_status || '').trim().toLowerCase() as ConfirmationStatus,
      };
      this.appointments.update(items => items.map(i => i.appointment_id === sanitizedSavedItem.appointment_id ? sanitizedSavedItem : i));
      this.toastService.showSuccess(this.languageService.T('saveSuccess'));
    } catch(e) {
       console.error("Failed to update status", e);
       this.toastService.showError(this.languageService.T('saveError'));
       // Re-trigger render to revert UI on failure
       this.appointments.update(items => [...items]);
    }
  }

  // === DELETE OPERATIONS ===
  requestDeleteItem(item: PatientAppointment) {
    this.itemToDelete.set(item);
  }
  cancelDelete() {
    this.itemToDelete.set(null);
  }
  async confirmDelete() {
    const item = this.itemToDelete();
    if (!item) return;

    try {
      await this.dataService.deletePatientAppointment(item);
      await this.loadAppointments(this.botId(), this.filters());
      this.toastService.showSuccess(this.languageService.T('deleteSuccess'));
    } catch (e) {
      console.error("Failed to delete patient appointment", e);
      this.toastService.showError(this.languageService.T('deleteError'));
    } finally {
      this.cancelDelete();
    }
  }

  isProcedureCalendar(calendarId: number | null | undefined): boolean {
    if (!calendarId) {
      return false;
    }
    const selectedCalendar = this.calendars().find(c => c.calendar_id === calendarId);
    return selectedCalendar?.appointment_type === 'procedimiento';
  }

  // === HELPERS ===
  getContactName(userId: string): string {
    return this.contacts().find(c => c.contact_id === userId)?.name || userId;
  }
  getProcedureName(procedureId: string | null): string {
    if (!procedureId) return 'N/A';
    return this.procedures().find(p => p.id === procedureId)?.name || 'N/A';
  }
  getCalendarInfo(calendarId: number | null): { name: string, professionalName: string } {
      if (!calendarId) return { name: 'N/A', professionalName: 'N/A' };
      const calendar = this.calendars().find(c => c.calendar_id === calendarId);
      if (!calendar) return { name: 'Unknown', professionalName: 'Unknown' };

      const professionalName = this.getProfessionalNameFromCalendar(calendar);

      return { name: calendar.name, professionalName };
  }
  getProfessionalNameFromCalendar(calendar: Calendar): string {
      if (!calendar.professional_id) return 'N/A';
      // This is inefficient if called in a loop. Data should be pre-fetched.
      // Assuming professionals are loaded in loadAllData.
      return this.professionals().find(p => p.professional_id === calendar.professional_id)?.name || 'Unknown';
  }
  formatDateTime(isoString: string | null): string {
    if (!isoString) return 'N/A';
    return new Date(isoString).toLocaleString(this.languageService.language(), {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  }
}
