import { ChangeDetectionStrategy, Component, input } from '@angular/core'
import { MatIcon } from '@angular/material/icon'
import { TranslatePipe } from '@ngx-translate/core'
import { ZoneNamePipe } from './format.pipes'

/** Names the branch's time zone wherever times are shown (spec 4.4). */
@Component({
  selector: 'app-zone-note',
  imports: [MatIcon, TranslatePipe, ZoneNamePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p class="zone">
      <mat-icon aria-hidden="true" inline>schedule</mat-icon>
      {{ 'common.timesIn' | translate: { zone: timeZone() | zoneName } }}
    </p>
  `,
  styles: `
    .zone {
      display: flex;
      align-items: center;
      gap: 0.375rem;
      margin: 0 0 1rem;
      font: var(--mat-sys-body-small);
      color: var(--mat-sys-on-surface-variant);
    }
  `,
})
export class ZoneNote {
  readonly timeZone = input.required<string>()
}
