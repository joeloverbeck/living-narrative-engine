# WIECOM-007: Integration Tests

## Summary

Create integration tests that verify the complete wielding workflow: action execution → component addition → activity description generation.

## Dependencies

- WIECOM-001 through WIECOM-005 must be completed
- WIECOM-006 should be completed (schema tests passing)

## Files to Touch

| File | Action | Description |
|------|--------|-------------|
| `tests/integration/mods/weapons/wieldThreateninglyRuleExecution.test.js` | CREATE | Rule execution tests |
| `tests/integration/mods/positioning/wieldingActivityDescription.test.js` | CREATE | Activity description tests |
| `tests/integration/mods/weapons/wieldingEdgeCases.test.js` | CREATE | Edge case tests |

## Out of Scope

- **DO NOT** modify any source code files
- **DO NOT** modify any mod data files
- **DO NOT** modify any existing test files
- **DO NOT** create unit tests (see WIECOM-006)
- **DO NOT** implement action gating tests (documented for future)
- **DO NOT** test stop-wielding functionality (not yet implemented)

## Implementation Details

### Test Suite 1: Rule Execution

**File**: `tests/integration/mods/weapons/wieldThreateninglyRuleExecution.test.js`

```javascript
/**
 * @file Integration tests for wield_threateningly rule execution
 * @see specs/wielding-component.md
 */

describe('wield_threateningly Rule Execution', () => {
  describe('Component Management', () => {
    it('should add positioning:wielding component on first wield', () => {
      // Setup: actor with no wielding component, weapon in inventory
      // Act: execute wield_threateningly action
      // Assert: actor has positioning:wielding with weapon ID in array
    });

    it('should append to existing array on second wield', () => {
      // Setup: actor with wielding component containing ['sword-id']
      // Act: execute wield_threateningly with dagger
      // Assert: array is now ['sword-id', 'dagger-id']
    });

    it('should not duplicate weapon ID on repeated wield', () => {
      // Setup: actor with wielding component containing ['sword-id']
      // Act: execute wield_threateningly with same sword
      // Assert: array is still ['sword-id'], not ['sword-id', 'sword-id']
    });
  });

  describe('Description Regeneration', () => {
    it('should call REGENERATE_DESCRIPTION after adding component', () => {
      // Verify event or side effect indicating description was regenerated
    });
  });
});
```

### Test Suite 2: Activity Description

**File**: `tests/integration/mods/positioning/wieldingActivityDescription.test.js`

```javascript
/**
 * @file Integration tests for wielding activity descriptions
 * @see specs/wielding-component.md
 */

describe('Wielding Activity Description', () => {
  describe('Single Weapon', () => {
    it('should generate description for single wielded weapon', () => {
      // Setup: actor with positioning:wielding { wielded_item_ids: ['sword-id'] }
      // Act: generate activity description
      // Assert: contains "{actor} is wielding sword threateningly"
    });
  });

  describe('Multiple Weapons', () => {
    it('should format two weapons with "and"', () => {
      // { wielded_item_ids: ['sword-id', 'dagger-id'] }
      // Expected: "{actor} is wielding sword and dagger threateningly"
    });

    it('should format three weapons with Oxford comma', () => {
      // { wielded_item_ids: ['sword-id', 'dagger-id', 'staff-id'] }
      // Expected: "{actor} is wielding sword, dagger, and staff threateningly"
    });
  });

  describe('Activity Metadata', () => {
    it('should respect shouldDescribeInActivity: false', () => {
      // Setup: component with activityMetadata.shouldDescribeInActivity = false
      // Assert: wielding NOT in description
    });

    it('should order by priority', () => {
      // Setup: actor with wielding (priority 70) and hugging (priority 66)
      // Assert: wielding appears before hugging in description
    });
  });
});
```

### Test Suite 3: Edge Cases

**File**: `tests/integration/mods/weapons/wieldingEdgeCases.test.js`

```javascript
/**
 * @file Edge case tests for wielding system
 * @see specs/wielding-component.md
 */

describe('Wielding Edge Cases', () => {
  it('should handle empty wielded_item_ids array', () => {
    // Component exists with [] - valid state, no crash
  });

  it('should handle namespaced IDs correctly', () => {
    // { wielded_item_ids: ['weapons:silver_revolver'] }
  });

  it('should handle component removal gracefully', () => {
    // Remove wielding component, verify description updates
  });

  it('should handle many wielded items', () => {
    // 5+ items in array
  });

  it('should handle missing weapon entity gracefully', () => {
    // Weapon ID in array but entity doesn't exist
    // Should not crash, possibly show placeholder name
  });
});
```

### Test Suite 4: Action Gating (Future - Stubs Only)

**File**: `tests/integration/mods/weapons/wieldingActionGating.test.js`

```javascript
/**
 * @file Stub tests for future action gating based on wielding state
 * @see specs/wielding-component.md - "Future Considerations"
 *
 * NOTE: These tests document expected behavior for when action gating
 * is implemented. They should be skipped until that work is done.
 */

describe.skip('Wielding Action Gating (Future)', () => {
  it('should block approach when wielding', () => {
    // Future: wielding should add to forbidden_components for approach
  });

  it('should block hug when wielding', () => {
    // Future: cannot hug while holding weapons
  });

  it('should allow step_back when wielding', () => {
    // Should not be blocked
  });

  it('should allow put_down_weapon when wielding', () => {
    // Should not be blocked (this is how you stop wielding)
  });
});
```

## Acceptance Criteria

### Specific Tests That Must Pass

```bash
# All rule execution tests
NODE_ENV=test npx jest tests/integration/mods/weapons/wieldThreateninglyRuleExecution.test.js --no-coverage --verbose

# All activity description tests
NODE_ENV=test npx jest tests/integration/mods/positioning/wieldingActivityDescription.test.js --no-coverage --verbose

# All edge case tests
NODE_ENV=test npx jest tests/integration/mods/weapons/wieldingEdgeCases.test.js --no-coverage --verbose

# Full integration suite
NODE_ENV=test npm run test:integration -- --testPathPattern="wield" --no-coverage
```

### Invariants That Must Remain True

1. Tests use `ModTestFixture` pattern from `docs/testing/mod-testing-guide.md`
2. Tests follow existing integration test patterns
3. Tests properly clean up after each test (`afterEach`)
4. Tests use domain matchers from `tests/common/mods/domainMatchers.js`
5. Tests don't modify global state
6. Action gating tests are `describe.skip` (not implemented yet)
7. All tests are deterministic (no timing issues)

### Validation Commands

```bash
# Full validation
npm run test:integration

# Specific tests
NODE_ENV=test npx jest tests/integration/mods/weapons/wield*.test.js tests/integration/mods/positioning/wieldingActivityDescription.test.js --no-coverage --verbose

# ESLint on test files
npx eslint tests/integration/mods/weapons/wield*.test.js tests/integration/mods/positioning/wieldingActivityDescription.test.js
```

## Reference Files

Study these for test patterns:
- `tests/integration/mods/weapons/wield_threateningly_action.test.js` - Existing action test
- `tests/integration/mods/positioning/kneel_before_action.test.js` - Rule execution pattern
- `docs/testing/mod-testing-guide.md` - ModTestFixture usage

## Diff Size Estimate

Creating 4 new test files with approximately:
- `wieldThreateninglyRuleExecution.test.js`: ~120 lines
- `wieldingActivityDescription.test.js`: ~100 lines
- `wieldingEdgeCases.test.js`: ~80 lines
- `wieldingActionGating.test.js`: ~40 lines (stubs only)

Total: ~340 lines of new test code.
