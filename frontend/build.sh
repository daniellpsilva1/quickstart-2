#!/bin/bash
# Install dependencies
npm install

# Build the Next.js application and export static files
npm run build-static

# The output should be in the 'out' directory
echo "Build completed successfully!" 