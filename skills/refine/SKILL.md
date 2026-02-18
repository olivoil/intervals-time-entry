---
name: refine
description: Improve Obsidian daily notes — polish writing, add missing wikilinks, extract long sections into dedicated notes, and suggest new vault entities. Use when the user types /refine or asks to clean up daily notes.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash(echo $OBSIDIAN_VAULT_PATH)
---

# Refine Daily Notes

Improve an Obsidian daily note by polishing prose, adding missing wikilinks to maintain a rich knowledge graph, extracting long sections into dedicated notes, and suggesting new vault entities.

## Workflow

### Phase 0: Setup

1. Run `echo $OBSIDIAN_VAULT_PATH` to get the vault root. If empty, ask the user for the path.
2. Determine the target date: use the argument if provided (e.g., `/refine 2026-02-14`), otherwise use today.
3. Read the daily note at `$VAULT/📅 Daily Notes/{date}.md`. Error if missing.

### Phase 1: Discover Vault Entities

Build a catalog of all known entities so you can match them against the daily note text.

1. **Projects**: List files recursively in `$VAULT/🗂️ Projects/` — extract project names from filenames
2. **People**: List files in `$VAULT/👤 Persons/` — read each file to extract `aliases` from frontmatter
3. **Topics**: List files in `$VAULT/📚 Topics/` — extract topic names from filenames
4. **Coding sessions**: List files in `$VAULT/💻 Coding/` — for cross-reference awareness

This gives you the full entity catalog to match against the daily note.

### Phase 2: Analyze & Improve Writing

Review each section of the daily note:

- **Skip time entries** — the bullet list at the top (lines like `- [[Project]] - task - duration`) is structured data for the intervals skill. Never modify these.
- **Improve prose** — fix grammar, improve clarity, tighten wording. Keep it concise.
- **Fix formatting** — consistent heading levels, list styles, spacing.
- **Preserve todos** — don't reorder, rewrite, or change checkbox state. Only improve prose around them.
- **Author's voice** — improve clarity without rewriting the user's natural style. Don't make it sound like AI wrote it.

### Phase 3: Add Missing Wikilinks

Scan all text (outside time entries) for mentions of known entities:

- **Projects**: Add `[[Project Name]]` links where project names appear unlinked
- **People**: Add `[[Full Name]]` or `[[Full Name|Alias]]` when a short name or alias is used
- **Topics**: Add `[[Topic]]` links where topic names appear unlinked
- **Heading style**: Use `### [[Project]]` for project section headings consistently

**Rules:**
- Don't double-link — skip text already inside `[[...]]`
- Don't link inside time entry lines
- Link known entities freely without asking the user

### Phase 4: Extract Long Sections

Identify sections that are >~20 lines or contain substantial standalone content worth its own note.

For each extractable section:

1. **Determine destination**: `🗂️ Projects/` subtree or `📚 Topics/` based on content
2. **Create the new note** with proper format:
   ```markdown
   # {Title}

   {Extracted content}

   ## Related
   - [[📅 Daily Notes/{date}]]
   ```
3. **Replace the section** in the daily note with a brief summary + `[[wikilink]]` to the new note

**Present all proposed extractions to the user for approval before executing.** Show what would be extracted, where it would go, and what the replacement summary would look like.

### Phase 4b: Suggest New Entities

Identify mentions of people, projects, or topics that don't match any existing vault note.

Present these as candidates:
```
It looks like **Jane Smith** and **ProjectX** are mentioned but don't have vault pages yet.
Want me to create them?
```

For each confirmed new entity, create the note following vault conventions:

- **Person**: `$VAULT/👤 Persons/{Name}.md`
  ```markdown
  ---
  aliases:
    - {short name}
  ---
  # {Full Name}

  **Role**: {if known}
  **Projects**: {if known}

  ## Notes
  ```

- **Project**: `$VAULT/🗂️ Projects/{Name}.md` (or appropriate subdirectory)
  ```markdown
  # {Project Name}

  {Brief description if known}

  ## Related
  ```

- **Topic**: `$VAULT/📚 Topics/{Name}.md`
  ```markdown
  # {Topic Name}

  {Brief definition if known}

  ## Related

  ## Notes
  ```

After creating new entities:
- Add them to the respective MOC file (e.g., Persons MOC, Topics MOC) if one exists
- Link them in the daily note (they now exist as vault pages)

### Phase 5: Apply & Confirm

1. **Show a summary** of all proposed changes before writing:
   - Prose improvements (brief description)
   - Wikilinks added (list them)
   - Sections extracted (destination paths)
   - New entities created (paths)
2. **Get user approval** before applying
3. **Apply changes**: edit the daily note, create any extracted/new entity notes
4. **Report**: what was changed, what was linked, what was extracted, what was created

## Key Rules

- **Never modify time entries** — the bullet list at the top is structured data
- **Preserve todos** — only improve prose around them
- **Link known entities freely** — no need to ask for entities that already exist
- **Offer to create unknown entities** — ask before creating new vault pages
- **Author's voice** — improve clarity without rewriting style
- **Idempotent** — running twice shouldn't cause issues (don't re-extract already-extracted sections, don't double-link)
- **Show before applying** — always preview changes for user approval
