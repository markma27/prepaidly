# How to Debug Journal Number Issue

## Viewing Backend Logs

### Option 1: Terminal/Console (Recommended)
If you're running the backend via `start-backend.ps1` or `start-backend.sh`, the logs will appear directly in that terminal window.

**Look for these log messages when posting a journal:**
- `Creating manual journal in Xero for tenant...`
- `Xero API response status: ...`
- `Xero API response body: ...`
- `ManualJournal response keys: ...` (shows what fields Xero returns)
- `ManualJournal full response: ...` (shows the complete response)
- `Extracted JournalNumber from POST response: ...` (if found in POST)
- `JournalNumber not found in POST response, fetching via GET request...` (if not in POST)
- `Fetched JournalNumber from GET request: ...` (if successfully fetched)
- `Successfully created manual journal in Xero with ID: ..., JournalNumber: ...`

### Option 2: Increase Logging Level
To see more detailed logs, temporarily change the logging level in `application-local.properties`:

```properties
# Add this to see DEBUG level logs
logging.level.com.prepaidly.service.XeroApiService=DEBUG
logging.level.com.prepaidly.service.JournalService=DEBUG
```

Then restart the backend.

## What to Share

When posting a journal entry, copy and share these log lines:

1. **The Xero API response** - Look for:
   ```
   Xero API response body: {...}
   ManualJournal response keys: [...]
   ManualJournal full response: {...}
   ```

2. **Journal number extraction attempts** - Look for:
   ```
   Extracted JournalNumber from POST response: ...
   JournalNumber not found in POST response, fetching via GET request...
   Fetched JournalNumber from GET request: ...
   ```

3. **Any errors or warnings** - Look for:
   ```
   WARN ... Could not parse JournalNumber...
   ERROR ... Failed to fetch journal number...
   ```

## Quick Test

1. Start the backend (if not already running)
2. Open the terminal where backend is running
3. In the frontend, post a journal entry
4. Immediately check the backend terminal for the log messages above
5. Copy the relevant log lines and share them

## Alternative: Check Logs in IDE

If you're running the backend from an IDE (IntelliJ, VS Code, etc.):
- Look for the "Console" or "Terminal" output panel
- The logs will appear there in real-time
