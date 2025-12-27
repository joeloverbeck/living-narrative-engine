# OXYDROSYS-022: Register hypoxia in status effects registry

**Status**: ✅ COMPLETED

## Description

Add hypoxia and anoxic unconsciousness to the status effects registry.

## Scope Correction

The original assumption that entries could simply be added to the registry was incorrect. The schema `status-effect.registry.schema.json` restricts `effectType` to an enum of 5 values: `["bleed", "burn", "poison", "fracture", "dismember"]`.

The scope was expanded to include:
1. Extending the schema with new effect types (`hypoxia`, `anoxic_unconsciousness`)
2. Adding corresponding defaults definitions
3. Then adding the registry entries

## Files to Create

- None

## Files to Modify

- `data/schemas/status-effect.registry.schema.json` - Add new effect types and defaults definitions
- `data/mods/anatomy/status-effects/status-effects.registry.json` - Add hypoxia entries

## Out of Scope

- UI display of status effects
- Status effect icons

## Acceptance Criteria

1. **Schema extended**: `hypoxia` and `anoxic_unconsciousness` added to effectType enum
2. **Hypoxia registered**: Entry for `breathing:hypoxic` with severity progression
3. **Unconscious registered**: Entry for `breathing:unconscious_anoxia` with brain damage timing
4. **Properties**: severity levels, turn thresholds, action penalties

## Tests That Must Pass

- `npm run validate` - Schema validation
- `tests/unit/schemas/statusEffectRegistry.schema.test.js` - Registry schema validation

## Invariants

- Existing status effects unchanged
- Follows registry format exactly
- Schema remains backward compatible

## Outcome

### Originally Planned
Simple addition of hypoxia entries to the status effects registry.

### Actual Changes
The scope was expanded because the original ticket assumption was incorrect. The implementation required:

1. **Schema Extension** (`data/schemas/status-effect.registry.schema.json`):
   - Added `hypoxia` and `anoxic_unconsciousness` to effectType enum
   - Created `hypoxiaSeverityEntry` definition for action penalties
   - Created `hypoxiaDefaults` definition with turnsToModerate/Severe/Unconscious and severity levels
   - Created `anoxicUnconsciousnessDefaults` definition with turnsToBrainDamage and brainDamagePerTurn
   - Added conditional validation rules in `allOf` array

2. **Registry Entries** (`data/mods/anatomy/status-effects/status-effects.registry.json`):
   - Added `hypoxic` effect (priority 5) with breathing:hypoxic componentId
   - Added `unconscious_anoxia` effect (priority 6) with breathing:unconscious_anoxia componentId
   - Updated `applyOrder` to include both new effects

3. **Dependency Declaration** (`data/mods/anatomy/mod-manifest.json`):
   - Added `breathing` as a dependency (since status effects reference breathing:* IDs)

4. **Tests Added** (`tests/unit/schemas/statusEffectRegistry.schema.test.js`):
   - 11 new tests for hypoxia and anoxic_unconsciousness effect types
   - Validation of required fields, rejection of invalid configurations
   - Verification that anatomy registry contains correct entries
   - Severity progression validation

### All Tests Pass
- `npm run validate`: 0 violations across 98 mods
- `tests/unit/schemas/statusEffectRegistry.schema.test.js`: 15/15 tests passing
