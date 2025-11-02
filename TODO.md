# TODO.md - Prepaidly Development Tasks

This TODO list is based on the development roadmap in [PRD.md](./PRD.md) Section 11.

## ✅ Phase 0: Project Setup (COMPLETED)

### Week 0 - Project Framework
- [x] Create project root structure (`.gitignore`, `README.md`)
- [x] Initialize Next.js 14 frontend project with TypeScript and Tailwind CSS
- [x] Initialize Spring Boot 3 backend project with Gradle
- [x] Create database schema (`database/schema.sql`)
- [x] Set up data models (User, XeroConnection, Schedule, JournalEntry)
- [x] Create REST controller skeletons for all API endpoints
- [x] Configure CORS and basic application settings

---

## 📋 Phase 1: Backend Setup & OAuth Flow (Week 1-2)

### Milestone: Successfully connect to Demo Company

#### Backend - OAuth2 Implementation
- [ ] Implement Xero OAuth2 authorization code flow
  - [ ] Create Xero OAuth service to generate authorization URL
  - [ ] Handle OAuth callback and exchange authorization code for tokens
  - [ ] Store encrypted access and refresh tokens in database
  - [ ] Implement token refresh mechanism
  - [ ] Add error handling for OAuth failures

#### Backend - Security
- [ ] Implement AES-256 encryption for storing tokens (using Jasypt)
- [ ] Configure JWT for Prepaidly app user authentication
- [ ] Set up Spring Security configuration
- [ ] Implement multi-tenant data isolation checks

#### Backend - Database
- [ ] Create repository interfaces (JPA repositories)
- [ ] Implement service layer for Xero connections
- [ ] Add database connection pooling configuration

#### Testing
- [ ] Test OAuth flow with Xero Demo Company
- [ ] Verify token storage and encryption
- [ ] Test token refresh mechanism

---

## 📋 Phase 2: Xero API Integration (Week 3-4)

### Milestone: Fetch & display accounts/invoices, confirm token refresh & multi-tenant model

#### Backend - Xero API Integration
- [ ] Implement Xero Java SDK integration
  - [ ] Configure Xero API client with tenant context
  - [ ] Implement account fetching (`GET /api/xero/accounts`)
  - [ ] Implement invoice/bill fetching (`GET /api/xero/invoices`)
  - [ ] Implement contacts fetching (for future use)
  - [ ] Add error handling and retry logic

#### Backend - Multi-tenancy
- [ ] Ensure tenant isolation in all API endpoints
- [ ] Add tenant validation middleware/filter
- [ ] Test multi-tenant data access patterns

#### Backend - Token Management
- [ ] Implement automatic token refresh before API calls
- [ ] Add token expiration handling
- [ ] Implement connection status endpoint (`GET /api/auth/xero/status`)

#### Frontend - API Integration
- [ ] Create API client/service layer
- [ ] Implement fetch wrapper with error handling
- [ ] Set up environment variables for API URLs

#### Testing
- [ ] Test fetching accounts from multiple tenants
- [ ] Verify token refresh works correctly
- [ ] Test multi-tenant isolation

---

## 📋 Phase 3: Schedule Creation & Amortisation Logic (Week 5)

### Milestone: Basic UI + validation for schedule creation

#### Backend - Schedule Management
- [ ] Implement schedule creation endpoint (`POST /api/schedules`)
  - [ ] Validate schedule data (dates, amounts, accounts)
  - [ ] Calculate monthly amortisation amounts
  - [ ] Generate journal entries for each period
  - [ ] Store schedule and journal entries in database

#### Backend - Business Logic
- [ ] Implement amortisation calculation logic
  - [ ] Handle prepaid expenses (debit expense, credit deferral)
  - [ ] Handle unearned revenue (credit revenue, debit deferral)
  - [ ] Support monthly recognition periods
  - [ ] Calculate remaining balance

#### Backend - Validation
- [ ] Validate account codes exist in Xero
- [ ] Validate date ranges (start < end)
- [ ] Validate total amount is positive
- [ ] Add input validation annotations

#### Frontend - Schedule Creation UI
- [ ] Create schedule creation form (`/app/schedules`)
  - [ ] Form fields: type, start date, end date, total amount, accounts
  - [ ] Account selection dropdown (populated from Xero)
  - [ ] Date picker components
  - [ ] Form validation and error messages
  - [ ] Preview amortisation schedule before creation

#### Frontend - Schedule List
- [ ] Create schedule list page (`/app/schedules`)
  - [ ] Display all schedules for connected tenant
  - [ ] Show schedule status, dates, amounts
  - [ ] Filter by type (prepaid/unearned)
  - [ ] Link to schedule details

#### Testing
- [ ] Test schedule creation with various date ranges
- [ ] Verify amortisation calculations are correct
- [ ] Test form validation
- [ ] Test schedule list display

---

## 📋 Phase 4: Journal Posting & Dashboard (Week 6)

### Milestone: End-to-end test of journal posting

#### Backend - Journal Posting
- [ ] Implement journal posting endpoint (`POST /api/journals`)
  - [ ] Create Manual Journal in Xero via API
  - [ ] Update journal entry status to posted
  - [ ] Store Xero journal ID in database
  - [ ] Handle posting errors and rollback

#### Backend - Journal Verification
- [ ] Implement journal verification (check if posted in Xero)
- [ ] Add endpoint to verify journal status
- [ ] Handle cases where journal was deleted in Xero

#### Backend - Dashboard Data
- [ ] Create dashboard endpoint to aggregate schedule data
  - [ ] Calculate total recognition by month
  - [ ] List upcoming postings
  - [ ] Show posted vs. not posted counts
  - [ ] Calculate remaining balances

#### Frontend - Dashboard
- [ ] Create dashboard page (`/app/dashboard`)
  - [ ] Display active schedules summary
  - [ ] Show recognition totals by month
  - [ ] List next posting dates
  - [ ] Show posted/not posted status
  - [ ] Display remaining balances

#### Frontend - Journal Posting UI
- [ ] Add "Post Journal" button/action to schedule details
- [ ] Implement posting confirmation dialog
- [ ] Show posting status (posted, pending, error)
- [ ] Display Xero journal ID after posting

#### Frontend - Connected Organizations
- [ ] Create connected organizations page (`/app/connected`)
  - [ ] List all connected Xero organizations
  - [ ] Show connection status
  - [ ] Add "Test API" button to verify connection
  - [ ] Allow disconnecting organizations

#### Testing
- [ ] Test end-to-end journal posting flow
- [ ] Verify journals appear correctly in Xero
- [ ] Test error handling for failed postings
- [ ] Test dashboard data accuracy

---

## 📋 Phase 5: Security Hardening & QA (Week 7)

### Milestone: Pen test, data encryption checks

#### Security - Encryption
- [ ] Verify all sensitive data is encrypted at rest
- [ ] Audit token storage and transmission
- [ ] Ensure no tokens are logged
- [ ] Verify HTTPS is enforced in production

#### Security - Multi-tenancy
- [ ] Implement Row-Level Security (RLS) checks
- [ ] Add tenant ownership validation on all endpoints
- [ ] Audit all database queries for tenant isolation
- [ ] Test unauthorized access attempts

#### Security - Authentication & Authorization
- [ ] Implement JWT authentication for Prepaidly users
- [ ] Add role-based access control (if needed)
- [ ] Implement session management
- [ ] Add CSRF protection

#### Security - Logging & Monitoring
- [ ] Configure structured JSON logging
- [ ] Ensure no PII or tokens in logs
- [ ] Set up Sentry error tracking
- [ ] Configure log retention policies

#### Testing - Security
- [ ] Conduct security self-assessment
- [ ] Test OWASP Top 10 vulnerabilities
- [ ] Perform penetration testing
- [ ] Review code for security vulnerabilities

#### Testing - QA
- [ ] Write unit tests for critical business logic
- [ ] Write integration tests for API endpoints
- [ ] Test with multiple tenants simultaneously
- [ ] Performance testing (<30s for initial sync on ≤100 invoices)

---

## 📋 Phase 6: Deployment to Staging (Week 8)

### Milestone: Deploy to Vercel + backend hosting

#### Frontend Deployment
- [ ] Set up Vercel project
- [ ] Configure environment variables
- [ ] Set up custom domain (if needed)
- [ ] Configure build settings
- [ ] Test deployment process

#### Backend Deployment
- [ ] Choose hosting provider (Render/Fly.io/AWS/GCP)
- [ ] Set up database (managed PostgreSQL)
- [ ] Configure environment variables
- [ ] Set up CI/CD pipeline
- [ ] Configure health checks

#### Database Setup
- [ ] Set up production database
- [ ] Run migrations
- [ ] Configure backups (7-day retention)
- [ ] Set up database monitoring

#### Monitoring & Logging
- [ ] Configure Sentry for production
- [ ] Set up application monitoring
- [ ] Configure alerting
- [ ] Set up log aggregation

#### Documentation
- [ ] Update deployment documentation
- [ ] Document environment variables
- [ ] Create runbook for common issues

---

## 📋 Phase 7: Xero App Store Preparation (Week 9)

### Milestone: Security self-assessment, compliance review

#### Xero App Store Requirements
- [ ] Complete Xero App Store application form
- [ ] Prepare app description and screenshots
- [ ] Create privacy policy and terms of service
- [ ] Prepare support documentation

#### Security Compliance
- [ ] Complete Xero security self-assessment
- [ ] Address any security concerns
- [ ] Prepare for external security audit
- [ ] Document security measures

#### Testing - Production Ready
- [ ] Test with real Xero organizations (not just Demo Company)
- [ ] Load testing (support ≤25 orgs)
- [ ] Test all Xero scopes required
- [ ] Verify redirect URIs are correct

#### Documentation
- [ ] User documentation
- [ ] API documentation
- [ ] Developer documentation
- [ ] Troubleshooting guide

---

## 🔮 Future Enhancements (Post-MVP)

- [ ] AI-assisted classification of prepayments/unearned revenue
- [ ] Multi-user firm dashboard (permissions by staff member)
- [ ] Forecasting dashboard by recognition month
- [ ] Integration with other accounting platforms (QuickBooks, MYOB)
- [ ] In-app data export for compliance review
- [ ] Automatic monthly posting (scheduled tasks with audit log)
- [ ] CSV export functionality
- [ ] PDF export functionality

---

## 📝 Notes

- All tasks should follow Xero development and security guidelines
- Performance target: <30s for initial sync on ≤100 invoices
- Scalability target: Support ≤25 orgs before certification
- All sensitive data must be encrypted and never logged
- HTTPS must be enforced in production
- Follow OWASP Top 10 security practices

