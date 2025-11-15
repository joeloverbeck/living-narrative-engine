# RECVALREF-015: Create Recipe Validation Regression Comparison Suite

**Phase:** Migration Strategy
**Priority:** P0 - Critical
**Estimated Effort:** 6 hours
**Dependencies:** RECVALREF-014

## Context

`scripts/validate-recipe-v2.js` already routes the public CLI through the refactored `RecipePreflightValidator`
(`src/anatomy/validation/RecipePreflightValidator.js`). There is no longer a runnable legacy entry point to compare against, so
we need a regression-oriented "comparison" suite that locks in the new pipeline's behaviour. The suite must:

- Prove that the CLI wiring, the validator pipeline (component existence → recipe usage), and the runtime enforcement described
  in `docs/anatomy/anatomy-system-guide.md` stay in sync.
- Guard against regressions when we toggle validator configuration, add new matchers, or adjust the CLI output format.
- Preserve the improved report structure (per-check `passed` entries, `suggestions`, CLI summary stats) instead of forcing the
  simplified legacy output.

## Objectives

1. Capture baseline validation results for canonical recipes using the production CLI runner and the in-process validator.
2. Exercise every pre-flight check documented in the anatomy system guide (component existence, property schemas, descriptor
   coverage, blueprint + socket compatibility, pattern resolution, part availability, generated slot coverage, load failures,
   recipe usage hints).
3. Verify that `executeRecipeValidation` (from `scripts/validate-recipe-v2.js`) and a directly-instantiated
   `RecipePreflightValidator` return equivalent `ValidationReport` payloads (errors, warnings, suggestions, metadata) for the
   same recipe inputs and configuration overrides.
4. Confirm that runtime safeguards (`validateRecipeSlots`, `GraphIntegrityValidator`) agree with the pre-flight pipeline on the
   "invalid" fixtures so we do not ship divergent behaviour.

## Implementation

### Test Location
- Create `tests/regression/anatomy/recipeValidationComparison.regression.test.js` (regression suites are documented in
  `docs/anatomy/anatomy-testing-guide.md`).
- Use the regression harness (`npm run test:single -- --runTestsByPath tests/regression/anatomy/recipeValidationComparison.regression.test.js`).

### Fixtures & Utilities
- Reuse real recipes from `data/mods/anatomy/recipes/` (e.g., `human_male.recipe.json`, `giant_forest_spider.recipe.json`,
  `centaur_warrior.recipe.json`) for "valid" parity coverage.
- Add two synthetic fixtures under `tests/common/anatomy/fixtures/validation/`:
  - `missing_components.recipe.json` – references non-existent components to trigger component/schema errors.
  - `broken_patterns.recipe.json` – blueprint mismatch (missing slots), socket conflicts, and a `matchesGroup` that resolves to
    zero slots to cover descriptor, pattern, part availability, generated slot, and recipe usage warnings.
- Use `tests/common/anatomy/anatomyIntegrationTestBed.js` to run the runtime generation pipeline when verifying Stage 3/4
  enforcement. The test bed already loads the same mods cited in the anatomy system guide.

### Comparison Mechanics
1. Load recipes with the same configuration the CLI uses: build the DI container via `configureMinimalContainer` and
   `ConfigurationLoader` so the validator sees real slot generators and entity matcher services.
2. Call `executeRecipeValidation([...paths], options, runtimeOverrides)` with `exitOnCompletion: false` so the test can capture
   `results` without spawning a child process. Capture the produced `ValidationReport` instances.
3. Instantiate `RecipePreflightValidator` directly using the same registry/container and call `.validate(recipe, opts)`; compare
   `.toJSON()` output with the CLI's JSON for each scenario (ignore timestamp fields by normalizing the payload before
   assertions).
4. For invalid fixtures, run `BodyBlueprintFactory.createAnatomyGraph()` (through `AnatomyIntegrationTestBed`) and assert that
   the runtime path either throws the same validation error (`validateRecipeSlots`) or that the resulting `GraphIntegrityValidator`
   report contains the same offending slot/socket identifiers.
5. Record Jest snapshots for the normalized reports so future refactors can adjust expectations deliberately. Provide helper
   utilities inside the test (e.g., `stripTimestamps(report)`) to keep snapshots stable.

### Scenarios to Cover
| Scenario | Recipe | Expected Outcome |
| --- | --- | --- |
| Valid humanoid | `human_male.recipe.json` | CLI + validator both mark valid; `passed` contains all 11 checks. |
| Valid non-humanoid | `giant_forest_spider.recipe.json` | Confirms template-driven slots keep parity. |
| Missing component schema | `missing_components` fixture | Produces component + property schema errors; runtime generation also fails. |
| Blueprint/socket mismatch | `broken_patterns` fixture | Records descriptor coverage, pattern warnings, socket incompatibility errors. |
| Part availability gaps | `broken_patterns` fixture | Flags missing entity definitions and generated slot coverage. |
| Recipe usage hint | Valid recipe not referenced by any entity fixture (e.g., clone an existing recipe under a new ID) |
| Load failure propagation | Simulate `loadFailures` map with a mocked entity matcher service to prove CLI + validator emit the
  same error entries. |

## Acceptance Criteria
- [ ] Regression suite exists under `tests/regression/anatomy/` and imports `executeRecipeValidation` plus
      `RecipePreflightValidator`.
- [ ] At least one scenario per validator check is covered, using the fixtures described above.
- [ ] CLI runner results and direct validator results are compared after normalizing timestamps/ordering, and differences cause
      the test to fail with actionable diffs.
- [ ] Runtime pipeline assertions prove that invalid fixtures also fail during graph construction, preventing CLI/runtime drift.
- [ ] Jest snapshots (or explicit object comparisons) document the canonical output format for valid vs invalid recipes.

## Gate Requirement

**Migration cannot proceed to beta (RECVALREF-016) until the regression comparison suite locks in the new validator + CLI
outputs for the scenarios above.**

## References
- `tickets/RECVALREF-000-refactoring-overview.md` – migration plan + comparison requirement.
- `docs/anatomy/anatomy-system-guide.md` – outlines the validator pipeline and runtime safeguards.
- `docs/anatomy/anatomy-testing-guide.md` – describes regression suite conventions and available test beds.
