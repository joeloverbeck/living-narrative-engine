# OPEHANNAMCOU-010: Create namespace mismatch regression test

## Summary

Create a regression integration test that reproduces the ITEMSPLIT-007 namespace mismatch (items:drinkable vs drinking:drinkable) using existing validation helpers. The test should ensure missing component IDs are detected and that suggestions are actionable.

## Reassessment Notes

- There is no `validateComponentId`, `extractNamespace`, or `findSimilarIds` helper for component IDs in production code.
- Component ID parity checks already exist in `tests/integration/validation/handlerComponentContracts.test.js`.
- Suggestions are provided by `src/utils/suggestionUtils.js` and should be used in the new regression test.

## Files to Touch

- `tests/integration/validation/namespaceMismatchRegression.test.js` (NEW FILE)

## Out of Scope

- DO NOT modify any handler source files
- DO NOT modify constants files
- DO NOT modify existing tests
- DO NOT modify mod JSON files

## Changes

Create an integration regression test that simulates the namespace mismatch using local helpers and `findSimilar`, with a namespace-aware fallback that matches IDs by identifier when Levenshtein distance is too large:

- Create a mock registry containing `items:drinkable` but not `drinking:drinkable`
- Validate the expected component IDs against the registry with a local helper
- Assert the missing ID is detected and that suggestions include `items:drinkable`
- Add a short comment linking to ITEMSPLIT-007 and `specs/operation-handler-namespace-coupling.md`

## Acceptance Criteria

### Tests That Must Pass

- `NODE_ENV=test npx jest tests/integration/validation/namespaceMismatchRegression.test.js --no-coverage` passes
- `npx eslint tests/integration/validation/namespaceMismatchRegression.test.js` passes

### Invariants

- Test reproduces the ITEMSPLIT-007 namespace mismatch (items:drinkable vs drinking:drinkable)
- Test validates error messaging includes actionable suggestions

## Dependencies

Uses `src/utils/suggestionUtils.js` for fuzzy suggestions.

## Implementation Order

Phase 4: Validation Tests (can be done in parallel with other Phase 4 tickets)

## Notes

This is specifically a regression test to ensure the ITEMSPLIT-007 bug cannot recur. The test should:

1. Reproduce the exact failure conditions
2. Verify the system now catches the error
3. Verify the error message helps developers fix the issue

Consider adding a comment in the test file with a link to the ITEMSPLIT-007 ticket or spec for context.

## Status

Completed

## Outcome

- Added a new integration regression test for namespace mismatch detection using a namespace-aware suggestion fallback.
- No production code changes; the test uses existing `componentIds` constants and `suggestionUtils`.
- Updated the ticket scope to align with existing validation utilities (no `validateComponentId` or namespace extractor helpers).
