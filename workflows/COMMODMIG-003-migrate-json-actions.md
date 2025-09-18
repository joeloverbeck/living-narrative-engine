# COMMODMIG-003: Migrate JSON Actions

## Overview
Migrate the follow, stop_following, and dismiss action files from core mod to companionship mod. Update namespaces, apply the new Deep Teal color scheme, and ensure all internal references are correct.

## Prerequisites
- COMMODMIG-001 (mod structure must exist)
- COMMODMIG-002 (components should be migrated first for reference consistency)

## Acceptance Criteria
1. ✅ All three action files are moved to companionship mod
2. ✅ Namespace references updated from `core:` to `companionship:`
3. ✅ Deep Teal color scheme applied to all actions
4. ✅ All condition and component references updated
5. ✅ Actions validate against schema
6. ✅ Original files removed from core mod

## Implementation Steps

### Step 1: Copy Action Files
Copy the action files to their new locations:

```bash
cp data/mods/core/actions/follow.action.json data/mods/companionship/actions/follow.action.json
cp data/mods/core/actions/stop_following.action.json data/mods/companionship/actions/stop_following.action.json
cp data/mods/core/actions/dismiss.action.json data/mods/companionship/actions/dismiss.action.json
```

### Step 2: Update follow.action.json
Edit `data/mods/companionship/actions/follow.action.json`:

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "companionship:follow",  // Changed from "core:follow"
  "name": "Follow",
  "description": "Start following another character",
  "category": "companionship",  // Update category
  "backgroundColor": "#00695c",  // Deep Teal (was "#455a64")
  "textColor": "#e0f2f1",        // Light Teal (was "#ffffff")
  "hoverBackgroundColor": "#00897b",  // Hover Deep Teal (was "#37474f")
  "hoverTextColor": "#ffffff",
  "icon": "👥",
  "targetType": "entity",
  "conditions": [
    {
      "condition_ref": "companionship:can_follow_target"  // Update references
    }
  ]
}
```

### Step 3: Update stop_following.action.json
Edit `data/mods/companionship/actions/stop_following.action.json`:

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "companionship:stop_following",  // Changed from "core:stop_following"
  "name": "Stop Following",
  "description": "Stop following your current leader",
  "category": "companionship",
  "backgroundColor": "#00695c",
  "textColor": "#e0f2f1",
  "hoverBackgroundColor": "#00897b",
  "hoverTextColor": "#ffffff",
  "icon": "🚶",
  "targetType": "none",  // No target needed
  "conditions": [
    {
      "condition_ref": "companionship:actor-is-following"  // Update reference
    }
  ]
}
```

### Step 4: Update dismiss.action.json
Edit `data/mods/companionship/actions/dismiss.action.json`:

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "companionship:dismiss",  // Changed from "core:dismiss"
  "name": "Dismiss",
  "description": "Dismiss a follower",
  "category": "companionship",
  "backgroundColor": "#00695c",
  "textColor": "#e0f2f1",
  "hoverBackgroundColor": "#00897b",
  "hoverTextColor": "#ffffff",
  "icon": "👋",
  "targetType": "entity",
  "conditions": [
    {
      "condition_ref": "companionship:entity-is-following-actor"  // Update reference
    }
  ]
}
```

### Step 5: Validate Action Schemas
Run validation for all migrated actions:

```bash
npm run validate-action data/mods/companionship/actions/follow.action.json
npm run validate-action data/mods/companionship/actions/stop_following.action.json
npm run validate-action data/mods/companionship/actions/dismiss.action.json
```

### Step 6: Remove Original Files from Core
After confirming successful migration:

```bash
rm data/mods/core/actions/follow.action.json
rm data/mods/core/actions/stop_following.action.json
rm data/mods/core/actions/dismiss.action.json
```

### Step 7: Update Core Mod Manifest
Edit `data/mods/core/mod-manifest.json` to remove action references:

```json
{
  "actions": [
    // Remove these lines:
    // "core:follow",
    // "core:stop_following",
    // "core:dismiss",
    // ... keep other core actions
  ]
}
```

## Testing Requirements

### Validation Tests
1. Schema validation for each action:
   ```bash
   npm run validate-action data/mods/companionship/actions/*.action.json
   ```

2. Verify namespace updates:
   ```bash
   # Should return no results
   grep -r '"core:follow"' data/mods/companionship/
   grep -r '"core:stop_following"' data/mods/companionship/
   grep -r '"core:dismiss"' data/mods/companionship/
   ```

3. Verify color scheme updates:
   ```bash
   # Should find Deep Teal colors
   grep -r "#00695c" data/mods/companionship/actions/
   grep -r "#e0f2f1" data/mods/companionship/actions/
   ```

### Visual Tests
1. Actions should appear with Deep Teal color scheme in UI
2. Hover states should use the correct hover colors
3. Icons should display correctly

### Integration Tests
1. Action discovery system should find the migrated actions
2. Conditions referenced by actions should resolve correctly
3. Action execution should work (after full migration)

## Color Scheme Reference

### Before (Classic Blue-Grey)
```json
{
  "backgroundColor": "#455a64",
  "textColor": "#ffffff",
  "hoverBackgroundColor": "#37474f",
  "hoverTextColor": "#ffffff"
}
```

### After (Deep Teal)
```json
{
  "backgroundColor": "#00695c",
  "textColor": "#e0f2f1",
  "hoverBackgroundColor": "#00897b",
  "hoverTextColor": "#ffffff"
}
```

## Notes
- The category field is updated from "social" or "movement" to "companionship" for consistency
- Icons are preserved as they already convey the action purpose well
- Target types remain unchanged (entity for follow/dismiss, none for stop_following)
- Condition references must be updated to use companionship namespace

## Dependencies
- Blocks: COMMODMIG-004 (conditions referenced by actions)
- Blocked by: COMMODMIG-001, COMMODMIG-002

## Estimated Effort
- 1 hour

## Risk Assessment
- **Low Risk**: Actions are relatively standalone once references are updated
- **Visual Impact**: Color change will be immediately visible to users
- **Mitigation**: Test in development environment first

## Success Metrics
- All three action files exist in companionship mod
- Actions use Deep Teal color scheme
- All namespace references use `companionship:` prefix
- Actions validate against schema
- Actions appear correctly in UI with new colors