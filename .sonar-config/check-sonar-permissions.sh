#!/bin/bash

SONAR_URL="http://localhost:9000"

echo "🔍 Checking SonarQube permissions..."
echo ""

# Check system status
echo "1. System Status:"
curl -s "$SONAR_URL/api/system/status" | grep -o '"status":"[^"]*'
echo ""

# Check authentication status
echo "2. Authentication Status:"
curl -s "$SONAR_URL/api/authentication/validate"
echo ""

# Check permissions
echo "3. Current Permissions:"
curl -s "$SONAR_URL/api/permissions/groups?permission=scan"
echo ""

# Try to get global permissions
echo "4. Global Permissions:"
curl -s "$SONAR_URL/api/permissions/search_global_permissions"
echo ""

# Check if we can access projects
echo "5. Projects List:"
curl -s "$SONAR_URL/api/projects/search" | head -20
echo ""