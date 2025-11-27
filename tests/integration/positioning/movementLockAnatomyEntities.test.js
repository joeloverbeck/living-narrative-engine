/**
 * @file Integration tests for movement locking with anatomy-based entities.
 * @description Tests the complete flow from action execution through rule processing
 * to movement component updates for entities with anatomy:body components where
 * movement components are attached to individual leg body parts.
 */

import {
  describe,
  it,
  beforeEach,
  afterEach,
  expect,
  jest,
} from '@jest/globals';
import kneelBeforeRule from '../../../data/mods/positioning/rules/kneel_before.rule.json';
import standUpRule from '../../../data/mods/positioning/rules/stand_up.rule.json';
import eventIsActionKneelBefore from '../../../data/mods/positioning/conditions/event-is-action-kneel-before.condition.json';
import eventIsActionStandUp from '../../../data/mods/positioning/conditions/event-is-action-stand-up.condition.json';
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
import { createRuleTestEnvironment } from '../../common/engine/systemLogicTestEnv.js';

/**
 * Creates handlers needed for movement locking rules.
 *
 * @param {object} entityManager - Entity manager instance
 * @param {object} eventBus - Event bus instance
 * @param {object} logger - Logger instance
 * @param {object} gameDataRepository - Game data repository instance
 */
function createHandlers(entityManager, eventBus, logger, gameDataRepository) {
  const safeDispatcher = {
    dispatch: jest.fn((eventType, payload) => {
      eventBus.dispatch(eventType, payload);
      return Promise.resolve(true);
    }),
  };

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
    GET_TIMESTAMP: new GetTimestampHandler({ logger }),
    DISPATCH_PERCEPTIBLE_EVENT: new DispatchPerceptibleEventHandler({
      dispatcher: eventBus,
      logger,
      addPerceptionLogEntryHandler: { execute: jest.fn() },
    }),
    DISPATCH_EVENT: new DispatchEventHandler({ dispatcher: eventBus, logger }),
    END_TURN: new EndTurnHandler({
      safeEventDispatcher: safeDispatcher,
      logger,
    }),
    SET_VARIABLE: new SetVariableHandler({ logger }),
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

describe('Movement Lock - Anatomy-Based Entities', () => {
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
        if (id === 'positioning:event-is-action-kneel-before') {
          return eventIsActionKneelBefore;
        }
        if (id === 'positioning:event-is-action-stand-up') {
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
   * Helper to create a leg entity with movement component
   *
   * @param {string} legId - The leg entity ID
   */
  async function createLegEntity(legId) {
    await testEnv.entityManager.addComponent(legId, 'core:movement', {
      locked: false,
      forcedOverride: false,
    });
    await testEnv.entityManager.addComponent(legId, 'anatomy:part', {
      partType: 'leg',
      descriptors: {
        side: legId.includes('left') ? 'left' : 'right',
      },
    });
  }

  /**
   * Helper to create a kneeling anatomy actor
   *
   * @returns {string} Actor ID
   */
  async function createKneelingAnatomyActor() {
    const actorId = 'test-actor-' + Date.now();
    const targetId = 'test-target-' + Date.now();

    const leftLegId = `${actorId}-left-leg`;
    const rightLegId = `${actorId}-right-leg`;

    // Create actor with anatomy
    await testEnv.entityManager.addComponent(actorId, 'anatomy:body', {
      recipeId: 'anatomy:humanoid',
      body: {
        root: `${actorId}-torso`,
        parts: {
          left_leg: leftLegId,
          right_leg: rightLegId,
        },
      },
    });

    await testEnv.entityManager.addComponent(actorId, NAME_COMPONENT_ID, {
      text: 'TestActor',
    });

    await testEnv.entityManager.addComponent(actorId, POSITION_COMPONENT_ID, {
      locationId: 'test-location',
    });

    // Create legs
    await createLegEntity(leftLegId);
    await createLegEntity(rightLegId);

    // Create target
    await testEnv.entityManager.addComponent(targetId, NAME_COMPONENT_ID, {
      text: 'TestTarget',
    });
    await testEnv.entityManager.addComponent(targetId, POSITION_COMPONENT_ID, {
      locationId: 'test-location',
    });

    // Make actor kneel
    await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
      eventName: 'core:attempt_action',
      actorId: actorId,
      actionId: 'positioning:kneel_before',
      targetId: targetId,
      originalInput: `kneel_before ${targetId}`,
    });

    return actorId;
  }

  /**
   * Helper to create entity with multiple legs
   *
   * @param {string} actorId - Actor entity ID
   * @param {string[]} legIds - Array of leg entity IDs
   */
  async function createMultiLegEntity(actorId, legIds) {
    const parts = {};
    legIds.forEach((legId, index) => {
      parts[`leg_${index}`] = legId;
    });

    await testEnv.entityManager.addComponent(actorId, 'anatomy:body', {
      recipeId: 'anatomy:centaur',
      body: {
        root: `${actorId}-torso`,
        parts,
      },
    });

    await testEnv.entityManager.addComponent(actorId, NAME_COMPONENT_ID, {
      text: 'MultiLegActor',
    });

    await testEnv.entityManager.addComponent(actorId, POSITION_COMPONENT_ID, {
      locationId: 'test-location',
    });

    // Create leg entities
    for (const legId of legIds) {
      await createLegEntity(legId);
    }
  }

  describe('kneeling locks movement', () => {
    it('should lock all leg movement components when anatomy entity kneels', async () => {
      // Setup: Create anatomy-based actor with legs
      const actorId = 'test-actor-001';
      const targetId = 'test-target-001';

      // Create main actor entity
      testEnv.reset([
        {
          id: actorId,
          components: {
            [NAME_COMPONENT_ID]: { text: 'Alice' },
            [POSITION_COMPONENT_ID]: { locationId: 'throne_room' },
          },
        },
        {
          id: targetId,
          components: {
            [NAME_COMPONENT_ID]: { text: 'King Bob' },
            [POSITION_COMPONENT_ID]: { locationId: 'throne_room' },
          },
        },
      ]);

      // Create anatomy structure
      const leftLegId = `${actorId}-left-leg`;
      const rightLegId = `${actorId}-right-leg`;

      await testEnv.entityManager.addComponent(actorId, 'anatomy:body', {
        recipeId: 'anatomy:humanoid',
        body: {
          root: `${actorId}-torso`,
          parts: {
            left_leg: leftLegId,
            right_leg: rightLegId,
          },
        },
      });

      // Create leg entities with movement components
      await createLegEntity(leftLegId);
      await createLegEntity(rightLegId);

      // Execute: Kneel before action
      await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
        eventName: 'core:attempt_action',
        actorId: actorId,
        actionId: 'positioning:kneel_before',
        targetId: targetId,
        originalInput: `kneel_before ${targetId}`,
      });

      // Assert: Both leg movement components are locked
      const leftLegMovement = testEnv.entityManager.getComponentData(
        leftLegId,
        'core:movement'
      );
      const rightLegMovement = testEnv.entityManager.getComponentData(
        rightLegId,
        'core:movement'
      );

      expect(leftLegMovement.locked).toBe(true);
      expect(rightLegMovement.locked).toBe(true);

      // Assert: Kneeling component was added
      const kneelingComponent = testEnv.entityManager.getComponentData(
        actorId,
        'positioning:kneeling_before'
      );
      expect(kneelingComponent).toBeDefined();
      expect(kneelingComponent.entityId).toBe(targetId);
    });

    it('should prevent movement actions while kneeling', async () => {
      // Setup: Create kneeling anatomy entity
      const actorId = await createKneelingAnatomyActor();

      // Verify kneeling state exists
      const kneelingComponent = testEnv.entityManager.getComponentData(
        actorId,
        'positioning:kneeling_before'
      );
      expect(kneelingComponent).toBeDefined();

      // Get leg IDs from anatomy structure
      const bodyComponent = testEnv.entityManager.getComponentData(
        actorId,
        'anatomy:body'
      );
      const leftLegId = bodyComponent.body.parts.left_leg;
      const rightLegId = bodyComponent.body.parts.right_leg;

      // Verify legs are locked
      const leftLegMovement = testEnv.entityManager.getComponentData(
        leftLegId,
        'core:movement'
      );
      const rightLegMovement = testEnv.entityManager.getComponentData(
        rightLegId,
        'core:movement'
      );

      expect(leftLegMovement.locked).toBe(true);
      expect(rightLegMovement.locked).toBe(true);
    });
  });

  describe('standing unlocks movement', () => {
    it('should unlock all leg movement components when anatomy entity stands', async () => {
      // Setup: Create kneeling anatomy entity
      const actorId = await createKneelingAnatomyActor();

      // Get anatomy structure
      const bodyComponent = testEnv.entityManager.getComponentData(
        actorId,
        'anatomy:body'
      );
      const leftLegId = bodyComponent.body.parts.left_leg;
      const rightLegId = bodyComponent.body.parts.right_leg;

      // Verify locked state
      let leftLegMovement = testEnv.entityManager.getComponentData(
        leftLegId,
        'core:movement'
      );
      let rightLegMovement = testEnv.entityManager.getComponentData(
        rightLegId,
        'core:movement'
      );
      expect(leftLegMovement.locked).toBe(true);
      expect(rightLegMovement.locked).toBe(true);

      // Execute: Stand up action
      await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
        eventName: 'core:attempt_action',
        actorId: actorId,
        actionId: 'positioning:stand_up',
        targetId: 'none',
        originalInput: 'stand up',
      });

      // Assert: Both leg movement components are unlocked
      leftLegMovement = testEnv.entityManager.getComponentData(
        leftLegId,
        'core:movement'
      );
      rightLegMovement = testEnv.entityManager.getComponentData(
        rightLegId,
        'core:movement'
      );

      expect(leftLegMovement.locked).toBe(false);
      expect(rightLegMovement.locked).toBe(false);

      // Assert: Kneeling component was removed
      const actor = testEnv.entityManager.getEntityInstance(actorId);
      expect(actor.components['positioning:kneeling_before']).toBeUndefined();
    });

    it('should allow movement after standing up', async () => {
      // Setup: Create kneeling anatomy entity then stand
      const actorId = await createKneelingAnatomyActor();

      await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
        eventName: 'core:attempt_action',
        actorId: actorId,
        actionId: 'positioning:stand_up',
        targetId: 'none',
        originalInput: 'stand up',
      });

      // Get anatomy structure to verify legs are unlocked
      const bodyComponent = testEnv.entityManager.getComponentData(
        actorId,
        'anatomy:body'
      );
      const leftLegId = bodyComponent.body.parts.left_leg;
      const rightLegId = bodyComponent.body.parts.right_leg;

      const leftLegMovement = testEnv.entityManager.getComponentData(
        leftLegId,
        'core:movement'
      );
      const rightLegMovement = testEnv.entityManager.getComponentData(
        rightLegId,
        'core:movement'
      );

      expect(leftLegMovement.locked).toBe(false);
      expect(rightLegMovement.locked).toBe(false);
    });
  });

  describe('complex anatomy scenarios', () => {
    it('should handle entities with multiple leg pairs', async () => {
      // Setup: Create entity with 4 legs (e.g., centaur)
      const actorId = 'centaur-001';
      const targetId = 'target-001';
      const legIds = [
        'front-left-leg',
        'front-right-leg',
        'rear-left-leg',
        'rear-right-leg',
      ];

      testEnv.reset([
        {
          id: targetId,
          components: {
            [NAME_COMPONENT_ID]: { text: 'Target' },
            [POSITION_COMPONENT_ID]: { locationId: 'test-location' },
          },
        },
      ]);

      await createMultiLegEntity(actorId, legIds);

      // Execute: Kneel action
      await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
        eventName: 'core:attempt_action',
        actorId: actorId,
        actionId: 'positioning:kneel_before',
        targetId: targetId,
        originalInput: `kneel_before ${targetId}`,
      });

      // Assert: All leg movement components are locked
      for (const legId of legIds) {
        const movement = testEnv.entityManager.getComponentData(
          legId,
          'core:movement'
        );
        expect(movement.locked).toBe(true);
      }
    });

    it('should handle asymmetric anatomy (single leg)', async () => {
      // Setup: Create entity with only one leg
      const actorId = 'one-legged-001';
      const targetId = 'target-001';
      const legId = `${actorId}-leg`;

      testEnv.reset([
        {
          id: targetId,
          components: {
            [NAME_COMPONENT_ID]: { text: 'Target' },
            [POSITION_COMPONENT_ID]: { locationId: 'test-location' },
          },
        },
      ]);

      await testEnv.entityManager.addComponent(actorId, 'anatomy:body', {
        recipeId: 'anatomy:custom',
        body: {
          root: `${actorId}-torso`,
          parts: {
            leg: legId,
          },
        },
      });

      await testEnv.entityManager.addComponent(actorId, NAME_COMPONENT_ID, {
        text: 'OneLeggedActor',
      });

      await testEnv.entityManager.addComponent(actorId, POSITION_COMPONENT_ID, {
        locationId: 'test-location',
      });

      await createLegEntity(legId);

      // Execute: Kneel action
      await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
        eventName: 'core:attempt_action',
        actorId: actorId,
        actionId: 'positioning:kneel_before',
        targetId: targetId,
        originalInput: `kneel_before ${targetId}`,
      });

      // Assert: Single leg is locked
      const movement = testEnv.entityManager.getComponentData(
        legId,
        'core:movement'
      );
      expect(movement.locked).toBe(true);
    });

    it('should handle entities with non-standard leg names', async () => {
      // Setup: Create entity with custom leg naming
      const actorId = 'alien-001';
      const targetId = 'target-001';
      const tentacle1 = `${actorId}-locomotor-1`;
      const tentacle2 = `${actorId}-locomotor-2`;

      testEnv.reset([
        {
          id: targetId,
          components: {
            [NAME_COMPONENT_ID]: { text: 'Target' },
            [POSITION_COMPONENT_ID]: { locationId: 'test-location' },
          },
        },
      ]);

      await testEnv.entityManager.addComponent(actorId, 'anatomy:body', {
        recipeId: 'anatomy:alien',
        body: {
          root: `${actorId}-torso`,
          parts: {
            locomotor_1: tentacle1,
            locomotor_2: tentacle2,
          },
        },
      });

      await testEnv.entityManager.addComponent(actorId, NAME_COMPONENT_ID, {
        text: 'AlienActor',
      });

      await testEnv.entityManager.addComponent(actorId, POSITION_COMPONENT_ID, {
        locationId: 'test-location',
      });

      // Create locomotor entities with movement
      await createLegEntity(tentacle1);
      await createLegEntity(tentacle2);

      // Execute: Kneel action
      await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
        eventName: 'core:attempt_action',
        actorId: actorId,
        actionId: 'positioning:kneel_before',
        targetId: targetId,
        originalInput: `kneel_before ${targetId}`,
      });

      // Assert: All locomotors are locked
      const movement1 = testEnv.entityManager.getComponentData(
        tentacle1,
        'core:movement'
      );
      const movement2 = testEnv.entityManager.getComponentData(
        tentacle2,
        'core:movement'
      );
      expect(movement1.locked).toBe(true);
      expect(movement2.locked).toBe(true);
    });
  });
});
