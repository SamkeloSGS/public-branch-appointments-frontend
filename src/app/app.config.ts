import { provideHttpClient, withInterceptors } from '@angular/common/http'
import {
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  type ApplicationConfig,
} from '@angular/core'
import { MAT_FORM_FIELD_DEFAULT_OPTIONS } from '@angular/material/form-field'
import { MatIconRegistry } from '@angular/material/icon'
import { TitleStrategy, provideRouter, withComponentInputBinding, withInMemoryScrolling } from '@angular/router'
import { TranslateService, provideTranslateService } from '@ngx-translate/core'
import { provideTranslateHttpLoader } from '@ngx-translate/http-loader'
import { provideKeycloak } from 'keycloak-angular'
import { firstValueFrom } from 'rxjs'
import { environment } from '../environments/environment'
import { routes } from './app.routes'
import { TranslatedTitleStrategy } from './app.title'
import { authInterceptor } from './identity'
import { APP_SETTINGS } from './shared/util/settings'

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(
      routes,
      withComponentInputBinding(),
      withInMemoryScrolling({ scrollPositionRestoration: 'top', anchorScrolling: 'enabled' }),
    ),
    { provide: TitleStrategy, useClass: TranslatedTitleStrategy },
    provideHttpClient(withInterceptors([authInterceptor])),
    // "Check" mode: a returning signed-in user is recognised, nobody is forced to sign in to browse (spec 4.1). If
    // Keycloak cannot be reached the app still starts, as a visitor.
    provideKeycloak({
      config: environment.keycloak,
      initOptions: {
        onLoad: 'check-sso',
        pkceMethod: 'S256',
        silentCheckSsoRedirectUri: `${window.location.origin}/silent-check-sso.html`,
        checkLoginIframe: false,
      },
    }),
    // All text is in translation files (spec 7); other languages fall back to English
    provideTranslateService({
      loader: provideTranslateHttpLoader({ prefix: '/i18n/', suffix: '.json' }),
      fallbackLang: 'en',
      lang: 'en',
    }),
    provideAppInitializer(() => firstValueFrom(inject(TranslateService).use('en'))),
    // index.html loads the Material Symbols font; <mat-icon> defaults to the older Material Icons font
    provideAppInitializer(() => {
      inject(MatIconRegistry).setDefaultFontSetClass('material-symbols-outlined')
    }),
    // White theme: outlined form fields rather than grey filled ones
    { provide: MAT_FORM_FIELD_DEFAULT_OPTIONS, useValue: { appearance: 'outline' } },
    {
      provide: APP_SETTINGS,
      useValue: {
        changeCutoffMinutes: environment.changeCutoffMinutes,
        noShowGraceMinutes: environment.noShowGraceMinutes,
      },
    },
  ],
}
