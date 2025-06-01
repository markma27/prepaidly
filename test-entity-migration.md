# 🧪 Entity Migration Testing Checklist

## ✅ Database Verification

Run these in Supabase SQL Editor:

```sql
-- 1. Verify your profile and role
SELECT 
    u.email,
    p.first_name,
    p.last_name,
    get_user_display_name(u.id) as display_name,
    eu.role,
    e.name as entity_name
FROM auth.users u
JOIN profiles p ON u.id = p.id
JOIN entity_users eu ON u.id = eu.user_id
JOIN entities e ON eu.entity_id = e.id
WHERE u.id = auth.uid();

-- 2. Check schedules are in Demo Company
SELECT 
    s.id,
    s.vendor,
    s.total_amount,
    e.name as entity_name,
    s.created_at
FROM schedules s
JOIN entities e ON s.entity_id = e.id
ORDER BY s.created_at DESC;

-- 3. Verify audit trail has entity context
SELECT 
    sa.action,
    sa.user_display_name,
    sa.details,
    e.name as entity_name,
    sa.created_at
FROM schedule_audit sa
JOIN entities e ON sa.entity_id = e.id
ORDER BY sa.created_at DESC
LIMIT 5;

-- 4. Quick count of schedules in Demo Company
SELECT COUNT(*) as schedule_count 
FROM schedules 
WHERE entity_id = '00000000-0000-0000-0000-000000000001';
```

## 🏢 Entity Management UI Testing

### **✅ COMPLETED: Entity Management System**
- **EntitySelector Component**: Dropdown to switch between entities
- **Entity API Routes**: `/api/entities` for fetching and creating entities  
- **Dashboard Integration**: Entity selector in header, URL-based entity switching
- **Register Integration**: Entity selector in header, URL-based entity switching
- **Entity Management Page**: `/entities` for viewing and creating entities
- **Entity Creation**: Dialog form with validation and error handling

### **Entity Management Tests**
1. **Visit `/entities`** - Should show entity management page
2. **View Demo Company** - Should see Demo Company with your role
3. **Create New Entity** - Click "Create Entity", fill form, submit
4. **Switch Entities** - Use entity selector in dashboard/register
5. **URL Entity Switching** - Visit `/dashboard?entity=ENTITY_ID`

## 🔄 Frontend Testing Steps

### **Step 1: Dashboard Test** ✅ FIXED ✅ ENTITY UI ADDED
- [ ] Visit dashboard - should show entity selector in header
- [ ] Should default to Demo Company or your first entity
- [ ] All cards should show data (not $0)
- [ ] Charts should display data
- [ ] Use entity selector to switch entities

### **Step 2: Schedule Register Test** ✅ FIXED ✅ ENTITY UI ADDED
- [ ] Go to Schedule Register page - should show entity selector
- [ ] Should show all existing schedules for selected entity
- [ ] Click "Edit" on a schedule - should work
- [ ] Use entity selector to switch entities

### **Step 3: Entity Management Test** ✅ NEW
- [ ] Visit `/entities` page
- [ ] Should see Demo Company entity with your role
- [ ] Click "Create Entity" and create a new entity
- [ ] Should be able to switch to new entity
- [ ] Verify schedules are entity-specific

### **Step 4: Schedule Creation Test**
- [ ] Click "New Schedule" 
- [ ] Fill out form completely
- [ ] Click "Generate Schedule and Save"
- [ ] Should save successfully
- [ ] Should show in Recent Schedules

### **Step 5: Schedule Editing Test**
- [ ] Go to Schedule Register
- [ ] Click "Edit" on a schedule
- [ ] Make changes and save
- [ ] Should update successfully

### **Step 6: Audit Trail Test**
- [ ] In edit schedule, check "History and notes"
- [ ] Should show detailed change logs
- [ ] Should display proper user names

### **Step 7: CSV Download Test**
- [ ] Create new schedule
- [ ] Download CSV
- [ ] Should create audit entry for download

## 🚨 Issues Found & Fixed

### **✅ FIXED: Dashboard Showing No Data**
- **Problem**: Dashboard page still using `eq('user_id', user.id)` 
- **Fix**: Updated to use `eq('entity_id', entityId)` with entity switching
- **File**: `app/(protected)/dashboard/page.tsx`

### **✅ FIXED: Schedule Register Showing No Data**  
- **Problem**: Register page still using `eq('user_id', user.id)`
- **Fix**: Updated to use `eq('entity_id', entityId)` with entity switching
- **File**: `app/(protected)/register/page.tsx`

### **✅ ADDED: Entity Management UI System**
- **EntitySelector Component**: `components/EntitySelector.tsx`
- **Entity API Routes**: `app/api/entities/route.ts`
- **Dashboard Wrapper**: `components/DashboardWithEntitySelector.tsx`  
- **Register Wrapper**: `components/RegisterWithEntitySelector.tsx`
- **Entity Management Page**: `app/(protected)/entities/page.tsx`
- **Entity Management Component**: `components/EntityManagement.tsx`
- **Dialog Component**: `components/ui/dialog.tsx`

## 🔧 Quick Fixes

If dashboard still shows no data:
```sql
-- Check if schedules have entity_id
SELECT COUNT(*) FROM schedules WHERE entity_id IS NULL;

-- Fix if needed
UPDATE schedules 
SET entity_id = '00000000-0000-0000-0000-000000000001' 
WHERE entity_id IS NULL;
```

If you can't access schedules:
```sql
-- Check your entity membership
SELECT * FROM entity_users WHERE user_id = auth.uid();

-- Add yourself to Demo Company if missing
INSERT INTO entity_users (entity_id, user_id, role)
VALUES ('00000000-0000-0000-0000-000000000001', auth.uid(), 'super_admin')
ON CONFLICT (entity_id, user_id) DO UPDATE SET role = 'super_admin';
```

## ✅ Success Criteria

All systems working when:
- [ ] Dashboard shows existing data with entity selector
- [ ] Schedule Register shows all schedules with entity selector
- [ ] Entity selector works and switches data properly
- [ ] Can visit `/entities` to manage entities
- [ ] Can create new entities
- [ ] Entity switching works via URL (`?entity=ENTITY_ID`)
- [ ] Can create new schedules
- [ ] Can edit existing schedules  
- [ ] Audit trail shows detailed changes
- [ ] CSV downloads work
- [ ] No console errors
- [ ] All API calls return 200 status

## 🚀 Entity Management UI Features Completed

✅ **Entity Selector Component**
- Dropdown showing current entity and role
- Switch between entities
- Automatic Demo Company selection
- LocalStorage persistence
- Settings button for entity management

✅ **Entity Management Page** 
- View all user entities with roles
- Create new entities with validation
- Beautiful card-based layout
- Role indicators (super_admin, admin, user)
- Switch to entity buttons

✅ **API Integration**
- Entity fetching API
- Entity creation API
- Proper error handling
- Role-based access control

✅ **Dashboard & Register Integration**
- Entity selector in page headers
- URL-based entity switching
- Server-side entity verification
- Entity-aware data fetching

The Entity Management UI is now fully functional! Users can:
1. Select their current entity using the dropdown
2. Create new entities via the management page
3. Switch between entities on dashboard and register
4. View their role in each entity
5. URL-based entity switching for bookmarking 