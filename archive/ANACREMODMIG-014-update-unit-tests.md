# ANACREMODMIG-014: Update Unit Tests

**Status**: COMPLETED

## Summary
Update unit test files that reference creature blueprints, recipes, and entities to use the new `anatomy-creatures:` namespace and correct file paths.

## Reassessment Notes (2025-12-11)

### Corrected Assumptions

1. **File Path Changes Required**: The original ticket assumed only ID references needed updating. In reality, `chicken.blueprint.test.js`, `chicken.recipe.test.js`, and `beakDamageCapabilities.test.js` use direct file path imports (via `fs.readFileSync` or ES imports) that also need path updates.

2. **bodyBlueprintFactory.v2.test.js Excluded**: This file uses **mock/synthetic** IDs like `anatomy:centaur_v2`, `anatomy:centaur_body` for internal logic testing. These are arbitrary test values, not actual creature references. Per the ticket's own scope: "DO NOT modify test logic, only ID references" - these are test logic fixtures, not real creature references.

3. **Additional Files with creature refs are Mock Data**: Files like `socketSlotCompatibilityValidator.test.js`, `SocketNameTplValidator.test.js`, `anatomy.recipe.schema.test.js`, and `anatomyRecipeSchema.test.js` also use mock/synthetic creature-like IDs for internal validation testing. These are OUT OF SCOPE per the same reasoning.

## Files to Touch

### Modify
- `tests/unit/anatomy/chicken.blueprint.test.js` - Path + ID changes
- `tests/unit/anatomy/chicken.recipe.test.js` - Path + ID changes
- `tests/unit/mods/anatomy/entities/beakDamageCapabilities.test.js` - Import path + comment changes

### Excluded (Mock Data - Out of Scope)
- `tests/unit/anatomy/bodyBlueprintFactory.v2.test.js` - Uses synthetic test IDs
- `tests/unit/anatomy/validation/socketSlotCompatibilityValidator.test.js` - Mock entity definitions
- `tests/unit/anatomy/validation/validators/SocketNameTplValidator.test.js` - Mock entity definitions
- `tests/unit/schemas/anatomy.recipe.schema.test.js` - Schema validation synthetic data
- `tests/unit/validation/anatomyRecipeSchema.test.js` - Schema validation synthetic data

## Changes Required

### chicken.blueprint.test.js
| Type | Old | New |
|------|-----|-----|
| Path | `data/mods/anatomy/blueprints/rooster.blueprint.json` | `data/mods/anatomy-creatures/blueprints/rooster.blueprint.json` |
| Path | `data/mods/anatomy/blueprints/hen.blueprint.json` | `data/mods/anatomy-creatures/blueprints/hen.blueprint.json` |
| ID | `anatomy:rooster` | `anatomy-creatures:rooster` |
| ID | `anatomy:hen` | `anatomy-creatures:hen` |
| ID | `anatomy:chicken_torso` | `anatomy-creatures:chicken_torso` |

### chicken.recipe.test.js
| Type | Old | New |
|------|-----|-----|
| Path | `data/mods/anatomy/recipes/rooster.recipe.json` | `data/mods/anatomy-creatures/recipes/rooster.recipe.json` |
| Path | `data/mods/anatomy/recipes/hen.recipe.json` | `data/mods/anatomy-creatures/recipes/hen.recipe.json` |
| Path | `data/mods/anatomy/blueprints/rooster.blueprint.json` | `data/mods/anatomy-creatures/blueprints/rooster.blueprint.json` |
| Path | `data/mods/anatomy/blueprints/hen.blueprint.json` | `data/mods/anatomy-creatures/blueprints/hen.blueprint.json` |
| ID | `anatomy:rooster` | `anatomy-creatures:rooster` |
| ID | `anatomy:hen` | `anatomy-creatures:hen` |
| ID | `anatomy:chicken_comb` | `anatomy-creatures:chicken_comb` |
| ID | `anatomy:chicken_wattle` | `anatomy-creatures:chicken_wattle` |
| ID | `anatomy:chicken_tail` | `anatomy-creatures:chicken_tail` |
| ID | `anatomy:chicken_spur` | `anatomy-creatures:chicken_spur` |

### beakDamageCapabilities.test.js
| Type | Old | New |
|------|-----|-----|
| Import | `data/mods/anatomy/entities/definitions/beak.entity.json` | `data/mods/anatomy-creatures/entities/definitions/beak.entity.json` |
| Import | `data/mods/anatomy/entities/definitions/chicken_beak.entity.json` | `data/mods/anatomy-creatures/entities/definitions/chicken_beak.entity.json` |
| Import | `data/mods/anatomy/entities/definitions/tortoise_beak.entity.json` | `data/mods/anatomy-creatures/entities/definitions/tortoise_beak.entity.json` |
| Comment | `anatomy:beak` | `anatomy-creatures:beak` |
| Comment | `anatomy:chicken_beak` | `anatomy-creatures:chicken_beak` |
| Comment | `anatomy:tortoise_beak` | `anatomy-creatures:tortoise_beak` |

## Out of Scope
- DO NOT update references to `anatomy:human_*` - those stay in anatomy
- DO NOT modify test logic, only ID/path references
- DO NOT rename or move test files
- DO NOT update integration tests (separate ticket ANACREMODMIG-013)
- DO NOT update mock/synthetic IDs in validation test files (they're arbitrary test values)

## Acceptance Criteria

### Tests that must pass
- `npm run test:unit -- --testPathPattern="chicken.blueprint|chicken.recipe|beakDamageCapabilities"` passes
- All unit tests for creature anatomy pass

### Invariants that must remain true
- Test assertions remain the same
- Human anatomy test references unchanged
- Test file locations unchanged
- Test mocking patterns unchanged
- Mock data in validation tests unchanged

## Verification Commands
```bash
# Run affected unit tests
npm run test:unit -- --testPathPattern="chicken.blueprint|chicken.recipe|beakDamageCapabilities"

# Verify no old creature refs in modified files
grep -r "anatomy:chicken\|anatomy:hen\|anatomy:rooster\|anatomy:beak" tests/unit/anatomy/chicken*.test.js tests/unit/mods/anatomy/entities/beakDamageCapabilities.test.js && echo "ERROR: Old refs found" || echo "OK"

# Verify refs updated
grep -r "anatomy-creatures:" tests/unit/anatomy/chicken*.test.js
grep -r "anatomy-creatures:" tests/unit/mods/anatomy/entities/beakDamageCapabilities.test.js
```

## Dependencies
- ANACREMODMIG-006f (chicken entities migrated) - COMPLETED
- ANACREMODMIG-006g (beak entity migrated) - COMPLETED
- ANACREMODMIG-006h (blueprints/recipes migrated) - Files exist in anatomy-creatures

## Blocks
- ANACREMODMIG-016 (final test validation)

## Outcome (2025-12-11)

### Summary
Successfully updated all 3 unit test files to use the new `anatomy-creatures:` namespace and correct file paths.

### Files Modified
1. **`tests/unit/anatomy/chicken.blueprint.test.js`**
   - Updated 2 file paths from `data/mods/anatomy/blueprints/` to `data/mods/anatomy-creatures/blueprints/`
   - Updated 4 expected IDs from `anatomy:*` to `anatomy-creatures:*`

2. **`tests/unit/anatomy/chicken.recipe.test.js`**
   - Updated 4 file paths from `data/mods/anatomy/` to `data/mods/anatomy-creatures/`
   - Updated 15 expected IDs from `anatomy:*` to `anatomy-creatures:*`
   - Updated 1 JSDoc comment with creature references

3. **`tests/unit/mods/anatomy/entities/beakDamageCapabilities.test.js`**
   - Updated 3 @see JSDoc references
   - Updated 3 import paths from `data/mods/anatomy/` to `data/mods/anatomy-creatures/`
   - Updated 3 describe block comments with entity IDs

### Test Results
- **95 tests passed** across all 3 test suites
- All verification commands confirmed no old references remain
- All new `anatomy-creatures:` references are in place

### Files Excluded (Correctly)
The following files were correctly excluded per the reassessment:
- `bodyBlueprintFactory.v2.test.js` - Mock data with synthetic IDs
- `socketSlotCompatibilityValidator.test.js` - Mock entity definitions
- `SocketNameTplValidator.test.js` - Mock entity definitions
- `anatomy.recipe.schema.test.js` - Schema validation synthetic data
- `anatomyRecipeSchema.test.js` - Schema validation synthetic data

### No New Tests Required
All existing tests already provide comprehensive coverage for the migrated creature anatomy functionality. The changes were purely namespace/path updates with no logic modifications.
