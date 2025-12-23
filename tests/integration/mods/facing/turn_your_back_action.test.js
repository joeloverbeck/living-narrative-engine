/**
 * @file Integration tests for the facing:turn_your_back action and rule.
 * @description Tests the rule execution after the turn_your_back action is performed.
 * Note: This test does not test action discovery or scope resolution - it assumes
 * the action is valid and dispatches it directly.
 */

import {
  describe,
  it,
  beforeEach,
  afterEach,
  expect,
  jest,
} from '@jest/globals';
import turnYourBackRule from '../../../../data/mods/facing/rules/turn_your_back.rule.json';
import eventIsActionTurnYourBack from '../../../../data/mods/facing/conditions/event-is-action-turn-your-back.condition.json';
import logSuccessMacro from '../../../../data/mods/core/macros/logSuccessAndEndTurn.macro.json';
import { expandMacros } from '../../../../src/utils/macroUtils.js';
import QueryComponentHandler from '../../../../src/logic/operationHandlers/queryComponentHandler.js';
import GetNameHandler from '../../../../src/logic/operationHandlers/getNameHandler.js';
import GetTimestampHandler from '../../../../src/logic/operationHandlers/getTimestampHandler.js';
import DispatchEventHandler from '../../../../src/logic/operationHandlers/dispatchEventHandler.js';
import DispatchPerceptibleEventHandler from '../../../../src/logic/operationHandlers/dispatchPerceptibleEventHandler.js';
import EndTurnHandler from '../../../../src/logic/operationHandlers/endTurnHandler.js';
import SetVariableHandler from '../../../../src/logic/operationHandlers/setVariableHandler.js';
import AddComponentHandler from '../../../../src/logic/operationHandlers/addComponentHandler.js';
import {
  NAME_COMPONENT_ID,
  POSITION_COMPONENT_ID,
} from '../../../../src/constants/componentIds.js';
import { ATTEMPT_ACTION_ID } from '../../../../src/constants/eventIds.js';
import { createRuleTestEnvironment } from '../../../common/engine/systemLogicTestEnv.js';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';

/**
 * Creates scenario where actor is sitting on furniture.
 */
function setupSittingTurnBackScenario() {
  return [
    {
      id: 'test:room',
      components: {
        [NAME_COMPONENT_ID]: { text: 'Test Room' },
      },
    },
    {
      id: 'test:chair',
      components: {
        [NAME_COMPONENT_ID]: { text: 'Comfortable Chair' },
        [POSITION_COMPONENT_ID]: { locationId: 'test:room' },
      },
    },
    {
      id: 'test:actor1',
      components: {
        [NAME_COMPONENT_ID]: { text: 'Sitting Player' },
        [POSITION_COMPONENT_ID]: { locationId: 'test:room' },
        'sitting-states:sitting_on': {
          furniture_id: 'test:chair',
          spot_index: 0,
        },
      },
    },
    {
      id: 'test:target1',
      components: {
        [NAME_COMPONENT_ID]: { text: 'Standing NPC' },
        [POSITION_COMPONENT_ID]: { locationId: 'test:room' },
      },
    },
  ];
}

/**
 * Creates scenario where actor is straddling another actor.
 */
function setupStraddlingTurnBackScenario() {
  return [
    {
      id: 'test:room',
      components: {
        [NAME_COMPONENT_ID]: { text: 'Test Room' },
      },
    },
    {
      id: 'test:chair',
      components: {
        [NAME_COMPONENT_ID]: { text: 'Chair' },
        [POSITION_COMPONENT_ID]: { locationId: 'test:room' },
      },
    },
    {
      id: 'test:straddled_target',
      components: {
        [NAME_COMPONENT_ID]: { text: 'Bob' },
        [POSITION_COMPONENT_ID]: { locationId: 'test:room' },
        'sitting-states:sitting_on': {
          furniture_id: 'test:chair',
          spot_index: 0,
        },
      },
    },
    {
      id: 'test:actor1',
      components: {
        [NAME_COMPONENT_ID]: { text: 'Straddling Player' },
        [POSITION_COMPONENT_ID]: { locationId: 'test:room' },
        'straddling-states:straddling_waist': {
          target_id: 'test:straddled_target',
          facing_away: false,
        },
      },
    },
    {
      id: 'test:target1',
      components: {
        [NAME_COMPONENT_ID]: { text: 'Standing NPC' },
        [POSITION_COMPONENT_ID]: { locationId: 'test:room' },
      },
    },
  ];
}

/**
 * Creates handlers needed for the turn_your_back rule.
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
    GET_TIMESTAMP: new GetTimestampHandler({ logger }),
    DISPATCH_PERCEPTIBLE_EVENT: new DispatchPerceptibleEventHandler({
      dispatcher: eventBus,
      logger,
      routingPolicyService: {
        validateAndHandle: jest.fn().mockReturnValue(true),
      },
      recipientSetBuilder,
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
  };
}

describe('facing:turn_your_back action integration', () => {
  let testEnv;

  beforeEach(() => {
    const macros = { 'core:logSuccessAndEndTurn': logSuccessMacro };
    const expanded = expandMacros(turnYourBackRule.actions, {
      get: (type, id) => (type === 'macros' ? macros[id] : undefined),
    });

    const dataRegistry = {
      getAllSystemRules: jest
        .fn()
        .mockReturnValue([{ ...turnYourBackRule, actions: expanded }]),
      getConditionDefinition: jest.fn((id) =>
        id === 'facing:event-is-action-turn-your-back'
          ? eventIsActionTurnYourBack
          : undefined
      ),
      getComponentDefinition: jest.fn().mockReturnValue(null),
    };

    testEnv = createRuleTestEnvironment({
      createHandlers,
      entities: [],
      rules: [{ ...turnYourBackRule, actions: expanded }],
      dataRegistry,
    });
  });

  afterEach(() => {
    if (testEnv) {
      testEnv.cleanup();
    }
  });

  it('successfully executes turn your back action', async () => {
    testEnv.reset([
      {
        id: 'test:actor1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Alice' },
          [POSITION_COMPONENT_ID]: { locationId: 'living_room' },
        },
      },
      {
        id: 'test:target1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Bob' },
          [POSITION_COMPONENT_ID]: { locationId: 'living_room' },
        },
      },
    ]);

    await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
      eventName: 'core:attempt_action',
      actorId: 'test:actor1',
      actionId: 'facing:turn_your_back',
      targetId: 'test:target1',
      originalInput: 'turn_your_back test:target1',
    });

    // Check that facing_away component was added
    const actor = testEnv.entityManager.getEntityInstance('test:actor1');
    expect(actor.components['facing-states:facing_away']).toBeDefined();
    expect(
      actor.components['facing-states:facing_away'].facing_away_from
    ).toEqual(['test:target1']);

    // Check success message
    const successEvent = testEnv.events.find(
      (e) => e.eventType === 'core:display_successful_action_result'
    );
    expect(successEvent).toBeDefined();
    expect(successEvent.payload.message).toBe('Alice turns their back to Bob.');

    // Check turn ended
    const turnEndedEvent = testEnv.events.find(
      (e) => e.eventType === 'core:turn_ended'
    );
    expect(turnEndedEvent).toBeDefined();
    expect(turnEndedEvent.payload.success).toBe(true);
  });

  it('creates correct perceptible event', async () => {
    testEnv.reset([
      {
        id: 'test:actor1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Sarah' },
          [POSITION_COMPONENT_ID]: { locationId: 'office' },
        },
      },
      {
        id: 'test:target1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'David' },
          [POSITION_COMPONENT_ID]: { locationId: 'office' },
        },
      },
    ]);

    await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
      eventName: 'core:attempt_action',
      actorId: 'test:actor1',
      actionId: 'facing:turn_your_back',
      targetId: 'test:target1',
      originalInput: 'turn_your_back test:target1',
    });

    const perceptibleEvent = testEnv.events.find(
      (e) => e.eventType === 'core:perceptible_event'
    );
    expect(perceptibleEvent).toBeDefined();
    expect(perceptibleEvent.payload.descriptionText).toBe(
      'Sarah turns their back to David.'
    );
    expect(perceptibleEvent.payload.locationId).toBe('office');
    expect(perceptibleEvent.payload.actorId).toBe('test:actor1');
    expect(perceptibleEvent.payload.targetId).toBe('test:target1');
  });

  it('dispatches custom positioning event', async () => {
    testEnv.reset([
      {
        id: 'test:actor1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Emma' },
          [POSITION_COMPONENT_ID]: { locationId: 'park' },
        },
      },
      {
        id: 'test:target1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Michael' },
          [POSITION_COMPONENT_ID]: { locationId: 'park' },
        },
      },
    ]);

    await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
      eventName: 'core:attempt_action',
      actorId: 'test:actor1',
      actionId: 'facing:turn_your_back',
      targetId: 'test:target1',
      originalInput: 'turn_your_back test:target1',
    });

    const customEvent = testEnv.events.find(
      (e) => e.eventType === 'positioning:actor_turned_back'
    );
    expect(customEvent).toBeDefined();
    expect(customEvent.payload.actor).toBe('test:actor1');
    expect(customEvent.payload.target).toBe('test:target1');
  });

  it('handles multiple actors in same location', async () => {
    testEnv.reset([
      {
        id: 'test:actor1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'John' },
          [POSITION_COMPONENT_ID]: { locationId: 'conference_room' },
        },
      },
      {
        id: 'test:target1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Manager' },
          [POSITION_COMPONENT_ID]: { locationId: 'conference_room' },
        },
      },
      {
        id: 'test:witness1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Colleague' },
          [POSITION_COMPONENT_ID]: { locationId: 'conference_room' },
        },
      },
    ]);

    await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
      eventName: 'core:attempt_action',
      actorId: 'test:actor1',
      actionId: 'facing:turn_your_back',
      targetId: 'test:target1',
      originalInput: 'turn_your_back test:target1',
    });

    // Component should be added correctly
    const actor = testEnv.entityManager.getEntityInstance('test:actor1');
    expect(
      actor.components['facing-states:facing_away'].facing_away_from
    ).toEqual(['test:target1']);

    // Perceptible event should be visible to all in location
    const perceptibleEvent = testEnv.events.find(
      (e) => e.eventType === 'core:perceptible_event'
    );
    expect(perceptibleEvent.payload.locationId).toBe('conference_room');
  });

  it('only fires for correct action ID', async () => {
    testEnv.reset([
      {
        id: 'test:actor1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Alice' },
          [POSITION_COMPONENT_ID]: { locationId: 'room1' },
        },
      },
      {
        id: 'test:target1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Bob' },
          [POSITION_COMPONENT_ID]: { locationId: 'room1' },
        },
      },
    ]);

    // Try with a different action
    await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
      eventName: 'core:attempt_action',
      actorId: 'test:actor1',
      actionId: 'core:wait',
      targetId: 'test:target1',
      originalInput: 'wait test:target1',
    });

    // Should not have any perceptible events from our rule
    const perceptibleEvents = testEnv.events.filter(
      (e) => e.eventType === 'core:perceptible_event'
    );
    expect(perceptibleEvents).toHaveLength(0);

    // Should not have added the component
    const actor = testEnv.entityManager.getEntityInstance('test:actor1');
    expect(actor.components['facing-states:facing_away']).toBeUndefined();
  });

  it('creates facing_away component with array structure', async () => {
    testEnv.reset([
      {
        id: 'test:actor1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Alice' },
          [POSITION_COMPONENT_ID]: { locationId: 'room1' },
        },
      },
      {
        id: 'test:target1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Bob' },
          [POSITION_COMPONENT_ID]: { locationId: 'room1' },
        },
      },
    ]);

    await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
      eventName: 'core:attempt_action',
      actorId: 'test:actor1',
      actionId: 'facing:turn_your_back',
      targetId: 'test:target1',
      originalInput: 'turn_your_back test:target1',
    });

    const actor = testEnv.entityManager.getEntityInstance('test:actor1');
    const facingAwayComponent = actor.components['facing-states:facing_away'];

    // Verify component structure matches schema
    expect(facingAwayComponent).toBeDefined();
    expect(Array.isArray(facingAwayComponent.facing_away_from)).toBe(true);
    expect(facingAwayComponent.facing_away_from).toHaveLength(1);
    expect(facingAwayComponent.facing_away_from[0]).toBe('test:target1');
  });

  it('works with namespaced entity IDs', async () => {
    // This test verifies functionality with realistic namespaced IDs
    testEnv.reset([
      {
        id: 'game:player_character',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Player' },
          [POSITION_COMPONENT_ID]: { locationId: 'tavern' },
        },
      },
      {
        id: 'npcs:bartender_instance',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Bartender' },
          [POSITION_COMPONENT_ID]: { locationId: 'tavern' },
        },
      },
    ]);

    await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
      eventName: 'core:attempt_action',
      actorId: 'game:player_character',
      actionId: 'facing:turn_your_back',
      targetId: 'npcs:bartender_instance',
      originalInput: 'turn_your_back npcs:bartender_instance',
    });

    // Component should store the namespaced target ID
    const actor = testEnv.entityManager.getEntityInstance(
      'game:player_character'
    );
    expect(actor.components['facing-states:facing_away']).toBeDefined();
    expect(
      actor.components['facing-states:facing_away'].facing_away_from
    ).toEqual(['npcs:bartender_instance']);

    // Verify success message includes proper names
    const successEvent = testEnv.events.find(
      (e) => e.eventType === 'core:display_successful_action_result'
    );
    expect(successEvent).toBeDefined();
    expect(successEvent.payload.message).toBe(
      'Player turns their back to Bartender.'
    );
  });

  it('demonstrates component lifecycle (would be prevented by forbidden_components in action discovery)', async () => {
    // This test shows what would happen if an actor already has facing_away component
    // In normal gameplay, the forbidden_components would prevent the action from appearing
    testEnv.reset([
      {
        id: 'test:actor1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Alice' },
          [POSITION_COMPONENT_ID]: { locationId: 'room1' },
          'facing-states:facing_away': {
            facing_away_from: ['test:existing_target'],
          },
        },
      },
      {
        id: 'test:target1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Bob' },
          [POSITION_COMPONENT_ID]: { locationId: 'room1' },
        },
      },
    ]);

    // This test verifies that the action system would prevent this
    // based on forbidden_components, but we dispatch directly
    // The rule would execute and replace the existing component
    await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
      eventName: 'core:attempt_action',
      actorId: 'test:actor1',
      actionId: 'facing:turn_your_back',
      targetId: 'test:target1',
      originalInput: 'turn_your_back test:target1',
    });

    // The ADD_COMPONENT operation would replace existing component
    const actor = testEnv.entityManager.getEntityInstance('test:actor1');
    expect(
      actor.components['facing-states:facing_away'].facing_away_from
    ).toEqual(['test:target1']);
  });

  it('validates component data matches facing_away schema expectations', async () => {
    // This test verifies that our component data matches the existing schema structure
    testEnv.reset([
      {
        id: 'test:actor1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Test Actor' },
          [POSITION_COMPONENT_ID]: { locationId: 'test_location' },
        },
      },
      {
        id: 'test:target1',
        components: {
          [NAME_COMPONENT_ID]: { text: 'Test Target' },
          [POSITION_COMPONENT_ID]: { locationId: 'test_location' },
        },
      },
    ]);

    await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
      eventName: 'core:attempt_action',
      actorId: 'test:actor1',
      actionId: 'facing:turn_your_back',
      targetId: 'test:target1',
      originalInput: 'turn_your_back test:target1',
    });

    const actor = testEnv.entityManager.getEntityInstance('test:actor1');
    const component = actor.components['facing-states:facing_away'];

    // Verify the component structure matches the schema requirements
    expect(component).toBeDefined();
    expect(component.facing_away_from).toBeDefined();
    expect(Array.isArray(component.facing_away_from)).toBe(true);
    expect(component.facing_away_from).toContain('test:target1');

    // Verify array uniqueness (though this test only has one item)
    expect(new Set(component.facing_away_from).size).toBe(
      component.facing_away_from.length
    );
  });

  it('should demonstrate sitting restriction (action discovery would prevent this)', async () => {
    // This test demonstrates that the forbidden_components logic would prevent
    // the action from being discovered when the actor is sitting
    const entities = setupSittingTurnBackScenario();
    testEnv.reset(entities);

    // In normal action discovery, this action would not appear in available actions
    // because the actor has the sitting-states:sitting_on component.
    // However, we're testing the rule execution directly to verify the logic.

    // NOTE: This test shows what would happen if somehow the action was triggered
    // In real gameplay, the action discovery system prevents this scenario
    await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
      eventName: 'core:attempt_action',
      actorId: 'test:actor1',
      actionId: 'facing:turn_your_back',
      targetId: 'test:target1',
      originalInput: 'turn_your_back test:target1',
    });

    // The rule itself would still execute because we're bypassing action discovery
    const actor = testEnv.entityManager.getEntityInstance('test:actor1');
    expect(actor.components['facing-states:facing_away']).toBeDefined();
    expect(
      actor.components['facing-states:facing_away'].facing_away_from
    ).toEqual(['test:target1']);

    // Verify success message would still be generated
    const successEvent = testEnv.events.find(
      (e) => e.eventType === 'core:display_successful_action_result'
    );
    expect(successEvent).toBeDefined();
    expect(successEvent.payload.message).toBe(
      'Sitting Player turns their back to Standing NPC.'
    );

    // This test proves the restriction is at the action discovery level,
    // not at the rule execution level - which is the correct design
  });

  it('validates sitting restriction component structure in turn_your_back context', async () => {
    // This test validates that the sitting_on component structure matches expectations
    const entities = setupSittingTurnBackScenario();
    testEnv.reset(entities);

    // Verify the sitting component is properly structured
    const actor = testEnv.entityManager.getEntityInstance('test:actor1');
    expect(actor.components['sitting-states:sitting_on']).toBeDefined();
    expect(actor.components['sitting-states:sitting_on'].furniture_id).toBe(
      'test:chair'
    );
    expect(actor.components['sitting-states:sitting_on'].spot_index).toBe(0);

    // Verify the chair entity exists
    const chair = testEnv.entityManager.getEntityInstance('test:chair');
    expect(chair).toBeDefined();
    expect(chair.components['core:name'].text).toBe('Comfortable Chair');

    // Verify actor is properly named and located
    expect(actor.components['core:name'].text).toBe('Sitting Player');
    expect(actor.components['core:position'].locationId).toBe('test:room');
  });

  it('should demonstrate straddling restriction (action discovery would prevent this)', async () => {
    // This test demonstrates that the forbidden_components logic would prevent
    // the action from being discovered when the actor is straddling another actor
    const entities = setupStraddlingTurnBackScenario();
    testEnv.reset(entities);

    // Verify initial state with straddling component
    const initialActor = testEnv.entityManager.getEntityInstance('test:actor1');
    expect(initialActor.components['straddling-states:straddling_waist']).toEqual({
      target_id: 'test:straddled_target',
      facing_away: false,
    });

    // In normal action discovery, this action would not appear in available actions
    // because the actor has the straddling-states:straddling_waist component.
    // However, we're testing the rule execution directly to verify the logic.

    // NOTE: This test shows what would happen if somehow the action was triggered
    // In real gameplay, the action discovery system prevents this scenario
    await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
      eventName: 'core:attempt_action',
      actorId: 'test:actor1',
      actionId: 'facing:turn_your_back',
      targetId: 'test:target1',
      originalInput: 'turn_your_back test:target1',
    });

    // The rule itself would still execute because we're bypassing action discovery
    const actor = testEnv.entityManager.getEntityInstance('test:actor1');
    expect(actor.components['facing-states:facing_away']).toBeDefined();
    expect(
      actor.components['facing-states:facing_away'].facing_away_from
    ).toEqual(['test:target1']);

    // Verify straddling component retained
    expect(actor.components['straddling-states:straddling_waist']).toEqual({
      target_id: 'test:straddled_target',
      facing_away: false,
    });

    // Verify success message would still be generated
    const successEvent = testEnv.events.find(
      (e) => e.eventType === 'core:display_successful_action_result'
    );
    expect(successEvent).toBeDefined();
    expect(successEvent.payload.message).toBe(
      'Straddling Player turns their back to Standing NPC.'
    );

    // This test proves the restriction is at the action discovery level,
    // not at the rule execution level - which is the correct design
  });
});

describe('facing:turn_your_back forbidden component enforcement', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'facing',
      'turn_your_back'
    );
  });

  afterEach(() => {
    testFixture?.cleanup();
  });

  it('rejects turning your back while hugging another actor', async () => {
    const room = new ModEntityBuilder('room1').asRoom('Test Room').build();

    const actor = new ModEntityBuilder('actor1')
      .withName('Alice')
      .atLocation('room1')
      .asActor()
      .withComponent('hugging-states:hugging', {
        embraced_entity_id: 'target1',
        initiated: true,
      })
      .build();

    const target = new ModEntityBuilder('target1')
      .withName('Bob')
      .atLocation('room1')
      .asActor()
      .build();

    testFixture.reset([room, actor, target]);

    await expect(
      testFixture.executeAction(actor.id, target.id)
    ).rejects.toThrow(/forbidden component.*hugging-states:hugging/i);
  });
});
