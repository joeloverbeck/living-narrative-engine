# RECVALREF-012: Create Validation Pipeline Orchestrator

**Phase:** 4 - Pipeline Orchestration
**Priority:** P0 - Critical
**Estimated Effort:** 4 hours
**Dependencies:** RECVALREF-010, RECVALREF-011

## Context

Current orchestration lives inside `src/anatomy/validation/RecipePreflightValidator.js` and still carries the legacy constraints described in the phase overview:
- Six per-validator skip flags (`skipPatternValidation`, `skipDescriptorChecks`, `skipPartAvailabilityChecks`, `skipGeneratedSlotChecks`, `skipLoadFailureChecks`, `skipRecipeUsageCheck`) plus the global `failFast` option, which still leaves 64 execution combinations to test manually.
- Validator wiring is embedded in `#createValidatorStack()`/`#runValidatorPipeline()` even though standalone validator classes already exist for blueprint existence, body descriptors, sockets, patterns, descriptor coverage, part availability, generated slots, load failures, and recipe usage.
- Result aggregation is a bespoke loop that only concatenates arrays and does not apply any configuration-driven overrides yet.

## Objectives

1. Create a dedicated `ValidationPipeline` orchestrator class so `RecipePreflightValidator` is no longer responsible for building and sequencing the validator stack.
2. Execute validators pulled from `ValidatorRegistry` (`src/anatomy/validation/core/ValidatorRegistry.js`) in their declared priority order, using the existing `BaseValidator`/`ValidationResultBuilder` contract.
3. Preserve the per-validator `failFast` semantics already supplied by `BaseValidator` while still honoring the global `failFast` option that the CLI passes through today.
4. Aggregate validator output into a single structure using the `ValidationResultBuilder` conventions (errors, warnings, suggestions, passed) instead of the current manual array merging.
5. Support configuration-based execution control so `RECVALREF-013` can inject enable/disable rules and severity overrides that replace the current `skip*` booleans.

## Implementation

### File to Create / Touch
- `src/anatomy/validation/core/ValidationPipeline.js` – new orchestrator implementation
- `src/anatomy/validation/RecipePreflightValidator.js` – replace `#createValidatorStack()` / `#runValidatorPipeline()` usage with the pipeline class once wired

### Key Features
- Constructor accepts `registry`, `logger`, and a configuration object that describes validator enablement plus severity overrides (shape will be finalized in RECVALREF-013 but should default to the current behaviour when no overrides are provided).
- `execute(recipe, context)` runs the pipeline and returns a `ValidationReport`-compatible object by aggregating builder output from each validator.
- Retrieves validators through `ValidatorRegistry.getAll()` so any DI wiring or mod-provided validators automatically participate.
- Honors per-validator `failFast` as well as the caller-provided global option, matching the break conditions that `RecipePreflightValidator` enforces today.
- Applies configuration directives in this order: explicit disablement → severity overrides → default severity from each validator result. Severity overrides should mutate the aggregated issues rather than forcing every validator to understand configuration.
- Surfaces structured telemetry through the injected logger (start, per-validator execution, stop/fail-fast) so the existing CLI scripts retain observability.

### Execution Flow
```
1. Resolve validators via the registry and order by priority.
2. For each validator:
   a. Consult configuration overrides (enable/disable + severity remapping) falling back to the legacy `skip*` behaviour when no config exists yet.
   b. Execute `validator.validate(recipe, options)` and capture its `ValidationResultBuilder` output.
   c. Aggregate issues/passed messages into a single result object, mutating severities only when configuration overrides demand it.
   d. Stop when either the validator itself sets `failFast` and emitted errors or when the caller requests `failFast` and errors exist (matching current semantics).
3. Return the aggregated `ValidationReport` payload.
```

## Testing
- Unit tests: `tests/unit/anatomy/validation/core/ValidationPipeline.test.js`
- Integration tests: `tests/integration/anatomy/validation/ValidationPipeline.integration.test.js`

### Test Cases
- Execute all validators in priority order
- Stop on fail-fast validator failure
- Aggregate results correctly
- Respect enable/disable configuration
- Apply severity overrides

## Acceptance Criteria
- [ ] Pipeline class created with proper DI
- [ ] Executes validators in priority order
- [ ] Fail-fast behavior works correctly
- [ ] Results aggregation implemented
- [ ] Configuration controls respected
- [ ] Unit tests achieve 90%+ coverage
- [ ] Integration tests pass

## References
- **Recommendations:** Phase 4.1
- **Analysis:** Section "Boolean Flag Proliferation"
