/**
 * @file Integration tests for the physical-control:force_bend_over rule.
 */

import {
  describe,
  it,
  beforeEach,
  afterEach,
  expect,
  jest,
} from '@jest/globals';
import forceBendOverRule from '../../../../../data/mods/physical-control/rules/handle_force_bend_over.rule.json';
import eventIsActionForceBendOver from '../../../../../data/mods/physical-control/conditions/event-is-action-force-bend-over.condition.json';
import bendingOverComponent from '../../../../../data/mods/bending-states/components/bending_over.component.json';
import facingAwayComponent from '../../../../../data/mods/positioning/components/facing_away.component.json';
import logSuccessMacro from '../../../../../data/mods/core/macros/logSuccessAndEndTurn.macro.json';
import logSuccessOutcomeMacro from '../../../../../data/mods/core/macros/logSuccessOutcomeAndEndTurn.macro.json';
import { expandMacros } from '../../../../../src/utils/macroUtils.js';
import QueryComponentHandler from '../../../../../src/logic/operationHandlers/queryComponentHandler.js';
import GetNameHandler from '../../../../../src/logic/operationHandlers/getNameHandler.js';
import GetTimestampHandler from '../../../../../src/logic/operationHandlers/getTimestampHandler.js';
import DispatchEventHandler from '../../../../../src/logic/operationHandlers/dispatchEventHandler.js';
import DispatchPerceptibleEventHandler from '../../../../../src/logic/operationHandlers/dispatchPerceptibleEventHandler.js';
import EndTurnHandler from '../../../../../src/logic/operationHandlers/endTurnHandler.js';
import AddComponentHandler from '../../../../../src/logic/operationHandlers/addComponentHandler.js';
import ModifyArrayFieldHandler from '../../../../../src/logic/operationHandlers/modifyArrayFieldHandler.js';
import SetVariableHandler from '../../../../../src/logic/operationHandlers/setVariableHandler.js';
import RegenerateDescriptionHandler from '../../../../../src/logic/operationHandlers/regenerateDescriptionHandler.js';
import {
  NAME_COMPONENT_ID,
  POSITION_COMPONENT_ID,
} from '../../../../../src/constants/componentIds.js';
import { ATTEMPT_ACTION_ID } from '../../../../../src/constants/eventIds.js';
import { createRuleTestEnvironment } from '../../../../common/engine/systemLogicTestEnv.js';

const ACTION_ID = 'physical-control:force_bend_over';

let bodyDescriptionComposer;

/**
 * Creates handlers needed for the force_bend_over rule.
 *
 * @param {object} entityManager - Entity manager instance
 * @param {object} eventBus - Event bus instance
 * @param {object} logger - Logger instance
 * @param {object} gameDataRepository - Game data repository instance
 * @returns {object} Handlers object
 */
function createHandlers(entityManager, eventBus, logger, gameDataRepository) {
  bodyDescriptionComposer = {
    composeDescription: jest.fn(
      async (entity) => `Description for ${entity.id}`
    ),
  };

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
    DISPATCH_EVENT: new DispatchEventHandler({ dispatcher: eventBus, logger }),
    DISPATCH_PERCEPTIBLE_EVENT: new DispatchPerceptibleEventHandler({
      dispatcher: safeDispatcher,
      logger,
    }),
    END_TURN: new EndTurnHandler({
      safeEventDispatcher: safeDispatcher,
      logger,
    }),
    ADD_COMPONENT: new AddComponentHandler({
      entityManager,
      logger,
      safeEventDispatcher: safeDispatcher,
      gameDataRepository,
    }),
    MODIFY_ARRAY_FIELD: new ModifyArrayFieldHandler({
      entityManager,
      logger,
      safeEventDispatcher: safeDispatcher,
    }),
    SET_VARIABLE: new SetVariableHandler({ logger }),
    REGENERATE_DESCRIPTION: new RegenerateDescriptionHandler({
      entityManager,
      bodyDescriptionComposer,
      logger,
      safeEventDispatcher: safeDispatcher,
    }),
  };
}

describe('physical_control_handle_force_bend_over rule integration', () => {
  let testEnv;

  beforeEach(() => {
    const macros = {
      'core:logSuccessAndEndTurn': logSuccessMacro,
      'core:logSuccessOutcomeAndEndTurn': logSuccessOutcomeMacro,
    };
    const expandedActions = expandMacros(forceBendOverRule.actions, {
      get: (type, id) => (type === 'macros' ? macros[id] : undefined),
    });

    const dataRegistry = {
      getAllSystemRules: jest
        .fn()
        .mockReturnValue([{ ...forceBendOverRule, actions: expandedActions }]),
      getConditionDefinition: jest.fn((id) =>
        id === 'physical-control:event-is-action-force-bend-over'
          ? eventIsActionForceBendOver
          : undefined
      ),
      getComponentDefinition: jest.fn((componentId) => {
        if (componentId === 'bending-states:bending_over') {
          return bendingOverComponent;
        }
        if (componentId === 'positioning:facing_away') {
          return facingAwayComponent;
        }
        return null;
      }),
    };

    testEnv = createRuleTestEnvironment({
      createHandlers,
      entities: [],
      rules: [{ ...forceBendOverRule, actions: expandedActions }],
      dataRegistry,
    });
  });

  afterEach(() => {
    if (testEnv) {
      testEnv.cleanup();
    }
  });

  it('applies bending_over, updates facing_away, regenerates descriptions, and logs success', async () => {
    testEnv.reset([
      {
        id: 'actor1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Rhea' },
          [POSITION_COMPONENT_ID]: { locationId: 'room1' },
          'personal-space-states:closeness': { partners: ['target1'] },
        },
      },
      {
        id: 'target1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Noah' },
          [POSITION_COMPONENT_ID]: { locationId: 'room1' },
          'personal-space-states:closeness': { partners: ['actor1'] },
        },
      },
      {
        id: 'surface1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Steel Table' },
          [POSITION_COMPONENT_ID]: { locationId: 'room1' },
          'bending:allows_bending_over': {},
        },
      },
    ]);

    await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
      eventName: 'core:attempt_action',
      actorId: 'actor1',
      actionId: ACTION_ID,
      primaryId: 'target1',
      secondaryId: 'surface1',
      originalInput: 'force_bend_over target1 surface1',
    });

    const target = testEnv.entityManager.getEntityInstance('target1');
    expect(target.components['bending-states:bending_over']).toMatchObject({
      surface_id: 'surface1',
    });
    expect(
      target.components['positioning:facing_away'].facing_away_from
    ).toContain('actor1');

    expect(bodyDescriptionComposer).toBeDefined();
    expect(bodyDescriptionComposer.composeDescription).toHaveBeenCalledTimes(2);
    const composedIds =
      bodyDescriptionComposer.composeDescription.mock.calls.map(
        ([entity]) => entity.id
      );
    expect(composedIds).toEqual(expect.arrayContaining(['target1', 'actor1']));

    const perceptibleEvent = testEnv.events.find(
      (event) => event.eventType === 'core:perceptible_event'
    );
    expect(perceptibleEvent).toBeDefined();
    expect(perceptibleEvent.payload.descriptionText).toBe(
      'Rhea forcefully bends Noah over Steel Table.'
    );
    expect(perceptibleEvent.payload.locationId).toBe('room1');
    expect(perceptibleEvent.payload.targetId).toBe('target1');

    const displayEvent = testEnv.events.find(
      (event) => event.eventType === 'core:display_successful_action_result'
    );
    expect(displayEvent).toBeDefined();
    expect(displayEvent.payload.message).toBe(
      'Rhea forcefully bends Noah over Steel Table.'
    );

    const successEvent = testEnv.events.find(
      (event) => event.eventType === 'core:action_success'
    );
    expect(successEvent).toBeDefined();
    expect(successEvent.payload.actionId).toBe(ACTION_ID);

    expect(testEnv.events.map((event) => event.eventType)).toContain(
      'core:turn_ended'
    );
  });

  it('adds the actor to existing facing_away arrays without removing other entries', async () => {
    testEnv.reset([
      {
        id: 'actor1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Rhea' },
          [POSITION_COMPONENT_ID]: { locationId: 'room1' },
          'personal-space-states:closeness': { partners: ['target1', 'actor2'] },
        },
      },
      {
        id: 'actor2',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Quinn' },
          [POSITION_COMPONENT_ID]: { locationId: 'room1' },
          'personal-space-states:closeness': { partners: ['target1', 'actor1'] },
        },
      },
      {
        id: 'target1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Noah' },
          [POSITION_COMPONENT_ID]: { locationId: 'room1' },
          'personal-space-states:closeness': { partners: ['actor1', 'actor2'] },
          'positioning:facing_away': {
            facing_away_from: ['actor2'],
          },
        },
      },
      {
        id: 'surface1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Steel Table' },
          [POSITION_COMPONENT_ID]: { locationId: 'room1' },
          'bending:allows_bending_over': {},
        },
      },
    ]);

    await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
      eventName: 'core:attempt_action',
      actorId: 'actor1',
      actionId: ACTION_ID,
      primaryId: 'target1',
      secondaryId: 'surface1',
      originalInput: 'force_bend_over target1 surface1',
    });

    const target = testEnv.entityManager.getEntityInstance('target1');
    expect(
      target.components['positioning:facing_away'].facing_away_from
    ).toEqual(expect.arrayContaining(['actor1', 'actor2']));
  });

  it('avoids duplicating the actor when they are already in the facing_away array', async () => {
    testEnv.reset([
      {
        id: 'actor1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Rhea' },
          [POSITION_COMPONENT_ID]: { locationId: 'room1' },
          'personal-space-states:closeness': { partners: ['target1'] },
        },
      },
      {
        id: 'target1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Noah' },
          [POSITION_COMPONENT_ID]: { locationId: 'room1' },
          'personal-space-states:closeness': { partners: ['actor1'] },
          'positioning:facing_away': {
            facing_away_from: ['actor1'],
          },
        },
      },
      {
        id: 'surface1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Steel Table' },
          [POSITION_COMPONENT_ID]: { locationId: 'room1' },
          'bending:allows_bending_over': {},
        },
      },
    ]);

    await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
      eventName: 'core:attempt_action',
      actorId: 'actor1',
      actionId: ACTION_ID,
      primaryId: 'target1',
      secondaryId: 'surface1',
      originalInput: 'force_bend_over target1 surface1',
    });

    const target = testEnv.entityManager.getEntityInstance('target1');
    const facingAwayFrom =
      target.components['positioning:facing_away'].facing_away_from;

    expect(facingAwayFrom).toContain('actor1');
    expect(facingAwayFrom.filter((id) => id === 'actor1')).toHaveLength(1);
  });
});
