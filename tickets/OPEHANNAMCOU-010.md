# OPEHANNAMCOU-010: Create namespace mismatch regression test

## Summary

Create a regression test that specifically reproduces the namespace mismatch scenario from ITEMSPLIT-007 to ensure the fix prevents silent failures.

## Files to Touch

- `tests/integration/validation/namespaceMismatchRegression.test.js` (NEW FILE)

## Out of Scope

- DO NOT modify any handler source files
- DO NOT modify constants files
- DO NOT modify existing tests
- DO NOT modify mod JSON files

## Changes

Create regression test that simulates namespace mismatch detection:

### Test Structure

```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

describe('Namespace Mismatch Regression', () => {
  describe('ITEMSPLIT-007 Regression', () => {
    it('detects namespace mismatches during validation', () => {
      // Scenario: Handler expects 'drinking:drinkable' but registry has 'items:drinkable'
      // This reproduces the exact failure from ITEMSPLIT-007

      // Setup mock componentRegistry with 'items:drinkable' (wrong namespace)
      const mockRegistry = new Map();
      mockRegistry.set('items:drinkable', { /* component data */ });

      // Attempt to validate 'drinking:drinkable' (correct namespace)
      const result = validateComponentId('drinking:drinkable', mockRegistry);

      // Should detect the mismatch
      expect(result.valid).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('provides helpful error message with available similar IDs', () => {
      const mockRegistry = new Map();
      mockRegistry.set('items:drinkable', {});
      mockRegistry.set('items:empty', {});
      mockRegistry.set('core:actor', {});

      const result = validateComponentId('drinking:drinkable', mockRegistry);

      // Error should suggest similar IDs
      expect(result.suggestions).toContain('items:drinkable');
      // Or: expect(result.error).toMatch(/similar.*items:drinkable/i);
    });

    it('handler returns explicit error instead of silent null interpretation', () => {
      // Scenario: getComponentData returns null for wrong namespace
      // Handler should NOT interpret this as "component doesn't exist on entity"
      // Handler SHOULD recognize this as "component ID is invalid"

      // This is the core of the ITEMSPLIT-007 bug:
      // entityManager.getComponentData('entity', 'items:drinkable') returned null
      // Handler interpreted null as "entity is not drinkable"
      // But the real issue was the component ID didn't exist in the registry

      // Verify the fix: validation should catch this before handler logic runs
    });
  });

  describe('Namespace Extraction', () => {
    it('correctly extracts namespace from component ID', () => {
      expect(extractNamespace('drinking:drinkable')).toBe('drinking');
      expect(extractNamespace('core:actor')).toBe('core');
      expect(extractNamespace('containers-core:liquid_container')).toBe('containers-core');
    });

    it('handles edge cases in namespace extraction', () => {
      expect(extractNamespace('invalid')).toBeNull();
      expect(extractNamespace(':missing_namespace')).toBeNull();
      expect(extractNamespace('missing_identifier:')).toBeNull();
    });
  });

  describe('Fuzzy Matching for Suggestions', () => {
    it('suggests IDs with matching identifier but different namespace', () => {
      const registry = new Map([
        ['items:drinkable', {}],
        ['core:drinkable', {}],
        ['drinking:empty', {}],
      ]);

      const suggestions = findSimilarIds('drinking:drinkable', registry);

      expect(suggestions).toContain('items:drinkable');
      expect(suggestions).toContain('core:drinkable');
    });

    it('suggests IDs with matching namespace but similar identifier', () => {
      const registry = new Map([
        ['drinking:drink', {}],
        ['drinking:drinkables', {}],
        ['drinking:empty', {}],
      ]);

      const suggestions = findSimilarIds('drinking:drinkable', registry);

      expect(suggestions).toContain('drinking:drink');
      expect(suggestions).toContain('drinking:drinkables');
    });
  });
});
```

## Acceptance Criteria

### Tests That Must Pass

- `NODE_ENV=test npx jest tests/integration/validation/namespaceMismatchRegression.test.js --no-coverage` passes
- `npx eslint tests/integration/validation/namespaceMismatchRegression.test.js` passes

### Invariants

- Test reproduces the exact failure scenario from ITEMSPLIT-007
- Test verifies the fix prevents silent failures
- Test validates error messages are actionable
- Test covers namespace extraction edge cases
- Test covers fuzzy matching for suggestions

## Dependencies

None - this test can be implemented independently as it uses mocks

## Implementation Order

Phase 4: Validation Tests (can be done in parallel with other Phase 4 tickets)

## Notes

This is specifically a regression test to ensure the ITEMSPLIT-007 bug cannot recur. The test should:

1. Reproduce the exact failure conditions
2. Verify the system now catches the error
3. Verify the error message helps developers fix the issue

Consider adding a comment in the test file with a link to the ITEMSPLIT-007 ticket or spec for context.
