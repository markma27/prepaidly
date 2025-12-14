# Windows Setup Guide

Complete setup guide for running Prepaidly on Windows.

## Current Status

✅ **Gradle Wrapper**: Created and ready  
❌ **Java**: Not found in PATH  
❌ **Gradle**: Not installed (but wrapper will download it automatically)

## Step 1: Install Java 21

### Option A: Download from Oracle/OpenJDK (Recommended)

1. **Download Java 21**
   - Go to: https://adoptium.net/ (Eclipse Temurin - recommended)
   - Or: https://www.oracle.com/java/technologies/downloads/#java21
   - Download Windows x64 Installer (.msi)

2. **Install Java**
   - Run the installer
   - **Important**: Check "Add to PATH" during installation
   - Or manually add to PATH after installation

3. **Verify Installation**
   ```powershell
   java -version
   ```
   Should show: `openjdk version "21.x.x"` or similar

4. **Set JAVA_HOME** (if not auto-set)
   ```powershell
   # Find Java installation path (usually):
   # C:\Program Files\Eclipse Adoptium\jdk-21.x.x-hotspot
   # or
   # C:\Program Files\Java\jdk-21
   
   # Set JAVA_HOME temporarily (this session only)
   $env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-21.0.1-hotspot"
   
   # Or set permanently:
   [System.Environment]::SetEnvironmentVariable('JAVA_HOME', 'C:\Program Files\Eclipse Adoptium\jdk-21.0.1-hotspot', 'User')
   ```

### Option B: Use Chocolatey (Easiest)

```powershell
# Install Chocolatey if needed: https://chocolatey.org/install
# Then install Java 21
choco install temurin21

# Verify
java -version
```

### Option C: Use SDKMAN (Alternative)

```powershell
# Install SDKMAN for Windows: https://sdkman.io/install
sdk install java 21.0.1-tem
sdk use java 21.0.1-tem
```

## Step 2: Verify Gradle Wrapper

The Gradle wrapper files are already created. It will automatically download Gradle 8.5 on first run.

**Test the wrapper:**
```powershell
cd backend
.\gradlew.bat --version
```

**First run will:**
- Download Gradle 8.5 automatically
- May take a few minutes
- Subsequent runs will be faster

## Step 3: Start Backend

Once Java is installed:

```powershell
cd backend
.\gradlew.bat bootRun --args='--spring.profiles.active=local'
```

**Expected output:**
```
> Task :bootRun
...
Started PrepaidlyApplication in X.XXX seconds
```

## Troubleshooting

### Java Not Found

**Check if Java is installed:**
```powershell
Get-ChildItem "C:\Program Files\Java" -ErrorAction SilentlyContinue
Get-ChildItem "C:\Program Files\Eclipse Adoptium" -ErrorAction SilentlyContinue
```

**Add Java to PATH:**
1. Find Java installation folder
2. Copy path to `bin` folder (e.g., `C:\Program Files\Eclipse Adoptium\jdk-21.0.1-hotspot\bin`)
3. Add to System PATH:
   - System Properties → Environment Variables
   - Edit PATH variable
   - Add Java bin folder
   - Restart terminal

**Set JAVA_HOME:**
```powershell
# Find Java home (parent of bin folder)
$javaPath = (Get-Command java).Source
$javaHome = Split-Path (Split-Path $javaPath)
$env:JAVA_HOME = $javaHome

# Or set permanently
[System.Environment]::SetEnvironmentVariable('JAVA_HOME', $javaHome, 'User')
```

### Gradle Wrapper Fails

**If wrapper download fails:**
1. Check internet connection
2. Try downloading manually:
   - Download: https://services.gradle.org/distributions/gradle-8.5-bin.zip
   - Extract to: `%USERPROFILE%\.gradle\wrapper\dists\gradle-8.5-bin\`

**If wrapper jar is missing:**
- Download from: https://raw.githubusercontent.com/gradle/gradle/master/gradle/wrapper/gradle-wrapper.jar
- Save to: `backend/gradle/wrapper/gradle-wrapper.jar`

### Port Already in Use

**If port 8080 is in use:**
```powershell
# Find process using port 8080
netstat -ano | findstr :8080

# Kill process (replace PID with actual process ID)
taskkill /PID <PID> /F
```

## Quick Checklist

Before starting backend:

- [ ] Java 21 installed (`java -version` works)
- [ ] JAVA_HOME set (optional but recommended)
- [ ] `application-local.properties` configured
- [ ] Database accessible
- [ ] Xero credentials configured

## Next Steps

After backend starts successfully:

1. **Start Frontend** (in new terminal):
   ```powershell
   cd frontend
   npm install
   npm run dev
   ```

2. **Test Application**:
   - Open: http://localhost:3000
   - Follow testing guide: [TESTING_GUIDE.md](./TESTING_GUIDE.md)

## Alternative: Use IDE

**IntelliJ IDEA / Eclipse:**
- Open project
- IDE will handle Java/Gradle automatically
- Right-click `PrepaidlyApplication.java` → Run
- Or use built-in Gradle tasks

This is often easier than command line setup!

