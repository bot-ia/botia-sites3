import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class ApiService {
  // Replace with your actual FastAPI backend URL
  readonly baseUrl = 'https://botia-api-botia.m29vti.easypanel.host/api';
}