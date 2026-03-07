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
 * Format currency to system locale.
 * For dollar currencies (USD, AUD, NZD, CAD, etc.), just shows '$' without country prefix.
 */
export function formatCurrency(amount: number, currency: string = 'USD'): string {
  const upperCurrency = currency.toUpperCase();
  
  // Dollar currencies - format with plain '$' symbol
  const dollarCurrencies = ['USD', 'AUD', 'NZD', 'CAD', 'SGD', 'HKD', 'MXN'];
  if (dollarCurrencies.includes(upperCurrency)) {
    const formatted = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Math.abs(amount));
    const sign = amount < 0 ? '-' : '';
    return `${sign}$${formatted}`;
  }
  
  // Other currencies - use standard formatting
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: upperCurrency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Get currency symbol for a currency code.
 * All dollar currencies (USD, AUD, NZD, CAD, etc.) just show '$'
 */
export function getCurrencySymbol(currency: string = 'USD'): string {
  const symbols: Record<string, string> = {
    'USD': '$',
    'AUD': '$',
    'NZD': '$',
    'CAD': '$',
    'SGD': '$',
    'HKD': '$',
    'MXN': '$',
    'GBP': '£',
    'EUR': '€',
    'JPY': '¥',
    'CNY': '¥',
    'KRW': '₩',
    'INR': '₹',
    'ZAR': 'R',
    'CHF': 'CHF',
    'SEK': 'kr',
    'NOK': 'kr',
    'DKK': 'kr',
    'BRL': 'R$',
    'AED': 'د.إ',
    'SAR': '﷼',
    'THB': '฿',
    'MYR': 'RM',
    'PHP': '₱',
    'IDR': 'Rp',
  };
  return symbols[currency.toUpperCase()] || '$';
}

/**
 * Format currency for chart display (compact, e.g., "$10K")
 */
export function formatCurrencyCompact(amount: number, currency: string = 'USD'): string {
  const symbol = getCurrencySymbol(currency);
  if (amount >= 1000000) {
    return `${symbol}${(amount / 1000000).toFixed(1)}M`;
  } else if (amount >= 1000) {
    return `${symbol}${(amount / 1000).toFixed(0)}K`;
  }
  return `${symbol}${amount.toFixed(0)}`;
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
 * Format YYYY-MM-DD date as dd/mm/yyyy for display in inputs
 */
export function formatDateToDDMMYYYY(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('T')[0].split('-');
  if (parts.length !== 3) return dateStr;
  const [y, m, d] = parts;
  return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
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
 * Resolve End Date input to a YYYY-MM-DD date string.
 * Supports:
 * - "+1", "+2", "+N" — adds N months from start date
 * - Date strings (yyyy-mm-dd or dd/mm/yyyy)
 */
export function resolveEndDate(startDate: string, endDateInput: string): string | null {
  const trimmed = endDateInput.trim();
  if (!trimmed) return null;

  const plusMatch = trimmed.match(/^\+(\d+)$/);
  if (plusMatch) {
    const months = parseInt(plusMatch[1], 10);
    if (months < 1) return null;
    if (!startDate) return null;
    const start = new Date(startDate);
    if (isNaN(start.getTime())) return null;
    const end = addMonths(start, months);
    end.setDate(end.getDate() - 1); // minus one day
    return formatDateForInput(end);
  }

  // Parse as date — dd/mm/yyyy, dd/mm/yy, or yyyy-mm-dd
  const ddmmyy = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (ddmmyy) {
    const [, d, m, y] = ddmmyy;
    let year = parseInt(y, 10);
    if (year < 100) year = year >= 50 ? 1900 + year : 2000 + year;
    const date = new Date(year, parseInt(m, 10) - 1, parseInt(d, 10));
    if (!isNaN(date.getTime())) return formatDateForInput(date);
  }
  const yyyymmdd = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (yyyymmdd) {
    const [, y, m, d] = yyyymmdd;
    const date = new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10));
    if (!isNaN(date.getTime())) return formatDateForInput(date);
  }
  return null;
}

/**
 * Parse a date string (dd/mm/yyyy, dd/mm/yy, or yyyy-mm-dd) to YYYY-MM-DD.
 * Supports 2-digit years: 25 → 2025, 99 → 1999.
 * Returns null if the input is not a valid date.
 */
export function parseDateToYYYYMMDD(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  // dd/mm/yyyy or dd/mm/yy
  const ddmmyy = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (ddmmyy) {
    const [, d, m, y] = ddmmyy;
    let year = parseInt(y, 10);
    if (year < 100) year = year >= 50 ? 1900 + year : 2000 + year;
    const day = parseInt(d, 10);
    const month = parseInt(m, 10);
    const date = new Date(year, month - 1, day);
    if (
      !isNaN(date.getTime()) &&
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day
    ) {
      return formatDateForInput(date);
    }
  }
  // yyyy-mm-dd
  const yyyymmdd = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (yyyymmdd) {
    const [, y, m, d] = yyyymmdd;
    const year = parseInt(y, 10);
    const month = parseInt(m, 10);
    const day = parseInt(d, 10);
    const date = new Date(year, month - 1, day);
    if (
      !isNaN(date.getTime()) &&
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day
    ) {
      return formatDateForInput(date);
    }
  }
  return null;
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

  if (start > end) {
    return { valid: false, error: 'End date must be on or after start date' };
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
 * Generate equal-monthly amortisation schedule entries.
 *
 * - Total months N = full months + 1 when both start and end are partial (e.g. 6 periods → 5 months)
 * - First period: If partial, pro-rate by (days in period / days in month) * base amount
 * - Full months: Fixed amount = total / N
 * - Last period: Balance (ensures exact total, no rounding drift)
 */
export function generateEqualMonthlySchedule(
  startDateStr: string,
  endDateStr: string,
  totalAmount: number
): ProRataEntry[] {
  const startDate = new Date(startDateStr);
  const endDate = new Date(endDateStr);

  if (startDate >= endDate) return [];

  const entries: ProRataEntry[] = [];
  let periodNumber = 0;
  let allocated = 0;

  // First pass: build period structure (same as pro-rata)
  const periods: Array<{ periodStart: Date; periodEnd: Date; daysInPeriod: number; daysInMonth: number; isFirst: boolean; isLast: boolean; isFullMonth: boolean }> = [];
  let pStart = new Date(startDate);

  while (pStart <= endDate) {
    const lastDayOfMonth = new Date(pStart.getFullYear(), pStart.getMonth() + 1, 0);
    const dayCountEnd = lastDayOfMonth < endDate ? lastDayOfMonth : new Date(endDate);
    const daysInPeriod = Math.round((dayCountEnd.getTime() - pStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const daysInMonth = lastDayOfMonth.getDate();
    const nextStart = new Date(dayCountEnd);
    nextStart.setDate(nextStart.getDate() + 1);
    const isLast = nextStart > endDate;
    const isFirst = periods.length === 0;
    const isFullMonth = daysInPeriod === daysInMonth;

    periods.push({
      periodStart: new Date(pStart),
      periodEnd: new Date(lastDayOfMonth),
      daysInPeriod,
      daysInMonth,
      isFirst,
      isLast,
      isFullMonth,
    });
    pStart = nextStart;
  }

  // N = total months for base amount: full months + 1 when both start and end are partial
  const fullMonths = periods.filter((p) => p.isFullMonth).length;
  const firstPartial = periods[0]?.periodStart.getDate() !== 1;
  const lastPartial = periods.length > 0 && !periods[periods.length - 1].isFullMonth;
  const N = fullMonths + (firstPartial && lastPartial ? 1 : 0) || 1;
  const baseMonthlyAmount = totalAmount / N;

  periods.forEach((p) => {
    periodNumber++;
    let amount: number;

    if (p.isLast) {
      amount = Math.round((totalAmount - allocated) * 100) / 100;
    } else if (p.isFirst && firstPartial) {
      // First period is partial: pro-rate by days
      amount = Math.round((p.daysInPeriod / p.daysInMonth) * baseMonthlyAmount * 100) / 100;
    } else {
      amount = Math.round(baseMonthlyAmount * 100) / 100;
    }
    allocated += amount;

    entries.push({
      period: periodNumber,
      periodStart: p.periodStart,
      periodEnd: p.periodEnd,
      days: p.daysInPeriod,
      amount,
    });
  });

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

/**
 * Xero timezone to IANA timezone mapping
 * Xero returns timezones in format like "NEWZEALANDSTANDARDTIME", "USSTANDARDTIME"
 */
const XERO_TIMEZONE_MAP: Record<string, { iana: string; display: string }> = {
  // Australia/New Zealand
  'NEWZEALANDSTANDARDTIME': { iana: 'Pacific/Auckland', display: 'New Zealand (UTC+12/+13)' },
  'AABORLINTIME': { iana: 'Australia/Sydney', display: 'Sydney (UTC+10/+11)' },
  'AUSEASTERNSTANDARDTIME': { iana: 'Australia/Sydney', display: 'Sydney (UTC+10/+11)' },
  'AABORLINETIME': { iana: 'Australia/Sydney', display: 'Sydney (UTC+10/+11)' },
  'EAABORLINETIME': { iana: 'Australia/Sydney', display: 'Sydney (UTC+10/+11)' },
  'EAUSSTANDARDTIME': { iana: 'Australia/Sydney', display: 'Sydney (UTC+10/+11)' },
  'EAUSTRALIASTANDARDTIME': { iana: 'Australia/Sydney', display: 'Sydney (UTC+10/+11)' },
  'AUSCENTRALSTANDARDTIME': { iana: 'Australia/Adelaide', display: 'Adelaide (UTC+9:30/+10:30)' },
  'CENAUSTRALIASTANDARDTIME': { iana: 'Australia/Adelaide', display: 'Adelaide (UTC+9:30/+10:30)' },
  'AUSWESTERNSTANDARDTIME': { iana: 'Australia/Perth', display: 'Perth (UTC+8)' },
  'WAUSSTANDARDTIME': { iana: 'Australia/Perth', display: 'Perth (UTC+8)' },
  'WAUSTRALIAST': { iana: 'Australia/Perth', display: 'Perth (UTC+8)' },
  'WAUSTRALISTANDARDTIME': { iana: 'Australia/Perth', display: 'Perth (UTC+8)' },
  'TASMANIASTANDARDTIME': { iana: 'Australia/Hobart', display: 'Hobart (UTC+10/+11)' },
  
  // US
  'USSTANDARDTIME': { iana: 'America/Los_Angeles', display: 'US Pacific (UTC-8/-7)' },
  'PACIFICSTANDARDTIME': { iana: 'America/Los_Angeles', display: 'US Pacific (UTC-8/-7)' },
  'USMOUNTAINSTANDARDTIME': { iana: 'America/Denver', display: 'US Mountain (UTC-7/-6)' },
  'MOUNTAINSTANDARDTIME': { iana: 'America/Denver', display: 'US Mountain (UTC-7/-6)' },
  'USCENTRALSTANDARDTIME': { iana: 'America/Chicago', display: 'US Central (UTC-6/-5)' },
  'CENTRALSTANDARDTIME': { iana: 'America/Chicago', display: 'US Central (UTC-6/-5)' },
  'USEASTERNSTANDARDTIME': { iana: 'America/New_York', display: 'US Eastern (UTC-5/-4)' },
  'EASTERNSTANDARDTIME': { iana: 'America/New_York', display: 'US Eastern (UTC-5/-4)' },
  'HAWAIISTANDARDTIME': { iana: 'Pacific/Honolulu', display: 'Hawaii (UTC-10)' },
  'ALASKANSTANDARDTIME': { iana: 'America/Anchorage', display: 'Alaska (UTC-9/-8)' },
  
  // UK/Europe
  'GMTSTANDARDTIME': { iana: 'Europe/London', display: 'London (UTC+0/+1)' },
  'GREENWICHMEANTIME': { iana: 'Europe/London', display: 'London (UTC+0/+1)' },
  'UTCTIME': { iana: 'UTC', display: 'UTC (UTC+0)' },
  'UTC': { iana: 'UTC', display: 'UTC (UTC+0)' },
  'WESTEUROPESTANDARDTIME': { iana: 'Europe/Amsterdam', display: 'Amsterdam (UTC+1/+2)' },
  'CENTRALEUROPESTANDARDTIME': { iana: 'Europe/Berlin', display: 'Berlin (UTC+1/+2)' },
  'ROMANCESTANDARDTIME': { iana: 'Europe/Paris', display: 'Paris (UTC+1/+2)' },
  
  // Asia
  'SINGAPORESTANDARDTIME': { iana: 'Asia/Singapore', display: 'Singapore (UTC+8)' },
  'CHINASTANDARDTIME': { iana: 'Asia/Shanghai', display: 'China (UTC+8)' },
  'TOKYOSTANDARDTIME': { iana: 'Asia/Tokyo', display: 'Tokyo (UTC+9)' },
  'KOREASTANDARDTIME': { iana: 'Asia/Seoul', display: 'Seoul (UTC+9)' },
  'INDIASTANDARDTIME': { iana: 'Asia/Kolkata', display: 'India (UTC+5:30)' },
  
  // Canada
  'CANADAEASTERNSTANDARDTIME': { iana: 'America/Toronto', display: 'Toronto (UTC-5/-4)' },
  'CANADACENTRALSTANDARDTIME': { iana: 'America/Winnipeg', display: 'Winnipeg (UTC-6/-5)' },
  'CANADAMOUNTAINSTANDARDTIME': { iana: 'America/Edmonton', display: 'Edmonton (UTC-7/-6)' },
  'CANADAPACIFICSTANDARDTIME': { iana: 'America/Vancouver', display: 'Vancouver (UTC-8/-7)' },
  'ATLANTICSTANDARDTIME': { iana: 'America/Halifax', display: 'Halifax (UTC-4/-3)' },
  'NEWFOUNDLANDSTANDARDTIME': { iana: 'America/St_Johns', display: 'Newfoundland (UTC-3:30/-2:30)' },
  
  // South Africa
  'SOUTHAFRICASTANDARDTIME': { iana: 'Africa/Johannesburg', display: 'South Africa (UTC+2)' },
};

/**
 * Convert Xero timezone string to display name
 */
export function formatXeroTimezone(xeroTimezone: string | null | undefined): string {
  if (!xeroTimezone) return 'Not set';
  
  const normalized = xeroTimezone.toUpperCase().replace(/[^A-Z]/g, '');
  const mapping = XERO_TIMEZONE_MAP[normalized];
  
  if (mapping) {
    return mapping.display;
  }
  
  // Fallback: format the raw string more nicely
  return xeroTimezone
    .replace(/STANDARDTIME$/i, '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .trim() || xeroTimezone;
}

/**
 * Get IANA timezone from Xero timezone string
 */
export function getIanaTimezone(xeroTimezone: string | null | undefined): string {
  if (!xeroTimezone) return 'UTC';
  
  const normalized = xeroTimezone.toUpperCase().replace(/[^A-Z]/g, '');
  const mapping = XERO_TIMEZONE_MAP[normalized];
  
  return mapping?.iana || 'UTC';
}

/**
 * Country code to country name mapping
 */
const COUNTRY_NAMES: Record<string, string> = {
  'AU': 'Australia',
  'NZ': 'New Zealand',
  'US': 'United States',
  'CA': 'Canada',
  'GB': 'United Kingdom',
  'UK': 'United Kingdom',
  'IE': 'Ireland',
  'SG': 'Singapore',
  'HK': 'Hong Kong',
  'ZA': 'South Africa',
  'IN': 'India',
  'DE': 'Germany',
  'FR': 'France',
  'NL': 'Netherlands',
  'BE': 'Belgium',
  'CH': 'Switzerland',
  'AT': 'Austria',
  'IT': 'Italy',
  'ES': 'Spain',
  'PT': 'Portugal',
  'SE': 'Sweden',
  'NO': 'Norway',
  'DK': 'Denmark',
  'FI': 'Finland',
  'JP': 'Japan',
  'KR': 'South Korea',
  'CN': 'China',
  'MY': 'Malaysia',
  'PH': 'Philippines',
  'ID': 'Indonesia',
  'TH': 'Thailand',
  'VN': 'Vietnam',
  'MX': 'Mexico',
  'BR': 'Brazil',
  'AR': 'Argentina',
  'CL': 'Chile',
  'CO': 'Colombia',
  'AE': 'United Arab Emirates',
  'SA': 'Saudi Arabia',
};

/**
 * Convert country code to country name
 */
export function formatCountryCode(countryCode: string | null | undefined): string {
  if (!countryCode) return 'Not set';
  return COUNTRY_NAMES[countryCode.toUpperCase()] || countryCode;
}

/**
 * Currency code to currency name mapping
 */
const CURRENCY_NAMES: Record<string, string> = {
  'AUD': 'Australian Dollar',
  'NZD': 'New Zealand Dollar',
  'USD': 'US Dollar',
  'CAD': 'Canadian Dollar',
  'GBP': 'British Pound',
  'EUR': 'Euro',
  'SGD': 'Singapore Dollar',
  'HKD': 'Hong Kong Dollar',
  'ZAR': 'South African Rand',
  'INR': 'Indian Rupee',
  'JPY': 'Japanese Yen',
  'KRW': 'South Korean Won',
  'CNY': 'Chinese Yuan',
  'MYR': 'Malaysian Ringgit',
  'PHP': 'Philippine Peso',
  'IDR': 'Indonesian Rupiah',
  'THB': 'Thai Baht',
  'VND': 'Vietnamese Dong',
  'MXN': 'Mexican Peso',
  'BRL': 'Brazilian Real',
  'ARS': 'Argentine Peso',
  'CLP': 'Chilean Peso',
  'COP': 'Colombian Peso',
  'AED': 'UAE Dirham',
  'SAR': 'Saudi Riyal',
  'CHF': 'Swiss Franc',
  'SEK': 'Swedish Krona',
  'NOK': 'Norwegian Krone',
  'DKK': 'Danish Krone',
};

/**
 * Format currency code with name
 */
export function formatCurrencyCode(currencyCode: string | null | undefined): string {
  if (!currencyCode) return 'Not set';
  const name = CURRENCY_NAMES[currencyCode.toUpperCase()];
  return name ? `${currencyCode} (${name})` : currencyCode;
}

/**
 * Format a DATE string (YYYY-MM-DD) to display format.
 * This treats the date as a pure date without timezone conversion.
 * Use for: startDate, endDate, periodDate, invoiceDate
 */
export function formatDateOnly(dateString: string | null | undefined): string {
  if (!dateString) return '';
  
  // Parse date parts directly to avoid timezone issues
  // Date strings from backend are in YYYY-MM-DD format
  const parts = dateString.split('T')[0].split('-');
  if (parts.length !== 3) return dateString;
  
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1; // JS months are 0-indexed
  const day = parseInt(parts[2], 10);
  
  // Create date in local timezone at noon to avoid DST issues
  const date = new Date(year, month, day, 12, 0, 0);
  
  const dayStr = String(date.getDate()).padStart(2, '0');
  const monthStr = date.toLocaleString('en-US', { month: 'short' });
  const yearStr = date.getFullYear();
  
  return `${dayStr} ${monthStr} ${yearStr}`;
}

/**
 * Format a TIMESTAMP string to display in a specific timezone.
 * Use for: createdAt, postedAt, updatedAt (audit timestamps)
 * 
 * @param timestampString - ISO timestamp string from backend
 * @param xeroTimezone - Xero timezone string (e.g., "NEWZEALANDSTANDARDTIME")
 * @param options - Formatting options
 */
export function formatTimestampInTimezone(
  timestampString: string | null | undefined,
  xeroTimezone: string | null | undefined,
  options: {
    includeTime?: boolean;
    includeSeconds?: boolean;
    includeWeekday?: boolean;
  } = {}
): string {
  if (!timestampString) return '';
  
  const { includeTime = true, includeSeconds = false, includeWeekday = false } = options;
  
  // Get IANA timezone
  const ianaTimezone = getIanaTimezone(xeroTimezone);
  
  try {
    const date = new Date(timestampString);
    
    // Build date format options
    const dateOptions: Intl.DateTimeFormatOptions = {
      timeZone: ianaTimezone,
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    };
    
    if (includeWeekday) {
      dateOptions.weekday = 'long';
    }
    
    let result = date.toLocaleDateString('en-US', dateOptions);
    
    if (includeTime) {
      const timeOptions: Intl.DateTimeFormatOptions = {
        timeZone: ianaTimezone,
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      };
      
      if (includeSeconds) {
        timeOptions.second = '2-digit';
      }
      
      const timeStr = date.toLocaleTimeString('en-US', timeOptions);
      result += `, ${timeStr}`;
    }
    
    return result;
  } catch (e) {
    console.error('Error formatting timestamp:', e);
    return timestampString;
  }
}

/**
 * Format a short timestamp (date only) in a specific timezone.
 * Use for: displaying created date in tables
 */
export function formatDateInTimezone(
  timestampString: string | null | undefined,
  xeroTimezone: string | null | undefined
): string {
  if (!timestampString) return '';
  
  const ianaTimezone = getIanaTimezone(xeroTimezone);
  
  try {
    const date = new Date(timestampString);
    
    // Use the same format as formatDate but with timezone
    const options: Intl.DateTimeFormatOptions = {
      timeZone: ianaTimezone,
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    };
    
    // Format and rearrange to DD MMM YYYY
    const parts = date.toLocaleDateString('en-GB', options).split(' ');
    return parts.join(' ');
  } catch (e) {
    console.error('Error formatting date in timezone:', e);
    return timestampString;
  }
}

/**
 * Get the current date in the org's timezone as YYYY-MM-DD string.
 * Useful for setting default dates in forms.
 */
export function getTodayInTimezone(xeroTimezone: string | null | undefined): string {
  const ianaTimezone = getIanaTimezone(xeroTimezone);
  
  try {
    const now = new Date();
    const options: Intl.DateTimeFormatOptions = {
      timeZone: ianaTimezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    };
    
    // Format as parts and reassemble as YYYY-MM-DD
    const formatter = new Intl.DateTimeFormat('en-CA', options); // en-CA gives YYYY-MM-DD format
    return formatter.format(now);
  } catch (e) {
    console.error('Error getting today in timezone:', e);
    return formatDateForInput(new Date());
  }
}

/**
 * Parse a date input value and ensure it's interpreted correctly.
 * The input value is in YYYY-MM-DD format from the date picker.
 * We want to treat this as a date in the org's timezone, not the user's local timezone.
 */
export function parseDateInputValue(dateValue: string): string {
  // The date input value is already in YYYY-MM-DD format
  // We just need to ensure we're not adding any timezone offset
  // Return as-is since the backend stores dates as DATE type (no time)
  return dateValue;
}

