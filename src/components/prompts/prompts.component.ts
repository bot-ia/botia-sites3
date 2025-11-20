import { Component, ChangeDetectionStrategy, input, signal, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DataService } from '../../services/data.service';
import { LanguageService } from '../../services/language.service';
import { Prompt } from '../../models';

@Component({
  selector: 'app-prompts',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './prompts.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PromptsComponent {
  botId = input.required<string>();
  
  private dataService = inject(DataService);
  languageService = inject(LanguageService);
  prompts = signal<Prompt[]>([]);
  isLoading = signal(true);

  isModalOpen = signal(false);
  editingPrompt = signal<Partial<Prompt> | null>(null);

  constructor() {
    effect(async () => {
      const currentBotId = this.botId();
      this.isLoading.set(true);
      const fetchedPrompts = await this.dataService.getPrompts(currentBotId);
      this.prompts.set(fetchedPrompts);
      this.isLoading.set(false);
    }, { allowSignalWrites: true });
  }

  openModal(prompt: Prompt | null = null) {
    if (prompt) {
      this.editingPrompt.set({ ...prompt });
    } else {
      this.editingPrompt.set({ botId: this.botId(), promptId: '', content: '' });
    }
    this.isModalOpen.set(true);
  }

  closeModal() {
    this.isModalOpen.set(false);
    this.editingPrompt.set(null);
  }

  async savePrompt() {
    const promptToSave = this.editingPrompt();
    if (!promptToSave || !promptToSave.promptId || !promptToSave.content) return;

    await this.dataService.savePrompt(promptToSave);
    const updatedPrompts = await this.dataService.getPrompts(this.botId());
    this.prompts.set(updatedPrompts);
    this.closeModal();
  }

  async deletePrompt(promptId: string) {
    const promptToDelete = this.prompts().find(p => p.id === promptId);
    if (!promptToDelete) return;

    const message = this.languageService.T('deleteConfirmationMessage')
      .replace('{itemType}', this.languageService.T('itemType_prompt'))
      .replace('{itemName}', promptToDelete.promptId);

    if (confirm(message)) {
      await this.dataService.deletePrompt(promptToDelete);
      const updatedPrompts = await this.dataService.getPrompts(this.botId());
      this.prompts.set(updatedPrompts);
    }
  }

  insertVariable(variable: string, promptContentRef: HTMLTextAreaElement) {
    if (this.editingPrompt()) {
      const currentContent = this.editingPrompt()!.content || '';
      const start = promptContentRef.selectionStart;
      const end = promptContentRef.selectionEnd;
      const text = currentContent.substring(0, start) + ` {{${variable}}} ` + currentContent.substring(end);

      this.editingPrompt.update(p => ({...p!, content: text}));

      // Focus and set cursor position after the inserted variable
      setTimeout(() => {
        promptContentRef.focus();
        promptContentRef.selectionStart = promptContentRef.selectionEnd = start + variable.length + 5;
      }, 0);
    }
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleString(this.languageService.language());
  }
}