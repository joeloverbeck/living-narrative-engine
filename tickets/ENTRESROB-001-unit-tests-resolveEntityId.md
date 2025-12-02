# ENTRESROB-001: Unit Tests for `resolveEntityId` Edge Cases

**Priority:** P1
**Effort:** Small (2-3 hours)
**Status:** Not Started
**Dependencies:** None

## Report Reference

See `specs/entity-resolution-robustness.md` for full context.

## Problem Statement

The `resolveEntityId` function in `src/anatomy/validation/socketExtractor.js` (lines 376-399) lacks unit test coverage. This function is critical for entity resolution during socket validation but has no direct tests, making it risky to refactor without first establishing a test baseline.

## Objective

Add comprehensive unit test coverage for `resolveEntityId` to document current behavior and establish a baseline for future refactoring (ENTRESROB-003).

## Files to Touch

- `tests/unit/anatomy/validation/socketExtractor.test.js` (MODIFY)

## Out of Scope

- **DO NOT** modify `src/anatomy/validation/socketExtractor.js`
- **DO NOT** modify any entity definition files in `data/mods/`
- **DO NOT** create integration tests (those are in ENTRESROB-005)
- **DO NOT** add logging or change function behavior
- **DO NOT** export `resolveEntityId` if not already exported

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

- [ ] 9 new test cases added and passing
- [ ] No existing tests broken
- [ ] Coverage for `resolveEntityId` at 100% branches
- [ ] All mocks are cleaned up properly in afterEach
