# Prepaidly.io Setup Guide

## ⚠️ CRITICAL SECURITY NOTICE

**Prepaidly.io is a multi-tenant SaaS application handling sensitive financial data for multiple organizations.** Proper security setup is MANDATORY - incorrect configuration could lead to data breaches or cross-tenant data exposure.

## 🔒 Security Requirements Checklist

Before proceeding with setup, ensure you understand:

- [ ] **Multi-tenant architecture** - Multiple organizations share this instance
- [ ] **Row-Level Security (RLS)** must be enabled on ALL tables
- [ ] **Entity isolation** is critical for data security
- [ ] **Audit logging** is required for compliance
- [ ] **No shortcuts** - every security measure is mandatory

---

## Quick Setup Instructions

### 1. Environment Variables

Create a `.env.local` file in the root directory with the following content:

```env
# Supabase Configuration
# Get these values from your Supabase project dashboard: https://app.supabase.com/
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here

# Security Configuration
NEXT_PUBLIC_APP_ENV=development
SECURITY_HEADERS_ENABLED=true

# Development/Production Flag
NODE_ENV=development
```

### 2. 🔒 Secure Supabase Setup

1. **Create a Supabase Project**
   - Go to [supabase.com](https://supabase.com)
   - Click "New Project"
   - Choose your organization and enter project details
   - **IMPORTANT**: Choose a strong database password
   - Wait for the project to be created

2. **Configure Security Settings**
   - Go to Authentication > Settings
   - **MANDATORY**: Enable email confirmation
   - Set session timeout appropriately (recommended: 24 hours)
   - Configure password requirements (minimum 8 characters)

3. **Get Your Project Credentials**
   - Go to Settings > API
   - Copy the "Project URL" and "anon public" key
   - **NEVER COMMIT THESE TO GIT**
   - Add these to your `.env.local` file

4. **🔒 CRITICAL: Set Up Multi-Tenant Database Schema**
   - Go to the SQL Editor in your Supabase dashboard
   - **MANDATORY**: Copy and run the complete schema from `schema.sql`
   - **VERIFY**: Ensure Row-Level Security is enabled on all tables
   - **TEST**: Verify RLS policies are working correctly

### 3. 🔒 Database Security Verification

After running the schema, **MANDATORY** verification steps:

```sql
-- 1. Verify RLS is enabled on all tables
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' AND rowsecurity = false;
-- This should return NO rows (empty result)

-- 2. Verify policies exist
SELECT schemaname, tablename, policyname 
FROM pg_policies 
WHERE schemaname = 'public';
-- This should show policies for all tables

-- 3. Test entity isolation (run as different users)
-- Create test data and ensure users can only see their own entities
```

### 4. 🔒 Security Testing

**MANDATORY before going live:**

1. **Entity Isolation Test**
   ```bash
   # Create two test users with different entities
   # Verify user A cannot access user B's data
   # Test all API endpoints
   ```

2. **Permission Testing**
   ```bash
   # Test different user roles (super_admin, admin, user)
   # Verify role restrictions work correctly
   # Test permission escalation attempts
   ```

3. **Data Export Security**
   ```bash
   # Verify CSV exports only contain current entity data
   # Test with wrong entity IDs
   # Check for any data leakage
   ```

### 5. Test the Application

1. **Start the development server**
   ```bash
   npm run dev
   ```

2. **Open your browser**
   - Navigate to [http://localhost:3000](http://localhost:3000)
   - You should be redirected to the login page

3. **Create an account and first entity**
   - Click "Don't have an account? Sign up"
   - Enter your email and password
   - Check your email for the confirmation link
   - **IMPORTANT**: You'll be prompted to create your first entity

4. **Test multi-tenant functionality**
   - Create schedules within your entity
   - Verify entity selector works correctly
   - Test entity switching (if you have multiple entities)
   - **CRITICAL**: Verify you cannot access other entities' data

### 6. 🚨 Troubleshooting

**Security-Related Issues:**

- **Cross-entity data access**: STOP - Review RLS policies immediately
- **Missing audit logs**: STOP - Verify audit logging is working
- **Authentication bypass**: STOP - Review authentication configuration
- **Permission escalation**: STOP - Review role-based access controls

**Common Setup Issues:**

- **Environment variables not loading**: Make sure `.env.local` is in the root directory and restart the dev server
- **Supabase connection errors**: Verify your URL and key are correct in the environment file
- **Database errors**: Ensure you've run the complete `schema.sql` script
- **RLS policy errors**: Verify all policies are correctly applied
- **Authentication issues**: Check that email authentication is properly configured

**🔒 Security Incident Response:**

If you discover any security issues:
1. **Immediately isolate** the affected system
2. **Document** the issue and impact
3. **Review logs** for any unauthorized access
4. **Fix** the root cause before proceeding
5. **Test** the fix thoroughly

### 7. 🔒 Production Deployment Security

**MANDATORY security checklist for production:**

1. **Environment Security**
   ```env
   # Production environment variables
   NODE_ENV=production
   NEXT_PUBLIC_APP_ENV=production
   SECURITY_HEADERS_ENABLED=true
   
   # Secure Supabase configuration
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key  # Server-only
   
   # Audit & Monitoring
   AUDIT_LOG_RETENTION_DAYS=2555  # 7 years for compliance
   ERROR_REPORTING_ENABLED=true
   ```

2. **Hosting Platform Configuration**
   - **Vercel**: Add environment variables to project settings
   - **Security headers**: Ensure CSP, HSTS, and other security headers are enabled
   - **Domain security**: Configure proper CORS settings
   - **SSL/TLS**: Ensure HTTPS is enforced

3. **Supabase Production Settings**
   - **Row-Level Security**: Triple-check all policies are active
   - **Database backups**: Configure encrypted backups
   - **Auth settings**: Review and secure authentication configuration
   - **API rate limiting**: Configure appropriate limits
   - **Audit logging**: Ensure comprehensive logging is enabled

4. **Monitoring & Alerting**
   - **Security monitoring**: Set up alerts for failed auth attempts
   - **Cross-tenant access**: Alert on any cross-entity data access
   - **Performance monitoring**: Monitor RLS policy performance
   - **Error tracking**: Comprehensive error logging without data exposure

### 8. 🔒 Ongoing Security Maintenance

**Daily:**
- [ ] Monitor audit logs for suspicious activity
- [ ] Check for failed authentication attempts
- [ ] Verify backup integrity

**Weekly:**
- [ ] Review access logs and user activity
- [ ] Test core security functions
- [ ] Update dependencies with security patches

**Monthly:**
- [ ] Comprehensive security testing
- [ ] Review and rotate API keys
- [ ] Audit user permissions and entity access
- [ ] Update security documentation

### 9. 🚨 FINAL SECURITY REMINDER

**Before launching Prepaidly.io:**

1. **Complete security testing** - No exceptions
2. **Verify multi-tenant isolation** - Test with real data
3. **Review audit logging** - Ensure compliance readiness
4. **Document security procedures** - For incident response
5. **Train all team members** - On security requirements

**🔒 Remember: You are handling sensitive financial data for multiple organizations. Security is not optional - it's the foundation of our multi-tenant SaaS platform.**

---

**Need Help?**

- **General Setup**: Check browser console and terminal for errors
- **Security Issues**: Contact security team immediately
- **Database Issues**: Review RLS policies and schema setup
- **Authentication Problems**: Verify Supabase auth configuration

**That's it! Your secure, multi-tenant Prepaidly.io application should now be running successfully with enterprise-grade security.** 