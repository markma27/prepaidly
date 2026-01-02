#!/bin/bash

# Build script for Railway that builds from repository root
# This allows cronjob to access backend models

set -e

echo "Building cronjob from repository root..."

# Navigate to repository root
cd "$(dirname "$0")/.."

# Build cronjob project
./backend/gradlew :cronjob:clean :cronjob:build -x test --no-daemon

echo "Build completed successfully"

