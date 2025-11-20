import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthTokenService } from '../services/auth-token.service';
import { ApiService } from '../services/api.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authTokenService = inject(AuthTokenService);
  const apiService = inject(ApiService);
  const authToken = authTokenService.token();

  // Apply modifications only for requests to our API
  if (req.url.startsWith(apiService.baseUrl)) {
    // Start with the original headers
    let headers = req.headers;
    
    // If a token exists, add the Authorization header as well.
    if (authToken) {
      headers = headers.set('Authorization', `Bearer ${authToken}`);
    }

    // Clone the request with the new headers and credentials option.
    const modifiedReq = req.clone({
      headers,
      withCredentials: true,
    });

    return next(modifiedReq);
  }

  return next(req);
};