'use client';

import { Suspense, useEffect, useState, useRef, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { scheduleApi, xeroApi } from '@/lib/api';
import { validateDateRange, formatCurrency, generateProRataSchedule, countProRataPeriods } from '@/lib/utils';
import type { XeroAccount, ScheduleType } from '@/lib/types';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import DashboardLayout from '@/components/DashboardLayout';
import { User, Eye, DollarSign, FileText, AlertTriangle, Info, Upload, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface PreviewEntry {
  period: number;
  date: string;
  days: number;
  amount: number;
}

function NewSchedulePageContent() {
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

  // Contact state (plain text, not linked to Xero)
  const [contactName, setContactName] = useState('');
  const [existingContacts, setExistingContacts] = useState<string[]>([]);
  const [showContactDropdown, setShowContactDropdown] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const contactInputRef = useRef<HTMLInputElement>(null);
  const contactDropdownRef = useRef<HTMLDivElement>(null);

  // Default accounts from settings
  const [defaultPrepaymentAccount, setDefaultPrepaymentAccount] = useState<string>('');
  const [defaultUnearnedAccount, setDefaultUnearnedAccount] = useState<string>('');
  const [hasDefaultAccounts, setHasDefaultAccounts] = useState(false);

  // Description state
  const [description, setDescription] = useState('');

  // Invoice upload state
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [invoicePreviewUrl, setInvoicePreviewUrl] = useState<string | null>(null);
  const [invoiceStorageUrl, setInvoiceStorageUrl] = useState<string | null>(null);
  const [uploadingInvoice, setUploadingInvoice] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Preview state
  const [showPreview, setShowPreview] = useState(false);
  const [previewEntries, setPreviewEntries] = useState<PreviewEntry[]>([]);

  useEffect(() => {
    const tenantIdParam = searchParams.get('tenantId');
    if (tenantIdParam) {
      setTenantId(tenantIdParam);
      loadAccounts(tenantIdParam);
      loadDefaultAccounts(tenantIdParam);
      loadExistingContacts(tenantIdParam);
    } else {
      setError('Missing Tenant ID');
    }
  }, [searchParams]);

  // Close contact dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        contactDropdownRef.current &&
        !contactDropdownRef.current.contains(event.target as Node) &&
        contactInputRef.current &&
        !contactInputRef.current.contains(event.target as Node)
      ) {
        setShowContactDropdown(false);
        setHighlightedIndex(-1);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadAccounts = async (tid: string) => {
    try {
      setLoading(true);
      setError(null);
      const response = await xeroApi.getAccounts(tid);
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

  const loadDefaultAccounts = (tid: string) => {
    if (typeof window !== 'undefined') {
      const savedDefaults = localStorage.getItem(`defaultAccounts_${tid}`);
      if (savedDefaults) {
        try {
          const defaults = JSON.parse(savedDefaults);
          setDefaultPrepaymentAccount(defaults.prepaymentAccount || '');
          setDefaultUnearnedAccount(defaults.unearnedAccount || '');
          setHasDefaultAccounts(!!defaults.prepaymentAccount || !!defaults.unearnedAccount);
        } catch (e) {
          console.error('Error parsing saved default accounts:', e);
        }
      }
    }
  };

  const loadExistingContacts = async (tid: string) => {
    try {
      const response = await scheduleApi.getContactNames(tid);
      setExistingContacts(response.contactNames || []);
    } catch (err) {
      console.error('Error loading existing contacts:', err);
    }
  };

  // Filter existing contacts based on current input
  const filteredContacts = useMemo(() => {
    if (!contactName.trim()) return existingContacts;
    const query = contactName.toLowerCase().trim();
    return existingContacts.filter(name =>
      name.toLowerCase().includes(query) && name.toLowerCase() !== query
    );
  }, [contactName, existingContacts]);

  // Handle keyboard navigation in contact dropdown
  const handleContactKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showContactDropdown || filteredContacts.length === 0) {
      if (e.key === 'ArrowDown' && filteredContacts.length > 0) {
        setShowContactDropdown(true);
        setHighlightedIndex(0);
        e.preventDefault();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev =>
          prev < filteredContacts.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev =>
          prev > 0 ? prev - 1 : filteredContacts.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < filteredContacts.length) {
          setContactName(filteredContacts[highlightedIndex]);
          setShowContactDropdown(false);
          setHighlightedIndex(-1);
        }
        break;
      case 'Escape':
        setShowContactDropdown(false);
        setHighlightedIndex(-1);
        break;
    }
  };

  // Get the deferral account code based on schedule type
  const getDeferralAcctCode = () => {
    if (type === 'PREPAID') {
      return defaultPrepaymentAccount;
    }
    return defaultUnearnedAccount;
  };

  // Get the deferral account name for display
  const getDeferralAccountDisplay = () => {
    const code = getDeferralAcctCode();
    if (!code) return null;
    const account = accounts.find(acc => acc.code === code);
    if (account) {
      return `[${account.code}] ${account.name}`;
    }
    return `[${code}]`;
  };

  // Filter accounts by type
  const getFilteredAccounts = (accountType: 'EXPENSE' | 'REVENUE') => {
    return accounts.filter((acc) => {
      if (accountType === 'EXPENSE') {
        return acc.type === 'EXPENSE';
      } else {
        return acc.type === 'REVENUE';
      }
    });
  };

  // Handle invoice file selection and upload to Supabase Storage
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    if (!allowedTypes.includes(file.type)) {
      setError('Please upload a PDF, JPG, or PNG file');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('File size must be less than 10MB');
      return;
    }

    setInvoiceFile(file);

    // Create local preview URL for both images and PDFs
    const url = URL.createObjectURL(file);
    setInvoicePreviewUrl(url);

    // Upload to Supabase Storage
    try {
      setUploadingInvoice(true);
      const supabase = createClient();
      const fileExt = file.name.split('.').pop();
      const filePath = `${tenantId}/${Date.now()}_${file.name}`;

      const { data, error: uploadError } = await supabase.storage
        .from('invoices')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        setError('Failed to upload invoice: ' + uploadError.message);
        return;
      }

      // Get the public URL
      const { data: urlData } = supabase.storage
        .from('invoices')
        .getPublicUrl(data.path);

      setInvoiceStorageUrl(urlData.publicUrl);
    } catch (err: any) {
      console.error('Error uploading invoice:', err);
      setError('Failed to upload invoice: ' + (err.message || 'Unknown error'));
    } finally {
      setUploadingInvoice(false);
    }
  };

  const handleRemoveInvoice = async () => {
    // Remove from Supabase Storage if uploaded
    if (invoiceStorageUrl) {
      try {
        const supabase = createClient();
        // Extract file path from URL
        const url = new URL(invoiceStorageUrl);
        const pathParts = url.pathname.split('/storage/v1/object/public/invoices/');
        if (pathParts[1]) {
          await supabase.storage.from('invoices').remove([decodeURIComponent(pathParts[1])]);
        }
      } catch (err) {
        console.error('Error removing invoice from storage:', err);
      }
    }

    // Clean up local preview URL
    if (invoicePreviewUrl) {
      URL.revokeObjectURL(invoicePreviewUrl);
    }

    setInvoiceFile(null);
    setInvoicePreviewUrl(null);
    setInvoiceStorageUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Generate amortisation schedule preview using daily pro-rata
  const generatePreview = () => {
    setError(null);

    const dateValidation = validateDateRange(startDate, endDate);
    if (!dateValidation.valid) {
      setError(dateValidation.error || 'Invalid date range');
      return;
    }

    if (!totalAmount || parseFloat(totalAmount) <= 0) {
      setError('Please enter a valid total amount greater than 0');
      return;
    }

    const proRataEntries = generateProRataSchedule(startDate, endDate, parseFloat(totalAmount));

    const entries: PreviewEntry[] = proRataEntries.map((entry) => ({
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

    const deferralAcctCode = getDeferralAcctCode();
    if (!deferralAcctCode) {
      setError(
        type === 'PREPAID'
          ? 'No default prepayment asset account configured. Please set it in Settings.'
          : 'No default unearned revenue liability account configured. Please set it in Settings.'
      );
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
        contactName: contactName.trim() || undefined,
        description: description.trim() || undefined,
        invoiceUrl: invoiceStorageUrl || undefined,
        invoiceFilename: invoiceFile?.name || undefined,
      };

      const created = await scheduleApi.createSchedule(request);

      router.push(`/app/schedules/${created.id}?tenantId=${tenantId}`);
    } catch (err: any) {
      console.error('Error creating schedule:', err);
      setError(err.message || 'Failed to create schedule');
    } finally {
      setSubmitting(false);
    }
  };

  // Calculate period count for display (using pro-rata logic)
  const periodCount = useMemo(() => {
    if (startDate && endDate) {
      const validation = validateDateRange(startDate, endDate);
      if (validation.valid) {
        return countProRataPeriods(startDate, endDate);
      }
    }
    return 0;
  }, [startDate, endDate]);

  if (!tenantId) {
    return (
      <div className="container mx-auto p-8">
        <LoadingSpinner message="Loading..." />
      </div>
    );
  }

  return (
    <DashboardLayout tenantId={tenantId}>
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <LoadingSpinner message="Loading account list..." />
        </div>
      ) : (
        <div className="max-w-[1800px] mx-auto space-y-5">
          {error && (
            <ErrorMessage message={error} onDismiss={() => setError(null)} />
          )}

          {/* No default accounts warning */}
          {!getDeferralAcctCode() && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-amber-800">
                  Default {type === 'PREPAID' ? 'Prepayment Asset' : 'Unearned Revenue Liability'} Account not configured
                </p>
                <p className="text-xs text-amber-600 mt-1">
                  Please configure your default accounts in{' '}
                  <button
                    onClick={() => router.push(`/app/settings?tenantId=${tenantId}`)}
                    className="underline font-medium hover:text-amber-800"
                  >
                    Settings
                  </button>{' '}
                  before creating a schedule.
                </p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {/* Left Column - Schedule Details */}
              <div className="lg:col-span-2 space-y-5">
                {/* Schedule Type Card */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="bg-gradient-to-r from-[#6d69ff]/10 via-[#6d69ff]/30 to-[#6d69ff]/10 px-5 py-3">
                    <h3 className="text-base font-bold text-gray-900">Schedule Type</h3>
                  </div>
                  <div className="p-5">
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setType('PREPAID');
                          setShowPreview(false);
                        }}
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
                        <p className="text-[10px] font-normal mt-1 opacity-70">
                          Expense paid upfront, recognised monthly
                        </p>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setType('UNEARNED');
                          setShowPreview(false);
                        }}
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
                        <p className="text-[10px] font-normal mt-1 opacity-70">
                          Revenue received upfront, recognised monthly
                        </p>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Contact & Details Card */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="bg-gradient-to-r from-[#6d69ff]/10 via-[#6d69ff]/30 to-[#6d69ff]/10 px-5 py-3">
                    <h3 className="text-base font-bold text-gray-900">Schedule Details</h3>
                  </div>
                  <div className="p-5 space-y-5">
                    {/* Contact */}
                    <div className="relative">
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        Contact
                      </label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          ref={contactInputRef}
                          type="text"
                          value={contactName}
                          onChange={(e) => {
                            setContactName(e.target.value);
                            setShowContactDropdown(true);
                            setHighlightedIndex(-1);
                          }}
                          onFocus={() => {
                            if (filteredContacts.length > 0) {
                              setShowContactDropdown(true);
                            }
                          }}
                          onKeyDown={handleContactKeyDown}
                          placeholder="Enter contact / customer / supplier name"
                          className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6d69ff] focus:border-transparent text-sm"
                          autoComplete="off"
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Included in the journal narration when posting to Xero
                      </p>

                      {/* Contact suggestions dropdown */}
                      {showContactDropdown && filteredContacts.length > 0 && (
                        <div
                          ref={contactDropdownRef}
                          className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto"
                        >
                          {filteredContacts.map((name, index) => {
                            // Highlight matching text
                            const query = contactName.toLowerCase().trim();
                            const matchIndex = name.toLowerCase().indexOf(query);
                            
                            return (
                              <button
                                key={name}
                                type="button"
                                onClick={() => {
                                  setContactName(name);
                                  setShowContactDropdown(false);
                                  setHighlightedIndex(-1);
                                }}
                                onMouseEnter={() => setHighlightedIndex(index)}
                                className={`w-full px-4 py-2.5 text-left text-sm transition-colors flex items-center gap-3 ${
                                  index === highlightedIndex
                                    ? 'bg-[#6d69ff]/5 text-gray-900'
                                    : 'hover:bg-gray-50 text-gray-700'
                                }`}
                              >
                                <User className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                <span>
                                  {query && matchIndex >= 0 ? (
                                    <>
                                      {name.slice(0, matchIndex)}
                                      <span className="font-semibold text-[#6d69ff]">
                                        {name.slice(matchIndex, matchIndex + query.length)}
                                      </span>
                                      {name.slice(matchIndex + query.length)}
                                    </>
                                  ) : (
                                    name
                                  )}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Dates */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                          Start Date <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="date"
                          value={startDate}
                          onChange={(e) => {
                            setStartDate(e.target.value);
                            setShowPreview(false);
                          }}
                          required
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6d69ff] focus:border-transparent text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                          End Date <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="date"
                          value={endDate}
                          onChange={(e) => {
                            setEndDate(e.target.value);
                            setShowPreview(false);
                          }}
                          required
                          min={startDate}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6d69ff] focus:border-transparent text-sm"
                        />
                      </div>
                    </div>
                    {periodCount > 0 && (
                      <p className="text-xs text-gray-500 -mt-3">
                        {periodCount} {periodCount === 1 ? 'period' : 'periods'} (daily pro-rata)
                      </p>
                    )}

                    {/* Total Amount & Account Selection */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                          Total Amount <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 text-sm">
                            $
                          </span>
                          <input
                            type="number"
                            step="0.01"
                            min="0.01"
                            value={totalAmount}
                            onChange={(e) => {
                              setTotalAmount(e.target.value);
                              setShowPreview(false);
                            }}
                            required
                            placeholder="0.00"
                            className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6d69ff] focus:border-transparent text-sm"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                          {type === 'PREPAID' ? 'Expense Account' : 'Revenue Account'}{' '}
                          <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={type === 'PREPAID' ? expenseAcctCode : revenueAcctCode}
                          onChange={(e) => {
                            if (type === 'PREPAID') {
                              setExpenseAcctCode(e.target.value);
                            } else {
                              setRevenueAcctCode(e.target.value);
                            }
                          }}
                          required
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6d69ff] focus:border-transparent text-sm appearance-none bg-white"
                        >
                          <option value="">Please select an account</option>
                          {getFilteredAccounts(type === 'PREPAID' ? 'EXPENSE' : 'REVENUE').map(
                            (account) => (
                              <option key={account.accountID} value={account.code}>
                                [{account.code}] {account.name}
                              </option>
                            )
                          )}
                        </select>
                      </div>
                    </div>

                    {/* Description */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        Description
                      </label>
                      <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Optional notes or description for this schedule"
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6d69ff] focus:border-transparent text-sm resize-none"
                      />
                    </div>

                    {/* Invoice Upload */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        Invoice
                      </label>
                      {!invoiceFile ? (
                        <label className="flex items-center justify-center gap-2 w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-[#6d69ff] hover:bg-[#6d69ff]/5 transition-colors">
                          <Upload className="w-4 h-4 text-gray-400" />
                          <span className="text-sm text-gray-500">
                            Click to upload invoice (PDF, JPG, PNG)
                          </span>
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png"
                            onChange={handleFileSelect}
                            className="hidden"
                          />
                        </label>
                      ) : (
                        <div className="flex items-center gap-3 px-4 py-3 border border-gray-200 rounded-lg bg-gray-50">
                          <FileText className="w-4 h-4 text-[#6d69ff] flex-shrink-0" />
                          <span className="text-sm text-gray-700 truncate flex-1">
                            {invoiceFile.name}
                          </span>
                          {uploadingInvoice && (
                            <div className="w-4 h-4 border-2 border-[#6d69ff] border-t-transparent rounded-full animate-spin flex-shrink-0"></div>
                          )}
                          <button
                            type="button"
                            onClick={handleRemoveInvoice}
                            className="text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                      <p className="text-xs text-gray-500 mt-1">
                        Optional — attach the related invoice for reference
                      </p>
                    </div>
                  </div>
                </div>

                {/* Preview Button */}
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={generatePreview}
                    className="flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium shadow-sm"
                  >
                    <Eye className="w-4 h-4" />
                    Preview Amortisation Schedule
                  </button>
                </div>

                {/* Amortisation Schedule Preview */}
                {showPreview && previewEntries.length > 0 && (
                  <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden transition-all duration-200">
                    <div className="bg-gradient-to-r from-[#6d69ff]/10 via-[#6d69ff]/30 to-[#6d69ff]/10 px-5 py-3 flex items-center justify-between">
                      <div>
                        <h3 className="text-base font-bold text-gray-900">
                          Amortisation Schedule Preview
                        </h3>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {previewEntries.length}{' '}
                          {previewEntries.length === 1 ? 'period' : 'periods'} — Total:{' '}
                          {formatCurrency(parseFloat(totalAmount))}
                        </p>
                      </div>
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
                              <td className="px-5 py-2.5 text-sm text-gray-700">
                                {entry.period}
                              </td>
                              <td className="px-5 py-2.5 text-sm text-gray-900">
                                {entry.date}
                              </td>
                              <td className="px-5 py-2.5 text-sm text-gray-500 text-right">
                                {entry.days}
                              </td>
                              <td className="px-5 py-2.5 text-sm font-medium text-gray-900 text-right">
                                {formatCurrency(entry.amount)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="bg-gray-50 font-bold">
                            <td className="px-5 py-3 text-sm text-gray-900" colSpan={2}>
                              Total
                            </td>
                            <td className="px-5 py-3 text-sm text-gray-500 text-right">
                              {previewEntries.reduce((sum, e) => sum + e.days, 0)}
                            </td>
                            <td className="px-5 py-3 text-sm text-gray-900 text-right">
                              {formatCurrency(parseFloat(totalAmount))}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column - Summary & Actions */}
              <div className="space-y-5">
                {/* Summary Card */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden sticky top-5">
                  <div className="bg-gradient-to-r from-[#6d69ff]/10 via-[#6d69ff]/30 to-[#6d69ff]/10 px-5 py-3">
                    <h3 className="text-base font-bold text-gray-900">Summary</h3>
                  </div>
                  <div className="p-5 space-y-4">
                    {/* Type Badge */}
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">Type</span>
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                          type === 'PREPAID'
                            ? 'bg-blue-50 text-blue-600'
                            : 'bg-green-50 text-green-600'
                        }`}
                      >
                        {type === 'PREPAID' ? 'Prepayment' : 'Unearned Revenue'}
                      </span>
                    </div>

                    {/* Contact */}
                    {contactName && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500">Contact</span>
                        <span className="text-sm font-medium text-gray-900 truncate ml-2 max-w-[150px]">
                          {contactName}
                        </span>
                      </div>
                    )}

                    {/* Period */}
                    {startDate && endDate && periodCount > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500">Periods</span>
                        <span className="text-sm font-medium text-gray-900">
                          {periodCount} {periodCount === 1 ? 'entry' : 'entries'}
                        </span>
                      </div>
                    )}

                    {/* Amount */}
                    {totalAmount && parseFloat(totalAmount) > 0 && (
                      <>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-500">Total Amount</span>
                          <span className="text-sm font-bold text-gray-900">
                            {formatCurrency(parseFloat(totalAmount))}
                          </span>
                        </div>
                      </>
                    )}

                    {/* Account Info */}
                    {(type === 'PREPAID' ? expenseAcctCode : revenueAcctCode) && (
                      <div className="flex items-start justify-between">
                        <span className="text-sm text-gray-500">
                          {type === 'PREPAID' ? 'Expense Acct' : 'Revenue Acct'}
                        </span>
                        <span className="text-sm text-gray-700 text-right ml-2 max-w-[150px]">
                          {(() => {
                            const code = type === 'PREPAID' ? expenseAcctCode : revenueAcctCode;
                            const account = accounts.find((acc) => acc.code === code);
                            return account ? `[${code}] ${account.name}` : `[${code}]`;
                          })()}
                        </span>
                      </div>
                    )}

                    {/* Deferral Account */}
                    <div className="flex items-start justify-between">
                      <span className="text-sm text-gray-500">Deferral Acct</span>
                      <span className="text-sm text-gray-700 text-right ml-2 max-w-[150px]">
                        {getDeferralAccountDisplay() || (
                          <span className="text-amber-500 text-xs">Not configured</span>
                        )}
                      </span>
                    </div>

                    {/* Divider */}
                    <div className="border-t border-gray-100 pt-4 space-y-3">
                      <button
                        type="submit"
                        disabled={submitting || !getDeferralAcctCode()}
                        className="w-full px-5 py-2.5 bg-[#6d69ff] text-white rounded-lg hover:bg-[#5a56e6] transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed font-medium text-sm shadow-sm"
                      >
                        {submitting ? (
                          <span className="flex items-center justify-center gap-2">
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            Creating...
                          </span>
                        ) : (
                          'Create Schedule'
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => router.back()}
                        className="w-full px-5 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
                      >
                        Cancel
                      </button>
                    </div>

                    {/* Info about deferral */}
                    <div className="bg-gray-50 rounded-lg p-3 mt-2">
                      <div className="flex items-start gap-2">
                        <Info className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
                        <p className="text-[11px] text-gray-500 leading-relaxed">
                          The deferral account is automatically set from your{' '}
                          <button
                            type="button"
                            onClick={() => router.push(`/app/settings?tenantId=${tenantId}`)}
                            className="underline hover:text-gray-700"
                          >
                            default account settings
                          </button>
                          .{' '}
                          {type === 'PREPAID'
                            ? 'For prepayments, this is your Prepayment Asset account.'
                            : 'For unearned revenue, this is your Unearned Revenue Liability account.'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Invoice Preview Card - separate from Summary */}
                {invoiceFile && invoicePreviewUrl && (
                  <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="bg-gradient-to-r from-[#6d69ff]/10 via-[#6d69ff]/30 to-[#6d69ff]/10 px-5 py-3 flex items-center justify-between">
                      <div>
                        <h3 className="text-base font-bold text-gray-900">Invoice Preview</h3>
                        <p className="text-xs text-gray-500 mt-0.5 truncate">{invoiceFile.name}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => window.open(invoicePreviewUrl, '_blank')}
                        className="text-xs text-[#6d69ff] hover:text-[#5a56e6] hover:underline font-medium flex-shrink-0"
                      >
                        Open full size
                      </button>
                    </div>
                    {invoiceFile.type === 'application/pdf' ? (
                      <iframe
                        src={invoicePreviewUrl + '#toolbar=1&navpanes=0'}
                        title="Invoice PDF preview"
                        className="w-full h-[500px] border-0"
                      />
                    ) : (
                      <div className="p-5">
                        <img
                          src={invoicePreviewUrl}
                          alt="Invoice preview"
                          className="w-full h-auto max-h-[500px] object-contain bg-gray-50 rounded-lg"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </form>
        </div>
      )}
    </DashboardLayout>
  );
}

export default function NewSchedulePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-white">
          <div className="fixed inset-y-0 left-0 w-56 bg-[#F9FAFB] z-10 border-r border-gray-200"></div>
          <div className="pl-56">
            <div className="p-8">
              <LoadingSpinner message="Loading..." />
            </div>
          </div>
        </div>
      }
    >
      <NewSchedulePageContent />
    </Suspense>
  );
}
