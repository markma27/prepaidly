"use client"

import * as React from "react"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts"
import { useTheme } from "next-themes"

import { useIsMobile } from "@/hooks/use-mobile"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"

interface ChartAreaInteractiveProps {
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

const chartConfig = {
  prepaid_balance: {
    label: "Prepaid Expense Balance",
    color: "#60a5fa",
  },
  unearned_balance: {
    label: "Unearned Revenue Balance", 
    color: "#4ade80",
  },
} satisfies ChartConfig

export function ChartAreaInteractive({ schedules, currency = 'USD', currencySymbol = '$' }: ChartAreaInteractiveProps) {
  const isMobile = useIsMobile()
  const { theme, resolvedTheme } = useTheme()
  
  // Get the appropriate colors based on theme
  const isDark = resolvedTheme === 'dark'
  const axisTextColor = isDark ? '#ffffff' : '#000000'
  const gridColor = isDark ? '#374151' : '#e5e7eb'

  // Process schedule data to create monthly balance projections
  const processMonthlyBalances = () => {
    const now = new Date()
    const monthlyData = []

    // Generate next 12 months
    for (let i = 0; i < 12; i++) {
      const projectionDate = new Date(now.getFullYear(), now.getMonth() + i, 1)
      const monthName = projectionDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })

      let prepaidBalance = 0
      let unearnedBalance = 0

      // Calculate balances for each schedule
      schedules.forEach(schedule => {
        const scheduleStart = new Date(schedule.service_start)
        const scheduleEnd = new Date(schedule.service_end)
        const totalAmount = Number(schedule.total_amount)
        
        // Check if this schedule is active during the projection month
        // Compare year and month only, not specific dates
        const projectionYear = projectionDate.getFullYear()
        const projectionMonth = projectionDate.getMonth()
        const startYear = scheduleStart.getFullYear()
        const startMonth = scheduleStart.getMonth()
        const endYear = scheduleEnd.getFullYear()
        const endMonth = scheduleEnd.getMonth()
        
        const projectionYearMonth = projectionYear * 12 + projectionMonth
        const startYearMonth = startYear * 12 + startMonth
        const endYearMonth = endYear * 12 + endMonth
        
        if (projectionYearMonth >= startYearMonth && projectionYearMonth <= endYearMonth) {
          // Calculate how many months have passed since start
          const monthsSinceStart = projectionYearMonth - startYearMonth
          
          // Calculate total months in schedule
          const totalMonths = endYearMonth - startYearMonth + 1
          
          // Calculate monthly amortization
          const monthlyAmount = totalAmount / totalMonths
          
          // Calculate remaining balance (total - already amortized)
          const amortizedAmount = monthsSinceStart * monthlyAmount
          const remainingBalance = Math.max(0, totalAmount - amortizedAmount)
          
          if (schedule.type === 'prepayment') {
            prepaidBalance += remainingBalance
          } else if (schedule.type === 'unearned') {
            unearnedBalance += remainingBalance
          }
        }
      })

      monthlyData.push({
        month: monthName,
        prepaid_balance: Math.round(prepaidBalance * 100) / 100,
        unearned_balance: Math.round(unearnedBalance * 100) / 100,
      })
    }

    return monthlyData
  }

  const monthlyData = processMonthlyBalances()
  const hasPrepaidData = monthlyData.some(d => d.prepaid_balance > 0)
  const hasUnearnedData = monthlyData.some(d => d.unearned_balance > 0)

  return (
    <div className="*:data-[slot=card]:bg-white dark:*:data-[slot=card]:bg-card grid gap-6 lg:grid-cols-2 px-4 *:data-[slot=card]:shadow-xs lg:px-6">
      {/* Prepaid Expenses Chart */}
      <Card className="@container/card">
        <CardHeader>
          <CardTitle>Prepaid Expenses - Next 12 Months</CardTitle>
          <CardDescription>
            Remaining prepaid expense balances by month
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0 pl-1 pr-2 pb-2">
          {hasPrepaidData ? (
            <div className="h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={monthlyData}
                  margin={{
                    top: 0,
                    right: 5,
                    left: 0,
                    bottom: 20,
                  }}
                  barCategoryGap="10%"
                >
                  <defs>
                    <linearGradient id="prepaidGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.8}/>
                      <stop offset="100%" stopColor="#60a5fa" stopOpacity={0.4}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
                  <XAxis 
                    dataKey="month" 
                    tick={{ fontSize: 9, fill: axisTextColor }}
                    tickLine={false}
                    axisLine={false}
                    angle={0}
                    textAnchor="middle"
                    height={20}
                    interval={0}
                  />
                  <YAxis 
                    tick={{ fontSize: 8, fill: axisTextColor }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => {
                      if (value >= 1000000) {
                        return `${currencySymbol}${(value / 1000000).toFixed(1)}M`
                      } else if (value >= 1000) {
                        return `${currencySymbol}${(value / 1000).toFixed(0)}K`
                      }
                      return `${currencySymbol}${value.toLocaleString()}`
                    }}
                    width={45}
                  />
                  <Bar 
                    dataKey="prepaid_balance" 
                    fill="url(#prepaidGradient)"
                    radius={[4, 4, 0, 0]}
                  />
                  <Tooltip
                    formatter={(value: any, name: any) => {
                      return [`${currencySymbol}${Number(value).toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 'Remaining Balance']
                    }}
                    labelFormatter={(label: any) => label}
                    contentStyle={{
                      backgroundColor: isDark ? 'rgba(39, 39, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
                      color: isDark ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.9)',
                      border: isDark ? '1px solid rgba(255, 255, 255, 0.2)' : '1px solid rgba(0, 0, 0, 0.2)',
                      borderRadius: '8px',
                      boxShadow: isDark ? '0 8px 32px rgba(0, 0, 0, 0.6)' : '0 8px 32px rgba(0, 0, 0, 0.15)',
                      fontSize: '12px',
                      fontWeight: '500',
                      padding: '8px 12px',
                      backdropFilter: 'blur(8px)'
                    }}
                    cursor={false}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex h-[300px] items-center justify-center text-muted-foreground">
              <div className="text-center">
                <div className="text-lg font-medium mb-2">No prepaid expenses</div>
                <div className="text-sm">Create a prepaid expense schedule to see projections</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Unearned Revenue Chart */}
      <Card className="@container/card">
        <CardHeader>
          <CardTitle>Unearned Revenue - Next 12 Months</CardTitle>
          <CardDescription>
            Remaining unearned revenue balances by month
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0 pl-1 pr-2 pb-2">
          {hasUnearnedData ? (
            <div className="h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={monthlyData}
                  margin={{
                    top: 0,
                    right: 5,
                    left: 0,
                    bottom: 20,
                  }}
                  barCategoryGap="10%"
                >
                  <defs>
                    <linearGradient id="unearnedGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#22c55e" stopOpacity={0.8}/>
                      <stop offset="100%" stopColor="#4ade80" stopOpacity={0.4}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
                  <XAxis 
                    dataKey="month" 
                    tick={{ fontSize: 9, fill: axisTextColor }}
                    tickLine={false}
                    axisLine={false}
                    angle={0}
                    textAnchor="middle"
                    height={20}
                    interval={0}
                  />
                  <YAxis 
                    tick={{ fontSize: 8, fill: axisTextColor }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => {
                      if (value >= 1000000) {
                        return `${currencySymbol}${(value / 1000000).toFixed(1)}M`
                      } else if (value >= 1000) {
                        return `${currencySymbol}${(value / 1000).toFixed(0)}K`
                      }
                      return `${currencySymbol}${value.toLocaleString()}`
                    }}
                    width={45}
                  />
                  <Bar 
                    dataKey="unearned_balance" 
                    fill="url(#unearnedGradient)"
                    radius={[4, 4, 0, 0]}
                  />
                  <Tooltip
                    formatter={(value: any, name: any) => {
                      return [`${currencySymbol}${Number(value).toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 'Remaining Balance']
                    }}
                    labelFormatter={(label: any) => label}
                    contentStyle={{
                      backgroundColor: isDark ? 'rgba(39, 39, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
                      color: isDark ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.9)',
                      border: isDark ? '1px solid rgba(255, 255, 255, 0.2)' : '1px solid rgba(0, 0, 0, 0.2)',
                      borderRadius: '8px',
                      boxShadow: isDark ? '0 8px 32px rgba(0, 0, 0, 0.6)' : '0 8px 32px rgba(0, 0, 0, 0.15)',
                      fontSize: '12px',
                      fontWeight: '500',
                      padding: '8px 12px',
                      backdropFilter: 'blur(8px)'
                    }}
                    cursor={false}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex h-[300px] items-center justify-center text-muted-foreground">
              <div className="text-center">
                <div className="text-lg font-medium mb-2">No unearned revenue</div>
                <div className="text-sm">Create an unearned revenue schedule to see projections</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
