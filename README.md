# 🧾 Prepaidly

Prepaidly is a cloud-based **Xero add-on** that automates the management of **prepaid expenses** and **unearned revenue schedules**.

## Project Structure

```
prepaidly/
├── frontend/          # Next.js 14 Frontend Application
├── backend/           # Spring Boot 3 Backend Application
├── database/          # Database Schema
├── PRD.md            # Product Requirements Document
├── TODO.md           # Development TODO List
└── README.md         # Project Documentation
```

## Tech Stack

### Frontend
- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS
- **Deployment**: Vercel

### Backend
- **Framework**: Spring Boot 3
- **Language**: Java 21
- **SDK**: Xero Java SDK
- **Database**: PostgreSQL (Supabase recommended) or Local PostgreSQL
- **Deployment**: Render/Fly.io/AWS/GCP

## Quick Start

### Prerequisites
- Node.js 18+ 
- Java 21
- PostgreSQL 14+ (or use Supabase - recommended)

### Development Environment Setup

#### Frontend
```bash
cd frontend
npm install
npm run dev
```

#### Backend
```bash
cd backend
./gradlew bootRun --args='--spring.profiles.active=local'
```

#### Database Setup

**Option 1: Supabase (Recommended - Easier)**
1. Create project at [supabase.com](https://supabase.com)
2. Get connection string from Settings → Database
3. Update `backend/src/main/resources/application-local.properties`
4. Run schema via Supabase SQL Editor or psql
5. See [SUPABASE_SETUP.md](./SUPABASE_SETUP.md) for details

**Option 2: Local PostgreSQL**
```bash
createdb prepaidly
psql -d prepaidly -f database/schema.sql
```

## Development Roadmap

See [TODO.md](./TODO.md) for detailed development tasks and [PRD.md](./PRD.md) Section 11 for the roadmap.

## Security Notes

- All sensitive information (e.g., Xero Client Secret) should be stored in environment variables
- Production environment must use HTTPS
- Access tokens are stored encrypted with AES-256
- Follow Xero development and security guidelines

## License

[TBD]

