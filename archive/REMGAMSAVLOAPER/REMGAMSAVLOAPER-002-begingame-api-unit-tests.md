# REMGAMSAVLOAPER-002: Remove `beginGame(showLoadUI)` API and Update Unit Tests

**Status**: Completed
**Priority**: HIGH
**Effort**: Medium (localized runtime + unit test edits)

## Summary
Remove the `showLoadUI` argument from `src/main.js`’s exported `beginGame()` and eliminate the runtime branch that calls `gameEngine.showLoadGameUI()` on startup.

Update unit tests that currently:
- call `beginGame(true)` / `window.beginGame(true)`
- mock/expect `showLoadGameUI` on the engine instance

Note: integration/runtime tests also call `beginGame(true|false)` today, but those updates are handled by `REMGAMSAVLOAPER-003` to keep this ticket focused on unit-level API expectations.

## Reassessed assumptions / scope updates
- The `beginGame(showLoadUI = false)` branch is currently exercised by multiple “coverage” unit suites under `tests/unit/main/`, not just `tests/unit/main.test.js`.
- Integration/runtime tests also pass `true|false` into `beginGame(...)`; they are intentionally deferred to `REMGAMSAVLOAPER-003` so this ticket remains unit-scoped and independently reviewable.

## File list it expects to touch
- `src/main.js`
- `tests/unit/main.test.js`
- `tests/unit/main/**` (unit tests under `tests/unit/main/` that call `beginGame(true)` / assert load-on-start)

## Out of scope (must NOT change)
- Any engine save/load API removal (handled in later tickets).
- Any HTML/CSS changes (handled in `REMGAMSAVLOAPER-001`).
- Any DI wiring or save/load services (handled in later tickets).
- Any integration test updates (handled in `REMGAMSAVLOAPER-003`).

## Acceptance criteria
### Specific tests that must pass
- `npm run test:unit -- --runInBand tests/unit/main.test.js`
- `npm run test:unit -- --runInBand tests/unit/main`

### Invariants that must remain true
- `src/main.js` exports `beginGame()` with no save/load-related options/parameters.
- No runtime code path calls `gameEngine.showLoadGameUI()` from `src/main.js`.
- All updated unit tests assert only supported behavior (start new game boot) and do not reference save/load UI startup flows.

## Implementation notes
- When removing test cases, prefer deleting assertions that exist solely to validate load-on-start behavior rather than replacing them with non-value assertions.

## Outcome
- Updated `src/main.js` so `beginGame()` no longer accepts a `showLoadUI` parameter and no longer calls `gameEngine.showLoadGameUI()` on startup.
- Updated unit tests under `tests/unit/main/` and `tests/unit/main.test.js` to stop passing `true` into `beginGame()` and to remove load-on-start assertions (tests now focus on supported start flow and error handling).
- Left integration/runtime tests untouched (handled by `REMGAMSAVLOAPER-003`), which is a scope change vs. the initial “update all tests” instinct.
