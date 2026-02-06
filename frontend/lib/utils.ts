// Utility functions for Prepaidly frontend
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge Tailwind CSS classes
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format date to "DD MMM YYYY" (e.g. 01 Jun 2025)
 */
export function formatDate(dateString: string): string {
  const d = new Date(dateString);
  const day = String(d.getDate()).padStart(2, '0');
  const month = d.toLocaleString('en-US', { month: 'short' });
  const year = d.getFullYear();
  return `${day} ${month} ${year}`;
}

/**
 * Format currency to system locale
 */
export function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format date for input[type="date"]
 */
export function formatDateForInput(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get today's date in YYYY-MM-DD format
 */
export function getTodayDate(): string {
  return formatDateForInput(new Date());
}

/**
 * Add months to a date
 */
export function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

/**
 * Validate date range
 */
export function validateDateRange(startDate: string, endDate: string): {
  valid: boolean;
  error?: string;
} {
  if (!startDate || !endDate) {
    return { valid: false, error: 'Please select both start date and end date' };
  }

  const start = new Date(startDate);
  const end = new Date(endDate);

  if (start >= end) {
    return { valid: false, error: 'End date must be after start date' };
  }

  // Check if range is at least one month
  const monthsDiff = (end.getFullYear() - start.getFullYear()) * 12 + 
                     (end.getMonth() - start.getMonth());
  
  if (monthsDiff < 1) {
    return { valid: false, error: 'Schedule must span at least one month' };
  }

  return { valid: true };
}

/**
 * Calculate number of months between two dates
 */
export function monthsBetween(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  const months = (end.getFullYear() - start.getFullYear()) * 12 + 
                 (end.getMonth() - start.getMonth()) + 1;
  
  return Math.max(1, months);
}

/**
 * Generate pro-rata amortisation schedule entries.
 * 
 * Each period's amount is proportional to the number of days in that period
 * relative to the total days. Posting dates are the last day of each period
 * (month-end or schedule end date).
 * 
 * Example: Start 6 Feb, End 5 Aug, Total $6,000 (181 days)
 *   Period 1: 6 Feb – 28 Feb (23 days) → $762.43, posted 28 Feb
 *   Period 2: 1 Mar – 31 Mar (31 days) → $1,027.62, posted 31 Mar
 *   ...
 *   Last period: remainder, posted on end date
 */
export interface ProRataEntry {
  period: number;
  periodStart: Date;
  periodEnd: Date;
  days: number;
  amount: number;
}

export function generateProRataSchedule(
  startDateStr: string,
  endDateStr: string,
  totalAmount: number
): ProRataEntry[] {
  const startDate = new Date(startDateStr);
  const endDate = new Date(endDateStr);
  
  // Calculate total days (inclusive)
  const totalDays = Math.round(
    (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
  ) + 1;
  
  if (totalDays <= 0) return [];
  
  const entries: ProRataEntry[] = [];
  let periodStart = new Date(startDate);
  let remaining = totalAmount;
  let periodNumber = 0;
  
  while (periodStart <= endDate) {
    periodNumber++;
    
    // Last day of current month
    const lastDayOfMonth = new Date(
      periodStart.getFullYear(),
      periodStart.getMonth() + 1,
      0
    );
    
    // For day counting, cap at schedule end date
    const dayCountEnd = lastDayOfMonth < endDate ? lastDayOfMonth : new Date(endDate);
    
    // Days in this period (inclusive)
    const daysInPeriod = Math.round(
      (dayCountEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)
    ) + 1;
    
    // Posting date is always the last day of the month
    const postingDate = new Date(lastDayOfMonth);
    
    // Next period start
    const nextPeriodStart = new Date(dayCountEnd);
    nextPeriodStart.setDate(nextPeriodStart.getDate() + 1);
    const isLastPeriod = nextPeriodStart > endDate;
    
    // Calculate amount: pro-rata based on days, last entry gets remainder
    let amount: number;
    if (isLastPeriod) {
      amount = Math.round(remaining * 100) / 100;
    } else {
      amount = Math.round((totalAmount * daysInPeriod / totalDays) * 100) / 100;
      remaining -= amount;
    }
    
    entries.push({
      period: periodNumber,
      periodStart: new Date(periodStart),
      periodEnd: postingDate,
      days: daysInPeriod,
      amount,
    });
    
    // Move to first day of next month
    periodStart = nextPeriodStart;
  }
  
  return entries;
}

/**
 * Count the number of journal entry periods for a pro-rata schedule
 */
export function countProRataPeriods(startDateStr: string, endDateStr: string): number {
  const startDate = new Date(startDateStr);
  const endDate = new Date(endDateStr);
  
  if (startDate >= endDate) return 0;
  
  let count = 0;
  let periodStart = new Date(startDate);
  
  while (periodStart <= endDate) {
    count++;
    const lastDayOfMonth = new Date(
      periodStart.getFullYear(),
      periodStart.getMonth() + 1,
      0
    );
    const periodEnd = lastDayOfMonth < endDate ? lastDayOfMonth : endDate;
    const nextPeriodStart = new Date(periodEnd);
    nextPeriodStart.setDate(nextPeriodStart.getDate() + 1);
    periodStart = nextPeriodStart;
  }
  
  return count;
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  
  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };
    
    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(later, wait);
  };
}

/**
 * Sleep utility for async operations
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

