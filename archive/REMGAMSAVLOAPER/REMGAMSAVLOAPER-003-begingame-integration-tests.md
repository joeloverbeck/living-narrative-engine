# REMGAMSAVLOAPER-003: Update Integration Tests for `beginGame()` Signature Change

**Status**: Completed
**Priority**: HIGH
**Effort**: Medium (mechanical integration test updates)
**Completed**: 2025-12-17

## Summary
Align integration tests with the current `src/main.js` behavior where `beginGame()` no longer takes a `showLoadUI` argument and does not invoke any “open load UI on startup” behavior.

Key detail: JavaScript will happily allow `beginGame(true)` calls to *compile* and run, but those tests become misleading because any expectations about `showLoadGameUI()` being called are now obsolete.

Update integration tests that:
- Call `beginGame(true)` (or otherwise pass a “show load UI” flag)
- Assert that `showLoadGameUI()` is called (or explicitly *not* called as an invariant)

So they instead:
- Call `beginGame()` with no arguments
- Remove all assertions tied to load-on-start behavior (`showLoadGameUI`)
- Continue validating bootstrap resilience/error-handling paths (stage ordering, error propagation, DOM fallbacks)

## File list it expects to touch
- `tests/integration/app/mainBootstrap.integration.test.js`
- `tests/integration/app/mainBootstrap.domFailurePaths.integration.test.js`
- `tests/integration/app/mainBootstrap.failureScenarios.integration.test.js`
- `tests/integration/app/mainBootstrap.phaseFallback.integration.test.js`
- `tests/integration/runtime/mainBootstrapFlow.integration.test.js`
- `tests/integration/runtime/mainOrchestrationResilience.integration.test.js`
- `tests/integration/runtime/mainCoverageEnhancements.integration.test.js`
- (If required) shared helpers used by these tests:
  - `tests/common/**` (only where they directly assert load-on-start behavior)

## Out of scope (must NOT change)
- Production runtime code under `src/` (this ticket is test-only unless a small helper adjustment is needed to keep tests deterministic).
- Removing engine-level save/load APIs (`showLoadGameUI`, etc.) beyond what’s necessary for the updated tests to run.
- Any persistence pipeline deletion (handled later).

## Acceptance criteria
### Specific tests that must pass
- `npm run test:integration -- --runInBand tests/integration/app/mainBootstrap.integration.test.js`
- `npm run test:integration -- --runInBand tests/integration/app/mainBootstrap.domFailurePaths.integration.test.js`
- `npm run test:integration -- --runInBand tests/integration/app/mainBootstrap.failureScenarios.integration.test.js`
- `npm run test:integration -- --runInBand tests/integration/app/mainBootstrap.phaseFallback.integration.test.js`
- `npm run test:integration -- --runInBand tests/integration/runtime/mainBootstrapFlow.integration.test.js`
- `npm run test:integration -- --runInBand tests/integration/runtime/mainOrchestrationResilience.integration.test.js`
- `npm run test:integration -- --runInBand tests/integration/runtime/mainCoverageEnhancements.integration.test.js`

### Invariants that must remain true
- No integration test asserts “load UI opens on startup” (or that `beginGame()` controls this) as a supported behavior.
- Integration bootstrapping coverage remains meaningful (still asserts stage ordering, error propagation, and fallbacks).

## Outcome
- Updated ticket scope first: more integration tests referenced `beginGame(true)` / `showLoadGameUI` than originally listed.
- Updated integration tests to call `beginGame()` with no args and removed all assertions that treat load-on-start as supported behavior.
- No production runtime changes were required; `src/main.js` already exports `beginGame()` with no arguments.
- Verified via: `npm run test:integration -- --runInBand` on the affected test files listed in this ticket.
