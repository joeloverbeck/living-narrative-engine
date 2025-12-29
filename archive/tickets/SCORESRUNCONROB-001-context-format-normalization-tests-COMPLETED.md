# SCORESRUNCONROB-001 – Context Format Normalization Unit Tests

## Problem

`registerCustomScope()` in `tests/common/mods/ModTestFixture.js` already normalizes context formats before validation, but we have no unit coverage proving the three supported formats are accepted and validated post-extraction. The historical failure mode (validating a wrapper context before extracting the actor entity) caused "actorEntity must have an 'id' property" errors, so tests should lock in the current ordering and normalization behavior.

The three accepted formats are:
1. Direct entity: `{ id: "actor-123", components: {...} }`
2. Enriched context: `{ actorEntity: {...}, otherData: ... }`
3. Actor pipeline context: `{ actor: {...}, targets: {...} }`

## Proposed scope

Add unit tests that verify:
- All three context formats are correctly normalized to extract the actor entity
- Validation occurs AFTER extraction (not before)
- Original entity references are preserved through normalization
- Proper error messages when no valid entity can be extracted

## File list

- `tests/unit/common/mods/ModTestFixture.contextNormalization.test.js` (CREATE)

## Out of scope

- `tests/common/mods/ModTestFixture.js` — no implementation changes (normalization already present)
- `src/scopeDsl/core/parameterValidator.js` — no changes
- Any existing test files — no modifications
- Any production source code — no changes

## Acceptance criteria

### Tests

```bash
npm run test:unit -- tests/unit/common/mods/ModTestFixture.contextNormalization.test.js
npm run test:unit -- tests/unit/common/mods/ModTestFixture.registerCustomScope.test.js
```

Both commands must pass.

### Invariants

1. Existing tests in `tests/unit/common/mods/ModTestFixture.registerCustomScope.test.js` continue to pass unchanged
2. All three context formats produce identical resolver behavior when passed equivalent entity data
3. No modifications to `ModTestFixture.js` implementation are required for tests to pass
4. Tests use the same mock factory patterns as existing `ModTestFixture.registerCustomScope.test.js`

### Required test cases

| Test Name | Description |
|-----------|-------------|
| `should accept direct entity format { id, components }` | Pass `{ id: "actor-1", components: {} }` directly |
| `should accept enriched context { actorEntity: {...} }` | Pass `{ actorEntity: { id: "actor-1" } }` |
| `should accept actor pipeline context { actor: {...} }` | Pass `{ actor: { id: "actor-1" }, targets: {} }` |
| `should fail validation when no id extractable from any format` | Pass `{ unrelated: "data" }` |
| `should preserve original entity reference after normalization` | Verify reference equality |

## Status

Completed.

## Outcome

Added unit coverage for context normalization in `tests/unit/common/mods/ModTestFixture.contextNormalization.test.js`; no production code changes were required, and the existing registerCustomScope tests remained unchanged.
