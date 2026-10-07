/** Google's Books quota resets at midnight Pacific time, so the budget counts Pacific days ("2026-10-07"). */
export function pacificDay(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}
