# COMMODMIG-001: Create Companionship Mod Structure

## Overview
Create the foundational directory structure and manifest for the new companionship mod. This establishes the mod as a separate, optional gameplay module that can be enabled or disabled independently of the core mod.

## Prerequisites
- None (this is the first ticket in the migration)

## Acceptance Criteria
1. ✅ Companionship mod directory structure exists with all required subdirectories
2. ✅ Mod manifest is created with proper dependencies and metadata
3. ✅ Deep Teal color scheme is documented and ready for use
4. ✅ Mod can be recognized by the mod loader system

## Implementation Steps

### Step 1: Create Directory Structure
Create the following directory structure:
```bash
data/mods/companionship/
├── actions/
├── components/
├── conditions/
├── rules/
├── scopes/
├── macros/
└── mod-manifest.json
```

Commands to execute:
```bash
mkdir -p data/mods/companionship/actions
mkdir -p data/mods/companionship/components
mkdir -p data/mods/companionship/conditions
mkdir -p data/mods/companionship/rules
mkdir -p data/mods/companionship/scopes
mkdir -p data/mods/companionship/macros
```

### Step 2: Create Mod Manifest
Create `data/mods/companionship/mod-manifest.json` with the following content:

```json
{
  "$schema": "schema://living-narrative-engine/mod-manifest.schema.json",
  "id": "companionship",
  "version": "1.0.0",
  "name": "Companionship System",
  "description": "Provides following, leading, and companion management mechanics",
  "author": "Living Narrative Engine Team",
  "dependencies": ["core", "movement"],
  "loadOrder": 20,
  "components": [
    "companionship:following",
    "companionship:leading"
  ],
  "actions": [
    "companionship:follow",
    "companionship:stop_following",
    "companionship:dismiss"
  ],
  "conditions": [
    "companionship:event-is-action-follow",
    "companionship:event-is-action-stop-following",
    "companionship:event-is-action-dismiss",
    "companionship:entity-is-following-actor",
    "companionship:actor-is-following"
  ],
  "rules": [
    "companionship:follow",
    "companionship:stop_following",
    "companionship:dismiss",
    "companionship:follow_auto_move"
  ],
  "scopes": [
    "companionship:followers",
    "companionship:potential_leaders"
  ],
  "macros": [
    "companionship:autoMoveFollower"
  ]
}
```

### Step 3: Document Color Scheme
Create a color scheme reference that will be used in all action files:

**Deep Teal Color Scheme** (WCAG AA Compliant):
- Background: `#00695c`
- Text: `#e0f2f1`
- Hover Background: `#00897b`
- Hover Text: `#ffffff`

This color scheme conveys trust, stability, and depth - perfect for companion relationships.

### Step 4: Validate Manifest Schema
Run the following command to ensure the manifest is valid:
```bash
npm run validate-manifest data/mods/companionship/mod-manifest.json
```

## Testing Requirements
1. Verify directory structure exists:
   ```bash
   ls -la data/mods/companionship/
   ```

2. Validate mod manifest against schema:
   ```bash
   npm run validate-manifest data/mods/companionship/mod-manifest.json
   ```

3. Ensure mod loader can recognize the new mod (without loading content yet):
   - The mod should appear in the available mods list
   - Dependencies should be validated (core and movement must exist)

## Notes
- The load order of 20 ensures companionship loads after core (10) and movement (15)
- Dependencies on both core and movement are required for proper functionality
- The Deep Teal color scheme was specifically chosen for its psychological associations with trust and companionship
- All content references will use the `companionship:` namespace prefix

## Dependencies
- Blocks: None
- Blocked by: None

## Estimated Effort
- 30 minutes

## Risk Assessment
- **Low Risk**: This is purely structural setup with no code changes
- **Validation**: Manifest schema validation ensures correctness

## Success Metrics
- Directory structure created successfully
- Mod manifest validates against schema
- Mod appears in available mods list (when game.json is updated in later ticket)