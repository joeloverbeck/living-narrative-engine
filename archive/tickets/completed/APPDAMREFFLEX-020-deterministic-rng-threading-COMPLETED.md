# APPDAMREFFLEX-020 Deterministic RNG threading

## Status
Completed

## Assumption check
- `applyDamageHandler` currently calls `Math.random` for hit selection and has no way to receive an injected RNG.
- `damageResolutionService` does not accept or forward RNG; it calls `damagePropagationService` without any RNG context.
- `damagePropagationService` uses `Math.random` for probability rolls and cannot be seeded today.
- `damageTypeEffectsService` already accepts an `rngProvider` in its constructor and uses it for fracture stun rolls, but the handler/resolution path never passes an execution-scoped RNG through.
- Unit tests for propagation/effects rely on defaults and do not assert determinism or RNG threading.

## Updated goal
Thread an optional RNG function from the execution context through APPLY_DAMAGE (hit selection, propagation rolls, and effect hooks) while keeping `Math.random` as the default so existing behavior and APIs remain intact but tests can seed deterministic outcomes.

## File list
- `src/logic/operationHandlers/applyDamageHandler.js` (consume optional executionContext RNG; stop direct `Math.random` use)
- `src/logic/services/damageResolutionService.js` (accept RNG and pass into propagation/effects)
- `src/anatomy/services/damagePropagationService.js` (accept RNG parameter; remove hard-coded randomness)
- `src/anatomy/services/damageTypeEffectsService.js` (allow per-call RNG override to use injected RNG)
- `tests/unit/anatomy/services/damagePropagationService.test.js` (add deterministic coverage for seeded RNG)
- `tests/unit/anatomy/services/damageTypeEffectsService.test.js` (add deterministic coverage for fracture stun RNG)

## Out of scope
- Changing probabilities or selection weighting beyond deterministic seeding.
- Introducing new mitigation logic or altering damage math.
- Adding schema fields beyond possible RNG reference plumbing already present in execution context.

## Acceptance criteria
- Unit tests `tests/unit/anatomy/services/damagePropagationService.test.js` and `tests/unit/anatomy/services/damageTypeEffectsService.test.js` cover seeded RNG paths and pass; existing e2e `tests/e2e/actions/swingAtTargetFullFlow.e2e.test.js` still passes without providing RNG.
- Invariants: Statistical distribution of hit selection/propagation remains unchanged when RNG defaults to `Math.random`; API shape for existing callers remains backward compatible (no required new params).

## Outcome
- Added optional RNG plumbing from execution context through hit selection, propagation rolls, and effect hooks while keeping `Math.random` as the fallback.
- Introduced deterministic unit coverage for propagation probability rolls and fracture stun RNG override; legacy call shapes and behaviors remain unchanged when no RNG is supplied.
