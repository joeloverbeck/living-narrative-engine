# TESDATREG-002: Add Convenience Method for Loading Dependency Conditions

**Priority**: Medium
**Category**: Testing Infrastructure
**Timeline**: Mid-term (Next Sprint)
**Effort**: Medium (1-2 days)
**Related Report**: reports/test-dataregistry-scope-dsl-issues.md

## Overview

Add a convenience method to `ModTestFixture` that simplifies loading conditions from dependency mods. This eliminates the need for tests to manually extend the `dataRegistry.getConditionDefinition` mock when testing custom scopes that reference dependency conditions.

## Problem Statement

Currently, when testing mods with custom scopes that use `condition_ref` to reference conditions from dependency mods, developers must:

1. Manually import the condition JSON file
2. Save the original `getConditionDefinition` function
3. Create a new mock function that checks for specific condition IDs
4. Chain back to the original for other IDs

This is verbose (10+ lines of boilerplate), error-prone, and requires understanding of mock implementation details. Each test must know about all transitive condition dependencies.

### Current Manual Pattern

```javascript
// Current workaround - verbose and fragile
const positioningCondition = await import(
  '../../../../data/mods/positioning/conditions/actor-in-entity-facing-away.condition.json',
  { assert: { type: 'json' } }
);

const originalGetCondition = testFixture.testEnv.dataRegistry.getConditionDefinition;
testFixture.testEnv.dataRegistry.getConditionDefinition = jest.fn((id) => {
  if (id === 'positioning:actor-in-entity-facing-away') {
    return positioningCondition.default;
  }
  return originalGetCondition(id);
});
```

## Success Criteria

- [ ] New method `loadDependencyConditions()` added to ModTestFixture
- [ ] Method accepts array of condition IDs in format `modId:conditionId`
- [ ] Method automatically loads condition files from correct mod directories
- [ ] Method extends `dataRegistry.getConditionDefinition` mock transparently
- [ ] Method chains properly for multiple calls (additive behavior)
- [ ] Method handles missing condition files with clear error messages
- [ ] Method is tested with unit tests (90%+ coverage)
- [ ] Method is tested with integration tests using real mod data
- [ ] Documentation updated in mod-testing-guide.md
- [ ] Existing tests refactored to use new method

## Proposed API

### Method Signature

```javascript
/**
 * Loads condition definitions from dependency mods and makes them available
 * in the test environment's dataRegistry.
 *
 * @param {string[]} conditionIds - Array of condition IDs in format "modId:conditionId"
 * @throws {Error} If condition file cannot be loaded or ID format is invalid
 * @returns {Promise<void>}
 *
 * @example
 * // Load single condition
 * await testFixture.loadDependencyConditions([
 *   'positioning:actor-in-entity-facing-away'
 * ]);
 *
 * @example
 * // Load multiple conditions (additive)
 * await testFixture.loadDependencyConditions([
 *   'positioning:actor-in-entity-facing-away',
 *   'positioning:entity-not-in-facing-away'
 * ]);
 */
async loadDependencyConditions(conditionIds)
```

### Usage Example

```javascript
describe('insert_finger_into_asshole Action Discovery', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'sex-anal-penetration',
      'sex-anal-penetration:insert_finger_into_asshole'
    );

    // NEW: Simple one-liner replaces 10+ lines of boilerplate
    await testFixture.loadDependencyConditions([
      'positioning:actor-in-entity-facing-away',
      'positioning:entity-not-in-facing-away'
    ]);

    // Manual scope registration still needed (addressed in TESDATREG-004)
    const scopeDef = await parseScopeDefinitions(/* ... */);
    // ...register scope resolver...
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  it('should discover action when conditions are met', async () => {
    // Test implementation
  });
});
```

## Implementation Details

### File to Modify

**Target**: `tests/common/mods/ModTestFixture.js`

### Implementation Location

Add the method to the `ModTestFixture` class around line 450 (after `executeAction` method).

### Implementation Approach

```javascript
class ModTestFixture {
  #loadedConditions = new Map(); // Track loaded conditions for error messages

  /**
   * Loads condition definitions from dependency mods and makes them available
   * in the test environment's dataRegistry.
   */
  async loadDependencyConditions(conditionIds) {
    // Validate input
    if (!Array.isArray(conditionIds)) {
      throw new Error('conditionIds must be an array');
    }

    // Load each condition
    const loadPromises = conditionIds.map(async (id) => {
      // Validate ID format
      if (typeof id !== 'string' || !id.includes(':')) {
        throw new Error(`Invalid condition ID format: "${id}". Expected "modId:conditionId"`);
      }

      const [modId, conditionId] = id.split(':');

      // Construct file path
      const conditionPath = `../../../../data/mods/${modId}/conditions/${conditionId}.condition.json`;

      try {
        // Load condition file
        const conditionModule = await import(conditionPath, { assert: { type: 'json' } });
        const conditionDef = conditionModule.default;

        // Store for later lookup
        this.#loadedConditions.set(id, conditionDef);

        return { id, conditionDef };
      } catch (err) {
        throw new Error(
          `Failed to load condition "${id}" from ${conditionPath}: ${err.message}`
        );
      }
    });

    // Wait for all conditions to load
    await Promise.all(loadPromises);

    // Extend the dataRegistry mock
    const original = this.testEnv.dataRegistry.getConditionDefinition;
    this.testEnv.dataRegistry.getConditionDefinition = jest.fn((id) => {
      // Check if this is one of our loaded conditions
      if (this.#loadedConditions.has(id)) {
        return this.#loadedConditions.get(id);
      }
      // Chain to original (may be another extended version)
      return original(id);
    });
  }
}
```

### Edge Cases to Handle

1. **Invalid condition ID format**:
   - Missing colon: `"actor-in-entity-facing-away"`
   - Multiple colons: `"mod:sub:condition"`
   - Empty parts: `":condition"` or `"mod:"`

2. **File not found**:
   - Wrong mod ID
   - Wrong condition ID
   - File doesn't exist in expected location

3. **Multiple calls to `loadDependencyConditions`**:
   - Should be additive (not replace previous conditions)
   - Should handle loading same condition twice (idempotent)

4. **Condition file format issues**:
   - Invalid JSON
   - Missing required fields

### Error Messages

Error messages should be developer-friendly and actionable:

```javascript
// Example error messages
`Invalid condition ID format: "actor-facing-away". Expected "modId:conditionId"`

`Failed to load condition "positioning:actor-facing-away" from ../../../../data/mods/positioning/conditions/actor-facing-away.condition.json: File not found

Did you mean one of these?
  - positioning:actor-in-entity-facing-away
  - positioning:actor-in-entity-facing-toward`

`Condition "positioning:actor-in-entity-facing-away" was already loaded. Skipping duplicate.`
```

## Testing Requirements

### Unit Tests

Create `tests/unit/common/mods/ModTestFixture.loadDependencyConditions.test.js`:

```javascript
describe('ModTestFixture - loadDependencyConditions', () => {
  describe('Input Validation', () => {
    it('should throw when conditionIds is not an array', async () => {
      const fixture = await ModTestFixture.forAction('test', 'test:action');
      await expect(
        fixture.loadDependencyConditions('not-array')
      ).rejects.toThrow('conditionIds must be an array');
    });

    it('should throw when condition ID is missing colon', async () => {
      const fixture = await ModTestFixture.forAction('test', 'test:action');
      await expect(
        fixture.loadDependencyConditions(['invalid-format'])
      ).rejects.toThrow('Invalid condition ID format');
    });

    it('should throw when condition ID has empty modId', async () => {
      const fixture = await ModTestFixture.forAction('test', 'test:action');
      await expect(
        fixture.loadDependencyConditions([':condition'])
      ).rejects.toThrow('Invalid condition ID format');
    });

    it('should throw when condition ID has empty conditionId', async () => {
      const fixture = await ModTestFixture.forAction('test', 'test:action');
      await expect(
        fixture.loadDependencyConditions(['mod:'])
      ).rejects.toThrow('Invalid condition ID format');
    });
  });

  describe('Condition Loading', () => {
    it('should load valid condition from dependency mod', async () => {
      const fixture = await ModTestFixture.forAction('test', 'test:action');

      await fixture.loadDependencyConditions([
        'positioning:actor-in-entity-facing-away'
      ]);

      // Verify condition is available in dataRegistry
      const condition = fixture.testEnv.dataRegistry.getConditionDefinition(
        'positioning:actor-in-entity-facing-away'
      );
      expect(condition).toBeDefined();
      expect(condition.id).toBe('positioning:actor-in-entity-facing-away');
    });

    it('should throw clear error when condition file not found', async () => {
      const fixture = await ModTestFixture.forAction('test', 'test:action');

      await expect(
        fixture.loadDependencyConditions(['positioning:nonexistent'])
      ).rejects.toThrow(/Failed to load condition.*nonexistent/);
    });

    it('should load multiple conditions at once', async () => {
      const fixture = await ModTestFixture.forAction('test', 'test:action');

      await fixture.loadDependencyConditions([
        'positioning:actor-in-entity-facing-away',
        'positioning:entity-not-in-facing-away'
      ]);

      const condition1 = fixture.testEnv.dataRegistry.getConditionDefinition(
        'positioning:actor-in-entity-facing-away'
      );
      const condition2 = fixture.testEnv.dataRegistry.getConditionDefinition(
        'positioning:entity-not-in-facing-away'
      );

      expect(condition1).toBeDefined();
      expect(condition2).toBeDefined();
    });
  });

  describe('Additive Behavior', () => {
    it('should allow multiple calls to loadDependencyConditions', async () => {
      const fixture = await ModTestFixture.forAction('test', 'test:action');

      // First call
      await fixture.loadDependencyConditions([
        'positioning:actor-in-entity-facing-away'
      ]);

      // Second call (additive)
      await fixture.loadDependencyConditions([
        'positioning:entity-not-in-facing-away'
      ]);

      // Both should be available
      const condition1 = fixture.testEnv.dataRegistry.getConditionDefinition(
        'positioning:actor-in-entity-facing-away'
      );
      const condition2 = fixture.testEnv.dataRegistry.getConditionDefinition(
        'positioning:entity-not-in-facing-away'
      );

      expect(condition1).toBeDefined();
      expect(condition2).toBeDefined();
    });

    it('should handle loading same condition twice (idempotent)', async () => {
      const fixture = await ModTestFixture.forAction('test', 'test:action');

      await fixture.loadDependencyConditions([
        'positioning:actor-in-entity-facing-away'
      ]);

      // Should not throw
      await expect(
        fixture.loadDependencyConditions([
          'positioning:actor-in-entity-facing-away'
        ])
      ).resolves.not.toThrow();
    });
  });

  describe('Mock Chaining', () => {
    it('should chain to original getConditionDefinition for unknown IDs', async () => {
      const fixture = await ModTestFixture.forAction('test', 'test:action');

      // Set up original mock behavior
      const originalMock = fixture.testEnv.dataRegistry.getConditionDefinition;
      originalMock.mockReturnValue({ id: 'original:condition' });

      await fixture.loadDependencyConditions([
        'positioning:actor-in-entity-facing-away'
      ]);

      // Should use loaded condition
      const loaded = fixture.testEnv.dataRegistry.getConditionDefinition(
        'positioning:actor-in-entity-facing-away'
      );
      expect(loaded.id).toBe('positioning:actor-in-entity-facing-away');

      // Should chain to original for unknown IDs
      const original = fixture.testEnv.dataRegistry.getConditionDefinition(
        'unknown:condition'
      );
      expect(original.id).toBe('original:condition');
    });
  });
});
```

### Integration Tests

Create `tests/integration/common/ModTestFixture.loadDependencyConditions.integration.test.js`:

```javascript
describe('ModTestFixture - loadDependencyConditions Integration', () => {
  it('should work with real mod test that uses custom scopes', async () => {
    const testFixture = await ModTestFixture.forAction(
      'sex-anal-penetration',
      'sex-anal-penetration:insert_finger_into_asshole'
    );

    // Load dependency conditions using new method
    await testFixture.loadDependencyConditions([
      'positioning:actor-in-entity-facing-away'
    ]);

    // Register custom scope (still manual for now)
    const scopeDef = await parseScopeDefinitions(
      path.join(__dirname, '../../../data/mods/sex-anal-penetration/scopes/actors_with_exposed_asshole_accessible_from_behind.scope')
    );

    // ... rest of test setup and execution ...

    // Should successfully discover action
    const actions = await testFixture.discoverAvailableActions(actorId);
    expect(actions).toContainEqual(
      expect.objectContaining({
        actionId: 'sex-anal-penetration:insert_finger_into_asshole'
      })
    );
  });
});
```

## Refactoring Existing Tests

After implementing the method, refactor these tests to use it:

1. `tests/integration/mods/sex-anal-penetration/insert_finger_into_asshole_action_discovery.test.js`
2. `tests/integration/mods/sex-anal-penetration/insert_multiple_fingers_into_asshole_action_discovery.test.js`

Before/After comparison:

```javascript
// BEFORE (10+ lines)
const positioningCondition = await import(
  '../../../../data/mods/positioning/conditions/actor-in-entity-facing-away.condition.json',
  { assert: { type: 'json' } }
);
const originalGetCondition = testFixture.testEnv.dataRegistry.getConditionDefinition;
testFixture.testEnv.dataRegistry.getConditionDefinition = jest.fn((id) => {
  if (id === 'positioning:actor-in-entity-facing-away') {
    return positioningCondition.default;
  }
  return originalGetCondition(id);
});

// AFTER (1 line)
await testFixture.loadDependencyConditions([
  'positioning:actor-in-entity-facing-away'
]);
```

## Documentation Updates

Update `docs/testing/mod-testing-guide.md`:

1. Add new section "Loading Dependency Conditions" after custom scope section
2. Update code examples to use new method
3. Add troubleshooting entry for condition loading errors
4. Update best practices to recommend using this method

## Acceptance Tests

- [ ] Method loads single condition correctly
- [ ] Method loads multiple conditions in one call
- [ ] Method is additive across multiple calls
- [ ] Method validates condition ID format
- [ ] Method provides clear error when file not found
- [ ] Method chains to original mock for unknown IDs
- [ ] Method handles duplicate loads gracefully (idempotent)
- [ ] Unit tests achieve 90%+ code coverage
- [ ] Integration test passes with real mod data
- [ ] Existing tests refactored successfully
- [ ] Documentation updated and accurate
- [ ] No performance regression (loading 10 conditions < 100ms)

## Dependencies

- None (standalone feature)

## Blockers

None

## Related Tickets

- **TESDATREG-001**: Documentation ticket (documents current workaround, will update to show new method)
- **TESDATREG-003**: Auto-load conditions (builds on this by automating the condition ID discovery)
- **TESDATREG-004**: Custom scope helper (will use this method internally)

## Implementation Checklist

- [ ] Add private field `#loadedConditions` to ModTestFixture
- [ ] Implement `loadDependencyConditions()` method
- [ ] Add input validation for conditionIds array
- [ ] Add condition ID format validation
- [ ] Implement file path construction logic
- [ ] Implement condition file loading with error handling
- [ ] Implement dataRegistry mock extension with chaining
- [ ] Add clear error messages for all failure cases
- [ ] Create unit test file with 15+ test cases
- [ ] Create integration test file with real mod data
- [ ] Achieve 90%+ code coverage in unit tests
- [ ] Refactor 2 existing test files to use new method
- [ ] Update mod-testing-guide.md documentation
- [ ] Add JSDoc comments to method
- [ ] Run full test suite to ensure no regressions
- [ ] Run `npm run typecheck` to verify types
- [ ] Run `npx eslint` on modified files
