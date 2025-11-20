import { Component, ChangeDetectionStrategy, input, inject, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LanguageService } from '../../services/language.service';
import { DataService } from '../../services/data.service';
import { InteractionLog } from '../../models';

type DatePreset = '7d' | '30d' | 'mtd' | 'custom';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './dashboard.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent {
  botId = input.required<string>();
  languageService = inject(LanguageService);
  private dataService = inject(DataService);

  isLoading = signal(true);
  logs = signal<InteractionLog[]>([]);
  
  // Filtering state
  activePreset = signal<DatePreset>('7d');
  
  private getInitialDateRange(): { start: string; end: string } {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 6); // Default to last 7 days
    return {
      start: this.formatDateForInput(start),
      end: this.formatDateForInput(end),
    };
  }
  
  initialDates = this.getInitialDateRange();
  startDate = signal<string>(this.initialDates.start);
  endDate = signal<string>(this.initialDates.end);

  // KPIs
  totalInteractions = computed(() => this.logs().length);
  humanHandoffs = computed(() => this.logs().filter(log => log.humanHandoff).length);
  quotesGenerated = computed(() => this.logs().filter(log => log.outcome === 'quote').length);
  ordersGenerated = computed(() => this.logs().filter(log => log.outcome === 'order').length);

  // Chart Data
  interactionsByDay = computed(() => {
    const dailyCounts: { [key: string]: number } = {};
    this.logs().forEach(log => {
      const day = log.timestamp.split('T')[0];
      dailyCounts[day] = (dailyCounts[day] || 0) + 1;
    });
    const sortedDays = Object.keys(dailyCounts).sort();
    return sortedDays.map(day => ({ day, count: dailyCounts[day] }));
  });

  maxDailyInteraction = computed(() => {
    const counts = this.interactionsByDay().map(d => d.count);
    return Math.max(...counts, 0);
  });

  interactionsByChannel = computed(() => {
    const channelCounts: { [key: string]: number } = { web: 0, whatsapp: 0, other: 0 };
    this.logs().forEach(log => {
      channelCounts[log.channel] = (channelCounts[log.channel] || 0) + 1;
    });
    return [
      { channel: 'web', count: channelCounts.web },
      { channel: 'whatsapp', count: channelCounts.whatsapp },
      { channel: 'other', count: channelCounts.other },
    ];
  });
  
  recentInteractions = computed(() => {
    return this.logs()
      .slice()
      .sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 10);
  });

  constructor() {
    // This single effect is the source of truth for fetching data.
    // It automatically runs when botId, startDate, or endDate changes.
    effect(async () => {
      const currentBotId = this.botId();
      const start = this.startDate();
      const end = this.endDate();
      
      // Don't fetch until all required parameters are available.
      if (!currentBotId || !start || !end) return;

      this.isLoading.set(true);
      try {
        const fetchedLogs = await this.dataService.getInteractionLogs(currentBotId, start, end);
        this.logs.set(fetchedLogs);
      } catch (error) {
        console.error("Failed to fetch interaction logs:", error);
        this.logs.set([]); // Clear logs on error to avoid showing stale data.
      } finally {
        this.isLoading.set(false);
      }
    }, { allowSignalWrites: true });
  }

  setDatePreset(preset: DatePreset) {
    this.activePreset.set(preset);
    
    // For custom, we don't change the dates automatically.
    // The change comes from the input's ngModel binding.
    if (preset === 'custom') {
      return;
    }
    
    const end = new Date();
    const start = new Date();

    switch (preset) {
      case '7d':
        start.setDate(end.getDate() - 6);
        break;
      case '30d':
        start.setDate(end.getDate() - 29);
        break;
      case 'mtd':
        start.setDate(1);
        break;
    }
    
    // Setting these signals will trigger the effect to refetch data automatically.
    this.startDate.set(this.formatDateForInput(start));
    this.endDate.set(this.formatDateForInput(end));
  }

  onCustomDateChange() {
    // This method is called by the template's (ngModelChange).
    // Its only purpose is to set the preset button state correctly.
    // The ngModel binding updates startDate/endDate directly, which the effect picks up.
    this.activePreset.set('custom');
  }

  exportToCsv() {
    const logsToExport = this.logs();
    if (logsToExport.length === 0) {
      alert('No data to export.');
      return;
    }

    const headers = ['ID', 'Timestamp', 'Channel', 'Human Handoff', 'Outcome', 'Session ID'];
    const rows = logsToExport.map(log => 
      [log.id, log.timestamp, log.channel, log.humanHandoff, log.outcome, log.sessionId].join(',')
    );

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `bot_interactions_${this.botId()}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
  
  formatDateForInput(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  formatTimestamp(isoString: string): string {
    return new Date(isoString).toLocaleString(this.languageService.language(), {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  }
}