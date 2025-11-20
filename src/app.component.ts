import { Component, ChangeDetectionStrategy, signal, effect, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { DashboardComponent } from './components/dashboard/dashboard.component';
import { KnowledgeBaseComponent } from './components/knowledge-base/knowledge-base.component';
import { SpecialLinksComponent } from './components/special-links/special-links.component';
import { AdminComponent } from './components/admin/admin.component';
import { LoginComponent } from './components/login/login.component';
import { PortfolioComponent } from './components/cocinario-menu/cocinario-menu.component';
import { BusinessRulesComponent } from './components/business-rules/business-rules.component';
import { ChangeLogComponent } from './components/change-log/change-log.component';
import { ServiceOrdersComponent } from './components/service-orders/service-orders.component';
import { UserKnowledgeBaseComponent } from './components/user-knowledge-base/user-knowledge-base.component';
import { ProceduresComponent } from './components/procedures/procedures.component';
import { ProfessionalsComponent } from './components/professionals/professionals.component';
import { CalendarsComponent } from './components/calendars/calendars.component';
import { ContactsComponent } from './components/contacts/contacts.component';
import { PatientAppointmentsComponent } from './components/patient-appointments/patient-appointments.component';
import { NotificationsComponent } from './components/notifications/notifications.component';
import { ToastComponent } from './components/toast/toast.component';
import { AuthService } from './services/auth.service';
import { DataService } from './services/data.service';
import { LanguageService } from './services/language.service';
import { Bot } from './models';
import { PromptsComponent } from './components/prompts/prompts.component';
import { ThemeService } from './services/theme.service';

type ViewType = 'dashboard' | 'knowledge' | 'links' | 'admin' | 'portfolio' | 'business_rules' | 'change_log' | 'patient_appointments' | 'service_orders' | 'user_knowledge_base' | 'procedures' | 'prompts' | 'contacts' | 'professionals' | 'calendars' | 'notifications';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DashboardComponent,
    KnowledgeBaseComponent,
    SpecialLinksComponent,
    AdminComponent,
    LoginComponent,
    PortfolioComponent,
    BusinessRulesComponent,
    ChangeLogComponent,
    ServiceOrdersComponent,
    UserKnowledgeBaseComponent,
    ProceduresComponent,
    ContactsComponent,
    ToastComponent,
    PromptsComponent,
    ProfessionalsComponent,
    CalendarsComponent,
    PatientAppointmentsComponent,
    NotificationsComponent,
  ],
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {
  private dataService = inject(DataService);
  authService = inject(AuthService);
  languageService = inject(LanguageService);
  themeService = inject(ThemeService);

  activeView = signal<ViewType>('dashboard');
  bots = signal<Bot[]>([]);
  selectedBotId = signal<string | null>(null);
  isSidebarOpen = signal(true);

  selectedBot = computed(() => {
    const id = this.selectedBotId();
    if (!id) return null;
    return this.bots().find(b => b.bot_id === id) ?? null;
  });

  // Computed signals for dynamic UI
  isProductBot = computed(() => this.selectedBot()?.botType === 'product');
  isAppointmentBot = computed(() => this.selectedBot()?.botType === 'appointment');
  isRepairBot = computed(() => this.selectedBot()?.botType === 'repair');
  isAestheticClinicBot = computed(() => this.selectedBot()?.botType === 'aesthetic_clinic');
  isUserKnowledgeBaseEnabled = computed(() => this.selectedBot()?.userKnowledgeBaseEnabled);

  constructor() {
    effect(async () => {
      const user = this.authService.currentUser();
      if (user) {
        // Admins default to admin view, users to dashboard
        if (user.role === 'admin' && this.activeView() !== 'admin') {
            this.activeView.set('admin');
        } else if (user.role === 'user' && this.activeView() === 'admin') {
            this.activeView.set('dashboard');
        }

        console.log('%c[AppComponent] Usuario actual:', 'color: orange', user);
        console.log('%c[AppComponent] Solicitando bots con los siguientes IDs accesibles:', 'color: orange', user.accessibleBotIds);

        const fetchedBots = user.role === 'admin' 
            ? await this.dataService.getAllBotsAdmin()
            : await this.dataService.getBots(user.accessibleBotIds);
        
        this.bots.set(fetchedBots);
        
        const currentSelection = this.selectedBotId();
        if (!currentSelection || !fetchedBots.some(b => b.bot_id === currentSelection)) {
          const firstBotId = user.role === 'admin' ? null : fetchedBots[0]?.bot_id ?? null;
          this.selectedBotId.set(firstBotId);
        }

      } else {
        // User logged out
        this.bots.set([]);
        this.selectedBotId.set(null);
        this.activeView.set('dashboard');
      }
    }, { allowSignalWrites: true });

    // Effect to handle view reset when bot changes and the view is no longer valid
    effect(() => {
      const bot = this.selectedBot();
      const view = this.activeView();
      if (!bot) return;

      const isViewInvalid = 
        (view === 'portfolio' && bot.botType !== 'product') ||
        (view === 'business_rules' && bot.botType !== 'product' && bot.botType !== 'aesthetic_clinic') ||
        (view === 'patient_appointments' && bot.botType !== 'aesthetic_clinic') ||
        (view === 'service_orders' && bot.botType !== 'repair') ||
        (view === 'procedures' && bot.botType !== 'aesthetic_clinic') ||
        (view === 'professionals' && bot.botType !== 'aesthetic_clinic') ||
        (view === 'calendars' && bot.botType !== 'aesthetic_clinic') ||
        (view === 'notifications' && bot.botType !== 'aesthetic_clinic') ||
        (view === 'user_knowledge_base' && !bot.userKnowledgeBaseEnabled) ||
        (view === 'knowledge' && bot.botType === 'aesthetic_clinic') ||
        (view === 'prompts' && bot.botType === 'aesthetic_clinic');

      if (isViewInvalid) {
        this.activeView.set('dashboard');
      }
    }, { allowSignalWrites: true });
  }

  changeView(view: ViewType) {
    this.activeView.set(view);
  }

  onBotChange(event: Event) {
    const selectElement = event.target as HTMLSelectElement;
    this.selectedBotId.set(selectElement.value);
  }
  
  toggleSidebar() {
    this.isSidebarOpen.update(open => !open);
  }

  logout() {
    this.authService.logout();
  }
}
