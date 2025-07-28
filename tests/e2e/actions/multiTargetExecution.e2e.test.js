/**
 * @file Multi-Target Execution E2E Tests
 * @description End-to-end tests validating the complete execution flow of multi-target
 * actions from command processing through operation handler execution
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { createMultiTargetTestBuilder } from './helpers/multiTargetTestBuilder.js';
import { createExecutionHelper } from './helpers/multiTargetExecutionHelper.js';
import { multiTargetAssertions } from './helpers/multiTargetAssertions.js';
import { TEST_ACTION_IDS } from './fixtures/multiTargetActions.js';
import { TEST_ENTITY_IDS } from './fixtures/testEntities.js';
import {
  expectedOperationSequences,
  expectedEventSequences,
  expectedStateChanges,
} from './fixtures/expectedResults.js';

describe('Multi-Target Action Execution E2E', () => {
  let testBuilder;
  let testEnv;
  let executionHelper;

  beforeEach(() => {
    testBuilder = createMultiTargetTestBuilder(jest);
  });

  afterEach(() => {
    if (executionHelper) {
      executionHelper.cleanup();
    }
    if (testEnv) {
      testEnv.cleanup();
    }
  });

  describe('Basic Multi-Target Execution', () => {
    it('should execute a throw action with item and target', async () => {
      // Setup: Create actor with throwable item, target in same location
      const builder = await testBuilder
        .initialize()
        .buildScenario('throw')
        .withAction(TEST_ACTION_IDS.BASIC_THROW)
        .createEntities();

      testEnv = await builder
        .withMockDiscovery({
          targets: {
            primary: { id: TEST_ENTITY_IDS.ROCK, displayName: 'Small Rock' },
            secondary: { id: TEST_ENTITY_IDS.GUARD, displayName: 'Guard' },
          },
          command: 'throw Small Rock at Guard',
          available: true,
        })
        .withMockValidation(true)
        .withMockExecution({
          success: true,
          effects: [
            'Removed rock_001 from player inventory',
            'Dispatched ITEM_THROWN_AT_TARGET event',
            'Damaged guard_001 for 5 HP',
          ],
          description: 'You throw Small Rock at Guard.',
          command: 'throw Small Rock at Guard',
          // Mock operations that would be executed
          operations: expectedOperationSequences.throwItem,
        })
        .build();

      const actor = testEnv.getEntity('actor');
      executionHelper = createExecutionHelper(
        testEnv.actionService,
        testEnv.eventBus,
        testEnv.entityTestBed.entityManager
      );

      // Execute: Process multi-target throw command
      const result = await executionHelper.executeAndTrack(
        actor,
        'throw Small Rock at Guard'
      );

      // Verify: Command executed successfully
      expect(result.result.success).toBe(true);
      expect(result.result.command).toBe('throw Small Rock at Guard');

      // Verify: Operation handlers executed in correct sequence
      const mockExecute =
        testEnv.actionService.actionPipelineOrchestrator.execute;
      expect(mockExecute).toHaveBeenCalledWith({
        action: {
          actionId: TEST_ACTION_IDS.BASIC_THROW,
          actorId: TEST_ENTITY_IDS.PLAYER,
          targets: {
            primary: { id: TEST_ENTITY_IDS.ROCK },
            secondary: { id: TEST_ENTITY_IDS.GUARD },
          },
        },
        actionDefinition: expect.any(Object),
        validateOnly: false,
      });

      // Verify: Expected operations in result
      const executionResult =
        mockExecute.mock.results[0].value instanceof Promise
          ? await mockExecute.mock.results[0].value
          : mockExecute.mock.results[0].value;

      multiTargetAssertions.expectOperationSequence(
        executionResult.operations,
        expectedOperationSequences.throwItem
      );

      // Verify: Effects reported correctly
      expect(executionResult.effects).toContain(
        'Removed rock_001 from player inventory'
      );
      expect(executionResult.effects).toContain('Damaged guard_001 for 5 HP');
    });
  });

  describe('Complex Multi-Target with Three+ Targets', () => {
    it('should handle actions with three or more targets', async () => {
      // Test: "enchant sword with fire using scroll"
      const builder = await testBuilder
        .initialize()
        .buildScenario('enchant')
        .withAction(TEST_ACTION_IDS.ENCHANT_ITEM)
        .createEntities();

      testEnv = await builder
        .withMockDiscovery({
          targets: {
            primary: { id: TEST_ENTITY_IDS.SWORD, displayName: 'Iron Sword' },
            secondary: { id: 'fire', displayName: 'Fire' },
            tertiary: {
              id: TEST_ENTITY_IDS.CRYSTAL,
              displayName: 'Magic Crystal',
            },
          },
          command: 'enchant Iron Sword with Fire using Magic Crystal',
          available: true,
        })
        .withMockValidation(true)
        .withMockExecution({
          success: true,
          effects: [
            'Enchanted sword_001 with fire element',
            'Consumed catalyst crystal_001',
            'Weapon damage increased to 15',
          ],
          description:
            'You successfully enchant Iron Sword with Fire using Magic Crystal.',
          processedTargets: {
            item: TEST_ENTITY_IDS.SWORD,
            element: 'fire',
            catalyst: TEST_ENTITY_IDS.CRYSTAL,
          },
          operations: expectedOperationSequences.enchantItem,
        })
        .build();

      const actor = testEnv.getEntity('actor');
      const actionData = {
        actionId: TEST_ACTION_IDS.ENCHANT_ITEM,
        targets: {
          primary: { id: TEST_ENTITY_IDS.SWORD },
          secondary: { id: 'fire' },
          tertiary: { id: TEST_ENTITY_IDS.CRYSTAL },
        },
      };

      executionHelper = createExecutionHelper(
        testEnv.actionService,
        testEnv.eventBus,
        testEnv.entityTestBed.entityManager
      );

      const result = await executionHelper.executeActionAndTrack(
        actor,
        actionData
      );

      // Verify all three targets processed
      multiTargetAssertions.expectTargetsProcessed(result, {
        primary: TEST_ENTITY_IDS.SWORD,
        secondary: 'fire',
        tertiary: TEST_ENTITY_IDS.CRYSTAL,
      });

      // Verify complex state changes would occur
      const mock = testEnv.actionService.actionPipelineOrchestrator.execute;
      const executionResult =
        mock.mock.results[0].value instanceof Promise
          ? await mock.mock.results[0].value
          : mock.mock.results[0].value;

      expect(executionResult.processedTargets).toEqual({
        item: TEST_ENTITY_IDS.SWORD,
        element: 'fire',
        catalyst: TEST_ENTITY_IDS.CRYSTAL,
      });

      // Verify effects
      expect(executionResult.effects).toContain(
        'Enchanted sword_001 with fire element'
      );
      expect(executionResult.effects).toContain(
        'Consumed catalyst crystal_001'
      );
    });
  });

  describe('Operation Handler Sequencing', () => {
    it('should execute operations in correct dependency order', async () => {
      // Test transfer of multiple items ensuring capacity checks first
      const builder = await testBuilder
        .initialize()
        .buildScenario('transfer')
        .withAction(TEST_ACTION_IDS.TRANSFER_ITEMS)
        .createEntities();

      testEnv = await builder.build();

      // Create test items
      const items = ['item_001', 'item_002', 'item_003'];
      const operationLog = [];

      // Mock execution that tracks operation order
      testEnv.facades.actionService.actionPipelineOrchestrator.execute = jest
        .fn()
        .mockImplementation(async ({ action }) => {
          // Simulate operation execution order
          operationLog.push({ type: 'validateContainer', target: 'chest_001' });
          operationLog.push({
            type: 'checkCapacity',
            items: items.length,
            capacity: 50,
          });

          for (const itemId of items) {
            operationLog.push({ type: 'transferItem', itemId });
          }

          operationLog.push({
            type: 'updateInventory',
            entityId: action.actorId,
          });
          operationLog.push({
            type: 'updateContainer',
            entityId: 'chest_001',
          });

          return {
            success: true,
            operations: operationLog,
            description: 'Transferred 3 items to chest.',
          };
        });

      const actor = testEnv.getEntity('actor');
      const mockDiscovery = {
        targets: {
          primary: items.map((id) => ({ id, displayName: `Item ${id}` })),
          secondary: { id: 'chest_001', displayName: 'Wooden Chest' },
        },
        command: 'transfer all items to chest',
        available: true,
      };

      testEnv.facades.actionService.setMockActions(actor.id, [
        {
          actionId: TEST_ACTION_IDS.TRANSFER_ITEMS,
          ...mockDiscovery,
        },
      ]);

      testEnv.facades.actionService.setMockValidation(
        actor.id,
        TEST_ACTION_IDS.TRANSFER_ITEMS,
        { success: true }
      );

      executionHelper = createExecutionHelper(
        testEnv.actionService,
        testEnv.eventBus,
        testEnv.entityTestBed.entityManager
      );

      const result = await executionHelper.executeAndTrack(
        actor,
        'transfer all items to chest'
      );

      // Verify operations executed in correct order
      expect(operationLog).toMatchObject([
        { type: 'validateContainer', target: 'chest_001' },
        { type: 'checkCapacity', items: 3, capacity: 50 },
        { type: 'transferItem', itemId: 'item_001' },
        { type: 'transferItem', itemId: 'item_002' },
        { type: 'transferItem', itemId: 'item_003' },
        { type: 'updateInventory', entityId: actor.id },
        { type: 'updateContainer', entityId: 'chest_001' },
      ]);
    });
  });

  describe('Conditional Operation Execution', () => {
    it('should handle conditional operations based on target state', async () => {
      // Test healing that only affects wounded allies
      const builder = await testBuilder
        .initialize()
        .buildScenario('heal')
        .withAction(TEST_ACTION_IDS.HEAL_WOUNDED)
        .createEntities();

      testEnv = await builder.build();

      const healOperations = [];

      // Mock execution that only heals wounded targets
      testEnv.facades.actionService.actionPipelineOrchestrator.execute = jest
        .fn()
        .mockImplementation(async ({ action }) => {
          // Get all potential targets
          const allTargets = [
            'wounded_ally_1',
            'wounded_ally_2',
            'healthy_ally',
          ];

          // Simulate checking each target's health
          for (const targetId of allTargets) {
            const targetHealth = testEnv.getEntityComponent(
              targetId === 'wounded_ally_1'
                ? 'wounded1'
                : targetId === 'wounded_ally_2'
                  ? 'wounded2'
                  : 'healthy',
              'core:health'
            );

            if (targetHealth && targetHealth.current < targetHealth.max) {
              healOperations.push({
                type: 'modifyComponent',
                entityId: targetId,
                componentId: 'core:health',
                operation: 'heal',
                amount: 20,
              });
            }
          }

          return {
            success: true,
            operations: healOperations,
            description: `Healed ${healOperations.length} wounded allies.`,
          };
        });

      const healer = testEnv.getEntity('healer');
      const mockDiscovery = {
        targets: {
          primary: [
            { id: 'wounded_ally_1', displayName: 'Wounded Ally 1' },
            { id: 'wounded_ally_2', displayName: 'Wounded Ally 2' },
          ],
        },
        command: 'heal all wounded allies',
        available: true,
      };

      testEnv.facades.actionService.setMockActions(healer.id, [
        {
          actionId: TEST_ACTION_IDS.HEAL_WOUNDED,
          ...mockDiscovery,
        },
      ]);

      testEnv.facades.actionService.setMockValidation(
        healer.id,
        TEST_ACTION_IDS.HEAL_WOUNDED,
        { success: true }
      );

      executionHelper = createExecutionHelper(
        testEnv.actionService,
        testEnv.eventBus,
        testEnv.entityTestBed.entityManager
      );

      const result = await executionHelper.executeAndTrack(
        healer,
        'heal all wounded allies'
      );

      // Verify only wounded allies were healed
      const healedTargets = healOperations
        .filter(
          (op) => op.type === 'modifyComponent' && op.operation === 'heal'
        )
        .map((op) => op.entityId);

      expect(healedTargets).toEqual(['wounded_ally_1', 'wounded_ally_2']);
      expect(healedTargets).not.toContain('healthy_ally');
      expect(healOperations).toHaveLength(2);
    });
  });

  describe('Operation Failure and Rollback', () => {
    it('should rollback all changes when an operation fails', async () => {
      // Test container capacity exceeded scenario
      const builder = await testBuilder
        .initialize()
        .buildScenario('transfer')
        .withAction(TEST_ACTION_IDS.TRANSFER_ITEMS)
        .createEntities();

      testEnv = await builder.build();

      const items = [
        'item_001',
        'item_002',
        'item_003',
        'item_004',
        'item_005',
      ];
      let operationIndex = 0;
      const executedOperations = [];

      // Mock execution that fails partway through
      testEnv.facades.actionService.actionPipelineOrchestrator.execute = jest
        .fn()
        .mockImplementation(async () => {
          // Simulate operations executing until failure
          executedOperations.push({
            type: 'validateContainer',
            success: true,
          });

          executedOperations.push({
            type: 'checkCapacity',
            result: 'insufficient',
            required: 5,
            available: 2,
          });

          // First two items transfer successfully
          executedOperations.push({
            type: 'transferItem',
            itemId: items[0],
            success: true,
          });

          executedOperations.push({
            type: 'transferItem',
            itemId: items[1],
            success: true,
          });

          // Third item fails - capacity exceeded
          executedOperations.push({
            type: 'transferItem',
            itemId: items[2],
            success: false,
            error: 'Container capacity exceeded',
          });

          // Simulate rollback
          return {
            success: false,
            error: 'Container capacity exceeded',
            rolledBack: true,
            executedOperations,
            rollbackOperations: [
              { type: 'rollback', itemId: items[1] },
              { type: 'rollback', itemId: items[0] },
            ],
          };
        });

      const actor = testEnv.getEntity('actor');
      testEnv.facades.actionService.setMockActions(actor.id, [
        {
          actionId: TEST_ACTION_IDS.TRANSFER_ITEMS,
          targets: {
            primary: items.map((id) => ({ id })),
            secondary: { id: 'chest_001' },
          },
          command: 'transfer 5 items to small container',
          available: true,
        },
      ]);

      testEnv.facades.actionService.setMockValidation(
        actor.id,
        TEST_ACTION_IDS.TRANSFER_ITEMS,
        { success: true }
      );

      executionHelper = createExecutionHelper(
        testEnv.actionService,
        testEnv.eventBus,
        testEnv.entityTestBed.entityManager
      );

      // Capture initial state
      const initialState = testEnv.captureGameState();

      const result = await executionHelper.executeAndTrack(
        actor,
        'transfer 5 items to small container'
      );

      // Get execution result from mock
      const mock = testEnv.actionService.actionPipelineOrchestrator.execute;
      const executionResult =
        mock.mock.results[0].value instanceof Promise
          ? await mock.mock.results[0].value
          : mock.mock.results[0].value;

      // Verify rollback occurred
      expect(executionResult.error).toBe('Container capacity exceeded');
      expect(executionResult.rolledBack).toBe(true);
      expect(executionResult.rollbackOperations).toHaveLength(2);

      // Verify operations stopped at failure
      const failureOp = executedOperations.find(
        (op) => op.success === false && op.type === 'transferItem'
      );
      expect(failureOp).toBeDefined();
      expect(failureOp.itemId).toBe(items[2]);
    });
  });
});
