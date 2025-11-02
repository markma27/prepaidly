# Database Setup

## Create Database

```bash
createdb prepaidly
```

## Run Schema

```bash
psql -d prepaidly -f schema.sql
```

## Database Structure

- `users` - Users table
- `xero_connections` - Xero connection information (encrypted token storage)
- `schedules` - Amortisation schedules table
- `journal_entries` - Journal entries table
- `logs` - Logs table (optional)

