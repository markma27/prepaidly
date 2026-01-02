#!/bin/bash
set -e

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "Script directory: $SCRIPT_DIR"
echo "Repository root: $REPO_ROOT"
echo "Current directory: $(pwd)"

# Change to repository root
cd "$REPO_ROOT"

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

