# COMMODMIG-005: Migrate Rules and Macros

## Overview
Migrate four rule files and one macro file from core mod to companionship mod. Handle the special case of `follow_auto_move.rule.json` which responds to the `core:entity_moved` event that remains in core.

## Prerequisites
- COMMODMIG-001 (mod structure must exist)
- COMMODMIG-002 (components migrated)
- COMMODMIG-003 (actions migrated)
- COMMODMIG-004 (conditions migrated)

## Acceptance Criteria
1. ✅ All four rule files are moved to companionship mod
2. ✅ Macro file is moved to companionship mod
3. ✅ Namespace references updated except for core events
4. ✅ Cross-mod event dependency handled correctly
5. ✅ Rules and macro validate against schemas
6. ✅ Original files removed from core mod

## Implementation Steps

### Step 1: Copy Rule Files
Copy all rule files to their new locations:

```bash
cp data/mods/core/rules/follow.rule.json data/mods/companionship/rules/follow.rule.json
cp data/mods/core/rules/stop_following.rule.json data/mods/companionship/rules/stop_following.rule.json
cp data/mods/core/rules/dismiss.rule.json data/mods/companionship/rules/dismiss.rule.json
cp data/mods/core/rules/follow_auto_move.rule.json data/mods/companionship/rules/follow_auto_move.rule.json
```

### Step 2: Copy Macro File
Copy the macro file:

```bash
cp data/mods/core/macros/autoMoveFollower.macro.json data/mods/companionship/macros/autoMoveFollower.macro.json
```

### Step 3: Update follow.rule.json
Edit `data/mods/companionship/rules/follow.rule.json`:

```json
{
  "$schema": "schema://living-narrative-engine/rule.schema.json",
  "id": "companionship:follow",  // Changed from "core:follow"
  "name": "Follow Rule",
  "description": "Handles the follow action to establish following relationship",
  "trigger": {
    "event": "ACTION_PERFORMED",
    "conditions": [
      {
        "condition_ref": "companionship:event-is-action-follow"  // Update reference
      }
    ]
  },
  "operations": [
    {
      "type": "establishFollowRelation",
      "actorId": {"var": "event.payload.actorId"},
      "targetId": {"var": "event.payload.targetId"}
    }
  ]
}
```

### Step 4: Update stop_following.rule.json
Edit `data/mods/companionship/rules/stop_following.rule.json`:

```json
{
  "$schema": "schema://living-narrative-engine/rule.schema.json",
  "id": "companionship:stop_following",  // Changed namespace
  "name": "Stop Following Rule",
  "description": "Handles the stop following action",
  "trigger": {
    "event": "ACTION_PERFORMED",
    "conditions": [
      {
        "condition_ref": "companionship:event-is-action-stop-following"  // Update reference
      }
    ]
  },
  "operations": [
    {
      "type": "breakFollowRelation",
      "actorId": {"var": "event.payload.actorId"}
    }
  ]
}
```

### Step 5: Update dismiss.rule.json
Edit `data/mods/companionship/rules/dismiss.rule.json`:

```json
{
  "$schema": "schema://living-narrative-engine/rule.schema.json",
  "id": "companionship:dismiss",  // Changed namespace
  "name": "Dismiss Rule",
  "description": "Handles dismissing a follower",
  "trigger": {
    "event": "ACTION_PERFORMED",
    "conditions": [
      {
        "condition_ref": "companionship:event-is-action-dismiss"  // Update reference
      }
    ]
  },
  "operations": [
    {
      "type": "breakFollowRelation",
      "actorId": {"var": "event.payload.targetId"},  // Note: target becomes actor for break
      "leaderId": {"var": "event.payload.actorId"}
    }
  ]
}
```

### Step 6: Update follow_auto_move.rule.json (Special Case)
Edit `data/mods/companionship/rules/follow_auto_move.rule.json`:

```json
{
  "$schema": "schema://living-narrative-engine/rule.schema.json",
  "id": "companionship:follow_auto_move",  // Changed namespace
  "name": "Follow Auto Move Rule",
  "description": "Automatically moves followers when leader moves",
  "trigger": {
    "event": "core:entity_moved",  // KEEP CORE - this event stays in core!
    "conditions": []  // May have conditions checking for leading component
  },
  "macro": "companionship:autoMoveFollower",  // Update macro reference
  "operations": [
    {
      "type": "autoMoveFollowers",
      "leaderId": {"var": "event.payload.entityId"},
      "newLocation": {"var": "event.payload.newLocation"}
    }
  ]
}
```

### Step 7: Update autoMoveFollower.macro.json
Edit `data/mods/companionship/macros/autoMoveFollower.macro.json`:

```json
{
  "$schema": "schema://living-narrative-engine/macro.schema.json",
  "id": "companionship:autoMoveFollower",  // Changed namespace
  "name": "Auto Move Follower",
  "description": "Macro for automatically moving followers with their leader",
  "parameters": [
    {
      "name": "leaderId",
      "type": "string",
      "required": true
    },
    {
      "name": "newLocation",
      "type": "string",
      "required": true
    }
  ],
  "operations": [
    {
      "type": "autoMoveFollowers",
      "leaderId": {"var": "leaderId"},
      "newLocation": {"var": "newLocation"}
    }
  ]
}
```

### Step 8: Validate Rules and Macro
Run validation:

```bash
# Validate rules
for file in data/mods/companionship/rules/*.rule.json; do
  npm run validate-rule "$file"
done

# Validate macro
npm run validate-macro data/mods/companionship/macros/autoMoveFollower.macro.json
```

### Step 9: Remove Original Files
After confirming successful migration:

```bash
# Remove rules
rm data/mods/core/rules/follow.rule.json
rm data/mods/core/rules/stop_following.rule.json
rm data/mods/core/rules/dismiss.rule.json
rm data/mods/core/rules/follow_auto_move.rule.json

# Remove macro
rm data/mods/core/macros/autoMoveFollower.macro.json
```

### Step 10: Update Core Mod Manifest
Edit `data/mods/core/mod-manifest.json`:

```json
{
  "rules": [
    // Remove these lines:
    // "core:follow",
    // "core:stop_following",
    // "core:dismiss",
    // "core:follow_auto_move",
    // ... keep other core rules
  ],
  "macros": [
    // Remove this line:
    // "core:autoMoveFollower",
    // ... keep other core macros
  ]
}
```

## Testing Requirements

### Validation Tests
1. Schema validation:
   ```bash
   npm run validate-rule data/mods/companionship/rules/*.rule.json
   npm run validate-macro data/mods/companionship/macros/*.macro.json
   ```

2. Namespace verification:
   ```bash
   # Should only find core:entity_moved (the event reference)
   grep -r '"core:' data/mods/companionship/rules/

   # Should find no core references in macros
   grep -r '"core:' data/mods/companionship/macros/
   ```

3. Cross-mod dependency check:
   ```bash
   # Verify follow_auto_move still references core:entity_moved
   grep "core:entity_moved" data/mods/companionship/rules/follow_auto_move.rule.json
   ```

### Integration Tests
1. Rules should trigger on appropriate events
2. Macro should be callable from rules
3. Cross-mod event handling should work (core event triggers companionship rule)

## Important Notes on Cross-Mod Dependencies

The `follow_auto_move.rule.json` file is special because it:
1. Listens to `core:entity_moved` event (which stays in core)
2. This creates a dependency from companionship → core (already declared in mod manifest)
3. This pattern allows companionship mod to react to core movement events

**DO NOT** change `core:entity_moved` to `companionship:entity_moved` as this event is part of the core movement system.

## Operation Types Reference
The following operation types are used by these rules:
- `establishFollowRelation` - Creates a following relationship
- `breakFollowRelation` - Removes a following relationship
- `autoMoveFollowers` - Moves all followers when leader moves

These operations are handled by JavaScript operation handlers (updated in COMMODMIG-007).

## Dependencies
- Blocks: COMMODMIG-006 (scopes may be referenced in rules)
- Blocked by: COMMODMIG-001, COMMODMIG-002, COMMODMIG-003, COMMODMIG-004

## Estimated Effort
- 1.5 hours

## Risk Assessment
- **Medium Risk**: Rules are core to gameplay functionality
- **Cross-Mod Dependency**: Special handling needed for core event
- **Mitigation**: Careful testing of event triggers and rule execution

## Success Metrics
- All rule and macro files exist in companionship mod
- Namespace references updated (except core:entity_moved)
- Files validate against schemas
- Cross-mod event dependency preserved
- Rules trigger correctly on events