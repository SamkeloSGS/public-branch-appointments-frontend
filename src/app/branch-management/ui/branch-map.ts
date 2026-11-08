import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core'
import { MatAnchor } from '@angular/material/button'
import { MatIcon } from '@angular/material/icon'
import { DomSanitizer } from '@angular/platform-browser'
import { TranslatePipe } from '@ngx-translate/core'
import { directionsUrl, mapEmbedUrl, type MapLocation } from '../model/branch'

/** The branch on an OpenStreetMap map, with a link for directions. */
@Component({
  selector: 'app-branch-map',
  imports: [MatAnchor, MatIcon, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="frame">
      <iframe
        [src]="embedUrl()"
        [title]="'branchManagement.map.title' | translate: { branch: name() }"
        loading="lazy"
        referrerpolicy="no-referrer"
      ></iframe>
    </div>
    <a mat-button [href]="directions()" target="_blank" rel="noopener">
      <mat-icon aria-hidden="true">directions</mat-icon>
      {{ 'branchManagement.map.directions' | translate }}
    </a>
  `,
  styles: `
    :host {
      display: grid;
      grid-template-rows: 1fr auto;
      gap: 0.5rem;
      justify-items: start;
    }
    /* Fills the height it is given (e.g. to match a card beside it), and is never shorter than 14rem */
    .frame {
      width: 100%;
      height: 100%;
      min-height: 14rem;
      border-radius: var(--mat-sys-corner-medium);
      overflow: hidden;
      border: 1px solid var(--mat-sys-outline-variant);
    }
    iframe {
      width: 100%;
      height: 100%;
      border: 0;
      display: block;
    }
  `,
})
export class BranchMap {
  readonly location = input.required<MapLocation>()
  /** The branch's name, for the map's accessible title */
  readonly name = input.required<string>()

  private readonly sanitizer = inject(DomSanitizer)
  // A fixed OpenStreetMap address built from two numbers, so it is safe to trust as a resource URL
  protected readonly embedUrl = computed(() =>
    this.sanitizer.bypassSecurityTrustResourceUrl(mapEmbedUrl(this.location())),
  )
  protected readonly directions = computed(() => directionsUrl(this.location()))
}
