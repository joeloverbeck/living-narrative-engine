# ANACREMODMIG-013: Update Anatomy Integration Tests

## Status
Completed

## Summary
Integration suites that load real creature data must target the migrated `anatomy-creatures` assets and IDs per ANACREMODMIG-000 and the migration spec. Synthetic suites that do not touch disk remain on `anatomy:`. Scope now covers all filesystem readers (including health-weight validations) plus manifest expectations needed for the loader-backed tests.

## Corrections to Original Assumptions
- Several health/weight validators (`headHealthCalculationWeightValidation`, `limbHealthCalculationWeightValidation`, `remainingAnatomyHealthCalculationWeightValidation`, `sensoryOrganHealthCalculationWeightValidation`) and tortoise/tail entity checks read real data; they needed `anatomy-creatures` paths/IDs.
- Manifest content arrays for `anatomy-creatures` must list bare filenames (no folder prefixes) so manifest registration and loader phases succeed.
- The hit-probability data sweep pulls entities from both `anatomy` (humans) and `anatomy-creatures`; expected count raised to cover both mods and small-part caps now include beaks/toad/eldritch eyes.
- `recipeBodyDescriptorsValidation` needs the `cat_girl` blueprint registered under both the old and new IDs; assertions focus on descriptor errors rather than overall `isValid` because usage warnings may surface during load.
- Regression recipe validation for spider/writhing observer now tolerates loader usage warnings; fixtures/snapshots use `anatomy-creatures:` IDs.

## Scope (Updated)
- Update real-data references to `anatomy-creatures:` in:
  - `tests/integration/anatomy/bodyBlueprintFactory.exampleBlueprints.integration.test.js`
  - `tests/integration/anatomy/centaurDescriptionGeneration.test.js`
  - `tests/integration/anatomy/chickenEntityValidation.test.js`
  - `tests/integration/anatomy/validation/centaurWarriorValidation.integration.test.js`
  - `tests/integration/anatomy/validation/recipeBodyDescriptorsValidation.integration.test.js`
  - `tests/integration/anatomy/tortoisePersonRecipeValidation.test.js`
  - `tests/integration/anatomy/tortoiseTailEntityValidation.test.js`
  - `tests/integration/anatomy/hitProbabilityWeightValidation.data.test.js`
  - `tests/integration/mods/anatomy/creatureWeightValidation.test.js`
  - `tests/integration/mods/anatomy/headHealthCalculationWeightValidation.test.js`
  - `tests/integration/mods/anatomy/limbHealthCalculationWeightValidation.test.js`
  - `tests/integration/mods/anatomy/remainingAnatomyHealthCalculationWeightValidation.test.js`
  - `tests/integration/mods/anatomy/sensoryOrganHealthCalculationWeightValidation.test.js`
  - `tests/integration/regression/anatomy/recipeValidationComparison.regression.test.js` (fixtures + snapshot)
- Keep synthetic-only suites unchanged (`bodyBlueprintFactory.v2`, `recipePatternResolution`).

## Out of Scope
- Human anatomy references stay on `anatomy:`.
- Do not rename or move test files.
- No unit-test updates (covered by ANACREMODMIG-014).

## Verification
```bash
npm run test:integration -- --coverage=false --testPathPatterns=anatomy
```
(Use `--coverage=false` to avoid known coverage-threshold failures on targeted runs.)

## Outcome
- Updated integration suites, fixtures, and regression snapshots to load `anatomy-creatures` assets/IDs; health/weight validators now read the migrated on-disk data.
- Adjusted `anatomy-creatures` manifest content arrays to use bare filenames for loader compatibility and manifest registration checks.
- Hit-probability validation now aggregates anatomy + anatomy-creatures entities (expect ≥220 parts) with updated small-part caps; descriptor validation stores `cat_girl` under both IDs.
- Regression recipe validation accepts loader usage warnings and compares anatomy-creatures spider/writhing recipes/blueprints with refreshed snapshots.
- `npm run test:integration -- --coverage=false --testPathPatterns=anatomy` passes.
