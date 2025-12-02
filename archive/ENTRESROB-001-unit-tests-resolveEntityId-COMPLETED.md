# ENTRESROB-001: Unit Tests for `resolveEntityId` Edge Cases

**Priority:** P1
**Effort:** Small (2-3 hours)
**Status:** Completed
**Dependencies:** None

## Report Reference

See `specs/entity-resolution-robustness.md` for full context.

## Problem Statement

The `resolveEntityId` function in `src/anatomy/validation/socketExtractor.js` (lines 376-399) lacks unit test coverage. This function is critical for entity resolution during socket validation but has no direct tests, making it risky to refactor without first establishing a test baseline.

## Objective

Add comprehensive unit test coverage for `resolveEntityId` to document current behavior and establish a baseline for future refactoring (ENTRESROB-003).

## Files to Touch

- `src/anatomy/validation/socketExtractor.js` (MODIFY - export only)
- `tests/unit/anatomy/validation/socketExtractor.test.js` (MODIFY)

## Out of Scope

- **DO NOT** modify `src/anatomy/validation/socketExtractor.js` logic (only exports allowed)
- **DO NOT** modify any entity definition files in `data/mods/`
- **DO NOT** create integration tests (those are in ENTRESROB-005)
- **DO NOT** add logging or change function behavior

## Acceptance Criteria

### Specific Tests That Must Pass

After implementation, running `npm run test:unit -- --testPathPattern="socketExtractor"` must pass with these test cases:

```
socketExtractor > resolveEntityId > returns null for null partType
socketExtractor > resolveEntityId > returns null for null dataRegistry
socketExtractor > resolveEntityId > returns null when no entity matches
socketExtractor > resolveEntityId > returns entity ID when single match exists
socketExtractor > resolveEntityId > returns first match when multiple entities exist
socketExtractor > resolveEntityId > handles empty entity array
socketExtractor > resolveEntityId > handles entities without anatomy:part component
socketExtractor > resolveEntityId > handles registry with getAll method
socketExtractor > resolveEntityId > handles registry with getAllEntityDefinitions method
```

### Invariants That Must Remain True

1. All existing tests in `socketExtractor.test.js` continue to pass
2. No production code is modified
3. Test coverage for `resolveEntityId` reaches 100% branches
4. Tests use mock data, not real mod files

## Implementation Notes

### Accessing the Private Function

`resolveEntityId` is currently a private function. Options for testing:

1. **Preferred**: If the module exports a test helper or the function is accessible via another exported function, use that
2. **Alternative**: Test indirectly through `extractHierarchicalSockets` which calls `resolveEntityId`
3. **If needed**: Export `resolveEntityId` with a `// @internal` JSDoc annotation for testing purposes

### Mock Data Pattern

Use this pattern for mock registries:

```javascript
const mockRegistry = {
  getAll: jest.fn().mockReturnValue([
    {
      id: 'anatomy:humanoid_head',
      components: {
        'anatomy:part': { subType: 'head' }
      }
    }
  ])
};
```

## Verification Commands

```bash
# Run unit tests for socketExtractor
npm run test:unit -- --testPathPattern="socketExtractor"

# Check coverage
npm run test:unit -- --testPathPattern="socketExtractor" --coverage
```

## Success Metrics

- [x] 9 new test cases added and passing (11 added)
- [x] No existing tests broken
- [x] Coverage for `resolveEntityId` at 100% branches
- [x] All mocks are cleaned up properly in afterEach

## Outcome
- Updated ticket assumptions: `resolveEntityId` needed to be exported for proper unit testing as indirect testing was insufficient for edge cases.
- Modified `src/anatomy/validation/socketExtractor.js` to export `resolveEntityId` with `@internal` tag.
- Added 11 unit tests to `tests/unit/anatomy/validation/socketExtractor.test.js` covering all specified cases + extra robustness checks (registry without methods, registry returning null).
- Achieved 100% branch coverage for `resolveEntityId`.