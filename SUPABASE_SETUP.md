# Using Supabase as Database

## Why Supabase?

- ✅ **PostgreSQL Compatible** - Supabase is built on PostgreSQL, so it's 100% compatible
- ✅ **Managed Database** - No need to install PostgreSQL locally
- ✅ **Easy Setup** - Get started in minutes
- ✅ **Free Tier** - Perfect for development
- ✅ **Matches PRD** - PRD specifies "PostgreSQL (managed)"

## Setup Steps

### Step 1: Create Supabase Project

1. Go to [https://supabase.com](https://supabase.com)
2. Sign up or log in
3. Click **"New Project"**
4. Fill in:
   - **Project Name**: prepaidly (or your choice)
   - **Database Password**: Generate a strong password (save it!)
   - **Region**: Choose closest to you
5. Click **"Create new project"**
6. Wait for project to be ready (takes 1-2 minutes)

### Step 2: Get Connection Details

1. Go to **Settings** → **Database**
2. Find **Connection string** section
3. Copy the **Connection string** (URI format)
   - Format: `postgresql://postgres:[YOUR-PASSWORD]@db.xxxxx.supabase.co:5432/postgres`
4. Or get individual values:
   - **Host**: `db.xxxxx.supabase.co`
   - **Database**: `postgres`
   - **Port**: `5432`
   - **User**: `postgres`
   - **Password**: (the one you set when creating project)

### Step 3: Run Database Schema

**Option A: Using Supabase SQL Editor (Recommended)**

1. Go to **SQL Editor** in Supabase dashboard
2. Click **"New Query"**
3. Copy contents of `database/schema.sql`
4. Paste and click **"Run"**

**Option B: Using psql**

```bash
# Extract connection details from Supabase dashboard
psql "postgresql://postgres:YOUR_PASSWORD@db.xxxxx.supabase.co:5432/postgres" -f database/schema.sql
```

### Step 4: Configure Spring Boot

Update `application-local.properties`:

```properties
# Supabase Database Configuration
spring.datasource.url=jdbc:postgresql://db.xxxxx.supabase.co:5432/postgres
spring.datasource.username=postgres
spring.datasource.password=your_supabase_password

# Xero OAuth Configuration
xero.client.id=your_xero_client_id
xero.client.secret=your_xero_client_secret
xero.redirect.uri=http://localhost:8080/api/auth/xero/callback

# Encryption Password
jasypt.encryptor.password=your_encryption_password
```

### Step 5: Test Connection

Start the backend:
```bash
cd backend
./gradlew bootRun --args='--spring.profiles.active=local'
```

Check logs for successful database connection.

## Supabase Dashboard Features

Once connected, you can:
- **View Tables**: Go to **Table Editor** to see your data
- **Run Queries**: Use **SQL Editor** for custom queries
- **Monitor**: Check **Database** → **Logs** for activity
- **API Access**: Supabase provides REST API (optional, we're using Spring Boot)

## Security Notes

1. **Connection Pooling**: Supabase has connection limits on free tier
   - Already configured in `application.properties`:
   ```properties
   spring.datasource.hikari.maximum-pool-size=5
   spring.datasource.hikari.minimum-idle=2
   ```

2. **SSL Connection**: Supabase requires SSL for production
   - Add to connection string: `?sslmode=require`
   ```properties
   spring.datasource.url=jdbc:postgresql://db.xxxxx.supabase.co:5432/postgres?sslmode=require
   ```

3. **Password Security**: Never commit your Supabase password to git

## Troubleshooting

### Connection Timeout
- Check firewall settings
- Verify connection string is correct
- Ensure project is active (not paused)

### SSL Errors
- Add `?sslmode=require` to connection URL
- Or use `?sslmode=disable` for development (not recommended)

### Connection Limit Reached
- Free tier has connection limits
- Reduce `maximum-pool-size` in HikariCP settings
- Check for connection leaks

## Migration from Local PostgreSQL

If you're already using local PostgreSQL:

1. Export data (if needed):
   ```bash
   pg_dump prepaidly > backup.sql
   ```

2. Switch to Supabase:
   - Update `application-local.properties` with Supabase connection string
   - Run schema: `psql "YOUR_SUPABASE_CONNECTION" -f database/schema.sql`
   - Import data (if needed): `psql "YOUR_SUPABASE_CONNECTION" < backup.sql`

3. Test connection and verify data

## Production Considerations

For production:
- Use Supabase production database (not free tier)
- Enable SSL: `?sslmode=require`
- Set up connection pooling properly
- Configure backups in Supabase dashboard
- Monitor connection usage

## Advantages Over Local PostgreSQL

1. ✅ No local installation needed
2. ✅ Automatic backups
3. ✅ Easy to share with team
4. ✅ Web-based database management
5. ✅ Scales automatically
6. ✅ Production-ready infrastructure

