'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { scheduleApi } from '@/lib/api';
import { parseDateToYYYYMMDD } from '@/lib/utils';
import type { CreateScheduleRequest, ScheduleType, BulkImportScheduleResponse } from '@/lib/types';
import DashboardLayout from '@/components/DashboardLayout';
import LoadingSpinner from '@/components/LoadingSpinner';
import {
  Upload,
  Download,
  FileText,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowLeft,
  Trash2,
  Eye,
} from 'lucide-react';

const CSV_HEADERS = [
  'type',
  'contact_name',
  'invoice_reference',
  'invoice_date',
  'start_date',
  'end_date',
  'total_amount',
  'expense_account_code',
  'revenue_account_code',
  'deferral_account_code',
  'description',
  'allocation_method',
];

const CSV_TEMPLATE = [
  CSV_HEADERS.join(','),
  'PREPAID,ABC Limited,INV-001,2025-01-15,2025-01-01,2025-12-31,12000.00,6000,,2000,Annual insurance premium,actual',
  'UNEARNED,XYZ Corp,INV-002,2025-02-01,2025-02-01,2025-07-31,6000.00,,4000,2500,Subscription revenue,equal',
].join('\n');

interface ParsedRow {
  rowNumber: number;
  raw: Record<string, string>;
  parsed: CreateScheduleRequest | null;
  errors: string[];
}

function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { headers: [], rows: [] };

  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'));
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;
    for (const ch of lines[i]) {
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    values.push(current.trim());

    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] ?? '';
    });
    rows.push(row);
  }

  return { headers, rows };
}

function validateAndParseRow(raw: Record<string, string>, rowNumber: number, tenantId: string): ParsedRow {
  const errors: string[] = [];

  const typeRaw = (raw.type || '').toUpperCase().trim();
  if (!typeRaw || (typeRaw !== 'PREPAID' && typeRaw !== 'UNEARNED')) {
    errors.push('Type must be PREPAID or UNEARNED');
  }
  const type: ScheduleType = typeRaw === 'UNEARNED' ? 'UNEARNED' : 'PREPAID';

  const contactName = (raw.contact_name || '').trim();
  if (!contactName) errors.push('Contact name is required');

  const invoiceReference = (raw.invoice_reference || '').trim();
  if (!invoiceReference) errors.push('Invoice reference is required');

  const invoiceDateRaw = (raw.invoice_date || '').trim();
  const invoiceDate = invoiceDateRaw ? parseDateToYYYYMMDD(invoiceDateRaw) : null;
  if (!invoiceDate) errors.push('Invoice date is required (YYYY-MM-DD or DD/MM/YYYY)');

  const startDateRaw = (raw.start_date || '').trim();
  const startDate = startDateRaw ? parseDateToYYYYMMDD(startDateRaw) : null;
  if (!startDate) errors.push('Start date is required (YYYY-MM-DD or DD/MM/YYYY)');

  const endDateRaw = (raw.end_date || '').trim();
  const endDate = endDateRaw ? parseDateToYYYYMMDD(endDateRaw) : null;
  if (!endDate) errors.push('End date is required (YYYY-MM-DD or DD/MM/YYYY)');

  if (startDate && endDate && startDate > endDate) {
    errors.push('Start date must be before end date');
  }

  const totalAmountRaw = (raw.total_amount || '').trim().replace(/[,$]/g, '');
  const totalAmount = parseFloat(totalAmountRaw);
  if (isNaN(totalAmount) || totalAmount <= 0) {
    errors.push('Total amount must be a positive number');
  }

  const expenseAcctCode = (raw.expense_account_code || '').trim();
  const revenueAcctCode = (raw.revenue_account_code || '').trim();
  const deferralAcctCode = (raw.deferral_account_code || '').trim();

  if (!deferralAcctCode) errors.push('Deferral account code is required');
  if (type === 'PREPAID' && !expenseAcctCode) errors.push('Expense account code is required for PREPAID type');
  if (type === 'UNEARNED' && !revenueAcctCode) errors.push('Revenue account code is required for UNEARNED type');

  const description = (raw.description || '').trim();
  const allocationMethod = (raw.allocation_method || 'actual').trim().toLowerCase();

  if (errors.length > 0) {
    return { rowNumber, raw, parsed: null, errors };
  }

  return {
    rowNumber,
    raw,
    parsed: {
      tenantId,
      type,
      contactName,
      invoiceReference,
      invoiceDate: invoiceDate!,
      startDate: startDate!,
      endDate: endDate!,
      totalAmount,
      expenseAcctCode: expenseAcctCode || undefined,
      revenueAcctCode: revenueAcctCode || undefined,
      deferralAcctCode,
      description: description || undefined,
      allocationMethod: allocationMethod === 'equal' ? 'equal' : 'actual',
    },
    errors: [],
  };
}

function ImportScheduleContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tenantId, setTenantId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<BulkImportScheduleResponse | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const tid = searchParams.get('tenantId');
    if (tid) setTenantId(tid);
  }, [searchParams]);

  const validRows = useMemo(() => parsedRows.filter((r) => r.parsed !== null), [parsedRows]);
  const invalidRows = useMemo(() => parsedRows.filter((r) => r.errors.length > 0), [parsedRows]);

  const handleDownloadTemplate = useCallback(() => {
    const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'prepaidly_schedule_import_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const handleFileSelect = useCallback(
    (selectedFile: File) => {
      setFile(selectedFile);
      setResult(null);
      setShowPreview(false);

      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        const { rows } = parseCSV(text);
        const parsed = rows.map((raw, i) => validateAndParseRow(raw, i + 2, tenantId));
        setParsedRows(parsed);
        setShowPreview(true);
      };
      reader.readAsText(selectedFile);
    },
    [tenantId]
  );

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      if (f) handleFileSelect(f);
    },
    [handleFileSelect]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const f = e.dataTransfer.files?.[0];
      if (f && (f.name.endsWith('.csv') || f.type === 'text/csv')) {
        handleFileSelect(f);
      }
    },
    [handleFileSelect]
  );

  const handleImport = useCallback(async () => {
    if (validRows.length === 0) return;
    setImporting(true);
    try {
      const response = await scheduleApi.importSchedules({
        tenantId,
        schedules: validRows.map((r) => r.parsed!),
      });
      setResult(response);
    } catch (err: any) {
      setResult({
        success: false,
        totalRequested: validRows.length,
        totalCreated: 0,
        totalFailed: validRows.length,
        createdSchedules: [],
        errors: [{ rowNumber: 0, message: err.message || 'Import failed' }],
      });
    } finally {
      setImporting(false);
    }
  }, [validRows, tenantId]);

  const handleReset = useCallback(() => {
    setFile(null);
    setParsedRows([]);
    setResult(null);
    setShowPreview(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  if (!tenantId) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-8">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden w-full max-w-[500px]">
          <div className="bg-gradient-to-r from-[#6d69ff]/10 via-[#6d69ff]/30 to-[#6d69ff]/10 px-5 py-3">
            <h3 className="text-base font-bold text-gray-900">Import Schedules</h3>
            <p className="text-xs text-gray-500 mt-0.5">Upload schedules via CSV</p>
          </div>
          <div className="flex justify-center items-center py-12">
            <LoadingSpinner message="Loading..." />
          </div>
        </div>
      </div>
    );
  }

  return (
    <DashboardLayout tenantId={tenantId}>
      <div className="max-w-[1800px] mx-auto space-y-5">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <button
              onClick={() => router.push(`/app/schedules/register?tenantId=${tenantId}`)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-violet-700 bg-violet-100 rounded-lg hover:bg-violet-200 transition-colors mb-3"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Schedules
            </button>
            <h1 className="text-2xl font-bold text-gray-900">Import Schedules via CSV</h1>
            <p className="text-sm text-gray-500 mt-1">
              Upload a CSV file to create multiple schedules at once
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Left Column - Upload and Preview */}
          <div className="lg:col-span-2 space-y-5">
            {/* Results */}
            {result && (
              <div
                className={`rounded-xl border p-5 ${
                  result.totalFailed === 0
                    ? 'bg-green-50 border-green-200'
                    : result.totalCreated > 0
                    ? 'bg-yellow-50 border-yellow-200'
                    : 'bg-red-50 border-red-200'
                }`}
              >
                <div className="flex items-start gap-3">
                  {result.totalFailed === 0 ? (
                    <CheckCircle2 className="w-6 h-6 text-green-500 flex-shrink-0" />
                  ) : result.totalCreated > 0 ? (
                    <AlertTriangle className="w-6 h-6 text-yellow-500 flex-shrink-0" />
                  ) : (
                    <XCircle className="w-6 h-6 text-red-500 flex-shrink-0" />
                  )}
                  <div className="flex-1">
                    <h3
                      className={`text-sm font-bold ${
                        result.totalFailed === 0
                          ? 'text-green-800'
                          : result.totalCreated > 0
                          ? 'text-yellow-800'
                          : 'text-red-800'
                      }`}
                    >
                      {result.totalFailed === 0
                        ? 'Import Successful!'
                        : result.totalCreated > 0
                        ? 'Import Partially Successful'
                        : 'Import Failed'}
                    </h3>
                    <p className="text-xs mt-1 text-gray-600">
                      {result.totalCreated} of {result.totalRequested} schedule
                      {result.totalRequested !== 1 ? 's' : ''} created successfully.
                      {result.totalFailed > 0 &&
                        ` ${result.totalFailed} failed.`}
                    </p>

                    {result.errors.length > 0 && (
                      <div className="mt-3 space-y-1">
                        <p className="text-xs font-semibold text-red-700">Server-side errors:</p>
                        {result.errors.map((err, i) => (
                          <p key={i} className="text-xs text-red-600">
                            {err.rowNumber > 0 ? `Row ${err.rowNumber}: ` : ''}
                            {err.message}
                          </p>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center gap-3 mt-4">
                      <button
                        onClick={() => router.push(`/app/schedules/register?tenantId=${tenantId}`)}
                        className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#6d69ff] rounded-lg hover:bg-[#5b57e6] transition-colors"
                      >
                        View Schedule Register
                      </button>
                      <button
                        onClick={handleReset}
                        className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        Import More
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Upload CSV */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden transition-all duration-200 hover:shadow-md hover:border-gray-300">
              <div className="bg-gradient-to-r from-[#6d69ff]/10 via-[#6d69ff]/30 to-[#6d69ff]/10 px-5 py-3">
                <h3 className="text-base font-bold text-gray-900">Upload CSV File</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Select or drag and drop your completed CSV file
                </p>
              </div>
              <div className="p-5">
                <div
                  className={`border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200 ${
                    dragOver
                      ? 'border-[#6d69ff] bg-[#6d69ff]/5'
                      : file
                      ? 'border-green-300 bg-green-50'
                      : 'border-gray-300 hover:border-[#6d69ff]/50 hover:bg-gray-50'
                  }`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                >
                  {file ? (
                    <div className="flex flex-col items-center gap-2">
                      <FileText className="w-10 h-10 text-green-500" />
                      <p className="text-sm font-medium text-gray-900">{file.name}</p>
                      <p className="text-xs text-gray-500">
                        {parsedRows.length} row{parsedRows.length !== 1 ? 's' : ''} detected &middot;{' '}
                        <span className="text-green-600">{validRows.length} valid</span>
                        {invalidRows.length > 0 && (
                          <span className="text-red-500"> &middot; {invalidRows.length} with errors</span>
                        )}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <button
                          onClick={() => setShowPreview(!showPreview)}
                          className="flex items-center gap-1 text-xs text-[#6d69ff] hover:underline"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          {showPreview ? 'Hide' : 'Show'} Preview
                        </button>
                        <button
                          onClick={handleReset}
                          className="flex items-center gap-1 text-xs text-red-500 hover:underline"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Remove
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <Upload className="w-10 h-10 text-gray-400" />
                      <p className="text-sm text-gray-600">
                        Drag and drop your CSV file here, or{' '}
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="text-[#6d69ff] font-semibold hover:underline"
                        >
                          browse
                        </button>
                      </p>
                      <p className="text-xs text-gray-400">Only .csv files accepted</p>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={handleFileInputChange}
              />
            </div>
          </div>
        </div>

        {/* Error rows detail */}
        {showPreview && invalidRows.length > 0 && !result && (
          <div className="bg-red-50 rounded-xl border border-red-200 p-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-red-700">
                  {invalidRows.length} row{invalidRows.length !== 1 ? 's' : ''} with validation errors
                </p>
                <p className="text-xs text-red-600 mt-0.5">
                  These rows will be skipped during import. Fix the errors and re-upload to include them.
                </p>
                <ul className="mt-2 space-y-1">
                  {invalidRows.map((row) => (
                    <li key={row.rowNumber} className="text-xs text-red-600">
                      <span className="font-medium">Row {row.rowNumber}:</span>{' '}
                      {row.errors.join('; ')}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Preview Table */}
        {showPreview && parsedRows.length > 0 && !result && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden transition-all duration-200 hover:shadow-md hover:border-gray-300">
            <div className="bg-gradient-to-r from-[#6d69ff]/10 via-[#6d69ff]/30 to-[#6d69ff]/10 px-5 py-3 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-gray-900">Preview</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Review parsed data before importing
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-3 text-xs">
                  <span className="flex items-center gap-1 text-green-600 font-medium">
                    <CheckCircle2 className="w-4 h-4" /> {validRows.length} valid
                  </span>
                  {invalidRows.length > 0 && (
                    <span className="flex items-center gap-1 text-red-500 font-medium">
                      <XCircle className="w-4 h-4" /> {invalidRows.length} errors
                    </span>
                  )}
                </div>
                {validRows.length > 0 && (
                  <button
                    onClick={handleImport}
                    disabled={importing}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-[#6d69ff] rounded-lg hover:bg-[#5b57e6] transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {importing ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Importing...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4" />
                        Import {validRows.length} Valid
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
            <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    <th className="px-4 py-3 w-8">#</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Contact</th>
                    <th className="px-4 py-3">Invoice Ref</th>
                    <th className="px-4 py-3">Invoice Date</th>
                    <th className="px-4 py-3">Start</th>
                    <th className="px-4 py-3">End</th>
                    <th className="px-4 py-3 text-right">Amount</th>
                    <th className="px-4 py-3">Expense Acct</th>
                    <th className="px-4 py-3">Revenue Acct</th>
                    <th className="px-4 py-3">Deferral Acct</th>
                    <th className="px-4 py-3">Method</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {parsedRows.map((row) => (
                    <tr
                      key={row.rowNumber}
                      className={row.errors.length > 0 ? 'bg-red-50/50' : 'hover:bg-gray-50 transition-colors'}
                    >
                      <td className="px-4 py-3 text-gray-400">{row.rowNumber}</td>
                      <td className="px-4 py-3">
                        {row.errors.length > 0 ? (
                          <span
                            className="flex items-center gap-1 text-red-500 cursor-help"
                            title={row.errors.join('; ')}
                          >
                            <XCircle className="w-3.5 h-3.5 flex-shrink-0" />
                            <span className="truncate max-w-[120px]">{row.errors[0]}</span>
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-green-600">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Valid
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                            (row.raw.type || '').toUpperCase() === 'PREPAID'
                              ? 'bg-blue-50 text-blue-600'
                              : (row.raw.type || '').toUpperCase() === 'UNEARNED'
                              ? 'bg-green-50 text-green-600'
                              : 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          {row.raw.type || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-900 font-medium">{row.raw.contact_name || '—'}</td>
                      <td className="px-4 py-3 text-gray-900">{row.raw.invoice_reference || '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{row.raw.invoice_date || '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{row.raw.start_date || '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{row.raw.end_date || '—'}</td>
                      <td className="px-4 py-3 text-right font-bold text-gray-900">
                        {row.raw.total_amount || '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{row.raw.expense_account_code || '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{row.raw.revenue_account_code || '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{row.raw.deferral_account_code || '—'}</td>
                      <td className="px-4 py-3 text-gray-500">{row.raw.allocation_method || 'actual'}</td>
                    </tr>
                  ))}
                </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Instructions */}
          <div className="space-y-5">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden transition-all duration-200 hover:shadow-md hover:border-gray-300">
              <div className="bg-gradient-to-r from-[#6d69ff]/10 via-[#6d69ff]/30 to-[#6d69ff]/10 px-5 py-3">
                <h3 className="text-base font-bold text-gray-900">Instructions</h3>
                <p className="text-xs text-gray-500 mt-0.5">How to import schedules</p>
              </div>
              <div className="p-5 space-y-5">
                <ol className="text-sm text-gray-600 space-y-2 list-decimal list-inside">
                  <li>Download the CSV template</li>
                  <li>Fill in your schedule data</li>
                  <li>Upload the completed file</li>
                </ol>
                
                <button
                  onClick={handleDownloadTemplate}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-[#6d69ff] bg-white border border-[#6d69ff]/30 rounded-lg hover:bg-[#6d69ff]/5 hover:border-[#6d69ff]/50 transition-all duration-200"
                >
                  <Download className="w-4 h-4" />
                  Download Template
                </button>

                <div className="pt-5 border-t border-gray-100">
                  <h4 className="text-sm font-semibold text-gray-900 mb-3">Required Columns</h4>
                  <ul className="text-xs text-gray-600 space-y-2">
                    <li className="flex items-start gap-2">
                      <span className="text-red-500 mt-0.5">*</span>
                      <div>
                        <span className="font-semibold text-gray-900">type</span>
                        <p className="text-gray-500">PREPAID or UNEARNED</p>
                      </div>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-red-500 mt-0.5">*</span>
                      <div>
                        <span className="font-semibold text-gray-900">contact_name</span>
                      </div>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-red-500 mt-0.5">*</span>
                      <div>
                        <span className="font-semibold text-gray-900">invoice_reference</span>
                      </div>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-red-500 mt-0.5">*</span>
                      <div>
                        <span className="font-semibold text-gray-900">invoice_date</span>
                        <p className="text-gray-500">YYYY-MM-DD or DD/MM/YYYY</p>
                      </div>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-red-500 mt-0.5">*</span>
                      <div>
                        <span className="font-semibold text-gray-900">start_date</span>
                        <p className="text-gray-500">YYYY-MM-DD or DD/MM/YYYY</p>
                      </div>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-red-500 mt-0.5">*</span>
                      <div>
                        <span className="font-semibold text-gray-900">end_date</span>
                        <p className="text-gray-500">YYYY-MM-DD or DD/MM/YYYY</p>
                      </div>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-red-500 mt-0.5">*</span>
                      <div>
                        <span className="font-semibold text-gray-900">total_amount</span>
                        <p className="text-gray-500">Positive number</p>
                      </div>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-red-500 mt-0.5">*</span>
                      <div>
                        <span className="font-semibold text-gray-900">deferral_account_code</span>
                      </div>
                    </li>
                  </ul>
                </div>

                <div className="pt-4 border-t border-gray-100">
                  <h4 className="text-sm font-semibold text-gray-900 mb-3">Conditional Columns</h4>
                  <ul className="text-xs text-gray-600 space-y-2">
                    <li className="flex items-start gap-2">
                      <span className="text-gray-400 mt-0.5">•</span>
                      <div>
                        <span className="font-semibold text-gray-900">expense_account_code</span>
                        <p className="text-gray-500">Required if type is PREPAID</p>
                      </div>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-gray-400 mt-0.5">•</span>
                      <div>
                        <span className="font-semibold text-gray-900">revenue_account_code</span>
                        <p className="text-gray-500">Required if type is UNEARNED</p>
                      </div>
                    </li>
                  </ul>
                </div>

                <div className="pt-4 border-t border-gray-100">
                  <h4 className="text-sm font-semibold text-gray-900 mb-3">Optional Columns</h4>
                  <ul className="text-xs text-gray-600 space-y-2">
                    <li className="flex items-start gap-2">
                      <span className="text-gray-400 mt-0.5">•</span>
                      <div>
                        <span className="font-semibold text-gray-900">description</span>
                      </div>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-gray-400 mt-0.5">•</span>
                      <div>
                        <span className="font-semibold text-gray-900">allocation_method</span>
                        <p className="text-gray-500">"actual" (default) or "equal"</p>
                      </div>
                    </li>
                  </ul>
                </div>

              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

export default function ImportSchedulePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-white">
          <div className="fixed inset-y-0 left-0 w-56 bg-[#F9FAFB] z-10 border-r border-gray-200" />
          <div className="pl-56">
            <div className="p-8 max-w-[1800px] mx-auto">
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="bg-gradient-to-r from-[#6d69ff]/10 via-[#6d69ff]/30 to-[#6d69ff]/10 px-5 py-3">
                  <h3 className="text-base font-bold text-gray-900">Import Schedules</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Upload schedules via CSV</p>
                </div>
                <div className="flex justify-center items-center py-12">
                  <LoadingSpinner message="Loading..." />
                </div>
              </div>
            </div>
          </div>
        </div>
      }
    >
      <ImportScheduleContent />
    </Suspense>
  );
}
