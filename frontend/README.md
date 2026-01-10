# Prepaidly Frontend

Next.js 14 frontend application for connecting to Xero and managing prepaid and unearned revenue schedules.

## Features

- ✅ **Xero OAuth2 Connection** - Securely connect to Xero Demo Company
- ✅ **Chart of Accounts** - Automatically retrieve and display Chart of Accounts
- ✅ **Create Schedules** - Create prepayment or unearned revenue schedules
- ✅ **Auto-generate Journals** - System automatically generates monthly amortization journal entries
- ✅ **Post Journals** - Post journal entries to Xero with one click
- ✅ **Dashboard** - View all schedules and journal entry status

## Tech Stack

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- React Hooks

## Development Setup

### 1. Install Dependencies

```bash
cd frontend
npm install
```

### 2. Configure Environment Variables

Create `.env.local` file (optional, defaults to `http://localhost:8080`):

```env
NEXT_PUBLIC_API_URL=http://localhost:8080
```

### 3. Start Development Server

```bash
npm run dev
```

Frontend will run on `http://localhost:3000`.

### 4. Ensure Backend is Running

Make sure the backend Spring Boot application is running on `http://localhost:8080`.

## Usage Flow

### 1. Connect to Xero

1. Visit `http://localhost:3000/app`
2. Click "Connect to Xero" button
3. On Xero login page, select **Demo Company**
4. Authorize the application

### 2. View Chart of Accounts

After successful connection, the system will automatically retrieve and display the Chart of Accounts.

### 3. Create Schedule

1. Click "Create New Schedule" button
2. Select schedule type:
   - **Prepayment**: Requires expense account and deferral account selection
   - **Unearned Revenue**: Requires revenue account and deferral account selection
3. Fill in date range and total amount
4. Select appropriate accounts from dropdown lists
5. Click "Create Schedule"

The system will automatically generate monthly amortization journal entries.

### 4. Post Journal to Xero

1. View all schedules in the dashboard
2. Find unpublished journal entries
3. Click "Post to Xero" button
4. After confirmation, the journal entry will be posted to Xero

## Page Structure

- `/` - Home page
- `/app` - Xero connection page
- `/app/connected` - Connection success page (displays Chart of Accounts)
- `/app/dashboard` - Dashboard (displays all schedules and journal entries)
- `/app/schedules/new` - Create new schedule page

## API Integration

Frontend communicates with backend API through `lib/api.ts`:

- `xeroAuthApi` - Xero authentication related APIs
- `xeroApi` - Xero data APIs (accounts, invoices, etc.)
- `scheduleApi` - Schedule management APIs
- `journalApi` - Journal posting APIs

## Notes

1. **Demo Company**: Make sure to select Demo Company during OAuth flow
2. **Account Selection**: 
   - System accounts and archived accounts are automatically filtered
   - Only relevant account types are shown based on schedule type
3. **Date Range**: Schedule must span at least one month
4. **Amount**: System automatically distributes total amount evenly across months

## Troubleshooting

### CORS Errors

Ensure backend has CORS configured to allow requests from `http://localhost:3000`.

### API Connection Failures

Check:
1. Is backend running on `http://localhost:8080`?
2. Is environment variable `NEXT_PUBLIC_API_URL` set correctly?
3. Are there any errors in browser console?

### Empty Account List

1. Ensure successful connection to Xero
2. Check if Xero Demo Company has account data
3. Check browser console for error messages
