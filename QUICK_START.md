# Quick Start Guide

Get Prepaidly up and running in 5 steps.

## Prerequisites

- Java 21
- Node.js 18+
- Supabase account (or local PostgreSQL)
- Xero Developer account

## Step 1: Database Setup (5 minutes)

**Using Supabase:**
1. Create project at [supabase.com](https://supabase.com)
2. Go to SQL Editor → Run `database/schema.sql`
3. Copy connection string from Settings → Database

**Using Local PostgreSQL:**
```bash
createdb prepaidly
psql -d prepaidly -f database/schema.sql
```

## Step 2: Configure Xero (5 minutes)

1. Go to [developer.xero.com/myapps](https://developer.xero.com/myapps)
2. Create new app:
   - Type: Partner App
   - Redirect URI: `http://localhost:8080/api/auth/xero/callback`
   - Scopes: Select all required scopes
3. Save Client ID and Client Secret

## Step 3: Configure Backend (2 minutes)

```bash
cd backend/src/main/resources
cp application-local.properties.example application-local.properties
```

Edit `application-local.properties`:
```properties
# Database (Supabase)
spring.datasource.url=jdbc:postgresql://db.xxxxx.supabase.co:5432/postgres?sslmode=require
spring.datasource.username=postgres
spring.datasource.password=YOUR_PASSWORD

# Xero
xero.client.id=YOUR_CLIENT_ID
xero.client.secret=YOUR_CLIENT_SECRET
xero.redirect.uri=http://localhost:8080/api/auth/xero/callback

# Encryption (generate: openssl rand -base64 32)
jasypt.encryptor.password=YOUR_ENCRYPTION_PASSWORD
```

## Step 4: Start Backend (1 minute)

```bash
cd backend
./gradlew bootRun --args='--spring.profiles.active=local'
```

Wait for: `Started PrepaidlyApplication`

## Step 5: Start Frontend (1 minute)

```bash
cd frontend
npm install  # First time only
npm run dev
```

Open: [http://localhost:3000](http://localhost:3000)

## Test Flow

1. **Connect**: Click "Connect to Xero" → Select Demo Company
2. **View Accounts**: Should see Chart of Accounts
3. **Create Schedule**: 
   - Type: Prepaid Expense
   - Dates: 2024-01-01 to 2024-12-31
   - Amount: 12000
   - Select accounts
4. **Post Journal**: Click "Post to Xero" on an entry

## Troubleshooting

- **Backend won't start**: Check database connection and Xero credentials
- **Frontend won't start**: Run `npm install`
- **OAuth fails**: Verify redirect URI matches exactly
- **No accounts**: Check Xero Demo Company has Chart of Accounts

For detailed testing, see [TESTING_GUIDE.md](./TESTING_GUIDE.md)

