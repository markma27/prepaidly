# Quick Start Guide - Connect to Xero Demo Company

## Quick Setup (5 minutes)

### 1. Get Xero Credentials

1. Go to https://developer.xero.com/myapps
2. Click "New app"
3. Set Redirect URI to: `http://localhost:8080/api/auth/xero/callback`
4. Select scopes: `offline_access`, `accounting.settings.read`, `accounting.contacts.read`, `accounting.transactions`, `accounting.journals.read`
5. Copy your **Client ID** and **Client Secret**

### 2. Create Local Configuration File

Copy the example file and fill in your credentials:

```bash
cd backend/src/main/resources
cp application-local.properties.example application-local.properties
```

Then edit `application-local.properties` and fill in:
- `xero.client.id` - Your Xero Client ID
- `xero.client.secret` - Your Xero Client Secret  
- `spring.datasource.password` - Your PostgreSQL password
- `jasypt.encryptor.password` - Generate a random password (e.g., `openssl rand -base64 32`)

**Note:** `application-local.properties` is gitignored and won't be committed.

### 3. Create Database

```bash
createdb prepaidly
psql -d prepaidly -f database/schema.sql
```

### 4. Start Backend

Start with the `local` profile:

```bash
cd backend
./gradlew bootRun --args='--spring.profiles.active=local'
```

Or if using IDE, set VM options: `-Dspring.profiles.active=local`

### 5. Connect to Xero

Open browser: **http://localhost:8080/api/auth/xero/connect**

1. Login to Xero
2. Select **"Demo Company"**
3. Click **"Allow access"**
4. You'll be redirected back

### 6. Verify Connection

```bash
curl http://localhost:8080/api/auth/xero/status
```

You should see your Demo Company connection!

## What's Next?

- ✅ OAuth2 connection working
- 🔄 Next: Fetch accounts and invoices (Phase 2)

See [XERO_SETUP.md](./XERO_SETUP.md) for detailed documentation.

