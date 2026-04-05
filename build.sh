#!/bin/bash

# Build script for all applications
set -e

echo "========================================="
echo "Building FIRA Applications"
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

# Frontend - Build Next.js app
echo ":::: Building Frontend Client ::::"
cd client
npm ci
npm run build
cd ..

echo "========================================="
echo "Build Complete! Ready for deployment"
echo "========================================="
