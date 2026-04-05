#!/bin/bash

# FIRA PM2 Helper Script
# Quick commands for managing the application

set -e

command=$1

case $command in
  start)
    echo ":::: Starting all applications ::::"
    pm2 start ecosystem.config.js --env production
    pm2 save
    ;;

  stop)
    echo ":::: Stopping all applications ::::"
    pm2 stop all
    ;;

  restart)
    echo ":::: Restarting all applications ::::"
    pm2 restart all
    ;;

  restart-backend)
    echo ":::: Restarting backend only ::::"
    pm2 restart fira-backend
    ;;

  restart-admin)
    echo ":::: Restarting admin only ::::"
    pm2 restart fira-admin
    ;;

  restart-frontend)
    echo ":::: Restarting frontend only ::::"
    pm2 restart fira-client
    ;;

  logs)
    echo ":::: Showing all logs (Press Ctrl+C to exit) ::::"
    pm2 logs
    ;;

  logs-backend)
    echo ":::: Backend logs ::::"
    pm2 logs fira-backend
    ;;

  logs-admin)
    echo ":::: Admin logs ::::"
    pm2 logs fira-admin
    ;;

  logs-frontend)
    echo ":::: Frontend logs ::::"
    pm2 logs fira-client
    ;;

  status)
    echo ":::: Application Status ::::"
    pm2 status
    ;;

  monit)
    echo ":::: System Monitoring (Press Ctrl+C to exit) ::::"
    pm2 monit
    ;;

  info)
    app=$2
    if [ -z "$app" ]; then
      echo "Usage: ./pm2-helper.sh info [fira-backend|fira-admin|fira-client]"
    else
      pm2 info $app
    fi
    ;;

  pull-and-deploy)
    echo ":::: Pulling latest code ::::"
    git pull origin main
    echo ":::: Building applications ::::"
    chmod +x build.sh
    ./build.sh
    echo ":::: Restarting applications ::::"
    pm2 restart all
    pm2 save
    ;;

  update-env)
    echo ":::: Updating environment variables ::::"
    nano server/.env
    nano admin/.env
    nano client/.env.production
    pm2 restart all
    ;;

  clean-logs)
    echo ":::: Clearing PM2 logs ::::"
    pm2 flush
    ;;

  check-ports)
    echo ":::: Checking port usage ::::"
    echo "Port 5000 (Backend):"
    lsof -i :5000 || echo "  No process running"
    echo ""
    echo "Port 3001 (Admin):"
    lsof -i :3001 || echo "  No process running"
    echo ""
    echo "Port 3000 (Frontend):"
    lsof -i :3000 || echo "  No process running"
    ;;

  save-state)
    echo ":::: Saving PM2 state ::::"
    pm2 save
    pm2 startup
    ;;

  delete-all)
    echo "⚠️  WARNING: This will delete all PM2 applications!"
    read -p "Are you sure? (yes/no): " confirm
    if [ "$confirm" = "yes" ]; then
      pm2 delete all
      echo "All applications deleted."
    else
      echo "Cancelled."
    fi
    ;;

  *)
    echo "FIRA PM2 Helper - Available Commands:"
    echo ""
    echo "  start                 - Start all applications"
    echo "  stop                  - Stop all applications"
    echo "  restart               - Restart all applications"
    echo "  restart-backend       - Restart backend only"
    echo "  restart-admin         - Restart admin only"
    echo "  restart-frontend      - Restart frontend only"
    echo ""
    echo "  logs                  - Show all logs"
    echo "  logs-backend          - Show backend logs"
    echo "  logs-admin            - Show admin logs"
    echo "  logs-frontend         - Show frontend logs"
    echo ""
    echo "  status                - Show application status"
    echo "  monit                 - Monitor resource usage"
    echo "  info [app]            - Show detailed info for an app"
    echo ""
    echo "  check-ports           - Check if ports are in use"
    echo "  clean-logs            - Clear all logs"
    echo "  save-state            - Save PM2 state for auto-restart"
    echo ""
    echo "  pull-and-deploy       - Git pull, build, and restart"
    echo "  update-env            - Update environment variables"
    echo ""
    echo "  delete-all            - Delete all PM2 applications"
    echo ""
    exit 1
    ;;
esac
