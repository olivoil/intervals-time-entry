# Claude Code Skills Collection

A personal [Claude Code](https://claude.ai/code) plugin with productivity skills.

## Skills

| Skill | Description |
|-------|-------------|
| `/intervals-time-entry [date]` | Fill Intervals Online time entries from daily notes with GitHub and Outlook calendar correlation |
| `/intervals-to-freshbooks [week]` | Sync a week of Intervals entries to FreshBooks |
| `/done` | Capture session summary (decisions, questions, follow-ups) into Obsidian vault |

## Installation

```bash
claude plugin install om-skills@olivoil
```

## Prerequisites

- **Chrome with remote debugging** (`--remote-debugging-port=9222`) + chrome-devtools MCP server (for Intervals/FreshBooks skills)
- **`gh` CLI** (authenticated) for GitHub activity correlation
- **`curl` and `jq`** for FreshBooks API calls
- **`OBSIDIAN_VAULT_PATH` env variable** set to your Obsidian vault root (for `/done`)
- (Optional) `op` CLI for 1Password credential references
- (Optional) Outlook Web logged in for calendar correlation

## Local Development

```bash
# Disable installed version
claude plugin disable om

# Run with local plugin source
claude --plugin-dir /path/to/skills/

# Test skills as usual
#   > /done
#   > /intervals-time-entry 2026-02-04

# Re-enable when done
claude plugin enable om
```

## License

MIT
