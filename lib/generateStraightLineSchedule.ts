import { startOfMonth, endOfMonth, addMonths, format, isBefore, isAfter } from 'date-fns'

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
  let currentDate = startOfMonth(serviceStart)
  let cumulativeAmount = 0
  
  // Calculate the number of months in the service period
  const months: Date[] = []
  while (!isAfter(currentDate, endOfMonth(serviceEnd))) {
    months.push(new Date(currentDate))
    currentDate = addMonths(currentDate, 1)
  }
  
  if (months.length === 0) {
    throw new Error('Invalid date range: no complete months found')
  }
  
  // Calculate monthly amount (straight-line allocation)
  const monthlyAmount = Math.round((totalAmount / months.length) * 100) / 100
  
  // Handle rounding differences
  let remainingAmount = totalAmount
  
  months.forEach((month, index) => {
    const isLastMonth = index === months.length - 1
    
    // For the last month, use the remaining amount to handle rounding
    const entryAmount = isLastMonth ? remainingAmount : monthlyAmount
    
    cumulativeAmount += entryAmount
    remainingAmount -= entryAmount
    
    entries.push({
      period: format(month, 'yyyy-MM-dd'),
      amount: Math.round(entryAmount * 100) / 100,
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