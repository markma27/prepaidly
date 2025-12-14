interface SuccessMessageProps {
  message: string;
  onDismiss?: () => void;
}

export default function SuccessMessage({ message, onDismiss }: SuccessMessageProps) {
  return (
    <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded mb-6 relative">
      <div className="flex justify-between items-start">
        <div>
          <p className="font-semibold">✓ {message}</p>
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="ml-4 text-green-700 hover:text-green-900"
            aria-label="Close"
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}

