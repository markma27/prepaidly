# Xero Demo Company Connection Guide

This guide will walk you through connecting Prepaidly to Xero Demo Company.

## Prerequisites

1. **Xero Developer Account**: Sign up at [Xero Developer Portal](https://developer.xero.com/)
2. **Create an App**: Create a new app in the Xero Developer Portal
3. **Database**: PostgreSQL database should be set up and running
4. **Environment Variables**: Configure required environment variables

## Step 1: Create Xero App

1. Go to [https://developer.xero.com/myapps](https://developer.xero.com/myapps)
2. Click **"New app"** or **"Create an app"**
3. Fill in the app details:
   - **App name**: Prepaidly (or your preferred name)
   - **Integration type**: Select **"Partner App"** (for OAuth 2.0)
   - **Redirect URI**: `http://localhost:8080/api/auth/xero/callback`
   - **Scopes**: Select the following scopes:
     - `offline_access` (required for refresh tokens)
     - `accounting.settings.read`
     - `accounting.contacts.read`
     - `accounting.transactions` (to create Manual Journals)
     - `accounting.journals.read` (to verify postings)

4. Click **"Create"**
5. **Save your credentials**:
   - **Client ID** (you'll need this)
   - **Client Secret** (you'll need this - keep it secure!)

## Step 2: Configure Local Properties File

**Recommended Method**: Create `application-local.properties` file

1. Copy the example file:
   ```bash
   cd backend/src/main/resources
   cp application-local.properties.example application-local.properties
   ```

2. Edit `application-local.properties` and fill in your actual values:
   ```properties
   # Database
   spring.datasource.password=your_postgres_password

   # Xero OAuth2 Credentials
   xero.client.id=your_client_id_from_step_1
   xero.client.secret=your_client_secret_from_step_1
   xero.redirect.uri=http://localhost:8080/api/auth/xero/callback

   # Encryption (generate a random string, e.g., use: openssl rand -base64 32)
   jasypt.encryptor.password=your_encryption_password

   # Optional - JWT (for future use)
   jwt.secret=your_jwt_secret

   # Optional - Sentry (for error tracking)
   # sentry.dsn=your_sentry_dsn
   # sentry.environment=development
   ```

3. **Important**: `application-local.properties` is gitignored and will not be committed to the repository.

### Alternative: Use Environment Variables

If you prefer environment variables instead:

```bash
# Database
export DB_USERNAME=postgres
export DB_PASSWORD=your_postgres_password

# Xero OAuth2 Credentials
export XERO_CLIENT_ID=your_client_id_from_step_1
export XERO_CLIENT_SECRET=your_client_secret_from_step_1
export XERO_REDIRECT_URI=http://localhost:8080/api/auth/xero/callback

# Encryption (generate a random string, e.g., use: openssl rand -base64 32)
export JASYPT_PASSWORD=your_encryption_password

# Optional - JWT (for future use)
export JWT_SECRET=your_jwt_secret
```

## Step 3: Set Up Database

1. Create the database:
```bash
createdb prepaidly
```

2. Run the schema:
```bash
psql -d prepaidly -f database/schema.sql
```

The application will automatically create a default user (`demo@prepaidly.io`) on first startup.

## Step 4: Start the Backend

Start with the `local` profile to use `application-local.properties`:

```bash
cd backend
./gradlew bootRun --args='--spring.profiles.active=local'
```

**Or if using IDE:**
- Set VM options: `-Dspring.profiles.active=local`
- Or set Active profiles: `local` in Run Configuration

**If using environment variables** (without `application-local.properties`):
```bash
cd backend
./gradlew bootRun
```

## Step 5: Connect to Xero Demo Company

### Option A: Using Browser Directly

1. Open your browser and navigate to:
   ```
   http://localhost:8080/api/auth/xero/connect
   ```

2. You'll be redirected to Xero login page
3. Log in with your Xero account (or create a free one)
4. Select **"Demo Company"** from the list of organizations
5. Click **"Allow access"**
6. You'll be redirected back to the callback URL
7. The app will store the connection and redirect you to the frontend

### Option B: Using Frontend (when implemented)

1. Start the frontend:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

2. Navigate to `http://localhost:3000/app`
3. Click **"Connect Xero"** button
4. Follow the OAuth flow

## Step 6: Verify Connection

Check the connection status:

```bash
curl http://localhost:8080/api/auth/xero/status
```

Or visit in browser:
```
http://localhost:8080/api/auth/xero/status
```

Expected response:
```json
{
  "connections": [
    {
      "tenantId": "your-tenant-id",
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
- Verify the Xero app is created and active

### Error: "Failed to exchange code for tokens"
- Check that `XERO_CLIENT_SECRET` is set correctly
- Verify the redirect URI matches exactly in Xero Developer Portal
- Check that the authorization code hasn't expired (they expire quickly)

### Error: "No tenant information in token response"
- Make sure you selected an organization (Demo Company) during OAuth flow
- Check Xero API status

### Error: Database connection issues
- Verify PostgreSQL is running
- Check database credentials
- Ensure database exists: `createdb prepaidly`

### Error: Encryption issues
- Ensure `JASYPT_PASSWORD` is set
- The password must be the same between restarts (tokens are encrypted)

### Token Refresh Issues
- The app automatically refreshes tokens when they expire
- If refresh fails, you may need to reconnect: delete the connection and go through OAuth again

## Testing the Connection

Once connected, you can test fetching data:

```bash
# This endpoint will be implemented in Phase 2
curl http://localhost:8080/api/xero/accounts?tenantId=your-tenant-id
```

## Security Notes

⚠️ **Important for Production**:
- Never commit `.env` files or `application-local.properties` with real credentials
- Use environment variables or a secrets management system
- The encryption password (`JASYPT_PASSWORD`) must be kept secure
- In production, implement proper user authentication (currently using default user ID)

## Next Steps

After successfully connecting to Xero Demo Company:
1. ✅ Phase 1 complete - OAuth2 connection working
2. Move to Phase 2: Fetch accounts and invoices from Xero
3. Implement proper user authentication

## Useful Links

- [Xero Developer Portal](https://developer.xero.com/)
- [Xero OAuth 2.0 Documentation](https://developer.xero.com/documentation/oauth2/overview)
- [Xero API Documentation](https://developer.xero.com/documentation/api/accounting/overview)
- [Xero Java SDK](https://github.com/XeroAPI/Xero-Java)

