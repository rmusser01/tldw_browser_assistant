# tldw Agent - Administrator Guide

This guide covers deployment, configuration, security, and maintenance of the tldw Agent for system administrators and IT teams.

## Table of Contents

- [Deployment Overview](#deployment-overview)
- [Installation Methods](#installation-methods)
- [Configuration](#configuration)
- [Security](#security)
- [Command Allowlist Management](#command-allowlist-management)
- [Monitoring and Logging](#monitoring-and-logging)
- [Troubleshooting](#troubleshooting)
- [Enterprise Deployment](#enterprise-deployment)

## Deployment Overview

### Architecture

The tldw Agent consists of three components:

| Component | Location | Purpose |
|-----------|----------|---------|
| Browser Extension | User's browser | UI, agent orchestration |
| Local Agent | User's machine | File operations, command execution |
| tldw_server | Local or remote | LLM reasoning |

### Deployment Models

**Model 1: Fully Local**
```text
User Machine
├── Browser Extension
├── Local Agent
└── tldw_server (localhost)
```
Best for: Individual developers, air-gapped environments

**Model 2: Shared Server**
```text
User Machine                    Server
├── Browser Extension     ──▶   tldw_server
└── Local Agent
```
Best for: Teams, organizations with central LLM infrastructure

**Model 3: Cloud Hosted**
```text
User Machine                    Cloud
├── Browser Extension     ──▶   tldw_server (managed)
└── Local Agent
```
Best for: Organizations using managed LLM services

## Installation Methods

### Manual Installation

#### macOS

```bash
# Download latest release
curl -LO https://github.com/tldw/tldw-agent/releases/latest/download/tldw-agent-darwin-amd64.tar.gz

# Extract
tar -xzf tldw-agent-darwin-amd64.tar.gz

# Install binary
sudo mv tldw-agent-host /usr/local/bin/

# Install native messaging manifest (Chrome)
mkdir -p ~/Library/Application\ Support/Google/Chrome/NativeMessagingHosts/
cp com.tldw.agent.json ~/Library/Application\ Support/Google/Chrome/NativeMessagingHosts/

# Install native messaging manifest (Firefox)
mkdir -p ~/Library/Application\ Support/Mozilla/NativeMessagingHosts/
cp com.tldw.agent.json ~/Library/Application\ Support/Mozilla/NativeMessagingHosts/
```

#### Linux

```bash
# Download latest release
curl -LO https://github.com/tldw/tldw-agent/releases/latest/download/tldw-agent-linux-amd64.tar.gz

# Extract
tar -xzf tldw-agent-linux-amd64.tar.gz

# Install binary
sudo mv tldw-agent-host /usr/local/bin/

# Install native messaging manifest (Chrome)
mkdir -p ~/.config/google-chrome/NativeMessagingHosts/
cp com.tldw.agent.json ~/.config/google-chrome/NativeMessagingHosts/

# Install native messaging manifest (Firefox)
mkdir -p ~/.mozilla/native-messaging-hosts/
cp com.tldw.agent.json ~/.mozilla/native-messaging-hosts/
```

#### Windows

```powershell
# Download latest release
Invoke-WebRequest -Uri "https://github.com/tldw/tldw-agent/releases/latest/download/tldw-agent-windows-amd64.zip" -OutFile "tldw-agent.zip"

# Extract
Expand-Archive -Path tldw-agent.zip -DestinationPath "$env:LOCALAPPDATA\tldw-agent"

# Register native messaging host (Chrome)
$manifestPath = "$env:LOCALAPPDATA\tldw-agent\com.tldw.agent.json"
New-Item -Path "HKCU:\Software\Google\Chrome\NativeMessagingHosts\com.tldw.agent" -Force
Set-ItemProperty -Path "HKCU:\Software\Google\Chrome\NativeMessagingHosts\com.tldw.agent" -Name "(Default)" -Value $manifestPath

# Register native messaging host (Firefox)
New-Item -Path "HKCU:\Software\Mozilla\NativeMessagingHosts\com.tldw.agent" -Force
Set-ItemProperty -Path "HKCU:\Software\Mozilla\NativeMessagingHosts\com.tldw.agent" -Name "(Default)" -Value $manifestPath
```

### Automated Installation Scripts

The project includes installation scripts for each platform:

```bash
# macOS/Linux - Chrome
./scripts/install-chrome.sh

# macOS/Linux - Firefox
./scripts/install-firefox.sh

# Windows (PowerShell as Admin)
.\scripts\install-windows.ps1
```

### Package Managers

**Homebrew (macOS):**
```bash
brew tap tldw/tap
brew install tldw-agent
```

**Scoop (Windows):**
```powershell
scoop bucket add tldw https://github.com/tldw/scoop-bucket
scoop install tldw-agent
```

## Configuration

### Configuration File Location

The local agent reads configuration from:

| OS | Path |
|----|------|
| macOS | `~/.tldw-agent/config.yaml` |
| Linux | `~/.tldw-agent/config.yaml` |
| Windows | `%APPDATA%\tldw-agent\config.yaml` |

### Configuration Reference

```yaml
# ~/.tldw-agent/config.yaml

# Server configuration
server:
  # tldw_server URL for LLM calls
  llm_endpoint: "http://localhost:8000"

  # API key (optional - can be provided by extension)
  api_key: ""

# Workspace configuration
workspace:
  # Default workspace root (empty = user must select)
  default_root: ""

  # Paths that are always blocked (glob patterns)
  blocked_paths:
    - ".env"
    - ".env.*"
    - "*.pem"
    - "*.key"
    - "*.p12"
    - "*.pfx"
    - "**/node_modules/**"
    - "**/.git/objects/**"
    - "**/vendor/**"
    - "**/__pycache__/**"

  # Maximum file size for read operations (bytes)
  max_file_size_bytes: 10000000  # 10MB

# Execution configuration
execution:
  # Enable/disable command execution entirely
  enabled: true

  # Default timeout for commands (milliseconds)
  timeout_ms: 30000  # 30 seconds

  # Shell to use for command execution
  # Options: "auto", "bash", "sh", "zsh", "powershell", "cmd"
  shell: "auto"

  # Maximum output size from commands (bytes)
  max_output_bytes: 1048576  # 1MB

  # Allow network access for commands
  network_allowed: false

  # Custom commands to add to allowlist
  custom_commands:
    - id: "my_custom_test"
      template: "my-test-runner"
      description: "Run custom test framework"
      category: "test"
      allow_args: true
      max_args: 10
      env:
        - "CI=true"

# Security configuration
security:
  # Require user approval for write operations
  require_approval_for_writes: true

  # Require user approval for command execution
  require_approval_for_exec: true

  # Redact potential secrets from output
  redact_secrets: true

  # Secret patterns to redact (regex)
  secret_patterns:
    - '(?i)(api[_-]?key|secret|password|token)\s*[=:]\s*["\']?[\w-]+'
    - '(?i)bearer\s+[\w.-]+'
    - '-----BEGIN\s+\w+\s+PRIVATE\s+KEY-----'
    - 'ghp_[a-zA-Z0-9]{36}'
    - 'sk-[a-zA-Z0-9]{48}'

# Logging configuration
logging:
  # Log level: debug, info, warn, error
  level: "info"

  # Log file path (empty = stdout only)
  file: ""

  # Maximum log file size (bytes)
  max_size_bytes: 10485760  # 10MB

  # Number of log files to retain
  max_backups: 3
```

### Environment Variables

Configuration can also be set via environment variables:

| Variable | Description |
|----------|-------------|
| `TLDW_AGENT_CONFIG` | Path to config file |
| `TLDW_AGENT_LLM_ENDPOINT` | tldw_server URL |
| `TLDW_AGENT_API_KEY` | API key |
| `TLDW_AGENT_LOG_LEVEL` | Log level |
| `TLDW_AGENT_EXEC_ENABLED` | Enable/disable execution (true/false) |

Environment variables override config file values.

## Security

### Security Model

The tldw Agent implements defense-in-depth:

```text
┌─────────────────────────────────────────────────────────────┐
│                    Security Layers                          │
├─────────────────────────────────────────────────────────────┤
│ 1. Browser Extension Sandbox (Chrome/Firefox enforced)      │
├─────────────────────────────────────────────────────────────┤
│ 2. Native Messaging Auth (implicit browser authentication)  │
├─────────────────────────────────────────────────────────────┤
│ 3. Workspace Scoping (all paths validated against root)     │
├─────────────────────────────────────────────────────────────┤
│ 4. Path Blocking (sensitive files always blocked)           │
├─────────────────────────────────────────────────────────────┤
│ 5. Command Allowlist (only pre-approved commands)           │
├─────────────────────────────────────────────────────────────┤
│ 6. User Approval (write/exec require explicit approval)     │
├─────────────────────────────────────────────────────────────┤
│ 7. Secret Redaction (sensitive data filtered from output)   │
└─────────────────────────────────────────────────────────────┘
```

### Path Security

**Workspace Scoping:**
- All file operations are restricted to the workspace root
- Symlinks are resolved and validated
- Path traversal attempts (`../`) are blocked

**Blocked Paths:**
```yaml
blocked_paths:
  - ".env"           # Environment files
  - "*.pem"          # Certificates
  - "*.key"          # Private keys
  - "**/secrets/**"  # Secret directories
```

### Command Execution Security

**Allowlist Only:**
The agent can only execute commands from an explicit allowlist. Arbitrary shell commands are never allowed.

**Argument Sanitization:**
```go
// Shell metacharacters are blocked in arguments
blockedChars := []string{";", "&", "|", "`", "$", "(", ")", "{", "}", "<", ">"}
```

**No Shell Injection:**
Commands are executed directly, not through shell interpretation:
```go
// Good: Direct execution
exec.Command("pytest", "-v", "tests/")

// Bad: Shell interpretation (NOT used)
exec.Command("sh", "-c", "pytest -v tests/")
```

### Secret Redaction

Output from tools is scanned for potential secrets:

```yaml
secret_patterns:
  - '(?i)(api[_-]?key|secret|password|token)\s*[=:]\s*["\']?[\w-]+'
  - '(?i)bearer\s+[\w.-]+'
  - '-----BEGIN\s+\w+\s+PRIVATE\s+KEY-----'
```

Matched content is replaced with `[REDACTED]` before being sent to the LLM.

### Security Recommendations

1. **Minimize blocked_paths exclusions** - Only unblock paths when necessary
2. **Review custom commands carefully** - Each command is a potential attack vector
3. **Use read-only mode for sensitive repos** - Set `execution.enabled: false`
4. **Monitor logs** - Watch for unusual file access patterns
5. **Keep the agent updated** - Security patches are released regularly

## Command Allowlist Management

### Default Commands

**Unix (macOS/Linux):**

| ID | Template | Category |
|----|----------|----------|
| `pytest` | `python -m pytest` | test |
| `npm_test` | `npm test` | test |
| `go_test` | `go test ./...` | test |
| `cargo_test` | `cargo test` | test |
| `ruff` | `ruff check` | lint |
| `eslint` | `npx eslint` | lint |
| `prettier` | `npx prettier --write` | format |
| `black` | `black` | format |
| `npm_install` | `npm install` | package |
| `pip_install` | `pip install -r requirements.txt` | package |
| `go_mod_tidy` | `go mod tidy` | package |

**Windows:**

| ID | Template | Category |
|----|----------|----------|
| `pytest` | `python -m pytest` | test |
| `npm_test` | `npm test` | test |
| `go_test` | `go test ./...` | test |
| `dotnet_test` | `dotnet test` | test |
| `eslint` | `npx eslint` | lint |
| `prettier` | `npx prettier --write` | format |
| `npm_install` | `npm install` | package |
| `pip_install` | `pip install -r requirements.txt` | package |
| `nuget_restore` | `nuget restore` | package |

### Adding Custom Commands

Add to `config.yaml`:

```yaml
execution:
  custom_commands:
    # Custom test command
    - id: "jest"
      template: "npx jest"
      description: "Run Jest tests"
      category: "test"
      allow_args: true
      max_args: 20

    # Custom build command
    - id: "make_build"
      template: "make build"
      description: "Build with Make"
      category: "build"
      allow_args: false

    # Custom deploy (no args for safety)
    - id: "deploy_staging"
      template: "deploy-script.sh staging"
      description: "Deploy to staging"
      category: "deploy"
      allow_args: false
      env:
        - "DEPLOY_ENV=staging"
```

### Command Definition Schema

```yaml
custom_commands:
  - id: "unique_identifier"      # Required: unique command ID
    template: "command args"      # Required: command template
    description: "Human readable" # Required: shown in UI
    category: "test"              # Optional: test, lint, format, build, deploy, other
    allow_args: true              # Optional: allow additional arguments
    max_args: 10                  # Optional: max number of arguments
    env:                          # Optional: environment variables
      - "KEY=value"
```

### Disabling Commands

To disable a default command, override it with an empty template:

```yaml
execution:
  custom_commands:
    - id: "npm_install"
      template: ""
      description: "Disabled"
```

## Monitoring and Logging

### Log Files

**Location:**
| OS | Default Path |
|----|--------------|
| macOS | `~/.tldw-agent/logs/agent.log` |
| Linux | `~/.tldw-agent/logs/agent.log` |
| Windows | `%APPDATA%\tldw-agent\logs\agent.log` |

**Log Levels:**
- `debug` - Detailed debugging information
- `info` - Normal operational messages
- `warn` - Warning conditions
- `error` - Error conditions

### Log Format

```
2025-01-15T10:30:45.123Z INFO  [handler] Tool call: fs.read path=/src/main.ts
2025-01-15T10:30:45.156Z INFO  [handler] Tool result: ok=true bytes=1234
2025-01-15T10:30:46.789Z WARN  [validator] Blocked path access: .env
2025-01-15T10:30:47.012Z INFO  [exec] Running command: pytest -v tests/
2025-01-15T10:30:52.345Z INFO  [exec] Command complete: exit_code=0 duration=5333ms
```

### Metrics

The agent exposes metrics for monitoring:

```yaml
# Enable metrics endpoint
metrics:
  enabled: true
  port: 9090
```

**Available Metrics:**
- `tldw_agent_tool_calls_total` - Total tool calls by type
- `tldw_agent_tool_errors_total` - Tool errors by type
- `tldw_agent_command_duration_seconds` - Command execution duration
- `tldw_agent_file_reads_bytes` - Bytes read from files
- `tldw_agent_active_sessions` - Currently active workspace sessions

### Audit Logging

For compliance, enable audit logging:

```yaml
logging:
  audit:
    enabled: true
    file: "/var/log/tldw-agent/audit.log"
    include_args: true      # Log tool arguments
    include_results: false  # Don't log results (privacy)
```

Audit log format:
```json
{
  "timestamp": "2025-01-15T10:30:45.123Z",
  "event": "tool_call",
  "tool": "fs.read",
  "workspace": "/home/user/project",
  "args": {"path": "src/main.ts"},
  "user": "user@example.com",
  "approved": true
}
```

## Troubleshooting

### Common Issues

#### Agent Not Detected

**Symptoms:** Extension shows "Agent not installed"

**Diagnosis:**
```bash
# Check if binary exists
which tldw-agent-host

# Check native messaging manifest (Chrome, macOS)
cat ~/Library/Application\ Support/Google/Chrome/NativeMessagingHosts/com.tldw.agent.json

# Verify manifest points to correct binary
```

**Solution:** Re-run the installer script

#### Permission Denied

**Symptoms:** "Permission denied" errors in logs

**Diagnosis:**
```bash
# Check binary permissions
ls -la $(which tldw-agent-host)

# Check workspace permissions
ls -la /path/to/workspace
```

**Solution:**
```bash
chmod +x /usr/local/bin/tldw-agent-host
```

#### Command Timeout

**Symptoms:** Commands fail with timeout error

**Diagnosis:**
Check `execution.timeout_ms` in config

**Solution:**
```yaml
execution:
  timeout_ms: 60000  # Increase to 60 seconds
```

#### Memory Issues

**Symptoms:** Agent crashes on large files

**Diagnosis:**
Check `workspace.max_file_size_bytes`

**Solution:**
```yaml
workspace:
  max_file_size_bytes: 50000000  # Increase to 50MB
```

### Debug Mode

Enable debug logging for detailed diagnostics:

```yaml
logging:
  level: "debug"
```

Or via environment:
```bash
TLDW_AGENT_LOG_LEVEL=debug tldw-agent-host
```

### Health Check

Test agent connectivity:

```bash
# Send ping via native messaging (requires browser context)
# Or use the extension's built-in health check in Settings > Agent
```

## Enterprise Deployment

### Group Policy (Windows)

Deploy native messaging manifest via Group Policy:

1. Create `com.tldw.agent.json` in SYSVOL
2. Create GPO to set registry keys:
   - `HKLM\Software\Policies\Google\Chrome\NativeMessagingAllowlist` = `com.tldw.agent`
   - `HKLM\Software\Google\Chrome\NativeMessagingHosts\com.tldw.agent` = manifest path

### MDM (macOS)

Deploy via MDM profile:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "...">
<plist version="1.0">
<dict>
    <key>PayloadContent</key>
    <array>
        <dict>
            <key>PayloadType</key>
            <string>com.google.Chrome</string>
            <key>NativeMessagingAllowlist</key>
            <array>
                <string>com.tldw.agent</string>
            </array>
        </dict>
    </array>
</dict>
</plist>
```

### Configuration Management

**Ansible Example:**
```yaml
- name: Install tldw-agent
  hosts: workstations
  tasks:
    - name: Download agent binary
      get_url:
        url: https://github.com/tldw/tldw-agent/releases/latest/download/tldw-agent-linux-amd64
        dest: /usr/local/bin/tldw-agent-host
        mode: '0755'

    - name: Create config directory
      file:
        path: /etc/tldw-agent
        state: directory

    - name: Deploy config
      template:
        src: tldw-agent-config.yaml.j2
        dest: /etc/tldw-agent/config.yaml

    - name: Install native messaging manifest
      template:
        src: com.tldw.agent.json.j2
        dest: /etc/opt/chrome/native-messaging-hosts/com.tldw.agent.json
```

### Centralized Configuration

For enterprise deployments, consider:

1. **Config Server**: Host config files centrally
2. **Environment Variables**: Set via MDM/GPO
3. **Read-Only Config**: Prevent user modification

```yaml
# /etc/tldw-agent/config.yaml (system-wide, read-only)
# User config in ~/.tldw-agent/config.yaml is merged but can't override security settings
```

---

## Next Steps

- [User Guide](./user-guide.md) - For end users
- [Developer Guide](./developer-guide.md) - For contributing
- [Security Whitepaper](./security.md) - Detailed security analysis
