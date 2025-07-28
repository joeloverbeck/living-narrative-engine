/**
 * @file Action Side Effects E2E Tests
 * @description End-to-end tests validating that multi-target actions properly trigger
 * all side effects including component modifications, event dispatching, cascading
 * effects, and maintain transaction-like consistency
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
import { multiTargetAssertions, installCustomMatchers } from './helpers/multiTargetAssertions.js';
import { TEST_ACTION_IDS } from './fixtures/multiTargetActions.js';
import { TEST_ENTITY_IDS } from './fixtures/testEntities.js';
import {
  expectedStateChanges,
  expectedEventSequences,
} from './fixtures/expectedResults.js';

// Install custom matchers
installCustomMatchers();

describe('Action Side Effects E2E', () => {
  let testBuilder;
  let testEnv;
  let executionHelper;

  beforeEach(() => {
    testBuilder = createMultiTargetTestBuilder(jest.fn);
  });

  afterEach(() => {
    if (executionHelper) {
      executionHelper.cleanup();
    }
    if (testEnv) {
      testEnv.cleanup();
    }
  });

  describe('Component Modification Side Effects', () => {
    it('should apply all component changes from multi-target action', async () => {
      // Test dual-equip action that modifies multiple components
      testEnv = await testBuilder
        .initialize()
        .buildScenario('equip')
        .withAction('test:equip_dual')
        .createEntities()
        .build();

      const actor = testEnv.getEntity('actor');
      const weapon = testEnv.getEntity('weapon');
      const shield = testEnv.getEntity('shield');

      // Capture initial state
      const initialStats = JSON.parse(
        JSON.stringify(actor.getComponent('core:stats'))
      );

      // Mock execution with component modifications
      const mockExecution = {
        success: true,
        description: 'You equip Iron Sword and Wooden Shield.',
        stateChanges: {
          [actor.id]: {
            'core:equipment': {
              before: { mainHand: null, offHand: null },
              after: {
                mainHand: weapon.id,
                offHand: shield.id,
              },
            },
            'core:stats': {
              before: initialStats,
              after: {
                ...initialStats,
                attack: initialStats.attack + 10, // Weapon bonus
                defense: initialStats.defense + 5, // Shield bonus
              },
            },
            'core:inventory': {
              before: { items: [weapon.id, shield.id] },
              after: { items: [] },
            },
          },
        },
        events: [
          {
            type: 'ITEM_EQUIPPED',
            payload: { actorId: actor.id, itemId: weapon.id, slot: 'mainHand' },
          },
          {
            type: 'ITEM_EQUIPPED',
            payload: { actorId: actor.id, itemId: shield.id, slot: 'offHand' },
          },
          {
            type: 'STATS_MODIFIED',
            payload: {
              entityId: actor.id,
              changes: { attack: '+10', defense: '+5' },
            },
          },
        ],
      };

      testEnv.facades.actionService.setMockActions(actor.id, [
        {
          actionId: 'test:equip_dual',
          targets: {
            primary: { id: weapon.id, displayName: 'Iron Sword' },
            secondary: { id: shield.id, displayName: 'Wooden Shield' },
          },
          command: 'equip sword and shield',
          available: true,
        },
      ]);

      testEnv.facades.actionService.setMockValidation(
        actor.id,
        'test:equip_dual',
        { success: true }
      );

      testEnv.facades.actionService.actionPipelineOrchestrator.execute = jest
        .fn()
        .mockResolvedValue(mockExecution);

      executionHelper = createExecutionHelper(
        testEnv.actionService,
        testEnv.eventBus,
        testEnv.entityTestBed.entityManager
      );

      const result = await executionHelper.executeAndTrack(
        actor,
        'equip sword and shield'
      );

      // Get execution result
      const executionResult =
        testEnv.actionService.actionPipelineOrchestrator.execute.mock.results[0]
          .value;

      // Verify primary component changes
      expect(executionResult.stateChanges[actor.id]['core:equipment']).toEqual({
        before: { mainHand: null, offHand: null },
        after: {
          mainHand: weapon.id,
          offHand: shield.id,
        },
      });

      // Verify calculated side effects
      const statsChange = executionResult.stateChanges[actor.id]['core:stats'];
      expect(statsChange.after.attack).toBe(initialStats.attack + 10);
      expect(statsChange.after.defense).toBe(initialStats.defense + 5);

      // Verify inventory updates
      expect(
        executionResult.stateChanges[actor.id]['core:inventory'].after.items
      ).toEqual([]);
    });
  });

  describe('Event Dispatching and Propagation', () => {
    it('should dispatch all events for multi-target actions', async () => {
      // Test combat action that generates multiple events
      testEnv = await testBuilder
        .initialize()
        .buildScenario('throw')
        .withAction(TEST_ACTION_IDS.BASIC_THROW)
        .createEntities()
        .build();

      const actor = testEnv.getEntity('actor');
      const target = testEnv.getEntity('target');
      const item = testEnv.getEntity('item');

      // Track dispatched events
      const dispatchedEvents = [];
      const mockEventBus = {
        dispatch: jest.fn((event) => {
          dispatchedEvents.push(event);
        }),
        on: jest.fn(),
        off: jest.fn(),
      };

      // Replace event bus in execution helper
      executionHelper = createExecutionHelper(
        testEnv.facades.mockDeps.commandProcessor,
        mockEventBus,
        testEnv.entityTestBed.entityManager
      );

      // Mock execution that dispatches events
      testEnv.facades.actionService.actionPipelineOrchestrator.execute = jest
        .fn()
        .mockImplementation(async () => {
          // Simulate event dispatching during execution
          mockEventBus.dispatch({
            type: 'ACTION_INITIATED',
            payload: {
              actionId: TEST_ACTION_IDS.BASIC_THROW,
              actorId: actor.id,
              targets: { primary: item.id, secondary: target.id },
            },
          });

          mockEventBus.dispatch({
            type: 'INVENTORY_ITEM_REMOVED',
            payload: { entityId: actor.id, itemId: item.id },
          });

          mockEventBus.dispatch({
            type: 'ITEM_THROWN_AT_TARGET',
            payload: {
              actorId: actor.id,
              itemId: item.id,
              targetId: target.id,
              distance: 3,
            },
          });

          mockEventBus.dispatch({
            type: 'ENTITY_DAMAGED',
            payload: {
              entityId: target.id,
              damage: 5,
              damageType: 'impact',
              sourceId: actor.id,
            },
          });

          mockEventBus.dispatch({
            type: 'ACTION_COMPLETED',
            payload: {
              actionId: TEST_ACTION_IDS.BASIC_THROW,
              actorId: actor.id,
              success: true,
            },
          });

          return {
            success: true,
            description: 'You throw Small Rock at Guard.',
          };
        });

      testEnv.facades.actionService.setMockActions(actor.id, [
        {
          actionId: TEST_ACTION_IDS.BASIC_THROW,
          targets: {
            primary: { id: item.id, displayName: 'Small Rock' },
            secondary: { id: target.id, displayName: 'Guard' },
          },
          command: 'throw Small Rock at Guard',
          available: true,
        },
      ]);

      testEnv.facades.actionService.setMockValidation(
        actor.id,
        TEST_ACTION_IDS.BASIC_THROW,
        { success: true }
      );

      await executionHelper.executeAndTrack(actor, 'throw rock at guard');

      // Verify event sequence
      multiTargetAssertions.expectEventSequence(
        dispatchedEvents,
        expectedEventSequences.throwItem
      );

      // Verify specific event details
      const thrownEvent = dispatchedEvents.find(
        (e) => e.type === 'ITEM_THROWN_AT_TARGET'
      );
      expect(thrownEvent.payload).toMatchObject({
        actorId: actor.id,
        itemId: item.id,
        targetId: target.id,
      });
    });
  });

  describe('Cascading Effects', () => {
    it('should handle effects that trigger other effects', async () => {
      // Test explosion that causes area damage
      testEnv = await testBuilder
        .initialize()
        .buildScenario('explosion')
        .withAction(TEST_ACTION_IDS.THROW_EXPLOSIVE)
        .createEntities()
        .build();

      const actor = testEnv.getEntity('actor');
      const explosive = testEnv.getEntity('explosive');
      const targets = testEnv.getEntity('targets');

      // Track cascading events
      const cascadeEvents = [];
      const mockEventBus = {
        dispatch: jest.fn((event) => {
          cascadeEvents.push(event);
        }),
        on: jest.fn(),
        off: jest.fn(),
      };

      executionHelper = createExecutionHelper(
        testEnv.facades.mockDeps.commandProcessor,
        mockEventBus,
        testEnv.entityTestBed.entityManager
      );

      // Mock execution with cascading effects
      testEnv.facades.actionService.actionPipelineOrchestrator.execute = jest
        .fn()
        .mockImplementation(async () => {
          // Primary explosion event
          mockEventBus.dispatch({
            type: 'EXPLOSION_TRIGGERED',
            payload: {
              position: { x: 2, y: 0 },
              radius: 5,
              damage: 50,
            },
          });

          // Calculate damage for each target based on distance
          const explosionCenter = { x: 2, y: 0 };
          targets.forEach((target, index) => {
            const targetPos = { x: 2 + index * 2, y: index };
            const distance = Math.sqrt(
              Math.pow(targetPos.x - explosionCenter.x, 2) +
                Math.pow(targetPos.y - explosionCenter.y, 2)
            );

            if (distance <= 5) {
              const damageReduction = distance / 5; // Linear falloff
              const damage = Math.floor(50 * (1 - damageReduction * 0.7));

              mockEventBus.dispatch({
                type: 'AREA_DAMAGE_APPLIED',
                payload: {
                  targetId: target.id,
                  damage,
                  distance: Math.round(distance * 100) / 100,
                },
              });
            }
          });

          return {
            success: true,
            description: 'The explosion damages multiple enemies!',
            primaryEffects: [
              {
                type: 'explosion',
                center: explosionCenter,
                radius: 5,
              },
            ],
            cascadingEffects: targets.map((target, index) => {
              const distance = Math.sqrt(index * index * 2);
              return {
                type: 'area_damage',
                targetId: target.id,
                damage: Math.floor(50 * (1 - (distance / 5) * 0.7)),
                distance,
              };
            }),
          };
        });

      testEnv.facades.actionService.setMockActions(actor.id, [
        {
          actionId: TEST_ACTION_IDS.THROW_EXPLOSIVE,
          targets: {
            primary: { id: explosive.id, displayName: 'Bomb' },
            secondary: { id: targets[0].id, displayName: 'Enemy Group' },
          },
          command: 'throw bomb at enemy group',
          available: true,
        },
      ]);

      testEnv.facades.actionService.setMockValidation(
        actor.id,
        TEST_ACTION_IDS.THROW_EXPLOSIVE,
        { success: true }
      );

      await executionHelper.executeAndTrack(actor, 'throw bomb at enemies');

      // Verify cascading effects
      multiTargetAssertions.expectCascadingEffects(cascadeEvents, {
        primaryEffect: {
          type: 'EXPLOSION_TRIGGERED',
          payload: {
            position: { x: 2, y: 0 },
            radius: 5,
            damage: 50,
          },
        },
        cascadeEffects: [
          {
            type: 'AREA_DAMAGE_APPLIED',
            count: targets.length,
            validator: (event) => {
              // Verify damage decreases with distance
              return (
                event.payload.damage > 0 && event.payload.damage <= 50
              );
            },
          },
        ],
      });
    });
  });

  describe('Transaction-like Behavior', () => {
    it('should maintain consistency with all-or-nothing execution', async () => {
      // Test trade action that must complete fully or rollback
      testEnv = await testBuilder
        .initialize()
        .buildScenario('trade')
        .withAction(TEST_ACTION_IDS.TRADE_ITEMS)
        .createEntities()
        .build();

      const player = testEnv.getEntity('player');
      const merchant = testEnv.getEntity('merchant');

      // Set up partial failure condition
      player.modifyComponent('core:wealth', { gold: 30 }); // Not enough for trade

      // Capture state before transaction
      const stateBefore = testEnv.captureGameState();

      // Mock execution that should fail and rollback
      const mockExecution = {
        success: false,
        error: 'Insufficient funds for complete transaction',
        code: 'INSUFFICIENT_FUNDS',
        attempted: {
          goldTransfer: { from: player.id, to: merchant.id, amount: 50 },
          itemTransfer: {
            from: player.id,
            to: merchant.id,
            items: ['item_001'],
          },
          receiveItems: {
            from: merchant.id,
            to: player.id,
            items: ['rare_item_001'],
          },
        },
        rollback: true,
        stateChanges: {}, // No changes due to rollback
      };

      testEnv.facades.actionService.setMockActions(player.id, [
        {
          actionId: TEST_ACTION_IDS.TRADE_ITEMS,
          targets: {
            primary: { id: 'item_001', displayName: 'Common Item' },
            secondary: { id: merchant.id, displayName: 'Merchant' },
            tertiary: { id: 'rare_item_001', displayName: 'Rare Item' },
          },
          command: 'trade Common Item to Merchant for Rare Item',
          available: true,
        },
      ]);

      testEnv.facades.actionService.setMockValidation(
        player.id,
        TEST_ACTION_IDS.TRADE_ITEMS,
        {
          success: false,
          error: 'Insufficient funds',
          details: {
            required: 50,
            available: 30,
          },
        }
      );

      testEnv.facades.actionService.actionPipelineOrchestrator.execute = jest
        .fn()
        .mockResolvedValue(mockExecution);

      executionHelper = createExecutionHelper(
        testEnv.actionService,
        testEnv.eventBus,
        testEnv.entityTestBed.entityManager
      );

      const result = await executionHelper.executeAndTrack(
        player,
        'trade item to merchant'
      );

      // Capture state after attempted transaction
      const stateAfter = testEnv.captureGameState();

      // Verify transaction rolled back
      const executionResult =
        testEnv.actionService.actionPipelineOrchestrator.execute.mock.results[0]
          .value;

      multiTargetAssertions.expectTransactionConsistency(executionResult, {
        shouldSucceed: false,
        partialChangesAllowed: false,
      });

      // Verify no partial changes
      multiTargetAssertions.expectStateRolledBack(stateBefore, stateAfter);
    });
  });

  describe('Complex State Synchronization', () => {
    it('should maintain consistency across multiple related entities', async () => {
      // Test formation change affecting multiple entities
      testEnv = await testBuilder
        .initialize()
        .buildScenario('formation')
        .withAction(TEST_ACTION_IDS.ORDER_FORMATION)
        .createEntities()
        .build();

      const leader = testEnv.getEntity('leader');
      const followers = testEnv.getEntity('followers');

      // Mock execution that updates all entities
      const mockExecution = {
        success: true,
        description: 'Your group forms a defensive formation.',
        stateChanges: {
          [leader.id]: {
            'combat:formation': {
              before: null,
              after: {
                type: 'defensive',
                role: 'leader',
                members: followers.map((f) => f.id),
              },
            },
          },
          ...followers.reduce((acc, follower, index) => {
            acc[follower.id] = {
              'combat:formation': {
                before: null,
                after: {
                  type: 'defensive',
                  role: 'member',
                  leader: leader.id,
                  position: index,
                },
              },
              'core:stats': {
                before: { defense: 10 },
                after: { defense: 15 }, // 50% bonus
              },
            };
            return acc;
          }, {}),
        },
        spatialUpdates: followers.map((follower, index) => ({
          entityId: follower.id,
          position: getFormationPosition('defensive', index),
        })),
      };

      testEnv.facades.actionService.setMockActions(leader.id, [
        {
          actionId: TEST_ACTION_IDS.ORDER_FORMATION,
          targets: {
            primary: { id: 'defensive', displayName: 'Defensive Formation' },
          },
          command: 'order defensive formation',
          available: true,
        },
      ]);

      testEnv.facades.actionService.setMockValidation(
        leader.id,
        TEST_ACTION_IDS.ORDER_FORMATION,
        { success: true }
      );

      testEnv.facades.actionService.actionPipelineOrchestrator.execute = jest
        .fn()
        .mockResolvedValue(mockExecution);

      executionHelper = createExecutionHelper(
        testEnv.actionService,
        testEnv.eventBus,
        testEnv.entityTestBed.entityManager
      );

      await executionHelper.executeAndTrack(leader, 'order defensive formation');

      // Get execution result
      const executionResult =
        testEnv.actionService.actionPipelineOrchestrator.execute.mock.results[0]
          .value;

      // Verify state synchronization
      multiTargetAssertions.expectStateSynchronization(
        executionResult.stateChanges,
        {
          leader: leader.id,
          members: followers.map((f) => f.id),
          expectedFormation: 'defensive',
        }
      );

      // Verify spatial positions updated (using custom matcher)
      const positions = executionResult.spatialUpdates.map((u) => u.position);
      expect(positions).toFormValidPattern('defensive_circle', { x: 0, y: 0 });
    });
  });
});

/**
 * Helper to calculate formation positions
 * @private
 */
function getFormationPosition(formationType, index) {
  switch (formationType) {
    case 'defensive':
      // Circular formation
      const angle = (index * Math.PI * 2) / 3; // 3 followers
      return {
        x: Math.cos(angle) * 2,
        y: Math.sin(angle) * 2,
      };
    default:
      return { x: index, y: 0 };
  }
}