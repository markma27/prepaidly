interface ErrorMessageProps {
  message: string;
  onDismiss?: () => void;
}

export default function ErrorMessage({ message, onDismiss }: ErrorMessageProps) {
  return (
    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6 relative">
      <div className="flex justify-between items-start">
        <div>
          <p className="font-semibold">Error</p>
          <p>{message}</p>
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="ml-4 text-red-700 hover:text-red-900"
            aria-label="Close"
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}

