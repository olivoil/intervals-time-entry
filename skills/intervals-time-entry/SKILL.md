---
name: intervals-time-entry
description: Fill Intervals Online time entries from daily notes. Use when asked to fill time entries, timesheets, or submit hours to Intervals. Requires chrome-devtools MCP with browser open to Intervals.
allowed-tools: mcp__chrome-devtools__*, Bash(op read*), Read, Write, Edit
---

# Intervals Time Entry Automation

Fill time entries in Intervals Online from Obsidian daily notes using MCP chrome-devtools.

## Prerequisites

1. Chrome/Chromium running with `--remote-debugging-port=9222`
2. Intervals page open: `https://bhi.intervalsonline.com/time/multiple/`
3. chrome-devtools MCP server configured

## Cache Location

**IMPORTANT**: Cached mappings are stored in the PROJECT, not the plugin:

```
<project-root>/.claude/intervals-cache/project-mappings.md
```

This file persists your discovered project→workType mappings. If it doesn't exist, create it from the plugin's `references/project-mappings.md` template.

## Workflow

### Phase 1: Read Notes

Read the daily note for the requested date. Default location: `📅 Daily Notes/YYYY-MM-DD.md`

### Phase 2: Load Mappings

1. **Read project cache**: `.claude/intervals-cache/project-mappings.md` (in the project root)
2. **Read plugin references** for defaults: `references/worktype-mappings.md`, `references/people-context.md`

If the project cache doesn't exist, create it by copying from `references/project-mappings.md`.

Output format: `Project | Work Type | Hours | Description`

### Phase 3: Validate Against Cache

Check the project cache for work types:
- If all projects have cached work types → skip browser inspection
- If any project is NOT cached → inspect browser to discover its work types

### Phase 4: Browser Automation

Use MCP chrome-devtools with these scripts from `scripts/`:

1. **Basic inspection** (`scripts/inspect-basics.js`): Get dates and day index
2. **Discover work types** (`scripts/discover-worktypes.js`): For uncached projects only
3. **Fill entries** (`scripts/fill-entries.js`): Fill all validated entries

**IMPORTANT**: All scripts use arrow function format for MCP compatibility:
```javascript
// ✅ Correct
async () => { ... }

// ❌ Wrong - causes syntax errors
(async function() { ... })();
```

### Phase 5: UPDATE THE CACHE (Critical!)

**After discovering new work types, ALWAYS update the project cache file.**

If you discovered work types for a new project (e.g., "Drees Maintenance and Support"):

1. Read the current cache: `.claude/intervals-cache/project-mappings.md`
2. Add the new project section:

```markdown
### Drees Maintenance and Support (20240034)
- Development - US
- Meeting: Client Meeting - US
- QA/Testing - US
```

3. Write the updated file back

**Example update workflow:**
```
1. Read .claude/intervals-cache/project-mappings.md
2. Append new section under "## Cached Work Types by Project"
3. Write updated content to .claude/intervals-cache/project-mappings.md
```

This ensures future runs skip inspection for this project, saving time and tokens.

### Phase 6: Verify

Take screenshot to confirm entries are correct.

## Quick Reference

### Day Index Mapping

| Day | Index |
|-----|-------|
| Sunday | 0 |
| Monday | 1 |
| Tuesday | 2 |
| Wednesday | 3 |
| Thursday | 4 |
| Friday | 5 |
| Saturday | 6 |

### Common Fallbacks

| Project | Missing Work Type | Use Instead |
|---------|-------------------|-------------|
| Meeting | Internal Working Session | Team/Company Meeting |
| EWG Feature Enhancement Addendum | Analysis - US | Development - US |

## Customization

### Plugin References (read-only defaults)
The `references/` files in this plugin contain default mappings. Fork this repo to customize for your organization.

### Project Cache (read-write, auto-updated)
The cache at `.claude/intervals-cache/project-mappings.md` in your project:
- Gets created automatically from plugin defaults on first run
- Gets UPDATED automatically when new projects are discovered
- Persists between sessions
- Is project-specific (each project can have its own cache)

## First-Time Setup

On first use in a new project, Claude will:
1. Check if `.claude/intervals-cache/project-mappings.md` exists
2. If not, create it from the plugin's `references/project-mappings.md` template
3. Use and update this local cache going forward

## Efficiency

This skill is optimized for minimal browser interaction:
- **Cached mappings** eliminate redundant inspection
- **Auto-updating cache** means you only inspect each project ONCE ever
- **Single script execution** fills all entries (~30 seconds)
- **Total: 3-4 MCP calls** for a full day of entries
