# Prepaidly.io

A **multi-tenant SaaS application** for managing prepayment & unearned revenue schedules. Built with Next.js 14, TypeScript, Tailwind CSS, and Supabase with enterprise-grade security.

## 🏢 Multi-Tenant SaaS Architecture

**Prepaidly.io is designed as a multi-tenant SaaS platform** where multiple organizations (entities) and their users share the same infrastructure while maintaining complete data isolation and security. Every feature is built with multi-tenancy and data security as core requirements.

## 🔒 Security & Data Isolation

**SECURITY IS OUR TOP PRIORITY** - This application handles sensitive financial data for multiple organizations:

- **Complete tenant isolation** - Organizations cannot access each other's data
- **Row-level security** on all database operations  
- **Entity-based access controls** at all application layers
- **Encrypted data** at rest and in transit
- **Comprehensive audit trails** for compliance
- **Role-based permissions** (Super Admin, Admin, User) per entity

## Features

- 🔐 **Multi-Tenant Authentication**: Secure organization-based user authentication with Supabase
- 🏢 **Entity Management**: Organizations can manage multiple entities/subsidiaries with proper isolation
- 👥 **Role-Based Access Control**: Granular permissions (Super Admin, Admin, User) per entity
- 📊 **Schedule Generation**: Create straight-line amortization schedules for prepayments and unearned revenue
- 📋 **Secure Forms**: User-friendly forms with validation using React Hook Form and Zod
- 📈 **Entity-Scoped Preview**: Real-time preview of generated schedules with proper data isolation
- 📥 **Secure CSV Export**: Download entity-specific schedules with access controls
- 🎨 **Modern UI**: Beautiful interface built with Tailwind CSS and shadcn/ui components
- 🔍 **Audit Trails**: Complete logging of user actions for compliance requirements

## Tech Stack

- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui
- **Database**: Supabase (PostgreSQL) with Row-Level Security (RLS)
- **Authentication**: Supabase Auth with multi-tenant support
- **Form Handling**: React Hook Form
- **Validation**: Zod
- **Date Handling**: date-fns
- **Security**: PostgreSQL RLS, encrypted data, secure session management

## 🚨 Important Security Notes

### For Developers
- **Every new component MUST implement proper entity-based access controls**
- **All database queries MUST use Row-Level Security policies**
- **User permissions MUST be validated at every layer (UI, API, Database)**
- **Data exports MUST be scoped to the current entity only**
- **No feature ships without security review and testing**

### Multi-Tenant Considerations
When developing new features, always consider:
1. **Data Isolation**: Can one organization access another's data?
2. **Entity Context**: Is the current entity properly enforced?
3. **Permission Validation**: Are user roles properly checked?
4. **Audit Logging**: Are actions properly logged for compliance?
5. **Export Security**: Are downloads properly scoped and secure?

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- A Supabase account with proper security configuration

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd prepaidly
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up Supabase with Security**
   - Create a new project at [supabase.com](https://supabase.com)
   - **CRITICAL**: Enable Row Level Security on all tables
   - Go to Settings > API to get your project URL and anon key
   - Run the SQL schema from `schema.sql` in your Supabase SQL editor
   - **Verify RLS policies are properly configured**

4. **Configure environment variables**
   Create a `.env.local` file in the root directory:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url_here
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
   ```

5. **Run the development server**
   ```bash
   npm run dev
   ```

6. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## Database Schema & Security

The application uses a **multi-tenant architecture** with strict data isolation:

### Core Tables
- **`entities`** - Organizations/companies using the platform
- **`entity_users`** - User memberships and roles within entities  
- **`entity_settings`** - Entity-specific configuration and preferences
- **`schedules`** - Schedule information scoped to specific entities
- **`schedule_entries`** - Individual period entries linked to schedules

### Security Implementation
- **Row Level Security (RLS)** enabled on ALL tables
- **Entity-based isolation** - users can only access data for their entities
- **Role-based permissions** enforced at database and application levels
- **Audit trails** for all data modifications
- **Encrypted storage** for sensitive financial data

### 🔒 RLS Policy Examples
```sql
-- Users can only view schedules for entities they belong to
CREATE POLICY "Entity isolation for schedules" ON schedules
  FOR ALL USING (
    entity_id IN (
      SELECT entity_id FROM entity_users 
      WHERE user_id = auth.uid() AND is_active = true
    )
  );
```

## Usage

1. **Sign Up/Login**: Create an account or sign in with existing credentials
2. **Select Entity**: Choose the organization/entity you want to work with
3. **Create Schedule**: Click "New Schedule" from the entity-specific dashboard
4. **Fill Details**: Enter vendor information, dates, and amounts
5. **Generate**: Click "Generate Schedule" to create the amortization schedule
6. **Preview**: Review the generated schedule with entity context
7. **Download**: Export the schedule as a CSV file (entity-scoped)

## Project Structure

```
├── app/
│   ├── (auth)/
│   │   └── login/page.tsx              # Multi-tenant authentication
│   ├── (protected)/
│   │   ├── dashboard/page.tsx          # Entity-specific dashboard
│   │   ├── entities/page.tsx           # Entity management
│   │   ├── new-schedule/page.tsx       # Secure schedule creation
│   │   ├── register/page.tsx           # Entity-scoped schedule registry
│   │   └── settings/page.tsx           # Entity settings management
│   ├── api/
│   │   ├── entities/route.ts           # Entity management API
│   │   ├── settings/route.ts           # Entity settings API
│   │   └── schedules/route.ts          # Schedule management API
├── components/
│   ├── ui/                             # shadcn/ui components
│   ├── EntityManagement.tsx           # Multi-tenant entity management
│   ├── SidebarEntitySelector.tsx      # Secure entity switching
│   ├── SettingsForm.tsx               # Entity-specific settings
│   └── NewScheduleForm.tsx             # Secure schedule creation
├── lib/
│   ├── supabaseClient.ts               # Multi-tenant Supabase config
│   ├── generateStraightLineSchedule.ts # Calculation logic
│   └── utils.ts                        # Utility functions
└── docs/
    └── PRD-prepaidly.md                # Product requirements with security focus
```

## 🔒 Security Best Practices for Contributors

### Code Review Checklist
- [ ] Are all database queries using RLS policies?
- [ ] Is entity context properly validated?
- [ ] Are user permissions checked at all layers?
- [ ] Is sensitive data properly encrypted?
- [ ] Are audit logs generated for data access?
- [ ] Is the feature tested for data isolation?

### Development Guidelines
1. **Always use entity-scoped queries** - Never query across entities
2. **Validate permissions at every endpoint** - Don't trust client-side checks
3. **Log all data access and modifications** - Required for audit compliance
4. **Test with multiple entities** - Ensure proper data isolation
5. **Review security implications** - Consider attack vectors and data leakage

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. **Ensure security requirements are met** - Review the security checklist
4. **Test multi-tenant isolation** - Verify no cross-entity data access
5. Commit your changes (`git commit -m 'Add some amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request with security considerations documented

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For support, email support@prepaidly.io or create an issue in this repository.

**🔒 Security Issues**: Report security vulnerabilities privately to security@prepaidly.io
