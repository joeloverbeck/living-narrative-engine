# OXYDROSYS-008: Create feline lung entities and integrate

## Status: COMPLETED ✓

## Description

Create feline-specific lung entities and integrate them with cat_girl blueprints.

## Corrected Scope

**Original assumptions were incorrect.** The ticket originally specified:
- Creating entities in `data/mods/breathing/entities/` ❌
- Modifying `breathing/mod-manifest.json` ❌

**Corrected locations:**
- Feline lung entities should be in `data/mods/anatomy-creatures/entities/definitions/` (following the pattern of creature-specific parts - human lungs are in `anatomy` mod)
- Manifest to modify: `anatomy-creatures/mod-manifest.json`
- Also need to add lung slots to `feline_core.part.json` (was missing - humanoid_core has them)

## Files to Create

- `data/mods/anatomy-creatures/entities/definitions/feline_lung_left.entity.json`
- `data/mods/anatomy-creatures/entities/definitions/feline_lung_right.entity.json`

## Files to Modify

- `data/mods/anatomy-creatures/mod-manifest.json` - Add lung entities to definitions
- `data/mods/anatomy-creatures/parts/feline_core.part.json` - Add lung slots (was missing)
- `data/mods/anatomy-creatures/recipes/cat_girl.recipe.json` - Add lung preferences

## Out of Scope

- Other creature types
- Feline-specific breathing behaviors (future enhancement)

## Acceptance Criteria

1. **Entities valid**: Feline lung entities pass schema validation
2. **Slightly different stats**: oxygenCapacity of 8 (vs human's 10)
3. **Part updated**: feline_core includes lung slots using humanoid_slots library
4. **Recipes updated**: cat_girl recipe specifies feline lung entities

## Tests That Must Pass

- `npm run validate` - Schema validation
- Integration test: Cat girl entity has respiratory organs

## Invariants

- All cat_girl variants get identical lung configuration
- No changes to non-feline creatures

## Outcome

**Completed on**: 2024-12-24

### Files Created/Modified

**New Files:**
- `data/mods/anatomy-creatures/entities/definitions/feline_lung_left.entity.json`
- `data/mods/anatomy-creatures/entities/definitions/feline_lung_right.entity.json`
- `tests/integration/mods/anatomy-creatures/felineLungIntegration.test.js` (19 tests)

**Modified Files:**
- `data/mods/anatomy-creatures/mod-manifest.json` - Added lung entities + breathing-states dependency
- `data/mods/anatomy-creatures/parts/feline_core.part.json` - Added left_lung and right_lung slots
- `data/mods/anatomy-creatures/recipes/cat_girl.recipe.json` - Added lung preferences

### Key Implementation Details

1. **Feline lung stats** (slightly smaller than human):
   - `oxygenCapacity`: 8 (vs human's 10)
   - `maxHealth`: 25 (vs human's 30)
   - `weight`: 0.5 (vs human's 0.6)

2. **Dependency fix**: Added `breathing-states` to anatomy-creatures dependencies (was missing and caused validation warning)

3. **Test coverage**: Created 19 tests covering:
   - Entity file existence and structure
   - Namespace and component validation
   - Part slot configuration
   - Recipe lung preferences
   - Manifest registration
   - Comparison with human lung stats

### Validation Results

- `npm run validate`: ✅ PASSED (0 violations)
- `npm run test:integration -- anatomy-creatures`: ✅ PASSED (276 tests)
- New integration tests: ✅ PASSED (19/19)
