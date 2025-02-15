import {
  isBoolean,
  isNumber,
  isString,
  isUndefined,
  round,
} from 'lodash-es'
import { DateTime } from 'luxon'

const dateFormatInput = 'yyyy-MM-dd HH:mm:ss'
const dateFormat = 'MMM dd, yyyy'

export default { DateTime }
type EgDateInput = string | number | Date
type EgDateInputFormat = string | boolean | Date
const units = [
  'year',
  'month',
  'week',
  'day',
  'hour',
  'minute',
  'second',
] as const

export function getPrevMonthsDateInArray(month: number, year: number, months = 12, skipCurrent = false) {
  let d = DateTime.fromObject({
    year,
    month,
    day: 1,
    hour: 12,
    minute: 0,
    second: 0,
  })

  if (skipCurrent) {
    d = d.minus({ month: 1 })
  }

  return Array.from({ length: months }, (_, i) => {
    // const date = new Date(currentDate)
    const dd = d.minus({ months: i })
    return {
      month: dd.month,
      year: dd.year,
    }
  })
}

export function getPrevious12MonthsDateInArrayFromDate(date: Date) {
  return getPrevious12MonthsDateInArray(date.getMonth() + 1, date.getFullYear())
}

export function getPrevious12MonthsDateInArray(month: number, year: number) {
  const d = DateTime.fromObject({
    year,
    month,
    day: 1,
  })

  return Array.from({ length: 12 }, (_, i) => {
    return {
      isCurrent: (i + 1) === month,
      month: i + 1,
      year: month - i < 1 ? year - 1 : year,
      date: d.set({
        month: i + 1,
        year: month - i < 1 ? year - 1 : year,
      }).toUTC(0, { keepLocalTime: true }),
    }
  })

  // return Array.from({ length: 12 }, (_, i) => {
  //   const dd = d.minus({ months: i })
  //   return {
  //     isCurrent: currentDate().month === dd.month && currentDate().year === dd.year,
  //     month: dd.month,
  //     year: dd.year,
  //     date: dd,
  //   }
  // })
}

export function currentDate() {
  return DateTime.now()
}

export function parseDate(date?: EgDateInput, format?: EgDateInputFormat): DateTime {
  if (isUndefined(date)) {
    return DateTime.now()
  }

  if (isString(date)) {
    if (isBoolean(format) && format) {
      return DateTime.fromFormat(date, dateFormatInput)
    }
    else if (isString(format) && format.toLowerCase() === 'iso') {
      return DateTime.fromISO(date)
    }
    else if (isString(format)) {
      return DateTime.fromFormat(date, format)
    }
  }

  if (date instanceof Date) {
    return DateTime.fromJSDate(date)
  }

  if (isNumber(date)) {
    return DateTime.fromMillis(date)
  }

  // as a last resort, parse date by converting js date to JS Date and try again
  return DateTime.fromJSDate(new Date(date))
}

export function monthDiff(dateFrom: Date, dateTo: Date) {
  return dateTo.getMonth() - dateFrom.getMonth() + (12 * (dateTo.getFullYear() - dateFrom.getFullYear()))
}

export function formatTime(date: EgDateInput, format?: EgDateInputFormat) {
  const dateTime = parseDate(date)

  return dateTime.toFormat(isString(format) ? format : dateFormat)
}

export function timeAgo(date: EgDateInput, format?: EgDateInputFormat) {
  const dateTime = parseDate(date, format)
  const diff = dateTime.diffNow().shiftTo(...units)
  const unit = units.find(unit => diff.get(unit) !== 0) || 'second'
  const relativeFormatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

  return relativeFormatter.format(Math.trunc(diff.as(unit)), unit)
}

export function diffInMins(presentTime: string, pastTime: string, showMillis = false) {
  const d1 = parseDate(presentTime)
  const d2 = parseDate(pastTime)
  const d = d1.diff(d2)

  // const m = Math.abs(Math.floor(d.as('minutes')))
  // const s = Math.abs(round(d.as('seconds') % 60, 5))

  // return `${(m > 0 ? `${m}m ` : '') + s}s`
  const diff = d.shiftTo('minute', 'seconds', 'milliseconds')
    .toObject()

  if (diff.minutes && diff.minutes > 0) {
    return `${diff.minutes}m${(diff.seconds && diff.seconds !== 0) ? ` ${diff.seconds}s` : ''}`.replaceAll(/[+-]/gm, '')
  }

  if (showMillis && diff.milliseconds && diff.milliseconds !== 0) {
    return `${diff.seconds ?? 0}.${round(diff.milliseconds ?? 0, 3)}s`.replaceAll(/[+-]/gm, '')
  }

  return `${diff.seconds ?? 0}s`.replaceAll(/[+-]/gm, '')
}
