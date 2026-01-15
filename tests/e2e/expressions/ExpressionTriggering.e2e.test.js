/**
 * @file ExpressionTriggering.e2e.test.js
 * @description E2E coverage for expression triggering from ACTION_DECIDED updates.
 */

import { afterEach, describe, expect, it } from '@jest/globals';
import { createE2ETestEnvironment } from '../common/e2eTestContainer.js';
import { createEntityDefinition } from '../../common/entities/entityFactories.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import { ACTION_DECIDED_ID } from '../../../src/constants/eventIds.js';

const PERCEPTIBLE_EVENT_ID = 'core:perceptible_event';

const createMoodData = (overrides = {}) => ({
  valence: 0,
  arousal: 0,
  agency_control: 0,
  threat: 0,
  engagement: 0,
  future_expectancy: 0,
  self_evaluation: 0,
  affiliation: 0,
  inhibitory_control: 0,
  ...overrides,
});

const createSexualStateData = (overrides = {}) => ({
  sex_excitation: 0,
  sex_inhibition: 0,
  baseline_libido: 0,
  ...overrides,
});

const registerTestEntityDefinitions = (registry) => {
  const locationDef = createEntityDefinition('test:location', {
    'core:name': { text: 'Test Location' },
  });
  registry.store('entityDefinitions', 'test:location', locationDef);

  const actorDef = createEntityDefinition('test:actor', {
    'core:name': { text: 'Test Actor' },
    'core:actor': {},
  });
  registry.store('entityDefinitions', 'test:actor', actorDef);
};

const createActorAndLocation = async (entityManager) => {
  const location = await entityManager.createEntityInstance('test:location', {
    instanceId: `test-location-${Date.now()}`,
    componentOverrides: {
      'core:name': { text: 'Test Location' },
    },
  });

  const actor = await entityManager.createEntityInstance('test:actor', {
    instanceId: `test-actor-${Date.now()}`,
    componentOverrides: {
      'core:name': { text: 'Test Actor' },
      'core:position': { locationId: location.id },
      'core:actor': {},
      'core:mood': createMoodData(),
      'core:sexual_state': createSexualStateData(),
    },
  });

  return { actor, location };
};

const capturePerceptibleEvents = (eventBus) => {
  const events = [];
  const unsubscribe = eventBus.subscribe(PERCEPTIBLE_EVENT_ID, (event) => {
    events.push(event);
  });

  return { events, unsubscribe };
};

const setupExpressionEnv = async (extraExpressions = []) => {
  const env = await createE2ETestEnvironment({
    loadMods: true,
    mods: ['core', 'emotions-sexual-desire', 'emotions-curiosity-attention', 'emotions-absorption', 'emotions-disengagement', 'emotions-confusion'],
    stubLLM: true,
  });

  const registry = env.container.resolve(tokens.IDataRegistry);
  registerTestEntityDefinitions(registry);

  if (extraExpressions.length > 0) {
    for (const expression of extraExpressions) {
      registry.store('expressions', expression.id, expression);
    }
  }

  const safeEventDispatcher = env.container.resolve(tokens.ISafeEventDispatcher);
  const expressionListener = env.container.resolve(
    tokens.IExpressionPersistenceListener
  );
  safeEventDispatcher.subscribe(
    ACTION_DECIDED_ID,
    expressionListener.handleEvent.bind(expressionListener)
  );

  return {
    env,
    registry,
    safeEventDispatcher,
    entityManager: env.services.entityManager,
  };
};

describe('Expression triggering E2E', () => {
  let activeEnv;

  afterEach(async () => {
    if (activeEnv) {
      await activeEnv.env.cleanup();
      activeEnv = null;
    }
  });

  it('dispatches a perceptible event for a known expression', async () => {
    const deterministicExpression = {
      id: 'test:known_expression',
      priority: 9999,
      prerequisites: [],
      description_text: '{actor} shows a deterministic expression.',
      actor_description: 'Deterministic expression.',
      tags: ['test'],
    };

    activeEnv = await setupExpressionEnv([deterministicExpression]);
    const { env, safeEventDispatcher, entityManager } = activeEnv;
    const { events, unsubscribe } = capturePerceptibleEvents(
      env.services.eventBus
    );

    const { actor } = await createActorAndLocation(entityManager);

    const dispatched = await safeEventDispatcher.dispatch(ACTION_DECIDED_ID, {
      actorId: actor.id,
      actorType: 'ai',
      extractedData: {
        moodUpdate: createMoodData({
          valence: 80,
          arousal: -10,
          threat: -80,
          agency_control: 20,
          engagement: -30,
          future_expectancy: 10,
          self_evaluation: 10,
        }),
      },
    });

    expect(dispatched).toBe(true);
    expect(events).toHaveLength(1);
    expect(events[0].payload.contextualData.expressionId).toBe(
      'test:known_expression'
    );

    unsubscribe?.();
  });

  it('selects the highest-priority expression when multiple match', async () => {
    const highPriorityExpression = {
      id: 'test:priority_high',
      priority: 999,
      prerequisites: [{ logic: { '==': [1, 1] } }],
      description_text: '{actor} shows a high priority expression.',
      actor_description: 'High priority expression.',
      tags: ['test'],
    };
    const lowPriorityExpression = {
      id: 'test:priority_low',
      priority: 10,
      prerequisites: [{ logic: { '==': [1, 1] } }],
      description_text: '{actor} shows a low priority expression.',
      actor_description: 'Low priority expression.',
      tags: ['test'],
    };

    activeEnv = await setupExpressionEnv([
      highPriorityExpression,
      lowPriorityExpression,
    ]);
    const { env, safeEventDispatcher, entityManager } = activeEnv;
    const { events, unsubscribe } = capturePerceptibleEvents(
      env.services.eventBus
    );

    const { actor } = await createActorAndLocation(entityManager);

    const dispatched = await safeEventDispatcher.dispatch(ACTION_DECIDED_ID, {
      actorId: actor.id,
      actorType: 'ai',
      extractedData: {
        moodUpdate: createMoodData(),
      },
    });

    expect(dispatched).toBe(true);
    expect(events).toHaveLength(1);
    expect(events[0].payload.contextualData.expressionId).toBe(
      'test:priority_high'
    );

    unsubscribe?.();
  });

  it('skips dispatch on unchanged state updates after initial change', async () => {
    // Inject deterministic expression with no prerequisites to isolate
    // the caching/unchanged detection behavior being tested
    const deterministicExpression = {
      id: 'test:unchanged_state_expression',
      priority: 9999,
      prerequisites: [],
      description_text: '{actor} shows an expression.',
      actor_description: 'Expression.',
      tags: ['test'],
    };

    activeEnv = await setupExpressionEnv([deterministicExpression]);
    const { env, safeEventDispatcher, entityManager } = activeEnv;
    const { events, unsubscribe } = capturePerceptibleEvents(
      env.services.eventBus
    );

    const { actor } = await createActorAndLocation(entityManager);

    const initialMood = createMoodData({
      valence: 80,
      arousal: -10,
      threat: -80,
      agency_control: 20,
      engagement: -30,
      future_expectancy: 10,
      self_evaluation: 10,
    });

    await safeEventDispatcher.dispatch(ACTION_DECIDED_ID, {
      actorId: actor.id,
      actorType: 'ai',
      extractedData: {
        moodUpdate: initialMood,
      },
    });

    expect(events).toHaveLength(1);
    events.splice(0, events.length);

    await safeEventDispatcher.dispatch(ACTION_DECIDED_ID, {
      actorId: actor.id,
      actorType: 'ai',
      extractedData: {
        moodUpdate: initialMood,
      },
    });

    expect(events).toHaveLength(0);

    await safeEventDispatcher.dispatch(ACTION_DECIDED_ID, {
      actorId: actor.id,
      actorType: 'ai',
      extractedData: {
        moodUpdate: createMoodData({
          valence: 90,
          arousal: -5,
          threat: -80,
          agency_control: 20,
          engagement: -30,
          future_expectancy: 10,
          self_evaluation: 10,
        }),
      },
    });

    expect(events).toHaveLength(1);

    unsubscribe?.();
  });
});
