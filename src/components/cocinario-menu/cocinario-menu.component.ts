import { Component, ChangeDetectionStrategy, input, signal, inject, effect, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DataService } from '../../services/data.service';
import { LanguageService } from '../../services/language.service';
import { PortfolioItem } from '../../models';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-portfolio',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './cocinario-menu.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PortfolioComponent {
  botId = input.required<string>();

  private dataService = inject(DataService);
  languageService = inject(LanguageService);
  private toastService = inject(ToastService);

  items = signal<PortfolioItem[]>([]);
  isLoading = signal(true);
  searchTerm = signal('');

  isModalOpen = signal(false);
  editingItem = signal<Partial<PortfolioItem> | null>(null);
  // For product 'componentes' textareas
  editingPrincipal = signal('');
  editingAcompanamientos = signal('');
  editingBebidas = signal('');

  filteredItems = computed(() => {
    const allItems = this.items();
    const term = this.searchTerm().toLowerCase();
    if (!term) return allItems;

    return allItems.filter(item => 
      item.nombre.toLowerCase().includes(term) ||
      item.sku.toLowerCase().includes(term) ||
      item.categoria_slug.toLowerCase().includes(term)
    );
  });

  availableProducts = computed(() => {
    return this.items().filter(item => item.itemType === 'product');
  });
  
  constructor() {
    effect(() => {
      this.loadPortfolioItems(this.botId());
    }, { allowSignalWrites: true });
  }

  async loadPortfolioItems(botId: string) {
    this.isLoading.set(true);
    const fetchedItems = await this.dataService.getPortfolioItems(botId);
    this.items.set(fetchedItems);
    this.isLoading.set(false);
  }

  openModal(item: PortfolioItem | null = null) {
    if (item) {
      this.editingItem.set(JSON.parse(JSON.stringify(item))); // Deep copy
      if (item.itemType === 'product') {
        this.editingPrincipal.set(this.arrayToString(item.componentes?.principal));
        this.editingAcompanamientos.set(this.arrayToString(item.componentes?.acompanamientos));
        this.editingBebidas.set(this.arrayToString(item.componentes?.bebidas));
      }
    } else {
      this.editingItem.set({
        botId: this.botId(),
        itemType: 'product',
        sku: '',
        nombre: '',
        categoria_slug: '',
        presentacion: '',
        precio_unitario: 0,
        impuesto: 'ICO 8%',
        min_por_ref: 10,
        componentes: { principal: [], acompanamientos: [], bebidas: [] },
        combo_components: [],
        notas: '',
        imagen: ''
      });
      this.editingPrincipal.set('');
      this.editingAcompanamientos.set('');
      this.editingBebidas.set('');
    }
    this.isModalOpen.set(true);
  }

  closeModal() {
    this.isModalOpen.set(false);
    this.editingItem.set(null);
  }

  async saveItem() {
    const itemToSave = this.editingItem();
    if (!itemToSave || !itemToSave.sku || !itemToSave.nombre) return;

    if (itemToSave.itemType === 'product') {
      itemToSave.componentes = {
        principal: this.stringToArray(this.editingPrincipal()),
        acompanamientos: this.stringToArray(this.editingAcompanamientos()),
        bebidas: this.stringToArray(this.editingBebidas()),
      };
      delete itemToSave.combo_components;
    } else { // combo
      delete itemToSave.componentes;
    }
    
    try {
      await this.dataService.savePortfolioItem(itemToSave);
      await this.loadPortfolioItems(this.botId());
      this.closeModal();
      this.toastService.showSuccess(this.languageService.T('saveSuccess'));
    } catch (error) {
      console.error("Failed to save portfolio item", error);
      this.toastService.showError(this.languageService.T('saveError'));
    }
  }

  async deleteItem(itemId: string) {
    const item = this.items().find(i => i.id === itemId);
    if (item && confirm(this.languageService.T('deleteConfirmationMessage').replace('{itemType}', this.languageService.T('itemType_portfolio_item')).replace('{itemName}', item.nombre))) {
      try {
        await this.dataService.deletePortfolioItem(item);
        await this.loadPortfolioItems(this.botId());
        this.toastService.showSuccess(this.languageService.T('deleteSuccess'));
      } catch (error) {
        console.error("Failed to delete portfolio item", error);
        this.toastService.showError(this.languageService.T('deleteError'));
      }
    }
  }

  // === COMBO BUILDER METHODS ===
  addComboCategory() {
    this.editingItem.update(item => {
      if (!item) return item;
      const newItem = { ...item };
      if (!newItem.combo_components) {
        newItem.combo_components = [];
      }
      newItem.combo_components.push({
        id: `cat-${Date.now()}`,
        category_name: '',
        itemIds: []
      });
      return newItem;
    });
  }

  removeComboCategory(categoryId: string) {
     this.editingItem.update(item => {
      if (!item || !item.combo_components) return item;
      item.combo_components = item.combo_components.filter(c => c.id !== categoryId);
      return item;
    });
  }

  isProductInComboCategory(categoryId: string, productId: string): boolean {
    const category = this.editingItem()?.combo_components?.find(c => c.id === categoryId);
    return category ? category.itemIds.includes(productId) : false;
  }
  
  toggleProductInComboCategory(categoryId: string, productId: string) {
    this.editingItem.update(item => {
      if (!item || !item.combo_components) return item;
      const category = item.combo_components.find(c => c.id === categoryId);
      if (category) {
        const index = category.itemIds.indexOf(productId);
        if (index > -1) {
          category.itemIds.splice(index, 1);
        } else {
          category.itemIds.push(productId);
        }
      }
      return item;
    });
  }

  // === HELPERS ===
  formatCurrency(value: number): string {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(value);
  }

  private arrayToString(arr: string[] | undefined): string {
    if (!arr) return '';
    return arr.join('\n');
  }

  private stringToArray(str: string): string[] {
    if (!str) return [];
    return str.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  }
}
