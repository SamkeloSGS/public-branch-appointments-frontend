import { ChangeDetectionStrategy, Component, input, output } from '@angular/core'
import { MatActionList, MatListItem, MatListItemLine, MatListItemTitle } from '@angular/material/list'
import { TranslatePipe } from '@ngx-translate/core'
import { displayName, type CustomerSummary } from '../model/customer'

/** Customer search results for staff; choosing one emits its ID. */
@Component({
  selector: 'app-customer-results',
  imports: [MatActionList, MatListItem, MatListItemLine, MatListItemTitle, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mat-action-list [attr.aria-label]="label()">
      @for (customer of customers(); track customer.id) {
        <button
          mat-list-item
          type="button"
          [activated]="customer.id === selected()"
          [attr.aria-current]="customer.id === selected() ? 'true' : null"
          (click)="choose.emit(customer.id)"
        >
          <span matListItemTitle>
            {{ name(customer) ?? ('admin.customers.erased' | translate) }}
            @if (customer.status !== 'ACTIVE') {
              <span class="status">· {{ 'admin.customers.statuses.' + customer.status | translate }}</span>
            }
          </span>
          <span matListItemLine>{{ contact(customer) }}</span>
        </button>
      }
    </mat-action-list>
  `,
  styles: `
    .status {
      color: var(--mat-sys-error);
      font-weight: 400;
    }
  `,
})
export class CustomerResults {
  readonly customers = input.required<readonly CustomerSummary[]>()
  readonly label = input.required<string>()
  readonly selected = input<string>()
  readonly choose = output<string>()

  protected readonly name = displayName

  protected contact(customer: CustomerSummary): string {
    return [customer.email, customer.phone].filter(Boolean).join(' · ')
  }
}
