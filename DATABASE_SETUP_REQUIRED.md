# Database Setup Required ⚠️

## Current Error

The backend is failing because it cannot connect to the database:

```
Connection to localhost:5432 refused
```

## You Have Two Options

### Option 1: Use Supabase (Recommended - Easier)

**Advantages:**
- No local installation needed
- Free tier available
- Easy to set up
- Web-based management

**Steps:**

1. **Create Supabase Project**
   - Go to https://supabase.com
   - Sign up/login
   - Create new project
   - Wait for project to be ready (~2 minutes)

2. **Get Connection Details**
   - Go to Settings → Database
   - Copy the connection string
   - Format: `postgresql://postgres:[PASSWORD]@db.xxxxx.supabase.co:5432/postgres`

3. **Run Database Schema**
   - Go to SQL Editor in Supabase dashboard
   - Copy contents of `database/schema.sql`
   - Paste and click "Run"

4. **Configure Backend**
   - Edit `backend/src/main/resources/application-local.properties`
   - Update database section:
   ```properties
   spring.datasource.url=jdbc:postgresql://db.xxxxx.supabase.co:5432/postgres?sslmode=require
   spring.datasource.username=postgres
   spring.datasource.password=YOUR_SUPABASE_PASSWORD
   ```

### Option 2: Use Local PostgreSQL

**Advantages:**
- Works offline
- Full control
- No external dependencies

**Steps:**

1. **Install PostgreSQL**
   - Download from: https://www.postgresql.org/download/windows/
   - Install with default settings
   - Remember the password you set!

2. **Create Database**
   ```powershell
   # Open PostgreSQL command line (psql)
   createdb prepaidly
   ```

3. **Run Schema**
   ```powershell
   psql -d prepaidly -f database/schema.sql
   ```

4. **Configure Backend**
   - Edit `backend/src/main/resources/application-local.properties`
   - Update database section:
   ```properties
   spring.datasource.url=jdbc:postgresql://localhost:5432/prepaidly
   spring.datasource.username=postgres
   spring.datasource.password=YOUR_POSTGRES_PASSWORD
   ```

## Next Steps After Database Setup

1. **Configure Xero Credentials** in `application-local.properties`
2. **Set Encryption Password** (generate with: `openssl rand -base64 32`)
3. **Restart Backend**

## Quick Test

After configuring database, test connection:

```powershell
# If using Supabase, test from Supabase dashboard SQL Editor:
SELECT 1;

# If using local PostgreSQL:
psql -d prepaidly -c "SELECT 1;"
```

## Still Having Issues?

- **Supabase**: Check connection string includes `?sslmode=require`
- **Local PostgreSQL**: Make sure PostgreSQL service is running
- **Both**: Verify username/password are correct

