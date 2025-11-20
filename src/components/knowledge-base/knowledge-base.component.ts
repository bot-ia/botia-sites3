import { Component, ChangeDetectionStrategy, input, signal, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DataService } from '../../services/data.service';
import { LanguageService } from '../../services/language.service';
import { KnowledgeItem } from '../../models';

interface KnowledgeItemWithState extends KnowledgeItem {
  state: 'idle' | 'loading' | 'loaded' | 'error';
  content: string | null;
}

@Component({
  selector: 'app-knowledge-base',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './knowledge-base.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KnowledgeBaseComponent {
  botId = input.required<string>();

  private dataService = inject(DataService);
  languageService = inject(LanguageService);
  knowledgeItems = signal<KnowledgeItemWithState[]>([]);
  isLoading = signal(true);

  constructor() {
    effect(async () => {
      const currentBotId = this.botId();
      this.isLoading.set(true);
      const items = await this.dataService.getKnowledgeItems(currentBotId);
      this.knowledgeItems.set(items.map(item => ({...item, state: 'idle', content: null})));
      this.isLoading.set(false);
    }, { allowSignalWrites: true });
  }

  async fetchContent(itemId: string) {
    this.knowledgeItems.update(items =>
      items.map(item => item.id === itemId ? { ...item, state: 'loading' } : item)
    );

    try {
      const itemToFetch = this.knowledgeItems().find(item => item.id === itemId);
      if (!itemToFetch) throw new Error('Item not found');

      const result = await this.dataService.fetchN8nData(this.botId(), itemToFetch.id);
      
      this.knowledgeItems.update(items =>
        items.map(item => item.id === itemId ? { ...item, state: 'loaded', content: JSON.stringify(result, null, 2) } : item)
      );
    } catch (error) {
      this.knowledgeItems.update(items =>
        items.map(item => item.id === itemId ? { ...item, state: 'error', content: this.languageService.T('error') } : item)
      );
    }
  }

  resetContent(itemId: string) {
     this.knowledgeItems.update(items =>
      items.map(item => item.id === itemId ? { ...item, state: 'idle', content: null } : item)
    );
  }
}