# Prepaidly.io Development Instructions

**Last Updated:** 31 May 2025  
**Version:** 1.0  
**Maintainer:** Engineering Team  

## ⚠️ CRITICAL PROJECT REQUIREMENTS

### 🏢 Multi-Tenant SaaS Application
**Prepaidly.io is a multi-tenant SaaS web application** where multiple organizations (entities) and their users share the same infrastructure while maintaining complete data isolation and security.

### 🔒 SECURITY IS PARAMOUNT
**EVERY feature, component, page, and database interaction MUST implement proper security measures:**

- **Complete tenant isolation** - No organization can access another's data
- **Row-level security** on ALL database operations  
- **Entity-based access controls** at ALL application layers
- **Encrypted data** at rest and in transit
- **Comprehensive audit trails** for all data access and modifications
- **Zero-trust architecture** - verify permissions at every layer

**⚠️ NO FEATURE SHIPS WITHOUT PROPER SECURITY IMPLEMENTATION AND TESTING**

---

## Project Overview

Prepaidly.io is a specialized **multi-tenant SaaS platform** for automating prepayment and unearned revenue schedule management. The application enables finance teams to replace error-prone spreadsheet workflows with guided, automated schedule generation and professional reporting.

**Core Mission**: Transform complex revenue recognition calculations into intuitive, audit-ready workflows that save hours of manual work while ensuring compliance accuracy and enterprise-grade security.

## Goals & Non-Goals

### ✅ Goals (Milestone 1)
- **Security First**: Multi-tenant data isolation and enterprise-grade security
- **Simplicity First**: Prioritize user experience over feature complexity
- **Calculation Accuracy**: Zero tolerance for mathematical errors in schedule generation
- **Audit Readiness**: All data trails and exports must support compliance requirements
- **Performance**: Sub-2-second page loads, instant form feedback
- **Entity Isolation**: Perfect data separation between organizations
- **Mobile Responsive**: Full functionality on tablets and mobile devices

### ❌ Non-Goals (Deferred to Future Milestones)
- Advanced schedule types (non-linear, milestone-based)
- Real-time collaboration features
- Third-party integrations (Xero, QuickBooks, etc.)
- Custom reporting beyond CSV export
- Advanced enterprise features (SSO, SCIM)
- AI/ML-powered recommendations

## 🔒 MANDATORY SECURITY REQUIREMENTS

### For Every New Component/Page/Feature:

#### 1. Entity Context Validation
```typescript
// MANDATORY: Every component must validate entity context
const { data: userAccess } = await supabase
  .from('entity_users')
  .select('role')
  .eq('entity_id', entityId)
  .eq('user_id', user.id)
  .eq('is_active', true)
  .single()

if (!userAccess) {
  // Handle unauthorized access
}
```

#### 2. Row-Level Security Usage
```typescript
// GOOD: RLS automatically filters by entity
const { data: schedules } = await supabase
  .from('schedules')
  .select('*')
  .eq('entity_id', entityId) // Still include for clarity

// BAD: Never query without entity context
const { data: allSchedules } = await supabase
  .from('schedules')
  .select('*') // ❌ Could expose cross-tenant data
```

#### 3. Permission Validation
```typescript
// Check permissions at multiple layers
const hasPermission = (userRole: string, action: string) => {
  const permissions = {
    super_admin: ['read', 'write', 'delete', 'admin'],
    admin: ['read', 'write', 'delete'],
    user: ['read', 'write']
  }
  return permissions[userRole]?.includes(action)
}
```

#### 4. Audit Logging (Required)
```typescript
// Log all significant actions
await supabase.from('audit_logs').insert({
  entity_id: entityId,
  user_id: user.id,
  action: 'schedule_created',
  resource_type: 'schedule',
  resource_id: scheduleId,
  details: { metadata }
})
```

### Development Security Checklist
**Every PR must pass this checklist:**

- [ ] **Entity Context**: Is the current entity properly enforced?
- [ ] **RLS Policies**: Are all database queries using RLS?
- [ ] **Permission Checks**: Are user roles validated at UI, API, and DB layers?
- [ ] **Data Isolation**: Can one organization access another's data?
- [ ] **Audit Logging**: Are significant actions logged?
- [ ] **Input Validation**: Are all inputs properly sanitized?
- [ ] **Export Security**: Are downloads scoped to current entity only?
- [ ] **Error Handling**: Do error messages avoid leaking sensitive data?

## Tech Stack

### Frontend
- **Next.js 14** with App Router (React Server Components)
- **TypeScript** (strict mode enabled with security-focused types)
- **Tailwind CSS** for styling
- **Shadcn/UI** component library
- **React Hook Form** + **Zod** for form validation
- **Geist Font** (consistent typography)

### Backend & Database
- **Supabase** (authentication, PostgreSQL, real-time with RLS)
- **PostgreSQL** with Row Level Security (RLS) - MANDATORY
- **Supabase Auth** (email/password authentication with multi-tenant support)

### Security Stack
- **Row-Level Security (RLS)** on ALL tables
- **Entity-based isolation** at application layer
- **Role-based access control** (Super Admin, Admin, User)
- **Audit logging** for compliance
- **Data encryption** at rest and in transit

### Development Tools
- **ESLint** + **Prettier** (enforced formatting)
- **TypeScript** strict checking with security linting
- **Husky** pre-commit hooks (security checks)

### Hosting & Deployment
- **Vercel** (Next.js optimized hosting)
- **Supabase Cloud** (database and auth with enterprise security)

## Folder & Naming Conventions

```
prepaidly/
├── app/
│   ├── (auth)/                   # Route groups for auth pages
│   │   ├── login/page.tsx        # Multi-tenant authentication
│   │   └── register/page.tsx     # Secure registration
│   ├── (protected)/              # Protected routes requiring auth
│   │   ├── dashboard/page.tsx    # Entity-specific dashboard
│   │   ├── entities/page.tsx     # Entity management (secure)
│   │   ├── new-schedule/page.tsx # Secure schedule creation
│   │   ├── register/             # Schedule registry (entity-scoped)
│   │   │   ├── page.tsx
│   │   │   └── [id]/edit/page.tsx
│   │   └── settings/page.tsx     # Entity-specific settings
│   ├── api/                      # API routes with security
│   │   ├── entities/
│   │   │   ├── route.ts          # Entity CRUD with RLS
│   │   │   └── [id]/route.ts     # Entity-specific operations
│   │   ├── schedules/
│   │   │   ├── route.ts          # Schedule CRUD with entity isolation
│   │   │   └── [id]/route.ts     # Schedule operations
│   │   ├── settings/route.ts     # Entity settings API
│   │   └── audit/route.ts        # Audit logging API
│   ├── globals.css               # Global styles
│   └── layout.tsx                # Root layout with security headers
├── components/
│   ├── ui/                       # Shadcn/UI components
│   ├── EntityManagement.tsx     # Secure entity management
│   ├── SidebarEntitySelector.tsx # Secure entity switching
│   ├── SettingsForm.tsx         # Entity-specific settings
│   ├── NewScheduleForm.tsx      # Secure schedule creation
│   └── ProtectedRoute.tsx       # Route protection wrapper
├── lib/
│   ├── supabaseClient.ts        # Multi-tenant Supabase config
│   ├── auth.ts                  # Authentication utilities
│   ├── permissions.ts           # Permission checking utilities
│   ├── audit.ts                 # Audit logging utilities
│   ├── generateStraightLineSchedule.ts # Calculation logic
│   └── utils.ts                 # General utilities
├── types/
│   ├── database.ts              # Database type definitions
│   ├── auth.ts                  # Authentication types
│   └── entities.ts              # Entity-related types
├── middleware.ts                # Route protection and entity validation
└── docs/
    ├── PRD-prepaidly.md         # Product requirements
    └── SECURITY.md              # Security guidelines
```

### Naming Conventions
- **Files**: PascalCase for React components, camelCase for utilities
- **Components**: PascalCase (e.g., `EntityManagement.tsx`)
- **Functions**: camelCase (e.g., `validateEntityAccess`)
- **Constants**: SCREAMING_SNAKE_CASE (e.g., `MAX_SCHEDULE_ENTRIES`)
- **Database**: snake_case (e.g., `schedule_entries`, `entity_id`)
- **Security Functions**: Prefix with `validate` or `check` (e.g., `validateEntityPermission`)

## 🔒 MULTI-TENANT DATABASE SCHEMA

### Core Security Tables

```sql
-- Entities (Organizations/Companies)
CREATE TABLE entities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  is_demo BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Entity Users (Multi-tenant user memberships)
CREATE TABLE entity_users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_id UUID REFERENCES entities(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('super_admin', 'admin', 'user')),
  is_active BOOLEAN DEFAULT true,
  invited_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(entity_id, user_id)
);

-- Entity Settings (Per-organization configuration)
CREATE TABLE entity_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_id UUID REFERENCES entities(id) ON DELETE CASCADE UNIQUE,
  currency TEXT DEFAULT 'USD',
  timezone TEXT DEFAULT 'UTC',
  prepaid_accounts JSONB DEFAULT '[]',
  unearned_accounts JSONB DEFAULT '[]',
  xero_integration JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Schedules (Entity-scoped financial schedules)
CREATE TABLE schedules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_id UUID REFERENCES entities(id) ON DELETE CASCADE,
  vendor TEXT NOT NULL,
  reference_number TEXT,
  type TEXT NOT NULL CHECK (type IN ('prepayment', 'unearned')),
  total_amount DECIMAL(12,2) NOT NULL,
  service_start DATE NOT NULL,
  service_end DATE NOT NULL,
  description TEXT,
  invoice_date DATE NOT NULL,
  account_id TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Schedule Entries (Individual amortization entries)
CREATE TABLE schedule_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  schedule_id UUID REFERENCES schedules(id) ON DELETE CASCADE,
  period_date DATE NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  cumulative_amount DECIMAL(12,2) NOT NULL,
  remaining_balance DECIMAL(12,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Audit Logs (Comprehensive audit trail)
CREATE TABLE audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_id UUID REFERENCES entities(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id UUID,
  details JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 🔒 MANDATORY ROW LEVEL SECURITY POLICIES

```sql
-- Enable RLS on ALL tables
ALTER TABLE entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE entity_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE entity_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Entity Users: Users can only see their own memberships
CREATE POLICY "Users see own entity memberships" ON entity_users
  FOR ALL USING (user_id = auth.uid());

-- Entities: Users can only see entities they belong to
CREATE POLICY "Users see entities they belong to" ON entities
  FOR SELECT USING (
    id IN (
      SELECT entity_id FROM entity_users 
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- Entity Settings: Users can only access settings for their entities
CREATE POLICY "Entity settings isolation" ON entity_settings
  FOR ALL USING (
    entity_id IN (
      SELECT entity_id FROM entity_users 
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- Schedules: Complete entity isolation
CREATE POLICY "Schedule entity isolation" ON schedules
  FOR ALL USING (
    entity_id IN (
      SELECT entity_id FROM entity_users 
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- Schedule Entries: Inherit isolation from parent schedule
CREATE POLICY "Schedule entries isolation" ON schedule_entries
  FOR ALL USING (
    schedule_id IN (
      SELECT s.id FROM schedules s
      JOIN entity_users eu ON s.entity_id = eu.entity_id
      WHERE eu.user_id = auth.uid() AND eu.is_active = true
    )
  );

-- Audit Logs: Users can only see logs for their entities
CREATE POLICY "Audit logs entity isolation" ON audit_logs
  FOR SELECT USING (
    entity_id IN (
      SELECT entity_id FROM entity_users 
      WHERE user_id = auth.uid() AND is_active = true
    )
  );
```

### Security Notes
- **RLS is MANDATORY** on all tables containing sensitive data
- **Entity ID validation** must occur at both RLS and application layers
- **Role-based permissions** enforced through entity_users table
- **Audit trails** required for all data modifications
- **No direct user_id references** in business tables (use entity_id instead)

## 🔒 API SECURITY STANDARDS

### Authentication & Authorization Flow

```typescript
// MANDATORY: Every API endpoint must follow this pattern
export async function GET(request: NextRequest) {
  try {
    // 1. Authenticate user
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Extract and validate entity ID
    const entityId = request.nextUrl.searchParams.get('entity')
    if (!entityId) {
      return NextResponse.json({ error: 'Entity ID required' }, { status: 400 })
    }

    // 3. Verify user has access to entity
    const { data: userAccess } = await supabase
      .from('entity_users')
      .select('role')
      .eq('entity_id', entityId)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single()

    if (!userAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // 4. Perform business logic with entity context
    const { data, error } = await supabase
      .from('schedules')
      .select('*')
      .eq('entity_id', entityId) // RLS will also enforce this

    // 5. Log the action for audit
    await supabase.from('audit_logs').insert({
      entity_id: entityId,
      user_id: user.id,
      action: 'schedules_viewed',
      resource_type: 'schedule',
      details: { count: data?.length }
    })

    return NextResponse.json({ data })
  } catch (error) {
    // 6. Never expose internal errors
    console.error('API Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

### Permission Checking Utilities

```typescript
// lib/permissions.ts
export const hasPermission = (userRole: string, action: string): boolean => {
  const permissions = {
    super_admin: ['read', 'write', 'delete', 'admin', 'manage_users'],
    admin: ['read', 'write', 'delete', 'manage_users'],
    user: ['read', 'write']
  }
  
  return permissions[userRole]?.includes(action) || false
}

export const requirePermission = (userRole: string, action: string) => {
  if (!hasPermission(userRole, action)) {
    throw new Error('Insufficient permissions')
  }
}
```

## 🔒 FRONTEND SECURITY PATTERNS

### Entity Context Management

```typescript
// hooks/useEntityContext.ts
export const useEntityContext = () => {
  const [currentEntity, setCurrentEntity] = useState<Entity | null>(null)
  
  const validateEntityAccess = async (entityId: string) => {
    const supabase = createClient()
    const { data: userAccess } = await supabase
      .from('entity_users')
      .select('role')
      .eq('entity_id', entityId)
      .eq('user_id', user?.id)
      .eq('is_active', true)
      .single()
    
    return userAccess
  }
  
  return { currentEntity, setCurrentEntity, validateEntityAccess }
}
```

### Secure Component Pattern

```typescript
// components/SecureComponent.tsx
interface SecureComponentProps {
  entityId: string
  requiredPermission?: string
  children: React.ReactNode
}

export const SecureComponent = ({ 
  entityId, 
  requiredPermission = 'read', 
  children 
}: SecureComponentProps) => {
  const { user } = useAuth()
  const { validateEntityAccess } = useEntityContext()
  const [hasAccess, setHasAccess] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const checkAccess = async () => {
      try {
        const access = await validateEntityAccess(entityId)
        const hasRequiredPermission = hasPermission(access?.role, requiredPermission)
        setHasAccess(hasRequiredPermission)
      } catch (error) {
        setHasAccess(false)
      } finally {
        setLoading(false)
      }
    }

    if (user && entityId) {
      checkAccess()
    }
  }, [user, entityId, requiredPermission])

  if (loading) return <LoadingSpinner />
  if (!hasAccess) return <AccessDenied />
  
  return <>{children}</>
}
```

### Secure Data Fetching

```typescript
// lib/secureApi.ts
export const secureApiCall = async (
  endpoint: string,
  entityId: string,
  options: RequestInit = {}
) => {
  const response = await fetch(`${endpoint}?entity=${entityId}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  if (!response.ok) {
    if (response.status === 403) {
      throw new Error('Access denied to this entity')
    }
    throw new Error('API request failed')
  }

  return response.json()
}
```

## 🚨 SECURITY TESTING REQUIREMENTS

### Manual Testing Checklist
Before any feature can be merged:

1. **Entity Isolation Test**:
   - Create two test entities with different users
   - Verify user A cannot access user B's data
   - Test all API endpoints with wrong entity IDs

2. **Permission Escalation Test**:
   - Test with different user roles (user, admin, super_admin)
   - Verify role restrictions are properly enforced
   - Test role changes mid-session

3. **Data Export Security**:
   - Verify CSV exports only contain current entity data
   - Test with wrong entity ID in export requests
   - Check for data leakage in export files

4. **Session Security**:
   - Test entity switching with proper re-authentication
   - Verify session timeout handling
   - Test concurrent sessions across entities

### Automated Security Tests

```typescript
// __tests__/security/entityIsolation.test.ts
describe('Entity Isolation', () => {
  it('should not allow cross-entity data access', async () => {
    const entity1User = await createTestUser('entity1')
    const entity2User = await createTestUser('entity2')
    
    // Create schedule in entity1
    const schedule = await createSchedule(entity1User, 'entity1')
    
    // Try to access from entity2 user
    const response = await fetch(`/api/schedules/${schedule.id}?entity=entity2`, {
      headers: { Authorization: `Bearer ${entity2User.token}` }
    })
    
    expect(response.status).toBe(403)
  })
})
```

## 🔒 DEPLOYMENT SECURITY REQUIREMENTS

### Environment Variables (Production)
```env
# Database Security
NEXT_PUBLIC_SUPABASE_URL=your_secure_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key  # Server-only

# Security Headers
NEXT_PUBLIC_APP_ENV=production
SECURITY_HEADERS_ENABLED=true

# Audit & Monitoring
AUDIT_LOG_RETENTION_DAYS=2555  # 7 years for compliance
ERROR_REPORTING_ENABLED=true
PERFORMANCE_MONITORING_ENABLED=true
```

### Security Headers (next.config.js)
```typescript
const nextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
        ],
      },
    ]
  },
}
```

## 🔒 INCIDENT RESPONSE PLAN

### Security Incident Classifications

1. **Critical (P0)**: Data breach, unauthorized cross-tenant access
2. **High (P1)**: Authentication bypass, privilege escalation
3. **Medium (P2)**: Data leakage, audit log tampering
4. **Low (P3)**: Information disclosure, session fixation

### Response Procedures

1. **Immediate (0-1 hour)**:
   - Identify and contain the breach
   - Preserve evidence and logs
   - Notify security team and stakeholders

2. **Short-term (1-24 hours)**:
   - Implement temporary fixes
   - Analyze root cause
   - Document impact and affected entities

3. **Long-term (1-7 days)**:
   - Implement permanent fixes
   - Update security procedures
   - Notify affected customers (if required)
   - Conduct post-mortem review

## Development Workflow

### 🔒 Security-First Development Process

1. **Design Phase**:
   - Security review of feature requirements
   - Entity isolation design consideration
   - Permission matrix definition

2. **Implementation Phase**:
   - Entity context validation implementation
   - RLS policy creation/verification
   - Audit logging integration

3. **Testing Phase**:
   - Security testing checklist completion
   - Multi-tenant isolation verification
   - Permission escalation testing

4. **Code Review Phase**:
   - Security-focused code review
   - RLS policy verification
   - Audit trail validation

5. **Deployment Phase**:
   - Security configuration verification
   - Monitoring and alerting setup
   - Incident response preparation

### Git Workflow
1. Create feature branch with security consideration
2. Implement with security-first mindset
3. Complete security testing checklist
4. Request security-focused code review
5. Deploy with monitoring enabled

## Performance Considerations

### Multi-Tenant Performance Optimization

```sql
-- Optimal indexes for multi-tenant queries
CREATE INDEX idx_schedules_entity_id_created_at ON schedules(entity_id, created_at DESC);
CREATE INDEX idx_entity_users_user_entity_active ON entity_users(user_id, entity_id, is_active);
CREATE INDEX idx_audit_logs_entity_timestamp ON audit_logs(entity_id, created_at DESC);
```

### Database Connection Pooling
- Use Supabase connection pooling
- Implement query optimization for RLS policies
- Monitor query performance per entity

### Frontend Performance
- Entity-scoped data caching
- Lazy loading of entity-specific components
- Optimistic updates with proper rollback

## Monitoring & Observability

### Security Metrics to Track
- Failed authentication attempts per entity
- Cross-entity access attempts (should be zero)
- Permission escalation attempts
- Data export volumes per entity
- Audit log completeness

### Performance Metrics
- Query performance per entity
- RLS policy execution time
- Entity switching response time
- Multi-tenant load distribution

### Alerting Rules
- Any cross-entity data access (immediate alert)
- Failed authentication spike (rate-based alert)
- Unusual data export volumes (threshold alert)
- RLS policy bypass attempts (immediate alert)

---

## 🔒 FINAL SECURITY REMINDER

**Every line of code you write affects the security of multiple organizations' financial data. When in doubt:**

1. **Ask for security review**
2. **Test with multiple entities**
3. **Verify RLS policies are working**
4. **Check audit logs are generated**
5. **Validate entity context at every layer**

**Security is not optional - it's the foundation of our multi-tenant SaaS platform.** 