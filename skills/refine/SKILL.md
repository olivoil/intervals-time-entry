---
name: refine
description: Improve Obsidian daily notes — polish writing, add missing wikilinks, extract long sections into dedicated notes, and suggest new vault entities. Use when the user types /refine or asks to clean up daily notes.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash(echo $*), Bash(bash skills/transcribe-meeting/*), Bash(ffmpeg *), Bash(ffprobe *), Bash(curl *), Bash(gdown *), Bash(rclone *), Bash(op read*), Bash(whisper* *), Bash(jq *), Bash(file *), Bash(stat *), Bash(ls /tmp/meeting*), Bash(ls /run/media/*), Bash(youtubeuploader *), Bash(ls ~/Videos/*), Task
---

# Refine Daily Notes

Improve an Obsidian daily note by polishing prose, adding missing wikilinks to maintain a rich knowledge graph, extracting long sections into dedicated notes, and suggesting new vault entities.

## Workflow

### Phase 0: Setup

1. Run `echo $OBSIDIAN_VAULT_PATH` to get the vault root. If empty, ask the user for the path.
2. Determine the target date: use the argument if provided (e.g., `/refine 2026-02-14`), otherwise use today.
3. Read the daily note at `$VAULT/📅 Daily Notes/{date}.md`. Error if missing.

### Phase 1: Transcribe Meeting Recordings

Detect meeting recordings and transcribe them into meeting notes. Two sub-phases run in order: SD card auto-detect (primary), then Google Drive URL scan (fallback).

#### Phase 1a: Recording Detection & Matching (Primary)

1. **Discover screen recordings**:
   ```bash
   bash skills/transcribe-meeting/scripts/find-screenrecordings.sh "{date}"
   ```
   Save JSON output to `/tmp/screenrecs-{date}.json`. If no screen recordings found, use empty array `[]`.

2. **Discover Rodecaster recordings**:
   ```bash
   bash skills/transcribe-meeting/scripts/find-recordings.sh "{date}"
   ```
   Save JSON output to `/tmp/rodecaster-{date}.json`. If SD card not mounted or no recordings found, use empty array `[]`.

3. **Match recordings** by time overlap:
   ```bash
   bash skills/transcribe-meeting/scripts/match-recordings.sh /tmp/screenrecs-{date}.json /tmp/rodecaster-{date}.json
   ```
   This produces groups with `mode`, `video`, `audio`, and `transcribe_from` fields.

   If both arrays are empty, skip to Phase 1b silently.

4. **Check idempotency**: For each group, search for existing meeting notes by **both** `recording:` and `video_file:` fields:
   ```
   grep -rl 'recording: "{folder}"' "$VAULT/🎙️ Meetings/"
   grep -rl 'video_file: "{filename}"' "$VAULT/🎙️ Meetings/"
   ```
   Skip any group that already has a meeting note (matched by either field).

5. **Match to time entries**: For each new group, scan the daily note time entries for meeting-like entries. Use the recording start time and duration to correlate. Present to the user with mode info:
   > Found 2 recording groups:
   > 1. **omarchy-only**: screen recording from 09:36 (30 min) — no Rodecaster match. Match to `[[EWG]] - team standup - 0.5`?
   > 2. **omarchy+rodecaster**: screen recording from 11:02 + Rodecaster 10 (51 min). Match to `[[Khov]] - sync with Don - 1`?

6. **Extract context** from the matched time entry:
   - **Project**: The wikilinked project name (e.g., `[[Khov]]`)
   - **Description**: The task/meeting description (e.g., "sync with Don")
   - **Participants**: Any names mentioned in the line or surrounding context

7. **Determine audio source** for transcription:
   - `omarchy+rodecaster` → audio = Rodecaster WAV (`audio.path`)
   - `omarchy-only` → extract audio from screen recording:
     ```bash
     bash skills/transcribe-meeting/scripts/extract-audio.sh "{video.path}"
     ```
   - `rodecaster-only` → audio = Rodecaster WAV (`audio.path`)

8. **Spawn transcription sub-agent**: Use the **Task tool** to launch a sub-agent (subagent_type: `general-purpose`) for each new group. Provide this prompt:

   > You are transcribing a meeting recording. Follow the instructions in `skills/transcribe-meeting/SKILL.md` to:
   > 1. The audio file is at: {wav_path}
   > 2. Transcribe it (check `echo $OBSIDIAN_WHISPER_ENGINE` for engine, default `openai`)
   > 3. Generate a meeting note with summary, decisions, action items, and transcript
   > 4. Create the note at `{vault}/🎙️ Meetings/{date} {Title}.md`
   > 5. Set frontmatter fields:
   >    - `recording: "{folder}"` (if Rodecaster audio exists)
   >    - `audio_url: "{wav_path}"`
   >    - `video_file: "{video_filename}"` (if screen recording exists)
   >    - `recording_mode: "{mode}"`
   >
   > Context from daily note:
   > - Date: {date}
   > - Project: {project}
   > - Description: {description}
   > - Participants: {participants}
   > - Recording folder: {folder}
   > - Recording mode: {mode}
   > - Duration: {duration_secs} seconds
   >
   > Return the created note's filename (without path) so refine can update the daily note.

9. **Post-process & upload**: After transcription completes for each group:

   a. **Compress WAV → MP3** and **upload to Google Drive**:
      ```bash
      bash skills/transcribe-meeting/scripts/compress.sh "{wav_path}"
      bash skills/transcribe-meeting/scripts/upload-gdrive.sh "/tmp/meeting-archive/{filename}.mp3"
      ```
      Capture the Google Drive URL. Update `audio_url` in the meeting note.

   b. **Merge video + audio** (omarchy+rodecaster only):
      ```bash
      bash skills/transcribe-meeting/scripts/merge-av.sh "{video.path}" "{audio.path}"
      ```

   c. **Upload to YouTube** (omarchy+rodecaster and omarchy-only):
      ```bash
      bash skills/transcribe-meeting/scripts/upload-youtube.sh "{video_file}" "{meeting_title}" "{summary}" "{date}"
      ```
      - For `omarchy+rodecaster`: upload the **merged** MP4
      - For `omarchy-only`: upload the **original** screen recording MP4
      - Capture the YouTube URL. Update `video_url` in the meeting note.

10. **Update daily note**: Append a wikilink to the matched time entry line:
    ```
    - [[Khov]] - sync with Don - 1 - [[2026-02-18 Khov Sync with Don]]
    ```

11. **Update project note**: If the project has a note in `$VAULT/🗂️ Projects/`, add a `## Meetings` section (or append to existing) with a wikilink to the meeting note.

**Present the transcription summary to the user for confirmation before writing the meeting note** (consistent with refine's preview-before-applying pattern).

#### Phase 1b: Google Drive URL Detection (Fallback)

Scan the daily note for Google Drive audio links and transcribe them into meeting notes.

1. **Scan for audio URLs**: Look for lines containing `drive.google.com/file/d/` in the daily note text.
2. **Check for existing transcriptions**: For each URL found, search `$VAULT/🎙️ Meetings/` for a note with matching `audio_url` in frontmatter:
   ```
   grep -rl "audio_url:.*{file-id}" "$VAULT/🎙️ Meetings/"
   ```
   If a meeting note already exists for this URL, skip it (idempotent).
3. **Extract context**: From the daily note line containing the URL, infer:
   - **Project**: The wikilinked project name (e.g., `[[Khov]]`)
   - **Description**: The task/meeting description (e.g., "sync with Don")
   - **Participants**: Any names mentioned in the line or surrounding context
4. **Spawn transcription sub-agent**: Use the **Task tool** to launch a sub-agent (subagent_type: `general-purpose`) for each new recording. Provide this prompt:

   > You are transcribing a meeting recording. Follow the instructions in `skills/transcribe-meeting/SKILL.md` to:
   > 1. Download the audio from: {url}
   > 2. Transcribe it (check `echo $OBSIDIAN_WHISPER_ENGINE` for engine, default `openai`)
   > 3. Generate a meeting note with summary, decisions, action items, and transcript
   > 4. Create the note at `{vault}/🎙️ Meetings/{date} {Title}.md`
   >
   > Context from daily note:
   > - Date: {date}
   > - Project: {project}
   > - Description: {description}
   > - Participants: {participants}
   >
   > Return the created note's filename (without path) so refine can update the daily note.

5. **Update daily note**: Replace the Google Drive link in the daily note line:
   ```
   - [[Project]] - description - hours - [recording](https://drive.google.com/...)
   ```
   To:
   ```
   - [[Project]] - description - hours - [[{date} {Title}]]
   ```
6. **Update project note**: If the project has a note in `$VAULT/🗂️ Projects/`, add a `## Meetings` section (or append to existing) with a wikilink to the meeting note.

**Present the transcription summary to the user for confirmation before writing the meeting note** (consistent with refine's preview-before-applying pattern).

If no recordings are found from either source, skip this phase silently.

### Phase 2: Discover Vault Entities

Build a catalog of all known entities so you can match them against the daily note text.

1. **Projects**: List files recursively in `$VAULT/🗂️ Projects/` — extract project names from filenames
2. **People**: List files in `$VAULT/👤 Persons/` — read each file to extract `aliases` from frontmatter
3. **Topics**: List files in `$VAULT/📚 Topics/` — extract topic names from filenames
4. **Coding sessions**: List files in `$VAULT/💻 Coding/` — for cross-reference awareness
5. **Meetings**: List files in `$VAULT/🎙️ Meetings/` — for cross-reference awareness and to avoid duplicate transcription

This gives you the full entity catalog to match against the daily note.

### Phase 3: Analyze & Improve Writing

Review each section of the daily note:

- **Skip time entries** — the bullet list at the top (lines like `- [[Project]] - task - duration`) is structured data for the intervals skill. Never modify these.
- **Improve prose** — fix grammar, improve clarity, tighten wording. Keep it concise.
- **Fix formatting** — consistent heading levels, list styles, spacing.
- **Preserve todos** — don't reorder, rewrite, or change checkbox state. Only improve prose around them.
- **Author's voice** — improve clarity without rewriting the user's natural style. Don't make it sound like AI wrote it.

### Phase 4: Add Missing Wikilinks

Scan all text (outside time entries) for mentions of known entities:

- **Projects**: Add `[[Project Name]]` links where project names appear unlinked
- **People**: Add `[[Full Name]]` or `[[Full Name|Alias]]` when a short name or alias is used
- **Topics**: Add `[[Topic]]` links where topic names appear unlinked
- **Heading style**: Use `### [[Project]]` for project section headings consistently

**Rules:**
- Don't double-link — skip text already inside `[[...]]`
- Don't link inside time entry lines
- Link known entities freely without asking the user

### Phase 5: Extract Long Sections

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

### Phase 5b: Suggest New Entities

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

### Phase 6: Apply & Confirm

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
