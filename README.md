# Intervals Time Entry Plugin for Claude Code

A Claude Code plugin that automates filling time entries in [Intervals Online](https://www.myintervals.com/) from daily work notes.

## Features

- **Smart caching**: Learns project→workType mappings to skip redundant browser inspection
- **Batch execution**: Fills all entries in a single script (~30 seconds for a full day)
- **Automatic fallbacks**: Handles project-specific work type limitations
- **Minimal token usage**: 3-4 MCP calls total vs 50+ with click-by-click automation

## Installation

```bash
claude plugin marketplace add https://github.com/olivoil/intervals-time-entry
claude plugin install intervals-time-entry@olivoil
```

Or install directly:

```bash
claude /plugin install https://github.com/olivoil/intervals-time-entry
```

## Prerequisites

1. **Chrome with remote debugging**:
   ```bash
   chromium --remote-debugging-port=9222
   # or
   google-chrome --remote-debugging-port=9222
   ```

2. **chrome-devtools MCP server** configured in your Claude Code settings

3. **Intervals page open** in Chrome at:
   ```
   https://bhi.intervalsonline.com/time/multiple/
   ```

4. **1Password CLI** (optional, for credentials):
   ```bash
   op signin
   ```

## Usage

### Via slash command:
```
/intervals-time-entry
```

### Via natural language:
```
Fill my time entries for January 20, 2026
```

Claude will:
1. Read your daily notes
2. Map activities to Intervals projects/work types
3. Check cached mappings (skip inspection if all known)
4. Generate and execute a fill script
5. Screenshot to verify

## Customization

Fork this repo to customize for your organization:

### `references/project-mappings.md`
Maps note terminology to Intervals project names + caches discovered work types:

```markdown
| Notes Term | Intervals Project |
|------------|-------------------|
| Technomic | Ignite Application Development & Support |
| EWG | EWG Feature Enhancement Addendum (20250047) |
```

### `references/worktype-mappings.md`
Maps activity descriptions to work types:

```markdown
| Notes Term | Work Type |
|------------|-----------|
| standup | Meeting: Internal Stand Up - US |
| dev, coding | Development - US |
```

### `references/people-context.md`
Associates people with projects for smarter inference:

```markdown
| Person | Project | Typical Meeting Type |
|--------|---------|---------------------|
| Russell | Technomic | Meeting: Client Meeting - US |
```

## How It Works

The plugin uses an efficient batch-execution strategy with **auto-updating cache**:

```
┌─────────────────────────────────────────────────────────────┐
│  1. Check PROJECT cache (file read, no MCP)                 │
│     → .claude/intervals-cache/project-mappings.md           │
│     → Skip inspection for known projects                    │
├─────────────────────────────────────────────────────────────┤
│  2. Inspect page (1 MCP call)                               │
│     → Get dates, day index mapping                          │
├─────────────────────────────────────────────────────────────┤
│  3. Discover unknowns (0-1 MCP call)                        │
│     → Only for projects not in cache                        │
├─────────────────────────────────────────────────────────────┤
│  4. UPDATE PROJECT CACHE (file write)                       │
│     → Save newly discovered mappings                        │
│     → Future runs skip inspection for this project          │
├─────────────────────────────────────────────────────────────┤
│  5. Generate fill script (Claude reasoning, no MCP)         │
│     → Create JS with all validated entries                  │
├─────────────────────────────────────────────────────────────┤
│  6. Execute script (1 MCP call)                             │
│     → Fill all entries in ~30 seconds                       │
├─────────────────────────────────────────────────────────────┤
│  7. Screenshot (1 MCP call)                                 │
│     → Verify before saving                                  │
└─────────────────────────────────────────────────────────────┘

Total: 3-4 MCP calls, ~5 minutes for a full day
```

### Cache Architecture

The cache is stored **in your project**, not the plugin:

```
your-project/
├── .claude/
│   └── intervals-cache/
│       └── project-mappings.md   ← Auto-updated cache
└── ...
```

This means:
- **Plugin is read-only** → Safe to share via GitHub
- **Cache is project-local** → Each project has its own mappings
- **Cache persists** → Only inspect each project ONCE ever
- **Cache auto-updates** → New discoveries are saved automatically

## Why Not Use Claude in Chrome Extension?

The Chrome extension uses click-by-click automation:
- Each action requires Claude reasoning + LLM latency
- 9 entries × 4 actions each = 36+ round trips
- Much slower and more token-intensive

This plugin generates a single JavaScript that fills everything in one shot.

## File Structure

```
intervals-time-entry/
├── .claude-plugin/
│   └── plugin.json           # Plugin manifest
├── skills/
│   └── intervals-time-entry/
│       ├── SKILL.md          # Main instructions
│       ├── references/
│       │   ├── project-mappings.md
│       │   ├── worktype-mappings.md
│       │   └── people-context.md
│       └── scripts/
│           ├── inspect-basics.js
│           ├── discover-worktypes.js
│           └── fill-entries.js
└── README.md
```

## License

MIT
