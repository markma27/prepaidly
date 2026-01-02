#!/bin/bash
set -e

echo "=== Build Script Starting ==="
echo "Current directory: $(pwd)"
echo "Script location: $(dirname "$0")"

# Get the directory where this script is located (should be cronjob directory)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
echo "Script directory: $SCRIPT_DIR"

# Change to script directory (cronjob folder)
cd "$SCRIPT_DIR"

# Verify we're in the cronjob directory
if [ ! -f "build.gradle" ]; then
    echo "ERROR: build.gradle not found. Expected to be in cronjob directory."
    echo "Current directory: $(pwd)"
    echo "Contents:"
    ls -la
    exit 1
fi

# Find and use gradlew in current directory
if [ -f "gradlew" ]; then
    echo "Found gradlew in cronjob directory, using it to build"
    chmod +x gradlew
    ./gradlew clean build -x test --no-daemon
else
    echo "Error: gradlew not found in cronjob directory"
    echo "Current directory: $(pwd)"
    echo "Contents:"
    ls -la
    exit 1
fi

echo "=== Build Completed Successfully ==="

