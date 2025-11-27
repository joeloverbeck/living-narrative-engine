# PERPARHEAANDNARTHR-012: Integration Tests

**Status:** Ready
**Priority:** High (Phase 4)
**Estimated Effort:** 1-1.5 days
**Dependencies:** All other tickets in this epic (001-011)

---

## Objective

Create comprehensive integration tests that validate the complete per-part health system works end-to-end, including component creation, health modification, state transitions, and event dispatching.

---

## Files to Touch

### New Files
- `tests/integration/mods/anatomy/partHealthLifecycle.integration.test.js`
- `tests/integration/mods/anatomy/partHealthStateTransitions.integration.test.js`

### Modified Files
- None

---

## Out of Scope

**DO NOT modify:**
- Any source code files
- Any schema files
- Any component/event/lookup files
- Unit test files (those are in handler tickets)
- Any existing integration tests

---

## Implementation Details

### Test File 1: Lifecycle Integration Tests

Create `tests/integration/mods/anatomy/partHealthLifecycle.integration.test.js`:

```javascript
/**
 * @file Integration tests for per-part health lifecycle
 * @description Tests full lifecycle: create part with health, modify, verify events
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
// Import test utilities following project patterns

describe('Part Health Lifecycle', () => {
  // Test setup with entity manager, event bus, operation interpreter

  describe('Full lifecycle', () => {
    it('should create a part entity with health component', async () => {
      // Create entity
      // Add anatomy:part component
      // Add anatomy:part_health component with initial values
      // Verify component values are set correctly
    });

    it('should modify health and receive health_changed event', async () => {
      // Create part with health
      // Execute MODIFY_PART_HEALTH with negative delta
      // Verify event dispatched with correct payload
      // Verify component updated correctly
    });

    it('should update state and receive state_changed event', async () => {
      // Create part with health at 80% (healthy)
      // Damage to 60% (still healthy, above 75% threshold)
      // Execute UPDATE_PART_HEALTH_STATE
      // Verify NO state_changed event (still healthy)

      // Damage to 70% (now bruised, crossed 75% threshold)
      // Execute UPDATE_PART_HEALTH_STATE
      // Verify state_changed event dispatched
    });

    it('should track turnsInState correctly', async () => {
      // Create part in healthy state
      // Call UPDATE_PART_HEALTH_STATE multiple times without crossing threshold
      // Verify turnsInState increments
      // Cross threshold
      // Verify turnsInState resets to 0
    });
  });

  describe('Multiple parts', () => {
    it('should handle operations on different parts independently', async () => {
      // Create two part entities with health
      // Damage one, heal the other
      // Verify each has correct independent state
    });
  });

  describe('Edge cases', () => {
    it('should handle 0% health (destroyed state)', async () => {
      // Create part
      // Damage to exactly 0
      // Verify state is 'destroyed'
      // Verify clamping prevents negative health
    });

    it('should handle 100% health correctly', async () => {
      // Create part at 100%
      // Verify state is 'healthy'
      // Try to heal beyond max
      // Verify clamping prevents exceeding maxHealth
    });

    it('should handle exact threshold boundaries', async () => {
      // Test at exactly 75%, 50%, 25%, 0%
      // 75% should be bruised (not healthy, since > 75 = healthy)
      // 50% should be wounded
      // 25% should be badly_damaged
      // 0% should be destroyed
    });
  });
});
```

### Test File 2: State Transition Tests

Create `tests/integration/mods/anatomy/partHealthStateTransitions.integration.test.js`:

```javascript
/**
 * @file Integration tests for health state transitions
 * @description Tests all possible state transitions and event correctness
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

describe('Part Health State Transitions', () => {
  describe('Deterioration (damage)', () => {
    it('should transition healthy -> bruised', async () => {
      // Start at 80%, damage to 70%
      // Verify state transition and isDeterioration = true
    });

    it('should transition healthy -> wounded (skipping bruised)', async () => {
      // Start at 80%, massive damage to 40%
      // Verify state changes to wounded
    });

    it('should transition through all states to destroyed', async () => {
      // Start at 100%
      // Progressive damage through each state
      // Verify each transition event with correct previousState/newState
    });
  });

  describe('Recovery (healing)', () => {
    it('should transition bruised -> healthy', async () => {
      // Start at 70% (bruised)
      // Heal to 80%
      // Verify state transition and isDeterioration = false
    });

    it('should transition destroyed -> badly_damaged', async () => {
      // Start at 0% (destroyed)
      // Heal to 10%
      // Verify state transition
    });
  });

  describe('Event payload validation', () => {
    it('should include all required fields in part_health_changed event', async () => {
      // Modify health
      // Capture event
      // Verify all fields: partEntityId, ownerEntityId, partType,
      //   previousHealth, newHealth, maxHealth, healthPercentage, delta, timestamp
    });

    it('should include all required fields in part_state_changed event', async () => {
      // Trigger state change
      // Capture event
      // Verify all fields: partEntityId, ownerEntityId, partType,
      //   previousState, newState, turnsInPreviousState, healthPercentage,
      //   isDeterioration, timestamp
    });

    it('should NOT dispatch state_changed when state unchanged', async () => {
      // Modify health without crossing threshold
      // Verify health_changed dispatched
      // Verify state_changed NOT dispatched
    });
  });
});
```

---

## Acceptance Criteria

### Tests That Must Pass

1. **New integration tests:**
   ```bash
   NODE_ENV=test npx jest tests/integration/mods/anatomy/partHealthLifecycle.integration.test.js --no-coverage --verbose
   NODE_ENV=test npx jest tests/integration/mods/anatomy/partHealthStateTransitions.integration.test.js --no-coverage --verbose
   ```

2. **All anatomy integration tests:**
   ```bash
   NODE_ENV=test npx jest tests/integration/mods/anatomy/ --no-coverage
   ```

3. **Full test suite:**
   ```bash
   npm run test:ci
   ```

### Invariants That Must Remain True

1. All existing tests continue to pass
2. Tests follow project testing patterns (use test utilities from `/tests/common/`)
3. Tests clean up after themselves (no leaked entities)
4. Coverage of new code reaches 80%+ branches
5. All state boundaries are tested (75%, 50%, 25%, 0%)

---

## Test Scenarios Checklist

### Lifecycle Tests
- [ ] Create part with health component
- [ ] Modify health (damage)
- [ ] Modify health (healing)
- [ ] Update state after health change
- [ ] Track turnsInState increment
- [ ] Track turnsInState reset
- [ ] Multiple parts independent operation

### Boundary Tests
- [ ] Health at 100% (healthy)
- [ ] Health at 76% (healthy, just above threshold)
- [ ] Health at 75% (bruised, at threshold)
- [ ] Health at 51% (bruised, just above threshold)
- [ ] Health at 50% (wounded, at threshold)
- [ ] Health at 26% (wounded, just above threshold)
- [ ] Health at 25% (badly_damaged, at threshold)
- [ ] Health at 1% (badly_damaged, just above zero)
- [ ] Health at 0% (destroyed)

### Event Tests
- [ ] health_changed event on any modification
- [ ] state_changed event ONLY on threshold crossing
- [ ] state_changed NOT dispatched when state unchanged
- [ ] All payload fields correct

### Error Handling Tests
- [ ] Operation on non-existent entity
- [ ] Operation on entity without part_health component

---

## Verification Steps

```bash
# 1. Run new integration tests
NODE_ENV=test npx jest tests/integration/mods/anatomy/partHealth*.integration.test.js --no-coverage --verbose

# 2. Run all anatomy tests
NODE_ENV=test npx jest tests/integration/mods/anatomy/ --no-coverage

# 3. Run full integration suite
npm run test:integration

# 4. Run full test suite
npm run test:ci

# 5. Check coverage of new handler code
NODE_ENV=test npx jest tests/unit/logic/operationHandlers/modifyPartHealthHandler.test.js tests/unit/logic/operationHandlers/updatePartHealthStateHandler.test.js --coverage
```

---

## Reference Files

- Test patterns: `tests/integration/mods/positioning/` (similar mod integration tests)
- Test utilities: `tests/common/testBed.js`
- Fixture patterns: `tests/common/mods/` (ModTestFixture if applicable)
- Handler unit tests: `tests/unit/logic/operationHandlers/updateHungerStateHandler.test.js`
