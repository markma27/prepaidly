# Project Structure Overview

## 📁 Directory Structure

```
prepaidly/
├── frontend/                 # Next.js 14 Frontend Application
│   ├── app/                  # Next.js App Router
│   │   ├── app/             # Application Pages
│   │   ├── layout.tsx       # Root Layout
│   │   ├── page.tsx         # Home Page
│   │   └── globals.css      # Global Styles
│   ├── package.json         # Frontend Dependencies
│   ├── tsconfig.json        # TypeScript Config
│   ├── next.config.js       # Next.js Config
│   ├── tailwind.config.ts   # Tailwind CSS Config
│   └── postcss.config.js    # PostCSS Config
│
├── backend/                  # Spring Boot 3 Backend Application
│   ├── src/
│   │   └── main/
│   │       ├── java/com/prepaidly/
│   │       │   ├── PrepaidlyApplication.java  # Main Application Class
│   │       │   ├── config/                    # Configuration Classes
│   │       │   │   └── WebConfig.java         # CORS Configuration
│   │       │   ├── controller/                # REST Controllers
│   │       │   │   ├── HealthController.java
│   │       │   │   ├── XeroAuthController.java
│   │       │   │   ├── XeroController.java
│   │       │   │   ├── ScheduleController.java
│   │       │   │   ├── JournalController.java
│   │       │   │   └── SyncController.java
│   │       │   └── model/                     # Data Models
│   │       │       ├── User.java
│   │       │       ├── XeroConnection.java
│   │       │       ├── Schedule.java
│   │       │       └── JournalEntry.java
│   │       └── resources/
│   │           └── application.properties     # Application Config
│   ├── build.gradle         # Gradle Build Config
│   ├── settings.gradle      # Gradle Settings
│   └── README.md            # Backend Documentation
│
├── database/                 # Database Related
│   ├── schema.sql           # Database Schema
│   └── README.md            # Database Documentation
│
├── PRD.md                   # Product Requirements Document
├── TODO.md                  # Development TODO List
├── README.md                # Main Project Documentation
└── .gitignore              # Git Ignore Config
```

## ✅ Completed Work

### 1. Project Root
- ✅ `.gitignore` - Git ignore configuration
- ✅ `README.md` - Main project documentation

### 2. Frontend (Next.js 14)
- ✅ Project initialization and configuration files
- ✅ TypeScript configuration
- ✅ Tailwind CSS configuration
- ✅ Basic page structure (home page, app page)
- ✅ Global styles configuration

### 3. Backend (Spring Boot 3)
- ✅ Gradle build configuration
- ✅ Main application class
- ✅ Data models (User, XeroConnection, Schedule, JournalEntry)
- ✅ REST controller skeletons (all API endpoints defined)
- ✅ CORS configuration
- ✅ Application configuration file

### 4. Database
- ✅ PostgreSQL Schema definition
- ✅ Index configuration
- ✅ Table structure compliant with PRD requirements

## 🚀 Next Steps

See [TODO.md](./TODO.md) for detailed development tasks based on the PRD roadmap.

## 📝 Important Notes

1. **Environment Variables**: All sensitive configuration should be set via environment variables, never hardcoded
2. **Database**: Create PostgreSQL database and run `database/schema.sql` first
3. **Xero Credentials**: Register application in Xero Developer Portal and obtain Client ID and Secret
4. **Gradle Wrapper**: Run `gradle wrapper` before first backend execution to generate wrapper files

## 🔧 Development Environment Setup

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### Backend
```bash
cd backend
# Generate Gradle wrapper on first run
gradle wrapper
# Or use system Gradle
./gradlew bootRun
```

### Database
```bash
createdb prepaidly
psql -d prepaidly -f database/schema.sql
```

