import { IconTrendingDown, IconTrendingUp, IconCalendar, IconCurrencyDollar } from "@tabler/icons-react"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

interface SectionCardsProps {
  schedules: Array<{
    id: string
    type: string
    vendor: string
    invoice_date: string
    total_amount: number
    service_start: string
    service_end: string
    description: string
    created_at: string
  }>
  currency?: string
  currencySymbol?: string
}

export function SectionCards({ schedules, currency = 'USD', currencySymbol = '$' }: SectionCardsProps) {
  // Calculate metrics from schedules
  const totalSchedules = schedules.length
  const totalAmount = schedules.reduce((sum, schedule) => sum + Number(schedule.total_amount), 0)
  const prepaidExpenses = schedules.filter(s => s.type === 'prepayment')
  const unearnedRevenue = schedules.filter(s => s.type === 'unearned')
  const prepaidAmount = prepaidExpenses.reduce((sum, schedule) => sum + Number(schedule.total_amount), 0)
  const unearnedAmount = unearnedRevenue.reduce((sum, schedule) => sum + Number(schedule.total_amount), 0)

  // Calculate this month's schedules
  const thisMonth = new Date().toISOString().slice(0, 7) // YYYY-MM format
  const thisMonthSchedules = schedules.filter(s => s.created_at.startsWith(thisMonth))
  const monthlyGrowth = totalSchedules > 0 ? (thisMonthSchedules.length / totalSchedules) * 100 : 0

  return (
    <div className="*:data-[slot=card]:bg-white dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Total Schedules</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {totalSchedules}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <IconCalendar className="size-3" />
              Active
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Total created schedules <IconCalendar className="size-4" />
          </div>
          <div className="text-muted-foreground">
            Across all time periods
          </div>
        </CardFooter>
      </Card>

      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Total Amount Managed</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {currencySymbol}{totalAmount.toLocaleString('en-US', { maximumFractionDigits: 0 })}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <IconCurrencyDollar className="size-3" />
              {currency}
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Combined prepaid & unearned <IconCurrencyDollar className="size-4" />
          </div>
          <div className="text-muted-foreground">
            Total value under management
          </div>
        </CardFooter>
      </Card>

      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Prepaid Expenses</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {currencySymbol}{prepaidAmount.toLocaleString('en-US', { maximumFractionDigits: 0 })}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <IconTrendingUp className="size-3" />
              {prepaidExpenses.length} schedules
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Prepaid expense schedules <IconTrendingUp className="size-4" />
          </div>
          <div className="text-muted-foreground">
            {prepaidExpenses.length} active schedule{prepaidExpenses.length !== 1 ? 's' : ''}
          </div>
        </CardFooter>
      </Card>

      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Unearned Revenue</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {currencySymbol}{unearnedAmount.toLocaleString('en-US', { maximumFractionDigits: 0 })}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <IconTrendingUp className="size-3" />
              {unearnedRevenue.length} schedules
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Unearned revenue schedules <IconTrendingUp className="size-4" />
          </div>
          <div className="text-muted-foreground">
            {unearnedRevenue.length} active schedule{unearnedRevenue.length !== 1 ? 's' : ''}
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}
