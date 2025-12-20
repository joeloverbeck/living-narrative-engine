/**
 * @file Integration tests for movement lock edge cases.
 * @description Tests the robustness of the movement lock system with unusual
 * anatomy configurations, timing issues, and error conditions.
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { createRuleTestEnvironment } from '../../common/engine/systemLogicTestEnv.js';
import kneelBeforeRule from '../../../data/mods/deference/rules/kneel_before.rule.json';
import standUpRule from '../../../data/mods/deference/rules/stand_up.rule.json';
import eventIsActionKneelBefore from '../../../data/mods/deference/conditions/event-is-action-kneel-before.condition.json';
import eventIsActionStandUp from '../../../data/mods/deference/conditions/event-is-action-stand-up.condition.json';
import logSuccessMacro from '../../../data/mods/core/macros/logSuccessAndEndTurn.macro.json';
import { expandMacros } from '../../../src/utils/macroUtils.js';
import QueryComponentHandler from '../../../src/logic/operationHandlers/queryComponentHandler.js';
import GetNameHandler from '../../../src/logic/operationHandlers/getNameHandler.js';
import GetTimestampHandler from '../../../src/logic/operationHandlers/getTimestampHandler.js';
import DispatchEventHandler from '../../../src/logic/operationHandlers/dispatchEventHandler.js';
import DispatchPerceptibleEventHandler from '../../../src/logic/operationHandlers/dispatchPerceptibleEventHandler.js';
import EndTurnHandler from '../../../src/logic/operationHandlers/endTurnHandler.js';
import SetVariableHandler from '../../../src/logic/operationHandlers/setVariableHandler.js';
import AddComponentHandler from '../../../src/logic/operationHandlers/addComponentHandler.js';
import RemoveComponentHandler from '../../../src/logic/operationHandlers/removeComponentHandler.js';
import LockMovementHandler from '../../../src/logic/operationHandlers/lockMovementHandler.js';
import UnlockMovementHandler from '../../../src/logic/operationHandlers/unlockMovementHandler.js';
import {
  NAME_COMPONENT_ID,
  POSITION_COMPONENT_ID,
} from '../../../src/constants/componentIds.js';
import { ATTEMPT_ACTION_ID } from '../../../src/constants/eventIds.js';

/**
 * Creates handlers needed for movement locking rules.
 *
 * @param {object} entityManager - Entity manager instance
 * @param {object} eventBus - Event bus instance
 * @param {object} logger - Logger instance
 * @param {object} gameDataRepository - Game data repository instance
 * @returns {object} Handler configuration object
 */
function createHandlers(entityManager, eventBus, logger, gameDataRepository) {
  const safeDispatcher = {
    dispatch: jest.fn((eventType, payload) => {
      eventBus.dispatch(eventType, payload);
      return Promise.resolve(true);
    }),
  };
  const recipientSetBuilder = { build: jest.fn() };

  return {
    QUERY_COMPONENT: new QueryComponentHandler({
      entityManager,
      logger,
      safeEventDispatcher: safeDispatcher,
    }),
    GET_NAME: new GetNameHandler({
      entityManager,
      logger,
      safeEventDispatcher: safeDispatcher,
    }),
    GET_TIMESTAMP: new GetTimestampHandler({
      logger,
    }),
    DISPATCH_EVENT: new DispatchEventHandler({
      dispatcher: eventBus,
      logger,
    }),
    DISPATCH_PERCEPTIBLE_EVENT: new DispatchPerceptibleEventHandler({
      dispatcher: eventBus,
      logger,
      routingPolicyService: {
        validateAndHandle: jest.fn().mockReturnValue(true),
      },
      recipientSetBuilder,
    }),
    END_TURN: new EndTurnHandler({
      logger,
      safeEventDispatcher: safeDispatcher,
    }),
    SET_VARIABLE: new SetVariableHandler({
      logger,
    }),
    ADD_COMPONENT: new AddComponentHandler({
      entityManager,
      logger,
      safeEventDispatcher: safeDispatcher,
      gameDataRepository,
    }),
    REMOVE_COMPONENT: new RemoveComponentHandler({
      entityManager,
      logger,
      safeEventDispatcher: safeDispatcher,
    }),
    LOCK_MOVEMENT: new LockMovementHandler({
      entityManager,
      logger,
      safeEventDispatcher: safeDispatcher,
    }),
    UNLOCK_MOVEMENT: new UnlockMovementHandler({
      entityManager,
      logger,
      safeEventDispatcher: safeDispatcher,
    }),
    // Mock handler for REGENERATE_DESCRIPTION - satisfies fail-fast enforcement
    REGENERATE_DESCRIPTION: {
      execute: jest.fn().mockResolvedValue(undefined),
    },
  };
}

describe('Movement Lock - Edge Cases', () => {
  let testEnv;

  beforeEach(() => {
    const macros = { 'core:logSuccessAndEndTurn': logSuccessMacro };

    // Expand macros for both rules
    const expandedKneelActions = expandMacros(kneelBeforeRule.actions, {
      get: (type, id) => (type === 'macros' ? macros[id] : undefined),
    });
    const expandedStandActions = expandMacros(standUpRule.actions, {
      get: (type, id) => (type === 'macros' ? macros[id] : undefined),
    });

    const dataRegistry = {
      getAllSystemRules: jest.fn().mockReturnValue([
        { ...kneelBeforeRule, actions: expandedKneelActions },
        { ...standUpRule, actions: expandedStandActions },
      ]),
      getConditionDefinition: jest.fn((id) => {
        if (id === 'deference:event-is-action-kneel-before') {
          return eventIsActionKneelBefore;
        }
        if (id === 'deference:event-is-action-stand-up') {
          return eventIsActionStandUp;
        }
        return undefined;
      }),
      getComponentDefinition: jest.fn().mockReturnValue(null),
    };

    testEnv = createRuleTestEnvironment({
      createHandlers,
      entities: [],
      rules: [
        { ...kneelBeforeRule, actions: expandedKneelActions },
        { ...standUpRule, actions: expandedStandActions },
      ],
      dataRegistry,
    });
  });

  afterEach(() => {
    if (testEnv) {
      testEnv.cleanup();
    }
  });

  /**
   * Helper to create anatomy actor with standard legs.
   *
   * @param {string} actorId - The entity ID for the actor to create
   * @returns {Promise<string>} The created actor ID
   */
  async function createAnatomyActor(actorId) {
    const leftLegId = `${actorId}-left-leg`;
    const rightLegId = `${actorId}-right-leg`;

    await testEnv.entityManager.addComponent(actorId, NAME_COMPONENT_ID, {
      text: 'Test Actor',
    });
    await testEnv.entityManager.addComponent(actorId, POSITION_COMPONENT_ID, {
      locationId: 'test-location',
    });
    await testEnv.entityManager.addComponent(actorId, 'anatomy:body', {
      recipeId: 'anatomy:humanoid',
      body: {
        root: leftLegId,
        parts: {
          left_leg: leftLegId,
          right_leg: rightLegId,
        },
      },
    });

    await testEnv.entityManager.addComponent(leftLegId, 'core:movement', {
      locked: false,
      forcedOverride: false,
    });
    await testEnv.entityManager.addComponent(leftLegId, 'anatomy:part', {
      subType: 'leg',
      orientation: 'left',
    });

    await testEnv.entityManager.addComponent(rightLegId, 'core:movement', {
      locked: false,
      forcedOverride: false,
    });
    await testEnv.entityManager.addComponent(rightLegId, 'anatomy:part', {
      subType: 'leg',
      orientation: 'right',
    });

    return actorId;
  }

  describe('entities without legs', () => {
    it('should handle anatomy entity with no leg parts gracefully', async () => {
      // Setup: Create entity with anatomy but no legs (e.g., ghost, snake)
      const actorId = 'legless-entity';
      const targetId = 'target-001';

      await testEnv.entityManager.addComponent(actorId, NAME_COMPONENT_ID, {
        text: 'Legless Entity',
      });
      await testEnv.entityManager.addComponent(actorId, POSITION_COMPONENT_ID, {
        locationId: 'test-location',
      });
      await testEnv.entityManager.addComponent(actorId, 'anatomy:body', {
        recipeId: 'anatomy:ghost',
        body: {
          root: `${actorId}-torso`,
          parts: {
            head: `${actorId}-head`,
            torso: `${actorId}-torso`,
            // No leg parts
          },
        },
      });

      await testEnv.entityManager.addComponent(targetId, NAME_COMPONENT_ID, {
        text: 'Target Entity',
      });
      await testEnv.entityManager.addComponent(
        targetId,
        POSITION_COMPONENT_ID,
        {
          locationId: 'test-location',
        }
      );

      // Execute: Dispatch attempt action event (this triggers rule processing)
      await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
        eventName: 'core:attempt_action',
        actionId: 'deference:kneel_before',
        actorId: actorId,
        targetId: targetId,
        originalInput: `kneel_before ${targetId}`,
      });

      // Assert: Kneeling component still added despite no legs
      const kneelingData = testEnv.entityManager.getComponentData(
        actorId,
        'positioning:kneeling_before'
      );
      expect(kneelingData).toBeDefined();
      expect(kneelingData.entityId).toBe(targetId);
    });

    it('should handle snake-like entity with alternative locomotion', async () => {
      // Setup: Entity with tail instead of legs
      const actorId = 'snake-entity';
      const tailId = `${actorId}-tail`;
      const targetId = 'target-001';

      await testEnv.entityManager.addComponent(actorId, NAME_COMPONENT_ID, {
        text: 'Snake Entity',
      });
      await testEnv.entityManager.addComponent(actorId, POSITION_COMPONENT_ID, {
        locationId: 'test-location',
      });
      await testEnv.entityManager.addComponent(actorId, 'anatomy:body', {
        recipeId: 'anatomy:serpent',
        body: {
          root: tailId,
          parts: {
            tail: tailId,
          },
        },
      });

      // Tail has movement but isn't a leg
      await testEnv.entityManager.addComponent(tailId, 'core:movement', {
        locked: false,
      });
      await testEnv.entityManager.addComponent(tailId, 'anatomy:part', {
        subType: 'tail',
      });

      await testEnv.entityManager.addComponent(targetId, NAME_COMPONENT_ID, {
        text: 'Target Entity',
      });
      await testEnv.entityManager.addComponent(
        targetId,
        POSITION_COMPONENT_ID,
        {
          locationId: 'test-location',
        }
      );

      // Execute: Kneel (coil?) action
      await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
        eventName: 'core:attempt_action',
        actionId: 'deference:kneel_before',
        actorId: actorId,
        targetId: targetId,
        originalInput: `kneel_before ${targetId}`,
      });

      // Assert: Movement component on tail should be locked
      // (assuming utility checks for movement components regardless of part type)
      const tailMovement = testEnv.entityManager.getComponentData(
        tailId,
        'core:movement'
      );
      expect(tailMovement.locked).toBe(true);
    });
  });

  describe('asymmetric anatomy', () => {
    it('should handle entity with single leg', async () => {
      // Setup: One-legged entity
      const actorId = 'peg-leg-pete';
      const legId = `${actorId}-leg`;
      const targetId = 'target-001';

      await testEnv.entityManager.addComponent(actorId, NAME_COMPONENT_ID, {
        text: 'Peg Leg Pete',
      });
      await testEnv.entityManager.addComponent(actorId, POSITION_COMPONENT_ID, {
        locationId: 'test-location',
      });
      await testEnv.entityManager.addComponent(actorId, 'anatomy:body', {
        recipeId: 'anatomy:pirate',
        body: {
          root: legId,
          parts: {
            left_leg: legId,
            // right_leg missing/wooden
          },
        },
      });

      await testEnv.entityManager.addComponent(legId, 'core:movement', {
        locked: false,
      });
      await testEnv.entityManager.addComponent(legId, 'anatomy:part', {
        subType: 'leg',
        orientation: 'left',
      });

      await testEnv.entityManager.addComponent(targetId, NAME_COMPONENT_ID, {
        text: 'Target Entity',
      });
      await testEnv.entityManager.addComponent(
        targetId,
        POSITION_COMPONENT_ID,
        {
          locationId: 'test-location',
        }
      );

      // Execute: Kneel on one leg
      await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
        eventName: 'core:attempt_action',
        actionId: 'deference:kneel_before',
        actorId: actorId,
        targetId: targetId,
        originalInput: `kneel_before ${targetId}`,
      });

      // Assert: Single leg is locked
      const legMovement = testEnv.entityManager.getComponentData(
        legId,
        'core:movement'
      );
      expect(legMovement.locked).toBe(true);

      // Execute: Stand up
      await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
        eventName: 'core:attempt_action',
        actionId: 'deference:stand_up',
        actorId: actorId,
        targetId: 'none',
        originalInput: 'stand up',
      });

      // Assert: Single leg is unlocked
      const updatedMovement = testEnv.entityManager.getComponentData(
        legId,
        'core:movement'
      );
      expect(updatedMovement.locked).toBe(false);
    });

    it('should handle entity with uneven number of legs', async () => {
      // Setup: Three-legged entity
      const actorId = 'tripod-creature';
      const leg1 = `${actorId}-leg-1`;
      const leg2 = `${actorId}-leg-2`;
      const leg3 = `${actorId}-leg-3`;
      const targetId = 'target-001';

      await testEnv.entityManager.addComponent(actorId, NAME_COMPONENT_ID, {
        text: 'Tripod Creature',
      });
      await testEnv.entityManager.addComponent(actorId, POSITION_COMPONENT_ID, {
        locationId: 'test-location',
      });
      await testEnv.entityManager.addComponent(actorId, 'anatomy:body', {
        recipeId: 'anatomy:tripod',
        body: {
          root: leg1,
          parts: {
            front_leg: leg1,
            back_left_leg: leg2,
            back_right_leg: leg3,
          },
        },
      });

      // Create all three legs
      const legData = [
        { id: leg1, orientation: 'front' },
        { id: leg2, orientation: 'left' },
        { id: leg3, orientation: 'right' },
      ];

      for (const { id, orientation } of legData) {
        await testEnv.entityManager.addComponent(id, 'core:movement', {
          locked: false,
        });
        await testEnv.entityManager.addComponent(id, 'anatomy:part', {
          subType: 'leg',
          orientation: orientation,
        });
      }

      await testEnv.entityManager.addComponent(targetId, NAME_COMPONENT_ID, {
        text: 'Target Entity',
      });
      await testEnv.entityManager.addComponent(
        targetId,
        POSITION_COMPONENT_ID,
        {
          locationId: 'test-location',
        }
      );

      // Execute: Kneel
      await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
        eventName: 'core:attempt_action',
        actionId: 'deference:kneel_before',
        actorId: actorId,
        targetId: targetId,
        originalInput: `kneel_before ${targetId}`,
      });

      // Wait for rule processing
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Assert: All three legs locked
      for (const legId of [leg1, leg2, leg3]) {
        const movement = testEnv.entityManager.getComponentData(
          legId,
          'core:movement'
        );
        expect(movement.locked).toBe(true);
      }
    });
  });

  describe('timing and state issues', () => {
    it('should handle standing without being kneeled', async () => {
      // Setup: Standing entity
      const actorId = 'standing-actor';
      await createAnatomyActor(actorId);

      // Execute: Stand up without kneeling first
      await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
        eventName: 'core:attempt_action',
        actionId: 'deference:stand_up',
        actorId: actorId,
        targetId: 'none',
        originalInput: 'stand up',
      });

      // Wait for rule processing
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Assert: Movement components remain unlocked
      const leftLeg = testEnv.entityManager.getComponentData(
        `${actorId}-left-leg`,
        'core:movement'
      );
      const rightLeg = testEnv.entityManager.getComponentData(
        `${actorId}-right-leg`,
        'core:movement'
      );
      expect(leftLeg.locked).toBe(false);
      expect(rightLeg.locked).toBe(false);
    });

    it('should handle multiple actors kneeling to same target simultaneously', async () => {
      // Setup: Multiple actors, one target
      const actors = ['actor-1', 'actor-2', 'actor-3'];
      const targetId = 'popular-target';

      await testEnv.entityManager.addComponent(targetId, NAME_COMPONENT_ID, {
        text: 'Popular Target',
      });
      await testEnv.entityManager.addComponent(
        targetId,
        POSITION_COMPONENT_ID,
        {
          locationId: 'test-location',
        }
      );

      // Create all actors
      for (const actorId of actors) {
        await createAnatomyActor(actorId);
      }

      // Execute: All kneel simultaneously (parallel execution)
      for (const actorId of actors) {
        await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
          eventName: 'core:attempt_action',
          actionId: 'deference:kneel_before',
          actorId: actorId,
          targetId: targetId,
          originalInput: `kneel_before ${targetId}`,
        });
      }

      // Wait for rule processing
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Assert: All actors have locked movement
      for (const actorId of actors) {
        const leftLeg = testEnv.entityManager.getComponentData(
          `${actorId}-left-leg`,
          'core:movement'
        );
        const rightLeg = testEnv.entityManager.getComponentData(
          `${actorId}-right-leg`,
          'core:movement'
        );
        expect(leftLeg.locked).toBe(true);
        expect(rightLeg.locked).toBe(true);
      }

      // Execute: All stand simultaneously
      for (const actorId of actors) {
        await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
          eventName: 'core:attempt_action',
          actionId: 'deference:stand_up',
          actorId: actorId,
          targetId: 'none',
          originalInput: 'stand up',
        });
      }

      // Wait for rule processing
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Assert: All actors have unlocked movement
      for (const actorId of actors) {
        const leftLeg = testEnv.entityManager.getComponentData(
          `${actorId}-left-leg`,
          'core:movement'
        );
        const rightLeg = testEnv.entityManager.getComponentData(
          `${actorId}-right-leg`,
          'core:movement'
        );
        expect(leftLeg.locked).toBe(false);
        expect(rightLeg.locked).toBe(false);
      }
    });

    it('should handle rapid kneel-stand-kneel sequences', async () => {
      // Setup: Single actor
      const actorId = 'rapid-actor';
      const targetId = 'target-001';

      await createAnatomyActor(actorId);
      await testEnv.entityManager.addComponent(targetId, NAME_COMPONENT_ID, {
        text: 'Target Entity',
      });
      await testEnv.entityManager.addComponent(
        targetId,
        POSITION_COMPONENT_ID,
        {
          locationId: 'test-location',
        }
      );

      // Execute: Rapid state changes
      await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
        eventName: 'core:attempt_action',
        actionId: 'deference:kneel_before',
        actorId: actorId,
        targetId: targetId,
        originalInput: `kneel_before ${targetId}`,
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
        eventName: 'core:attempt_action',
        actionId: 'deference:stand_up',
        actorId: actorId,
        targetId: 'none',
        originalInput: 'stand up',
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
        eventName: 'core:attempt_action',
        actionId: 'deference:kneel_before',
        actorId: actorId,
        targetId: targetId,
        originalInput: `kneel_before ${targetId}`,
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      // Assert: Final state is kneeling with locked movement
      const leftLeg = testEnv.entityManager.getComponentData(
        `${actorId}-left-leg`,
        'core:movement'
      );
      const rightLeg = testEnv.entityManager.getComponentData(
        `${actorId}-right-leg`,
        'core:movement'
      );
      const kneeling = testEnv.entityManager.getComponentData(
        actorId,
        'positioning:kneeling_before'
      );

      expect(leftLeg.locked).toBe(true);
      expect(rightLeg.locked).toBe(true);
      expect(kneeling).toBeDefined();
    });
  });

  describe('error conditions', () => {
    it('should handle non-existent actor gracefully', async () => {
      // Setup: Create target but not actor
      const targetId = 'target-001';
      await testEnv.entityManager.addComponent(targetId, NAME_COMPONENT_ID, {
        text: 'Target Entity',
      });
      await testEnv.entityManager.addComponent(
        targetId,
        POSITION_COMPONENT_ID,
        {
          locationId: 'test-location',
        }
      );

      // Execute: Kneel with non-existent actor
      await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
        eventName: 'core:attempt_action',
        actionId: 'deference:kneel_before',
        actorId: 'non-existent-actor',
        targetId: targetId,
        originalInput: `kneel_before ${targetId}`,
      });

      // Assert: Should not crash (no exception thrown)
      // The system should handle missing entities gracefully
      // If we reach this point, the system handled the missing entity gracefully
      expect(true).toBe(true);
    });

    it('should handle corrupted anatomy data', async () => {
      expect.assertions(1);
      // Setup: Entity with invalid anatomy structure
      const actorId = 'corrupted-actor';
      const targetId = 'target-001';

      await testEnv.entityManager.addComponent(actorId, NAME_COMPONENT_ID, {
        text: 'Corrupted Actor',
      });
      await testEnv.entityManager.addComponent(actorId, POSITION_COMPONENT_ID, {
        locationId: 'test-location',
      });
      await testEnv.entityManager.addComponent(actorId, 'anatomy:body', {
        recipeId: 'anatomy:invalid',
        body: {
          root: 'non-existent-entity-id',
          parts: {
            left_leg: 'non-existent-entity-id',
            right_leg: null,
          },
        },
      });

      await testEnv.entityManager.addComponent(targetId, NAME_COMPONENT_ID, {
        text: 'Target Entity',
      });
      await testEnv.entityManager.addComponent(
        targetId,
        POSITION_COMPONENT_ID,
        {
          locationId: 'test-location',
        }
      );

      // Execute: Should handle gracefully
      await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
        eventName: 'core:attempt_action',
        actionId: 'deference:kneel_before',
        actorId: actorId,
        targetId: targetId,
        originalInput: `kneel_before ${targetId}`,
      });

      // Assert: System handled corrupted data gracefully without throwing
      expect(true).toBe(true);
    });

    it('should handle movement component with invalid data', async () => {
      // Setup: Entity with malformed movement component
      const actorId = 'invalid-movement-actor';
      const legId = `${actorId}-leg`;
      const targetId = 'target-001';

      await testEnv.entityManager.addComponent(actorId, NAME_COMPONENT_ID, {
        text: 'Invalid Movement Actor',
      });
      await testEnv.entityManager.addComponent(actorId, POSITION_COMPONENT_ID, {
        locationId: 'test-location',
      });
      await testEnv.entityManager.addComponent(actorId, 'anatomy:body', {
        recipeId: 'anatomy:test',
        body: {
          root: legId,
          parts: { leg: legId },
        },
      });

      await testEnv.entityManager.addComponent(legId, 'core:movement', {
        locked: 'not-a-boolean', // Invalid type
        forcedOverride: null,
      });
      await testEnv.entityManager.addComponent(legId, 'anatomy:part', {
        subType: 'leg',
      });

      await testEnv.entityManager.addComponent(targetId, NAME_COMPONENT_ID, {
        text: 'Target Entity',
      });
      await testEnv.entityManager.addComponent(
        targetId,
        POSITION_COMPONENT_ID,
        {
          locationId: 'test-location',
        }
      );

      // Execute: Should handle type coercion or validation
      await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
        eventName: 'core:attempt_action',
        actionId: 'deference:kneel_before',
        actorId: actorId,
        targetId: targetId,
        originalInput: `kneel_before ${targetId}`,
      });

      // Wait for rule processing
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Assert: Movement should be updated despite initial invalid data
      const movement = testEnv.entityManager.getComponentData(
        legId,
        'core:movement'
      );
      expect(typeof movement.locked).toBe('boolean');
      expect(movement.locked).toBe(true);
    });
  });
});
