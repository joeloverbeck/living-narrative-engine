# OPEHANARCANA-005: PREPARE_ACTION_CONTEXT Integration Tests

**Status:** Ready
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

  describe('equivalence to expanded pattern', () => {
    it('should produce same result as manual context setup', async () => {
      fixture = await ModTestFixture.forRule('affection', 'affection:handle_brush_hand');

      // Create entities
      const actor = fixture.createEntity({
        id: 'actor-1',
        components: {
          'core:actor': { name: 'Charlie' },
          'core:position': { locationId: 'room-1' },
        },
      });

      const target = fixture.createEntity({
        id: 'target-1',
        components: {
          'core:actor': { name: 'Dana' },
        },
      });

      // Execute with PREPARE_ACTION_CONTEXT
      const newContext = await fixture.executeOperation('PREPARE_ACTION_CONTEXT', {
        event: {
          payload: { actorId: actor.id, targetId: target.id },
        },
        parameters: {},
      });

      // Execute manual pattern (simulating old approach)
      const manualContext = {};
      manualContext.actorName = 'Charlie'; // Would come from GET_NAME
      manualContext.targetName = 'Dana';   // Would come from GET_NAME
      manualContext.locationId = 'room-1'; // Would come from QUERY_COMPONENT + SET_VARIABLE
      manualContext.targetId = target.id;  // Would come from SET_VARIABLE
      manualContext.perceptionType = 'action_target_general'; // Would come from SET_VARIABLE

      // Verify equivalence
      expect(newContext.actorName).toBe(manualContext.actorName);
      expect(newContext.targetName).toBe(manualContext.targetName);
      expect(newContext.locationId).toBe(manualContext.locationId);
      expect(newContext.targetId).toBe(manualContext.targetId);
      expect(newContext.perceptionType).toBe(manualContext.perceptionType);
    });
  });

  describe('item name resolution', () => {
    it('should resolve item names for item entities', async () => {
      fixture = await ModTestFixture.forRule('items', 'items:handle_give_item');

      // Create actor and item target
      const actor = fixture.createEntity({
        id: 'giver',
        components: {
          'core:actor': { name: 'Eve' },
          'core:position': { locationId: 'market' },
        },
      });

      const item = fixture.createEntity({
        id: 'sword-1',
        components: {
          'core:item': { name: 'Iron Sword' },
        },
      });

      const context = await fixture.executeOperation('PREPARE_ACTION_CONTEXT', {
        event: {
          payload: { actorId: actor.id, targetId: item.id },
        },
        parameters: {},
      });

      expect(context.actorName).toBe('Eve');
      expect(context.targetName).toBe('Iron Sword');
    });
  });

  describe('secondary entity support', () => {
    it('should resolve secondary entity when include_secondary is true', async () => {
      fixture = await ModTestFixture.forRule('items', 'items:handle_give_item');

      const actor = fixture.createEntity({
        id: 'giver',
        components: {
          'core:actor': { name: 'Frank' },
          'core:position': { locationId: 'loc-1' },
        },
      });

      const target = fixture.createEntity({
        id: 'receiver',
        components: {
          'core:actor': { name: 'Grace' },
        },
      });

      const item = fixture.createEntity({
        id: 'item-1',
        components: {
          'core:item': { name: 'Gold Ring' },
        },
      });

      const context = await fixture.executeOperation('PREPARE_ACTION_CONTEXT', {
        event: {
          payload: {
            actorId: actor.id,
            targetId: target.id,
            secondaryId: item.id,
          },
        },
        parameters: {
          include_secondary: true,
          secondary_name_variable: 'itemName',
        },
      });

      expect(context.actorName).toBe('Frank');
      expect(context.targetName).toBe('Grace');
      expect(context.itemName).toBe('Gold Ring');
    });
  });

  describe('edge cases', () => {
    it('should handle missing position component gracefully', async () => {
      fixture = await ModTestFixture.forRule('core', 'core:test_prepare_context');

      const actor = fixture.createEntity({
        id: 'actor-no-position',
        components: {
          'core:actor': { name: 'Henry' },
          // No position component
        },
      });

      const target = fixture.createEntity({
        id: 'target-1',
        components: {
          'core:actor': { name: 'Ivy' },
        },
      });

      const context = await fixture.executeOperation('PREPARE_ACTION_CONTEXT', {
        event: {
          payload: { actorId: actor.id, targetId: target.id },
        },
        parameters: {},
      });

      expect(context.locationId).toBeNull();
      expect(context.actorName).toBe('Henry');
    });

    it('should fallback to entity ID for unnamed entities', async () => {
      fixture = await ModTestFixture.forRule('core', 'core:test_prepare_context');

      const actor = fixture.createEntity({
        id: 'unnamed-entity-123',
        components: {
          'core:position': { locationId: 'loc-1' },
          // No name component
        },
      });

      const target = fixture.createEntity({
        id: 'another-unnamed-456',
        components: {},
      });

      const context = await fixture.executeOperation('PREPARE_ACTION_CONTEXT', {
        event: {
          payload: { actorId: actor.id, targetId: target.id },
        },
        parameters: {},
      });

      expect(context.actorName).toBe('unnamed-entity-123');
      expect(context.targetName).toBe('another-unnamed-456');
    });
  });
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
