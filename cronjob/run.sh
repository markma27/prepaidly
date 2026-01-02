#!/bin/bash

# Run script for the cron job
# Builds and executes the daily cron job

set -e

echo "Building cron job..."
./gradlew clean build

echo "Running cron job..."
java -jar build/libs/prepaidly-cronjob-0.1.0.jar

