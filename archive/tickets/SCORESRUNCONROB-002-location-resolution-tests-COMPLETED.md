# SCORESRUNCONROB-002 – Location Resolution Unit Tests

## Problem

The `registerCustomScope()` method resolves the actor's current location from the `core:position` component to populate `runtimeCtx.location`. However, no tests verify this location resolution logic. Without tests:

- Location resolution failures could silently break location-dependent scopes
- Edge cases (missing position, invalid locationId) have undefined behavior
- The contract that `location` is either an entity or `null` (never `undefined`) is not enforced

## Updated assumptions

- The test environment uses `SimpleEntityManager`, whose `getEntityInstance()` returns `undefined` for missing entities (not `null`).
- `ModTestFixture.registerCustomScope()` currently passes that `undefined` through, so `runtimeCtx.location` can be `undefined` when the actor's `locationId` is missing.
- To align with the runtime context robustness spec, `registerCustomScope()` must normalize missing locations to `null`.

## Proposed scope

Add unit tests that verify:
- Location is correctly resolved from `core:position.locationId`
- Missing `core:position` component results in `location = null`
- Invalid `locationId` (non-existent entity) results in `location = null`
- Resolved location entity is correctly passed to `runtimeCtx`

Apply the minimal fixture change needed to normalize missing location entities to `null` within `registerCustomScope()`.

## File list

- `tests/unit/common/mods/ModTestFixture.locationResolution.test.js` (CREATE)
- `tests/common/mods/ModTestFixture.js` (MODIFY)

## Out of scope

- `src/scopeDsl/nodes/sourceResolver.js` — no changes
- Any existing test files — no modifications
- Any production source code — no changes

## Acceptance criteria

### Tests

```bash
npm run test:unit -- tests/unit/common/mods/ModTestFixture.locationResolution.test.js
npm run test:unit -- tests/unit/common/mods/ModTestFixture.registerCustomScope.test.js
```

Both commands must pass.

### Invariants

1. Location resolution failures MUST return `null`, NEVER throw errors
2. `runtimeCtx.location` MUST be either:
   - A valid entity object with `id` property, OR
   - `null` (NEVER `undefined` for location-dependent scopes)
3. Existing tests in `ModTestFixture.registerCustomScope.test.js` continue to pass
4. No modifications to production code are required for tests to pass

### Required test cases

| Test Name | Description |
|-----------|-------------|
| `should resolve location from actor core:position component` | Actor has `core:position.locationId` → location entity returned |
| `should set location to null when actor has no position` | Actor lacks `core:position` → `location = null` |
| `should set location to null when locationId references missing entity` | `locationId` points to non-existent entity → `location = null` |
| `should pass location entity to runtimeCtx for scope evaluation` | Verify `runtimeCtx.location` property is set correctly |

## Status

Completed

## Outcome

- Added location resolution unit tests using `ScopeEngine.resolve` spying to inspect `runtimeCtx`.
- Normalized missing location entity lookups to `null` in `ModTestFixture.registerCustomScope()` to match the runtime context robustness spec (test environment returned `undefined` before).
