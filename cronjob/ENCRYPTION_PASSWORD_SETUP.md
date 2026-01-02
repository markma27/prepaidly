# Encryption Password Setup Guide

## Problem
The cronjob needs the same encryption password (`JASYPT_PASSWORD`) as the backend to decrypt Xero tokens stored in the database.

## Where to Find the Password

### Option 1: Railway Dashboard (Recommended)

1. **Go to Railway Dashboard**: https://railway.app
2. **Select your BACKEND service**
3. **Click on "Variables" tab** (or "Settings" → "Variables")
4. **Look for `JASYPT_PASSWORD`** environment variable
5. **Copy the exact value** (click the eye icon to reveal it)

### Option 2: Check Backend Logs

If you can't access Railway dashboard, check your backend service logs. The backend should log when it initializes encryption (though it won't show the password itself).

### Option 3: Check Local Development Config

If you're running locally, check:
- `backend/src/main/resources/application-local.properties`
- Look for: `jasypt.encryptor.password=your_password_here`

**Note**: This file is gitignored, so it won't be in the repository.

## How to Set It in Railway Cronjob

1. **Go to Railway Dashboard** → Your **CRONJOB** service
2. **Click "Variables"** tab
3. **Add or update** the environment variable:
   - **Key**: `JASYPT_PASSWORD`
   - **Value**: (paste the exact value from backend)
4. **Save** and **redeploy** the cronjob

## Important Notes

- ⚠️ **The password MUST be exactly the same** as the backend's `JASYPT_PASSWORD`
- ⚠️ **If you change the password**, all encrypted tokens in the database will become invalid
- ⚠️ **Keep this password secure** - it's used to encrypt/decrypt sensitive Xero OAuth tokens

## Verification

After setting the password, check the cronjob logs. You should see:
```
Jasypt password configured: true
Jasypt password length: <some number>
Jasypt password source: JASYPT_PASSWORD
```

If decryption still fails, verify:
1. The password is exactly the same (no extra spaces, correct case)
2. The password hasn't been changed since tokens were encrypted
3. The environment variable name is `JASYPT_PASSWORD` (not `JASYPT_ENCRYPTOR_PASSWORD`)

## Troubleshooting

### Error: "EncryptionOperationNotPossibleException"
- **Cause**: Password mismatch or missing password
- **Solution**: Ensure `JASYPT_PASSWORD` in cronjob matches backend exactly

### Error: "Encryption password cannot be null or empty"
- **Cause**: Environment variable not set
- **Solution**: Add `JASYPT_PASSWORD` to Railway cronjob variables

### Error: "Failed to decrypt" even though password matches
- **Cause**: Tokens were encrypted with a different password
- **Solution**: Reconnect to Xero in the backend to regenerate tokens with the current password

### Still having issues?
1. Verify the password in backend Railway service
2. Copy it exactly (including any special characters)
3. Paste into cronjob Railway service
4. Redeploy both services if needed

