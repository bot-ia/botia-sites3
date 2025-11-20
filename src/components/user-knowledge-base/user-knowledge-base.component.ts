import { Component, ChangeDetectionStrategy, input, signal, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DataService } from '../../services/data.service';
import { LanguageService } from '../../services/language.service';
import { ToastService } from '../../services/toast.service';
import { KnowledgeDocument } from '../../models';

@Component({
  selector: 'app-user-knowledge-base',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './user-knowledge-base.component.html',
  styleUrl: './user-knowledge-base.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserKnowledgeBaseComponent {
  botId = input.required<string>();
  webhookUrl = input<string | undefined>();
  botType = input<string>();

  private dataService = inject(DataService);
  languageService = inject(LanguageService);
  private toastService = inject(ToastService);

  documents = signal<KnowledgeDocument[]>([]);
  selectedDocument = signal<KnowledgeDocument | null>(null);
  isLoading = signal(true);
  isSyncing = signal(false);

  isEditorMaximized = signal(false);
  docToDelete = signal<KnowledgeDocument | null>(null);

  constructor() {
    effect(async () => {
      await this.loadDocuments(this.botId());
    }, { allowSignalWrites: true });
  }

  async loadDocuments(botId: string) {
    this.isLoading.set(true);
    try {
      this.documents.set(await this.dataService.getKnowledgeDocuments(botId));
    } catch (e) {
      console.error(e);
      this.toastService.showError(this.languageService.T('loadDocumentsError'));
    } finally {
      this.isLoading.set(false);
    }
  }

  selectDocument(doc: KnowledgeDocument) {
    // Deep copy for safe editing
    this.selectedDocument.set(JSON.parse(JSON.stringify(doc)));
  }

  createNewDocument() {
    this.selectedDocument.set({
      id: '',
      botId: this.botId(),
      title: this.languageService.T('newDocumentTitle'),
      content: '',
      lastUpdatedAt: new Date().toISOString()
    });
  }

  clearSelection() {
    this.selectedDocument.set(null);
  }

  async saveDocument() {
    const doc = this.selectedDocument();
    if (!doc || !doc.title.trim()) {
      this.toastService.showError(this.languageService.T('documentTitleRequired'));
      return;
    }
    
    this.isLoading.set(true);
    try {
      const savedDoc = await this.dataService.saveKnowledgeDocument(doc);
      await this.loadDocuments(this.botId());
      // Re-select the saved document to show updated state
      this.selectDocument(savedDoc);
      this.toastService.showSuccess(this.languageService.T('saveDocumentSuccess'));
    } catch (e) {
      console.error(e);
      this.toastService.showError(this.languageService.T('saveDocumentError'));
    } finally {
      this.isLoading.set(false);
    }
  }

  requestDelete(doc: KnowledgeDocument) {
    this.docToDelete.set(doc);
  }

  cancelDelete() {
    this.docToDelete.set(null);
  }

  async confirmDelete() {
    const docToDelete = this.docToDelete();
    if (!docToDelete) return;

    this.isLoading.set(true);
    try {
      await this.dataService.deleteKnowledgeDocument(docToDelete);
      if (this.selectedDocument()?.id === docToDelete.id) {
        this.clearSelection();
      }
      await this.loadDocuments(this.botId());
      this.toastService.showSuccess(this.languageService.T('deleteDocumentSuccess'));
    } catch (e) {
      console.error(e);
      this.toastService.showError(this.languageService.T('deleteDocumentError'));
    } finally {
      this.isLoading.set(false);
      this.cancelDelete();
    }
  }

  async triggerSync() {
    if (!this.webhookUrl()) return;
    
    this.isSyncing.set(true);
    try {
      await this.dataService.triggerKnowledgeBaseUpdate(this.botId());
      this.toastService.showSuccess(this.languageService.T('syncSuccess'));
    } catch (e) {
      console.error(e);
      this.toastService.showError(this.languageService.T('syncError'));
    } finally {
      this.isSyncing.set(false);
    }
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleString(this.languageService.language(), {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  }
}