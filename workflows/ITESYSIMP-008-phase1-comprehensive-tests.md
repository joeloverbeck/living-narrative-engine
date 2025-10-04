# ITESYSIMP-008: Phase 1 Comprehensive Test Suite

**Phase:** 1 - Core Infrastructure
**Priority:** Critical
**Estimated Effort:** 3 hours

## Goal

Create comprehensive test coverage for Phase 1 functionality including unit, integration, and end-to-end tests.

## Context

Complete test coverage ensures the foundation is solid before building additional features. This includes testing components, handlers, actions, rules, and the full give_item workflow.

## Tasks

### 1. Component Schema Validation Tests

Already covered in ITESYSIMP-002 and ITESYSIMP-003. Verify:
- [ ] Marker components validate correctly
- [ ] Data components enforce constraints
- [ ] Invalid data rejected appropriately

### 2. Operation Handler Unit Tests

Create `tests/unit/logic/operationHandlers/items/transferItemHandler.test.js`:

```javascript
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { createTestBed } from '../../../../../common/testBed.js';
import TransferItemHandler from '../../../../../../src/logic/operationHandlers/items/transferItemHandler.js';

describe('TransferItemHandler', () => {
  let testBed, handler, mockEntityManager, mockEventBus, mockLogger;

  beforeEach(() => {
    testBed = createTestBed();
    mockEntityManager = testBed.createMock('entityManager', ['getComponent', 'batchAddComponentsOptimized']);
    mockEventBus = testBed.createMock('eventBus', ['dispatch']);
    mockLogger = testBed.createMockLogger();

    handler = new TransferItemHandler({
      entityManager: mockEntityManager,
      eventBus: mockEventBus,
      logger: mockLogger
    });
  });

  describe('successful transfer', () => {
    it('should remove item from source and add to destination', async () => {
      const fromInventory = {
        items: ['item-1', 'item-2'],
        capacity: { maxWeight: 50, maxItems: 10 }
      };
      const toInventory = {
        items: [],
        capacity: { maxWeight: 30, maxItems: 5 }
      };

      mockEntityManager.getComponent
        .mockReturnValueOnce(fromInventory)
        .mockReturnValueOnce(toInventory);

      const result = await handler.execute({
        fromEntity: 'actor-1',
        toEntity: 'actor-2',
        itemEntity: 'item-1'
      }, {});

      expect(result.success).toBe(true);
      expect(mockEntityManager.batchAddComponentsOptimized).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            entityId: 'actor-1',
            data: expect.objectContaining({
              items: ['item-2']
            })
          }),
          expect.objectContaining({
            entityId: 'actor-2',
            data: expect.objectContaining({
              items: ['item-1']
            })
          })
        ])
      );
    });

    it('should dispatch ITEM_TRANSFERRED event', async () => {
      mockEntityManager.getComponent
        .mockReturnValueOnce({ items: ['item-1'], capacity: { maxWeight: 50, maxItems: 10 } })
        .mockReturnValueOnce({ items: [], capacity: { maxWeight: 30, maxItems: 5 } });

      await handler.execute({
        fromEntity: 'actor-1',
        toEntity: 'actor-2',
        itemEntity: 'item-1'
      }, {});

      expect(mockEventBus.dispatch).toHaveBeenCalledWith({
        type: 'ITEM_TRANSFERRED',
        payload: {
          fromEntity: 'actor-1',
          toEntity: 'actor-2',
          itemEntity: 'item-1'
        }
      });
    });
  });

  describe('error handling', () => {
    it('should fail when source inventory missing', async () => {
      mockEntityManager.getComponent.mockReturnValue(null);

      const result = await handler.execute({
        fromEntity: 'actor-1',
        toEntity: 'actor-2',
        itemEntity: 'item-1'
      }, {});

      expect(result.success).toBe(false);
      expect(result.error).toBe('missing_inventory');
    });

    it('should fail when item not in source inventory', async () => {
      mockEntityManager.getComponent
        .mockReturnValueOnce({ items: ['item-2'], capacity: { maxWeight: 50, maxItems: 10 } })
        .mockReturnValueOnce({ items: [], capacity: { maxWeight: 30, maxItems: 5 } });

      const result = await handler.execute({
        fromEntity: 'actor-1',
        toEntity: 'actor-2',
        itemEntity: 'item-1'
      }, {});

      expect(result.success).toBe(false);
      expect(result.error).toBe('item_not_found');
    });
  });
});
```

Create similar tests for `validateInventoryCapacityHandler.test.js`.

### 3. Action Discovery Integration Tests

Create `tests/integration/mods/items/give_item_action_discovery.test.js`:

```javascript
import { describe, it, expect, beforeEach } from '@jest/globals';
import { createTestBed } from '../../../common/testBed.js';

describe('Items - Give Item Action Discovery', () => {
  let testBed;

  beforeEach(() => {
    testBed = createTestBed();
  });

  it('should discover give_item actions for all inventory items', () => {
    const actor = testBed.createEntity('actor-1', {
      'items:inventory': {
        items: ['letter-to-sheriff-1', 'revolver-1'],
        capacity: { maxWeight: 50, maxItems: 10 }
      },
      'positioning:position': { locationId: 'loc-1' }
    });

    const recipient = testBed.createEntity('recipient-1', {
      'items:inventory': {
        items: [],
        capacity: { maxWeight: 30, maxItems: 5 }
      },
      'positioning:position': { locationId: 'loc-1' }
    });

    const actions = testBed.discoverActions(actor);
    const giveActions = actions.filter(a => a.actionId === 'items:give_item');

    expect(giveActions).toHaveLength(2);
    expect(giveActions.map(a => a.secondaryTargetId)).toContain('letter-to-sheriff-1');
    expect(giveActions.map(a => a.secondaryTargetId)).toContain('revolver-1');
  });

  it('should generate combinations at discovery time', () => {
    const actor = testBed.createActorWithInventory(['item-1', 'item-2']);
    const recipient1 = testBed.createActorNearby(actor);
    const recipient2 = testBed.createActorNearby(actor);

    const actions = testBed.discoverActions(actor);
    const giveActions = actions.filter(a => a.actionId === 'items:give_item');

    // 2 items × 2 recipients = 4 combinations
    expect(giveActions).toHaveLength(4);
  });

  it('should not discover actions when inventory is empty', () => {
    const actor = testBed.createActorWithInventory([]);
    const recipient = testBed.createActorNearby(actor);

    const actions = testBed.discoverActions(actor);
    const giveActions = actions.filter(a => a.actionId === 'items:give_item');

    expect(giveActions).toHaveLength(0);
  });

  it('should not discover actions when no recipients nearby', () => {
    const actor = testBed.createActorWithInventory(['item-1']);
    // No other actors created

    const actions = testBed.discoverActions(actor);
    const giveActions = actions.filter(a => a.actionId === 'items:give_item');

    expect(giveActions).toHaveLength(0);
  });
});
```

### 4. Rule Execution Integration Tests

Create `tests/integration/mods/items/give_item_rule_execution.test.js`:

```javascript
import { describe, it, expect, beforeEach } from '@jest/globals';
import { createTestBed } from '../../../common/testBed.js';

describe('Items - Give Item Rule Execution', () => {
  let testBed;

  beforeEach(() => {
    testBed = createTestBed();
  });

  it('should transfer item successfully when capacity allows', () => {
    const actor = testBed.createActorWithInventory(['letter-to-sheriff-1']);
    const recipient = testBed.createActorWithInventory([], {
      maxWeight: 50,
      maxItems: 10
    });

    testBed.setActorsNearby(actor, recipient);

    const result = testBed.executeAction('items:give_item', {
      actorId: actor,
      targetId: recipient,
      secondaryTargetId: 'letter-to-sheriff-1'
    });

    expect(result.success).toBe(true);

    const actorInv = testBed.getComponent(actor, 'items:inventory');
    const recipientInv = testBed.getComponent(recipient, 'items:inventory');

    expect(actorInv.items).not.toContain('letter-to-sheriff-1');
    expect(recipientInv.items).toContain('letter-to-sheriff-1');
  });

  it('should fail when recipient inventory is full (item count)', () => {
    const actor = testBed.createActorWithInventory(['letter-to-sheriff-1']);
    const recipient = testBed.createActorWithInventory(['item-1', 'item-2'], {
      maxWeight: 50,
      maxItems: 2 // Already at capacity
    });

    testBed.setActorsNearby(actor, recipient);

    const result = testBed.executeAction('items:give_item', {
      actorId: actor,
      targetId: recipient,
      secondaryTargetId: 'letter-to-sheriff-1'
    });

    expect(result.success).toBe(false);
    expect(result.reason).toBe('max_items_exceeded');
  });

  it('should fail when item too heavy for recipient', () => {
    const actor = testBed.createActorWithInventory(['gold-bar-1']);
    const recipient = testBed.createActorWithInventory([], {
      maxWeight: 5, // Gold bar weighs 12.4kg
      maxItems: 10
    });

    testBed.setActorsNearby(actor, recipient);

    const result = testBed.executeAction('items:give_item', {
      actorId: actor,
      targetId: recipient,
      secondaryTargetId: 'gold-bar-1'
    });

    expect(result.success).toBe(false);
    expect(result.reason).toBe('max_weight_exceeded');
  });

  it('should create perception log entries', () => {
    const actor = testBed.createActorWithInventory(['letter-to-sheriff-1']);
    const recipient = testBed.createActorNearby(actor);

    testBed.executeAction('items:give_item', {
      actorId: actor,
      targetId: recipient,
      secondaryTargetId: 'letter-to-sheriff-1'
    });

    const logs = testBed.getPerceptionLogs('loc-1');
    expect(logs).toContainEqual(
      expect.objectContaining({
        perceptionType: 'item_transfer',
        actorId: actor,
        targetId: recipient,
        itemId: 'letter-to-sheriff-1'
      })
    );
  });

  it('should end actor turn on successful transfer', () => {
    const actor = testBed.createActorWithInventory(['letter-to-sheriff-1']);
    const recipient = testBed.createActorNearby(actor);

    testBed.executeAction('items:give_item', {
      actorId: actor,
      targetId: recipient,
      secondaryTargetId: 'letter-to-sheriff-1'
    });

    const turnEnded = testBed.hasEventBeenDispatched('END_TURN');
    expect(turnEnded).toBe(true);
  });
});
```

### 5. End-to-End Workflow Tests

Create `tests/e2e/items/giveItemWorkflow.e2e.test.js`:

```javascript
import { describe, it, expect, beforeEach } from '@jest/globals';
import { createTestBed } from '../../common/testBed.js';

describe('Items - Give Item E2E Workflow', () => {
  let testBed;

  beforeEach(() => {
    testBed = createTestBed();
  });

  it('should complete full give item workflow', async () => {
    // Setup
    const player = testBed.createPlayer({
      inventory: ['letter-to-sheriff-1', 'revolver-1'],
      location: 'saloon'
    });

    const npc = testBed.createNPC({
      name: 'Deputy',
      inventory: [],
      location: 'saloon'
    });

    // Discovery
    const availableActions = await testBed.getAvailableActions(player);
    const giveLetterAction = availableActions.find(a =>
      a.actionId === 'items:give_item' &&
      a.targetId === npc &&
      a.secondaryTargetId === 'letter-to-sheriff-1'
    );

    expect(giveLetterAction).toBeDefined();
    expect(giveLetterAction.format).toBe('Give Letter to the Sheriff to Deputy');

    // Execution
    const result = await testBed.performAction(giveLetterAction);
    expect(result.success).toBe(true);

    // Verification
    const playerInventory = testBed.getInventory(player);
    const npcInventory = testBed.getInventory(npc);

    expect(playerInventory).not.toContain('letter-to-sheriff-1');
    expect(npcInventory).toContain('letter-to-sheriff-1');

    // Perception
    const narrative = testBed.getNarrativeLog();
    expect(narrative).toContain('gave Letter to the Sheriff to Deputy');
  });
});
```

## Validation

- [ ] All unit tests pass with >90% coverage
- [ ] Integration tests verify action discovery generates correct combinations
- [ ] Integration tests verify rule execution handles success and failure
- [ ] E2E tests demonstrate complete workflow
- [ ] All edge cases covered (empty inventory, full capacity, missing components)
- [ ] Perception logging verified
- [ ] Turn ending verified
- [ ] Test coverage report shows >80% coverage for Phase 1 code

## Dependencies

- ITESYSIMP-001 through ITESYSIMP-007: All Phase 1 implementation complete

## Next Steps

Phase 1 is complete. Proceed to Phase 2:
- ITESYSIMP-009: Implement drop_item action
- ITESYSIMP-010: Implement pick_up_item action
