# tldw Agent - Administrator Guide

This guide covers deployment, configuration, security, and maintenance of the tldw Agent for system administrators and IT teams.

## Table of Contents

- [Deployment Overview](#deployment-overview)
- [Installation Methods](#installation-methods)
- [Configuration](#configuration)
- [Security](#security)
- [Command Allowlist Management](#command-allowlist-management)
- [Session & Storage Management](#session--storage-management)
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

## Session & Storage Management

The agent extension stores session history and workspace preferences in browser storage (`chrome.storage.local`).

### Storage Architecture

```text
┌─────────────────────────────────────────────────────────────────┐
│                  Browser Extension Storage                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  agent:sessions          Array of stored sessions (~2MB max)     │
│  agent:activeSession     Current session reference               │
│  agent:workspaceHistory  Recent workspace list                   │
│  agent:selectedWorkspace Currently selected workspace ID         │
│  agent:workspaces        User's workspace definitions            │
│  agent:settings          User preferences                        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Storage Limits

The extension enforces strict limits to stay within browser quotas:

| Limit | Default Value | Purpose |
|-------|---------------|---------|
| Sessions per workspace | 5 | Prevents workspace clutter |
| Total sessions | 30 | Global storage cap |
| Session age | 30 days | Auto-cleanup old sessions |
| Workspace history | 10 | Quick access list |
| Message length | 4,000 chars | Truncation threshold |
| Tool result length | 2,000 chars | Truncation threshold |
| Tool args length | 1,000 chars | Truncation threshold |

### Storage Keys Reference

| Key | Type | Description |
|-----|------|-------------|
| `agent:sessions` | `StoredAgentSession[]` | All saved sessions |
| `agent:activeSession` | `ActiveSessionRef` | Currently active session ID + workspace |
| `agent:workspaceHistory` | `WorkspaceHistoryEntry[]` | Recently used workspaces |
| `agent:selectedWorkspace` | `string` | Currently selected workspace ID |
| `agent:workspaces` | `Workspace[]` | User's defined workspaces |
| `agent:settings` | `AgentSettings` | User preferences |

### Session Data Structure

Each stored session contains:

```typescript
{
  schemaVersion: 1,           // For future migrations
  id: "uuid",                 // Unique session ID
  workspaceId: "uuid",        // Associated workspace
  task: "Full task text",     // User's original request
  title: "Short title...",    // Truncated (50 chars)
  status: "complete",         // idle | running | waiting_approval | complete | error | cancelled
  currentStep: 5,             // Agent step number
  messages: [...],            // Conversation history (truncated)
  toolCalls: [...],           // Tool call log (truncated)
  pendingApprovals: [...],    // Pending approval requests
  diffs: [...],               // File change summaries
  executions: [...],          // Command execution summaries
  createdAt: "2025-01-15T10:30:00Z",
  updatedAt: "2025-01-15T10:35:00Z"
}
```

### Automatic Cleanup

Sessions are automatically cleaned up:

1. **On Extension Load**:
   - "Running" sessions marked as "error" (stale from browser crash)
   - Sessions older than 30 days removed
   - Global limit enforced (oldest first)

2. **On Session Save**:
   - Per-workspace limit enforced (oldest first)
   - Global limit enforced (oldest first)

3. **Workspace History**:
   - Orphaned entries (deleted workspaces) removed
   - Limited to 10 most recent

### Restorable Sessions

Only sessions with `status: "waiting_approval"` can be restored. This is by design:

- **`waiting_approval`**: User closed browser while agent needed approval - safe to restore
- **`running`**: Agent was mid-execution - marked as "error" on next load (can't safely resume)
- **`complete`/`error`/`cancelled`**: Terminal states - no restoration needed

### Clearing Storage

**Via Browser Developer Tools:**

```javascript
// Clear all agent storage
chrome.storage.local.get(null, (items) => {
  const agentKeys = Object.keys(items).filter(k => k.startsWith('agent:'))
  chrome.storage.local.remove(agentKeys)
})

// Clear only sessions
chrome.storage.local.remove('agent:sessions')

// Clear workspace history
chrome.storage.local.remove('agent:workspaceHistory')
```

**Via Extension Settings:**
Users can clear session history from the Session History panel using "Clear All".

### Storage Quotas

Browser extension storage limits:

| Browser | `chrome.storage.local` Limit |
|---------|------------------------------|
| Chrome | 5 MB (default), 10 MB with `unlimitedStorage` |
| Firefox | 5 MB |
| Edge | 5 MB |

The agent is designed to stay well under 2 MB with default limits.

### Backup and Export

Currently, session data cannot be exported. Future versions may add:
- Export sessions as JSON
- Import sessions from backup
- Sync across browsers (if logged in)

### Monitoring Storage Usage

**Via Developer Tools:**

```javascript
// Check total storage usage
chrome.storage.local.getBytesInUse(null, (bytes) => {
  console.log(`Total: ${(bytes / 1024).toFixed(2)} KB`)
})

// Check session storage specifically
chrome.storage.local.get('agent:sessions', (result) => {
  const size = JSON.stringify(result).length
  console.log(`Sessions: ${(size / 1024).toFixed(2)} KB`)
})
```

### Schema Versioning

Sessions include a `schemaVersion` field for future migrations:

```typescript
// Current version
CURRENT_SCHEMA_VERSION = 1

// Future migration example
if (session.schemaVersion < 2) {
  // Migrate from v1 to v2
  session.newField = defaultValue
  session.schemaVersion = 2
}
```

### Security Considerations

**Stored Data:**
- Message content may contain code snippets
- Tool arguments may contain file paths
- No secrets should be stored (redacted in logs, not in sessions)

**Data Truncation:**
- Large content is truncated before storage
- Truncated `arguments` fields may be invalid JSON
- Sessions are for review, not re-execution

**Access Control:**
- Extension storage is isolated to the extension origin
- Other extensions cannot access this data
- User can clear via browser settings

### Enterprise Considerations

**MDM/GPO:**
- Cannot directly configure extension storage limits
- Consider disabling session persistence for high-security environments

**Data Retention:**
- Sessions auto-delete after 30 days
- No cloud sync - data stays local
- Users can manually clear at any time

**Compliance:**
- Code snippets may be stored in session history
- Consider warning users about data persistence
- Implement additional cleanup policies if needed

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
