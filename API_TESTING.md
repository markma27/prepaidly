# API Testing Guide

## Prerequisites

1. Start the backend server:
   ```bash
   cd backend
   gradle bootRun --args='--spring.profiles.active=local'
   ```

2. The server will run on: `http://localhost:8080`

3. Verify server is running:
   ```bash
   curl http://localhost:8080/api/health
   ```

## Testing User CRUD APIs

### 1. Create User (POST)

```bash
curl -X POST http://localhost:8080/api/users \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com"
  }'
```

**Expected Response (201 Created):**
```json
{
  "id": 1,
  "email": "test@example.com",
  "createdAt": "2025-11-15T20:00:00"
}
```

**Error Response (409 Conflict - duplicate email):**
```json
{
  "error": "User with email test@example.com already exists"
}
```

### 2. Get All Users (GET)

```bash
curl http://localhost:8080/api/users
```

**Expected Response (200 OK):**
```json
{
  "users": [
    {
      "id": 1,
      "email": "test@example.com",
      "createdAt": "2025-11-15T20:00:00"
    }
  ],
  "count": 1
}
```

### 3. Get User by ID (GET)

```bash
curl http://localhost:8080/api/users/1
```

**Expected Response (200 OK):**
```json
{
  "id": 1,
  "email": "test@example.com",
  "createdAt": "2025-11-15T20:00:00"
}
```

**Error Response (404 Not Found):**
```json
{
  "error": "User not found with id: 999"
}
```

### 4. Get User by Email (GET)

```bash
curl http://localhost:8080/api/users/email/test@example.com
```

**Expected Response (200 OK):**
```json
{
  "id": 1,
  "email": "test@example.com",
  "createdAt": "2025-11-15T20:00:00"
}
```

### 5. Update User (PUT)

```bash
curl -X PUT http://localhost:8080/api/users/1 \
  -H "Content-Type: application/json" \
  -d '{
    "email": "updated@example.com"
  }'
```

**Expected Response (200 OK):**
```json
{
  "id": 1,
  "email": "updated@example.com",
  "createdAt": "2025-11-15T20:00:00"
}
```

### 6. Delete User (DELETE)

```bash
curl -X DELETE http://localhost:8080/api/users/1
```

**Expected Response (200 OK):**
```json
{
  "message": "User deleted successfully",
  "id": 1
}
```

**Error Response (404 Not Found):**
```json
{
  "error": "User not found with id: 999"
}
```

## Complete Test Sequence

Run these commands in order to test the full CRUD flow:

```bash
# 1. Create a user
curl -X POST http://localhost:8080/api/users \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com"}'

# 2. Get all users (should see the user you just created)
curl http://localhost:8080/api/users

# 3. Get user by ID (replace 1 with the actual ID from step 1)
curl http://localhost:8080/api/users/1

# 4. Get user by email
curl http://localhost:8080/api/users/email/test@example.com

# 5. Update user (replace 1 with the actual ID)
curl -X PUT http://localhost:8080/api/users/1 \
  -H "Content-Type: application/json" \
  -d '{"email": "updated@example.com"}'

# 6. Verify update
curl http://localhost:8080/api/users/1

# 7. Delete user (replace 1 with the actual ID)
curl -X DELETE http://localhost:8080/api/users/1

# 8. Verify deletion (should return 404)
curl http://localhost:8080/api/users/1
```

## Using Other Tools

### Postman

1. Import the collection or create requests manually
2. Base URL: `http://localhost:8080`
3. Set `Content-Type: application/json` header for POST/PUT requests

### HTTPie (Alternative to curl)

```bash
# Install: brew install httpie (macOS) or pip install httpie

# Create user
http POST localhost:8080/api/users email=test@example.com

# Get all users
http GET localhost:8080/api/users

# Get user by ID
http GET localhost:8080/api/users/1

# Update user
http PUT localhost:8080/api/users/1 email=updated@example.com

# Delete user
http DELETE localhost:8080/api/users/1
```

### Browser

You can test GET endpoints directly in your browser:
- `http://localhost:8080/api/users`
- `http://localhost:8080/api/users/1`
- `http://localhost:8080/api/users/email/test@example.com`

## Testing Validation

### Test Invalid Email

```bash
curl -X POST http://localhost:8080/api/users \
  -H "Content-Type: application/json" \
  -d '{"email": "invalid-email"}'
```

**Expected Response (400 Bad Request):**
```json
{
  "timestamp": "2025-11-15T20:00:00",
  "status": 400,
  "error": "Bad Request",
  "message": "Email must be valid"
}
```

### Test Missing Email

```bash
curl -X POST http://localhost:8080/api/users \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Expected Response (400 Bad Request):**
```json
{
  "timestamp": "2025-11-15T20:00:00",
  "status": 400,
  "error": "Bad Request",
  "message": "Email is required"
}
```

## Debugging Tips

1. **Check server logs**: The `--debug` flag will show detailed Spring Boot logs
2. **Check database**: Verify data in Supabase dashboard → Table Editor → users
3. **Check response headers**: Use `-v` flag with curl to see full HTTP response
   ```bash
   curl -v http://localhost:8080/api/users
   ```
4. **Pretty print JSON**: Use `jq` to format JSON responses
   ```bash
   curl http://localhost:8080/api/users | jq
   ```

