# Prepaidly Testing Guide

Complete step-by-step guide to test the Prepaidly application.

## Prerequisites Checklist

Before starting, ensure you have:

- [ ] Java 21 installed
- [ ] Node.js 18+ installed
- [ ] PostgreSQL database (or Supabase account)
- [ ] Xero Developer account
- [ ] Git repository cloned

## Step 1: Database Setup

### Option A: Using Supabase (Recommended)

1. **Create Supabase Project**
   - Go to [https://supabase.com](https://supabase.com)
   - Sign up or log in
   - Click "New Project"
   - Fill in project details and create

2. **Get Connection Details**
   - Go to Settings → Database
   - Copy the connection string
   - Format: `postgresql://postgres:[PASSWORD]@db.xxxxx.supabase.co:5432/postgres`

3. **Run Database Schema**
   - Go to SQL Editor in Supabase dashboard
   - Copy contents of `database/schema.sql`
   - Paste and click "Run"

### Option B: Using Local PostgreSQL

1. **Install PostgreSQL** (if not installed)
2. **Create Database**:
   ```bash
   createdb prepaidly
   ```
3. **Run Schema**:
   ```bash
   psql -d prepaidly -f database/schema.sql
   ```

## Step 2: Configure Xero OAuth

1. **Create Xero App**
   - Go to [https://developer.xero.com/myapps](https://developer.xero.com/myapps)
   - Click "New app" or "Create an app"
   - Fill in:
     - **App name**: Prepaidly
     - **Integration type**: Partner App
     - **Redirect URI**: `http://localhost:8080/api/auth/xero/callback`
     - **Scopes**: Select all required scopes:
       - `offline_access`
       - `accounting.settings.read`
       - `accounting.contacts.read`
       - `accounting.transactions`
       - `accounting.journals.read`
   - Click "Create"
   - **Save your credentials**: Client ID and Client Secret

2. **Get Demo Company Access**
   - Log in to Xero with your account
   - Make sure you have access to a Demo Company
   - If not, create one or request access

## Step 3: Configure Backend

1. **Create Configuration File**
   ```bash
   cd backend/src/main/resources
   cp application-local.properties.example application-local.properties
   ```

2. **Edit `application-local.properties`**
   
   For Supabase:
   ```properties
   # Database
   spring.datasource.url=jdbc:postgresql://db.xxxxx.supabase.co:5432/postgres?sslmode=require
   spring.datasource.username=postgres
   spring.datasource.password=your_supabase_password
   
   # Xero OAuth
   xero.client.id=your_xero_client_id
   xero.client.secret=your_xero_client_secret
   xero.redirect.uri=http://localhost:8080/api/auth/xero/callback
   
   # Encryption (generate with: openssl rand -base64 32)
   jasypt.encryptor.password=your_encryption_password
   ```
   
   For Local PostgreSQL:
   ```properties
   # Database
   spring.datasource.url=jdbc:postgresql://localhost:5432/prepaidly
   spring.datasource.username=postgres
   spring.datasource.password=your_postgres_password
   
   # Xero OAuth (same as above)
   xero.client.id=your_xero_client_id
   xero.client.secret=your_xero_client_secret
   xero.redirect.uri=http://localhost:8080/api/auth/xero/callback
   
   # Encryption
   jasypt.encryptor.password=your_encryption_password
   ```

## Step 4: Start Backend

1. **Navigate to Backend Directory**
   ```bash
   cd backend
   ```

2. **Start Backend with Local Profile**
   ```bash
   ./gradlew bootRun --args='--spring.profiles.active=local'
   ```
   
   Or on Windows:
   ```bash
   gradlew.bat bootRun --args='--spring.profiles.active=local'
   ```

3. **Verify Backend is Running**
   - Wait for startup to complete
   - Check logs for: "Started PrepaidlyApplication"
   - Test health endpoint:
     ```bash
     curl http://localhost:8080/api/health
     ```
   - Should return: `{"status":"UP"}`

## Step 5: Start Frontend

1. **Navigate to Frontend Directory**
   ```bash
   cd frontend
   ```

2. **Install Dependencies** (first time only)
   ```bash
   npm install
   ```

3. **Start Development Server**
   ```bash
   npm run dev
   ```

4. **Verify Frontend is Running**
   - Should see: "Ready on http://localhost:3000"
   - Open browser: `http://localhost:3000`
   - Should see Prepaidly homepage

## Step 6: Test Application Flow

### Test 1: Connect to Xero

1. **Navigate to Connection Page**
   - Click "Get Started" or go to `http://localhost:3000/app`
   - Should see "Connect to Xero" page

2. **Initiate Connection**
   - Click "Connect to Xero" button
   - Should redirect to Xero login page

3. **Complete OAuth Flow**
   - Log in with your Xero account
   - **IMPORTANT**: Select **Demo Company** from organization list
   - Click "Allow access"
   - Should redirect back to `/app/connected`

4. **Verify Connection**
   - Should see "Connection Successful" message
   - Should see tenant name (Demo Company)
   - Should see Chart of Accounts table populated

### Test 2: View Chart of Accounts

1. **Check Account List**
   - On `/app/connected` page
   - Should see table with:
     - Account Code
     - Account Name
     - Type
     - Status
   - System accounts and archived accounts should be filtered out

2. **Verify Account Data**
   - Accounts should be from Xero Demo Company
   - Should see various account types (EXPENSE, REVENUE, ASSET, etc.)

### Test 3: Create Prepaid Expense Schedule

1. **Navigate to Create Schedule**
   - Click "Create New Schedule" button
   - Or go to `/app/schedules/new?tenantId=YOUR_TENANT_ID`

2. **Fill in Schedule Form**
   - **Schedule Type**: Select "Prepaid Expense"
   - **Start Date**: `2024-01-01`
   - **End Date**: `2024-12-31`
   - **Total Amount**: `12000.00`
   - **Expense Account**: Select an expense account from dropdown
   - **Deferral Account**: Select an asset account (e.g., Prepaid Expenses)

3. **Submit Form**
   - Click "Create Schedule"
   - Should redirect to dashboard with success message
   - Should see new schedule in dashboard

4. **Verify Schedule Created**
   - Check dashboard shows:
     - Schedule type: "Prepaid Expense"
     - Date range: Jan 1 - Dec 31, 2024
     - Total amount: $12,000.00
     - 12 journal entries (one per month)
     - All entries show "Not Posted" status

### Test 4: Create Unearned Revenue Schedule

1. **Create Another Schedule**
   - Click "Create New Schedule"
   - **Schedule Type**: Select "Unearned Revenue"
   - **Start Date**: `2024-06-01`
   - **End Date**: `2024-11-30`
   - **Total Amount**: `6000.00`
   - **Revenue Account**: Select a revenue account
   - **Deferral Account**: Select a liability account (e.g., Unearned Revenue)

2. **Verify Schedule**
   - Should see 6 journal entries (June - November)
   - Each entry: $1,000.00

### Test 5: Post Journal Entry to Xero

1. **Navigate to Dashboard**
   - Go to `/app/dashboard?tenantId=YOUR_TENANT_ID`
   - Should see all schedules

2. **Post a Journal Entry**
   - Find a schedule with "Not Posted" entries
   - Click "Post to Xero" button on first entry
   - Confirm in dialog
   - Should see "Posting..." then success message

3. **Verify Posting**
   - Entry status should change to "Posted"
   - Should see Xero Manual Journal ID
   - Remaining balance should decrease
   - Progress should update (e.g., "1 / 12 periods")

4. **Verify in Xero**
   - Log in to Xero Demo Company
   - Go to Accounting → Manual Journals
   - Should see the posted journal entry
   - Verify amounts and accounts are correct

### Test 6: Post Multiple Entries

1. **Post Remaining Entries**
   - Post a few more entries from the same schedule
   - Verify remaining balance decreases correctly
   - Verify progress updates

2. **Check Dashboard Updates**
   - Refresh dashboard
   - Verify all posted entries show correct status
   - Verify remaining balance calculation

## Troubleshooting

### Backend Won't Start

**Check:**
- Java 21 is installed: `java -version`
- Database is accessible
- Configuration file exists and has correct values
- Port 8080 is not in use

**Common Errors:**
- `Connection refused`: Database not running or wrong credentials
- `Port already in use`: Another process using port 8080
- `Missing credentials`: Xero client ID/secret not set

### Frontend Won't Start

**Check:**
- Node.js 18+ installed: `node -v`
- Dependencies installed: `npm install`
- Port 3000 is not in use

**Common Errors:**
- `Module not found`: Run `npm install`
- `Port already in use`: Another process using port 3000

### OAuth Flow Fails

**Check:**
- Xero app redirect URI matches exactly: `http://localhost:8080/api/auth/xero/callback`
- Client ID and Secret are correct
- Selected Demo Company during OAuth

**Common Errors:**
- `redirect_uri_mismatch`: Redirect URI doesn't match Xero app settings
- `invalid_client`: Client ID or Secret incorrect
- `No tenant selected`: Didn't select Demo Company

### Account List Empty

**Check:**
- Successfully connected to Xero
- Demo Company has accounts set up
- Browser console for API errors

**Solution:**
- Verify connection status: `http://localhost:8080/api/auth/xero/status`
- Check Xero Demo Company has Chart of Accounts configured

### Schedule Creation Fails

**Check:**
- All required fields filled
- Date range valid (start < end, spans at least 1 month)
- Amount > 0
- Accounts selected

**Common Errors:**
- `Invalid date range`: End date before start date
- `Missing account`: Account not selected
- `Invalid amount`: Amount must be positive

### Journal Posting Fails

**Check:**
- Xero connection still valid
- Account codes exist in Xero
- Backend logs for detailed error

**Common Errors:**
- `Token expired`: Need to reconnect to Xero
- `Invalid account code`: Account doesn't exist in Xero
- `API rate limit`: Too many requests to Xero

## Testing Checklist

Use this checklist to verify all features:

### Connection & Authentication
- [ ] Backend starts successfully
- [ ] Frontend starts successfully
- [ ] Can connect to Xero
- [ ] OAuth flow completes
- [ ] Connection status shows correctly
- [ ] Chart of Accounts loads

### Schedule Management
- [ ] Can create Prepaid Expense schedule
- [ ] Can create Unearned Revenue schedule
- [ ] Schedule validation works
- [ ] Journal entries generated correctly
- [ ] Schedule displays in dashboard

### Journal Posting
- [ ] Can post journal entry to Xero
- [ ] Status updates after posting
- [ ] Xero Journal ID displayed
- [ ] Remaining balance updates
- [ ] Progress counter updates
- [ ] Journal appears in Xero

### Error Handling
- [ ] Error messages display correctly
- [ ] Invalid inputs show validation errors
- [ ] API errors handled gracefully
- [ ] Loading states work correctly

## Next Steps After Testing

1. **Review Test Results**
   - Document any issues found
   - Verify all features work as expected

2. **Performance Testing**
   - Test with multiple schedules
   - Test with large date ranges
   - Monitor API response times

3. **Edge Cases**
   - Test with very short date ranges
   - Test with very large amounts
   - Test with special characters in account names

4. **Integration Testing**
   - Verify data persists after restart
   - Test token refresh
   - Test multiple Xero organizations

---

**Need Help?** Check the troubleshooting section or review the logs:
- Backend logs: Console output
- Frontend logs: Browser DevTools → Console
- Network requests: Browser DevTools → Network

