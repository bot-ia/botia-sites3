import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { firstValueFrom, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Bot, Prompt, KnowledgeItem, SpecialLink, PortfolioItem, BusinessRulesConfig, ChangeLog, InteractionLog, ServiceOrder, KnowledgeDocument, Procedure, Contact, CsvImportResponse, Professional, Calendar, PatientAppointment, WATemplate, WATemplateDetail, TemplateParameter, NotificationConfig, Campaign, NotificationQueueItem, CampaignContact, ExecuteCampaignResponse } from './models';
import { ApiService } from './services/api.service';

@Injectable({
  providedIn: 'root',
})
export class DataService {
  private http = inject(HttpClient);
  private apiService = inject(ApiService);

  private get<T>(url: string, defaultValue: T, params?: HttpParams): Promise<T> {
    return firstValueFrom(
      this.http.get<T>(url, { params }).pipe(
        catchError((err: HttpErrorResponse) => {
          console.error(`GET ${url} failed:`, err.message);
          return of(defaultValue);
        })
      )
    );
  }

  // BOT MANAGEMENT
  async getBots(accessibleBotIds: string[]): Promise<Bot[]> {
    console.log('%c[DataService] Iniciando getBots para usuario normal.', 'color: cyan');
    console.log('[DataService] IDs de bots accesibles recibidos:', accessibleBotIds);

    if (!accessibleBotIds || accessibleBotIds.length === 0) {
      console.error('%c[DataService] ACCIÓN DETENIDA: No se puede realizar la petición de bots al servidor porque la lista de IDs de bots accesibles está vacía.', 'background: #282a36; color: #ff5555; font-size: 14px; padding: 4px; font-weight: bold;');
      console.log('%c[DIAGNÓSTICO DEL FRONTEND]', 'color: #ffb86c; font-weight: bold;');
      console.log('%cEsto significa que el objeto del usuario actual (`currentUser`) no contiene ningún ID en su propiedad `accessibleBotIds`.', 'color: #ffb86c;');
      console.log('%cLa información del usuario se obtiene del endpoint `/api/users/me/` justo después de iniciar sesión.', 'color: #ffb86c;');
      
      console.log('%c[QUÉ VERIFICAR EN EL BACKEND]', 'color: #50fa7b; font-weight: bold;');
      console.log('%c1. Asegúrate de que el endpoint `GET /api/users/me/` esté devolviendo correctamente el arreglo `accessibleBotIds` para este usuario.', 'color: #50fa7b;');
      console.log('%c2. Un ejemplo de respuesta JSON correcta para un usuario con acceso a dos bots sería:', 'color: #50fa7b;');
      console.log('%c{"id": "...", "email": "user@example.com", "accessibleBotIds": ["bot_id_1", "bot_id_2"], "role": "user"}', 'background: #44475a; color: #f8f82; padding: 2px 5px; border-radius: 3px;');
      
      return Promise.resolve([]);
    }
    const url = `${this.apiService.baseUrl}/bots`;
    
    // Send bot IDs as a single comma-separated string. This is a common pattern for APIs.
    const params = new HttpParams().set('bot_ids', accessibleBotIds.join(','));
    
    const fullUrl = `${url}?${params.toString()}`;
    console.log(`[DataService] Realizando petición GET a: ${fullUrl}`);
    
    return firstValueFrom(
      this.http.get<Bot[]>(url, { params }).pipe(
        catchError((err: HttpErrorResponse) => {
          console.error(`%c[DataService] FALLÓ la petición GET a ${fullUrl}`, 'color: red; font-weight: bold;');
          console.error('[DataService] Estado del Error:', err.status);
          console.error('[DataService] Cuerpo del Error:', err.error);
          console.error('[DataService] Objeto de Error Completo:', err);
          
          console.log('%c[DataService] INDICACIÓN PARA BACKEND (SI LA PETICIÓN SE REALIZÓ PERO FALLÓ):', 'background: #111; color: #50fa7b; font-size: 14px; padding: 4px;');
          console.log('%cEl frontend está enviando una petición GET a /api/bots con un parámetro de consulta llamado `bot_ids`.', 'background: #111; color: #50fa7b');
          console.log('%cEste parámetro contiene una cadena de texto con los IDs de los bots, separados por comas. Ejemplo: `?bot_ids=bot1,bot2,bot3`', 'background: #111; color: #50fa7b');
          console.log('%cEl backend debe leer este parámetro, separar los IDs y devolver un arreglo JSON con los objetos completos de los bots correspondientes. Si la petición es exitosa, la respuesta debe ser un código 200 OK y el cuerpo debe ser algo como: `[{...bot1...}, {...bot2...}]`', 'background: #111; color: #50fa7b');

          return of([]);
        })
      )
    );
  }

  async getAllBotsAdmin(): Promise<Bot[]> {
    return this.get<Bot[]>(`${this.apiService.baseUrl}/admin/bots`, []);
  }
  
  async saveBotAdmin(botToSave: Partial<Bot>, isUpdate: boolean): Promise<Bot> {
    const request = isUpdate
      ? this.http.put<Bot>(`${this.apiService.baseUrl}/admin/bots/${botToSave.bot_id}`, botToSave)
      : this.http.post<Bot>(`${this.apiService.baseUrl}/admin/bots`, botToSave);
    return firstValueFrom(request);
  }

  async deleteBotAdmin(botId: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`${this.apiService.baseUrl}/admin/bots/${botId}`));
  }
  
  // LOGS
  async getInteractionLogs(botId: string, start: string, end: string): Promise<InteractionLog[]> {
    const params = new HttpParams().set('start_date', start).set('end_date', end);
    const url = `${this.apiService.baseUrl}/bots/${botId}/interaction_logs`;
    return firstValueFrom(
        this.http.get<InteractionLog[]>(url, { params }).pipe(catchError(() => of([])))
    );
  }

  async getChangeLogs(botId: string): Promise<ChangeLog[]> {
     return this.get<ChangeLog[]>(`${this.apiService.baseUrl}/bots/${botId}/change_logs`, []);
  }
  
  // CONFIGURATIONS
  async getPrompts(botId: string): Promise<Prompt[]> { return this.get<Prompt[]>(`${this.apiService.baseUrl}/bots/${botId}/prompts`, []); }
  async savePrompt(promptToSave: Partial<Prompt>): Promise<Prompt> {
    const request = promptToSave.id
      ? this.http.put<Prompt>(`${this.apiService.baseUrl}/bots/${promptToSave.botId}/prompts/${promptToSave.id}`, promptToSave)
      : this.http.post<Prompt>(`${this.apiService.baseUrl}/bots/${promptToSave.botId}/prompts`, promptToSave);
    return firstValueFrom(request);
  }
  async deletePrompt(promptToDelete: Prompt): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`${this.apiService.baseUrl}/bots/${promptToDelete.botId}/prompts/${promptToDelete.id}`));
  }
  
  async getKnowledgeItems(botId: string): Promise<KnowledgeItem[]> { return this.get<KnowledgeItem[]>(`${this.apiService.baseUrl}/bots/${botId}/knowledge_items`, []); }
  async fetchN8nData(botId: string, itemId: string): Promise<any> { return firstValueFrom(this.http.get<any>(`${this.apiService.baseUrl}/bots/${botId}/knowledge_items/${itemId}/test`)); }
  async saveKnowledgeItem(item: Partial<KnowledgeItem>): Promise<KnowledgeItem> {
     const request = item.id
      ? this.http.put<KnowledgeItem>(`${this.apiService.baseUrl}/bots/${item.botId}/knowledge_items/${item.id}`, item)
      : this.http.post<KnowledgeItem>(`${this.apiService.baseUrl}/bots/${item.botId}/knowledge_items`, item);
    return firstValueFrom(request);
  }
  async deleteKnowledgeItem(item: KnowledgeItem): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`${this.apiService.baseUrl}/bots/${item.botId}/knowledge_items/${item.id}`));
  }

  async getSpecialLinks(botId: string): Promise<SpecialLink[]> { return this.get<SpecialLink[]>(`${this.apiService.baseUrl}/bots/${botId}/special_links`, []); }
  async saveSpecialLink(link: Partial<SpecialLink>): Promise<SpecialLink> {
     const request = link.id
      ? this.http.put<SpecialLink>(`${this.apiService.baseUrl}/bots/${link.botId}/special_links/${link.id}`, link)
      : this.http.post<SpecialLink>(`${this.apiService.baseUrl}/bots/${link.botId}/special_links`, link);
    return firstValueFrom(request);
  }
  async deleteSpecialLink(link: SpecialLink): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`${this.apiService.baseUrl}/bots/${link.botId}/special_links/${link.id}`));
  }
  
  async getPortfolioItems(botId: string): Promise<PortfolioItem[]> { return this.get<PortfolioItem[]>(`${this.apiService.baseUrl}/bots/${botId}/portfolio_items`, []); }
  async savePortfolioItem(item: Partial<PortfolioItem>): Promise<PortfolioItem> {
     const request = item.id
      ? this.http.put<PortfolioItem>(`${this.apiService.baseUrl}/bots/${item.botId}/portfolio_items/${item.id}`, item)
      : this.http.post<PortfolioItem>(`${this.apiService.baseUrl}/bots/${item.botId}/portfolio_items`, item);
    return firstValueFrom(request);
  }
  async deletePortfolioItem(item: PortfolioItem): Promise<void> {
     return firstValueFrom(this.http.delete<void>(`${this.apiService.baseUrl}/bots/${item.botId}/portfolio_items/${item.id}`));
  }
  
  async getBusinessRules(botId: string): Promise<BusinessRulesConfig | null> { return this.get<BusinessRulesConfig | null>(`${this.apiService.baseUrl}/bots/${botId}/business_rules`, null); }
  async saveBusinessRules(rules: BusinessRulesConfig): Promise<BusinessRulesConfig> {
    return firstValueFrom(this.http.post<BusinessRulesConfig>(`${this.apiService.baseUrl}/bots/${rules.botId}/business_rules`, rules));
  }
  
  // REPAIR BOT
  async getServiceOrders(botId: string): Promise<ServiceOrder[]> { return this.get<ServiceOrder[]>(`${this.apiService.baseUrl}/bots/${botId}/service_orders`, []); }
  async saveServiceOrder(order: Partial<ServiceOrder>): Promise<ServiceOrder> {
    const request = order.id
      ? this.http.put<ServiceOrder>(`${this.apiService.baseUrl}/bots/${order.botId}/service_orders/${order.id}`, order)
      : this.http.post<ServiceOrder>(`${this.apiService.baseUrl}/bots/${order.botId}/service_orders`, order);
    return firstValueFrom(request);
  }
  async deleteServiceOrder(order: ServiceOrder): Promise<void> { return firstValueFrom(this.http.delete<void>(`${this.apiService.baseUrl}/bots/${order.botId}/service_orders/${order.id}`)); }
  
  // USER KNOWLEDGE BASE
  async getKnowledgeDocuments(botId: string): Promise<KnowledgeDocument[]> { return this.get<KnowledgeDocument[]>(`${this.apiService.baseUrl}/bots/${botId}/knowledge_documents`, []); }
  async saveKnowledgeDocument(doc: Partial<KnowledgeDocument>): Promise<KnowledgeDocument> {
     const request = doc.id
      ? this.http.put<KnowledgeDocument>(`${this.apiService.baseUrl}/bots/${doc.botId}/knowledge_documents/${doc.id}`, doc)
      : this.http.post<KnowledgeDocument>(`${this.apiService.baseUrl}/bots/${doc.botId}/knowledge_documents`, doc);
    return firstValueFrom(request);
  }
  async deleteKnowledgeDocument(doc: KnowledgeDocument): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`${this.apiService.baseUrl}/bots/${doc.botId}/knowledge_documents/${doc.id}`));
  }
  async triggerKnowledgeBaseUpdate(botId: string): Promise<void> {
    return firstValueFrom(this.http.post<void>(`${this.apiService.baseUrl}/bots/${botId}/knowledge_documents/trigger_sync`, {}));
  }

  // AESTHETIC CLINIC BOT
  async getProcedures(botId: string): Promise<Procedure[]> { return this.get<Procedure[]>(`${this.apiService.baseUrl}/bots/${botId}/procedures`, []); }
  async saveProcedure(proc: Partial<Procedure>): Promise<Procedure> {
     const request = proc.id
      ? this.http.put<Procedure>(`${this.apiService.baseUrl}/bots/${proc.bot_id}/procedures/${proc.id}`, proc)
      : this.http.post<Procedure>(`${this.apiService.baseUrl}/bots/${proc.bot_id}/procedures`, proc);
    return firstValueFrom(request);
  }
  async deleteProcedure(proc: Procedure): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`${this.apiService.baseUrl}/bots/${proc.bot_id}/procedures/${proc.id}`));
  }

  // AESTHETIC CLINIC - PROFESSIONALS
  async getProfessionals(botId: string): Promise<Professional[]> { return this.get<Professional[]>(`${this.apiService.baseUrl}/bots/${botId}/professionals`, []); }
  async saveProfessional(prof: Partial<Professional>): Promise<Professional> {
     const request = prof.professional_id
      ? this.http.put<Professional>(`${this.apiService.baseUrl}/bots/${prof.bot_id}/professionals/${prof.professional_id}`, prof)
      : this.http.post<Professional>(`${this.apiService.baseUrl}/bots/${prof.bot_id}/professionals`, prof);
    return firstValueFrom(request);
  }
  async deleteProfessional(prof: Professional): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`${this.apiService.baseUrl}/bots/${prof.bot_id}/professionals/${prof.professional_id}`));
  }

  // AESTHETIC CLINIC - CALENDARS
  async getCalendars(botId: string): Promise<Calendar[]> { return this.get<Calendar[]>(`${this.apiService.baseUrl}/bots/${botId}/calendars`, []); }
  async saveCalendar(cal: Partial<Calendar>): Promise<Calendar> {
     const request = cal.calendar_id
      ? this.http.put<Calendar>(`${this.apiService.baseUrl}/bots/${cal.bot_id}/calendars/${cal.calendar_id}`, cal)
      : this.http.post<Calendar>(`${this.apiService.baseUrl}/bots/${cal.bot_id}/calendars`, cal);
    return firstValueFrom(request);
  }
  async deleteCalendar(cal: Calendar): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`${this.apiService.baseUrl}/bots/${cal.bot_id}/calendars/${cal.calendar_id}`));
  }

  // AESTHETIC CLINIC - PATIENT APPOINTMENTS
  async getPatientAppointments(botId: string, filters: any): Promise<PatientAppointment[]> {
    let params = new HttpParams();
    for (const key in filters) {
      if (filters[key] && filters[key] !== 'all') {
        params = params.set(key, filters[key]);
      }
    }
    return this.get<PatientAppointment[]>(`${this.apiService.baseUrl}/bots/${botId}/patient_appointments`, [], params);
  }
  async savePatientAppointment(appt: Partial<PatientAppointment>): Promise<PatientAppointment> {
    const request = appt.appointment_id
      ? this.http.put<PatientAppointment>(`${this.apiService.baseUrl}/bots/${appt.bot_id}/patient_appointments/${appt.appointment_id}`, appt)
      : this.http.post<PatientAppointment>(`${this.apiService.baseUrl}/bots/${appt.bot_id}/patient_appointments`, appt);
    return firstValueFrom(request);
  }
  async deletePatientAppointment(appt: PatientAppointment): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`${this.apiService.baseUrl}/bots/${appt.bot_id}/patient_appointments/${appt.appointment_id}`));
  }

  // CONTACTS
  async getContacts(botId: string): Promise<Contact[]> { return this.get<Contact[]>(`${this.apiService.baseUrl}/bots/${botId}/contacts`, []); }
  async saveContact(contact: Partial<Contact>): Promise<Contact> {
    const request = contact.contact_id
      ? this.http.put<Contact>(`${this.apiService.baseUrl}/bots/${contact.bot_id}/contacts/${contact.contact_id}`, contact)
      : this.http.post<Contact>(`${this.apiService.baseUrl}/bots/${contact.bot_id}/contacts`, contact);
    return firstValueFrom(request);
  }
  async deleteContact(contact: Contact): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`${this.apiService.baseUrl}/bots/${contact.bot_id}/contacts/${contact.contact_id}`));
  }
  async importContactsFromCsv(botId: string, file: File): Promise<CsvImportResponse> {
    const formData = new FormData();
    formData.append('file', file);
    return firstValueFrom(this.http.post<CsvImportResponse>(`${this.apiService.baseUrl}/bots/${botId}/contacts/import_csv`, formData));
  }
  async syncWithChatwood(botId: string): Promise<{ message: string }> {
    return firstValueFrom(this.http.post<{ message: string }>(`${this.apiService.baseUrl}/bots/${botId}/contacts/sync_chatwood`, {}));
  }

  // NOTIFICATIONS MODULE
  async getWaTemplates(botId: string): Promise<WATemplate[]> {
    return this.get<WATemplate[]>(`${this.apiService.baseUrl}/bots/${botId}/notifications/templates`, []);
  }

  async syncMetaTemplates(botId: string): Promise<{ message: string }> {
    return firstValueFrom(this.http.post<{ message: string }>(`${this.apiService.baseUrl}/bots/${botId}/notifications/templates/sync-meta`, {}));
  }

  async getWaTemplateDetail(botId: string, templateId: number): Promise<WATemplateDetail | null> {
    return this.get<WATemplateDetail | null>(`${this.apiService.baseUrl}/bots/${botId}/notifications/templates/${templateId}`, null);
  }

  async updateTemplateParameters(botId: string, templateId: number, params: Partial<TemplateParameter>[]): Promise<void> {
    return firstValueFrom(this.http.put<void>(`${this.apiService.baseUrl}/bots/${botId}/notifications/templates/${templateId}/parameters`, { parameters: params }));
  }

  async getNotificationConfigs(botId: string): Promise<NotificationConfig[]> {
    return this.get<NotificationConfig[]>(`${this.apiService.baseUrl}/bots/${botId}/notifications/configs`, []);
  }

  async saveNotificationConfig(config: Partial<NotificationConfig>): Promise<NotificationConfig> {
    const request = config.id
      ? this.http.put<NotificationConfig>(`${this.apiService.baseUrl}/bots/${config.bot_id}/notifications/configs/${config.id}`, config)
      : this.http.post<NotificationConfig>(`${this.apiService.baseUrl}/bots/${config.bot_id}/notifications/configs`, config);
    return firstValueFrom(request);
  }

  async deleteNotificationConfig(config: NotificationConfig): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`${this.apiService.baseUrl}/bots/${config.bot_id}/notifications/configs/${config.id}`));
  }

  async getCampaigns(botId: string): Promise<Campaign[]> {
    return this.get<Campaign[]>(`${this.apiService.baseUrl}/bots/${botId}/notifications/campaigns`, []);
  }

  async createCampaign(botId: string, campaign: { name: string, template_id: number }): Promise<Campaign> {
    return firstValueFrom(this.http.post<Campaign>(`${this.apiService.baseUrl}/bots/${botId}/notifications/campaigns`, campaign));
  }

  async getCampaign(botId: string, campaignId: number): Promise<Campaign | null> {
    return this.get<Campaign | null>(`${this.apiService.baseUrl}/bots/${botId}/notifications/campaigns/${campaignId}`, null);
  }
  
  async updateCampaign(botId: string, campaignId: number, data: { name?: string; parameters?: Partial<TemplateParameter>[] }): Promise<Campaign> {
    return firstValueFrom(this.http.put<Campaign>(`${this.apiService.baseUrl}/bots/${botId}/notifications/campaigns/${campaignId}`, data));
  }
  
  async updateCampaignParameters(botId: string, campaignId: number, parameters: { template_param_id: number; assign_type: string; assign_value: string }[]): Promise<void> {
    const url = `${this.apiService.baseUrl}/bots/${botId}/notifications/campaigns/${campaignId}/parameters`;
    return firstValueFrom(this.http.put<void>(url, { parameters }));
  }

  async deleteCampaign(botId: string, campaignId: number): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`${this.apiService.baseUrl}/bots/${botId}/notifications/campaigns/${campaignId}`));
  }
  
  async getCampaignContacts(botId: string, campaignId: number): Promise<CampaignContact[]> {
    return this.get<CampaignContact[]>(`${this.apiService.baseUrl}/bots/${botId}/notifications/campaigns/${campaignId}/contacts`, []);
  }

  async addContactsToCampaign(botId: string, campaignId: number, contacts: { phone_number: string, params: any }[]): Promise<any> {
    return firstValueFrom(this.http.post<any>(`${this.apiService.baseUrl}/bots/${botId}/notifications/campaigns/${campaignId}/contacts`, { contacts }));
  }

  async executeCampaign(botId: string, campaignId: number): Promise<ExecuteCampaignResponse> {
    return firstValueFrom(this.http.post<ExecuteCampaignResponse>(`${this.apiService.baseUrl}/bots/${botId}/notifications/campaigns/${campaignId}/run`, {}));
  }

  async getNotificationQueue(botId: string, limit: number = 100): Promise<NotificationQueueItem[]> {
    const params = new HttpParams().set('limit', limit.toString());
    return this.get<NotificationQueueItem[]>(`${this.apiService.baseUrl}/bots/${botId}/notifications/queue/pending`, [], params);
  }
}