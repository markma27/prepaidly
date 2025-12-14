'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { scheduleApi, xeroApi } from '@/lib/api';
import { validateDateRange } from '@/lib/utils';
import type { XeroAccount, ScheduleType } from '@/lib/types';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import DashboardLayout from '@/components/DashboardLayout';

export default function NewSchedulePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [accounts, setAccounts] = useState<XeroAccount[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [tenantId, setTenantId] = useState<string>('');

  // Form state
  const [type, setType] = useState<ScheduleType>('PREPAID');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [expenseAcctCode, setExpenseAcctCode] = useState('');
  const [revenueAcctCode, setRevenueAcctCode] = useState('');
  const [deferralAcctCode, setDeferralAcctCode] = useState('');

  useEffect(() => {
    const tenantIdParam = searchParams.get('tenantId');
    if (tenantIdParam) {
      setTenantId(tenantIdParam);
      loadAccounts(tenantIdParam);
    } else {
      setError('Missing Tenant ID');
    }
  }, [searchParams]);

  const loadAccounts = async (tid: string) => {
    try {
      setLoading(true);
      setError(null);
      const response = await xeroApi.getAccounts(tid);
      // Filter out system accounts and archived accounts
      const filteredAccounts = response.accounts.filter(
        (acc) => !acc.isSystemAccount && acc.status !== 'ARCHIVED'
      );
      setAccounts(filteredAccounts);
    } catch (err: any) {
      console.error('Error loading accounts:', err);
      setError(err.message || 'Failed to load accounts');
    } finally {
      setLoading(false);
    }
  };

  // Filter accounts by type
  const getFilteredAccounts = (accountType: 'EXPENSE' | 'REVENUE' | 'DEFERRAL') => {
    return accounts.filter((acc) => {
      if (accountType === 'EXPENSE') {
        return acc.type === 'EXPENSE';
      } else if (accountType === 'REVENUE') {
        return acc.type === 'REVENUE';
      } else {
        // For deferral accounts, allow CURRENT ASSET, NON-CURRENT ASSET, CURRENT LIABILITY, NON-CURRENT LIABILITY
        return (
          acc.type === 'CURRENT' ||
          acc.type === 'NONCURRENT' ||
          acc.type === 'CURRLIAB' ||
          acc.type === 'LIABILITY' ||
          acc.type === 'ASSET'
        );
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!tenantId) {
      setError('Missing Tenant ID');
      return;
    }

    const dateValidation = validateDateRange(startDate, endDate);
    if (!dateValidation.valid) {
      setError(dateValidation.error || 'Invalid date range');
      return;
    }

    if (!totalAmount || parseFloat(totalAmount) <= 0) {
      setError('Please enter a valid total amount');
      return;
    }

    if (type === 'PREPAID' && !expenseAcctCode) {
      setError('Please select an expense account');
      return;
    }

    if (type === 'UNEARNED' && !revenueAcctCode) {
      setError('Please select a revenue account');
      return;
    }

    if (!deferralAcctCode) {
      setError('Please select a deferral account');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const request = {
        tenantId,
        type,
        startDate,
        endDate,
        totalAmount: parseFloat(totalAmount),
        expenseAcctCode: type === 'PREPAID' ? expenseAcctCode : undefined,
        revenueAcctCode: type === 'UNEARNED' ? revenueAcctCode : undefined,
        deferralAcctCode,
      };

      await scheduleApi.createSchedule(request);
      
      // Redirect to dashboard
      router.push(`/app/dashboard?tenantId=${tenantId}&success=true`);
    } catch (err: any) {
      console.error('Error creating schedule:', err);
      setError(err.message || 'Failed to create schedule');
    } finally {
      setSubmitting(false);
    }
  };

  if (!tenantId) {
    return (
      <div className="container mx-auto p-8">
        <LoadingSpinner message="Loading..." />
      </div>
    );
  }

  return (
    <DashboardLayout tenantId={tenantId}>
      <div className="max-w-3xl">
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <LoadingSpinner message="Loading account list..." />
          </div>
        ) : (
          <>
          <h1 className="text-3xl font-bold mb-6">Create New Schedule</h1>

      {error && (
        <ErrorMessage 
          message={error} 
          onDismiss={() => setError(null)}
        />
      )}

      <form onSubmit={handleSubmit} className="bg-white shadow rounded-lg p-6">
        {/* Schedule Type */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Schedule Type <span className="text-red-500">*</span>
          </label>
          <div className="flex gap-4">
            <label className="flex items-center">
              <input
                type="radio"
                value="PREPAID"
                checked={type === 'PREPAID'}
                onChange={(e) => setType(e.target.value as ScheduleType)}
                className="mr-2"
              />
              <span>Prepaid Expense</span>
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                value="UNEARNED"
                checked={type === 'UNEARNED'}
                onChange={(e) => setType(e.target.value as ScheduleType)}
                className="mr-2"
              />
              <span>Unearned Revenue</span>
            </label>
          </div>
        </div>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Start Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              End Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              required
              min={startDate}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Total Amount */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Total Amount <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            step="0.01"
            min="0.01"
            value={totalAmount}
            onChange={(e) => setTotalAmount(e.target.value)}
            required
            placeholder="0.00"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Account Selection */}
        {type === 'PREPAID' && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Expense Account <span className="text-red-500">*</span>
            </label>
            <select
              value={expenseAcctCode}
              onChange={(e) => setExpenseAcctCode(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Please select an account</option>
              {getFilteredAccounts('EXPENSE').map((account) => (
                <option key={account.accountID} value={account.code}>
                  [{account.code}] {account.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {type === 'UNEARNED' && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Revenue Account <span className="text-red-500">*</span>
            </label>
            <select
              value={revenueAcctCode}
              onChange={(e) => setRevenueAcctCode(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Please select an account</option>
              {getFilteredAccounts('REVENUE').map((account) => (
                <option key={account.accountID} value={account.code}>
                  [{account.code}] {account.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Deferral Account <span className="text-red-500">*</span>
          </label>
          <select
            value={deferralAcctCode}
            onChange={(e) => setDeferralAcctCode(e.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Please select an account</option>
            {getFilteredAccounts('DEFERRAL').map((account) => (
              <option key={account.accountID} value={account.code}>
                [{account.code}] {account.name} ({account.type})
              </option>
            ))}
          </select>
          <p className="mt-1 text-sm text-gray-500">
            {type === 'PREPAID'
              ? 'Select an asset account (e.g., Prepaid Expenses)'
              : 'Select a liability account (e.g., Unearned Revenue)'}
          </p>
        </div>

        {/* Submit Buttons */}
        <div className="flex gap-4">
          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {submitting ? 'Creating...' : 'Create Schedule'}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="px-6 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

