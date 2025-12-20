# tldw Agent Documentation

The tldw Agent provides an agentic coding assistant experience directly in your browser, similar to Claude Code or GitHub Copilot Workspace. It runs locally on your machine for maximum privacy and security.

## Documentation Sections

### [User Guide](./user-guide.md)
For end users who want to use the agent for coding assistance.
- Installation instructions
- Getting started guide
- Using the agent interface
- Understanding the approval system
- Troubleshooting common issues

### [Developer Guide](./developer-guide.md)
For developers who want to contribute or extend the agent.
- Architecture overview
- Development setup
- Project structure
- Adding new tools
- Testing guidelines
- Contributing workflow

### [Administrator Guide](./admin-guide.md)
For system administrators deploying the agent in teams or organizations.
- Deployment options
- Configuration reference
- Security hardening
- Command allowlist management
- Monitoring and logging
- Enterprise deployment

## Quick Links

| Topic | Link |
|-------|------|
| Installation | [User Guide - Installation](./user-guide.md#installation) |
| Configuration | [Admin Guide - Configuration](./admin-guide.md#configuration) |
| Security | [Admin Guide - Security](./admin-guide.md#security) |
| Adding Tools | [Developer Guide - Adding New Tools](./developer-guide.md#adding-new-tools) |
| Troubleshooting | [User Guide - Troubleshooting](./user-guide.md#troubleshooting) |

## Key Concepts

### Privacy First
Your source code stays on your machine. The local agent handles all file operations directly. Only your questions and the agent's reasoning (text) go through the tldw server for LLM processing.

### Tiered Approval System
- **Tier 0 (Auto)**: Read operations happen automatically
- **Tier 1 (Batch)**: Write operations are grouped for review
- **Tier 2 (Individual)**: Risky operations require explicit approval each time

### Local Agent
A small Go binary runs on your machine and handles:
- File reading and writing
- Code search (grep/glob)
- Git operations
- Command execution (via allowlist)

## Architecture Overview

```
┌───────────────────────────────────────────────────────────────┐
│                     Your Local Machine                         │
│  ┌──────────────────┐    ┌────────────────────────────────┐   │
│  │ Browser Extension│───▶│      Local Agent (Go)          │   │
│  │  - Chat UI       │    │  - File operations             │   │
│  │  - Diff viewer   │    │  - Git commands                │   │
│  │  - Terminal      │    │  - Allowlisted commands        │   │
│  └────────┬─────────┘    └───────────────┬────────────────┘   │
│           │                               │                    │
│           │                               ▼                    │
│           │                    ┌─────────────────────┐         │
│           │                    │  Your Workspace     │         │
│           │                    │  (source code)      │         │
│           │                    └─────────────────────┘         │
└───────────┼────────────────────────────────────────────────────┘
            │ LLM API calls
            ▼
     ┌──────────────┐
     │ tldw Server  │
     │ (reasoning)  │
     └──────────────┘
```

## Getting Help

- **Issues**: [GitHub Issues](https://github.com/tldw/tldw-agent/issues)
- **Discussions**: [GitHub Discussions](https://github.com/tldw/tldw-agent/discussions)
- **Documentation**: This site

## Version

Current version: 0.1.0 (MVP)

Supported features:
- [x] File read/write/patch
- [x] Code search (grep/glob)
- [x] Git operations (status, diff, log, add, commit)
- [x] Allowlisted command execution
- [x] Cross-platform (macOS, Linux, Windows)
- [x] Cross-browser (Chrome, Firefox, Edge)

Coming soon:
- [ ] Session persistence
- [ ] Workspace history
- [ ] OS-level sandboxing
- [ ] Remote workspaces (SSH)
