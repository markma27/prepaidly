# Connect to Xero Demo Company - Step by Step Guide

## Prerequisites Check

Before connecting, make sure you have:

1. ✅ **Xero Client ID** - Already set in `application-local.properties`
2. ✅ **Xero Client Secret** - Already set in `application-local.properties`
3. ⚠️ **Encryption Password** - Need to set this
4. ⚠️ **Database Password** - Need to set this
5. ✅ **Database Created** - Should be created already

## Step-by-Step Connection Process

### Step 1: Set Encryption Password

You need to set `jasypt.encryptor.password` in `application-local.properties`. 

**Generate a secure password:**
- **Windows PowerShell**: `[Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes((New-Guid).ToString()))`
- **Linux/Mac**: `openssl rand -base64 32`
- Or use any random string (minimum 8 characters)

**Update `application-local.properties`:**
```properties
jasypt.encryptor.password=your-generated-password-here
```

### Step 2: Set Database Password

Update `spring.datasource.password` in `application-local.properties`:
```properties
spring.datasource.password=your_postgres_password
```

### Step 3: Ensure Database is Ready

Make sure your database exists and schema is applied:
```bash
# Check if database exists
psql -l | grep prepaidly

# If not, create it:
createdb prepaidly
psql -d prepaidly -f database/schema.sql
```

### Step 4: Start the Backend Server

**Using Gradle:**
```bash
cd backend
./gradlew bootRun --args='--spring.profiles.active=local'
```

**Using IDE (IntelliJ IDEA/VS Code):**
- Set VM options: `-Dspring.profiles.active=local`
- Or set Active profiles: `local` in Run Configuration

Wait for the server to start completely. You should see:
```
Started PrepaidlyApplication in X.XXX seconds
```

### Step 5: Connect to Xero Demo Company

**Option A: Direct Browser Access (Easiest)**

1. Open your web browser
2. Navigate to: **http://localhost:8080/api/auth/xero/connect**
3. You'll be redirected to Xero login page
4. **Log in** with your Xero account (or create a free account)
5. **Select "Demo Company"** from the list of organizations
6. Click **"Allow access"** or **"Connect"**
7. You'll be redirected back to the callback URL
8. The connection should be saved automatically

**Option B: Using cURL (Command Line)**

```bash
# Windows PowerShell
Invoke-WebRequest -Uri "http://localhost:8080/api/auth/xero/connect" -MaximumRedirection 0 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Headers | Select-Object -ExpandProperty Location

# Linux/Mac
curl -I http://localhost:8080/api/auth/xero/connect
```

Then copy the `Location` URL and open it in your browser.

### Step 6: Verify Connection

**Check connection status:**

```bash
curl http://localhost:8080/api/auth/xero/status
```

Or open in browser: **http://localhost:8080/api/auth/xero/status**

**Expected Response:**
```json
{
  "connections": [
    {
      "tenantId": "xxx-xxx-xxx-xxx",
      "tenantName": "Demo Company",
      "connected": true,
      "message": "Connected"
    }
  ],
  "totalConnections": 1
}
```

## Troubleshooting

### Error: "Failed to generate authorization URL"
- Check that `XERO_CLIENT_ID` is set correctly
- Verify the Xero app is active in Developer Portal
- Check backend logs for errors

### Error: "Failed to exchange code for tokens"
- Check that `XERO_CLIENT_SECRET` is correct
- Verify redirect URI matches exactly: `http://localhost:8080/api/auth/xero/callback`
- Make sure redirect URI is registered in Xero Developer Portal

### Error: Database connection issues
- Verify PostgreSQL is running
- Check `spring.datasource.password` is correct
- Ensure database exists: `createdb prepaidly`

### Error: Encryption issues
- Ensure `jasypt.encryptor.password` is set
- The password must be the same between restarts (tokens are encrypted with it)

### No Demo Company Available?
- Make sure you're logged into Xero with an account that has access to Demo Company
- Demo Company is available in all Xero accounts
- Try logging out and back into Xero

## What Happens After Connection?

1. ✅ Tokens are encrypted and stored in database
2. ✅ Connection is linked to default user (ID: 1)
3. ✅ You can now fetch accounts, invoices, etc.
4. ✅ Tokens will auto-refresh when expired

## Next Steps

After successful connection:
- Test fetching accounts: `GET /api/xero/accounts?tenantId=xxx` (Phase 2)
- Create schedules (Phase 3)
- Post journals (Phase 4)

