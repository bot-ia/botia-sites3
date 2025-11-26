import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

const WIDGET_SCRIPT_ID = 'bot-ia-widget-script';

// Add type definition for chatwootSDK on window for better type safety
declare global {
  interface Window {
    chatwootSDK?: {
      run: (config: any) => void;
      cleanup: () => void;
    };
  }
}

@Injectable({
  providedIn: 'root',
})
export class WidgetService {
  private platformId = inject(PLATFORM_ID);

  public updateWidget(scriptContent: string | null | undefined): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    // Always clear the previous widget before adding a new one.
    this.clearWidget();

    if (scriptContent && scriptContent.trim()) {
      try {
        // 1. Extract the pure JS code from between the <script> tags.
        const code = scriptContent.replace(/<script.*?>/is, '').replace(/<\/script>/is, '').trim();
        
        if (code) {
          // 2. Create a new script element.
          const scriptElement = document.createElement('script');
          scriptElement.id = WIDGET_SCRIPT_ID;
          
          // 3. Assign the extracted code. `textContent` is the safe way to do this.
          scriptElement.textContent = code;

          // 4. Append to the body to execute it.
          document.body.appendChild(scriptElement);
        }
      } catch (e) {
        console.error('Error executing widget script:', e);
      }
    }
  }

  public clearWidget(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    
    // 1. Call the widget's own cleanup function if it exists.
    if (window.chatwootSDK && typeof window.chatwootSDK.cleanup === 'function') {
      try {
        window.chatwootSDK.cleanup();
      } catch (e) {
        console.error('Error cleaning up Chatwoot widget:', e);
      }
    }

    // 2. Remove the script tag we injected.
    const existingScript = document.getElementById(WIDGET_SCRIPT_ID);
    if (existingScript) {
      existingScript.remove();
    }
  }
}