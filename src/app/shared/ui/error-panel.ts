import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core'
import { MatButton } from '@angular/material/button'
import { MatIcon } from '@angular/material/icon'
import { TranslatePipe } from '@ngx-translate/core'
import { errorView } from '../util/error-view'
import type { ErrorMessages } from '../util/problem'
import { NotAllowed } from './not-allowed'

/**
 * A failed request: the "not allowed" state for a 403 (FE-3), otherwise the mapped message, with a retry option when
 * trying again may help (FE-15). Never an empty screen.
 */
@Component({
  selector: 'app-error-panel',
  imports: [MatButton, MatIcon, NotAllowed, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (view(); as view) {
      @if (view.forbidden) {
        <app-not-allowed />
      } @else {
        <div class="error" role="alert">
          <mat-icon aria-hidden="true">error</mat-icon>
          <div class="text">
            <p>{{ view.serverMessage ?? (view.messageKey | translate) }}</p>
            @if (view.fields) {
              <ul>
                @for (problem of view.fields; track $index) {
                  <li>
                    @if (problem.field) {
                      <strong>{{ problem.field }}</strong>:
                    }
                    {{ problem.message }}
                  </li>
                }
              </ul>
            }
          </div>
          @if (view.retryable) {
            <button mat-stroked-button type="button" (click)="retry.emit()">
              {{ 'common.retry' | translate }}
            </button>
          }
        </div>
      }
    }
  `,
  styles: `
    .error {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.75rem;
      padding: 0.75rem 1rem;
      margin: 0.5rem 0 1rem;
      border-radius: var(--mat-sys-corner-medium);
      background: var(--mat-sys-error-container);
      color: var(--mat-sys-on-error-container);
    }
    .text {
      flex: 1 1 12rem;
    }
    p {
      margin: 0;
    }
    ul {
      margin: 0.25rem 0 0;
      padding-left: 1.25rem;
    }
  `,
})
export class ErrorPanel {
  readonly error = input<unknown>()
  readonly messages = input<ErrorMessages>({})
  /** Show the server's detail for rejections without a code (staff screens) */
  readonly serverDetail = input(false)
  readonly retry = output()

  protected readonly view = computed(() => {
    const error = this.error()
    return error === undefined || error === null ? undefined : errorView(error, this.messages(), { serverDetail: this.serverDetail() })
  })
}
