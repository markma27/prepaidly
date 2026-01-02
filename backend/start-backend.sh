#!/bin/bash

# Start Backend Server Script
# This script starts the Spring Boot backend with the local profile

echo "Starting Prepaidly Backend..."
echo ""

# Check if Java is installed
if ! command -v java &> /dev/null; then
    echo "Error: Java is not installed or not in PATH"
    echo "Please install Java 21 or later"
    exit 1
fi

# Check Java version
java_version=$(java -version 2>&1 | head -n 1 | cut -d'"' -f2 | sed '/^1\./s///' | cut -d'.' -f1)
if [ "$java_version" -lt 21 ]; then
    echo "Warning: Java version is $java_version. Java 21 or later is recommended."
fi

# Navigate to backend directory
cd "$(dirname "$0")" || exit 1

# Check if gradlew exists
if [ ! -f "./gradlew" ]; then
    echo "Error: gradlew not found. Make sure you're in the backend directory."
    exit 1
fi

# Make gradlew executable
chmod +x ./gradlew

echo "Running: ./gradlew bootRun --args='--spring.profiles.active=local'"
echo ""

# Start the backend server
./gradlew bootRun --args='--spring.profiles.active=local'

