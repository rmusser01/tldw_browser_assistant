# tldw Agent - User Guide

The tldw Agent is a powerful coding assistant that runs locally on your machine, providing Claude Code-like capabilities directly in your browser. This guide covers installation, setup, and everyday usage.

## Table of Contents

- [Overview](#overview)
- [Installation](#installation)
- [Getting Started](#getting-started)
- [Using the Agent](#using-the-agent)
- [Understanding Approvals](#understanding-approvals)
- [Session Persistence](#session-persistence)
- [Workspace History](#workspace-history)
- [Troubleshooting](#troubleshooting)
- [FAQ](#faq)

## Overview

The tldw Agent provides:

- **Code Understanding** - Ask questions about your codebase and get intelligent answers
- **Code Editing** - Let the agent propose and apply code changes with your approval
- **Command Execution** - Run tests, linters, and formatters through allowlisted commands
- **Git Integration** - Stage files, create commits, and manage your repository
- **Privacy First** - All workspace operations happen locally; your code never leaves your machine

### How It Works

```
┌──────────────────┐     ┌─────────────────┐     ┌──────────────┐
│  Browser         │────▶│  Local Agent    │────▶│  Your Code   │
│  Extension       │     │  (on your PC)   │     │  (local)     │
└──────────────────┘     └─────────────────┘     └──────────────┘
         │
         │ LLM calls only
         ▼
┌──────────────────┐
│  tldw Server     │
│  (reasoning)     │
└──────────────────┘
```

**Key Point**: Your source code stays on your machine. Only your questions and the agent's reasoning go through the tldw server.

## Installation

### Prerequisites

- Google Chrome, Microsoft Edge, or Mozilla Firefox
- macOS, Linux, or Windows
- A running tldw_server instance (local or remote)

### Step 1: Install the Browser Extension

**Chrome/Edge:**
1. Download the extension from the Chrome Web Store (or load unpacked for development)
2. Click "Add to Chrome/Edge"
3. Pin the extension to your toolbar for easy access

**Firefox:**
1. Download from Firefox Add-ons
2. Click "Add to Firefox"

### Step 2: Install the Local Agent

The local agent is a small program that runs on your computer and handles all file operations.

**macOS:**
```bash
# Download the installer
curl -fsSL https://github.com/tldw/tldw-agent/releases/latest/download/install-macos.sh | bash
```

**Linux:**
```bash
# Download the installer
curl -fsSL https://github.com/tldw/tldw-agent/releases/latest/download/install-linux.sh | bash
```

**Windows (PowerShell as Administrator):**
```powershell
# Download and run the installer
iwr -useb https://github.com/tldw/tldw-agent/releases/latest/download/install-windows.ps1 | iex
```

### Step 3: Configure the Extension

1. Click the extension icon and go to **Settings**
2. Enter your tldw server URL (e.g., `http://localhost:8000`)
3. Enter your API key or log in with your credentials
4. Click **Save**

### Step 4: Verify Installation

1. Open the extension's side panel
2. Navigate to the **Agent** tab
3. You should see "Agent Connected" status
4. If not, see [Troubleshooting](#troubleshooting)

## Getting Started

### Selecting a Workspace

Before using the agent, you need to select a workspace (the folder containing your code):

1. Open the Agent tab in the side panel
2. Click the **Workspace** dropdown
3. Click **Add Workspace**
4. Select the folder containing your project
5. Give it a friendly name (e.g., "My React App")

The agent will only have access to files within this workspace for security.

### Your First Conversation

Try asking the agent about your codebase:

```
What does this project do? Give me a high-level overview.
```

The agent will:
1. Search through your files
2. Read relevant code
3. Provide an intelligent summary

### Example Tasks

**Understanding Code:**
```
Explain how authentication works in this project.
```

**Finding Code:**
```
Where is the user login function defined?
```

**Making Changes:**
```
Add input validation to the signup form.
```

**Running Tests:**
```
Run the tests and fix any failures.
```

## Using the Agent

### The Agent Interface

The agent interface has four main tabs:

| Tab | Purpose |
|-----|---------|
| **Chat** | Conversation with the agent, shows tool calls |
| **Diff** | Review proposed code changes before applying |
| **Terminal** | View output from executed commands |

### Tool Call Indicators

As the agent works, you'll see tool calls appear in the chat:

- 🔍 **Search** - Agent is searching your codebase
- 📖 **Read** - Agent is reading a file
- ✏️ **Edit** - Agent wants to modify a file (requires approval)
- 🖥️ **Execute** - Agent wants to run a command (requires approval)
- 📁 **Git** - Agent is performing git operations

### Streaming Responses

The agent streams its thinking and responses in real-time. You'll see:
- Text appearing as the agent "thinks"
- Tool calls being made and their results
- Final responses with actionable information

## Understanding Approvals

The agent uses a tiered approval system to keep you in control:

### Tier 0: Auto-Approved (Read-Only)

These operations happen automatically without asking:
- Listing files and directories
- Reading file contents
- Searching code (grep/glob)
- Checking git status
- Viewing git diffs and logs

### Tier 1: Batch Approval (Edits)

These operations are grouped for your review:
- Writing/editing files
- Creating directories
- Git add and commit

**How it works:**
1. Agent proposes changes
2. Yellow banner appears: "3 file changes pending"
3. Click **View Diff** to review changes
4. Use checkboxes to select which changes to approve
5. Click **Approve Selected** or **Approve All**

### Tier 2: Individual Approval (Risky)

These operations require explicit approval each time:
- Deleting files or directories
- Running shell commands
- Git push operations

**How it works:**
1. Agent requests to run a command
2. Red-highlighted item appears in approval list
3. Review the exact command and arguments
4. Click the green checkmark to approve, or red X to reject

### The Approval Banner

When approvals are pending, a yellow banner appears:

```
┌─────────────────────────────────────────────────────────┐
│ ⚠️ 3 actions pending  [📝 2] [🗑️ 1]                    │
│                                                         │
│ [View Details] [✓ Approve All] [✗ Reject All]          │
└─────────────────────────────────────────────────────────┘
```

- Click the expand button to see individual items
- Approve or reject items individually
- Or use bulk actions for all items

## Session Persistence

The agent automatically saves your sessions, so you can resume work even after closing your browser.

### How It Works

Sessions are automatically saved:
- **During execution** - Every few seconds while the agent is working
- **When paused** - Immediately when the agent needs your approval
- **On completion** - When a task finishes (success, error, or cancelled)

### Viewing Session History

Click the **History** button (clock icon) in the agent header to see past sessions:

```
┌─────────────────────────────────────────────┐
│ Session History                         [X] │
├─────────────────────────────────────────────┤
│ ▸ Add dark mode toggle        ✓ Complete   │
│   2h ago • 15 messages • 8 tool calls       │
│                                             │
│ ▸ Fix login validation        ⏸ Paused     │
│   1d ago • 8 messages • 3 tool calls        │
│                                             │
│ ▸ Refactor user service       ✗ Error      │
│   3d ago • 12 messages • 5 tool calls       │
└─────────────────────────────────────────────┘
```

### Session Statuses

| Status | Icon | Meaning |
|--------|------|---------|
| **Complete** | ✓ | Task finished successfully |
| **Paused** | ⏸ | Waiting for your approval (can be restored) |
| **Error** | ✗ | Task encountered an error |
| **Cancelled** | ⊘ | Task was cancelled by you |

### Restoring a Session

Sessions with **Paused** status can be restored:

1. Open Session History
2. Click on a paused session to expand it
3. Click **Restore** to resume where you left off
4. Review pending approvals and continue

**Note**: Only "Paused" (waiting for approval) sessions can be restored. Other sessions are for reference only.

### Automatic Session Recovery

If you close your browser while the agent is waiting for approval:

1. When you return, a dialog appears: "Previous Session Found"
2. Choose **Restore Session** to continue where you left off
3. Or choose **Start Fresh** to discard and start a new task

```
┌─────────────────────────────────────────────────┐
│ ⚠️ Previous Session Found                       │
├─────────────────────────────────────────────────┤
│ Add input validation to signup form             │
│ 🕐 2 hours ago • 8 messages • 3 tool calls      │
│                                                 │
│ ⚠️ 2 pending approvals                          │
│   📝 1 file change • 🖥️ 1 command               │
│                                                 │
│ [Restore Session]          [Start Fresh]        │
└─────────────────────────────────────────────────┘
```

### Managing Sessions

- **Delete a session**: Expand it in history and click **Delete**
- **Clear all**: Click **Clear All** at the top of the history panel
- **Storage**: Sessions older than 30 days are automatically removed

### Storage Limits

To keep storage manageable:
- Maximum **5 sessions per workspace**
- Maximum **30 sessions total** across all workspaces
- Sessions expire after **30 days**

Older sessions are automatically removed when limits are reached.

## Workspace History

The agent remembers your recently used workspaces for quick access.

### Recent Workspaces

When you open the workspace dropdown, you'll see:

```
┌─────────────────────────────────────────────┐
│ 🕐 RECENT                                   │
│   My React App              Just now        │
│   Backend API               2h ago          │
│   Documentation             1d ago          │
├─────────────────────────────────────────────┤
│ ALL WORKSPACES                              │
│   My React App          ~/projects/myapp    │
│   Backend API           ~/projects/api      │
│   Documentation         ~/docs              │
│   Old Project           ~/archive/old       │
├─────────────────────────────────────────────┤
│ ➕ Add Workspace                            │
└─────────────────────────────────────────────┘
```

### Auto-Select Last Workspace

When you open the agent:
- If no workspace is selected, the **last used workspace** is automatically selected
- This saves you from re-selecting every time

### Workspace History Limits

- Maximum **10 recent workspaces** are tracked
- Workspaces that no longer exist are automatically removed
- The list is sorted by most recently used

## Troubleshooting

### Agent Not Connected

**Symptoms:** "Agent not installed" or "Connection failed" message

**Solutions:**
1. Verify the local agent is installed:
   ```bash
   # macOS/Linux
   which tldw-agent-host

   # Windows (PowerShell)
   Get-Command tldw-agent-host
   ```

2. Check if the native messaging host is registered:
   - **Chrome (macOS):** `~/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.tldw.agent.json`
   - **Firefox (macOS):** `~/Library/Application Support/Mozilla/NativeMessagingHosts/com.tldw.agent.json`

3. Re-run the installer to fix registration

### Permission Denied Errors

**Symptoms:** Agent can't read or write files

**Solutions:**
1. Make sure the workspace folder has proper permissions
2. Check that the file isn't in the blocked paths list (`.env`, `*.pem`, etc.)
3. Verify the file is within your selected workspace root

### Command Execution Failed

**Symptoms:** "Command not in allowlist" error

**Solutions:**
1. Only allowlisted commands can be run for security
2. Check available commands in Settings > Agent > Commands
3. Add custom commands if needed (see Admin Guide)

### Server Connection Issues

**Symptoms:** "Cannot reach tldw server" error

**Solutions:**
1. Verify your tldw_server is running
2. Check the server URL in extension settings
3. Verify your API key is correct
4. Check firewall settings if using a remote server

### Slow Performance

**Symptoms:** Agent responds slowly or times out

**Solutions:**
1. Large files take longer to read - be specific about which files
2. Complex searches may timeout - narrow your search patterns
3. Check your network connection to the tldw server
4. Consider using a local tldw_server for faster responses

## FAQ

### Is my code sent to external servers?

**No.** Your code stays on your local machine. The local agent handles all file operations. Only your questions and the agent's text responses go through the tldw server for LLM processing.

### Can the agent delete my files?

Only if you explicitly approve it. File deletions require individual approval and are highlighted in red. Always review before approving.

### What commands can the agent run?

The agent can only run commands from an allowlist. Default commands include:
- Test runners: `pytest`, `npm test`, `go test`, `cargo test`
- Linters: `eslint`, `ruff`
- Formatters: `prettier`, `black`
- Package managers: `npm install`, `pip install`

Custom commands can be added by administrators.

### Can I use multiple workspaces?

Yes! Add multiple workspaces through the workspace selector. However, the agent operates in one workspace at a time during a conversation.

### How do I undo changes the agent made?

The agent integrates with git. If you're in a git repository:
1. Changes are tracked normally
2. Use `git diff` to see what changed
3. Use `git checkout -- <file>` to revert specific files
4. Use `git reset --hard` to revert all changes (careful!)

For non-git folders, consider initializing git for safety.

### Does the agent work offline?

Partially. The local agent can read your files offline, but:
- LLM reasoning requires connection to tldw_server
- If using a local tldw_server with local models, everything works offline

### How do I report bugs?

1. Check the browser console for errors (F12 > Console)
2. Check the agent logs in `~/.tldw-agent/logs/`
3. Report issues at: https://github.com/tldw/tldw-agent/issues

---

## Next Steps

- [Developer Guide](./developer-guide.md) - For contributing to the project
- [Admin Guide](./admin-guide.md) - For deployment and configuration
- [API Reference](./api-reference.md) - For integrating with the agent
