import { Injectable, inject } from '@angular/core'
import { Title } from '@angular/platform-browser'
import { TitleStrategy, type RouterStateSnapshot } from '@angular/router'
import { TranslateService } from '@ngx-translate/core'

/** Route titles are translation keys; the page title is "<page> · <app name>". */
@Injectable()
export class TranslatedTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title)
  private readonly translate = inject(TranslateService)

  override updateTitle(snapshot: RouterStateSnapshot): void {
    const key = this.buildTitle(snapshot)
    const app = this.translate.instant('app.name') as string
    const page = key ? (this.translate.instant(key) as string) : app
    this.title.setTitle(page === app ? app : `${page} · ${app}`)
  }
}
