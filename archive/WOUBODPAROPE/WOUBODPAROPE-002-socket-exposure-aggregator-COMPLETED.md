# WOUBODPAROPE-002: Add Socket Exposure Aggregator Operator

Status: Completed

**Goal:** Create `socketExposure(entityPath, sockets, mode = 'any', invert = false, treatMissingAsExposed = true)` to replace repeated `isSocketCovered` boolean trees (any/all, missing socket treated as exposed) across scopes.

**Assumptions check (2026-02-06):**
- No `socketExposure` operator exists yet; `isSocketCovered` is registered directly and already exposes `clearCache()` through `JsonLogicCustomOperators.isSocketCoveredOp`.
- `JsonLogicEvaluationService` keeps a strict `ALLOWED_OPERATIONS` whitelist validated by tests (`jsonLogicCustomOperators.whitelistValidation` + `jsonLogicOperatorRegistration`). Any new operator must be whitelisted and registered through `JsonLogicCustomOperators.registerOperators` to satisfy these suites.
- `isSlotExposed` already handles the “falsy slot means exposed” path, so `socketExposure` should mirror the same ergonomics for sockets (string or array inputs, optional defaults) without changing `isSocketCovered` semantics.

## File list
- `src/logic/operators/socketExposureOperator.js` (new operator wrapping `IsSocketCoveredOperator`)
- `src/logic/jsonLogicCustomOperators.js` (register aggregator with default options)
- `src/logic/jsonLogicEvaluationService.js` (operator whitelist/registration entry)
- `tests/unit/logic/operators/socketExposureOperator.test.js` (new unit suite covering any/all, invert=true, missing-socket handling, array vs string inputs, cache clearing)

## Out of scope
- Direct edits to scope JSON files
- Behavior changes to `isSocketCovered` itself beyond reuse inside the aggregator
- Altering BodyGraphService or anatomy component schemas

## Acceptance criteria
- Tests: `npm run test:unit -- tests/unit/logic/operators/socketExposureOperator.test.js` passes; whitelist/registration suites continue to pass when the operator is added (`tests/unit/logic/jsonLogicCustomOperators.whitelistValidation.test.js`, `tests/unit/logic/jsonLogicOperatorRegistration.test.js`).
- Invariants:
  - `isSocketCovered` behavior stays unchanged for existing callers
  - Operator registration does not remove or reorder existing entries unexpectedly; new operator should reuse the existing `isSocketCoveredOp` instance for cache clearing instead of introducing a separate cache
  - No additional global state or cross-operator caching introduced

## Outcome
- Added `socketExposure` operator that aggregates `isSocketCovered` checks (any/all, invert for coverage, treat-missing-as-exposed default, string or array sockets) and delegates cache clearing to the shared coverage operator.
- Registered/whitelisted the new operator alongside existing clothing operators and updated registration/whitelist tests to include it.
- Added focused unit coverage for socket exposure modes, invert behavior, missing-socket handling, array vs string inputs, and cache delegation; executed the targeted unit suites with `--runInBand` because parallel Jest workers flake in this repo.
