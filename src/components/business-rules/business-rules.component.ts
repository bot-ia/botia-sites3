import { Component, ChangeDetectionStrategy, input, signal, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DataService } from '../../services/data.service';
import { LanguageService } from '../../services/language.service';
import { BusinessRulesConfig, DayHours, BotType } from '../../models';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-business-rules',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './business-rules.component.html',
  styleUrl: './business-rules.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BusinessRulesComponent {
  botId = input.required<string>();
  botType = input.required<BotType>();

  private dataService = inject(DataService);
  languageService = inject(LanguageService);
  private toastService = inject(ToastService);

  rules = signal<BusinessRulesConfig | null>(null);
  isLoading = signal(true);
  
  readonly weekdays: (keyof BusinessRulesConfig['delivery_windows'])[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

  constructor() {
    effect(async () => {
      const currentBotId = this.botId();
      if (currentBotId) {
        this.loadRules(currentBotId);
      }
    }, { allowSignalWrites: true });
  }

  async loadRules(botId: string) {
    this.isLoading.set(true);
    const fetchedRules = await this.dataService.getBusinessRules(botId);
    this.rules.set(fetchedRules ? JSON.parse(JSON.stringify(fetchedRules)) : null); // Deep copy for editing
    this.isLoading.set(false);
  }

  async saveBusinessRules() {
    const rulesToSave = this.rules();
    if (!rulesToSave) return;

    // Ensure the correct botId from the component input is always used for the request.
    rulesToSave.botId = this.botId();

    try {
      await this.dataService.saveBusinessRules(rulesToSave);
      this.toastService.showSuccess(this.languageService.T('saveSuccess'));
      await this.loadRules(this.botId());
    } catch (error) {
      console.error('Failed to save business rules', error);
      this.toastService.showError(this.languageService.T('saveError'));
    }
  }

  createDefaultRules() {
    const defaultDay: DayHours = { enabled: true, start: '08:00', end: '17:00' };
    const closedDay: DayHours = { enabled: false, start: '', end: '' };
    const newRules: BusinessRulesConfig = {
      botId: this.botId(),
      enabled: false,
      version: '1.0',
      min_per_ref: 10,
      delivery_windows: {
        monday: defaultDay, tuesday: defaultDay, wednesday: defaultDay, thursday: defaultDay, friday: defaultDay, saturday: closedDay, sunday: closedDay
      },
      support_windows: {
        monday: defaultDay, tuesday: defaultDay, wednesday: defaultDay, thursday: defaultDay, friday: defaultDay, saturday: closedDay, sunday: closedDay
      },
      anticipation_min_business_days: 1,
      payment: { first_order_prepaid: false, card_link_fee_rate: 0, vat: 0 },
      cancellation_penalty: 0,
      peak_season: [],
      portfolio_pdf_url: '',
      municipal_tariffs: [],
      moto_limits: [],
    };
    this.rules.set(newRules);
  }
  
  addTariff() {
    this.rules.update(rules => {
      if (!rules) return null;
      rules.municipal_tariffs.push({ municipality: '', moto: 0, carro: 0 });
      return { ...rules };
    });
  }

  removeTariff(index: number) {
    this.rules.update(rules => {
      if (!rules) return null;
      rules.municipal_tariffs.splice(index, 1);
      return { ...rules };
    });
  }
  
  addVehicleLimit() {
    this.rules.update(rules => {
      if (!rules) return null;
      rules.moto_limits.push({ category: '', limit: '' });
      return { ...rules };
    });
  }

  removeVehicleLimit(index: number) {
    this.rules.update(rules => {
      if (!rules) return null;
      rules.moto_limits.splice(index, 1);
      return { ...rules };
    });
  }
}