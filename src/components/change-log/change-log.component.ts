import { Component, ChangeDetectionStrategy, input, signal, inject, effect, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DataService } from '../../services/data.service';
import { LanguageService } from '../../services/language.service';
import { ChangeLog, ChangeLogEntity } from '../../models';

@Component({
  selector: 'app-change-log',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './change-log.component.html',
  styleUrl: './change-log.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChangeLogComponent {
  botId = input.required<string>();

  private dataService = inject(DataService);
  languageService = inject(LanguageService);

  logs = signal<ChangeLog[]>([]);
  isLoading = signal(true);
  
  // Filtering state
  filterDate = signal<string>('');
  filterEntityType = signal<ChangeLogEntity | 'All'>('All');
  
  readonly entityTypes: ChangeLogEntity[] = ['Bot', 'Prompt', 'PortfolioItem', 'KnowledgeItem', 'SpecialLink', 'BusinessRules', 'ServiceOrder', 'KnowledgeDocument', 'Procedure', 'Contact', 'Professional', 'Calendar', 'PatientAppointment', 'WATemplate', 'NotificationConfig', 'Campaign'];

  filteredLogs = computed(() => {
    const allLogs = this.logs();
    const date = this.filterDate();
    const type = this.filterEntityType();

    return allLogs.filter(log => {
      const dateMatch = !date || log.timestamp.startsWith(date);
      const typeMatch = type === 'All' || log.entityType === type;
      return dateMatch && typeMatch;
    });
  });

  constructor() {
    effect(() => {
      this.loadLogs(this.botId());
    }, { allowSignalWrites: true });
  }

  async loadLogs(botId: string) {
    this.isLoading.set(true);
    const fetchedLogs = await this.dataService.getChangeLogs(botId);
    this.logs.set(fetchedLogs);
    this.isLoading.set(false);
  }

  formatTimestamp(isoString: string): string {
    return new Date(isoString).toLocaleString(this.languageService.language(), {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
  }
}