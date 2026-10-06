import { router } from 'expo-router'
import { DateTime } from 'luxon'
import { Text, useWindowDimensions, View } from 'react-native'
import { BarChart } from 'react-native-gifted-charts'
import { Button } from '~/components/Button'
import { Card } from '~/components/Card'
import { ErrorState, Loading } from '~/components/EmptyState'
import { HBars } from '~/components/HBars'
import { Screen } from '~/components/Screen'
import { StatTile } from '~/components/StatTile'
import { BOOK_COLORS } from '~/constants/BookColors'
import { Colors } from '~/constants/Colors'
import { useLibraryStats } from '~/hooks/Stats'
import { useCan, useCurrentLibrary } from '~/library/LibraryProvider'
import { formatDate } from '~/utils/Dates'

/** Last 12 months, zero-filled, oldest first. */
function monthSeries(rows: { month: string, books: number }[]) {
  const start = DateTime.now().startOf('month').minus({ months: 11 })
  return Array.from({ length: 12 }, (_, i) => {
    const month = start.plus({ months: i })
    const key = month.toFormat('yyyy-MM')
    return { value: rows.find(r => r.month === key)?.books ?? 0, label: i % 3 === 0 ? month.toFormat('LLL') : '' }
  })
}

function Section({ title, children }: { title: string, children: React.ReactNode }) {
  return (
    <Card className="gap-4 py-4">
      <Text className="text-xl font-bold text-ink">{title}</Text>
      {children}
    </Card>
  )
}

export default function ReportsScreen() {
  const { library } = useCurrentLibrary()
  const stats = useLibraryStats(library.id)
  const canAudit = useCan('audits.run')
  const { width } = useWindowDimensions()
  const chartWidth = width - 40 - 32 - 30

  if (stats.isPending || stats.error) {
    return (
      <Screen tabs>
        <Text className="pt-3 text-3xl font-bold text-ink">Stats</Text>
        {stats.isPending ? <Loading /> : <ErrorState error={stats.error} onRetry={stats.refetch} />}
      </Screen>
    )
  }
  const s = stats.data
  const months = monthSeries(s.added_by_month)
  const last = s.audit.last
  const swatch = (name: string) => BOOK_COLORS.find(c => c.name === name)

  return (
    <Screen tabs refreshing={stats.isRefetching} onRefresh={stats.refetch}>
      <Text className="pt-3 text-3xl font-bold text-ink">Stats</Text>

      <View className="gap-3">
        <View className="flex-row gap-3">
          <StatTile label="Books" value={s.total} />
          <StatTile label="Authors" value={s.authors} />
          <StatTile label="Pages" value={s.pages.toLocaleString()} />
        </View>
        <View className="flex-row gap-3">
          <StatTile label="At home" value={s.by_status.on_shelf ?? 0} tone="positive" />
          <StatTile label="Borrowed" value={s.by_status.borrowed ?? 0} tone={s.loans.overdue ? 'warn' : 'ink'} />
          <StatTile label="Missing" value={s.by_status.missing ?? 0} tone={s.by_status.missing ? 'negative' : 'ink'} />
        </View>
        <View className="flex-row gap-3">
          <StatTile label="Late back" value={s.loans.overdue} tone={s.loans.overdue ? 'warn' : 'ink'} />
          <StatTile label="Given away" value={s.archived} />
        </View>
      </View>

      <Section title="📈 Books added this year">
        <BarChart
          data={months}
          width={chartWidth}
          height={150}
          barWidth={Math.max(8, chartWidth / 12 - 8)}
          spacing={6}
          initialSpacing={4}
          frontColor={Colors.primary}
          barBorderTopLeftRadius={4}
          barBorderTopRightRadius={4}
          noOfSections={3}
          yAxisThickness={0}
          xAxisColor={Colors.line}
          rulesColor={Colors.line}
          rulesType="solid"
          yAxisTextStyle={{ color: Colors.faint, fontSize: 11 }}
          xAxisLabelTextStyle={{ color: Colors.muted, fontSize: 11 }}
          isAnimated
        />
      </Section>

      {s.racks.length > 0 && (
        <Section title="📚 Books in each bookcase">
          <HBars bars={s.racks.map(r => ({ label: r.name, value: r.books }))} />
        </Section>
      )}

      {s.top_categories.length > 0 && (
        <Section title="🏷️ Favourite kinds of books">
          <HBars bars={s.top_categories.map(c => ({ label: c.name, value: c.books }))} />
        </Section>
      )}

      {s.top_authors.length > 0 && (
        <Section title="✍️ Favourite authors">
          <HBars bars={s.top_authors.map(a => ({ label: a.name, value: a.books }))} />
        </Section>
      )}

      {s.colors.length > 0 && (
        <Section title="🎨 Book colours">
          <HBars bars={s.colors.map(c => ({ label: swatch(c.color)?.label ?? c.color, value: c.books, color: swatch(c.color)?.swatch }))} />
        </Section>
      )}

      {s.decades.length > 0 && (
        <Section title="🕰️ When they were written">
          <HBars bars={s.decades.map(d => ({ label: `${d.decade}s`, value: d.books }))} />
        </Section>
      )}

      <Section title="✅ Book checks">
        {last
          ? (
              <Text className="text-base text-ink">
                Last check {formatDate(last.completed_at)}: {last.found} of {last.total} found
                {last.missing ? `, ${last.missing} missing` : ''}.
              </Text>
            )
          : <Text className="text-base text-muted">No book checks yet.</Text>}
        <Text className="text-sm text-muted">{`${s.audit.unseen_year} books haven't been checked in over a year.`}</Text>
        {canAudit && <Button variant="secondary" icon="check-square" label="Do a book check" onPress={() => router.push('/audit')} />}
      </Section>
    </Screen>
  )
}
