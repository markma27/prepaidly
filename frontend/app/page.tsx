export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="z-10 max-w-5xl w-full items-center justify-between font-mono text-sm">
        <h1 className="text-4xl font-bold mb-8">🧾 Prepaidly</h1>
        <p className="text-lg mb-4">
          Automate Xero prepaid expenses and unearned revenue schedule management
        </p>
        <p className="text-sm text-gray-600 mb-8">
          Automate prepaid expenses and unearned revenue schedules with Xero
        </p>
        <div className="mt-8 flex gap-4">
          <a
            href="/app"
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
          >
            Get Started
          </a>
        </div>
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
          <div className="p-4 bg-white rounded-lg shadow">
            <h3 className="font-semibold mb-2">🔗 Connect Xero</h3>
            <p className="text-sm text-gray-600">
              Securely connect to your Xero Demo Company and retrieve Chart of Accounts
            </p>
          </div>
          <div className="p-4 bg-white rounded-lg shadow">
            <h3 className="font-semibold mb-2">📅 Create Schedules</h3>
            <p className="text-sm text-gray-600">
              Create prepaid or unearned revenue schedules with automatic monthly amortization journal entries
            </p>
          </div>
          <div className="p-4 bg-white rounded-lg shadow">
            <h3 className="font-semibold mb-2">📤 Post Journals</h3>
            <p className="text-sm text-gray-600">
              Post journal entries to Xero with one click and track posting status and remaining balance
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}

