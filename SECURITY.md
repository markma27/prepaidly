# 🔒 Prepaidly.io Security Guidelines

**Version:** 1.0  
**Last Updated:** December 2024  
**Document Type:** MANDATORY SECURITY REQUIREMENTS  

## ⚠️ CRITICAL SECURITY NOTICE

**Prepaidly.io is a multi-tenant SaaS application handling sensitive financial data for multiple organizations.** Every developer, contributor, and operator MUST understand and implement these security requirements.

**ZERO TOLERANCE POLICY**: Any security vulnerability or data breach is considered a critical incident.

---

## 🏢 Multi-Tenant Security Architecture

### Core Security Principles

1. **Complete Tenant Isolation** - Organizations cannot access each other's data under any circumstances
2. **Zero-Trust Architecture** - Verify permissions at every layer (UI, API, Database)
3. **Defense in Depth** - Multiple security layers prevent single points of failure
4. **Least Privilege Access** - Users get minimum permissions required for their role
5. **Comprehensive Audit Trails** - All actions logged for compliance and investigation

### Security Layers

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend Security                        │
│  • Entity Context Validation                               │
│  • Role-Based UI Components                                │
│  • Secure Data Fetching                                    │
└─────────────────────────────────────────────────────────────┘
                                │
┌─────────────────────────────────────────────────────────────┐
│                   API Security Layer                       │
│  • Authentication Verification                             │
│  • Entity Access Validation                                │
│  • Permission Checking                                     │
│  • Request/Response Sanitization                           │
└─────────────────────────────────────────────────────────────┘
                                │
┌─────────────────────────────────────────────────────────────┐
│                 Database Security Layer                    │
│  • Row-Level Security (RLS) Policies                       │
│  • Entity-Based Data Isolation                             │
│  • Encrypted Data Storage                                  │
│  • Comprehensive Audit Logging                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔒 MANDATORY DEVELOPMENT SECURITY REQUIREMENTS

### For Every New Component/Feature/Page

#### 1. Entity Context Validation (MANDATORY)

```typescript
// ALWAYS validate entity access before proceeding
const validateEntityAccess = async (entityId: string, requiredRole: string = 'user') => {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    throw new Error('Authentication required')
  }
  
  const { data: access, error } = await supabase
    .from('entity_users')
    .select('role, is_active')
    .eq('entity_id', entityId)
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()
  
  if (error || !access) {
    throw new Error('Access denied to entity')
  }
  
  if (!hasPermission(access.role, requiredRole)) {
    throw new Error('Insufficient permissions')
  }
  
  return access
}
```

#### 2. Row-Level Security Usage (MANDATORY)

```typescript
// CORRECT: Entity-scoped queries with RLS
const getSchedules = async (entityId: string) => {
  const { data, error } = await supabase
    .from('schedules')
    .select('*')
    .eq('entity_id', entityId) // Explicit entity filtering + RLS
  
  return data
}

// INCORRECT: Queries without entity context
const getAllSchedules = async () => {
  const { data, error } = await supabase
    .from('schedules')
    .select('*') // ❌ SECURITY VIOLATION - Could expose cross-tenant data
  
  return data
}
```

#### 3. Permission Matrix Implementation

```typescript
// Define clear permission matrix
const PERMISSIONS = {
  super_admin: ['read', 'write', 'delete', 'admin', 'manage_users', 'manage_entity'],
  admin: ['read', 'write', 'delete', 'manage_users'],
  user: ['read', 'write']
} as const

const hasPermission = (userRole: string, requiredPermission: string): boolean => {
  return PERMISSIONS[userRole as keyof typeof PERMISSIONS]?.includes(requiredPermission) || false
}

const requirePermission = (userRole: string, requiredPermission: string) => {
  if (!hasPermission(userRole, requiredPermission)) {
    throw new Error(`Permission '${requiredPermission}' required`)
  }
}
```

#### 4. Audit Logging (MANDATORY)

```typescript
// Log ALL significant actions
const auditLog = async (action: AuditAction) => {
  await supabase.from('audit_logs').insert({
    entity_id: action.entityId,
    user_id: action.userId,
    action: action.type,
    resource_type: action.resourceType,
    resource_id: action.resourceId,
    details: action.details,
    ip_address: action.ipAddress,
    user_agent: action.userAgent,
    created_at: new Date().toISOString()
  })
}

// Example usage
await auditLog({
  entityId,
  userId: user.id,
  type: 'schedule_created',
  resourceType: 'schedule',
  resourceId: schedule.id,
  details: { amount: schedule.total_amount, vendor: schedule.vendor },
  ipAddress: getClientIP(request),
  userAgent: request.headers.get('user-agent')
})
```

---

## 🚨 SECURITY CHECKLIST FOR ALL PULL REQUESTS

**Every PR MUST pass this checklist before merge:**

### Database Security
- [ ] **RLS Enabled**: All tables have Row-Level Security enabled
- [ ] **Entity Isolation**: All queries include entity_id filtering
- [ ] **Permission Policies**: RLS policies enforce proper access control
- [ ] **No Admin Backdoors**: No queries bypass RLS for convenience

### API Security
- [ ] **Authentication Check**: All endpoints verify user authentication
- [ ] **Entity Validation**: All endpoints validate entity access
- [ ] **Permission Verification**: Required permissions checked before actions
- [ ] **Input Sanitization**: All inputs validated and sanitized
- [ ] **Error Handling**: No sensitive data exposed in error messages

### Frontend Security
- [ ] **Entity Context**: Components validate entity context
- [ ] **Permission Guards**: UI elements respect user permissions
- [ ] **Secure Data Fetching**: API calls include proper entity context
- [ ] **No Data Leakage**: Client-side data scoped to current entity

### Audit & Compliance
- [ ] **Action Logging**: Significant actions logged to audit trail
- [ ] **Data Export Security**: Exports scoped to current entity only
- [ ] **Session Management**: Proper session handling and timeout
- [ ] **Data Retention**: Proper data lifecycle management

---

## 🔒 API Security Standards

### Authentication Flow

```typescript
export async function secureApiHandler(
  request: NextRequest,
  entityId: string,
  requiredPermission: string = 'read'
) {
  try {
    // 1. Authenticate user
    const supabase = createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Validate entity access
    const access = await validateEntityAccess(entityId, requiredPermission)
    
    // 3. Create audit log entry
    await auditLog({
      entityId,
      userId: user.id,
      type: 'api_access',
      resourceType: 'api',
      details: { endpoint: request.nextUrl.pathname, method: request.method }
    })

    return { user, access, supabase }
  } catch (error) {
    console.error('API Security Error:', error)
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }
}
```

### Request Validation

```typescript
// Validate all inputs with Zod schemas
const scheduleCreateSchema = z.object({
  vendor: z.string().min(1).max(255),
  total_amount: z.number().positive().max(999999999.99),
  service_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  service_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  entity_id: z.string().uuid()
})

// Use in API handlers
export async function POST(request: NextRequest) {
  const body = await request.json()
  const validatedData = scheduleCreateSchema.parse(body)
  // ... rest of handler
}
```

---

## 🔒 Database Security Implementation

### Row-Level Security Policies

```sql
-- Example: Complete entity isolation for schedules
CREATE POLICY "schedules_entity_isolation" ON schedules
  FOR ALL USING (
    entity_id IN (
      SELECT entity_id 
      FROM entity_users 
      WHERE user_id = auth.uid() 
      AND is_active = true
    )
  );

-- Example: Role-based access for entity management
CREATE POLICY "entity_management_admin_only" ON entities
  FOR UPDATE USING (
    id IN (
      SELECT entity_id 
      FROM entity_users 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'super_admin')
      AND is_active = true
    )
  );
```

### Performance Optimization for RLS

```sql
-- Optimize RLS queries with proper indexing
CREATE INDEX idx_entity_users_user_entity_active 
ON entity_users(user_id, entity_id, is_active);

CREATE INDEX idx_schedules_entity_created 
ON schedules(entity_id, created_at DESC);

CREATE INDEX idx_audit_logs_entity_timestamp 
ON audit_logs(entity_id, created_at DESC);
```

---

## 🚨 SECURITY TESTING REQUIREMENTS

### Automated Security Tests

```typescript
// Required security tests for every feature
describe('Security Tests', () => {
  describe('Entity Isolation', () => {
    it('should prevent cross-entity data access', async () => {
      const entity1User = await createTestUser('entity1')
      const entity2User = await createTestUser('entity2')
      
      const schedule = await createSchedule(entity1User, 'entity1')
      
      // Attempt cross-entity access
      const response = await fetch(`/api/schedules/${schedule.id}?entity=entity2`, {
        headers: { Authorization: `Bearer ${entity2User.token}` }
      })
      
      expect(response.status).toBe(403)
    })
  })

  describe('Permission Enforcement', () => {
    it('should enforce role-based permissions', async () => {
      const userRole = await createTestUser('entity1', 'user')
      const adminRole = await createTestUser('entity1', 'admin')
      
      // User cannot delete
      const deleteResponse = await fetch(`/api/schedules/${scheduleId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${userRole.token}` }
      })
      expect(deleteResponse.status).toBe(403)
      
      // Admin can delete
      const adminDeleteResponse = await fetch(`/api/schedules/${scheduleId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminRole.token}` }
      })
      expect(adminDeleteResponse.status).toBe(200)
    })
  })
})
```

### Manual Security Testing Checklist

**Before every release:**

1. **Cross-Entity Access Testing**
   - [ ] Create schedules in Entity A
   - [ ] Login as Entity B user
   - [ ] Verify no access to Entity A data via UI
   - [ ] Verify no access to Entity A data via API
   - [ ] Test entity switching functionality

2. **Permission Escalation Testing**
   - [ ] Test user role restrictions
   - [ ] Test admin role capabilities
   - [ ] Test super_admin privileges
   - [ ] Attempt privilege escalation attacks

3. **Data Export Security**
   - [ ] Verify CSV exports contain only current entity data
   - [ ] Test export with manipulated entity parameters
   - [ ] Check for any cross-entity data in exports

4. **Session Security**
   - [ ] Test session timeout handling
   - [ ] Test entity switching without re-authentication
   - [ ] Test concurrent sessions across entities

---

## 🔒 INCIDENT RESPONSE PROCEDURES

### Security Incident Classification

| Level | Type | Examples | Response Time |
|-------|------|----------|---------------|
| **P0 - Critical** | Data Breach | Cross-entity data access, authentication bypass | Immediate (< 1 hour) |
| **P1 - High** | Security Vulnerability | Privilege escalation, unauthorized access | < 4 hours |
| **P2 - Medium** | Data Leakage | Information disclosure, audit trail gaps | < 24 hours |
| **P3 - Low** | Security Weakness | Session fixation, minor information exposure | < 72 hours |

### Immediate Response Steps

1. **Contain the Incident**
   ```bash
   # Immediately isolate affected systems
   # Disable compromised accounts
   # Block suspicious IP addresses
   # Preserve evidence and logs
   ```

2. **Assess Impact**
   ```sql
   -- Query audit logs for affected entities
   SELECT entity_id, COUNT(*) as affected_records
   FROM audit_logs 
   WHERE created_at >= '[incident_start_time]'
   GROUP BY entity_id;
   
   -- Check for unauthorized access patterns
   SELECT user_id, entity_id, action, created_at
   FROM audit_logs
   WHERE created_at >= '[incident_start_time]'
   AND action LIKE '%unauthorized%';
   ```

3. **Document Everything**
   - Timeline of events
   - Affected entities and data
   - Actions taken
   - Root cause analysis

---

## 🔒 COMPLIANCE & AUDIT REQUIREMENTS

### Data Retention Policies

```typescript
// Audit log retention (7 years for financial compliance)
const AUDIT_RETENTION_DAYS = 2555

// Automated cleanup of old audit logs
const cleanupOldAuditLogs = async () => {
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - AUDIT_RETENTION_DAYS)
  
  await supabase
    .from('audit_logs')
    .delete()
    .lt('created_at', cutoffDate.toISOString())
}
```

### Audit Trail Requirements

**MANDATORY audit logging for:**
- User authentication and logout
- Entity creation, modification, deletion
- Schedule creation, modification, deletion
- Data exports and downloads
- Permission changes
- Admin actions
- Security events (failed logins, etc.)

### Compliance Reporting

```sql
-- Generate compliance report for entity
SELECT 
  action,
  COUNT(*) as action_count,
  DATE_TRUNC('month', created_at) as month
FROM audit_logs 
WHERE entity_id = $1 
  AND created_at >= $2 
  AND created_at <= $3
GROUP BY action, DATE_TRUNC('month', created_at)
ORDER BY month DESC, action_count DESC;
```

---

## 🚨 SECURITY TEAM CONTACTS

**Security Incidents**: security@prepaidly.io  
**Emergency Hotline**: [Emergency Contact Number]  
**Security Team Lead**: [Security Lead Contact]  

---

## 📋 FINAL SECURITY CHECKLIST

**Before any code reaches production:**

- [ ] **Code Review**: Security-focused review completed
- [ ] **RLS Verification**: All database queries use proper RLS
- [ ] **Permission Testing**: Role-based access tested
- [ ] **Entity Isolation**: Cross-tenant access prevention verified
- [ ] **Audit Logging**: All actions properly logged
- [ ] **Input Validation**: All inputs sanitized and validated
- [ ] **Error Handling**: No sensitive data in error messages
- [ ] **Security Testing**: Automated security tests pass
- [ ] **Manual Testing**: Security checklist completed
- [ ] **Documentation**: Security considerations documented

**Remember: Every organization trusts us with their sensitive financial data. Security is not negotiable.**

---

**Document Version**: 1.0  
**Next Review**: January 2025  
**Document Owner**: Security Team  
**Approved By**: CTO, Security Lead, Compliance Officer 