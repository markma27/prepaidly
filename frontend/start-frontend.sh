#!/bin/bash

# Start Frontend Development Server Script

echo "Starting Prepaidly Frontend..."
echo ""

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "Error: npm is not installed or not in PATH"
    echo "Please install Node.js from https://nodejs.org/"
    exit 1
fi

# Check Node.js version
node_version=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$node_version" -lt 18 ]; then
    echo "Warning: Node.js version is less than 18. Some features may not work."
fi

# Navigate to frontend directory
cd "$(dirname "$0")" || exit 1

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "Dependencies not installed. Installing..."
    npm install
fi

# Check if .env.local exists, if not create from example
if [ ! -f ".env.local" ] && [ -f ".env.local.example" ]; then
    echo "Creating .env.local from example..."
    cp .env.local.example .env.local
fi

echo "Starting Next.js development server..."
echo "Frontend will be available at: http://localhost:3000"
echo "Press Ctrl+C to stop"
echo ""

# Start the development server
npm run dev

