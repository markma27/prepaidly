# Daily Cron Job

Java-based daily cron job that executes at 12:00 AM daily on Railway.

## Structure

```
cronjob/
├── src/main/java/com/prepaidly/cronjob/
│   ├── DailyCronJob.java           # Main cron job class
│   └── config/
│       └── DatabaseConfig.java     # Database connection configuration
├── src/main/resources/
│   ├── logback.xml                  # Logging configuration
│   └── application.properties       # Application configuration
├── build.gradle                     # Gradle build configuration
├── settings.gradle                  # Gradle settings
├── railway.json                     # Railway deployment configuration
└── README.md                        # This file
```

**Note**: Model classes (JournalEntry, Schedule, User, XeroConnection) are shared from the `backend` module to avoid duplication.

## Building

From the repository root:
```bash
./backend/gradlew :cronjob:build
```

Or from the cronjob directory:
```bash
cd cronjob
../backend/gradlew build
```

## Running Locally

```bash
cd cronjob
java -jar build/libs/prepaidly-cronjob-0.1.0.jar
```

Make sure to set environment variables:
```bash
export DATABASE_URL="jdbc:postgresql://host:port/database?sslmode=require"
export DB_USERNAME="your_username"
export DB_PASSWORD="your_password"
```

## Setup on Railway

### Option 1: Railway Scheduled Tasks (Recommended)

1. **Create a new service in Railway:**
   - Go to your Railway project dashboard
   - Click "New" → "Empty Service"
   - Name it "cronjob" or "daily-cron"

2. **Connect the repository:**
   - Connect to your GitHub repository
   - **IMPORTANT**: Set the root directory to `/` (repository root) or leave it empty
   - **DO NOT** set it to `cronjob` - the build needs access to the `backend` module

3. **Configure the build:**
   - Railway will detect the `railway.json` and `nixpacks.toml` configuration
   - Or manually set:
     - Build Command: `chmod +x ./gradlew && ./gradlew clean build -x test --no-daemon`
     - Start Command: `java -jar build/libs/prepaidly-cronjob-0.1.0.jar`

4. **Set up scheduled task:**
   - In Railway dashboard, go to your cron service
   - Navigate to "Settings" → "Cron Schedule"
   - Set the schedule to: `0 0 * * *` (runs at 12:00 AM daily)
   - Or use Railway's UI to select "Daily at midnight"

5. **Environment Variables:**
   **IMPORTANT**: Set these environment variables in Railway:
   - `DATABASE_URL` - Full database connection URL
     - For Supabase pooler: `jdbc:postgresql://aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres?sslmode=require`
     - Or Railway may provide: `postgresql://user:pass@host:port/db` (will be auto-parsed)
   - `DB_USERNAME` - Database username (required for Supabase pooler)
     - For Supabase pooler: `postgres.dowbcpwuybwolpszvpeq`
   - `DB_PASSWORD` - Database password
   - `LOG_LEVEL` - Logging level (optional, defaults to INFO)

### Troubleshooting Build Issues

If you encounter build failures on Railway:

1. **Check Railway logs** for detailed error messages
2. **Verify file structure** - ensure all files are committed:
   - `build.gradle`
   - `settings.gradle`
   - `gradlew` and `gradle/` directory
   - `src/main/java/com/prepaidly/cronjob/DailyCronJob.java`
   - `src/main/resources/logback.xml`

3. **Try building locally first:**
   ```bash
   cd cronjob
   ../backend/gradlew clean build -x test --no-daemon
   ```

4. **Common issues:**
   - Missing `--no-daemon` flag (Railway doesn't support Gradle daemon)
   - Missing logback.xml (now included)
   - Incorrect root directory (must be set to `cronjob`)
   - Backend module not found (ensure root `settings.gradle` includes both projects)

5. **If build still fails**, check:
   - Railway build logs for specific Gradle errors
   - Java version compatibility (should be Java 21)
   - Network connectivity for dependency downloads

### Troubleshooting Database Connection Issues

If you get "Tenant or user not found" error:

1. **Check DATABASE_URL format:**
   - Should be: `jdbc:postgresql://host:port/database?sslmode=require`
   - Or Railway format: `postgresql://user:pass@host:port/db` (auto-parsed)

2. **Verify DB_USERNAME:**
   - For Supabase pooler: Must be `postgres.dowbcpwuybwolpszvpeq` (not just `postgres`)
   - Check your Supabase dashboard for the correct username format

3. **Verify DB_PASSWORD:**
   - Ensure password is set correctly
   - Check for special characters that might need encoding

4. **Check Railway environment variables:**
   - Go to your cron service → Variables
   - Verify all three variables are set: `DATABASE_URL`, `DB_USERNAME`, `DB_PASSWORD`
   - Make sure they match your backend service variables

5. **Test connection:**
   - The logs will show the connection details (password masked)
   - Check Railway logs for connection errors

## Cron Schedule Format

The schedule `0 0 * * *` means:
- `0` - minute (0th minute)
- `0` - hour (0th hour = midnight)
- `*` - day of month (every day)
- `*` - month (every month)
- `*` - day of week (every day)

This runs at 12:00 AM (midnight) every day.

## Customizing the Job

Edit `src/main/java/com/prepaidly/cronjob/DailyCronJob.java` to add your daily tasks.

The job currently:
- Reads all journal entries from the database
- Stores them in a map keyed by `xero_manual_journal_id`
- Logs the `xero_manual_journal_id` and `posted` status for all entries

Example tasks you might want to add:

```java
public void run() {
    log.info("=== Daily Cron Job Started ===");
    
    // Read journal entries
    Map<String, JournalEntry> journalEntryMap = readJournalEntries();
    
    // Your custom tasks here
    // - Refresh Xero tokens for all tenants
    // - Generate journal entries for schedules due today
    // - Send reminder notifications
    // - Clean up old data
    
    log.info("Daily cron job completed successfully");
}
```

## Dependencies

The cron job includes:
- **Shared models from backend** - JournalEntry, Schedule, User, XeroConnection
- SLF4J + Logback for logging
- PostgreSQL JDBC driver
- HikariCP connection pool
- Lombok for data classes
- Spring Web (optional, for HTTP calls)
- Jackson (optional, for JSON processing)

## Shared Models

Model classes are shared from the `backend` module:
- `com.prepaidly.model.JournalEntry` - Journal entry entity
- `com.prepaidly.model.Schedule` - Schedule entity  
- `com.prepaidly.model.User` - User entity
- `com.prepaidly.model.XeroConnection` - Xero connection entity

These are accessed via the `project(':backend')` dependency in `build.gradle`.

## Logging

Logs are written to:
- Console output (visible in Railway logs)
- Can be configured to write to files if needed

## Testing

Test the cron job locally:

```bash
cd cronjob
export DATABASE_URL="jdbc:postgresql://your-host:5432/your-db?sslmode=require"
export DB_USERNAME="your_username"
export DB_PASSWORD="your_password"
../backend/gradlew build
java -jar build/libs/prepaidly-cronjob-0.1.0.jar
```

## Monitoring

- Check Railway logs for the cron service to see execution results
- Set up alerts in Railway if the job fails (exit code != 0)
- The job exits with code 0 on success, 1 on failure

## Notes

- The job is designed to run once and exit (not as a long-running service)
- Railway's cron scheduler will trigger it at the specified time
- Make sure to set `restartPolicyType: "never"` so Railway doesn't restart it
- The job should complete quickly (within Railway's timeout limits)
- Database connection uses HikariCP connection pooling for efficiency
- Model classes are shared with backend to avoid code duplication
