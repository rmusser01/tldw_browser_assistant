# tldw Agent - Developer Guide

This guide is for developers who want to contribute to the tldw Agent project, understand its architecture, or build integrations.

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Browser Extension](#browser-extension)
- [Local Agent (Go)](#local-agent-go)
- [Adding New Tools](#adding-new-tools)
- [Testing](#testing)
- [Contributing](#contributing)

## Architecture Overview

The tldw Agent consists of two main components:

### 1. Browser Extension (TypeScript/React)

The extension provides the user interface and orchestrates the agent loop:

```
custom_extension/
├── src/
│   ├── components/Agent/     # Agent UI components
│   ├── services/agent/       # Agent loop, approval manager
│   ├── services/native/      # Native messaging client
│   └── routes/               # Page routes including agent
```

### 2. Local Agent (Go)

The local agent runs on the user's machine and handles all workspace operations:

```
tldw-agent/
├── cmd/tldw-agent-host/      # Native messaging entry point
├── internal/
│   ├── mcp/                  # MCP server and tools
│   ├── native/               # Native messaging protocol
│   ├── workspace/            # Workspace management
│   └── config/               # Configuration
```

### Communication Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     Browser Extension                            │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────┐  │
│  │  Agent UI   │◄──▶│ Agent Loop  │◄──▶│ Native Msg Client   │  │
│  └─────────────┘    └──────┬──────┘    └──────────┬──────────┘  │
│                            │                       │             │
└────────────────────────────┼───────────────────────┼─────────────┘
                             │ LLM API               │ Native Messaging
                             ▼                       ▼
                    ┌────────────────┐      ┌────────────────┐
                    │  tldw_server   │      │  Local Agent   │
                    │  (reasoning)   │      │  (Go binary)   │
                    └────────────────┘      └───────┬────────┘
                                                    │
                                                    ▼
                                            ┌────────────────┐
                                            │   Workspace    │
                                            │   (files)      │
                                            └────────────────┘
```

### Data Flow

1. User types a message in the extension
2. Extension sends message + tool definitions to tldw_server (LLM)
3. LLM responds with text and/or tool calls
4. For tool calls, extension sends MCP request via Native Messaging
5. Local agent executes tool, returns result
6. Extension feeds result back to LLM
7. Loop continues until task is complete

## Development Setup

### Prerequisites

- Node.js 18+ or Bun
- Go 1.21+
- Chrome or Firefox for testing
- Git

### Setting Up the Extension

```bash
# Clone the repository
git clone https://github.com/tldw/custom-extension
cd custom-extension

# Install dependencies
bun install

# Start development server (Chrome)
bun run dev

# Or for Firefox
bun run dev:firefox
```

The extension will be built to `.output/chrome-mv3` (or firefox equivalent).

**Loading in Chrome:**
1. Go to `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select `.output/chrome-mv3`

### Setting Up the Local Agent

```bash
# Clone the repository
cd /path/to/tldw-agent

# Build the agent
go build -o tldw-agent-host ./cmd/tldw-agent-host

# Install for Chrome (macOS)
./scripts/install-chrome.sh

# Or for Firefox (macOS)
./scripts/install-firefox.sh
```

### Running Everything Together

1. Start tldw_server (for LLM reasoning)
2. Load the extension in your browser
3. Ensure the local agent is installed
4. Open the side panel and navigate to Agent tab

## Project Structure

### Browser Extension

```
src/
├── components/
│   └── Agent/
│       ├── index.ts                    # Barrel exports
│       ├── WorkspaceSelector.tsx       # Workspace dropdown
│       ├── ToolCallLog.tsx             # Tool call display
│       ├── DiffViewer.tsx              # Diff review UI
│       ├── ApprovalBanner.tsx          # Approval workflow
│       ├── TerminalOutput.tsx          # Command output
│       ├── AgentErrorBoundary.tsx      # Error handling
│       └── ErrorBoundaryTestTrigger.tsx # Test utilities
│
├── services/
│   ├── agent/
│   │   ├── agent-loop.ts               # Core orchestration
│   │   ├── approval-manager.ts         # Approval state machine
│   │   └── types.ts                    # TypeScript types
│   └── native/
│       └── native-client.ts            # Native messaging
│
├── routes/
│   ├── sidepanel-agent.tsx             # Main agent page
│   └── sidepanel-error-boundary-test.tsx # Test page
│
└── tests/
    └── e2e/
        └── agent-error-boundary.spec.ts # Playwright tests
```

### Local Agent (Go)

```
tldw-agent/
├── cmd/
│   └── tldw-agent-host/
│       └── main.go                     # Entry point
│
├── internal/
│   ├── config/
│   │   └── config.go                   # YAML config loading
│   │
│   ├── mcp/
│   │   ├── server.go                   # MCP JSON-RPC server
│   │   └── tools/
│   │       ├── fs.go                   # File operations
│   │       ├── search.go               # grep/glob
│   │       ├── git.go                  # Git operations
│   │       └── exec.go                 # Command execution
│   │
│   ├── native/
│   │   ├── framing.go                  # Length-prefixed JSON
│   │   └── handler.go                  # Message dispatch
│   │
│   └── workspace/
│       └── session.go                  # Session state
│
├── scripts/
│   ├── install-chrome.sh
│   ├── install-firefox.sh
│   └── install-windows.ps1
│
└── go.mod
```

## Browser Extension

### Key Components

#### AgentLoop (`agent-loop.ts`)

The agent loop orchestrates the conversation:

```typescript
class AgentLoop {
  constructor(
    workspaceId: string,
    task: string,
    settings: AgentSettings,
    onEvent: (event: AgentEvent) => void
  )

  async run(): Promise<void>           // Start the loop
  cancel(): void                        // Stop execution
  approvePending(ids: string[]): void   // Approve tool calls
  rejectPending(ids: string[]): void    // Reject tool calls
}
```

**Event Types:**

```typescript
type AgentEvent =
  | { type: "step_start"; step: number }
  | { type: "llm_chunk"; content: string }
  | { type: "llm_complete"; content: string }
  | { type: "tool_start"; tool_call: ToolCall }
  | { type: "tool_complete"; tool_call_id: string; result: ToolResult }
  | { type: "approval_needed"; approvals: PendingApproval[] }
  | { type: "complete"; result: AgentResult }
  | { type: "error"; error: string }
```

#### NativeClient (`native-client.ts`)

Handles communication with the local agent:

```typescript
class NativeClient {
  async connect(): Promise<boolean>
  async ping(): Promise<boolean>
  async executeTool(tool: string, args: object): Promise<ToolResult>
  disconnect(): void
}
```

#### ApprovalBanner (`ApprovalBanner.tsx`)

Displays pending approvals:

```tsx
<ApprovalBanner
  approvals={pendingApprovals}
  onApprove={(ids) => agent.approvePending(ids)}
  onReject={(ids) => agent.rejectPending(ids)}
  onViewDetails={() => setActiveTab("diff")}
  expanded={isExpanded}
  onToggleExpanded={() => setIsExpanded(!isExpanded)}
/>
```

### State Management

The agent page uses React hooks for state:

```typescript
// Agent instance
const agentRef = useRef<AgentLoop | null>(null)
const [isRunning, setIsRunning] = useState(false)

// Chat state
const [messages, setMessages] = useState<Message[]>([])
const [streamingContent, setStreamingContent] = useState("")

// Tool state
const [toolCalls, setToolCalls] = useState<ToolCallEntry[]>([])
const [pendingApprovals, setPendingApprovals] = useState<PendingApproval[]>([])

// Diff state
const [diffs, setDiffs] = useState<FileDiff[]>([])
```

## Local Agent (Go)

### Native Messaging Protocol

Chrome/Firefox use a length-prefixed JSON protocol:

```go
// Read message
func ReadMessage(r io.Reader) ([]byte, error) {
    var length uint32
    binary.Read(r, binary.LittleEndian, &length)
    msg := make([]byte, length)
    io.ReadFull(r, msg)
    return msg, nil
}

// Write message
func WriteMessage(w io.Writer, msg []byte) error {
    length := uint32(len(msg))
    binary.Write(w, binary.LittleEndian, length)
    w.Write(msg)
    return nil
}
```

### MCP Tool Implementation

Tools follow a consistent pattern:

```go
// ToolResult is returned by all tools
type ToolResult struct {
    OK    bool        `json:"ok"`
    Data  interface{} `json:"data,omitempty"`
    Error string      `json:"error,omitempty"`
}

// Example tool implementation
func (t *FSTools) Read(args map[string]interface{}) (*ToolResult, error) {
    path, _ := args["path"].(string)

    // Validate path is within workspace
    absPath, err := t.session.ValidatePath(path)
    if err != nil {
        return &ToolResult{OK: false, Error: err.Error()}, nil
    }

    // Read file
    content, err := os.ReadFile(absPath)
    if err != nil {
        return &ToolResult{OK: false, Error: err.Error()}, nil
    }

    return &ToolResult{
        OK: true,
        Data: map[string]interface{}{
            "content": string(content),
            "path":    absPath,
        },
    }, nil
}
```

### Security Considerations

**Path Validation:**
```go
func (s *Session) ValidatePath(path string) (string, error) {
    absPath := filepath.Join(s.root, path)
    realPath, _ := filepath.EvalSymlinks(absPath)

    // Ensure path is within workspace
    if !strings.HasPrefix(realPath, s.root) {
        return "", errors.New("path escapes workspace")
    }

    // Check blocked patterns
    for _, pattern := range s.blockedPaths {
        if matched, _ := filepath.Match(pattern, filepath.Base(realPath)); matched {
            return "", errors.New("path is blocked")
        }
    }

    return realPath, nil
}
```

**Command Allowlist:**
```go
// Commands must be in the allowlist
func (e *ExecTools) Run(args map[string]interface{}) (*ToolResult, error) {
    commandID, _ := args["command_id"].(string)

    cmd, ok := e.commands[commandID]
    if !ok {
        return &ToolResult{
            OK:    false,
            Error: fmt.Sprintf("command %q not in allowlist", commandID),
        }, nil
    }

    // Execute the allowlisted command...
}
```

## Adding New Tools

### 1. Define the Tool (Go)

Create a new tool in `internal/mcp/tools/`:

```go
package tools

type MyTool struct {
    session *workspace.Session
}

func NewMyTool(session *workspace.Session) *MyTool {
    return &MyTool{session: session}
}

func (t *MyTool) DoSomething(args map[string]interface{}) (*mcp.ToolResult, error) {
    // Implement tool logic
    return &mcp.ToolResult{
        OK:   true,
        Data: map[string]interface{}{"result": "success"},
    }, nil
}
```

### 2. Register the Tool

In `internal/mcp/server.go`:

```go
func (s *Server) registerTools() {
    // Existing tools...

    myTool := tools.NewMyTool(s.session)
    s.tools["my.do_something"] = myTool.DoSomething
}
```

### 3. Add Tool Definition (TypeScript)

In `services/agent/types.ts`:

```typescript
export const WORKSPACE_TOOLS: Tool[] = [
    // Existing tools...
    {
        type: "function",
        function: {
            name: "my.do_something",
            description: "Does something useful",
            parameters: {
                type: "object",
                properties: {
                    param1: {
                        type: "string",
                        description: "First parameter"
                    }
                },
                required: ["param1"]
            }
        }
    }
]
```

### 4. Set Approval Tier

In `services/agent/types.ts`:

```typescript
export const TOOL_TIERS: Record<string, ApprovalTier> = {
    // Existing tiers...
    "my.do_something": "auto",  // or "batch" or "individual"
}
```

## Testing

### Extension E2E Tests (Playwright)

```bash
# Build the extension first
bun run build:chrome

# Run all tests
bun run test:e2e

# Run specific test file
bun run test:e2e tests/e2e/agent-error-boundary.spec.ts

# Run with UI
bun run test:e2e:ui
```

**Writing Tests:**

```typescript
import { test, expect } from "@playwright/test"
import { launchWithExtension } from "./utils/extension"

test.describe("Agent Feature", () => {
    test("does something", async () => {
        const { context, sidepanelUrl } = await launchWithExtension(extPath)
        const page = await context.newPage()

        await page.goto(`${sidepanelUrl}#/agent`)

        // Test assertions...

        await context.close()
    })
})
```

### Go Tests

```bash
cd tldw-agent

# Run all tests
go test ./...

# Run with coverage
go test -cover ./...

# Run specific package
go test ./internal/mcp/tools/...
```

**Writing Tests:**

```go
func TestFSRead(t *testing.T) {
    // Create temp workspace
    tmpDir := t.TempDir()
    session := workspace.NewSession(tmpDir)
    fs := tools.NewFSTools(session)

    // Create test file
    os.WriteFile(filepath.Join(tmpDir, "test.txt"), []byte("hello"), 0644)

    // Test the tool
    result, err := fs.Read(map[string]interface{}{"path": "test.txt"})

    assert.NoError(t, err)
    assert.True(t, result.OK)
    assert.Equal(t, "hello", result.Data.(map[string]interface{})["content"])
}
```

## Contributing

### Development Workflow

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes
4. Write/update tests
5. Run tests: `bun run test:e2e` and `go test ./...`
6. Commit with clear message
7. Push and open a Pull Request

### Code Style

**TypeScript/React:**
- Use functional components with hooks
- Prefer `const` over `let`
- Use TypeScript types, avoid `any`
- Follow existing patterns in the codebase

**Go:**
- Follow standard Go conventions
- Use `gofmt` for formatting
- Write godoc comments for exported functions
- Handle errors explicitly

### Commit Messages

Follow conventional commits:

```
feat: add new grep tool option
fix: handle symlinks in path validation
docs: update developer guide
test: add error boundary tests
refactor: extract approval logic to hook
```

### Pull Request Guidelines

- Include tests for new features
- Update documentation if needed
- Keep PRs focused on a single change
- Respond to review feedback promptly

---

## Next Steps

- [User Guide](./user-guide.md) - For end users
- [Admin Guide](./admin-guide.md) - For deployment and configuration
- [API Reference](./api-reference.md) - Tool definitions and protocols
