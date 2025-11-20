import { Component, ChangeDetectionStrategy, input, signal, inject, effect, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DataService } from '../../services/data.service';
import { LanguageService } from '../../services/language.service';
import { ServiceOrder, ServiceOrderStatus } from '../../models';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-service-orders',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './service-orders.component.html',
  styleUrl: './service-orders.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServiceOrdersComponent {
  botId = input.required<string>();
  
  private dataService = inject(DataService);
  languageService = inject(LanguageService);
  private toastService = inject(ToastService);

  isLoading = signal(true);
  orders = signal<ServiceOrder[]>([]);
  
  // Modal State
  isModalOpen = signal(false);
  editingOrder = signal<Partial<ServiceOrder> | null>(null);

  // Filtering & Sorting
  searchTerm = signal('');
  sort = signal<{ column: keyof ServiceOrder, direction: 'asc' | 'desc' }>({ column: 'createdAt', direction: 'desc' });
  
  readonly statuses: ServiceOrderStatus[] = ['Received', 'Evaluating', 'Quote Ready', 'In Progress', 'Completed', 'Cancelled'];

  filteredAndSortedOrders = computed(() => {
    const term = this.searchTerm().toLowerCase();
    const sortCol = this.sort().column;
    const sortDir = this.sort().direction === 'asc' ? 1 : -1;

    return this.orders()
      .filter(order => 
        order.orderId.toLowerCase().includes(term) ||
        order.clientName.toLowerCase().includes(term) ||
        order.device.toLowerCase().includes(term)
      )
      .sort((a, b) => {
        const valA = a[sortCol];
        const valB = b[sortCol];
        if (valA < valB) return -1 * sortDir;
        if (valA > valB) return 1 * sortDir;
        return 0;
      });
  });

  constructor() {
    effect(() => {
      this.loadOrders(this.botId());
    }, { allowSignalWrites: true });
  }

  async loadOrders(botId: string) {
    this.isLoading.set(true);
    const fetchedOrders = await this.dataService.getServiceOrders(botId);
    this.orders.set(fetchedOrders);
    this.isLoading.set(false);
  }

  openModal(order: ServiceOrder | null = null) {
    this.editingOrder.set(order ? { ...order } : {
      botId: this.botId(),
      orderId: '', clientName: '', clientContact: '',
      device: '', issue: '', status: 'Received'
    });
    this.isModalOpen.set(true);
  }

  closeModal() {
    this.isModalOpen.set(false);
  }

  async saveOrder() {
    const order = this.editingOrder();
    if (!order) return;
    try {
      await this.dataService.saveServiceOrder(order);
      this.orders.set(await this.dataService.getServiceOrders(this.botId()));
      this.closeModal();
      this.toastService.showSuccess(this.languageService.T('saveSuccess'));
    } catch(e) {
      console.error("Failed to save service order", e);
      this.toastService.showError(this.languageService.T('saveError'));
    }
  }

  async deleteOrder(order: ServiceOrder) {
    if (confirm(this.languageService.T('deleteConfirmationMessage').replace('{itemType}', this.languageService.T('itemType_service_order')).replace('{itemName}', order.orderId))) {
      try {
        await this.dataService.deleteServiceOrder(order);
        this.orders.set(await this.dataService.getServiceOrders(this.botId()));
        this.toastService.showSuccess(this.languageService.T('deleteSuccess'));
      } catch (e) {
        console.error("Failed to delete service order", e);
        this.toastService.showError(this.languageService.T('deleteError'));
      }
    }
  }

  async onStatusChange(order: ServiceOrder, event: Event) {
    const newStatus = (event.target as HTMLSelectElement).value as ServiceOrderStatus;
    const updatedOrder = { ...order, status: newStatus };
    try {
      await this.dataService.saveServiceOrder(updatedOrder);
      this.orders.update(orders => orders.map(o => o.id === updatedOrder.id ? updatedOrder : o));
      this.toastService.showSuccess(this.languageService.T('saveSuccess'));
    } catch(e) {
      console.error("Failed to update order status", e);
      this.toastService.showError(this.languageService.T('saveError'));
       // Revert UI on failure
      this.orders.update(orders => [...orders]);
    }
  }
  
  updateSort(column: keyof ServiceOrder) {
    this.sort.update(s => ({
      column,
      direction: s.column === column && s.direction === 'desc' ? 'asc' : 'desc'
    }));
  }

  formatDate(isoString: string): string {
    return new Date(isoString).toLocaleDateString(this.languageService.language());
  }
}
