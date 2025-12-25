# OPEHANNAMCOU-008: Create handler component contracts integration test

## Summary

Create a new integration test that validates all component IDs in `componentIds.js` and all event IDs in `eventIds.js` exist in the loaded mod registry. This ensures centralized constants stay in sync with actual mod definitions.

## Files to Touch

- `tests/integration/validation/handlerComponentContracts.test.js` (NEW FILE)

## Out of Scope

- DO NOT modify any handler source files
- DO NOT modify constants files
- DO NOT modify existing tests
- DO NOT modify mod JSON files

## Changes

Create new integration test file that validates:

1. All component IDs in `componentIds.js` exist in loaded mod registry
2. All event IDs in `eventIds.js` exist in loaded mod registry

### Test Structure

```javascript
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
// Import all exports from constants files
import * as componentIds from '../../../src/constants/componentIds.js';
import * as eventIds from '../../../src/constants/eventIds.js';
// Import mod loading infrastructure

describe('Handler Component Contracts', () => {
  let componentRegistry;
  let eventRegistry;

  beforeAll(async () => {
    // Load all mods using the project's mod loading infrastructure
    // Get component registry and event registry
  });

  afterAll(() => {
    // Cleanup
  });

  describe('Component ID Contracts', () => {
    it('all component IDs in componentIds.js exist in loaded mods', () => {
      const componentIdEntries = Object.entries(componentIds)
        .filter(([key]) => key.endsWith('_COMPONENT_ID'));

      for (const [constantName, componentId] of componentIdEntries) {
        expect(componentRegistry.has(componentId)).toBe(true);
        // Or: expect(() => componentRegistry.get(componentId)).not.toThrow();
      }
    });

    it('reports missing component IDs with helpful error messages', () => {
      // Verify error messages include:
      // - The component ID that's missing
      // - Available similar IDs (fuzzy match)
    });
  });

  describe('Event ID Contracts', () => {
    it('all event IDs in eventIds.js exist in loaded mods', () => {
      const eventIdEntries = Object.entries(eventIds)
        .filter(([key]) => key.endsWith('_EVENT_ID') || key.endsWith('_ID'));

      for (const [constantName, eventId] of eventIdEntries) {
        // Verify event is registered
        expect(eventRegistry.hasEventType(eventId)).toBe(true);
      }
    });
  });
});
```

## Acceptance Criteria

### Tests That Must Pass

- `NODE_ENV=test npx jest tests/integration/validation/handlerComponentContracts.test.js --no-coverage` passes
- `npx eslint tests/integration/validation/handlerComponentContracts.test.js` passes

### Invariants

- Test does not modify any state
- Test uses real mod loader, not mocks
- Test fails if constants don't match mod data
- Test provides clear error messages identifying which constant is invalid
- Test validates ALL exported constants, not just a subset

## Dependencies

- OPEHANNAMCOU-001 (adds event IDs to validate)
- OPEHANNAMCOU-002 (adds component IDs to validate)
- OPEHANNAMCOU-007 (adds container component IDs to validate)

## Implementation Order

Phase 4: Validation Tests (depends on Phase 1 completion)

## Notes

This test serves as a guard against future namespace mismatches. If someone changes a mod's namespace without updating the constants file, this test will fail with a clear error message.

Consider using dynamic import or reflection to get all exports from the constants files to ensure new constants are automatically included in validation.
