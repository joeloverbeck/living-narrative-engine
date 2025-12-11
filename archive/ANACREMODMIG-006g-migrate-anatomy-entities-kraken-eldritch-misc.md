# ANACREMODMIG-006g: Migrate Kraken, Eldritch, and Misc Entity Definitions from anatomy Mod

**Status: ✅ COMPLETED**

## Summary
Move the 8 kraken/cephalopod, 15 eldritch, 1 horse, and 1 generic beak entity definition files (25 total) from `anatomy` to `anatomy-creatures` and update their IDs.

## Files to Touch

### Move - Kraken/Cephalopod Entities (8 files)
| From | To |
|------|-----|
| `data/mods/anatomy/entities/definitions/kraken_head.entity.json` | `data/mods/anatomy-creatures/entities/definitions/kraken_head.entity.json` |
| `data/mods/anatomy/entities/definitions/kraken_mantle.entity.json` | `data/mods/anatomy-creatures/entities/definitions/kraken_mantle.entity.json` |
| `data/mods/anatomy/entities/definitions/kraken_tentacle.entity.json` | `data/mods/anatomy-creatures/entities/definitions/kraken_tentacle.entity.json` |
| `data/mods/anatomy/entities/definitions/octopus_mantle.entity.json` | `data/mods/anatomy-creatures/entities/definitions/octopus_mantle.entity.json` |
| `data/mods/anatomy/entities/definitions/octopus_tentacle.entity.json` | `data/mods/anatomy-creatures/entities/definitions/octopus_tentacle.entity.json` |
| `data/mods/anatomy/entities/definitions/squid_mantle.entity.json` | `data/mods/anatomy-creatures/entities/definitions/squid_mantle.entity.json` |
| `data/mods/anatomy/entities/definitions/squid_tentacle.entity.json` | `data/mods/anatomy-creatures/entities/definitions/squid_tentacle.entity.json` |
| `data/mods/anatomy/entities/definitions/ink_reservoir.entity.json` | `data/mods/anatomy-creatures/entities/definitions/ink_reservoir.entity.json` |

### Move - Eldritch Entities (15 files)
| From | To |
|------|-----|
| `data/mods/anatomy/entities/definitions/eldritch_baleful_eye.entity.json` | `data/mods/anatomy-creatures/entities/definitions/eldritch_baleful_eye.entity.json` |
| `data/mods/anatomy/entities/definitions/eldritch_compound_eye_stalk.entity.json` | `data/mods/anatomy-creatures/entities/definitions/eldritch_compound_eye_stalk.entity.json` |
| `data/mods/anatomy/entities/definitions/eldritch_core_mass.entity.json` | `data/mods/anatomy-creatures/entities/definitions/eldritch_core_mass.entity.json` |
| `data/mods/anatomy/entities/definitions/eldritch_lamprey_mouth.entity.json` | `data/mods/anatomy-creatures/entities/definitions/eldritch_lamprey_mouth.entity.json` |
| `data/mods/anatomy/entities/definitions/eldritch_malformed_hand.entity.json` | `data/mods/anatomy-creatures/entities/definitions/eldritch_malformed_hand.entity.json` |
| `data/mods/anatomy/entities/definitions/eldritch_membrane_wing.entity.json` | `data/mods/anatomy-creatures/entities/definitions/eldritch_membrane_wing.entity.json` |
| `data/mods/anatomy/entities/definitions/eldritch_sensory_stalk.entity.json` | `data/mods/anatomy-creatures/entities/definitions/eldritch_sensory_stalk.entity.json` |
| `data/mods/anatomy/entities/definitions/eldritch_speaking_orifice.entity.json` | `data/mods/anatomy-creatures/entities/definitions/eldritch_speaking_orifice.entity.json` |
| `data/mods/anatomy/entities/definitions/eldritch_surface_eye.entity.json` | `data/mods/anatomy-creatures/entities/definitions/eldritch_surface_eye.entity.json` |
| `data/mods/anatomy/entities/definitions/eldritch_tentacle_feeding.entity.json` | `data/mods/anatomy-creatures/entities/definitions/eldritch_tentacle_feeding.entity.json` |
| `data/mods/anatomy/entities/definitions/eldritch_tentacle_large.entity.json` | `data/mods/anatomy-creatures/entities/definitions/eldritch_tentacle_large.entity.json` |
| `data/mods/anatomy/entities/definitions/eldritch_tentacle_sensory.entity.json` | `data/mods/anatomy-creatures/entities/definitions/eldritch_tentacle_sensory.entity.json` |
| `data/mods/anatomy/entities/definitions/eldritch_vertical_maw.entity.json` | `data/mods/anatomy-creatures/entities/definitions/eldritch_vertical_maw.entity.json` |
| `data/mods/anatomy/entities/definitions/eldritch_vestigial_arm.entity.json` | `data/mods/anatomy-creatures/entities/definitions/eldritch_vestigial_arm.entity.json` |
| `data/mods/anatomy/entities/definitions/eldritch_vocal_sac.entity.json` | `data/mods/anatomy-creatures/entities/definitions/eldritch_vocal_sac.entity.json` |

### Move - Misc Entities (2 files)
| From | To |
|------|-----|
| `data/mods/anatomy/entities/definitions/horse_tail.entity.json` | `data/mods/anatomy-creatures/entities/definitions/horse_tail.entity.json` |
| `data/mods/anatomy/entities/definitions/beak.entity.json` | `data/mods/anatomy-creatures/entities/definitions/beak.entity.json` |

### Modify
- All 25 moved entity files - Update `id` field in each
- `data/mods/anatomy-creatures/mod-manifest.json` - Add to entities.definitions content array

## ID Changes Required
All IDs change from `anatomy:*` to `anatomy-creatures:*`

Examples:
| Old ID | New ID |
|--------|--------|
| `anatomy:kraken_head` | `anatomy-creatures:kraken_head` |
| `anatomy:eldritch_baleful_eye` | `anatomy-creatures:eldritch_baleful_eye` |
| `anatomy:horse_tail` | `anatomy-creatures:horse_tail` |
| `anatomy:beak` | `anatomy-creatures:beak` |

## Out of Scope
- DO NOT modify `anatomy/mod-manifest.json` yet (ANACREMODMIG-010)
- DO NOT modify blueprints/recipes that reference these entities yet (ANACREMODMIG-006h)
- DO NOT modify test files yet (ANACREMODMIG-015)

## Acceptance Criteria

### Tests that must pass
- `npm run validate` passes
- `npm run typecheck` passes

### Invariants that must remain true
- Entity component structure is preserved exactly
- No component references are modified
- All 25 entities migrated
- New mod not yet loaded, so existing tests still pass

## Verification Commands
```bash
# Validate JSON structure
npm run validate

# Count entities
ls data/mods/anatomy-creatures/entities/definitions/kraken_*.entity.json data/mods/anatomy-creatures/entities/definitions/octopus_*.entity.json data/mods/anatomy-creatures/entities/definitions/squid_*.entity.json data/mods/anatomy-creatures/entities/definitions/ink_reservoir.entity.json 2>/dev/null | wc -l  # Should be 8

ls data/mods/anatomy-creatures/entities/definitions/eldritch_*.entity.json | wc -l  # Should be 15

ls data/mods/anatomy-creatures/entities/definitions/horse_tail.entity.json data/mods/anatomy-creatures/entities/definitions/beak.entity.json 2>/dev/null | wc -l  # Should be 2
```

## Dependencies
- ANACREMODMIG-001 (mod scaffold must exist)
- ANACREMODMIG-006a (structure templates should be migrated)

## Blocks
- ANACREMODMIG-006h (anatomy blueprints/recipes reference these entities)
- ANACREMODMIG-010 (anatomy manifest update)
- ANACREMODMIG-015 (beak test updates)

---

## Outcome

**Completed: 2025-12-11**

### What was actually changed vs originally planned

**As planned:**
- ✅ All 25 entity files migrated from `anatomy` to `anatomy-creatures`
- ✅ Entity IDs updated from `anatomy:*` to `anatomy-creatures:*`
- ✅ Component keys preserved (e.g., `anatomy:part`, `anatomy:part_health`, `core:weight` remain unchanged)
- ✅ `mod-manifest.json` updated with 25 new entities (total 91 entities now registered)
- ✅ `npm run validate` passes
- ✅ All existing tests pass

**Additional work (beyond ticket scope):**
- Created new integration test: `tests/integration/mods/anatomy-creatures/krakenEldritchMiscEntitiesLoading.test.js`
  - 87 test cases validating:
    - All 25 files exist
    - Correct namespace IDs (`anatomy-creatures:*`)
    - Required components (`anatomy:part`, `anatomy:part_health`, `core:weight`)
    - Specific validations for beak (damage capabilities) and misc entities (subTypes)
    - Manifest contains all 25 entities with correct count (91 total)

### New/Modified Tests

| File | Description | Rationale |
|------|-------------|-----------|
| `tests/integration/mods/anatomy-creatures/krakenEldritchMiscEntitiesLoading.test.js` | 87 tests validating entity migration | Ensures migrated entities have correct namespace IDs while preserving component references to parent `anatomy` mod |

### Test Results
- All anatomy-creatures integration tests: **122 passed**
- New krakenEldritchMiscEntitiesLoading tests: **87 passed**
- Validation: **PASSED** (0 cross-reference violations)
