import { Component, ChangeDetectionStrategy, input, signal, inject, effect, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DataService } from '../../services/data.service';
import { LanguageService } from '../../services/language.service';
// FIX: Import existing models from the project.
import { Procedure, Professional, PatientAppointment, ConfirmationStatus, Contact, Calendar } from '../../models';
import { ToastService } from '../../services/toast.service';

type AppointmentsTab = 'appointments' | 'services' | 'staff';
type ModalType = 'appointment' | 'service' | 'staff' | null;

@Component({
  selector: 'app-appointments',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './appointments.component.html',
  styleUrl: './appointments.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppointmentsComponent {
  botId = input.required<string>();

  private dataService = inject(DataService);
  languageService = inject(LanguageService);
  private toastService = inject(ToastService);

  // State
  isLoading = signal(true);
  activeTab = signal<AppointmentsTab>('appointments');

  // Data Signals
  appointments = signal<PatientAppointment[]>([]);
  services = signal<Procedure[]>([]);
  staffMembers = signal<Professional[]>([]);
  contacts = signal<Contact[]>([]);
  calendars = signal<Calendar[]>([]);

  // Modal State
  isModalOpen = signal(false);
  modalType = signal<ModalType>(null);
  editingAppointment = signal<Partial<PatientAppointment> | null>(null);
  editingService = signal<Partial<Procedure> | null>(null);
  editingStaff = signal<Partial<Professional> | null>(null);
  
  // Filtering
  filterDate = signal<string>(this.getTodayDateString());
  filterStaffId = signal<string>('all');
  
  readonly appointmentStatuses: ConfirmationStatus[] = ['agendada', 'confirmada', 'realizada', 'cancelada'];

  filteredAppointments = computed(() => {
    const date = this.filterDate();
    const staffId = this.filterStaffId();
    return this.appointments().filter(a => {
      const dateMatch = !date || (a.appointment_date && a.appointment_date.startsWith(date));
      
      let staffMatch = staffId === 'all';
      if (staffId !== 'all' && a.calendar_id) {
        const calendar = this.calendars().find(c => c.calendar_id === a.calendar_id);
        if (calendar && calendar.professional_id?.toString() === staffId) {
            staffMatch = true;
        }
      }

      return dateMatch && staffMatch;
    }).sort((a, b) => {
        const dateA = a.appointment_date ? new Date(a.appointment_date).getTime() : 0;
        const dateB = b.appointment_date ? new Date(b.appointment_date).getTime() : 0;
        return dateA - dateB;
    });
  });

  constructor() {
    effect(() => {
      this.loadAllData(this.botId());
    }, { allowSignalWrites: true });
  }

  async loadAllData(botId: string) {
    this.isLoading.set(true);
    const [appointments, services, staff, contacts, calendars] = await Promise.all([
      this.dataService.getPatientAppointments(botId, {}),
      this.dataService.getProcedures(botId),
      this.dataService.getProfessionals(botId),
      this.dataService.getContacts(botId),
      this.dataService.getCalendars(botId),
    ]);
    this.appointments.set(appointments);
    this.services.set(services);
    this.staffMembers.set(staff);
    this.contacts.set(contacts);
    this.calendars.set(calendars);
    this.isLoading.set(false);
  }

  changeTab(tab: AppointmentsTab) {
    this.activeTab.set(tab);
  }

  // === MODAL MANAGEMENT ===
  openModal(type: ModalType, item: any = null) {
    this.modalType.set(type);
    if (type === 'appointment') {
      const appointmentTime = item?.appointment_date ? new Date(item.appointment_date).toISOString().substring(0, 16) : new Date().toISOString().substring(0, 16);
      this.editingAppointment.set(item ? { ...item, appointment_date: appointmentTime } : { 
        bot_id: this.botId(), 
        confirmation_status: 'agendada', 
        user_id: '', 
        appointment_date: appointmentTime 
      });
    } else if (type === 'service') {
      this.editingService.set(item ? { ...item } : { bot_id: this.botId(), name: '', description: '', procedure_type: 'non-surgical', cost_min: 0, cost_max: 0 });
    } else if (type === 'staff') {
      this.editingStaff.set(item ? { ...item } : { bot_id: this.botId(), name: '', specialty: '', is_active: true });
    }
    this.isModalOpen.set(true);
  }

  closeModal() {
    this.isModalOpen.set(false);
    this.modalType.set(null);
  }

  // === SAVE OPERATIONS ===
  async saveModal() {
    const type = this.modalType();
    try {
      if (type === 'appointment') await this.saveAppointment();
      if (type === 'service') await this.saveService();
      if (type === 'staff') await this.saveStaffMember();
      this.toastService.showSuccess(this.languageService.T('saveSuccess'));
    } catch(e) {
      console.error(`Failed to save ${type}`, e);
      this.toastService.showError(this.languageService.T('saveError'));
    }
  }

  private async saveAppointment() {
    const appt = this.editingAppointment();
    if (!appt) return;
    await this.dataService.savePatientAppointment(appt);
    this.appointments.set(await this.dataService.getPatientAppointments(this.botId(), {}));
    this.closeModal();
  }
  private async saveService() {
    const service = this.editingService();
    if (!service) return;
    await this.dataService.saveProcedure(service);
    this.services.set(await this.dataService.getProcedures(this.botId()));
    this.closeModal();
  }
  private async saveStaffMember() {
    const staff = this.editingStaff();
    if (!staff) return;
    await this.dataService.saveProfessional(staff);
    this.staffMembers.set(await this.dataService.getProfessionals(this.botId()));
    this.closeModal();
  }

  // === DELETE OPERATIONS ===
  async deleteItem(type: 'appointment' | 'service' | 'staff', item: any) {
    let itemTypeKey = '';
    let itemName = item.name;
    switch(type) {
      case 'appointment':
        itemTypeKey = 'itemType_patient_appointment';
        itemName = this.getContactName(item.user_id);
        break;
      case 'service':
        itemTypeKey = 'itemType_procedure';
        break;
      case 'staff':
        itemTypeKey = 'itemType_professional';
        break;
    }

    if (confirm(this.languageService.T('deleteConfirmationMessage').replace('{itemType}', this.languageService.T(itemTypeKey)).replace('{itemName}', itemName))) {
      try {
        if (type === 'appointment') {
          await this.dataService.deletePatientAppointment(item);
          this.appointments.set(await this.dataService.getPatientAppointments(this.botId(), {}));
        } else if (type === 'service') {
          await this.dataService.deleteProcedure(item);
          this.services.set(await this.dataService.getProcedures(this.botId()));
        } else if (type === 'staff') {
          await this.dataService.deleteProfessional(item);
          this.staffMembers.set(await this.dataService.getProfessionals(this.botId()));
        }
        this.toastService.showSuccess(this.languageService.T('deleteSuccess'));
      } catch(e) {
        console.error(`Failed to delete ${type}`, e);
        this.toastService.showError(this.languageService.T('deleteError'));
      }
    }
  }

  // === HELPERS ===
  getServiceName(id: string): string {
    return this.services().find(s => s.id === id)?.name || 'N/A';
  }
  getStaffName(id: number | null): string {
    if (id === null) return 'N/A';
    return this.staffMembers().find(s => s.professional_id === id)?.name || 'N/A';
  }
  getContactName(id: string | null): string {
    if (id === null) return 'N/A';
    return this.contacts().find(c => c.contact_id === id)?.name || 'N/A';
  }
  formatTime(isoString: string | null): string {
    if (!isoString) return 'N/A';
    return new Date(isoString).toLocaleTimeString(this.languageService.language(), { hour: '2-digit', minute: '2-digit' });
  }
  private getTodayDateString(): string {
    return new Date().toISOString().split('T')[0];
  }
}
