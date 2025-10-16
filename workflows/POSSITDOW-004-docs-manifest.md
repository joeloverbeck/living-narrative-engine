# POSSITDOW-004: Update Positioning Mod Documentation & Manifest

**Phase:** 3 - Polish & Enablement
**Priority:** Medium
**Estimated Effort:** 3 hours

## Goal

Ensure the positioning mod metadata and documentation reflect the new sit-at-distance action and related rule additions.

## Context

The specification requires updates to `data/mods/positioning/mod-manifest.json`, `data/mods/positioning/README.md`, and `data/mods/positioning/VALIDATION_PATTERNS.md` (if necessary) so that tooling and content creators understand the new behavior.

## Tasks

### 1. Manifest Registration
- Add the new action (`sit_down_at_distance.action.json`), rule (`handle_sit_down_at_distance.rule.json`), and any new conditions/scopes created by POSSITDOW-001 through POSSITDOW-003 to `data/mods/positioning/mod-manifest.json`.
- Verify ordering matches existing conventions (grouping by type) and that IDs align with file contents.

### 2. README Documentation
- Update `data/mods/positioning/README.md` with a concise description of the new action, emphasizing when it becomes available and how it differs from the default sit-down behavior.
- Mention any limitations (e.g., requires two empty spots to the right of the selected occupant).

### 3. Validation Patterns
- Review `data/mods/positioning/VALIDATION_PATTERNS.md` to determine if additional patterns are needed to cover the new files.
- Add or adjust validation examples so automated checks recognize the new assets.

### 4. Localization Follow-Up Notes
- Document whether the action template uses inline strings or requires new localized entries; flag this for the narrative design team if unresolved.

### 5. Consistency Checks
- Run relevant validation scripts (`npm run validate` or targeted commands) to ensure manifest references match actual files.

## Acceptance Criteria
- Manifest lists all new assets introduced by the sit-at-distance feature.
- Positioning README clearly communicates the new action and its gameplay intent.
- Validation pattern documentation remains accurate and passes associated tooling.
