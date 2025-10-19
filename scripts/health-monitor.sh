#!/bin/bash
# Simple health monitor script para cron
# Uso: */5 * * * * /path/to/health-monitor.sh

HEALTH_URL="${HEALTH_URL:-http://localhost:3001/health}"
SLACK_WEBHOOK="${SLACK_WEBHOOK}"
DISCORD_WEBHOOK="${DISCORD_WEBHOOK}"
ALERT_LOG="/tmp/health-alerts.log"

# Check health endpoint
response=$(curl -s -w "\n%{http_code}" "$HEALTH_URL" 2>/dev/null)
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | head -n-1)

# Parse status
if [[ "$http_code" == "200" ]]; then
  status=$(echo "$body" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
  if [[ "$status" == "degraded" ]]; then
    message="⚠️ BeiaBot Health Degraded: $body"
  else
    exit 0  # Todo OK
  fi
else
  message="🔴 BeiaBot Health Check Failed! HTTP $http_code"
fi

# Send alerts
timestamp=$(date '+%Y-%m-%d %H:%M:%S')
echo "[$timestamp] $message" >> "$ALERT_LOG"

# Discord webhook
if [[ -n "$DISCORD_WEBHOOK" ]]; then
  curl -s -X POST "$DISCORD_WEBHOOK" \
    -H "Content-Type: application/json" \
    -d "{\"content\": \"$message\"}" >/dev/null 2>&1
fi

# Slack webhook
if [[ -n "$SLACK_WEBHOOK" ]]; then
  curl -s -X POST "$SLACK_WEBHOOK" \
    -H "Content-Type: application/json" \
    -d "{\"text\": \"$message\"}" >/dev/null 2>&1
fi
