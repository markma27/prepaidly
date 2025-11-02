# Prepaidly Backend

Spring Boot 3 backend application for handling Xero integration and business logic.

## Requirements

- Java 21
- PostgreSQL 14+
- Gradle 8+

## Configuration

Set the following environment variables:

- `DB_USERNAME` - PostgreSQL username
- `DB_PASSWORD` - PostgreSQL password
- `XERO_CLIENT_ID` - Xero OAuth Client ID
- `XERO_CLIENT_SECRET` - Xero OAuth Client Secret
- `XERO_REDIRECT_URI` - OAuth callback URI
- `JWT_SECRET` - JWT signing secret
- `JASYPT_PASSWORD` - Encryption password (for encrypting stored tokens)

## Running

```bash
./gradlew bootRun
```

Or run the `PrepaidlyApplication` main class from your IDE.

## API Endpoints

- `GET /api/health` - Health check
- `GET /api/auth/xero/connect` - Connect to Xero
- `GET /api/auth/xero/callback` - OAuth callback
- `GET /api/auth/xero/status` - Connection status
- `GET /api/xero/accounts` - Get accounts list
- `GET /api/xero/invoices` - Get invoices list
- `POST /api/schedules` - Create schedule
- `POST /api/journals` - Post journal
- `POST /api/sync` - Sync data

