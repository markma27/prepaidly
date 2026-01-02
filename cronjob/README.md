# Daily Cron Job

Java-based daily cron job that executes at 12:00 AM daily on Railway.

## Structure

```
cronjob/
├── src/main/java/com/prepaidly/cronjob/
│   └── DailyCronJob.java    # Main cron job class
├── build.gradle              # Gradle build configuration
├── settings.gradle           # Gradle settings
├── railway.json              # Railway deployment configuration
└── README.md                 # This file
```

## Building

```bash
cd cronjob
chmod +x ../backend/gradlew  # Use backend's gradle wrapper or install gradle
../backend/gradlew build
```

Or if you have Gradle installed:
```bash
cd cronjob
gradle build
```

## Running Locally

```bash
cd cronjob
java -jar build/libs/prepaidly-cronjob-0.1.0.jar
```

## Setup on Railway

### Option 1: Railway Scheduled Tasks (Recommended)

1. **Create a new service in Railway:**
   - Go to your Railway project dashboard
   - Click "New" → "Empty Service"
   - Name it "cronjob" or "daily-cron"

2. **Connect the repository:**
   - Connect to your GitHub repository
   - Set the root directory to `cronjob`

3. **Configure the build:**
   - Railway will detect the `railway.json` configuration
   - Or manually set:
     - Build Command: `chmod +x ./gradlew && ./gradlew clean build`
     - Start Command: `java -jar build/libs/prepaidly-cronjob-0.1.0.jar`

4. **Set up scheduled task:**
   - In Railway dashboard, go to your cron service
   - Navigate to "Settings" → "Cron Schedule"
   - Set the schedule to: `0 0 * * *` (runs at 12:00 AM daily)
   - Or use Railway's UI to select "Daily at midnight"

5. **Environment Variables:**
   Add any required environment variables:
   - `LOG_LEVEL` - Logging level (optional, defaults to INFO)
   - Any other variables your job needs

### Option 2: Using Railway Cron Plugin

1. Install Railway's Cron plugin in your project
2. Configure it to:
   - Run command: `java -jar build/libs/prepaidly-cronjob-0.1.0.jar`
   - Schedule: `0 0 * * *`
   - Working directory: `cronjob`

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

Example tasks you might want to add:

```java
public void run() {
    log.info("=== Daily Cron Job Started ===");
    
    // Refresh Xero tokens for all tenants
    // refreshXeroTokens();
    
    // Generate journal entries for schedules due today
    // generateDueJournalEntries();
    
    // Send reminder notifications
    // sendNotifications();
    
    // Clean up old data
    // cleanupOldData();
    
    log.info("Daily cron job completed successfully");
    log.info("=== Daily Cron Job Finished ===");
}
```

## Dependencies

The cron job includes:
- SLF4J + Logback for logging
- Spring Web (optional, for HTTP calls)
- Jackson (optional, for JSON processing)

Add more dependencies in `build.gradle` as needed.

## Logging

Logs are written to:
- Console output (visible in Railway logs)
- Can be configured to write to files if needed

## Testing

Test the cron job locally:

```bash
cd cronjob
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
