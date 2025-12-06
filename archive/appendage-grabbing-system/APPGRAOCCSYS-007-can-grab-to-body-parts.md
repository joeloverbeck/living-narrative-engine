# APPGRAOCCSYS-007: Add anatomy:can_grab Component to Body Part Entities

**Originating Document**: `brainstorming/appendage-grabbing-occupation-system.md`

## Summary

Add the `anatomy:can_grab` component to body part entity definitions that should be capable of grabbing/holding items. This includes hands, tentacles, and similar appendages. Each appendage starts with `locked: false` (available to grab items).

## Dependencies

- APPGRAOCCSYS-001 (anatomy:can_grab component schema must exist)

## Files to Modify

| File                                                                                 | Change                                                |
| ------------------------------------------------------------------------------------ | ----------------------------------------------------- |
| `data/mods/anatomy/entities/definitions/human_hand.entity.json`                      | Add `anatomy:can_grab` component                      |
| `data/mods/anatomy/entities/definitions/humanoid_hand_craftsman_stained.entity.json` | Add `anatomy:can_grab` component                      |
| `data/mods/anatomy/entities/definitions/humanoid_hand_scarred.entity.json`           | Add `anatomy:can_grab` component                      |
| `data/mods/anatomy/entities/definitions/eldritch_malformed_hand.entity.json`         | Add `anatomy:can_grab` component (gripStrength 0.7)   |
| `data/mods/anatomy/entities/definitions/tortoise_hand.entity.json`                   | Add `anatomy:can_grab` component (gripStrength 0.8)   |
| `data/mods/anatomy/entities/definitions/squid_tentacle.entity.json`                  | Add `anatomy:can_grab` component                      |
| `data/mods/anatomy/entities/definitions/kraken_tentacle.entity.json`                 | Add `anatomy:can_grab` component                      |
| `data/mods/anatomy/entities/definitions/octopus_tentacle.entity.json`                | Add `anatomy:can_grab` component                      |
| `data/mods/anatomy/entities/definitions/eldritch_tentacle_feeding.entity.json`       | Add `anatomy:can_grab` component                      |
| `data/mods/anatomy/entities/definitions/eldritch_tentacle_large.entity.json`         | Add `anatomy:can_grab` component                      |
| `data/mods/anatomy/entities/definitions/eldritch_tentacle_sensory.entity.json`       | Add `anatomy:can_grab` component (lower gripStrength) |

## Files NOT to Modify

These body parts cannot grab:

- `human_foot.entity.json` (feet cannot grab)
- `tortoise_foot.entity.json` (feet cannot grab)
- `spider_leg.entity.json` (spider legs are locomotion only)
- All torso, head, eye, hair, breast, leg, ear, etc. entities

## Out of Scope

- DO NOT create the component schema (handled in APPGRAOCCSYS-001)
- DO NOT modify weapon entity files (handled in APPGRAOCCSYS-008)
- DO NOT create operation handlers (handled in APPGRAOCCSYS-004/005)
- DO NOT create operators (handled in APPGRAOCCSYS-006)
- DO NOT create conditions (handled in APPGRAOCCSYS-009)
- DO NOT modify any action files

## Implementation Details

### Example: human_hand.entity.json (After)

```json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "anatomy:human_hand",
  "description": "A human hand",
  "components": {
    "anatomy:can_grab": {
      "gripStrength": 1.0,
      "heldItemId": null,
      "locked": false
    },
    "anatomy:part": {
      "subType": "hand"
    },
    "core:name": {
      "text": "hand"
    }
  }
}
```

### Example: squid_tentacle.entity.json (After)

```json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "anatomy:squid_tentacle",
  "description": "Common squid tentacle with medium size, long length and translucent-white coloring",
  "components": {
    "anatomy:can_grab": {
      "gripStrength": 0.8,
      "heldItemId": null,
      "locked": false
    },
    "anatomy:part": {
      "subType": "tentacle"
    },
    "core:name": {
      "text": "tentacle"
    },
    "descriptors:color_extended": {
      "color": "translucent-white"
    },
    "descriptors:length_category": {
      "length": "long"
    },
    "descriptors:shape_general": {
      "shape": "cylindrical"
    },
    "descriptors:size_category": {
      "size": "medium"
    },
    "descriptors:texture": {
      "texture": "suckered"
    }
  }
}
```

### Grip Strength Values

| Body Part Type                    | gripStrength | Rationale                          |
| --------------------------------- | ------------ | ---------------------------------- |
| Human hand                        | 1.0          | Standard baseline                  |
| Humanoid hand (craftsman/scarred) | 1.0          | Same as human hand                 |
| Eldritch malformed hand           | 0.7          | Deformed joints reduce precision   |
| Tortoise hand                     | 0.8          | Only 3 digits, less dexterity      |
| Squid tentacle                    | 0.8          | Flexible but less precise          |
| Octopus tentacle                  | 0.9          | Strong suckers                     |
| Kraken tentacle                   | 1.5          | Massive and powerful               |
| Eldritch tentacle (large)         | 1.2          | Otherworldly strength              |
| Eldritch tentacle (feeding)       | 0.6          | Designed for feeding, not gripping |
| Eldritch tentacle (sensory)       | 0.3          | Designed for sensing, weak grip    |

## Acceptance Criteria

### Tests That Must Pass

1. **Validation Tests**:
   - [ ] All modified entity files pass JSON schema validation
   - [ ] `npm run validate:mod:anatomy` passes
   - [ ] All entities have valid `anatomy:can_grab` component data

2. **Integration Tests**:
   - [ ] `npm run test:ci` passes
   - [ ] Modified entities can be loaded by entity loader
   - [ ] `countFreeGrabbingAppendages` returns correct counts for actors with these parts

3. **Existing Tests**: `npm run test:unit` should pass

### Invariants That Must Remain True

1. Existing component data in entity files is preserved
2. All `anatomy:can_grab` components start with `locked: false`
3. All `anatomy:can_grab` components start with `heldItemId: null`
4. Entity IDs and descriptions remain unchanged
5. JSON schema references are preserved
6. Alphabetical property ordering in JSON files is maintained

## Verification Commands

```bash
# Validate anatomy mod
npm run validate:mod:anatomy

# Run CI tests
npm run test:ci

# Validate specific entity files
npm run validate

# Run anatomy-related tests
npm run test:unit -- --testPathPattern="anatomy"
```

## Notes

- This ticket only adds `anatomy:can_grab` to existing body part definitions
- Future body part definitions may also need this component added
- The gripStrength values are initial estimates and can be adjusted based on gameplay testing
- Spider legs intentionally excluded as they are for locomotion, not manipulation
- Components should be alphabetically ordered in JSON files per project conventions

## Status

**COMPLETED** - 2025-01-25

## Outcome

### What Was Actually Changed vs Originally Planned

**Originally Planned (7 entities):**

- human_hand, squid_tentacle, kraken_tentacle, octopus_tentacle, eldritch_tentacle_feeding, eldritch_tentacle_large, eldritch_tentacle_sensory

**Actually Changed (11 entities):**
The original ticket was missing 4 hand entities that exist in the codebase:

- humanoid_hand_craftsman_stained.entity.json (gripStrength: 1.0)
- humanoid_hand_scarred.entity.json (gripStrength: 1.0)
- eldritch_malformed_hand.entity.json (gripStrength: 0.7)
- tortoise_hand.entity.json (gripStrength: 0.8)

**Ticket was corrected** before implementation to include these additional hand entities.

### Entity Files Modified

| File                                        | gripStrength | Notes                          |
| ------------------------------------------- | ------------ | ------------------------------ |
| human_hand.entity.json                      | 1.0          | Baseline                       |
| humanoid_hand_craftsman_stained.entity.json | 1.0          | Standard humanoid              |
| humanoid_hand_scarred.entity.json           | 1.0          | Standard humanoid              |
| eldritch_malformed_hand.entity.json         | 0.7          | Reduced due to deformed joints |
| tortoise_hand.entity.json                   | 0.8          | Reduced due to only 3 digits   |
| squid_tentacle.entity.json                  | 0.8          | Flexible but less precise      |
| octopus_tentacle.entity.json                | 0.9          | Strong suckers                 |
| kraken_tentacle.entity.json                 | 1.5          | Massive and powerful           |
| eldritch_tentacle_feeding.entity.json       | 0.6          | Designed for feeding           |
| eldritch_tentacle_large.entity.json         | 1.2          | Otherworldly strength          |
| eldritch_tentacle_sensory.entity.json       | 0.3          | Designed for sensing           |

### New Tests Created

| File                                                                  | Tests    | Rationale                                                                 |
| --------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------- |
| tests/integration/mods/anatomy/grabbableBodyParts.integration.test.js | 66 tests | Integration tests ensuring body parts have correct can_grab configuration |

**Test Coverage:**

- Hand entities have anatomy:can_grab component with correct gripStrength
- Tentacle entities have anatomy:can_grab component with correct gripStrength
- Non-grabbable body parts (feet, legs, arms, heads) do NOT have anatomy:can_grab
- Component invariants: locked=false, heldItemId=null, gripStrength >= 0
- Components are alphabetically ordered (per project conventions)
- Grip strength reasonableness checks (human baseline, kraken strongest, sensory weakest)

### Existing Tests Verified

- can_grab.component.test.js: 29 tests ✅
- grabbingUtils.test.js: 43 tests ✅
- hasFreeGrabbingAppendagesOperator.test.js: 36 tests ✅

### Validation

- `npm run validate` ✅
- All entity files pass JSON schema validation
