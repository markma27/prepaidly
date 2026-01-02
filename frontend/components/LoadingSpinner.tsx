interface LoadingSpinnerProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'spinner' | 'skeleton';
}

export default function LoadingSpinner({ 
  message = 'Loading...', 
  size = 'md',
  variant = 'spinner'
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'h-6 w-6',
    md: 'h-12 w-12',
    lg: 'h-16 w-16',
  };

  if (variant === 'skeleton') {
    return (
      <div className="flex flex-col items-center justify-center py-8 space-y-4 w-full">
        <div className="animate-pulse space-y-3 w-full max-w-md">
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          <div className="h-4 bg-gray-200 rounded w-5/6"></div>
        </div>
        {message && <p className="text-gray-600 text-sm">{message}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-8">
      <div
        className={`animate-spin rounded-full border-b-2 border-blue-600 ${sizeClasses[size]} mb-4`}
      ></div>
      {message && <p className="text-gray-600">{message}</p>}
    </div>
  );
}

