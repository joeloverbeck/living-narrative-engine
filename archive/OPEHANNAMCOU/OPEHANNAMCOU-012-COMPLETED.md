# OPEHANNAMCOU-012: Create ID format property tests

## Status

Completed

## Summary

Create property-based tests that validate component/event ID format as implemented by the JSON schema definitions. The current source of truth is `data/schemas/common.schema.json#/definitions/namespacedId`, which allows any non-empty string containing only letters, numbers, underscore, hyphen, and colon. This is broader than the spec's `modId:identifier` convention, so the tests document the current schema behavior without changing it.

## Files to Touch

- `tests/unit/validation/componentIdFormat.property.test.js` (NEW FILE)

## Out of Scope

- DO NOT modify any handler source files
- DO NOT modify constants files
- DO NOT modify existing tests
- DO NOT modify schema files

## Changes

Create property-based tests that validate component/event ID format through schema validation:

- Use AJV to validate IDs through `component.schema.json` and `event.schema.json`, which both reference `common.schema.json#/definitions/namespacedId`.
- Generate valid IDs using allowed characters (`[a-zA-Z0-9_:-]`) and assert schema acceptance.
- Generate invalid IDs by inserting disallowed characters (whitespace, punctuation) and assert schema rejection.
- Add explicit examples documenting schema behavior that differs from the spec (IDs without a colon or with multiple colons are currently accepted).

## Acceptance Criteria

### Tests That Must Pass

- `NODE_ENV=test npx jest tests/unit/validation/componentIdFormat.property.test.js --no-coverage` passes
- `npx eslint tests/unit/validation/componentIdFormat.property.test.js` passes

### Invariants

- Tests validate the `namespacedId` schema pattern as implemented today
- Tests cover edge cases (empty string, disallowed characters)
- Tests document current schema behavior for ambiguous cases (colon optional, multiple colons allowed)

## Dependencies

None - this test can be implemented independently

## Implementation Order

Phase 4: Validation Tests (can be done in parallel with other Phase 4 tickets)

## Notes

These tests intentionally align with the current schema behavior (per `common.schema.json`) rather than the stricter `modId:identifier` convention in the spec. Any future tightening of the schema should update these tests alongside the schema change.

## Outcome

Implemented schema-driven property tests for component/event IDs and documented the current, more permissive `namespacedId` behavior instead of adding helper-based namespace extraction or stricter `modId:identifier` enforcement.
