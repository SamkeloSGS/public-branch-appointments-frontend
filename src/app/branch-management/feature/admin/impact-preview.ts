import { inject } from '@angular/core'
import { MatDialog } from '@angular/material/dialog'
import { TranslateService } from '@ngx-translate/core'
import { BookingAdminApi, impactNeedsConfirmation, type ImpactPreviewRequest } from '../../../booking'
import { confirmAction } from '../../../shared/ui/confirm-dialog'

/**
 * Before a calendar exception, capacity override or hours change is saved, booking previews what it would do. With
 * appointments displaced or intervals overbooked the admin must confirm, seeing the counts (spec 6, FE-11).
 * Resolves to whether saving may go ahead; a failed preview rejects, so nothing is saved unseen.
 */
export function useImpactPreview() {
  const booking = inject(BookingAdminApi)
  const dialog = inject(MatDialog)
  const translate = inject(TranslateService)

  return async function confirmImpact(request: ImpactPreviewRequest): Promise<boolean> {
    const impact = await booking.scheduleImpact(request)
    if (!impactNeedsConfirmation(impact)) return true
    const t = (key: string, params?: Record<string, unknown>) => translate.instant(key, params) as string
    return confirmAction(dialog, {
      title: t('admin.impact.title'),
      message: t('admin.impact.message', {
        displaced: impact.displacedAppointments,
        overbooked: impact.overbookedIntervals,
      }),
      confirmLabel: t('admin.impact.confirm'),
      cancelLabel: t('common.cancel'),
      destructive: true,
    })
  }
}
