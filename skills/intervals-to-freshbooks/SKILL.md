---
name: intervals-to-freshbooks
description: Copy a week's worth of time entries from Intervals to FreshBooks using dual browser automation. Use when asked to sync time entries between Intervals and FreshBooks.
allowed-tools: mcp__chrome-devtools__*, Read, Write, Edit
---

# Intervals → FreshBooks Time Entry Sync

Copy weekly time entries from Intervals to FreshBooks using MCP chrome-devtools with dual browser automation.

## Prerequisites

1. Chrome/Chromium running with `--remote-debugging-port=9222`
2. Intervals weekly timesheet open: `https://bhi.intervalsonline.com/time/`
3. FreshBooks week view open: `https://my.freshbooks.com/#/time-tracking/week?week=YYYY-MM-DD`
4. Both pages showing the SAME week
5. chrome-devtools MCP server configured

## Cache Location

**IMPORTANT**: Cached mappings are stored in the PROJECT:

```
<project-root>/.claude/intervals-cache/
└── freshbooks-mappings.md    # Intervals→FreshBooks project mappings
```

If the cache doesn't exist, create it from `references/project-mappings.md`.

## Workflow

### Phase 1: Verify Prerequisites

1. Call `list_pages` to see all open browser tabs
2. Find Intervals tab (URL contains `intervalsonline.com/time/`)
3. Find FreshBooks tab (URL contains `freshbooks.com` and `time-tracking/week`)
4. If either is missing, inform user and stop
5. Verify both are showing the same week

### Phase 2: Read from Intervals

1. Select the Intervals tab using `select_page`
2. Run `scripts/read-intervals.js` using `evaluate_script`
3. Display aggregated entries to user:
   - Project + Work Type combination
   - Hours per day (Mon-Sun)
   - Total hours per entry

**Example output:**
```
Intervals Weekly Timesheet (Jan 6-12, 2026)

| Project | Work Type | Mon | Tue | Wed | Thu | Fri | Total |
|---------|-----------|-----|-----|-----|-----|-----|-------|
| Ignite Application Development & Support | Development - US | 4 | 6 | 5 | 4 | 3 | 22 |
| EWG Feature Enhancement Addendum | Development - US | 2 | 0 | 3 | 2 | 0 | 7 |
| Meeting | Team/Company Meeting | 1 | 0.5 | 0 | 1 | 0 | 2.5 |
```

### Phase 3: Map Projects

1. Load mappings from `.claude/intervals-cache/freshbooks-mappings.md`
2. Transform each Intervals entry to FreshBooks client/service
3. For unmapped projects:
   - Ask user for the FreshBooks Client and Service names
   - Update the cache file with new mapping
4. Show mapped entries for user review

**Example mapping:**
```
Intervals: Ignite Application Development & Support / Development - US
  → FreshBooks: Technomic / Development

Intervals: Meeting / Team/Company Meeting
  → FreshBooks: EXSquared / Meetings
```

### Phase 4: Fill FreshBooks

1. Select the FreshBooks tab using `select_page`
2. Take a snapshot to understand current state
3. For each mapped entry:
   - Run `scripts/fill-freshbooks.js` with entry data
   - The script will:
     - Click "New Row" button
     - Select Client from combobox
     - Select Service from combobox
     - Save the row
     - Fill hours for each day
4. Take screenshot showing all rows filled

**Day Mapping:**
- Intervals uses Mon-Sun (Mon=0, Sun=6)
- FreshBooks uses Sun-Sat (Sun=0, Sat=6)
- Script handles this conversion automatically

### Phase 5: Review and Save

1. Take final screenshot of FreshBooks timesheet
2. Display summary:
   - Total entries created
   - Total hours per day
   - Grand total hours
3. Inform user: "Review the entries and click Save to commit"
4. Wait for user confirmation

## Scripts

### `read-intervals.js`

Extracts entries from Intervals weekly timesheet and aggregates by project+worktype.

**Returns:**
```javascript
{
  weekStart: "2026-01-06",    // Monday of the week
  weekEnd: "2026-01-12",      // Sunday of the week
  entries: [
    {
      client: "Technomic",
      project: "Ignite Application Development & Support",
      workType: "Development - US",
      hours: { mon: 4, tue: 6, wed: 5, thu: 4, fri: 3, sat: 0, sun: 0 },
      totalHours: 22,
      billable: true
    }
  ]
}
```

### `fill-freshbooks.js`

Fills one row in FreshBooks week view.

**Input (embedded in script):**
```javascript
const ENTRY = {
  client: "Technomic",        // FreshBooks client name
  service: "Development",     // FreshBooks service name
  hours: { sun: 0, mon: 4, tue: 6, wed: 5, thu: 4, fri: 3, sat: 0 }
};
```

**Process:**
1. Click "New Row" button
2. Search and select Client
3. Search and select Service
4. Click Save/confirm for the row
5. Fill hours in each day cell
6. Return success/error status

## Quick Reference

### Day Index Mapping

| Day | Intervals Index | FreshBooks Index |
|-----|-----------------|------------------|
| Sunday | 6 | 0 |
| Monday | 0 | 1 |
| Tuesday | 1 | 2 |
| Wednesday | 2 | 3 |
| Thursday | 3 | 4 |
| Friday | 4 | 5 |
| Saturday | 5 | 6 |

### Common Issues

1. **Client not found**: FreshBooks client names may differ from Intervals. Check exact spelling.
2. **Service not found**: Each client has specific services enabled. Use generic services if specific not available.
3. **Hours already exist**: FreshBooks may show existing entries. Clear them first or adjust totals.

## Customization

### Project Mappings

Edit `.claude/intervals-cache/freshbooks-mappings.md` to customize:

```markdown
| Intervals Client | Intervals Project | FreshBooks Client | FreshBooks Service |
|-----------------|-------------------|-------------------|-------------------|
| Technomic | Ignite Application Development & Support | Technomic | Development |
| EX Squared Services | Meeting | EXSquared | Meetings |
```

### Adding New Mappings

When a new project appears:
1. Claude will ask for FreshBooks client and service names
2. The mapping is automatically added to the cache
3. Future syncs use the cached mapping

## Efficiency

This skill minimizes browser interaction:
- Single script reads all Intervals entries at once
- Mappings are cached locally
- FreshBooks automation is batched
- User reviews before committing
