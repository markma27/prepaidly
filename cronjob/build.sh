#!/bin/bash
set -e

echo "=== Build Script Starting ==="
echo "Current directory: $(pwd)"
echo "Script location: $(dirname "$0")"
echo "Current directory contents:"
ls -la

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Determine repository root
# If script is at cronjob/build.sh, repo root is one level up
# If we're already at repo root and script is at cronjob/build.sh, that's fine too
if [ -d "$SCRIPT_DIR/../backend" ]; then
    # Script is in cronjob directory, repo root is parent
    REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
elif [ -d "$SCRIPT_DIR/backend" ]; then
    # We're already at repo root
    REPO_ROOT="$SCRIPT_DIR"
elif [ -d "backend" ]; then
    # Current directory is repo root
    REPO_ROOT="$(pwd)"
else
    echo "ERROR: Cannot find repository root or backend directory."
    echo ""
    echo "This usually means Railway is building from the cronjob subdirectory only."
    echo "The backend module is required for the multi-project build."
    echo ""
    echo "SOLUTION: Configure Railway to build from the repository ROOT:"
    echo "1. Go to Railway dashboard → Your cronjob service → Settings"
    echo "2. Find 'Root Directory' or 'Source' setting"
    echo "3. Change it from 'cronjob' to '/' (root) or leave it empty"
    echo "4. Save and redeploy"
    echo ""
    echo "Current directory: $(pwd)"
    echo "Script directory: $SCRIPT_DIR"
    echo "Directory contents:"
    ls -la
    exit 1
fi

echo "Repository root: $REPO_ROOT"
cd "$REPO_ROOT"

# Verify backend exists
if [ ! -d "backend" ]; then
    echo "ERROR: Backend directory not found at $REPO_ROOT/backend"
    echo "Current directory: $(pwd)"
    echo "Contents:"
    ls -la
    exit 1
fi

# Find and use gradlew
if [ -f "backend/gradlew" ]; then
    echo "Found backend/gradlew, using it to build"
    chmod +x backend/gradlew
    ./backend/gradlew :cronjob:clean :cronjob:build -x test --no-daemon
elif [ -f "gradlew" ]; then
    echo "Found root gradlew, using it to build"
    chmod +x gradlew
    ./gradlew :cronjob:clean :cronjob:build -x test --no-daemon
else
    echo "Error: Could not find gradlew"
    echo "Current directory: $(pwd)"
    echo "Contents:"
    ls -la
    exit 1
fi

echo "=== Build Completed Successfully ==="

