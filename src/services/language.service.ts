import { Injectable, signal } from '@angular/core';
import { en } from '../i18n/en';
import { es } from '../i18n/es';

@Injectable({
  providedIn: 'root',
})
export class LanguageService {
  language = signal<'en' | 'es'>('es'); // Default to Spanish

  private translations = { en, es };

  T(key: string): string {
    const lang = this.language();
    const translationSet = this.translations[lang] as { [key: string]: string };
    return translationSet[key] || key;
  }
  
  toggleLanguage() {
    this.language.update(lang => lang === 'es' ? 'en' : 'es');
  }
}
