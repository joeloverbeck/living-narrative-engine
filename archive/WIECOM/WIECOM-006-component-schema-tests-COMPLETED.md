# WIECOM-006: Component Schema Unit Tests

**Status: ✅ COMPLETED**

## Summary

Create unit tests for the `positioning:wielding` component schema validation, ensuring all valid cases pass and invalid cases fail.

## Dependencies

- WIECOM-001 must be completed (component definition must exist) ✅
- WIECOM-002 must be completed (component must be registered) ✅

## Files to Touch

| File | Action | Description |
|------|--------|-------------|
| `tests/unit/mods/positioning/components/wielding_component_schema.test.js` | CREATE | Schema validation tests |

## Out of Scope

- **DO NOT** modify any source code files
- **DO NOT** modify any mod data files
- **DO NOT** create integration tests (see WIECOM-007)
- **DO NOT** test rule execution behavior
- **DO NOT** test activity description generation
- **DO NOT** modify any existing test files

## Implementation Details

### Test File Structure

```javascript
/**
 * @file Unit tests for positioning:wielding component schema validation
 * @see specs/wielding-component.md
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
// Import schema validation utilities from test helpers

describe('positioning:wielding Component Schema', () => {
  // Setup: load schema validator

  describe('Valid Cases', () => {
    it('should accept empty wielded_item_ids array', () => {
      // { wielded_item_ids: [] }
    });

    it('should accept single item in array', () => {
      // { wielded_item_ids: ['sword-1'] }
    });

    it('should accept multiple items in array', () => {
      // { wielded_item_ids: ['sword-1', 'dagger-2'] }
    });

    it('should accept namespaced IDs', () => {
      // { wielded_item_ids: ['weapons:silver_revolver'] }
    });

    it('should accept with activityMetadata', () => {
      // { wielded_item_ids: ['sword'], activityMetadata: { shouldDescribeInActivity: true } }
    });

    it('should accept full activityMetadata', () => {
      // { wielded_item_ids: ['sword'], activityMetadata: {
      //   shouldDescribeInActivity: true,
      //   template: "...",
      //   targetRole: "wielded_item_ids",
      //   targetRoleIsArray: true,
      //   priority: 70
      // }}
    });
  });

  describe('Invalid Cases', () => {
    it('should reject missing wielded_item_ids', () => {
      // {}
    });

    it('should reject wielded_item_ids as string', () => {
      // { wielded_item_ids: 'sword' }
    });

    it('should reject non-string in array', () => {
      // { wielded_item_ids: [123] }
    });

    it('should reject additional properties', () => {
      // { wielded_item_ids: [], extra: 'bad' }
    });

    it('should reject duplicate items in array', () => {
      // { wielded_item_ids: ['sword', 'sword'] } - uniqueItems: true
    });

    it('should reject null wielded_item_ids', () => {
      // { wielded_item_ids: null }
    });

    it('should reject invalid activityMetadata properties', () => {
      // { wielded_item_ids: [], activityMetadata: { unknownProp: true } }
    });

    it('should reject priority outside range', () => {
      // { wielded_item_ids: [], activityMetadata: { priority: 150 } }
    });
  });

  describe('Edge Cases', () => {
    it('should handle large arrays', () => {
      // 10+ items
    });

    it('should handle empty string in array', () => {
      // { wielded_item_ids: [''] } - may fail due to pattern
    });

    it('should handle whitespace-only string in array', () => {
      // { wielded_item_ids: ['  '] } - should fail
    });
  });
});
```

### Test Cases Matrix

| Test Case | Input | Expected |
|-----------|-------|----------|
| Valid: Empty array | `{ wielded_item_ids: [] }` | ✅ Pass |
| Valid: Single item | `{ wielded_item_ids: ['sword-1'] }` | ✅ Pass |
| Valid: Multiple items | `{ wielded_item_ids: ['sword-1', 'dagger-2'] }` | ✅ Pass |
| Valid: Namespaced IDs | `{ wielded_item_ids: ['weapons:silver_revolver'] }` | ✅ Pass |
| Valid: With activityMetadata | `{ wielded_item_ids: ['sword'], activityMetadata: { shouldDescribeInActivity: true } }` | ✅ Pass |
| Invalid: Missing wielded_item_ids | `{}` | ❌ Fail |
| Invalid: Items as string | `{ wielded_item_ids: 'sword' }` | ❌ Fail |
| Invalid: Non-string in array | `{ wielded_item_ids: [123] }` | ❌ Fail |
| Invalid: Additional properties | `{ wielded_item_ids: [], extra: 'bad' }` | ❌ Fail |
| Invalid: Duplicate items | `{ wielded_item_ids: ['sword', 'sword'] }` | ❌ Fail |

## Acceptance Criteria

### Specific Tests That Must Pass

```bash
NODE_ENV=test npx jest tests/unit/mods/positioning/components/wielding_component_schema.test.js --no-coverage --verbose
```

All tests in the created file must pass.

### Invariants That Must Remain True

1. Tests use existing test utilities from `tests/common/`
2. Tests follow existing test patterns in `tests/unit/mods/positioning/`
3. Tests are isolated and don't modify global state
4. Each test case is independent
5. Tests use `describe/it/expect` from `@jest/globals`
6. Tests include proper JSDoc documentation

### Validation Commands

```bash
# Run the specific test file
NODE_ENV=test npx jest tests/unit/mods/positioning/components/wielding_component_schema.test.js --no-coverage --verbose

# Verify test follows project conventions
npx eslint tests/unit/mods/positioning/components/wielding_component_schema.test.js
```

## Reference Files

Study these for test patterns:
- Look for existing component schema tests in `tests/unit/mods/`
- `tests/common/testBed.js` - Test utilities
- `tests/common/mods/domainMatchers.js` - Custom matchers

## Diff Size Estimate

Creating a new test file with approximately 100-150 lines.

---

## Outcome

**Completed**: 2025-11-25

### What Was Actually Changed vs Originally Planned

**Planned**: Create unit tests with structure outlined in ticket

**Actual Implementation**:
- Created `tests/unit/mods/positioning/components/wielding_component_schema.test.js` with **37 tests** (exceeded the original ~15-20 suggested)
- Followed the pattern from `doingComplexPerformance.test.js` in the same directory
- No discrepancies found in ticket assumptions - the component schema matched expectations

### Tests Created

**Component Definition (5 tests)**:
- Schema validity, correct ID, description, wielding mention, required fields

**Valid Cases (9 tests)**:
- Empty array, single/multiple items, namespaced IDs, underscore/hyphen IDs
- Minimal/full/empty activityMetadata, priority boundary values

**Invalid Cases (14 tests)**:
- Missing/null/string wielded_item_ids, non-string/object in array
- Duplicate items, additional properties at root and in activityMetadata
- Priority below/above range, non-integer priority
- Wrong types for shouldDescribeInActivity, template, targetRoleIsArray

**Edge Cases - namespacedId Pattern (9 tests)**:
- Large arrays, empty/whitespace strings, IDs with spaces/special chars
- Multi-colon namespacing, numeric-only IDs, single char IDs, mixed valid IDs

### Validation Results

```
Test Suites: 1 passed, 1 total
Tests:       37 passed, 37 total
```

No ESLint errors.
