# Prepaidly.io – Product Requirements Document v1.0
**Date:** December 2024  
**Author:** Product Team  
**Status:** Active Development  

## 1. Problem Statement

Small to medium-sized businesses struggle with accurate prepayment and unearned revenue recognition, leading to:

- **Financial Reporting Errors**: Manual tracking in spreadsheets creates calculation mistakes and inconsistent reporting
- **Compliance Risks**: Incorrect revenue recognition violates accounting standards (ASC 606, IFRS 15)
- **Time Inefficiency**: Finance teams spend 5-10 hours monthly on manual schedule calculations
- **Audit Complications**: Lack of proper documentation and audit trails increases compliance costs
- **Cash Flow Mismanagement**: Poor visibility into future revenue recognition impacts business decisions

**Core Pain Point**: No affordable, user-friendly solution exists for businesses that need more than spreadsheets but less than enterprise ERP systems.

## 2. Proposed Solution

Prepaidly.io is a specialized SaaS platform that automates prepayment and unearned revenue schedule management through:

**Core Value Proposition**: Transform hours of manual spreadsheet work into minutes of automated schedule generation with built-in compliance and audit readiness.

**Key Differentiators**:
- Single-purpose focus (vs. complex ERP modules)
- Intuitive manual-entry workflow (vs. technical accounting software)
- Immediate visual previews (vs. black-box calculations)
- Export-ready formats (vs. proprietary reporting)

## 3. Target Users & Personas

### Primary Persona: Sarah, Finance Manager
- **Company Size**: 50-500 employees, $5M-$50M ARR
- **Industry**: SaaS, subscription services, professional services
- **Pain Points**: Monthly close takes too long, audit preparation is stressful
- **Goals**: Accurate reporting, time savings, audit confidence
- **Tech Comfort**: Moderate (uses QuickBooks, Excel proficiently)

### Secondary Persona: Mike, Small Business Owner
- **Company Size**: 10-50 employees, $1M-$10M revenue
- **Industry**: Agencies, consulting, course creators
- **Pain Points**: Revenue timing confusion, spreadsheet errors
- **Goals**: Simple compliance, clear cash flow visibility
- **Tech Comfort**: Basic (prefers simple, guided workflows)

### Tertiary Persona: Jessica, Staff Accountant
- **Company Size**: 100-1000 employees
- **Industry**: Various B2B companies with advance payments
- **Pain Points**: Manual calculations, version control issues
- **Goals**: Process efficiency, error reduction
- **Tech Comfort**: High (power Excel user, familiar with accounting software)

## 4. Scope (Milestone 1 Only)

### Functional Requirements
- ✅ **User Authentication**: Secure signup/login via email/password
- ✅ **Dashboard**: Clean overview with getting started guidance
- ✅ **Schedule Creation Form**: Guided input for amount, dates, schedule type
- ✅ **Straight-Line Calculation**: Automated monthly amortization logic
- ✅ **Live Preview**: Real-time table showing calculated schedule entries
- ✅ **CSV Export**: Download schedules in spreadsheet-compatible format
- ✅ **Schedule Registry**: Save, view, and edit created schedules
- ✅ **Data Persistence**: User-specific schedule storage with access controls

### Non-Functional Requirements
- **Performance**: Page loads < 2 seconds, form submissions < 1 second
- **Security**: Row-level security, encrypted data at rest, HTTPS only
- **Reliability**: 99.5% uptime target, automated backups
- **Usability**: Mobile-responsive, keyboard accessible, intuitive navigation
- **Scalability**: Support 1,000+ concurrent users, 10,000+ schedules per user

## 5. Success Metrics / KPIs

### User Adoption
- **Primary**: 100 active users within 3 months
- **Secondary**: 70% user retention after first month
- **Engagement**: Average 5 schedules created per user monthly

### Product Performance
- **Time Savings**: Users report 80% time reduction vs. spreadsheets
- **Accuracy**: Zero calculation errors in user feedback
- **Satisfaction**: 4.5+ star average rating, NPS > 50

### Business Metrics
- **Conversion**: 15% free trial to paid conversion
- **Revenue**: $10K MRR within 6 months
- **Support**: < 2% of users require support assistance

## 6. Assumptions & Dependencies

### Technical Assumptions
- Supabase maintains 99.9% uptime and data integrity
- Next.js 14 provides stable foundation for 12+ months
- Users access application via modern web browsers (Chrome 90+, Safari 14+)

### Business Assumptions
- Target market actively seeks alternatives to manual processes
- Users willing to pay $29-49/month for time savings and accuracy
- Compliance requirements continue driving demand for proper revenue recognition

### User Behavior Assumptions
- Users prefer guided workflows over complex configuration
- Monthly schedule review/update cadence is sufficient
- CSV export format meets integration needs for 80% of users

## 7. Out-of-Scope Items

### Milestone 1 Exclusions
- ❌ **OCR/Document Scanning**: Automated data extraction from invoices
- ❌ **LLM Integration**: AI-powered schedule recommendations
- ❌ **Xero Integration**: Direct ERP/accounting software connections
- ❌ **Multi-Currency**: International currency support
- ❌ **Advanced Schedules**: Non-linear, milestone-based, or custom amortization
- ❌ **Team Collaboration**: Multi-user workspaces, approval workflows
- ❌ **API Access**: Third-party integrations or developer tools

### Intentionally Deferred
- Custom reporting beyond CSV export
- Automated email notifications
- Mobile native applications
- White-label/reseller capabilities

## 8. Timeline & Milestones (6-Month Roadmap)

| Milestone | Timeline | Key Features | Success Criteria |
|-----------|----------|--------------|------------------|
| **M1: MVP** | Month 1-2 | Manual entry, straight-line schedules, CSV export | 50 beta users, working end-to-end flow |
| **M2: Intelligence** | Month 3 | OCR document scanning, LLM suggestions | 80% data extraction accuracy, 100 active users |
| **M3: Integration** | Month 4 | Xero sync, QuickBooks connector | 2+ accounting software integrations working |
| **M4: Scale** | Month 5 | Advanced schedules, team features | 500 users, $5K MRR |
| **M5: Growth** | Month 6 | API, webhooks, advanced reporting | 1,000 users, $10K MRR |
| **M6: Platform** | Month 7+ | Mobile apps, enterprise features | Enterprise pilots, $25K MRR |

## 9. Open Questions / Risks

### Technical Risks
- **Database Performance**: How will Supabase handle 100K+ schedule entries per user?
- **Export Limitations**: Will CSV format support all required accounting software imports?
- **Browser Compatibility**: Should we support IE11 or focus on modern browsers only?

### Product Risks
- **Feature Complexity**: Will advanced users need more than straight-line amortization in M1?
- **Workflow Friction**: Is the current 5-step creation process too long for frequent use?
- **Data Migration**: How will users transition existing spreadsheet data into the platform?

### Business Risks
- **Market Timing**: Are businesses ready to move from spreadsheets to specialized tools?
- **Pricing Sensitivity**: What's the price ceiling before users stick with manual processes?
- **Competition**: How quickly could established players (QuickBooks, Xero) replicate our features?

### Open Questions
1. Should we offer a forever-free tier with limitations?
2. What integrations are highest priority after Xero?
3. How do we handle international accounting standards differences?
4. Should the MVP include prepayment AND unearned revenue, or focus on one?
5. What level of customer support is expected for this price point?

---

**Next Review Date**: January 15, 2025  
**Document Owner**: Product Team  
**Stakeholder Approval**: ✅ Engineering Lead, ✅ Design Lead, ⏳ Business Lead 