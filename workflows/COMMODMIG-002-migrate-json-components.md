# COMMODMIG-002: Migrate JSON Components

## Overview
Migrate the following and leading component definitions from core mod to companionship mod, updating all namespace references to use the new `companionship:` prefix.

## Prerequisites
- COMMODMIG-001 (mod structure must exist)

## Acceptance Criteria
1. ✅ Both component files are moved to companionship mod
2. ✅ All namespace references updated from `core:` to `companionship:`
3. ✅ Component schemas validate successfully
4. ✅ Original files removed from core mod

## Implementation Steps

### Step 1: Copy Component Files
Copy the following files to their new locations:

```bash
cp data/mods/core/components/following.component.json data/mods/companionship/components/following.component.json
cp data/mods/core/components/leading.component.json data/mods/companionship/components/leading.component.json
```

### Step 2: Update following.component.json
Edit `data/mods/companionship/components/following.component.json`:

**Update the ID:**
```json
{
  "id": "companionship:following",  // Changed from "core:following"
  ...
}
```

**Verify/Update any internal references:**
- Check for any references to `core:leading` and update to `companionship:leading`
- Check for any condition references that need updating

### Step 3: Update leading.component.json
Edit `data/mods/companionship/components/leading.component.json`:

**Update the ID:**
```json
{
  "id": "companionship:leading",  // Changed from "core:leading"
  ...
}
```

**Update the dataSchema if it references following:**
If the schema contains any references to the following component, update them:
```json
{
  "dataSchema": {
    "type": "object",
    "properties": {
      "followers": {
        "type": "array",
        "items": {
          "type": "string",
          "description": "Entity IDs with companionship:following component"
        }
      }
    }
  }
}
```

### Step 4: Validate Component Schemas
Run validation for both migrated components:

```bash
npm run validate-component data/mods/companionship/components/following.component.json
npm run validate-component data/mods/companionship/components/leading.component.json
```

### Step 5: Remove Original Files from Core
After confirming the migration is successful:

```bash
rm data/mods/core/components/following.component.json
rm data/mods/core/components/leading.component.json
```

### Step 6: Update Core Mod Manifest
Edit `data/mods/core/mod-manifest.json` to remove the component references:

```json
{
  "components": [
    // Remove these lines:
    // "core:following",
    // "core:leading",
    // ... keep other core components
  ]
}
```

## Testing Requirements

### Unit Tests
1. Validate both component files against their schemas:
   ```bash
   npm run validate-component data/mods/companionship/components/following.component.json
   npm run validate-component data/mods/companionship/components/leading.component.json
   ```

2. Verify namespace updates are complete:
   ```bash
   # Should return no results
   grep -r "core:following" data/mods/companionship/
   grep -r "core:leading" data/mods/companionship/
   ```

3. Confirm original files are removed:
   ```bash
   # Should return "No such file"
   ls data/mods/core/components/following.component.json
   ls data/mods/core/components/leading.component.json
   ```

### Integration Tests
1. Ensure the component loader can find and load the migrated components
2. Verify that entities can still have these components attached (will be fully tested after JavaScript updates)

## Code Examples

### Example following.component.json After Migration
```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "companionship:following",
  "description": "Indicates this entity is following another entity",
  "dataSchema": {
    "type": "object",
    "properties": {
      "leaderId": {
        "type": "string",
        "description": "The entity ID of the leader being followed"
      },
      "followDistance": {
        "type": "number",
        "default": 1,
        "description": "Preferred following distance"
      }
    },
    "required": ["leaderId"]
  }
}
```

## Notes
- Component data structure remains unchanged, only namespaces are updated
- Any entities with existing following/leading components will need data migration (handled in a separate process)
- The component loader will need to be aware of the new namespace (handled in JavaScript update tickets)

## Dependencies
- Blocks: COMMODMIG-003, COMMODMIG-004, COMMODMIG-005 (other JSON migrations can proceed after components)
- Blocked by: COMMODMIG-001 (requires mod structure)

## Estimated Effort
- 1 hour

## Risk Assessment
- **Medium Risk**: Component references are used throughout the system
- **Mitigation**: Careful validation and systematic testing after each step
- **Recovery**: Git version control allows easy reversion if issues arise

## Success Metrics
- Both component files exist in companionship mod with correct namespaces
- Component schemas validate successfully
- No references to `core:following` or `core:leading` remain in companionship mod
- Core mod manifest no longer lists these components