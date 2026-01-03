# Supabase JDBC Prepared Statement Fix

## Problem
When using Supabase (which uses pgBouncer connection pooling), you may encounter this error:
```
ERROR: prepared statement "S_5" already exists
```

This happens because Supabase's connection pooler doesn't support prepared statements.

## Solution
Add `prepareThreshold=0` to your database connection URL to disable prepared statements.

## Steps to Fix

1. Open your `backend/src/main/resources/application-local.properties` file

2. Find the line with `spring.datasource.url` that points to Supabase

3. Add `&prepareThreshold=0` to the end of the URL

**Before:**
```properties
spring.datasource.url=jdbc:postgresql://db.xxxxx.supabase.co:5432/postgres?sslmode=require
```

**After:**
```properties
spring.datasource.url=jdbc:postgresql://db.xxxxx.supabase.co:5432/postgres?sslmode=require&prepareThreshold=0
```

4. Restart your backend server

## Why This Works
- Supabase uses pgBouncer for connection pooling
- pgBouncer in "transaction" mode doesn't support prepared statements
- Setting `prepareThreshold=0` tells the PostgreSQL JDBC driver to not use prepared statements
- This is safe for Supabase and won't affect functionality

## Note
If you're using a local PostgreSQL database (not Supabase), you don't need this parameter.

