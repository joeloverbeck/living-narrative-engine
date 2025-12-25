# OPEHANNAMCOU-008: Create handler component contracts integration test

## Summary

Create a new integration test that validates all component IDs in `componentIds.js` and all mod-defined event IDs in `eventIds.js` exist in the loaded mod registry. This ensures centralized constants stay in sync with actual mod definitions, while acknowledging that some event constants currently represent non-mod system events.

## Files to Touch

- `tests/integration/validation/handlerComponentContracts.test.js` (NEW FILE)

## Out of Scope

- DO NOT modify any handler source files
- DO NOT modify constants files
- DO NOT modify existing tests
- DO NOT modify mod JSON files

## Assumptions Reassessed

- `eventIds.js` exports several event IDs that do **not** have mod JSON definitions today. These are currently system-only/runtime events and will fail a strict parity check.
- `eventIds.js` uses mixed naming patterns (`*_ID`, `*_EVENT_ID`, and other suffixes), so suffix filtering misses some exported constants.
- The ModsLoader `GameConfigPhase` overwrites requested mods from `data/game.json`, so the test must control the game config to load the required mods.

## Changes

Create new integration test file that validates:

1. All component IDs in `componentIds.js` exist in loaded mod registry
2. All **mod-defined** event IDs in `eventIds.js` exist in loaded mod registry

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
    it('all mod-defined event IDs in eventIds.js exist in loaded mods', () => {
      const eventIdEntries = Object.entries(eventIds)
        .filter(([, value]) => typeof value === 'string');

      for (const [constantName, eventId] of eventIdEntries) {
        if (EXCLUDED_EVENT_IDS.has(eventId)) {
          continue;
        }
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
- Test validates ALL exported constants, not just a subset, **except** the explicitly excluded system-only event IDs listed below.

## Dependencies

- OPEHANNAMCOU-001 (adds event IDs to validate)
- OPEHANNAMCOU-002 (adds component IDs to validate)
- OPEHANNAMCOU-007 (adds container component IDs to validate)

## Implementation Order

Phase 4: Validation Tests (depends on Phase 1 completion)

## Notes

This test serves as a guard against future namespace mismatches. If someone changes a mod's namespace without updating the constants file, this test will fail with a clear error message.

Consider using dynamic import or reflection to get all exports from the constants files to ensure new constants are automatically included in validation.

### Explicit Exclusions (system-only events with no mod JSON today)

- `core:action_execution_started`
- `core:action_execution_completed`
- `core:action_execution_failed`
- `core:action_validation_failed`
- `core:ai_decision_requested`
- `core:ai_decision_received`
- `core:ai_decision_failed`
- `core:ui_operation_failed`
- `core:ui_show_llm_prompt_preview`
- `core:portrait_clicked`
- `initialization:initialization_service:failed`
- `ui:show_fatal_error`
- `worldinit:entity_instantiation_failed`

These should be revisited if/when mod JSON event definitions are added.

## Status

Completed

## Outcome

- Added an integration test that loads the relevant mods and validates component IDs and mod-defined event IDs against registry `_fullId` values.
- Excluded the known system-only event IDs that do not have mod JSON definitions yet.
- Test now uses the real loader pipeline with a controlled `data/game.json` to ensure registry coverage.
