import Skeleton from './Skeleton';

export default function EditScheduleSkeleton() {
  return (
    <div className="max-w-[1800px] mx-auto w-full space-y-5">
      {/* Back button */}
      <Skeleton className="h-5 w-40" variant="text" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 w-full">
        {/* Left: Schedule Type & Invoice + Schedule Period & Posting */}
        <div className="lg:col-span-2 space-y-5 w-full">
          {/* Card 1: Schedule Type & Invoice */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden w-full">
            <div className="bg-gradient-to-r from-[#6d69ff]/10 via-[#6d69ff]/30 to-[#6d69ff]/10 px-5 py-3">
              <h3 className="text-base font-bold text-gray-900">Schedule Type & Invoice</h3>
              <p className="text-xs text-gray-500 mt-0.5">Type, contact and invoice details</p>
            </div>
            <div className="p-5 space-y-5">
              <div>
                <div className="h-4 w-28 mb-1.5 rounded overflow-hidden"><Skeleton className="h-full w-full" variant="rectangular" /></div>
                <div className="flex gap-3">
                  <div className="h-[3.75rem] flex-1 rounded-lg overflow-hidden"><Skeleton className="h-full w-full rounded-lg" variant="rectangular" /></div>
                  <div className="h-[3.75rem] flex-1 rounded-lg overflow-hidden"><Skeleton className="h-full w-full rounded-lg" variant="rectangular" /></div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="h-4 w-20 mb-1.5 rounded overflow-hidden"><Skeleton className="h-full w-full" variant="rectangular" /></div>
                  <div className="h-10 w-full rounded-lg overflow-hidden"><Skeleton className="h-full w-full rounded-lg" variant="rectangular" /></div>
                </div>
                <div>
                  <div className="h-4 w-28 mb-1.5 rounded overflow-hidden"><Skeleton className="h-full w-full" variant="rectangular" /></div>
                  <div className="h-10 w-full rounded-lg overflow-hidden"><Skeleton className="h-full w-full rounded-lg" variant="rectangular" /></div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="h-4 w-24 mb-1.5 rounded overflow-hidden"><Skeleton className="h-full w-full" variant="rectangular" /></div>
                  <div className="h-10 w-full rounded-lg overflow-hidden"><Skeleton className="h-full w-full rounded-lg" variant="rectangular" /></div>
                </div>
                <div>
                  <div className="h-4 w-24 mb-1.5 rounded overflow-hidden"><Skeleton className="h-full w-full" variant="rectangular" /></div>
                  <div className="h-10 w-full rounded-lg overflow-hidden"><Skeleton className="h-full w-full rounded-lg" variant="rectangular" /></div>
                </div>
              </div>
              <div>
                <div className="h-4 w-16 mb-1.5 rounded overflow-hidden"><Skeleton className="h-full w-full" variant="rectangular" /></div>
                <div className="h-12 w-full rounded-lg overflow-hidden border border-gray-200"><Skeleton className="h-full w-full rounded-lg" variant="rectangular" /></div>
              </div>
            </div>
          </div>

          {/* Card 2: Schedule Period & Posting */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden w-full">
            <div className="bg-gradient-to-r from-[#6d69ff]/10 via-[#6d69ff]/30 to-[#6d69ff]/10 px-5 py-3">
              <h3 className="text-base font-bold text-gray-900">Schedule Period & Posting</h3>
              <p className="text-xs text-gray-500 mt-0.5">Dates, accounts and amortisation</p>
            </div>
            <div className="p-5 space-y-5">
              <div>
                <div className="h-4 w-36 mb-1.5 rounded overflow-hidden"><Skeleton className="h-full w-full" variant="rectangular" /></div>
                <div className="flex gap-3">
                  <div className="h-[3.75rem] flex-1 rounded-lg overflow-hidden"><Skeleton className="h-full w-full rounded-lg" variant="rectangular" /></div>
                  <div className="h-[3.75rem] flex-1 rounded-lg overflow-hidden"><Skeleton className="h-full w-full rounded-lg" variant="rectangular" /></div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="h-4 w-20 mb-1.5 rounded overflow-hidden"><Skeleton className="h-full w-full" variant="rectangular" /></div>
                  <div className="h-10 w-full rounded-lg overflow-hidden"><Skeleton className="h-full w-full rounded-lg" variant="rectangular" /></div>
                </div>
                <div>
                  <div className="h-4 w-20 mb-1.5 rounded overflow-hidden"><Skeleton className="h-full w-full" variant="rectangular" /></div>
                  <div className="h-10 w-full rounded-lg overflow-hidden"><Skeleton className="h-full w-full rounded-lg" variant="rectangular" /></div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="h-4 w-32 mb-1.5 rounded overflow-hidden"><Skeleton className="h-full w-full" variant="rectangular" /></div>
                  <div className="h-10 w-full rounded-lg overflow-hidden"><Skeleton className="h-full w-full rounded-lg" variant="rectangular" /></div>
                </div>
                <div>
                  <div className="h-4 w-24 mb-1.5 rounded overflow-hidden"><Skeleton className="h-full w-full" variant="rectangular" /></div>
                  <div className="h-10 w-full rounded-lg overflow-hidden"><Skeleton className="h-full w-full rounded-lg" variant="rectangular" /></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Summary */}
        <div className="space-y-5 w-full">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden w-full">
            <div className="bg-gradient-to-r from-[#6d69ff]/10 via-[#6d69ff]/30 to-[#6d69ff]/10 px-5 py-3">
              <h3 className="text-base font-bold text-gray-900">Summary</h3>
              <p className="text-xs text-gray-500 mt-0.5">Preview schedule totals and period breakdown</p>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex justify-between items-center gap-2">
                <Skeleton className="h-4 w-12 rounded" variant="rectangular" />
                <Skeleton className="h-5 w-20 rounded-md" variant="rectangular" />
              </div>
              <div className="flex justify-between items-center gap-2">
                <Skeleton className="h-4 w-16 rounded" variant="rectangular" />
                <Skeleton className="h-4 w-24 rounded" variant="rectangular" />
              </div>
              <div className="flex justify-between items-center gap-2">
                <Skeleton className="h-4 w-24 rounded" variant="rectangular" />
                <Skeleton className="h-4 w-28 rounded" variant="rectangular" />
              </div>
              <div className="flex justify-between items-center gap-2">
                <Skeleton className="h-4 w-20 rounded" variant="rectangular" />
                <Skeleton className="h-4 w-24 rounded" variant="rectangular" />
              </div>
              <div className="flex justify-between items-center gap-2">
                <Skeleton className="h-4 w-24 rounded" variant="rectangular" />
                <Skeleton className="h-4 w-20 rounded" variant="rectangular" />
              </div>
              <div className="border-t border-gray-100 pt-4 space-y-3">
                <Skeleton className="h-10 w-full rounded-lg" variant="rectangular" />
                <Skeleton className="h-10 w-full rounded-lg" variant="rectangular" />
                <Skeleton className="h-10 w-full rounded-lg" variant="rectangular" />
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <Skeleton className="h-10 w-full rounded opacity-70" variant="rectangular" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
