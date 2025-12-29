# SCORESRUNCONROB-002 – Location Resolution Unit Tests

## Problem

The `registerCustomScope()` method resolves the actor's current location from the `core:position` component to populate `runtimeCtx.location`. However, no tests verify this location resolution logic. Without tests:

- Location resolution failures could silently break location-dependent scopes
- Edge cases (missing position, invalid locationId) have undefined behavior
- The contract that `location` is either an entity or `null` (never `undefined`) is not enforced

## Proposed scope

Add unit tests that verify:
- Location is correctly resolved from `core:position.locationId`
- Missing `core:position` component results in `location = null`
- Invalid `locationId` (non-existent entity) results in `location = null`
- Resolved location entity is correctly passed to `runtimeCtx`

## File list

- `tests/unit/common/mods/ModTestFixture.locationResolution.test.js` (CREATE)

## Out of scope

- `tests/common/mods/ModTestFixture.js` — no implementation changes
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
