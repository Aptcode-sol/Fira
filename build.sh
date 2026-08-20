#!/bin/bash

# Build script for EC2-hosted applications (backend + admin only)
# Frontend client is deployed via AWS Amplify separately.
set -e

echo "========================================="
echo "Building FIRA Applications (EC2)"
echo "========================================="

# Backend - No build needed, just install deps
echo ":::: Checking Server Dependencies ::::"
cd server
npm ci --production
cd ..

# Admin Dashboard - Build React/Vite app
echo ":::: Building Admin Dashboard ::::"
cd admin
npm ci
npm run build
cd ..

echo "========================================="
echo "Build Complete! Ready for deployment"
echo "========================================="
