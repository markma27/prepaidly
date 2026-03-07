'use client';

import { Suspense, useEffect, useState, useMemo, useRef } from 'react';
import { useRouter, useSearchParams, useParams } from 'next/navigation';
import { scheduleApi, xeroApi } from '@/lib/api';
import {
  validateDateRange,
  resolveEndDate,
  getCurrencySymbol,
  formatDateOnly,
  formatCurrency,
  countProRataPeriods,
  generateProRataSchedule,
  generateEqualMonthlySchedule,
} from '@/lib/utils';
import { getOrgCurrency } from '@/lib/OrgContext';
import type { Schedule, ScheduleType, XeroAccount } from '@/lib/types';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import DashboardLayout from '@/components/DashboardLayout';
import EditScheduleSkeleton from '@/components/EditScheduleSkeleton';
import { createClient } from '@/lib/supabase/client';
import { ArrowLeft, DollarSign, FileText, Pencil, Loader2, User, Calendar, ChevronDown, Upload, Info, Eye, X } from 'lucide-react';

const fieldClassName =
  'w-full h-10 px-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6d69ff] focus:border-transparent text-sm text-gray-900 placeholder:text-gray-400';

interface PreviewEntry {
  period: number;
  date: string;
  days: number;
  amount: number;
}

function EditScheduleContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [accounts, setAccounts] = useState<XeroAccount[]>([]);
  const [existingContacts, setExistingContacts] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [tenantId, setTenantId] = useState<string>('');

  const scheduleId = params?.id ? parseInt(params.id as string) : null;
  const orgCurrency = getOrgCurrency(tenantId) || 'USD';

  const [type, setType] = useState<ScheduleType>('PREPAID');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [expenseAcctCode, setExpenseAcctCode] = useState('');
  const [revenueAcctCode, setRevenueAcctCode] = useState('');
  const [contactName, setContactName] = useState('');
  const [invoiceReference, setInvoiceReference] = useState('');
  const [description, setDescription] = useState('');
  const [invoiceDate, setInvoiceDate] = useState('');
  const [allocationMethod, setAllocationMethod] = useState<'actual' | 'equal'>('actual');

  // Preview state
  const [showPreview, setShowPreview] = useState(false);
  const [previewEntries, setPreviewEntries] = useState<PreviewEntry[]>([]);

  // Invoice: remove/reupload
  const [invoiceRemoved, setInvoiceRemoved] = useState(false);
  const [newInvoiceFile, setNewInvoiceFile] = useState<File | null>(null);
  const [newInvoiceStorageUrl, setNewInvoiceStorageUrl] = useState<string | null>(null);
  const [newInvoicePreviewUrl, setNewInvoicePreviewUrl] = useState<string | null>(null);
  const [uploadingInvoice, setUploadingInvoice] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const normalizedStartDate = useMemo(
    () => (/^\d{4}-\d{2}-\d{2}$/.test(startDate) ? startDate : ''),
    [startDate]
  );
  const resolvedEndDate = useMemo(
    () => (normalizedStartDate ? resolveEndDate(normalizedStartDate, endDate) || endDate : endDate),
    [normalizedStartDate, endDate]
  );
  const periodCount = useMemo(() => {
    if (normalizedStartDate && resolvedEndDate) {
      const validation = validateDateRange(normalizedStartDate, resolvedEndDate);
      if (validation.valid) return countProRataPeriods(normalizedStartDate, resolvedEndDate);
    }
    return 0;
  }, [normalizedStartDate, resolvedEndDate]);

  useEffect(() => {
    const tenantIdParam = searchParams.get('tenantId');
    if (!tenantIdParam || !scheduleId) {
      setError(scheduleId ? 'Missing Tenant ID' : 'Invalid schedule');
      setLoading(false);
      return;
    }
    setTenantId(tenantIdParam);
  }, [searchParams, scheduleId]);

  useEffect(() => {
    if (!tenantId || !scheduleId) return;
    let cancelled = false;
    const load = async () => {
      try {
        const [s, acctsRes, contactsRes] = await Promise.all([
          scheduleApi.getSchedule(scheduleId),
          xeroApi.getAccounts(tenantId),
          scheduleApi.getContactNames(tenantId),
        ]);
        if (cancelled) return;
        setSchedule(s);
        setAccounts(acctsRes?.accounts ?? []);
        setExistingContacts(contactsRes?.contactNames ?? []);
        setType((s.type as ScheduleType) || 'PREPAID');
        setStartDate(s.startDate ? s.startDate.slice(0, 10) : '');
        setEndDate(s.endDate ? s.endDate.slice(0, 10) : '');
        setTotalAmount(String(s.totalAmount ?? ''));
        setExpenseAcctCode(s.expenseAcctCode ?? '');
        setRevenueAcctCode(s.revenueAcctCode ?? '');
        setContactName(s.contactName ?? '');
        setInvoiceReference(s.invoiceReference ?? '');
        setDescription(s.description ?? '');
        setInvoiceDate(s.invoiceDate ? s.invoiceDate.slice(0, 10) : '');
        setAllocationMethod((s as any).allocationMethod === 'equal' ? 'equal' : 'actual');
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? 'Failed to load schedule');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [tenantId, scheduleId]);

  const getFilteredAccounts = (accountType: 'EXPENSE' | 'REVENUE') => {
    const list = Array.isArray(accounts) ? accounts : [];
    return list.filter((acc) =>
      accountType === 'EXPENSE' ? acc.type === 'EXPENSE' : acc.type === 'REVENUE'
    );
  };

  const getDeferralAccountDisplay = () => {
    if (!schedule?.deferralAcctCode) return null;
    const account = accounts.find((acc) => acc.code === schedule.deferralAcctCode);
    if (account) return `${account.code} - ${account.name}`;
    return schedule.deferralAcctCode;
  };

  const generatePreview = () => {
    setError(null);
    if (!normalizedStartDate) {
      setError('Please enter a valid start date');
      return;
    }
    const dateValidation = validateDateRange(normalizedStartDate, resolvedEndDate);
    if (!dateValidation.valid) {
      setError(dateValidation.error || 'Invalid date range');
      return;
    }
    if (!totalAmount || parseFloat(totalAmount) <= 0) {
      setError('Please enter a valid total amount greater than 0');
      return;
    }
    const scheduleEntries = allocationMethod === 'actual'
      ? generateProRataSchedule(normalizedStartDate, resolvedEndDate, parseFloat(totalAmount))
      : generateEqualMonthlySchedule(normalizedStartDate, resolvedEndDate, parseFloat(totalAmount));
    const entries: PreviewEntry[] = scheduleEntries.map((entry) => ({
      period: entry.period,
      date: entry.periodEnd.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }),
      days: entry.days,
      amount: entry.amount,
    }));
    setPreviewEntries(entries);
    setShowPreview(true);
  };

  // Regenerate preview when allocation method changes (if preview is visible)
  const handleAllocationMethodChange = (method: 'actual' | 'equal') => {
    setAllocationMethod(method);
    if (showPreview && normalizedStartDate && resolvedEndDate && totalAmount && parseFloat(totalAmount) > 0) {
      const dateValidation = validateDateRange(normalizedStartDate, resolvedEndDate);
      if (dateValidation.valid) {
        const scheduleEntries = method === 'actual'
          ? generateProRataSchedule(normalizedStartDate, resolvedEndDate, parseFloat(totalAmount))
          : generateEqualMonthlySchedule(normalizedStartDate, resolvedEndDate, parseFloat(totalAmount));
        setPreviewEntries(scheduleEntries.map((entry) => ({
          period: entry.period,
          date: entry.periodEnd.toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          }),
          days: entry.days,
          amount: entry.amount,
        })));
      }
    }
  };

  const handleInvoiceFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    if (!allowedTypes.includes(file.type)) {
      setError('Please upload a PDF, JPG, or PNG file');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('File size must be 10MB or less');
      return;
    }
    const previewUrl = URL.createObjectURL(file);
    setNewInvoicePreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return previewUrl;
    });
    setNewInvoiceFile(file);
    setError(null);
    if (!tenantId) return;
    try {
      setUploadingInvoice(true);
      const supabase = createClient();
      const filePath = `${tenantId}/${Date.now()}_${file.name}`;
      const { data, error: uploadError } = await supabase.storage
        .from('invoices')
        .upload(filePath, file, { upsert: true });
      if (uploadError) {
        setError('Failed to upload invoice: ' + uploadError.message);
        setNewInvoiceFile(null);
        setNewInvoiceStorageUrl(null);
        URL.revokeObjectURL(previewUrl);
        setNewInvoicePreviewUrl(null);
        return;
      }
      const { data: urlData } = supabase.storage.from('invoices').getPublicUrl(data.path);
      setNewInvoiceStorageUrl(urlData.publicUrl);
    } catch (err: any) {
      setError('Failed to upload invoice: ' + (err?.message || 'Unknown error'));
      setNewInvoiceFile(null);
      setNewInvoiceStorageUrl(null);
      URL.revokeObjectURL(previewUrl);
      setNewInvoicePreviewUrl(null);
    } finally {
      setUploadingInvoice(false);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemoveInvoice = () => {
    if (newInvoiceFile) {
      setNewInvoiceFile(null);
      setNewInvoiceStorageUrl(null);
      if (newInvoicePreviewUrl) {
        URL.revokeObjectURL(newInvoicePreviewUrl);
        setNewInvoicePreviewUrl(null);
      }
    } else if (schedule?.invoiceFilename && !invoiceRemoved) {
      setInvoiceRemoved(true);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!schedule || !tenantId || !scheduleId) return;

    const normalizedStart = startDate.trim();
    const resolvedEnd = resolveEndDate(normalizedStart, endDate.trim()) || endDate.trim();

    const dateValidation = validateDateRange(normalizedStart, resolvedEnd);
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
    if (!schedule.deferralAcctCode) {
      setError('Schedule deferral account is missing');
      return;
    }
    if (!contactName.trim()) {
      setError('Contact is required');
      return;
    }
    if (!invoiceReference.trim()) {
      setError('Invoice reference is required');
      return;
    }
    if (!invoiceDate.trim()) {
      setError('Invoice date is required');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      await scheduleApi.updateScheduleFull(scheduleId, tenantId, {
        tenantId,
        type,
        startDate: normalizedStart,
        endDate: resolvedEnd,
        totalAmount: parseFloat(totalAmount),
        expenseAcctCode: type === 'PREPAID' ? expenseAcctCode : undefined,
        revenueAcctCode: type === 'UNEARNED' ? revenueAcctCode : undefined,
        deferralAcctCode: schedule.deferralAcctCode,
        contactName: contactName.trim(),
        invoiceReference: invoiceReference.trim(),
        description: description.trim() || undefined,
        invoiceDate: invoiceDate.slice(0, 10),
        invoiceUrl: invoiceRemoved ? undefined : (newInvoiceStorageUrl ?? schedule.invoiceUrl ?? undefined),
        invoiceFilename: invoiceRemoved ? undefined : (newInvoiceFile?.name ?? schedule.invoiceFilename ?? undefined),
        allocationMethod,
      });
      router.push(`/app/schedules/${scheduleId}?tenantId=${tenantId}`);
    } catch (err: any) {
      setError(err?.data?.error ?? err?.message ?? 'Failed to update schedule');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && !schedule) {
    return (
      <DashboardLayout tenantId={tenantId || ''} pageTitle="Edit Schedule">
        <EditScheduleSkeleton />
      </DashboardLayout>
    );
  }

  if (error && !schedule) {
    return (
      <DashboardLayout tenantId={tenantId || undefined}>
        <div className="max-w-[1800px] mx-auto p-6">
          <ErrorMessage message={error} />
          <button
            type="button"
            onClick={() => router.push(`/app/schedules/register?tenantId=${tenantId}`)}
            className="mt-4 flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Schedule Register
          </button>
        </div>
      </DashboardLayout>
    );
  }

  if (!schedule) return null;

  return (
    <DashboardLayout tenantId={tenantId} pageTitle="Edit Schedule">
      <div className="max-w-[1800px] mx-auto space-y-5">
        <button
          type="button"
          onClick={() => router.push(`/app/schedules/${scheduleId}?tenantId=${tenantId}`)}
          className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Schedule
        </button>

        {error && <ErrorMessage message={error} onDismiss={() => setError(null)} />}

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Left Column - Schedule Details (same as New Schedule) */}
            <div className="lg:col-span-2 space-y-5">
              {/* Card 1: Schedule Type & Invoice */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden transition-all duration-200 hover:shadow-md hover:border-gray-300">
                <div className="bg-gradient-to-r from-[#6d69ff]/10 via-[#6d69ff]/30 to-[#6d69ff]/10 px-5 py-3">
                  <h3 className="text-base font-bold text-gray-900">Schedule Type & Invoice</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Type, contact and invoice details</p>
                </div>
                <div className="p-5 space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Schedule Type</label>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => setType('PREPAID')}
                        className={`flex-1 px-4 py-3 rounded-lg border-2 text-sm font-semibold transition-all duration-200 ${
                          type === 'PREPAID'
                            ? 'border-blue-500 bg-blue-50 text-blue-600'
                            : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center justify-center gap-2">
                          <DollarSign className="w-4 h-4" />
                          Prepayment
                        </div>
                        <p className="text-[10px] font-normal mt-1 opacity-70">Expense paid upfront, recognised monthly</p>
                      </button>
                      <button
                        type="button"
                        onClick={() => setType('UNEARNED')}
                        className={`flex-1 px-4 py-3 rounded-lg border-2 text-sm font-semibold transition-all duration-200 ${
                          type === 'UNEARNED'
                            ? 'border-green-500 bg-green-50 text-green-600'
                            : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center justify-center gap-2">
                          <FileText className="w-4 h-4" />
                          Unearned Revenue
                        </div>
                        <p className="text-[10px] font-normal mt-1 opacity-70">Revenue received upfront, recognised monthly</p>
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Contact <span className="text-red-500">*</span></label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="text"
                          value={contactName}
                          onChange={(e) => setContactName(e.target.value)}
                          required
                          placeholder="Enter contact / customer / supplier name"
                          className={`${fieldClassName} pl-10 pr-3`}
                          list="edit-contact-list"
                        />
                        <datalist id="edit-contact-list">
                          {existingContacts.map((name) => (
                            <option key={name} value={name} />
                          ))}
                        </datalist>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Invoice Reference <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        value={invoiceReference}
                        onChange={(e) => setInvoiceReference(e.target.value)}
                        required
                        placeholder="Enter invoice reference"
                        className={fieldClassName}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Invoice Date <span className="text-red-500">*</span></label>
                      <div className="relative">
                        <input
                          type="date"
                          value={invoiceDate}
                          onChange={(e) => setInvoiceDate(e.target.value)}
                          required
                          className={`${fieldClassName} pr-10`}
                        />
                        <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Total Amount <span className="text-red-500">*</span></label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">{getCurrencySymbol(orgCurrency)}</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          value={totalAmount}
                          onChange={(e) => setTotalAmount(e.target.value)}
                          required
                          placeholder="0.00"
                          className={`${fieldClassName} pl-7 pr-3`}
                        />
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Invoice</label>
                    {newInvoiceFile ? (
                      <div className="flex items-center gap-3 px-4 py-3 border border-gray-200 rounded-lg bg-gray-50">
                        <FileText className="w-4 h-4 text-[#6d69ff] flex-shrink-0" />
                        <span className="text-sm text-gray-700 truncate flex-1">{newInvoiceFile.name}</span>
                        {uploadingInvoice && (
                          <div className="w-4 h-4 border-2 border-[#6d69ff] border-t-transparent rounded-full animate-spin flex-shrink-0" />
                        )}
                        <button
                          type="button"
                          onClick={handleRemoveInvoice}
                          className="text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
                          title="Remove invoice"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : schedule.invoiceFilename && !invoiceRemoved ? (
                      <div className="flex items-center gap-3 px-4 py-3 border border-gray-200 rounded-lg bg-gray-50">
                        <FileText className="w-4 h-4 text-[#6d69ff] flex-shrink-0" />
                        <span className="text-sm text-gray-700 truncate flex-1">{schedule.invoiceFilename}</span>
                        <button
                          type="button"
                          onClick={handleRemoveInvoice}
                          className="text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
                          title="Remove invoice"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : null}
                    {(!schedule.invoiceFilename || invoiceRemoved || newInvoiceFile) && !newInvoiceFile ? (
                      <label className="flex items-center justify-center gap-2 w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-[#6d69ff] hover:bg-[#6d69ff]/5 transition-colors mt-2">
                        <Upload className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-500">
                          {schedule.invoiceFilename && invoiceRemoved ? 'Upload new invoice (PDF, JPG, PNG)' : 'Click to upload invoice (PDF, JPG, PNG)'}
                        </span>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png"
                          onChange={handleInvoiceFileSelect}
                          className="hidden"
                        />
                      </label>
                    ) : null}
                  </div>
                </div>
              </div>

              {/* Card 2: Schedule Period & Posting */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden transition-all duration-200 hover:shadow-md hover:border-gray-300">
                <div className="bg-gradient-to-r from-[#6d69ff]/10 via-[#6d69ff]/30 to-[#6d69ff]/10 px-5 py-3">
                  <h3 className="text-base font-bold text-gray-900">Schedule Period & Posting</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Dates, accounts and amortisation</p>
                </div>
                <div className="p-5 space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Amortisation Method</label>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => handleAllocationMethodChange('actual')}
                        className={`flex-1 px-4 py-3 rounded-lg border-2 text-sm font-semibold transition-all duration-200 ${
                          allocationMethod === 'actual'
                            ? 'border-[#6d69ff] bg-[#6d69ff]/10 text-[#6d69ff]'
                            : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center justify-center gap-2">Actual Days</div>
                        <p className="text-[10px] font-normal mt-1 opacity-70">Pro-rata by days in each period</p>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAllocationMethodChange('equal')}
                        className={`flex-1 px-4 py-3 rounded-lg border-2 text-sm font-semibold transition-all duration-200 ${
                          allocationMethod === 'equal'
                            ? 'border-[#6d69ff] bg-[#6d69ff]/10 text-[#6d69ff]'
                            : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center justify-center gap-2">Equal Monthly</div>
                        <p className="text-[10px] font-normal mt-1 opacity-70">Same amount each period</p>
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Start Date <span className="text-red-500">*</span></label>
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        required
                        className={fieldClassName}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">End Date <span className="text-red-500">*</span></label>
                      <input
                        type="date"
                        value={endDate}
                        min={normalizedStartDate || undefined}
                        onChange={(e) => setEndDate(e.target.value)}
                        required
                        className={fieldClassName}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        {type === 'PREPAID' ? 'Expense Account' : 'Revenue Account'} <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <select
                          value={type === 'PREPAID' ? expenseAcctCode : revenueAcctCode}
                          onChange={(e) => (type === 'PREPAID' ? setExpenseAcctCode(e.target.value) : setRevenueAcctCode(e.target.value))}
                          required
                          className={`${fieldClassName} appearance-none bg-white pr-10`}
                        >
                          <option value="">Please select an account</option>
                          {getFilteredAccounts(type === 'PREPAID' ? 'EXPENSE' : 'REVENUE').map((acc) => (
                            <option key={acc.accountID} value={acc.code}>
                              {acc.code} - {acc.name}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
                      <input
                        type="text"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Optional notes or description for this schedule"
                        className={fieldClassName}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column - Summary & Actions (same as New Schedule) */}
            <div className="space-y-5">
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden transition-all duration-200 hover:shadow-md hover:border-gray-300">
                <div className="bg-gradient-to-r from-[#6d69ff]/10 via-[#6d69ff]/30 to-[#6d69ff]/10 px-5 py-3">
                  <h3 className="text-base font-bold text-gray-900">Summary</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Preview schedule totals and period breakdown</p>
                </div>
                <div className="p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Type</span>
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                        type === 'PREPAID' ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600'
                      }`}
                    >
                      {type === 'PREPAID' ? 'Prepayment' : 'Unearned Revenue'}
                    </span>
                  </div>
                  {contactName && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">Contact</span>
                      <span className="text-sm font-medium text-gray-900 truncate ml-2 max-w-[150px]">{contactName}</span>
                    </div>
                  )}
                  {invoiceDate && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">Invoice date</span>
                      <span className="text-sm font-medium text-gray-900 truncate ml-2 max-w-[150px]">{formatDateOnly(invoiceDate)}</span>
                    </div>
                  )}
                  {invoiceReference && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">Invoice ref</span>
                      <span className="text-sm font-medium text-gray-900 truncate ml-2 max-w-[150px]">{invoiceReference}</span>
                    </div>
                  )}
                  {normalizedStartDate && resolvedEndDate && periodCount > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">Periods</span>
                      <span className="text-sm font-medium text-gray-900">
                        {periodCount} {periodCount === 1 ? 'entry' : 'entries'}
                      </span>
                    </div>
                  )}
                  {totalAmount && parseFloat(totalAmount) > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">Total Amount</span>
                      <span className="text-sm font-bold text-gray-900">{formatCurrency(parseFloat(totalAmount), orgCurrency)}</span>
                    </div>
                  )}
                  {(type === 'PREPAID' ? expenseAcctCode : revenueAcctCode) && (
                    <div className="flex items-start justify-between">
                      <span className="text-sm text-gray-500">{type === 'PREPAID' ? 'Expense Acct' : 'Revenue Acct'}</span>
                      <span className="text-sm text-gray-700 text-right ml-2 max-w-[150px]">
                        {(() => {
                          const code = type === 'PREPAID' ? expenseAcctCode : revenueAcctCode;
                          const account = accounts.find((acc) => acc.code === code);
                          return account ? `${code} - ${account.name}` : code;
                        })()}
                      </span>
                    </div>
                  )}
                  <div className="flex items-start justify-between">
                    <span className="text-sm text-gray-500">Deferral Acct</span>
                    <span className="text-sm text-gray-700 text-right ml-2 max-w-[150px]">
                      {getDeferralAccountDisplay() || <span className="text-amber-500 text-xs">Not set</span>}
                    </span>
                  </div>
                  <div className="border-t border-gray-100 pt-4 space-y-3">
                    <button
                      type="button"
                      onClick={generatePreview}
                      className="w-full flex items-center justify-center gap-2 px-5 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
                    >
                      <Eye className="w-4 h-4" />
                      Preview Schedule
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full px-5 py-2.5 bg-[#6d69ff] text-white rounded-lg hover:bg-[#5a56e6] transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed font-medium text-sm shadow-sm flex items-center justify-center gap-2"
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Pencil className="w-4 h-4" />
                          Save changes
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => router.push(`/app/schedules/${scheduleId}?tenantId=${tenantId}`)}
                      className="w-full px-5 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
                    >
                      Cancel
                    </button>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 mt-2">
                    <div className="flex items-start gap-2">
                      <Info className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
                      <p className="text-[11px] text-gray-500 leading-relaxed">
                        The deferral account is set from this schedule. Journal entries will be regenerated when you save (none have been posted yet).
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Schedule Preview */}
              {showPreview && previewEntries.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden transition-all duration-200 hover:shadow-md hover:border-gray-300">
                  <div className="bg-gradient-to-r from-[#6d69ff]/10 via-[#6d69ff]/30 to-[#6d69ff]/10 px-5 py-3">
                    <h3 className="text-base font-bold text-gray-900">Schedule Preview</h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {previewEntries.length} {previewEntries.length === 1 ? 'period' : 'periods'} — Total:{' '}
                      {formatCurrency(parseFloat(totalAmount), orgCurrency)}
                      {allocationMethod === 'actual' ? ' (actual days)' : ' (equal monthly)'}
                    </p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          <th className="px-5 py-3">Period</th>
                          <th className="px-5 py-3">Posting Date</th>
                          <th className="px-5 py-3 text-right">Days</th>
                          <th className="px-5 py-3 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {previewEntries.map((entry) => (
                          <tr key={entry.period} className="hover:bg-gray-50 transition-colors">
                            <td className="px-5 py-2.5 text-sm text-gray-700">{entry.period}</td>
                            <td className="px-5 py-2.5 text-sm text-gray-900">{entry.date}</td>
                            <td className="px-5 py-2.5 text-sm text-gray-500 text-right">{entry.days}</td>
                            <td className="px-5 py-2.5 text-sm font-medium text-gray-900 text-right">
                              {formatCurrency(entry.amount, orgCurrency)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-gray-50 font-bold">
                          <td className="px-5 py-3 text-sm text-gray-900" colSpan={2}>Total</td>
                          <td className="px-5 py-3 text-sm text-gray-500 text-right">
                            {previewEntries.reduce((sum, e) => sum + e.days, 0)}
                          </td>
                          <td className="px-5 py-3 text-sm text-gray-900 text-right">
                            {formatCurrency(parseFloat(totalAmount), orgCurrency)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}

export default function EditSchedulePage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><LoadingSpinner message="Loading..." /></div>}>
      <EditScheduleContent />
    </Suspense>
  );
}
