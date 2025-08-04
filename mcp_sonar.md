# Claude Code CLI + SonarQube MCP Integration: Complete Guide

## Overview

This document provides a comprehensive guide for integrating SonarQube with Claude Code CLI using the Model Context Protocol (MCP). This integration allows AI assistants to interact with SonarQube's code quality analysis capabilities through natural language commands.

## What is MCP (Model Context Protocol)?

Model Context Protocol (MCP) is an open standard for connecting AI assistants to external tools and data sources. It provides:

- **Resources**: File-like data readable by clients
- **Tools**: Functions callable by LLMs (with user approval)
- **Prompts**: Pre-written templates for common tasks
- **Transport**: STDIO, HTTP, or SSE communication methods

## SonarQube MCP Server Options

### Community Implementation (RECOMMENDED)
- **Repository**: `sapientpants/sonarqube-mcp-server`
- **Installation**: Simple NPX command
- **Language**: Node.js/TypeScript
- **Setup Complexity**: Easy
- **Requirements**: Node.js 18+

### Official SonarSource Implementation
- **Repository**: `SonarSource/sonarqube-mcp-server`
- **Language**: Java (requires JDK 21+)
- **Setup Complexity**: Complex (Gradle build required)
- **Requirements**: Java Development Kit 21+

**Recommendation**: Use the community version for local development due to simpler setup and better documentation.

## Current Project Setup Status

### Environment Details
- **SonarQube Server**: Running at `http://localhost:9000` (version 25.6.0.109173)
- **Project**: `sensei` (Sensei AI Education System)
- **Authentication**: Token-based with admin credentials
- **Claude Code CLI**: Version 1.0.35 installed
- **Node.js**: Version 22.14.0 (exceeds requirements)

### SonarQube Configuration
- **Project Key**: `sensei`
- **Project Name**: Sensei AI Education System
- **Analysis Script**: `./sonar` (custom script with authentication management)
- **Configuration Directory**: `.sonar-config/` (contains detailed setup)
- **Authentication**: Disabled for anonymous analysis
- **Admin Credentials**: `admin:Shadow1395122?`

### MCP Server Status
- **Server Name**: `sonarqube-server`
- **Scope**: User (available in all projects)
- **Installation**: ✅ COMPLETE
- **Authentication Token**: `squ_838bb80a2aa4bb0a3286555cad6be6cba9239deb`
- **Configuration**: ✅ VERIFIED
- **Connection Test**: ✅ SUCCESSFUL

## Claude Code CLI MCP Configuration

### Configuration Structure

Claude Code CLI uses a hierarchical configuration system:

1. **User-level** (`~/.claude.json`): Available across all projects
2. **Project-level** (`.mcp.json`): Shared with team via version control
3. **Local-level** (project-specific user settings): Private to user in current project

### Current MCP Server Configuration

```bash
# Added via command:
claude mcp add sonarqube-server -s user \
  -e SONARQUBE_URL=http://localhost:9000 \
  -e SONARQUBE_TOKEN=squ_838bb80a2aa4bb0a3286555cad6be6cba9239deb \
  -e SONARQUBE_AUTH_METHOD=token \
  -- npx -y sonarqube-mcp-server@latest
```

**Configuration Details**:
- **Type**: STDIO transport
- **Command**: `npx -y sonarqube-mcp-server@latest`
- **Environment Variables**:
  - `SONARQUBE_URL=http://localhost:9000`
  - `SONARQUBE_TOKEN=squ_838bb80a2aa4bb0a3286555cad6be6cba9239deb`
  - `SONARQUBE_AUTH_METHOD=token`

## MCP Commands Reference

### Server Management Commands

```bash
# List all configured MCP servers
claude mcp list

# Get detailed server information
claude mcp get sonarqube-server

# Remove a server
claude mcp remove sonarqube-server -s user

# Add server with environment variables
claude mcp add <name> -s <scope> -e ENV_VAR=value -- command args

# Debug mode
claude --mcp-debug
```

### Scope Options
- `-s local`: Project-specific, personal (default)
- `-s project`: Shared with team via `.mcp.json`
- `-s user`: Available across all projects

### Transport Types
- **STDIO**: Default, standard input/output communication
- **SSE**: Server-Sent Events for web-based servers
- **HTTP**: HTTP-based communication

## SonarQube MCP Server Capabilities

### Available Tools

1. **Project Discovery**
   - Search and list SonarQube projects
   - Get project metadata and configuration

2. **Code Analysis**
   - Analyze code snippets directly
   - Get quality metrics for specific components
   - Review code coverage and complexity

3. **Issue Management**
   - Search and filter code issues
   - Get issues by severity, type, and status
   - Review security hotspots and vulnerabilities

4. **Quality Gate Monitoring**
   - Check quality gate status
   - Review quality gate conditions
   - Monitor compliance with quality standards

5. **Metrics and Reporting**
   - Access comprehensive quality metrics
   - Generate custom reports
   - Track trends over time

### Authentication Methods

The SonarQube MCP server supports multiple authentication methods:

1. **Token Authentication** (Recommended)
   - User tokens with full permissions
   - Project analysis tokens (restricted)
   - Global analysis tokens (broad access)

2. **Basic Authentication**
   - Username/password authentication
   - Less secure, not recommended for production

3. **System Passcode**
   - For systems with passcode authentication

## Usage Examples

### Basic Commands in Claude Code CLI

Once connected, you can use natural language commands:

#### Project Analysis
```
Show me all my SonarQube projects
What's the current code quality status of the 'sensei' project?
Check quality gate status for sensei project
```

#### Issue Management
```
Show me critical and blocker issues in the sensei project
Find all security vulnerabilities in the sensei project
List code smells in the authentication module
Show me the top 5 issues that need immediate attention
```

#### Code Analysis
```
Analyze this JavaScript code for potential issues:
function processUser(user) {
  if (user.email) {
    return user.email.toLowerCase();
  }
}
```

#### Metrics and Quality Gates
```
What's the code coverage for the sensei project?
Show me technical debt in the project
Is the quality gate passing for the latest analysis?
What's the cyclomatic complexity of the core modules?
```

### Interactive Commands in Claude Code CLI

```bash
# Check MCP server status
/mcp

# List available tools (after permissions granted)
/

# Configure settings
/config
```

## Integration with Development Workflow

### Quality Gate Protocol

Add this to your development workflow:

```markdown
## SONARQUBE QUALITY GATE PROTOCOL
After any bug fix or feature implementation:

### Quality Check Steps:
1. **Run Analysis**: Execute `./sonar` to update SonarQube analysis
2. **Check Status**: Ask "Check quality gate status for sensei project"
3. **Review Issues**: Ask "Show me any critical or blocker issues in sensei"
4. **Fix Critical Issues**: Address any critical/blocker issues found
5. **Verify Completion**: Confirm quality gate passes before marking task complete

### Quality Gate Commands:
- "Check quality gate status for sensei project"
- "Show me critical and blocker issues in sensei"
- "What's the code coverage for the sensei project?"
- "Find security vulnerabilities in sensei"
- "Show me code smells in [specific module]"
```

### Automated Workflow Script

```bash
#!/bin/bash
# quality-workflow.sh
echo "🔍 Running complete quality workflow..."

# Step 1: Run SonarQube analysis
echo "1. Running SonarQube analysis..."
./sonar

if [ $? -eq 0 ]; then
    echo "✅ Analysis complete"
    echo ""
    echo "2. Next steps in Claude Code CLI:"
    echo "   → Check quality gate status for sensei project"
    echo "   → Show me any critical or blocker issues"
    echo "   → Review code quality metrics"
else
    echo "❌ Analysis failed - check configuration"
fi
```

## Troubleshooting Guide

### Common Issues and Solutions

#### Issue 1: "No MCP servers configured"
**Symptoms**: `/mcp` command shows no servers
**Solution**:
```bash
# Verify server was added
claude mcp list

# If empty, re-add the server
claude mcp add sonarqube-server -s user \
  -e SONARQUBE_URL=http://localhost:9000 \
  -e SONARQUBE_TOKEN=your_token \
  -- npx -y sonarqube-mcp-server@latest
```

#### Issue 2: "Authentication failed"
**Symptoms**: Server connects but can't access SonarQube
**Solution**:
```bash
# Test token manually
curl -u your_token: http://localhost:9000/api/projects/search

# If fails, regenerate token
curl -u "admin:Shadow1395122?" -X POST "http://localhost:9000/api/user_tokens/generate" \
  -d "name=new-mcp-token"
```

#### Issue 3: "Server disconnected"
**Symptoms**: MCP server shows as disconnected in `/mcp`
**Solution**:
```bash
# Remove and re-add server
claude mcp remove sonarqube-server -s user
sleep 5
claude mcp add sonarqube-server -s user \
  -e SONARQUBE_URL=http://localhost:9000 \
  -e SONARQUBE_TOKEN=your_token \
  -- npx -y sonarqube-mcp-server@latest
```

#### Issue 4: Protocol version validation error
**Symptoms**: `protocolVersion validation error with stdio servers`
**Solution**: This is a known issue with Claude CLI - try using Docker instead:
```bash
claude mcp add sonarqube-docker -s user \
  -- docker run -i --rm \
  -e SONARQUBE_URL=http://host.docker.internal:9000 \
  -e SONARQUBE_TOKEN=your_token \
  sapientpants/sonarqube-mcp-server:latest
```

### Debugging Commands

```bash
# Enable debug mode
claude --mcp-debug

# Check server logs (if available)
ls -la mcp-server-*.log

# Test SonarQube connectivity
curl -s http://localhost:9000/api/system/status

# Verify project exists
curl -s http://localhost:9000/api/projects/search | grep sensei

# Test MCP server directly
echo '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","clientInfo":{"name":"test","version":"1.0.0"},"capabilities":{}},"id":1}' | \
SONARQUBE_URL=http://localhost:9000 \
SONARQUBE_TOKEN=your_token \
npx -y sonarqube-mcp-server@latest
```

## Advanced Configuration

### Project-Scoped MCP Server

For team collaboration, add project-scoped servers:

```bash
# Add project-scoped server for team use
claude mcp add team-sonarqube -s project \
  -e SONARQUBE_URL=http://localhost:9000 \
  -e SONARQUBE_AUTH_METHOD=token \
  -- npx -y sonarqube-mcp-server@latest
```

This creates `.mcp.json` in project root that can be committed to version control.

### Docker-Based Deployment

For isolated deployment:

```bash
claude mcp add sonarqube-docker -s user \
  -- docker run -i --rm \
  -e SONARQUBE_URL=http://host.docker.internal:9000 \
  -e SONARQUBE_TOKEN=your_token \
  sapientpants/sonarqube-mcp-server:latest
```

### Environment Variable Management

Create environment file for consistent setup:

```bash
# Create .env.mcp file
cat > .env.mcp << EOF
export SONARQUBE_URL=http://localhost:9000
export SONARQUBE_TOKEN=your_token_here
export SONARQUBE_PROJECT_KEY=sensei
EOF

# Source before using Claude Code
source .env.mcp
```

## Security Considerations

### Token Management
- Never hardcode tokens in configuration files checked into version control
- Use environment variables or secure credential management
- Regularly rotate authentication tokens
- Store tokens in `.env.mcp` files (add to `.gitignore`)

### MCP Server Security
- MCP servers execute in the context of the user running Claude Code
- Use project-scoped vs user-scoped configurations appropriately
- Be cautious with servers that have file system access
- Review server source code before installation

### Network Security
- Ensure SonarQube server is properly secured
- Use HTTPS in production environments
- Implement proper firewall rules
- Monitor API usage and access logs

## Performance Optimization

### Server Performance
- Use connection pooling where applicable
- Implement request caching for frequently accessed data
- Set appropriate timeouts for API calls
- Monitor server resource usage

### Network Optimization
- Minimize API calls by batching requests
- Use appropriate API pagination
- Implement request rate limiting
- Cache analysis results locally

## Current Status Summary

### ✅ Complete Setup Checklist

1. **Prerequisites**: ✅ All verified
   - Claude Code CLI v1.0.35 installed
   - Node.js v22.14.0 installed
   - SonarQube running on localhost:9000

2. **Authentication**: ✅ Configured
   - Token generated: `squ_838bb80a2aa4bb0a3286555cad6be6cba9239deb`
   - Authentication method: Token-based
   - Server access: Verified

3. **MCP Server**: ✅ Installed and Configured
   - Server: `sonarqube-server` (community version)
   - Scope: User (available in all projects)
   - Transport: STDIO
   - Environment: Configured with URL and token

4. **Connection**: ✅ Verified
   - Protocol handshake: Successful
   - Server response: Valid (v1.3.2)
   - Claude recognition: Working

### Ready for Use

The integration is **completely configured and ready for use**. To start using:

1. **Launch Claude Code CLI**: `claude`
2. **Grant permissions** when prompted (automatic on first use)
3. **Use natural language commands** to interact with SonarQube

### Example First Commands
```
Show me all my SonarQube projects
Check quality gate status for sensei project
Show me critical issues in the sensei project
What's the code coverage for the sensei project?
```

## Future Enhancements

### Potential Improvements
- Custom quality profiles integration
- Automated report generation
- CI/CD pipeline integration
- Custom metrics and dashboards
- Integration with other development tools

### Community Contributions
- Report issues to `sapientpants/sonarqube-mcp-server`
- Contribute to documentation and examples
- Share configuration templates
- Participate in MCP community discussions

## References and Resources

### Official Documentation
- Model Context Protocol: https://modelcontextprotocol.io/
- Claude Code Documentation: https://docs.anthropic.com/en/docs/claude-code
- SonarQube API Documentation: https://docs.sonarqube.org/latest/web-api/

### Community Resources
- SonarQube MCP Server: https://github.com/sapientpants/sonarqube-mcp-server
- MCP Servers Collection: https://github.com/modelcontextprotocol/servers
- Awesome MCP Servers: https://github.com/punkpeye/awesome-mcp-servers

### Local Project Files
- Main SonarQube script: `./sonar`
- Configuration directory: `.sonar-config/`
- Project configuration: `sonar-project.properties`
- File manifest: `file-manifest.json`
- Quality check script: `quality-check`

---

**Last Updated**: June 26, 2025  
**Integration Status**: ✅ COMPLETE AND READY FOR USE  
**Next Steps**: Start Claude Code CLI and begin using natural language commands to interact with SonarQube analysis results.