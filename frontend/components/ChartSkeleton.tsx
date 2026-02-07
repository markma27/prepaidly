import Skeleton from './Skeleton';

/** Bar heights in pixels (chart is 270px tall) - bar chart style */
const BAR_HEIGHTS_PX = [176, 108, 216, 135, 257, 95, 189, 149, 238, 122];

const CHART_HEIGHT = 270;

export default function ChartSkeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`flex items-end gap-2 w-full rounded ${className}`}
      style={{ height: CHART_HEIGHT }}
      aria-hidden
    >
      {BAR_HEIGHTS_PX.map((heightPx, i) => (
        <div key={i} className="flex-1 flex flex-col justify-end min-w-0">
          <div
            style={{ height: heightPx }}
            className="w-full rounded-t overflow-hidden"
          >
            <Skeleton className="h-full w-full rounded-t" variant="rectangular" />
          </div>
        </div>
      ))}
    </div>
  );
}
