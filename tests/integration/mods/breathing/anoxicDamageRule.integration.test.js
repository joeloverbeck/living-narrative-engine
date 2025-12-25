/**
 * @file Integration tests for the breathing:handle_anoxic_damage rule.
 *
 * This rule is a stub that dispatches a brain_damage_started event when an entity
 * has the unconscious_anoxia component. The actual brain damage application is
 * handled by the HypoxiaTickSystem (OXYDROSYS-019).
 */

import {
  describe,
  it,
  beforeEach,
  afterEach,
  expect,
  jest,
} from '@jest/globals';
import { createRuleTestEnvironment } from '../../../common/engine/systemLogicTestEnv.js';
import DispatchEventHandler from '../../../../src/logic/operationHandlers/dispatchEventHandler.js';
import anoxicDamageRule from '../../../../data/mods/breathing/rules/handle_anoxic_damage.rule.json';

const ACTOR_ID = 'test:actor';
const UNCONSCIOUS_ANOXIA_COMPONENT = 'breathing:unconscious_anoxia';

function createHandlers(entityManager, eventBus, logger, dataRegistry) {
  return {
    DISPATCH_EVENT: new DispatchEventHandler({
      logger,
      dispatcher: eventBus,
    }),
  };
}

describe('breathing:handle_anoxic_damage rule integration', () => {
  let testEnv;
  let dispatchedEvents;

  beforeEach(() => {
    dispatchedEvents = [];
    testEnv = createRuleTestEnvironment({
      createHandlers,
      rules: [anoxicDamageRule],
    });

    // Capture dispatched events for verification using subscribe()
    testEnv.eventBus.subscribe('breathing:brain_damage_started', (event) => {
      dispatchedEvents.push({ type: 'breathing:brain_damage_started', payload: event.payload });
    });
  });

  afterEach(() => {
    testEnv?.cleanup();
  });

  const resetWithComponents = (actorComponents = {}) => {
    testEnv.reset([
      {
        id: ACTOR_ID,
        components: actorComponents,
      },
    ]);
  };

  it('dispatches brain_damage_started event when entity has unconscious_anoxia component', async () => {
    resetWithComponents({
      [UNCONSCIOUS_ANOXIA_COMPONENT]: {},
    });

    await testEnv.eventBus.dispatch('core:turn_ended', {
      entityId: ACTOR_ID,
      success: true,
    });

    expect(dispatchedEvents).toHaveLength(1);
    expect(dispatchedEvents[0].type).toBe('breathing:brain_damage_started');
    expect(dispatchedEvents[0].payload.entityId).toBe(ACTOR_ID);
  });

  it('does not dispatch event when entity lacks unconscious_anoxia component', async () => {
    resetWithComponents({});

    await testEnv.eventBus.dispatch('core:turn_ended', {
      entityId: ACTOR_ID,
      success: true,
    });

    expect(dispatchedEvents).toHaveLength(0);
  });

  it('dispatches event on each turn while unconscious from anoxia', async () => {
    resetWithComponents({
      [UNCONSCIOUS_ANOXIA_COMPONENT]: {},
    });

    await testEnv.eventBus.dispatch('core:turn_ended', {
      entityId: ACTOR_ID,
      success: true,
    });

    await testEnv.eventBus.dispatch('core:turn_ended', {
      entityId: ACTOR_ID,
      success: true,
    });

    expect(dispatchedEvents).toHaveLength(2);
  });

  it('does not dispatch when entity has hypoxic but not unconscious_anoxia component', async () => {
    resetWithComponents({
      'breathing:hypoxic': { severity: 'severe' },
    });

    await testEnv.eventBus.dispatch('core:turn_ended', {
      entityId: ACTOR_ID,
      success: true,
    });

    expect(dispatchedEvents).toHaveLength(0);
  });
});
