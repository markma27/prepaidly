import { startOfMonth, endOfMonth, addMonths, format, isBefore, isAfter, differenceInDays } from 'date-fns'

export interface ScheduleEntry {
  period: string // ISO date string (YYYY-MM-DD)
  amount: number
  cumulative: number
  remaining: number
}

export interface ScheduleGenerationParams {
  serviceStart: Date
  serviceEnd: Date
  totalAmount: number
}

/**
 * Generates a straight-line amortization schedule for prepayments or unearned revenue
 * @param params - The schedule generation parameters
 * @returns Array of schedule entries with period, amount, cumulative, and remaining values
 */
export function generateStraightLineSchedule(params: ScheduleGenerationParams): ScheduleEntry[] {
  const { serviceStart, serviceEnd, totalAmount } = params
  
  if (isAfter(serviceStart, serviceEnd)) {
    throw new Error('Service start date must be before or equal to service end date')
  }
  
  if (totalAmount <= 0) {
    throw new Error('Total amount must be greater than zero')
  }
  
  const entries: ScheduleEntry[] = []
  let cumulativeAmount = 0
  
  // Calculate total days in the service period for partial month calculations
  const totalDays = differenceInDays(serviceEnd, serviceStart) + 1
  const dailyRate = totalAmount / totalDays
  
  // First pass: determine all periods and identify partial vs full months
  const periods: { monthStart: Date; isPartial: boolean; days: number }[] = []
  let currentMonth = startOfMonth(serviceStart)
  
  while (!isAfter(currentMonth, endOfMonth(serviceEnd))) {
    const monthStart = new Date(currentMonth)
    const monthEnd = endOfMonth(currentMonth)
    
    // Determine the actual start and end dates for this month within the service period
    const periodStart = isBefore(serviceStart, monthStart) ? monthStart : serviceStart
    const periodEnd = isAfter(serviceEnd, monthEnd) ? monthEnd : serviceEnd
    
    // Calculate days in this month that fall within the service period
    const daysInPeriod = differenceInDays(periodEnd, periodStart) + 1
    const daysInMonth = differenceInDays(monthEnd, monthStart) + 1
    const isPartial = daysInPeriod < daysInMonth
    
    periods.push({
      monthStart,
      isPartial,
      days: daysInPeriod
    })
    
    currentMonth = addMonths(currentMonth, 1)
  }
  
  // Calculate amounts: partial months use daily rate, full months get equal share of remainder
  let totalPartialAmount = 0
  let fullMonthCount = 0
  
  periods.forEach(period => {
    if (period.isPartial) {
      totalPartialAmount += dailyRate * period.days
    } else {
      fullMonthCount++
    }
  })
  
  // Amount for each full month: divide remaining amount equally among full months
  const remainingAmountForFullMonths = totalAmount - totalPartialAmount
  const fullMonthAmount = fullMonthCount > 0 
    ? Math.round((remainingAmountForFullMonths / fullMonthCount) * 100) / 100
    : 0
  
  // Generate the schedule entries
  let remainingAmount = totalAmount
  
  periods.forEach((period, index) => {
    const isLastMonth = index === periods.length - 1
    let monthlyAmount: number
    
    if (isLastMonth) {
      // Last month gets the remaining amount to handle rounding
      monthlyAmount = remainingAmount
    } else if (period.isPartial) {
      // Partial months use daily rate
      monthlyAmount = Math.round((dailyRate * period.days) * 100) / 100
    } else {
      // Full months use the calculated full month amount
      monthlyAmount = fullMonthAmount
    }
    
    cumulativeAmount += monthlyAmount
    remainingAmount -= monthlyAmount
    
    entries.push({
      period: format(period.monthStart, 'yyyy-MM-dd'),
      amount: Math.round(monthlyAmount * 100) / 100,
      cumulative: Math.round(cumulativeAmount * 100) / 100,
      remaining: Math.round(remainingAmount * 100) / 100,
    })
  })
  
  return entries
}

/**
 * Validates schedule generation parameters
 */
export function validateScheduleParams(params: Partial<ScheduleGenerationParams>): params is ScheduleGenerationParams {
  return !!(
    params.serviceStart &&
    params.serviceEnd &&
    typeof params.totalAmount === 'number' &&
    params.totalAmount > 0 &&
    !isAfter(params.serviceStart, params.serviceEnd)
  )
} 