/**
 * @file Integration tests for the maneuvering:place_yourself_behind rule.
 */

import {
  describe,
  it,
  beforeEach,
  afterEach,
  expect,
  jest,
} from '@jest/globals';
import placeYourselfBehindRule from '../../../../../data/mods/maneuvering/rules/place_yourself_behind.rule.json';
import eventIsActionPlaceYourselfBehind from '../../../../../data/mods/maneuvering/conditions/event-is-action-place-yourself-behind.condition.json';
import QueryComponentHandler from '../../../../../src/logic/operationHandlers/queryComponentHandler.js';
import GetNameHandler from '../../../../../src/logic/operationHandlers/getNameHandler.js';
import GetTimestampHandler from '../../../../../src/logic/operationHandlers/getTimestampHandler.js';
import DispatchEventHandler from '../../../../../src/logic/operationHandlers/dispatchEventHandler.js';
import DispatchPerceptibleEventHandler from '../../../../../src/logic/operationHandlers/dispatchPerceptibleEventHandler.js';
import EndTurnHandler from '../../../../../src/logic/operationHandlers/endTurnHandler.js';
import ModifyArrayFieldHandler from '../../../../../src/logic/operationHandlers/modifyArrayFieldHandler.js';
import AddComponentHandler from '../../../../../src/logic/operationHandlers/addComponentHandler.js';
import SetVariableHandler from '../../../../../src/logic/operationHandlers/setVariableHandler.js';
import {
  NAME_COMPONENT_ID,
  POSITION_COMPONENT_ID,
} from '../../../../../src/constants/componentIds.js';
import { ATTEMPT_ACTION_ID } from '../../../../../src/constants/eventIds.js';
import { createRuleTestEnvironment } from '../../../../common/engine/systemLogicTestEnv.js';

/**
 * Creates handlers needed for the place_yourself_behind rule.
 *
 * @param {object} entityManager - Entity manager instance
 * @param {object} eventBus - Event bus instance
 * @param {object} logger - Logger instance
 * @param {object} gameDataRepository - Game data repository instance
 * @returns {object} Handlers object
 */
function createHandlers(entityManager, eventBus, logger, gameDataRepository) {
  const safeDispatcher = {
    dispatch: jest.fn((eventType, payload) => {
      eventBus.dispatch(eventType, payload);
      return Promise.resolve(true);
    }),
  };

  const handlers = {
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
    MODIFY_ARRAY_FIELD: new ModifyArrayFieldHandler({
      entityManager,
      logger,
      safeEventDispatcher: safeDispatcher,
    }),
    ADD_COMPONENT: new AddComponentHandler({
      entityManager,
      logger,
      safeEventDispatcher: safeDispatcher,
      gameDataRepository,
    }),
    SET_VARIABLE: new SetVariableHandler({ logger }),
  };

  // Spy on execute methods for handlers that need to be tested
  jest.spyOn(handlers.DISPATCH_PERCEPTIBLE_EVENT, 'execute');
  jest.spyOn(handlers.DISPATCH_EVENT, 'execute');

  return handlers;
}

describe('Place Yourself Behind Rule Integration Tests', () => {
  let testEnv;

  beforeEach(() => {
    // Rule no longer uses macros - uses inline sense-aware operations
    const dataRegistry = {
      getCondition: (id) => {
        if (id === eventIsActionPlaceYourselfBehind.id) {
          return eventIsActionPlaceYourselfBehind;
        }
        return null;
      },
      getConditionDefinition: (id) => {
        if (id === eventIsActionPlaceYourselfBehind.id) {
          return eventIsActionPlaceYourselfBehind;
        }
        return null;
      },
      getAllSystemRules: () => [placeYourselfBehindRule],
      getComponentDefinition: jest.fn().mockReturnValue(null),
    };

    testEnv = createRuleTestEnvironment({
      createHandlers,
      dataRegistry,
      entities: [],
      rules: [placeYourselfBehindRule],
    });
  });

  afterEach(() => {
    testEnv?.cleanup?.();
    jest.clearAllMocks();
  });

  it('should add facing_away component to target when target has no existing facing_away component', async () => {
    // Arrange
    const actorId = 'test:actor';
    const targetId = 'test:target';
    const locationId = 'test:location';

    // Create entities with required components
    testEnv.entityManager.createEntity(actorId);
    testEnv.entityManager.addComponent(actorId, NAME_COMPONENT_ID, {
      text: 'Actor Smith',
    });
    testEnv.entityManager.addComponent(actorId, POSITION_COMPONENT_ID, {
      locationId,
    });

    testEnv.entityManager.createEntity(targetId);
    testEnv.entityManager.addComponent(targetId, NAME_COMPONENT_ID, {
      text: 'Target Jones',
    });

    // Create event payload
    const eventPayload = {
      eventType: ATTEMPT_ACTION_ID,
      payload: {
        actionId: 'maneuvering:place_yourself_behind',
        actorId,
        targetId,
      },
    };

    // Act
    await testEnv.systemLogicOrchestrator.processEvent(eventPayload);

    // Assert - Check that target now has facing_away component with actor in the array
    const facingAwayComponent = testEnv.entityManager.getComponent(
      targetId,
      'positioning:facing_away'
    );

    expect(facingAwayComponent).toBeDefined();
    expect(facingAwayComponent.facing_away_from).toEqual([actorId]);
  });

  it('should add actor to existing facing_away component array when target already faces away from someone else', async () => {
    // Arrange
    const actorId = 'test:actor';
    const targetId = 'test:target';
    const existingFacingAwayId = 'test:existing';
    const locationId = 'test:location';

    // Create entities with required components
    testEnv.entityManager.createEntity(actorId);
    testEnv.entityManager.addComponent(actorId, NAME_COMPONENT_ID, {
      text: 'Actor Smith',
    });
    testEnv.entityManager.addComponent(actorId, POSITION_COMPONENT_ID, {
      locationId,
    });

    testEnv.entityManager.createEntity(targetId);
    testEnv.entityManager.addComponent(targetId, NAME_COMPONENT_ID, {
      text: 'Target Jones',
    });
    // Target already faces away from someone else
    testEnv.entityManager.addComponent(targetId, 'positioning:facing_away', {
      facing_away_from: [existingFacingAwayId],
    });

    // Create event payload
    const eventPayload = {
      eventType: ATTEMPT_ACTION_ID,
      payload: {
        actionId: 'maneuvering:place_yourself_behind',
        actorId,
        targetId,
      },
    };

    // Act
    await testEnv.systemLogicOrchestrator.processEvent(eventPayload);

    // Assert - Check that target's facing_away component now includes both entities
    const facingAwayComponent = testEnv.entityManager.getComponent(
      targetId,
      'positioning:facing_away'
    );

    expect(facingAwayComponent).toBeDefined();
    expect(facingAwayComponent.facing_away_from).toContain(
      existingFacingAwayId
    );
    expect(facingAwayComponent.facing_away_from).toContain(actorId);
    expect(facingAwayComponent.facing_away_from).toHaveLength(2);
  });

  it('should not add duplicate actor if actor is already in facing_away_from array', async () => {
    // Arrange
    const actorId = 'test:actor';
    const targetId = 'test:target';
    const locationId = 'test:location';

    // Create entities with required components
    testEnv.entityManager.createEntity(actorId);
    testEnv.entityManager.addComponent(actorId, NAME_COMPONENT_ID, {
      text: 'Actor Smith',
    });
    testEnv.entityManager.addComponent(actorId, POSITION_COMPONENT_ID, {
      locationId,
    });

    testEnv.entityManager.createEntity(targetId);
    testEnv.entityManager.addComponent(targetId, NAME_COMPONENT_ID, {
      text: 'Target Jones',
    });
    // Target already faces away from the actor
    testEnv.entityManager.addComponent(targetId, 'positioning:facing_away', {
      facing_away_from: [actorId],
    });

    // Create event payload
    const eventPayload = {
      eventType: ATTEMPT_ACTION_ID,
      payload: {
        actionId: 'maneuvering:place_yourself_behind',
        actorId,
        targetId,
      },
    };

    // Act
    await testEnv.systemLogicOrchestrator.processEvent(eventPayload);

    // Assert - Check that no duplicate was added
    const facingAwayComponent = testEnv.entityManager.getComponent(
      targetId,
      'positioning:facing_away'
    );

    expect(facingAwayComponent).toBeDefined();
    expect(facingAwayComponent.facing_away_from).toEqual([actorId]);
    expect(facingAwayComponent.facing_away_from).toHaveLength(1);
  });

  it('should generate correct log message with entity names', async () => {
    // Arrange
    const actorId = 'test:actor';
    const targetId = 'test:target';
    const locationId = 'test:location';

    // Create entities with required components
    testEnv.entityManager.createEntity(actorId);
    testEnv.entityManager.addComponent(actorId, NAME_COMPONENT_ID, {
      text: 'John Smith',
    });
    testEnv.entityManager.addComponent(actorId, POSITION_COMPONENT_ID, {
      locationId,
    });

    testEnv.entityManager.createEntity(targetId);
    testEnv.entityManager.addComponent(targetId, NAME_COMPONENT_ID, {
      text: 'Jane Jones',
    });

    // Create event payload
    const eventPayload = {
      eventType: ATTEMPT_ACTION_ID,
      payload: {
        actionId: 'maneuvering:place_yourself_behind',
        actorId,
        targetId,
      },
    };

    // Act
    await testEnv.systemLogicOrchestrator.processEvent(eventPayload);

    // Assert - Check that the perceptible event was dispatched with sense-aware fields
    expect(
      testEnv.handlers.DISPATCH_PERCEPTIBLE_EVENT.execute
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        location_id: locationId,
        description_text: 'John Smith places themselves behind Jane Jones.',
        actor_description: 'I place myself behind Jane Jones.',
        target_description: 'John Smith moves behind me.',
        perception_type: 'physical.target_action',
        actor_id: actorId,
        target_id: targetId,
        alternate_descriptions: {
          auditory:
            'I hear footsteps and the rustle of movement as someone repositions nearby.',
        },
      }),
      expect.any(Object)
    );
  });

  it('should dispatch positioning:actor_placed_behind event', async () => {
    // Arrange
    const actorId = 'test:actor';
    const targetId = 'test:target';
    const locationId = 'test:location';

    // Create entities with required components
    testEnv.entityManager.createEntity(actorId);
    testEnv.entityManager.addComponent(actorId, NAME_COMPONENT_ID, {
      text: 'Actor Smith',
    });
    testEnv.entityManager.addComponent(actorId, POSITION_COMPONENT_ID, {
      locationId,
    });

    testEnv.entityManager.createEntity(targetId);
    testEnv.entityManager.addComponent(targetId, NAME_COMPONENT_ID, {
      text: 'Target Jones',
    });

    // Create event payload
    const eventPayload = {
      eventType: ATTEMPT_ACTION_ID,
      payload: {
        actionId: 'maneuvering:place_yourself_behind',
        actorId,
        targetId,
      },
    };

    // Act
    await testEnv.systemLogicOrchestrator.processEvent(eventPayload);

    // Assert - Check that the custom event was dispatched
    expect(testEnv.handlers.DISPATCH_EVENT.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'maneuvering:actor_placed_behind',
        payload: {
          actor: actorId,
          target: targetId,
        },
      }),
      expect.any(Object)
    );
  });
});
