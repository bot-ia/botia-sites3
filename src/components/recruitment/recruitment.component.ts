import {
  Component,
  ChangeDetectionStrategy,
  signal,
  computed,
  effect,
  inject,
  input,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DataService } from '../../services/data.service';
import { ToastService } from '../../services/toast.service';
import { LanguageService } from '../../services/language.service';
import {
  RecruitmentVacancy,
  RecruitmentCandidate,
  RecruitmentApplication,
  RecruitmentConfig,
  RecruitmentDashboard,
  VacancyStatus,
  ContractType,
  CandidateSource,
  ApplicationStatus,
} from '../../models';

type ActiveTab = 'dashboard' | 'vacancies' | 'candidates' | 'pipeline' | 'config';

const APPLICATION_STATUSES: ApplicationStatus[] = [
  'applied',
  'screening',
  'interview',
  'technical_test',
  'offer',
  'hired',
  'rejected',
];

@Component({
  selector: 'app-recruitment',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './recruitment.component.html',
  styleUrls: ['./recruitment.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecruitmentComponent {
  private dataService = inject(DataService);
  private toastService = inject(ToastService);
  languageService = inject(LanguageService);

  botId = input.required<string>();
  activeTab = input<string>('dashboard');

  // ── Loading states ──────────────────────────────────────────────────────────
  isLoadingDashboard = signal(false);
  isLoadingVacancies = signal(false);
  isLoadingCandidates = signal(false);
  isLoadingApplications = signal(false);
  isLoadingConfig = signal(false);
  isSavingVacancy = signal(false);
  isSavingCandidate = signal(false);
  isSavingApplication = signal(false);
  isSavingConfig = signal(false);
  isScoringApp = signal<string | null>(null);

  // ── Data ────────────────────────────────────────────────────────────────────
  dashboard = signal<RecruitmentDashboard | null>(null);
  vacancies = signal<RecruitmentVacancy[]>([]);
  candidates = signal<RecruitmentCandidate[]>([]);
  applications = signal<RecruitmentApplication[]>([]);
  config = signal<RecruitmentConfig | null>(null);

  // ── Filters ─────────────────────────────────────────────────────────────────
  vacancySearch = signal('');
  vacancyStatusFilter = signal('');
  candidateSearch = signal('');
  pipelineVacancyFilter = signal('');

  // ── Vacancy Modal ────────────────────────────────────────────────────────────
  isVacancyModalOpen = signal(false);
  editingVacancy = signal<Partial<RecruitmentVacancy> | null>(null);
  vacancyToDelete = signal<RecruitmentVacancy | null>(null);
  skillInput = signal('');

  // ── Candidate Modal ──────────────────────────────────────────────────────────
  isCandidateModalOpen = signal(false);
  editingCandidate = signal<Partial<RecruitmentCandidate> | null>(null);
  candidateToDelete = signal<RecruitmentCandidate | null>(null);
  viewingCandidate = signal<RecruitmentCandidate | null>(null);

  // ── Application (Pipeline) Modal ─────────────────────────────────────────────
  isAppModalOpen = signal(false);
  editingApp = signal<RecruitmentApplication | null>(null);
  appNewStatus = signal('');
  appNewNotes = signal('');
  appInterviewAt = signal('');

  // ── Config form ──────────────────────────────────────────────────────────────
  configForm = signal<Partial<RecruitmentConfig>>({});

  // ── Computed ─────────────────────────────────────────────────────────────────
  filteredVacancies = computed(() => {
    const search = this.vacancySearch().toLowerCase();
    const statusFilter = this.vacancyStatusFilter();
    return this.vacancies().filter(v => {
      const matchesSearch =
        !search ||
        v.title.toLowerCase().includes(search) ||
        (v.department ?? '').toLowerCase().includes(search) ||
        (v.location ?? '').toLowerCase().includes(search);
      const matchesStatus = !statusFilter || v.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  });

  filteredCandidates = computed(() => {
    const search = this.candidateSearch().toLowerCase();
    return this.candidates().filter(c =>
      !search ||
      c.name.toLowerCase().includes(search) ||
      c.phone_number.includes(search) ||
      (c.email ?? '').toLowerCase().includes(search)
    );
  });

  applicationsByStatus = computed(() => {
    const vacancyFilter = this.pipelineVacancyFilter();
    const apps = vacancyFilter
      ? this.applications().filter(a => a.vacancy_id === vacancyFilter)
      : this.applications();

    const map: Record<ApplicationStatus, RecruitmentApplication[]> = {
      applied: [],
      screening: [],
      interview: [],
      technical_test: [],
      offer: [],
      hired: [],
      rejected: [],
      withdrawn: [],
    };
    for (const app of apps) {
      if (map[app.status] !== undefined) {
        map[app.status].push(app);
      }
    }
    return map;
  });

  readonly applicationStatuses = APPLICATION_STATUSES;
  readonly vacancyStatuses: VacancyStatus[] = ['open', 'paused', 'closed', 'filled'];
  readonly contractTypes: ContractType[] = ['full_time', 'part_time', 'contract', 'internship'];
  readonly candidateSources: CandidateSource[] = ['whatsapp', 'web', 'csv', 'ats', 'manual'];
  readonly atsTypes = ['none', 'kactus', 'unitotals', 'csv', 'webhook'];

  constructor() {
    // Reload data when botId or activeTab changes
    effect(
      () => {
        const id = this.botId();
        const tab = this.activeTab() as ActiveTab;
        if (!id) return;
        this.loadTabData(id, tab);
      },
      { allowSignalWrites: true }
    );
  }

  private async loadTabData(botId: string, tab: ActiveTab) {
    switch (tab) {
      case 'dashboard':
        await this.loadDashboard(botId);
        break;
      case 'vacancies':
        await this.loadVacancies(botId);
        break;
      case 'candidates':
        await this.loadCandidates(botId);
        break;
      case 'pipeline':
        await Promise.all([this.loadVacancies(botId), this.loadApplications(botId)]);
        break;
      case 'config':
        await this.loadConfig(botId);
        break;
    }
  }

  // ── Loaders ──────────────────────────────────────────────────────────────────
  async loadDashboard(botId: string) {
    this.isLoadingDashboard.set(true);
    const data = await this.dataService.getRecruitmentDashboard(botId);
    this.dashboard.set(data);
    this.isLoadingDashboard.set(false);
  }

  async loadVacancies(botId: string) {
    this.isLoadingVacancies.set(true);
    const data = await this.dataService.getRecruitmentVacancies(botId);
    this.vacancies.set(data);
    this.isLoadingVacancies.set(false);
  }

  async loadCandidates(botId: string) {
    this.isLoadingCandidates.set(true);
    const data = await this.dataService.getRecruitmentCandidates(botId);
    this.candidates.set(data);
    this.isLoadingCandidates.set(false);
  }

  async loadApplications(botId: string) {
    this.isLoadingApplications.set(true);
    const data = await this.dataService.getRecruitmentApplications(botId);
    this.applications.set(data);
    this.isLoadingApplications.set(false);
  }

  async loadConfig(botId: string) {
    this.isLoadingConfig.set(true);
    const data = await this.dataService.getRecruitmentConfig(botId);
    this.config.set(data);
    this.configForm.set(
      data
        ? { ...data }
        : {
            ats_type: 'none',
            ats_sync_webhook_url: null,
            cv_parser_enabled: false,
            ai_scoring_enabled: false,
            ai_scoring_prompt: null,
            auto_reject_below_score: null,
            notification_on_apply: false,
            notification_email: null,
          }
    );
    this.isLoadingConfig.set(false);
  }

  // ── Vacancy CRUD ─────────────────────────────────────────────────────────────
  openNewVacancy() {
    this.editingVacancy.set({
      title: '',
      department: null,
      description: null,
      requirements: null,
      skills: [],
      location: null,
      contract_type: null,
      salary_min: null,
      salary_max: null,
      status: 'open',
      max_applications: null,
      external_code: null,
    });
    this.skillInput.set('');
    this.isVacancyModalOpen.set(true);
  }

  openEditVacancy(v: RecruitmentVacancy) {
    this.editingVacancy.set({ ...v, skills: [...(v.skills ?? [])] });
    this.skillInput.set('');
    this.isVacancyModalOpen.set(true);
  }

  closeVacancyModal() {
    this.isVacancyModalOpen.set(false);
    this.editingVacancy.set(null);
  }

  addSkillToVacancy() {
    const skill = this.skillInput().trim();
    if (!skill) return;
    const current = this.editingVacancy();
    if (!current) return;
    const skills = [...(current.skills ?? [])];
    if (!skills.includes(skill)) {
      skills.push(skill);
      this.editingVacancy.set({ ...current, skills });
    }
    this.skillInput.set('');
  }

  removeSkillFromVacancy(skill: string) {
    const current = this.editingVacancy();
    if (!current) return;
    this.editingVacancy.set({ ...current, skills: (current.skills ?? []).filter(s => s !== skill) });
  }

  updateEditingVacancy(field: keyof RecruitmentVacancy, value: any) {
    const current = this.editingVacancy();
    if (!current) return;
    this.editingVacancy.set({ ...current, [field]: value });
  }

  async saveVacancy() {
    const vacancy = this.editingVacancy();
    if (!vacancy || !vacancy.title?.trim()) {
      this.toastService.showError('El título de la vacante es obligatorio.');
      return;
    }
    this.isSavingVacancy.set(true);
    try {
      await this.dataService.saveRecruitmentVacancy(this.botId(), vacancy);
      this.toastService.showSuccess(this.languageService.T('saveSuccess'));
      this.closeVacancyModal();
      await this.loadVacancies(this.botId());
    } catch {
      this.toastService.showError(this.languageService.T('saveError'));
    } finally {
      this.isSavingVacancy.set(false);
    }
  }

  confirmDeleteVacancy(v: RecruitmentVacancy) {
    this.vacancyToDelete.set(v);
  }

  cancelDeleteVacancy() {
    this.vacancyToDelete.set(null);
  }

  async deleteVacancy() {
    const v = this.vacancyToDelete();
    if (!v) return;
    try {
      await this.dataService.deleteRecruitmentVacancy(this.botId(), v.id);
      this.toastService.showSuccess(this.languageService.T('deleteSuccess'));
      this.vacancyToDelete.set(null);
      await this.loadVacancies(this.botId());
    } catch {
      this.toastService.showError(this.languageService.T('deleteError'));
    }
  }

  // ── Candidate CRUD ────────────────────────────────────────────────────────────
  openNewCandidate() {
    this.editingCandidate.set({
      name: '',
      phone_number: '',
      email: null,
      cv_url: null,
      source: 'manual',
      attributes: {},
    });
    this.isCandidateModalOpen.set(true);
  }

  openEditCandidate(c: RecruitmentCandidate) {
    this.editingCandidate.set({ ...c });
    this.isCandidateModalOpen.set(true);
  }

  closeCandidateModal() {
    this.isCandidateModalOpen.set(false);
    this.editingCandidate.set(null);
  }

  openViewCandidate(c: RecruitmentCandidate) {
    this.viewingCandidate.set(c);
  }

  closeViewCandidate() {
    this.viewingCandidate.set(null);
  }

  updateEditingCandidate(field: keyof RecruitmentCandidate, value: any) {
    const current = this.editingCandidate();
    if (!current) return;
    this.editingCandidate.set({ ...current, [field]: value });
  }

  async saveCandidate() {
    const candidate = this.editingCandidate();
    if (!candidate || !candidate.name?.trim() || !candidate.phone_number?.trim()) {
      this.toastService.showError('Nombre y teléfono son obligatorios.');
      return;
    }
    this.isSavingCandidate.set(true);
    try {
      await this.dataService.saveRecruitmentCandidate(this.botId(), candidate);
      this.toastService.showSuccess(this.languageService.T('saveSuccess'));
      this.closeCandidateModal();
      await this.loadCandidates(this.botId());
    } catch {
      this.toastService.showError(this.languageService.T('saveError'));
    } finally {
      this.isSavingCandidate.set(false);
    }
  }

  confirmDeleteCandidate(c: RecruitmentCandidate) {
    this.candidateToDelete.set(c);
  }

  cancelDeleteCandidate() {
    this.candidateToDelete.set(null);
  }

  async deleteCandidate() {
    const c = this.candidateToDelete();
    if (!c) return;
    try {
      await this.dataService.deleteRecruitmentCandidate(this.botId(), c.id);
      this.toastService.showSuccess(this.languageService.T('deleteSuccess'));
      this.candidateToDelete.set(null);
      await this.loadCandidates(this.botId());
    } catch {
      this.toastService.showError(this.languageService.T('deleteError'));
    }
  }

  // ── Pipeline / Application ────────────────────────────────────────────────────
  openAppDetail(app: RecruitmentApplication) {
    this.editingApp.set(app);
    this.appNewStatus.set(app.status);
    this.appNewNotes.set(app.recruiter_notes ?? '');
    this.appInterviewAt.set(app.interview_scheduled_at ?? '');
    this.isAppModalOpen.set(true);
  }

  closeAppModal() {
    this.isAppModalOpen.set(false);
    this.editingApp.set(null);
  }

  async updateAppStatus() {
    const app = this.editingApp();
    if (!app) return;
    this.isSavingApplication.set(true);
    try {
      await this.dataService.updateRecruitmentApplicationStatus(
        this.botId(),
        app.id,
        this.appNewStatus(),
        this.appNewNotes() || undefined,
        this.appInterviewAt() || undefined
      );
      this.toastService.showSuccess(this.languageService.T('saveSuccess'));
      this.closeAppModal();
      await this.loadApplications(this.botId());
    } catch {
      this.toastService.showError(this.languageService.T('saveError'));
    } finally {
      this.isSavingApplication.set(false);
    }
  }

  async scoreApp(app: RecruitmentApplication) {
    this.isScoringApp.set(app.id);
    try {
      const updated = await this.dataService.scoreRecruitmentApplication(this.botId(), app.id);
      this.toastService.showSuccess('Score IA calculado con éxito.');
      // Update in the list
      this.applications.update(list =>
        list.map(a => (a.id === updated.id ? updated : a))
      );
      // Also update the editing app if it's open
      if (this.editingApp()?.id === updated.id) {
        this.editingApp.set(updated);
      }
    } catch {
      this.toastService.showError(this.languageService.T('saveError'));
    } finally {
      this.isScoringApp.set(null);
    }
  }

  // ── Config ───────────────────────────────────────────────────────────────────
  updateConfigForm(field: keyof RecruitmentConfig, value: any) {
    this.configForm.update(f => ({ ...f, [field]: value }));
  }

  async saveConfig() {
    this.isSavingConfig.set(true);
    try {
      const saved = await this.dataService.saveRecruitmentConfig(this.botId(), this.configForm());
      this.config.set(saved);
      this.toastService.showSuccess(this.languageService.T('saveSuccess'));
    } catch {
      this.toastService.showError(this.languageService.T('saveError'));
    } finally {
      this.isSavingConfig.set(false);
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────
  getVacancyTitle(vacancyId: string): string {
    return this.vacancies().find(v => v.id === vacancyId)?.title ?? vacancyId;
  }

  getCandidateName(candidateId: string): string {
    return this.candidates().find(c => c.id === candidateId)?.name ?? candidateId;
  }

  scoreColorClass(score: number | null): string {
    if (score === null) return 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400';
    if (score >= 75) return 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400';
    if (score >= 50) return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400';
    return 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400';
  }

  vacancyStatusClass(status: VacancyStatus): string {
    switch (status) {
      case 'open': return 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400';
      case 'paused': return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400';
      case 'closed': return 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400';
      case 'filled': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400';
    }
  }

  sourceClass(source: CandidateSource): string {
    switch (source) {
      case 'whatsapp': return 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400';
      case 'web': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400';
      case 'csv': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400';
      case 'ats': return 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400';
      case 'manual': return 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400';
    }
  }

  columnHeaderClass(status: ApplicationStatus): string {
    switch (status) {
      case 'applied': return 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200';
      case 'screening': return 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300';
      case 'interview': return 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300';
      case 'technical_test': return 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300';
      case 'offer': return 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300';
      case 'hired': return 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300';
      case 'rejected': return 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300';
      default: return 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200';
    }
  }

  columnCardBorderClass(status: ApplicationStatus): string {
    switch (status) {
      case 'applied': return 'border-l-slate-400';
      case 'screening': return 'border-l-blue-400';
      case 'interview': return 'border-l-indigo-400';
      case 'technical_test': return 'border-l-purple-400';
      case 'offer': return 'border-l-yellow-400';
      case 'hired': return 'border-l-green-400';
      case 'rejected': return 'border-l-red-400';
      default: return 'border-l-slate-400';
    }
  }

  formatDate(dateStr: string | null): string {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  getStatusLabel(status: string): string {
    return this.languageService.T(`status_${status}`) || status;
  }

  getDashboardStatusCount(status: string): number {
    return this.dashboard()?.applications.by_status[status] ?? 0;
  }

  getStatusBarWidth(status: string): string {
    const total = this.dashboard()?.applications.total ?? 0;
    if (!total) return '0%';
    const count = this.getDashboardStatusCount(status);
    return `${Math.round((count / total) * 100)}%`;
  }
}
