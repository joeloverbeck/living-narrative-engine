# RECVALREF-011-10: Integrate Validators and Refactor RecipePreflightValidator

**Parent Ticket:** RECVALREF-011-refactor-validators-to-standalone-CORRECTED.md
**Priority:** P0 (Critical - Integration)
**Estimated Effort:** 3 hours
**Complexity:** Medium-High

## Objective

Integrate the nine standalone validators that live under `src/anatomy/validation/validators/` into `RecipePreflightValidator`,
replace the remaining inline orchestration in `src/anatomy/validation/RecipePreflightValidator.js` with the shared validator
stack, and reduce the file to <500 lines without breaking existing entry points.

## Background

`docs/anatomy/anatomy-system-guide.md` documents the current validation pipeline: the production orchestrator runs eleven
checks inline inside `RecipePreflightValidator` (component existence through recipe usage) and still weighs in at ~1,000 lines.
`tickets/RECVALREF-000-refactoring-overview.md` confirms this is the "god class" that blocks downstream refactors. The new
validator classes (BlueprintExistenceValidator, RecipeBodyDescriptorValidator, SocketSlotCompatibilityValidator,
PartAvailabilityValidator, GeneratedSlotPartsValidator, PatternMatchingValidator, DescriptorCoverageValidator,
RecipeUsageValidator, LoadFailureValidator) already exist but are not wired into the orchestrator or DI container. Load failure
handling is still done via an inline method even though the standalone validator ships in production.

## Prerequisites

**All sub-tickets must be completed:**
- [x] RECVALREF-011-01: RecipeUsageValidator
- [x] RECVALREF-011-02: DescriptorCoverageValidator
- [x] RECVALREF-011-03: BlueprintExistenceValidator
- [x] RECVALREF-011-04: RecipeBodyDescriptorValidator
- [x] RECVALREF-011-05: PartAvailabilityValidator
- [x] RECVALREF-011-06: SocketSlotCompatibilityValidator
- [x] RECVALREF-011-07: PatternMatchingValidator (plus blueprintProcessingUtils)
- [x] RECVALREF-011-08: GeneratedSlotPartsValidator
- [x] RECVALREF-011-09: LoadFailureValidator

## Implementation Tasks

### 1. Re-confirm Baseline (10 min)

- `wc -l src/anatomy/validation/RecipePreflightValidator.js` → currently ~1,001 lines.
- `docs/anatomy/anatomy-system-guide.md` §"Validation Pipeline" lists the eleven checks that must continue to run in this
  order. ComponentExistenceValidationRule and PropertySchemaValidationRule already work via `LoadTimeValidationContext`; leave
  them as-is for now.
- `src/dependencyInjection/registrations/worldAndEntityRegistrations.js` already registers `RecipePreflightValidator` under
  `tokens.IRecipePreflightValidator`. There is no DI token per validator today; do **not** invent new tokens unless the
  container actually needs to resolve validators independently.

### 2. Update RecipePreflightValidator Constructor (30 min)

**File:** `src/anatomy/validation/RecipePreflightValidator.js`

- Import the validator classes from `./validators/*.js`.
- Extend the constructor signature to accept optional overrides so tests can inject doubles:
  ```javascript
  constructor({
    logger,
    dataRegistry,
    schemaValidator,
    anatomyBlueprintRepository,
    slotGenerator,
    entityMatcherService,
    loadFailures = {},
    validators = {},
  }) { /* ... */ }
  ```
- Inside the constructor, instantiate each validator **once** using the existing dependencies (dataRegistry,
  anatomyBlueprintRepository, slotGenerator, entityMatcherService, logger). Allow overrides via the `validators` map so tests
  can inject spies/mocks without booting the real stack.
- Remove the ad-hoc `LoadFailureValidator` import/new call once the shared instance is created through this mechanism.
- Keep backwards compatibility for callers like `scripts/validate-recipe.js` that pass the old argument shape; default the new
  `validators` bag so existing imports keep working.

### 3. Replace `#runValidationChecks` with Validator Pipeline (45 min)

**File:** `src/anatomy/validation/RecipePreflightValidator.js`

- Keep the first two checks (component existence and property schemas) because they are ValidationRule adapters.
- After those checks succeed (or failFast is disabled), iterate through the validator instances in priority order. The priority
  values are already encoded in each validator class (10, 15, 20, 25, 30, 35, 40, 50, 60).
- Call `await validator.validate(recipe, optionsForValidator)` for each validator:
  - Pass `{ recipePath: options.recipePath, loadFailures: this.#loadFailures, ...options }` so validators that rely on load
    failures (LoadFailureValidator) or failFast semantics have all context they need.
  - Aggregate `errors`, `warnings`, `suggestions`, and `passed` arrays into the `results` accumulator the orchestrator returns.
- Respect `validator.failFast`: if a validator returns errors and `failFast` is true, stop executing the rest of the pipeline and
  log which validator halted execution.

### 4. Remove Inline Methods Obsoleted by Validators (45 min)

Delete the following private methods from `RecipePreflightValidator` because the standalone validators now cover them:
- `#checkBodyDescriptors`
- `#checkBlueprintExists`
- `#checkSocketSlotCompatibility`
- `#checkPatternMatching`
- `#checkDescriptorCoverage`
- `#hasDescriptorComponents`
- `#preferredEntityHasDescriptors`
- `#checkPartAvailability`
- `#checkGeneratedSlotPartAvailability`
- `#ensureBlueprintProcessed`
- `#checkEntityDefinitionLoadFailures`
- `#extractComponentValidationDetails`
- `#checkRecipeUsage`

All helper logic (descriptor counting, blueprint processing, etc.) now lives inside the validators under `validators/` or the
shared utilities introduced in RECVALREF-011-07. Delete unused imports along the way.

### 5. Update Helper Modules Instead of Blind Deletion (30 min)

- `src/anatomy/validation/patternMatchingValidator.js` already re-exports the functions from
  `validators/PatternMatchingValidator.js` and is referenced by existing unit/integration tests. Keep the file but trim any
  stale comments so it is obvious it is a compatibility shim.
- `src/anatomy/validation/socketSlotCompatibilityValidator.js` is still imported by tests and docs (see
  `tests/unit/anatomy/validation/socketSlotCompatibilityValidator.test.js`). Instead of deleting it outright, refactor the file
  to re-export helpers from `validators/SocketSlotCompatibilityValidator.js` (matching the pattern used for pattern matching)
  **after** the orchestrator no longer imports it. Update the tests that depend on the function exports so they point at the new
  module before removing the legacy implementation.
- Once **all** code paths use the validator classes (and tests import from `validators/`), the compatibility shims can be
  deleted in a follow-up; do not remove them in this ticket or the suite will fail.

### 6. Container + Script Wiring (20 min)

- `src/dependencyInjection/registrations/worldAndEntityRegistrations.js` already builds `RecipePreflightValidator` via
  `tokens.IRecipePreflightValidator`. Make sure the factory passes through the `loadFailures` map if/when it becomes available;
  for now it probably remains `{}` because loader totals only exist inside `scripts/validate-recipe.js`.
- `scripts/validate-recipe.js` and `scripts/create-recipe-wizard.js` instantiate the validator directly. Update those call sites
  only if the constructor signature changed; both scripts need to keep working without DI.

### 7. Run Full Test Suite (15 min)

- Existing unit + integration coverage for RecipePreflightValidator is extensive (`tests/unit/anatomy/validation/...` and
  `tests/integration/anatomy/validation/...`). All of them must pass after the refactor.
- Pay special attention to mocks that previously spied on `validateSocketSlotCompatibility` or `validatePatternMatching`; they
  will need to spy on the validator instances instead once the orchestrator imports the classes directly.

### 8. Verify File Size Reduction (5 min)

```
wc -l src/anatomy/validation/RecipePreflightValidator.js
```
Target: <500 lines (expect ~400-450 after removing the inline helpers).

### 9. Lint Modified Files (10 min)

```
npx eslint src/anatomy/validation/RecipePreflightValidator.js
npx eslint src/anatomy/validation/validators/*.js
npx eslint src/anatomy/validation/utils/*.js
npx eslint src/dependencyInjection/registrations/worldAndEntityRegistrations.js
```

## Dependencies

- Validators created in RECVALREF-011-01 through RECVALREF-011-09.
- `blueprintProcessingUtils.js` from RECVALREF-011-07 powers PatternMatchingValidator.
- `docs/anatomy/anatomy-system-guide.md` for the canonical validation order.
- Existing DI container factory for `IRecipePreflightValidator`.

## Acceptance Criteria

- [ ] `RecipePreflightValidator` instantiates and runs BlueprintExistence, RecipeBodyDescriptor, SocketSlotCompatibility,
      PartAvailability, GeneratedSlotParts, PatternMatching, DescriptorCoverage, LoadFailure, and RecipeUsage validators in
      priority order.
- [ ] Component existence and property schema ValidationRule adapters continue to run first.
- [ ] Inline helper methods listed above are removed from `RecipePreflightValidator`.
- [ ] Compatibility shims remain in place (pattern + socket modules) until all tests import the validator classes directly.
- [ ] `RecipePreflightValidator.js` drops below 500 lines.
- [ ] All existing unit + integration tests under `tests/anatomy/validation` pass.
- [ ] ESLint passes on the modified files.

## Testing Commands

```
# Unit tests
npm run test:unit -- RecipePreflightValidator.test.js

# All validation unit tests
npm run test:unit -- anatomy/validation/

# Integration tests
npm run test:integration -- anatomy/validation/

# Full CI
npm run test:ci

# Lint
npx eslint src/anatomy/validation/**/*.js src/dependencyInjection/**/*.js
```

## Code Reference

- `src/anatomy/validation/RecipePreflightValidator.js` (current orchestrator, ~1,001 lines)
- `src/anatomy/validation/validators/*.js` (standalone validators)
- `docs/anatomy/anatomy-system-guide.md` (validation order + background)
- `scripts/validate-recipe.js` / `scripts/create-recipe-wizard.js` (direct constructor usage)
- `src/dependencyInjection/registrations/worldAndEntityRegistrations.js` (IRecipePreflightValidator factory)

## Critical Notes

- **Zero Breaking Changes**: `scripts/validate-recipe.js` is used in CI; it must keep working without extra flags.
- **Fail-Fast Behavior**: BlueprintExistenceValidator is the only fail-fast validator today; stopping the pipeline early is
  expected and should be logged.
- **Load Failure Context**: Continue threading `loadFailures` from CLI contexts into the new validator stack so
  LoadFailureValidator can report loader totals.
- **Docs + CLI Alignment**: `docs/anatomy/troubleshooting.md` references helper names like `validateSocketSlotCompatibility`.
  Update documentation only after the helpers truly disappear.

## Success Metrics

- RecipePreflightValidator: 1,001 → <500 lines (50%+ reduction).
- 100% of validators run via shared BaseValidator pipeline.
- Test coverage for validators remains ≥80% (per sub-ticket requirements).
- CLI validation throughput unchanged (no extra container resolves in the hot path).

## Rollback Plan

1. `git checkout src/anatomy/validation/RecipePreflightValidator.js src/anatomy/validation/**/*.js src/dependencyInjection/registrations/worldAndEntityRegistrations.js scripts/*.js`
2. Re-run `npm run test:unit -- RecipePreflightValidator.test.js` to ensure parity with main.
3. Re-open this ticket with failure analysis if validators could not be integrated cleanly.
