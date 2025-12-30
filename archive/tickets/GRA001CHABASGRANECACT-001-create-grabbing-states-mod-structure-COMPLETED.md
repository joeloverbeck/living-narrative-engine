# GRA001CHABASGRANECACT-001: Create grabbing-states Mod Structure

## Summary
Create the new `grabbing-states` mod directory structure and manifest file. This mod will eventually contain state components for tracking grabbing interactions, but the component files and manifest content entries are deferred to follow-on tickets to keep validation green.

## File List (Files to Touch)

### Files to Create
- `data/mods/grabbing-states/mod-manifest.json`
- `data/mods/grabbing-states/components/` (directory only)

## Out of Scope

**DO NOT modify or touch:**
- Any existing mod files in `data/mods/grabbing/`
- `data/game.json` (handled in separate ticket)
- Component JSON files inside `grabbing-states/components/` (handled in separate tickets)
- Any source code in `src/`
- Any schema files in `data/schemas/`

## Implementation Details

### mod-manifest.json Content

```json
{
  "$schema": "schema://living-narrative-engine/mod-manifest.schema.json",
  "id": "grabbing-states",
  "version": "1.0.0",
  "name": "Grabbing States",
  "description": "State components for tracking grabbing interactions between actors",
  "dependencies": []
}
```

Note: The `content.components` entries will be added in tickets 002 and 003 alongside the actual component files. Listing files now would cause validation failures because the files are not created in this ticket.

## Acceptance Criteria

### Tests That Must Pass
- `npm run validate:mod -- grabbing-states` completes without errors referencing `grabbing-states` mod structure

### Invariants That Must Remain True
- No changes to any existing mod functionality
- The mod manifest follows the standard mod-manifest.schema.json format
- The mod ID matches the directory name (`grabbing-states`)
- The `dependencies` array is empty (this mod has no dependencies)
- The manifest does not list component files until they exist

## Verification Steps

1. Directory exists: `data/mods/grabbing-states/`
2. Directory exists: `data/mods/grabbing-states/components/`
3. File exists and is valid JSON: `data/mods/grabbing-states/mod-manifest.json`
4. `npm run validate:mod -- grabbing-states` passes

## Dependencies
- None (this is the first ticket in the sequence)

## Blocked By
- None

## Blocks
- GRA001CHABASGRANECACT-002 (grabbing_neck component)
- GRA001CHABASGRANECACT-003 (neck_grabbed component)
- GRA001CHABASGRANECACT-009 (game.json update)

## Status
Completed

## Outcome
- Created `data/mods/grabbing-states/` with a `components/` directory and a base `mod-manifest.json`.
- Deferred `content.components` entries until tickets 002/003 provide the component files (avoids validation failures from missing files).
