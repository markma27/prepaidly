# Gradle Setup for Windows

## Problem
`gradle` command not found - Gradle wrapper files are missing.

## Solution Options

### Option 1: Install Gradle (Recommended for Development)

1. **Download Gradle**
   - Go to [https://gradle.org/releases/](https://gradle.org/releases/)
   - Download Gradle 8.5 or later
   - Extract to a folder (e.g., `C:\gradle`)

2. **Add to PATH**
   - Open System Properties → Environment Variables
   - Add `C:\gradle\bin` to PATH
   - Restart terminal

3. **Verify Installation**
   ```powershell
   gradle -v
   ```

4. **Generate Wrapper**
   ```powershell
   cd backend
   gradle wrapper
   ```

5. **Now Use Wrapper**
   ```powershell
   .\gradlew.bat bootRun --args='--spring.profiles.active=local'
   ```

### Option 2: Use IDE (Easiest)

**IntelliJ IDEA / Eclipse:**
1. Open project in IDE
2. Right-click on `build.gradle`
3. Select "Generate Gradle Wrapper" or similar option
4. IDE will create wrapper files automatically

### Option 3: Download Wrapper Manually

1. **Download gradle-wrapper.jar**
   - Go to: https://raw.githubusercontent.com/gradle/gradle/master/gradle/wrapper/gradle-wrapper.jar
   - Save to: `backend/gradle/wrapper/gradle-wrapper.jar`

2. **Create gradle-wrapper.properties**
   Create file: `backend/gradle/wrapper/gradle-wrapper.properties`
   ```properties
   distributionBase=GRADLE_USER_HOME
   distributionPath=wrapper/dists
   distributionUrl=https\://services.gradle.org/distributions/gradle-8.5-bin.zip
   networkTimeout=10000
   validateDistributionUrl=true
   zipStoreBase=GRADLE_USER_HOME
   zipStorePath=wrapper/dists
   ```

3. **Use gradlew.bat** (already created)
   ```powershell
   .\gradlew.bat bootRun --args='--spring.profiles.active=local'
   ```

### Option 4: Use Chocolatey (Windows Package Manager)

```powershell
# Install Chocolatey if not installed
# Then install Gradle
choco install gradle

# Verify
gradle -v

# Generate wrapper
cd backend
gradle wrapper
```

## Quick Fix: Run Without Wrapper

If you have Gradle installed globally:

```powershell
cd backend
gradle bootRun --args='--spring.profiles.active=local'
```

## Recommended Approach

For Windows development, **Option 1 (Install Gradle)** is recommended as it:
- Works with any project
- Allows you to generate wrappers
- Provides better IDE integration

After installing Gradle, run:
```powershell
cd backend
gradle wrapper
.\gradlew.bat bootRun --args='--spring.profiles.active=local'
```

