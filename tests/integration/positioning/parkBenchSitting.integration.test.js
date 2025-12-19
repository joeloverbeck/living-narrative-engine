/**
 * @file Integration test for park bench sitting issue
 * @description Tests the specific scenario where sit_down action should be available
 * for a character in the same location as a park bench.
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
import handleSitDownRule from '../../../data/mods/sitting/rules/handle_sit_down.rule.json';
import { expandMacros } from '../../../src/utils/macroUtils.js';
import eventIsActionSitDown from '../../../data/mods/sitting/conditions/event-is-action-sit-down.condition.json';
import logSuccessMacro from '../../../data/mods/core/macros/logSuccessAndEndTurn.macro.json';
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
import ModifyComponentHandler from '../../../src/logic/operationHandlers/modifyComponentHandler.js';
import AtomicModifyComponentHandler from '../../../src/logic/operationHandlers/atomicModifyComponentHandler.js';
import EstablishSittingClosenessHandler from '../../../src/logic/operationHandlers/establishSittingClosenessHandler.js';
import RemoveSittingClosenessHandler from '../../../src/logic/operationHandlers/removeSittingClosenessHandler.js';
import RegenerateDescriptionHandler from '../../../src/logic/operationHandlers/regenerateDescriptionHandler.js';
import * as closenessCircleService from '../../../src/logic/services/closenessCircleService.js';
import {
  NAME_COMPONENT_ID,
  POSITION_COMPONENT_ID,
  ACTOR_COMPONENT_ID,
  DESCRIPTION_COMPONENT_ID,
} from '../../../src/constants/componentIds.js';

// Action definition
const sitDownAction = {
  id: 'sitting:sit_down',
  name: 'Sit down',
  description: 'Sit down on available furniture',
  targets: 'sitting:available_furniture',
  required_components: {
    actor: ['core:actor'],
  },
  forbidden_components: {
    actor: ['sitting-states:sitting_on', 'positioning:kneeling_before'],
  },
  template: 'sit down on {target}',
  prerequisites: [],
};

/**
 * Creates handlers needed for furniture sitting rules.
 *
 * @param entityManager
 * @param eventBus
 * @param logger
 * @param gameDataRepository
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
      addPerceptionLogEntryHandler: { execute: jest.fn() },
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
    MODIFY_COMPONENT: new ModifyComponentHandler({
      entityManager,
      logger,
      safeEventDispatcher: safeDispatcher,
    }),
    ATOMIC_MODIFY_COMPONENT: new AtomicModifyComponentHandler({
      entityManager,
      logger,
      safeEventDispatcher: safeDispatcher,
    }),
    ESTABLISH_SITTING_CLOSENESS: new EstablishSittingClosenessHandler({
      entityManager,
      logger,
      safeEventDispatcher: safeDispatcher,
      closenessCircleService,
    }),
    REMOVE_SITTING_CLOSENESS: new RemoveSittingClosenessHandler({
      entityManager,
      logger,
      safeEventDispatcher: safeDispatcher,
      closenessCircleService,
    }),
    REGENERATE_DESCRIPTION: new RegenerateDescriptionHandler({
      entityManager,
      logger,
      safeEventDispatcher: safeDispatcher,
      bodyDescriptionComposer: {
        composeDescription: jest.fn().mockResolvedValue(undefined),
      },
    }),
  };
}

describe('park bench sitting issue', () => {
  let testEnv;
  let actor;
  let parkBench;

  beforeEach(() => {
    testEnv = createRuleTestEnvironment({
      rules: [handleSitDownRule],
      actions: [sitDownAction],
      conditions: {
        'sitting:event-is-action-sit-down': eventIsActionSitDown,
      },
      macros: {
        'core:logSuccessAndEndTurn': logSuccessMacro,
      },
      createHandlers,
    });

    // Create test actor (simulating Ane Arrieta)
    actor = 'p_erotica:ane_arrieta_instance';
    testEnv.entityManager.addComponent(actor, ACTOR_COMPONENT_ID, {});
    testEnv.entityManager.addComponent(actor, NAME_COMPONENT_ID, {
      name: 'Ane Arrieta',
    });
    testEnv.entityManager.addComponent(actor, POSITION_COMPONENT_ID, {
      locationId: 'p_erotica:park_instance',
    });

    // Create park bench (simulating the actual park bench from p_erotica mod)
    parkBench = 'p_erotica:park_bench_instance';
    testEnv.entityManager.addComponent(
      parkBench,
      'sitting:allows_sitting',
      {
        spots: [null, null], // Two empty spots
      }
    );
    testEnv.entityManager.addComponent(parkBench, DESCRIPTION_COMPONENT_ID, {
      short: 'weathered park bench',
      long: 'A weathered wooden park bench with wrought-iron frame',
    });
    testEnv.entityManager.addComponent(parkBench, NAME_COMPONENT_ID, {
      name: 'weathered park bench',
    });
    testEnv.entityManager.addComponent(parkBench, POSITION_COMPONENT_ID, {
      locationId: 'p_erotica:park_instance',
    });
  });

  afterEach(() => {
    testEnv?.cleanup();
  });

  describe('park bench availability', () => {
    it('should show park bench as available furniture when actor is in same location', () => {
      // Log the current state
      console.log(
        '[TEST] Actor position:',
        testEnv.entityManager.getComponentData(actor, POSITION_COMPONENT_ID)
      );

      console.log(
        '[TEST] Park bench position:',
        testEnv.entityManager.getComponentData(parkBench, POSITION_COMPONENT_ID)
      );
      console.log(
        '[TEST] Park bench sitting spots:',
        testEnv.entityManager.getComponentData(
          parkBench,
          'sitting:allows_sitting'
        )
      );

      // Check if sit_down action is available
      const canSit = testEnv.validateAction(actor, 'sitting:sit_down');

      // This should be true but currently fails
      expect(canSit).toBe(true);

      // If the action is available, check if park bench is a valid target
      if (canSit) {
        const availableActions = testEnv.getAvailableActions(actor);
        const sitDownAction = availableActions.find(
          (a) => a.id === 'sitting:sit_down'
        );
        console.log('[TEST] sit_down action targets:', sitDownAction?.targets);
      }
    });

    it('should allow actor to sit on park bench', async () => {
      // Try to sit on the park bench
      await testEnv.dispatchAction({
        actionId: 'sitting:sit_down',
        actorId: actor,
        targetId: parkBench,
      });

      // Check that actor has sitting_on component
      const sittingOn = testEnv.entityManager.getComponentData(
        actor,
        'sitting-states:sitting_on'
      );

      // Log the result for debugging
      console.log('[TEST] After sit attempt, sitting_on component:', sittingOn);

      expect(sittingOn).toEqual({
        furniture_id: parkBench,
        spot_index: 0,
      });

      // Check that park bench's first spot is occupied
      const benchData = testEnv.entityManager.getComponentData(
        parkBench,
        'sitting:allows_sitting'
      );
      expect(benchData.spots[0]).toBe(actor);
      expect(benchData.spots[1]).toBeNull(); // Second spot should still be empty
    });

    it('should show park bench unavailable when actor is in different location', () => {
      // Move actor to different location
      testEnv.entityManager.addComponent(actor, POSITION_COMPONENT_ID, {
        locationId: 'p_erotica:different_location',
      });

      // Check if sit_down action is available
      const canSit = testEnv.validateAction(actor, 'sitting:sit_down');

      // This should be false since they're in different locations
      expect(canSit).toBe(false);
    });

    it('should handle entities with component overrides correctly', () => {
      // This simulates how entity instances work with component overrides
      // The park bench definition has the allows_sitting component
      // The instance adds the position component via componentOverrides

      // Get all entities with allows_sitting component
      const furnitureEntities = testEnv.entityManager.getEntitiesWithComponent(
        'sitting:allows_sitting'
      );
      console.log(
        '[TEST] Entities with allows_sitting:',
        furnitureEntities.map((e) => e.id)
      );

      // The park bench should be in this list
      expect(furnitureEntities.some((e) => e.id === parkBench)).toBe(true);

      // Verify the park bench has both required components
      const sittingComponent = testEnv.entityManager.getComponentData(
        parkBench,
        'sitting:allows_sitting'
      );
      const positionComponent = testEnv.entityManager.getComponentData(
        parkBench,
        'core:position'
      );

      expect(sittingComponent).toBeDefined();
      expect(positionComponent).toBeDefined();
      expect(positionComponent.locationId).toBe('p_erotica:park_instance');
    });
  });
});
