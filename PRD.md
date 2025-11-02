# 🧾 Prepaidly – Product Requirements Document (PRD)

## 1. Overview
**Prepaidly** is a cloud-based **Xero add-on** that automates the management of **prepaid expenses** and **unearned revenue schedules**.  
It connects securely to Xero via OAuth 2.0, creates amortisation schedules, and posts monthly recognition journals back into Xero.

Prepaidly is built as a **multi-tenant SaaS platform**, allowing accounting firms to manage multiple clients (Xero organisations) within one secure application.

---

## 2. Objectives
- Automate amortisation for prepaid and unearned revenue items.
- Replace Excel-based tracking with live, auditable schedules.
- Ensure **data segregation and privacy** between client organisations.
- Meet or exceed **Xero App Store security assessment** standards.

## 3) MVP Scope
- **Xero OAuth2** connection (Auth Code Flow, refresh tokens).
- **Data ingest**: Accounts, Invoices/Bills, Contacts.
- **Schedule builder**: define start/end dates, period (monthly), and accounts.
- **Journal posting**: create monthly Manual Journals in Xero.
- **Dashboard**: list schedules, next posting date, posted/not posted.
- **Export**: CSV (later PDF).

## 4) Non-functional
- **Security**: Encrypted storage of client secret and tokens. HTTPS only.
- **Performance**: <30s for initial sync on ≤100 invoices.
- **Scalability**: Multi-org (≤25 orgs before certification).
- **Compliance**: Follow Xero Dev & Security guidelines from day one.

## 5) Tech Architecture
| Layer | Technology |
|-------|-------------|
| **Frontend** | Next.js 14 (App Router) + Tailwind, hosted on Vercel |
| **Backend** | Java 21 + Spring Boot 3 + Xero Java SDK |
| **Database** | PostgreSQL (managed) |
| **Auth** | Xero OAuth2 (per tenant), JWT for Prepaidly app users |
| **Hosting** | Vercel (frontend), Render/Fly.io/AWS/GCP (backend) |
| **Monitoring** | Sentry + structured JSON logs |

## 6) Data Model (initial)
**users**(id, email, created_at)  
**xero_connections**(id, user_id, tenant_id, access_token, refresh_token, expires_at, created_at, updated_at)  
**schedules**(id, tenant_id, xero_invoice_id, type enum['prepaid','unearned'], start_date, end_date, total_amount, expense_acct_code, revenue_acct_code, deferral_acct_code, created_by, created_at)  
**journal_entries**(id, schedule_id, period_date, amount, xero_manual_journal_id, posted boolean default false, created_at)  
**logs**(id, level, event, details jsonb, created_at)

Indexes: by **tenant_id**, **period_date**, **posted**.

## 7) Xero Integration
**Scopes (MVP):**
- `offline_access`
- `accounting.settings.read`
- `accounting.contacts.read`
- `accounting.transactions`      ← needed to create Manual Journals
- `accounting.journals.read`     ← to verify postings

**Redirect URI (prod):** `https://prepaidly.io/api/auth/xero/callback`  
(Also register your staging URI.)

**Key APIs:**
- GET Accounts, GET Invoices (Bills), GET Contacts
- POST ManualJournals
- GET Journals / ManualJournals (verify)

## 8) User Flow
1) User logs in to Prepaidly → clicks **Connect to Xero**.  
2) Xero consent → select **Demo Company**.  
3) Callback stores tokens + tenantId.  
4) App fetches Accounts & candidate transactions.  
5) User creates a Schedule (dates, total, accounts).  
6) System generates monthly recognition plan.  
7) User clicks **Post** (or enable auto-post) → create Manual Journal in Xero.  
8) Dashboard shows posted entries and remaining balance.

## 9. Backend API (Spring Boot)

| Endpoint | Method | Description |
|-----------|--------|-------------|
| `/api/auth/xero/connect` | GET | Redirect to Xero consent screen |
| `/api/auth/xero/callback` | GET | Handle auth code, store encrypted tokens |
| `/api/auth/xero/status` | GET | Check connection & list organisations |
| `/api/xero/accounts` | GET | List accounts for a tenant |
| `/api/xero/invoices` | GET | List invoices/bills |
| `/api/schedules` | POST | Create amortisation schedule |
| `/api/journals` | POST | Post monthly journal |
| `/api/sync` | POST | Refresh tokens and sync data |

---

## 10. Frontend (Next.js)
- `/app` – Connect screen  
- `/app/connected` – Connected organisations + API status test  
- `/app/schedules` – Schedule list & creation form  
- `/app/dashboard` – Active schedules, recognition totals, and next postings  

**Frontend Security**
- Environment variables use `NEXT_PUBLIC_` prefix for non-secret URLs only.  
- All API calls use HTTPS via backend API gateway.  
- JWT tokens stored in secure, httpOnly cookies.

---

## 11. Development Roadmap

| Phase | Milestone | Deliverable |
|--------|------------|-------------|
| Week 1–2 | Setup backend (Spring Boot, OAuth flow) | Successfully connect to Demo Company |
| Week 3–4 | Fetch & display accounts/invoices | Confirm token refresh + multi-tenant model |
| Week 5 | Schedule creation & amortisation logic | Basic UI + validation |
| Week 6 | Journal posting + dashboard | End-to-end test |
| Week 7 | Security hardening + QA | Pen test, data encryption checks |
| Week 8 | Deployment to staging | Vercel + backend hosting |
| Week 9 | Xero App Store preparation | Security self-assessment, compliance review |

---

## 12. Security Measures Summary

| Area | Approach |
|-------|-----------|
| **Token Storage** | AES-256 encryption, never logged or transmitted unencrypted |
| **Secrets** | Stored in secure vault or environment secrets (never in code) |
| **Multi-tenancy** | Tenant-based isolation, RLS, and strict ownership checks |
| **Transport Layer** | HTTPS enforced (HSTS enabled) |
| **Logging** | Centralised structured logs (exclude PII or tokens) |
| **Backups** | Encrypted backups stored separately with 7-day retention |
| **Vulnerability Scanning** | Monthly scans and dependency updates |
| **Security Review** | Annual external audit for Xero certification |

---

## 13. Future Enhancements
- AI-assisted classification of prepayments/unearned revenue from invoice descriptions.
- Multi-user firm dashboard (permissions by staff member).
- Forecasting dashboard by recognition month.
- Integration with other accounting platforms (QuickBooks, MYOB).
- In-app data export for compliance review.
- Automatic monthly posting (scheduled tasks with audit log).

---

## 14. References
- [Xero Java SDK](https://github.com/XeroAPI/Xero-Java)
- [Xero API Docs](https://developer.xero.com/documentation)
- [Xero OAuth 2.0 Guide](https://developer.xero.com/documentation/oauth2/overview)
- [Next.js Documentation](https://nextjs.org/docs)
- [Spring Boot Documentation](https://spring.io/projects/spring-boot)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)