# APPGRAOCCSYS-007: Add anatomy:can_grab Component to Body Part Entities

**Originating Document**: `brainstorming/appendage-grabbing-occupation-system.md`

## Summary

Add the `anatomy:can_grab` component to body part entity definitions that should be capable of grabbing/holding items. This includes hands, tentacles, and similar appendages. Each appendage starts with `locked: false` (available to grab items).

## Dependencies

- APPGRAOCCSYS-001 (anatomy:can_grab component schema must exist)

## Files to Modify

| File | Change |
|------|--------|
| `data/mods/anatomy/entities/definitions/human_hand.entity.json` | Add `anatomy:can_grab` component |
| `data/mods/anatomy/entities/definitions/squid_tentacle.entity.json` | Add `anatomy:can_grab` component |
| `data/mods/anatomy/entities/definitions/kraken_tentacle.entity.json` | Add `anatomy:can_grab` component |
| `data/mods/anatomy/entities/definitions/octopus_tentacle.entity.json` | Add `anatomy:can_grab` component |
| `data/mods/anatomy/entities/definitions/eldritch_tentacle_feeding.entity.json` | Add `anatomy:can_grab` component |
| `data/mods/anatomy/entities/definitions/eldritch_tentacle_large.entity.json` | Add `anatomy:can_grab` component |
| `data/mods/anatomy/entities/definitions/eldritch_tentacle_sensory.entity.json` | Add `anatomy:can_grab` component (lower gripStrength) |

## Files NOT to Modify

These body parts cannot grab:
- `human_foot.entity.json` (feet cannot grab)
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
    "anatomy:part": {
      "subType": "hand"
    },
    "core:name": {
      "text": "hand"
    },
    "anatomy:can_grab": {
      "locked": false,
      "heldItemId": null,
      "gripStrength": 1.0
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
    "anatomy:part": {
      "subType": "tentacle"
    },
    "core:name": {
      "text": "tentacle"
    },
    "descriptors:size_category": {
      "size": "medium"
    },
    "descriptors:length_category": {
      "length": "long"
    },
    "descriptors:texture": {
      "texture": "suckered"
    },
    "descriptors:color_extended": {
      "color": "translucent-white"
    },
    "descriptors:shape_general": {
      "shape": "cylindrical"
    },
    "anatomy:can_grab": {
      "locked": false,
      "heldItemId": null,
      "gripStrength": 0.8
    }
  }
}
```

### Grip Strength Values

| Body Part Type | gripStrength | Rationale |
|---------------|--------------|-----------|
| Human hand | 1.0 | Standard baseline |
| Squid tentacle | 0.8 | Flexible but less precise |
| Octopus tentacle | 0.9 | Strong suckers |
| Kraken tentacle | 1.5 | Massive and powerful |
| Eldritch tentacle (large) | 1.2 | Otherworldly strength |
| Eldritch tentacle (feeding) | 0.6 | Designed for feeding, not gripping |
| Eldritch tentacle (sensory) | 0.3 | Designed for sensing, weak grip |

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
