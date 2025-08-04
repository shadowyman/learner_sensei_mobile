#!/bin/bash

# Single SonarQube analysis script
# Usage: ./sonar [options]
#   Options:
#     --disable-auth    Disable authentication (one-time setup)
#     --stop           Stop SonarQube server
#     --reset          Reset SonarQube to factory defaults
#     --help           Show this help message

SONAR_HOME="/Users/aligunes/Downloads/sonarqube-25.6.0.109173"
PROJECT_DIR="/Users/aligunes/Documents/sensei_files_20250615_204052"
SONAR_URL="http://localhost:9000"
CONFIG_FILE="$SONAR_HOME/conf/sonar.properties"

# Handle command line options
if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
    echo "Usage: ./sonar [options]"
    echo ""
    echo "Options:"
    echo "  --disable-auth    Manually disable authentication (usually automatic)"
    echo "  --stop           Stop SonarQube server"
    echo "  --reset          Reset SonarQube to factory defaults (deletes all data)"
    echo "  --help, -h       Show this help message"
    echo ""
    echo "Run without options to perform code analysis."
    exit 0
fi

if [ "$1" = "--disable-auth" ]; then
    echo "🔓 Disabling SonarQube authentication..."
    if [ -f "$CONFIG_FILE" ]; then
        if ! grep -q "^sonar.forceAuthentication=false" "$CONFIG_FILE"; then
            echo "" >> "$CONFIG_FILE"
            echo "# Disable authentication" >> "$CONFIG_FILE"
            echo "sonar.forceAuthentication=false" >> "$CONFIG_FILE"
            echo "# Allow anonymous users to browse" >> "$CONFIG_FILE"
            echo "sonar.web.systemPasscode=" >> "$CONFIG_FILE"
            echo "✅ Authentication disabled. Restart SonarQube for changes to take effect."
        else
            echo "✅ Authentication is already disabled"
        fi
    else
        echo "❌ Config file not found at: $CONFIG_FILE"
    fi
    exit 0
fi

if [ "$1" = "--stop" ]; then
    echo "🛑 Stopping SonarQube..."
    "$SONAR_HOME/bin/macosx-universal-64/sonar.sh" stop
    exit 0
fi

if [ "$1" = "--reset" ]; then
    echo "🔄 Resetting SonarQube..."
    echo "⚠️  This will delete all projects, history, and settings!"
    read -p "Are you sure? (y/N): " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "🛑 Stopping SonarQube..."
        "$SONAR_HOME/bin/macosx-universal-64/sonar.sh" stop 2>/dev/null
        sleep 2
        
        echo "🗑️  Deleting data, logs, and temp directories..."
        rm -rf "$SONAR_HOME/data/"
        rm -rf "$SONAR_HOME/temp/"
        rm -rf "$SONAR_HOME/logs/"
        
        echo "📁 Creating fresh directories..."
        mkdir -p "$SONAR_HOME/logs"
        mkdir -p "$SONAR_HOME/temp"
        
        echo "🔧 Resetting configuration..."
        if [ -f "$SONAR_HOME/conf/sonar.properties.default" ]; then
            cp "$SONAR_HOME/conf/sonar.properties.default" "$CONFIG_FILE"
        else
            # Remove our custom settings
            sed -i '' '/sonar.forceAuthentication=false/d' "$CONFIG_FILE" 2>/dev/null
            sed -i '' '/sonar.web.systemPasscode=/d' "$CONFIG_FILE" 2>/dev/null
        fi
        
        echo "✅ SonarQube has been reset to factory defaults"
        echo ""
        echo "Next step:"
        echo "→ Run './sonar' to start fresh (authentication will be disabled automatically)"
    else
        echo "❌ Reset cancelled"
    fi
    exit 0
fi

# Default action is to run analysis
if [ -z "$1" ]; then
    echo "🔍 SonarQube Analysis"
    echo "===================="

    # Update inclusions from file-manifest.json if it exists
    if [ -f "file-manifest.json" ] && [ -f ".sonar-config/update-sonar-inclusions.js" ]; then
        echo "📋 Updating file inclusions from manifest..."
        node .sonar-config/update-sonar-inclusions.js
    fi
else
    # Exit here for non-analysis commands
    exit 0
fi

# Check if SonarQube is running
"$SONAR_HOME/bin/macosx-universal-64/sonar.sh" status > /dev/null 2>&1
if [ $? -ne 0 ]; then
    echo "🚀 Starting SonarQube..."
    "$SONAR_HOME/bin/macosx-universal-64/sonar.sh" start
    echo "⏳ Waiting for server to start..."
    for i in {1..30}; do
        sleep 2
        curl -s "$SONAR_URL/api/system/status" | grep -q "UP" && break
        echo -n "."
    done
    echo ""
fi

# Check if authentication is disabled
if ! grep -q "^sonar.forceAuthentication=false" "$CONFIG_FILE" 2>/dev/null; then
    echo "🔐 First time setup detected - disabling authentication..."
    
    # Wait a bit more for fresh install
    sleep 5
    
    # Add authentication disable to config
    echo "" >> "$CONFIG_FILE"
    echo "# Disable authentication (auto-configured)" >> "$CONFIG_FILE"
    echo "sonar.forceAuthentication=false" >> "$CONFIG_FILE"
    echo "# Allow anonymous users to browse" >> "$CONFIG_FILE"
    echo "sonar.web.systemPasscode=" >> "$CONFIG_FILE"
    
    echo "✅ Authentication disabled automatically"
    echo "🔄 Restarting SonarQube with new settings..."
    
    # Restart SonarQube to apply settings
    "$SONAR_HOME/bin/macosx-universal-64/sonar.sh" restart
    
    # Wait for restart
    echo "⏳ Waiting for SonarQube to restart..."
    for i in {1..30}; do
        sleep 2
        curl -s "$SONAR_URL/api/system/status" | grep -q "UP" && break
        echo -n "."
    done
    echo ""
fi

# Now proceed with setup (auth is disabled)
echo "🔧 Setting up project..."

# Even with auth disabled, we need to use admin creds for API calls
# First, ensure admin password is set correctly
curl -s -u admin:admin -X POST "$SONAR_URL/api/users/change_password" \
  -d "login=admin&previousPassword=admin&password=Shadow1395122?" > /dev/null 2>&1

# Create project with admin credentials
echo "📁 Creating project (if needed)..."
PROJECT_RESPONSE=$(curl -s -u admin:Shadow1395122? -X POST "$SONAR_URL/api/projects/create" \
  -d "project=sensei&name=Sensei AI Education System" 2>&1)

if echo "$PROJECT_RESPONSE" | grep -q "already exists"; then
    echo "✅ Project already exists"
elif echo "$PROJECT_RESPONSE" | grep -q "key"; then
    echo "✅ Project created successfully"
fi

# Set permissions for Anyone group to analyze projects
echo "🔓 Setting permissions for anonymous analysis..."
curl -s -u admin:Shadow1395122? -X POST "$SONAR_URL/api/permissions/add_group" \
  -d "groupName=Anyone&permission=scan&projectKey=sensei" > /dev/null 2>&1

# Also set global scan permission
curl -s -u admin:Shadow1395122? -X POST "$SONAR_URL/api/permissions/add_group" \
  -d "groupName=Anyone&permission=scan" > /dev/null 2>&1

# Run analysis without authentication
echo "📊 Running analysis..."
cd "$PROJECT_DIR"
sonar-scanner \
  -Dsonar.host.url=$SONAR_URL \
  -Dsonar.projectKey=sensei

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Analysis complete!"
    echo "📈 View results at: $SONAR_URL/dashboard?id=sensei"
else
    echo ""
    echo "❌ Analysis failed"
fi