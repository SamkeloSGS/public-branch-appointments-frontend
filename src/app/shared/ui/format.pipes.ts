import { Pipe, inject, type PipeTransform } from '@angular/core'
import { TranslateService } from '@ngx-translate/core'
import { formatDate, formatInstant, formatMonth, formatTime, zoneName } from '../util/format'

// Display formatting for templates. Branch-local dates and times are shown as given (they are already in the
// branch's zone); instants are shown in a named zone, never the browser's (spec 4.4, FE-16).

/** The formatting locale for a UI language; English uses South African conventions, like the branches. */
export function formattingLocale(language: string | null | undefined): string {
  return !language || language === 'en' ? 'en-ZA' : `${language}-ZA`
}

function useLocale(): () => string {
  const translate = inject(TranslateService)
  return () => formattingLocale(translate.getCurrentLang())
}

@Pipe({ name: 'localDate' })
export class LocalDatePipe implements PipeTransform {
  private readonly locale = useLocale()
  transform(date: string | null | undefined, style: 'long' | 'medium' | 'short' = 'long'): string {
    return date ? formatDate(date, this.locale(), style) : ''
  }
}

@Pipe({ name: 'localMonth' })
export class LocalMonthPipe implements PipeTransform {
  private readonly locale = useLocale()
  transform(date: string | null | undefined): string {
    return date ? formatMonth(date, this.locale()) : ''
  }
}

@Pipe({ name: 'localTime' })
export class LocalTimePipe implements PipeTransform {
  private readonly locale = useLocale()
  transform(time: string | null | undefined): string {
    return time ? formatTime(time, this.locale()) : ''
  }
}

@Pipe({ name: 'instantIn' })
export class InstantInPipe implements PipeTransform {
  private readonly locale = useLocale()
  transform(instant: string | null | undefined, timeZone: string): string {
    return instant ? formatInstant(instant, timeZone, this.locale()) : ''
  }
}

@Pipe({ name: 'zoneName' })
export class ZoneNamePipe implements PipeTransform {
  private readonly locale = useLocale()
  transform(timeZone: string | null | undefined): string {
    return timeZone ? zoneName(timeZone, this.locale()) : ''
  }
}
