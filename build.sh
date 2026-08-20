#!/bin/bash

# Build script for EC2-hosted applications (backend + admin only)
# Frontend client is deployed via AWS Amplify separately.
set -e

echo "========================================="
echo "Building FIRA Applications (EC2)"
echo "========================================="

# ponytail: installs run from the REPO ROOT with --workspace, not by cd-ing into
# each package. This repo declares npm workspaces (server, client, admin,
# packages/*), and `npm ci` inside a workspace subdirectory deletes node_modules
# and reinstalls under the ROOT workspace context — which left
# server/node_modules empty and crashed the API on boot with
# "Cannot find module 'express'" after every deploy.
#
# Both workspaces install in ONE `npm ci` call on purpose: `npm ci` wipes
# node_modules each time it runs, so a second call would erase the first's work.
# Dev dependencies are kept: admin builds with vite, and the admin process is
# still served by `vite preview`, so pruning them would break it at runtime.
echo ":::: Installing Workspace Dependencies (server + admin) ::::"
npm ci --workspace=server --workspace=admin

echo ":::: Building Admin Dashboard ::::"
npm run build --workspace=admin

echo "========================================="
echo "Build Complete! Ready for deployment"
echo "========================================="
