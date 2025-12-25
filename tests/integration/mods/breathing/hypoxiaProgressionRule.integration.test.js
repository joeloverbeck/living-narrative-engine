/**
 * @file Integration tests for the breathing:handle_hypoxia_progression rule.
 *
 * This rule is a stub that dispatches a hypoxia_started event when an entity
 * has the hypoxic component. The actual severity escalation logic is handled
 * by the HypoxiaTickSystem (OXYDROSYS-019).
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
import hypoxiaProgressionRule from '../../../../data/mods/breathing/rules/handle_hypoxia_progression.rule.json';

const ACTOR_ID = 'test:actor';
const HYPOXIC_COMPONENT = 'breathing:hypoxic';

function createHandlers(entityManager, eventBus, logger, dataRegistry) {
  return {
    DISPATCH_EVENT: new DispatchEventHandler({
      logger,
      dispatcher: eventBus,
    }),
  };
}

describe('breathing:handle_hypoxia_progression rule integration', () => {
  let testEnv;
  let dispatchedEvents;

  beforeEach(() => {
    dispatchedEvents = [];
    testEnv = createRuleTestEnvironment({
      createHandlers,
      rules: [hypoxiaProgressionRule],
    });

    // Capture dispatched events for verification using subscribe()
    testEnv.eventBus.subscribe('breathing:hypoxia_started', (event) => {
      dispatchedEvents.push({ type: 'breathing:hypoxia_started', payload: event.payload });
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

  it('dispatches hypoxia_started event when entity has hypoxic component', async () => {
    resetWithComponents({
      [HYPOXIC_COMPONENT]: { severity: 'mild' },
    });

    await testEnv.eventBus.dispatch('core:turn_ended', {
      entityId: ACTOR_ID,
      success: true,
    });

    expect(dispatchedEvents).toHaveLength(1);
    expect(dispatchedEvents[0].type).toBe('breathing:hypoxia_started');
    expect(dispatchedEvents[0].payload.entityId).toBe(ACTOR_ID);
    expect(dispatchedEvents[0].payload.severity).toBe('mild');
  });

  it('does not dispatch event when entity lacks hypoxic component', async () => {
    resetWithComponents({});

    await testEnv.eventBus.dispatch('core:turn_ended', {
      entityId: ACTOR_ID,
      success: true,
    });

    expect(dispatchedEvents).toHaveLength(0);
  });

  it('dispatches event on each turn while hypoxic', async () => {
    resetWithComponents({
      [HYPOXIC_COMPONENT]: { severity: 'mild' },
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
});
