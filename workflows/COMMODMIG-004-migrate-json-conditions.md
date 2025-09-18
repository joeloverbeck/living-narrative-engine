# COMMODMIG-004: Migrate JSON Conditions

## Overview
Migrate all five condition files from core mod to companionship mod, updating namespace references and ensuring all component and event references are correct.

## Prerequisites
- COMMODMIG-001 (mod structure must exist)
- COMMODMIG-002 (components migrated for reference)
- COMMODMIG-003 (actions migrated for event references)

## Acceptance Criteria
1. ✅ All five condition files are moved to companionship mod
2. ✅ Namespace references updated from `core:` to `companionship:`
3. ✅ Component references in conditions updated
4. ✅ Event references in conditions updated
5. ✅ Conditions validate against schema
6. ✅ Original files removed from core mod

## Implementation Steps

### Step 1: Copy Condition Files
Copy all condition files to their new locations:

```bash
cp data/mods/core/conditions/event-is-action-follow.condition.json data/mods/companionship/conditions/event-is-action-follow.condition.json
cp data/mods/core/conditions/event-is-action-stop-following.condition.json data/mods/companionship/conditions/event-is-action-stop-following.condition.json
cp data/mods/core/conditions/event-is-action-dismiss.condition.json data/mods/companionship/conditions/event-is-action-dismiss.condition.json
cp data/mods/core/conditions/entity-is-following-actor.condition.json data/mods/companionship/conditions/entity-is-following-actor.condition.json
cp data/mods/core/conditions/actor-is-following.condition.json data/mods/companionship/conditions/actor-is-following.condition.json
```

### Step 2: Update event-is-action-follow.condition.json
Edit `data/mods/companionship/conditions/event-is-action-follow.condition.json`:

```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "companionship:event-is-action-follow",  // Changed from "core:event-is-action-follow"
  "description": "Checks if the event is a follow action",
  "logic": {
    "and": [
      {"==": [{"var": "event.type"}, "ACTION_PERFORMED"]},
      {"==": [{"var": "event.payload.actionId"}, "companionship:follow"]}  // Update action reference
    ]
  }
}
```

### Step 3: Update event-is-action-stop-following.condition.json
Edit `data/mods/companionship/conditions/event-is-action-stop-following.condition.json`:

```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "companionship:event-is-action-stop-following",  // Changed namespace
  "description": "Checks if the event is a stop following action",
  "logic": {
    "and": [
      {"==": [{"var": "event.type"}, "ACTION_PERFORMED"]},
      {"==": [{"var": "event.payload.actionId"}, "companionship:stop_following"]}  // Update reference
    ]
  }
}
```

### Step 4: Update event-is-action-dismiss.condition.json
Edit `data/mods/companionship/conditions/event-is-action-dismiss.condition.json`:

```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "companionship:event-is-action-dismiss",  // Changed namespace
  "description": "Checks if the event is a dismiss action",
  "logic": {
    "and": [
      {"==": [{"var": "event.type"}, "ACTION_PERFORMED"]},
      {"==": [{"var": "event.payload.actionId"}, "companionship:dismiss"]}  // Update reference
    ]
  }
}
```

### Step 5: Update entity-is-following-actor.condition.json
Edit `data/mods/companionship/conditions/entity-is-following-actor.condition.json`:

```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "companionship:entity-is-following-actor",  // Changed namespace
  "description": "Checks if target entity is following the actor",
  "logic": {
    "and": [
      {
        "some": [
          {"var": "target.components"},
          {
            "and": [
              {"==": [{"var": "componentId"}, "companionship:following"]},  // Update component ref
              {"==": [{"var": "data.leaderId"}, {"var": "actor.id"}]}
            ]
          }
        ]
      }
    ]
  }
}
```

### Step 6: Update actor-is-following.condition.json
Edit `data/mods/companionship/conditions/actor-is-following.condition.json`:

```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "companionship:actor-is-following",  // Changed namespace
  "description": "Checks if the actor is currently following anyone",
  "logic": {
    "some": [
      {"var": "actor.components"},
      {"==": [{"var": "componentId"}, "companionship:following"]}  // Update component ref
    ]
  }
}
```

### Step 7: Validate All Conditions
Run validation for all migrated conditions:

```bash
for file in data/mods/companionship/conditions/*.condition.json; do
  npm run validate-condition "$file"
done
```

### Step 8: Remove Original Files from Core
After confirming successful migration:

```bash
rm data/mods/core/conditions/event-is-action-follow.condition.json
rm data/mods/core/conditions/event-is-action-stop-following.condition.json
rm data/mods/core/conditions/event-is-action-dismiss.condition.json
rm data/mods/core/conditions/entity-is-following-actor.condition.json
rm data/mods/core/conditions/actor-is-following.condition.json
```

### Step 9: Update Core Mod Manifest
Edit `data/mods/core/mod-manifest.json` to remove condition references:

```json
{
  "conditions": [
    // Remove these lines:
    // "core:event-is-action-follow",
    // "core:event-is-action-stop-following",
    // "core:event-is-action-dismiss",
    // "core:entity-is-following-actor",
    // "core:actor-is-following",
    // ... keep other core conditions
  ]
}
```

## Testing Requirements

### Schema Validation
1. Validate all condition files:
   ```bash
   npm run validate-condition data/mods/companionship/conditions/*.condition.json
   ```

2. Verify namespace updates are complete:
   ```bash
   # Should return no results
   grep -r '"core:' data/mods/companionship/conditions/
   ```

3. Verify component references are updated:
   ```bash
   # Should find companionship:following references
   grep -r "companionship:following" data/mods/companionship/conditions/
   grep -r "companionship:leading" data/mods/companionship/conditions/
   ```

### Logic Tests
1. Test that JSON Logic expressions are valid
2. Verify variable paths match expected data structure
3. Ensure conditions can be evaluated by the logic engine

## Common Patterns in Conditions

### Event Checking Pattern
```json
{
  "and": [
    {"==": [{"var": "event.type"}, "ACTION_PERFORMED"]},
    {"==": [{"var": "event.payload.actionId"}, "companionship:ACTION_NAME"]}
  ]
}
```

### Component Checking Pattern
```json
{
  "some": [
    {"var": "entity.components"},
    {"==": [{"var": "componentId"}, "companionship:COMPONENT_NAME"]}
  ]
}
```

## Notes
- Conditions use JSON Logic format which must be preserved exactly
- Variable paths (like `actor.components`) remain unchanged
- Only namespace references need updating
- Some conditions check for events that reference our migrated actions
- Component checks must reference the new companionship namespace

## Dependencies
- Blocks: COMMODMIG-005 (rules that use these conditions)
- Blocked by: COMMODMIG-001, COMMODMIG-002, COMMODMIG-003

## Estimated Effort
- 1 hour

## Risk Assessment
- **Medium Risk**: Conditions are referenced by rules and actions
- **Logic Complexity**: JSON Logic must be preserved exactly
- **Mitigation**: Validate each condition after modification

## Success Metrics
- All five condition files exist in companionship mod
- All namespace references use `companionship:` prefix
- Conditions validate against schema
- JSON Logic expressions remain valid
- No references to core namespace remain in condition files