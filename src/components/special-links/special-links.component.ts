import { Component, ChangeDetectionStrategy, input, signal, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DataService } from '../../services/data.service';
import { LanguageService } from '../../services/language.service';
import { SpecialLink } from '../../models';

@Component({
  selector: 'app-special-links',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './special-links.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SpecialLinksComponent {
  botId = input.required<string>();
  
  private dataService = inject(DataService);
  languageService = inject(LanguageService);
  links = signal<SpecialLink[]>([]);
  isLoading = signal(true);

  constructor() {
    effect(async () => {
      const currentBotId = this.botId();
      this.isLoading.set(true);
      const fetchedLinks = await this.dataService.getSpecialLinks(currentBotId);
      this.links.set(fetchedLinks);
      this.isLoading.set(false);
    }, { allowSignalWrites: true });
  }
}