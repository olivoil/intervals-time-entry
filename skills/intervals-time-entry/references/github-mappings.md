# GitHub Repository Mappings

## How Mappings Are Learned

This file is auto-populated as Claude discovers repo→project associations:

1. **From notes**: When you include PR/repo links alongside time entries, Claude extracts the mapping
2. **From inference**: When GitHub activity matches time entry projects contextually

## Repository → Intervals Project

| Repository (owner/repo) | Intervals Project |
|------------------------|-------------------|
<!-- Claude adds mappings here as they are discovered -->

## Work Type Inference from PR Activity

| GitHub Activity | Inferred Work Type |
|-----------------|-------------------|
| PR authored | Development - US |
| PR review submitted | Architecture/Technical Design - US |
| PR review comment | Architecture/Technical Design - US |
| PR merge/deploy | Deployment - US |
| Issue work | Development - US or Analysis - US |

## Description Enhancement

When enhancing time entry descriptions with PR context:

- Include PR number and brief title
- For reviews, list PRs reviewed (up to 3, summarize if more)
- Keep descriptions concise but informative

Examples:
```
"PR #123: Add OAuth2 login support"
"Code review: PR #456 - Fix payment edge case, PR #457 - Update API"
"5 PR reviews including #123, #124, #125"
```

## Time Estimation from Commits

Claude estimates development time by analyzing commit timestamps:

1. **First commit to last commit**: Time span between first and last commit on that day
2. **Gap detection**: Large gaps (>2h) between commits suggest breaks
3. **Context from notes**: Use notes as primary source, commits as validation

Example inference:
```
Commits at: 9:15am, 10:30am, 11:45am, 2:00pm, 3:30pm
Estimated: ~4h of work (9:15am-3:30pm with ~2h lunch break)
```

**Note**: Commit-based estimation is a lower bound. Development involves thinking, debugging, and testing that don't produce commits.
