# OPEHANARCANA-005: PREPARE_ACTION_CONTEXT Integration Tests

**Status:** Completed
**Priority:** Critical (Phase 1)
**Estimated Effort:** 0.5 days
**Dependencies:** OPEHANARCANA-003 (DI registration), OPEHANARCANA-004 (unit tests)

---

## Objective

Create integration tests that verify `PREPARE_ACTION_CONTEXT` works correctly:
1. With the full DI container
2. Within rule execution context
3. Before the `core:logSuccessAndEndTurn` macro
4. Produces identical behavior to the expanded pattern

---

## Files to Touch

### New Files
- `tests/integration/logic/operationHandlers/prepareActionContext.integration.test.js`

---

## Out of Scope

**DO NOT modify:**
- The handler implementation file
- Any schema files
- Any DI registration files
- Any unit test files
- Any rule files (migrations are separate tickets)
- Any existing integration test files

---

## Outcome

- Created `tests/integration/logic/operationHandlers/prepareActionContext.integration.test.js` with comprehensive test scenarios.
- Extended `ModTestFixture` with `executeOperation` method to support direct operation execution testing.
- Registered `PREPARE_ACTION_CONTEXT` in `ModTestHandlerFactory.createStandardHandlers` to ensure it is available in test environments.
- Verified that `PREPARE_ACTION_CONTEXT` correctly resolves context variables including actor name, target name, location, and optional secondary entity name.
- Confirmed equivalence between `PREPARE_ACTION_CONTEXT` and the legacy manual context setup pattern.
- Added edge case coverage for missing components and fallback behaviors.

All integration tests passed successfully.

---

## Implementation Details

### Test Scenarios

```javascript
/**
 * @file Integration tests for PREPARE_ACTION_CONTEXT operation
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';

describe('PREPARE_ACTION_CONTEXT Integration', () => {
  let fixture;

  afterEach(async () => {
    if (fixture) {
      await fixture.cleanup();
    }
  });

  describe('context preparation', () => {
    it('should set all required context variables', async () => {
      // Create test fixture with minimal setup
      fixture = await ModTestFixture.forRule('core', 'core:test_prepare_context');

      // Create test entities
      const actor = fixture.createEntity({
        id: 'test-actor',
        components: {
          'core:actor': { name: 'Alice' },
          'core:position': { locationId: 'test-location' },
        },
      });

      const target = fixture.createEntity({
        id: 'test-target',
        components: {
          'core:actor': { name: 'Bob' },
        },
      });

      // Execute operation directly
      const context = await fixture.executeOperation('PREPARE_ACTION_CONTEXT', {
        event: {
          payload: {
            actorId: actor.id,
            targetId: target.id,
          },
        },
        parameters: {},
      });

      // Verify context variables
      expect(context.actorName).toBe('Alice');
      expect(context.targetName).toBe('Bob');
      expect(context.locationId).toBe('test-location');
      expect(context.targetId).toBe(target.id);
      expect(context.perceptionType).toBe('action_target_general');
    });
  });

  // ... (rest of the tests)
});
```

---

## Acceptance Criteria

### Tests That Must Pass

1. **All integration tests pass:**
   ```bash
   npm run test:integration -- tests/integration/logic/operationHandlers/prepareActionContext.integration.test.js
   ```

2. **Full integration suite passes:**
   ```bash
   npm run test:integration
   ```

3. **Full CI passes:**
   ```bash
   npm run test:ci
   ```

### Invariants That Must Remain True

1. No modifications to handler or DI files
2. No modifications to existing integration tests
3. Tests use project's standard ModTestFixture pattern
4. All tests are isolated and clean up properly

---

## Verification Steps

```bash
# 1. Run the specific integration test file
npm run test:integration -- tests/integration/logic/operationHandlers/prepareActionContext.integration.test.js --verbose

# 2. Verify no other integration tests are broken
npm run test:integration

# 3. Run full CI suite
npm run test:ci

# 4. Lint the test file
npx eslint tests/integration/logic/operationHandlers/prepareActionContext.integration.test.js
```

---

## Reference Files

- Test fixture: `tests/common/mods/ModTestFixture.js`
- Integration pattern: `tests/integration/mods/affection/brush_hand_action.test.js`
- Rule execution: `tests/integration/logic/ruleExecutionFlow.test.js`
