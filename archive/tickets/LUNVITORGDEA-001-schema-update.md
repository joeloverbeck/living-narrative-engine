# LUNVITORGDEA-001: Schema Update - Add requiresAllDestroyed to vital_organ

## Summary

Add the `requiresAllDestroyed` boolean property and `respiratory` organType to the `anatomy:vital_organ` component schema.

## File List

### Files to Modify
- `data/mods/anatomy/components/vital_organ.component.json`

## Out of Scope

- DO NOT modify any entity files (lung, heart, brain, spine)
- DO NOT modify any service files (deathCheckService, etc.)
- DO NOT add any new component files
- DO NOT modify test files

## Implementation Details

### Schema Changes

Update `data/mods/anatomy/components/vital_organ.component.json`:

1. Add `"respiratory"` to the `organType` enum:
   ```json
   "organType": {
     "type": "string",
     "enum": ["brain", "heart", "spine", "respiratory"],
     "description": "Category of vital organ for narrative purposes"
   }
   ```

2. Add `requiresAllDestroyed` property:
   ```json
   "requiresAllDestroyed": {
     "type": "boolean",
     "description": "When true, ALL organs of this type must be destroyed for death (e.g., lungs). When false (default), destroying ANY organ of this type causes death.",
     "default": false
   }
   ```

### Full Schema After Changes

```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "anatomy:vital_organ",
  "description": "Marks a body part as vital for survival. Destruction can trigger immediate death.",
  "dataSchema": {
    "type": "object",
    "properties": {
      "organType": {
        "type": "string",
        "enum": ["brain", "heart", "spine", "respiratory"],
        "description": "Category of vital organ for narrative purposes"
      },
      "killOnDestroy": {
        "type": "boolean",
        "description": "Whether destroying this organ causes immediate death",
        "default": true
      },
      "requiresAllDestroyed": {
        "type": "boolean",
        "description": "When true, ALL organs of this type must be destroyed for death (e.g., lungs). When false (default), destroying ANY organ of this type causes death.",
        "default": false
      },
      "deathMessage": {
        "type": "string",
        "description": "Custom death message when this organ is destroyed (optional)"
      },
      "healthCapThreshold": {
        "type": "number",
        "description": "When organ health percentage falls below this threshold, apply overall health cap",
        "minimum": 0,
        "maximum": 100,
        "default": 20
      },
      "healthCapValue": {
        "type": "number",
        "description": "Maximum overall health percentage when organ is critically damaged",
        "minimum": 0,
        "maximum": 100,
        "default": 30
      }
    },
    "required": ["organType"],
    "additionalProperties": false
  }
}
```

## Acceptance Criteria

### Tests That Must Pass
- `npm run validate` - Schema validation must pass
- `npm run validate:mod:anatomy` - Anatomy mod validation must pass
- Existing entity definitions using vital_organ must remain valid (backward compatible)

### Invariants That Must Remain True
1. Existing entities (human_heart, human_brain, human_spine) continue to validate without changes
2. The `organType` enum still includes "brain", "heart", "spine"
3. Default value for `requiresAllDestroyed` is `false` (preserves existing behavior)
4. No breaking changes to existing vital_organ component usage

## Verification Commands

```bash
# Validate schema
npm run validate

# Validate anatomy mod
npm run validate:mod:anatomy

# Verify existing entities still valid
node -e "const fs=require('fs'); const data=JSON.parse(fs.readFileSync('data/mods/anatomy/entities/definitions/human_heart.entity.json')); console.log('heart valid:', !!data.components['anatomy:vital_organ'])"
```

## Estimated Diff Size

~10 lines added/modified in a single file.
