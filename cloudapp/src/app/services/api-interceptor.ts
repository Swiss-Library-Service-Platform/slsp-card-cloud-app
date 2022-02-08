import { Injectable } from '@angular/core';
import { HttpEvent, HttpInterceptor, HttpHandler, HttpRequest } from '@angular/common/http';
import { Observable } from 'rxjs/internal/Observable';

@Injectable()
export class APIInterceptor implements HttpInterceptor {
  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const apiReq = req.clone({ url: `https://proxy02.swisscovery.network/p/api-eu.hosted.exlibrisgroup.com/almaws/v1${req.url}` });
    return next.handle(apiReq);
  }
}