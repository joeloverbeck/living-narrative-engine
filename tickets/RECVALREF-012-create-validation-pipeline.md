# RECVALREF-012: Create Validation Pipeline Orchestrator

**Phase:** 4 - Pipeline Orchestration
**Priority:** P0 - Critical
**Estimated Effort:** 4 hours
**Dependencies:** RECVALREF-010, RECVALREF-011

## Context

Current orchestration is hardcoded in RecipePreflightValidator with:
- 7 boolean flags creating 128 test configurations
- Inline fail-fast logic
- No pipeline abstraction
- Scattered execution control

## Objectives

1. Create `ValidationPipeline` orchestrator class
2. Execute validators from registry in priority order
3. Support fail-fast behavior per validator
4. Aggregate results from all validators
5. Apply configuration-based execution control

## Implementation

### File to Create
`src/anatomy/validation/core/ValidationPipeline.js`

### Key Features
- Constructor accepts: registry, logger, config
- `execute(recipe, context)` - Run validation pipeline
- Respect validator priority ordering
- Honor fail-fast configuration
- Aggregate results (passed, errors, warnings, info)
- Apply severity overrides from configuration

### Execution Flow
```
1. Get enabled validators from registry (sorted by priority)
2. For each validator:
   a. Check if enabled in configuration
   b. Execute validator.validate(recipe, context)
   c. Aggregate result into accumulator
   d. If failFast && !isValid: break pipeline
3. Return aggregated results
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
