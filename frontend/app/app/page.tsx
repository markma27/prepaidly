'use client';

export default function AppPage() {
  return (
    <div className="container mx-auto p-8">
      <h1 className="text-3xl font-bold mb-6">Connect to Xero</h1>
      <div className="bg-white shadow rounded-lg p-6">
        <p className="mb-4">Connect your Xero account to start using Prepaidly.</p>
        <button className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
          Connect Xero
        </button>
      </div>
    </div>
  );
}