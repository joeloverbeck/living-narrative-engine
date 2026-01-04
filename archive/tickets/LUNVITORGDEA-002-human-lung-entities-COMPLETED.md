# LUNVITORGDEA-002: Add vital_organ Component to Human Lung Entities

## Summary

Add the `anatomy:vital_organ` component to both human lung entity definitions with collective death semantics (`requiresAllDestroyed: true`).

## Dependencies

- LUNVITORGDEA-001 (Schema must include `requiresAllDestroyed` and `respiratory` organType)

## File List

### Files to Modify
- `data/mods/anatomy/entities/definitions/human_lung_left.entity.json`
- `data/mods/anatomy/entities/definitions/human_lung_right.entity.json`

## Out of Scope

- DO NOT modify the vital_organ component schema (done in 001)
- DO NOT modify deathCheckService.js (done in 003)
- DO NOT modify any creature lung entities (done in 008)
- DO NOT add any new entity files
- Avoid nonessential test coverage changes; only update tests required to reflect the new component

## Implementation Details

### human_lung_left.entity.json Changes

Add `anatomy:vital_organ` component to the existing components:

```json
"anatomy:vital_organ": {
  "organType": "respiratory",
  "killOnDestroy": true,
  "requiresAllDestroyed": true,
  "deathMessage": "suffocated as both lungs failed"
}
```

### human_lung_right.entity.json Changes

Add identical `anatomy:vital_organ` component:

```json
"anatomy:vital_organ": {
  "organType": "respiratory",
  "killOnDestroy": true,
  "requiresAllDestroyed": true,
  "deathMessage": "suffocated as both lungs failed"
}
```

### Full Entity Structure After Changes (left lung example)

```json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "anatomy:human_lung_left",
  "description": "A human left lung - respiratory organ for oxygen storage",
  "components": {
    "core:name": {
      "text": "left lung"
    },
    "core:weight": {
      "weight": 0.6
    },
    "anatomy:part": {
      "subType": "lung",
      "orientation": "left",
      "hit_probability_weight": 0,
      "health_calculation_weight": 3
    },
    "anatomy:part_health": {
      "currentHealth": 30,
      "maxHealth": 30,
      "state": "healthy"
    },
    "breathing-states:respiratory_organ": {
      "respirationType": "pulmonary",
      "oxygenCapacity": 10,
      "currentOxygen": 10
    },
    "anatomy:vital_organ": {
      "organType": "respiratory",
      "killOnDestroy": true,
      "requiresAllDestroyed": true,
      "deathMessage": "suffocated as both lungs failed"
    }
  }
}
```

## Acceptance Criteria

### Tests That Must Pass
- `npm run validate` - Entity validation must pass
- `npm run validate:mod -- anatomy` - Anatomy mod validation must pass
- `npm run test:unit -- --runTestsByPath tests/unit/mods/anatomy/entities/humanLungEntities.test.js --runInBand` - Lung entity unit tests pass

### Invariants That Must Remain True
1. Both lung entities must have identical vital_organ configurations
2. `requiresAllDestroyed` must be `true` for both lungs
3. `organType` must be `"respiratory"` for both lungs
4. Existing `respiratory_organ` component must remain unchanged
5. Existing `anatomy:part` and `anatomy:part_health` must remain unchanged

## Verification Commands

```bash
# Validate entities
npm run validate

# Validate anatomy mod specifically
npm run validate:mod -- anatomy

# Verify both entities have vital_organ
node -e "
const fs = require('fs');
const left = JSON.parse(fs.readFileSync('data/mods/anatomy/entities/definitions/human_lung_left.entity.json'));
const right = JSON.parse(fs.readFileSync('data/mods/anatomy/entities/definitions/human_lung_right.entity.json'));
console.log('Left lung vital_organ:', !!left.components['anatomy:vital_organ']);
console.log('Right lung vital_organ:', !!right.components['anatomy:vital_organ']);
console.log('Both requiresAllDestroyed:',
  left.components['anatomy:vital_organ']?.requiresAllDestroyed === true &&
  right.components['anatomy:vital_organ']?.requiresAllDestroyed === true);
"
```

## Estimated Diff Size

~15 lines added across 2 files.

## Status

Completed.

## Outcome

Added `anatomy:vital_organ` to both human lung entities and updated the lung entity unit tests to validate the new component; adjusted validation commands and schema references to match the current repository layout.
