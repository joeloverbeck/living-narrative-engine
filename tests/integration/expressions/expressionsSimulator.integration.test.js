/**
 * @file Integration tests for expressions simulator data flow.
 * Uses mock expressions to validate system behavior without dependency on specific mod files.
 */

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { IntegrationTestBed } from '../../common/integrationTestBed.js';
import { buildStateMap } from '../../common/expressionTestUtils.js';
import { registerExpressionServices } from '../../../src/dependencyInjection/registrations/expressionsRegistrations.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import {
  NAME_COMPONENT_ID,
  POSITION_COMPONENT_ID,
} from '../../../src/constants/componentIds.js';

const MOOD_AXES_KEYS = [
  'valence',
  'arousal',
  'agency_control',
  'threat',
  'engagement',
  'future_expectancy',
  'temporal_orientation',
  'self_evaluation',
  'affiliation',
  'inhibitory_control',
  'uncertainty',
  'contamination_salience',
  'rumination',
  'evaluation_pressure',
];

/**
 * Mock expressions for testing expression simulator system behavior.
 * These validate the system's ability to load, evaluate, and dispatch expressions
 * without depending on specific mod content.
 *
 * @returns {Array<object>} Array of mock expression objects
 */
const createMockExpressions = () => [
  {
    id: 'test:expression-with-actor-placeholder',
    priority: 100,
    prerequisites: [{ logic: { '>=': [{ var: 'moodAxes.valence' }, 0] } }],
    description_text: '{actor} feels a wave of emotion.',
    emotion_effects: { anticipation: 5 },
  },
  {
    id: 'test:high-priority-expression',
    priority: 200,
    prerequisites: [{ logic: { '>=': [{ var: 'moodAxes.arousal' }, 0] } }],
    description_text: 'An intense feeling surges through {actor}.',
    emotion_effects: { excitement: 10 },
  },
  {
    id: 'test:sexual-context-expression',
    priority: 50,
    prerequisites: [
      { logic: { '>=': [{ var: 'sexualStates.sex_excitation' }, 0] } },
    ],
    description_text: '{actor} experiences heightened awareness.',
    sexual_effects: { arousal: 5 },
  },
];

const MOCK_EMOTION_KEYS = ['anticipation', 'excitement', 'calm'];
const MOCK_SEXUAL_KEYS = ['arousal', 'desire', 'inhibition'];

const loadMockExpressions = (dataRegistry) => {
  const expressions = createMockExpressions();
  for (const expression of expressions) {
    dataRegistry.store('expressions', expression.id, expression);
  }
  return expressions;
};

const expectZeroedState = (state, keys) => {
  expect(Object.keys(state).sort()).toEqual([...keys].sort());
  keys.forEach((key) => {
    expect(state[key]).toBe(0);
  });
};

const createEntityManagerStub = () => {
  const components = new Map();
  const entityComponents = new Map();

  const getKey = (entityId, componentId) => `${entityId}:${componentId}`;
  const setComponent = (entityId, componentId, data) => {
    components.set(getKey(entityId, componentId), data);
    if (!entityComponents.has(entityId)) {
      entityComponents.set(entityId, new Set());
    }
    entityComponents.get(entityId).add(componentId);
  };

  return {
    setComponent,
    getComponentData: jest.fn((entityId, componentId) => {
      return components.get(getKey(entityId, componentId)) ?? null;
    }),
    getAllComponentTypesForEntity: jest.fn((entityId) => {
      return Array.from(entityComponents.get(entityId) ?? []);
    }),
    hasComponent: jest.fn((entityId, componentId) => {
      return Boolean(entityComponents.get(entityId)?.has(componentId));
    }),
    getEntitiesInLocation: jest.fn(() => new Set()),
  };
};

describe('Expressions Simulator - Integration', () => {
  let testBed;
  let container;
  let dataRegistry;
  let expressionRegistry;
  let expressionDispatcher;
  let eventBus;
  let expressionContextBuilder;
  let expressionEvaluatorService;
  let entityManager;
  let loadedExpressions;
  let emotionCalculator;

  beforeEach(async () => {
    testBed = new IntegrationTestBed();
    await testBed.initialize();

    container = testBed.container;
    entityManager = createEntityManagerStub();
    testBed.setOverride(tokens.IEntityManager, entityManager);

    registerExpressionServices(container);

    dataRegistry = container.resolve(tokens.IDataRegistry);
    loadedExpressions = loadMockExpressions(dataRegistry);

    emotionCalculator = container.resolve(tokens.IEmotionCalculatorService);
    emotionCalculator.getEmotionPrototypeKeys.mockReturnValue(MOCK_EMOTION_KEYS);
    emotionCalculator.getSexualPrototypeKeys.mockReturnValue(MOCK_SEXUAL_KEYS);
    emotionCalculator.calculateEmotions.mockReturnValue(
      buildStateMap(MOCK_EMOTION_KEYS)
    );
    emotionCalculator.calculateSexualStates.mockReturnValue(
      buildStateMap(MOCK_SEXUAL_KEYS)
    );

    expressionRegistry = container.resolve(tokens.IExpressionRegistry);
    expressionContextBuilder = container.resolve(tokens.IExpressionContextBuilder);
    expressionEvaluatorService = container.resolve(tokens.IExpressionEvaluatorService);
    expressionDispatcher = container.resolve(tokens.IExpressionDispatcher);
    eventBus = container.resolve(tokens.IEventBus);
  });

  afterEach(async () => {
    if (testBed) {
      await testBed.cleanup();
    }
  });

  it('reports the expression registry count after loading expressions', () => {
    expect(expressionRegistry.getAllExpressions().length).toBe(
      loadedExpressions.length
    );
  });

  it('dispatches a perceptible event payload with actor name replacement', async () => {
    const actorId = 'sim-actor';
    entityManager.setComponent(actorId, POSITION_COMPONENT_ID, {
      locationId: 'sim:lab',
    });
    entityManager.setComponent(actorId, NAME_COMPONENT_ID, { text: 'Sim Actor' });

    const expression =
      loadedExpressions.find((item) =>
        item?.description_text?.includes('{actor}')
      ) ?? loadedExpressions[0];

    const payloadPromise = new Promise((resolve) => {
      const unsubscribe = eventBus.subscribe('core:perceptible_event', (event) => {
        unsubscribe?.();
        resolve(event.payload);
      });
    });

    await expressionDispatcher.dispatch(actorId, expression, 1);

    const payload = await payloadPromise;
    expect(payload.contextualData.expressionId).toBe(expression.id);
    expect(payload.descriptionText).toContain('Sim Actor');
  });

  it('evaluates a known expression against simulator context inputs', () => {
    const actorId = 'sim-evaluator';
    const testExpression = {
      id: 'test:simulator-eval',
      priority: 99999,
      prerequisites: [
        { logic: { '>=': [{ var: 'moodAxes.valence' }, 10] } },
      ],
    };

    dataRegistry.store('expressions', testExpression.id, testExpression);

    const context = expressionContextBuilder.buildContext(
      actorId,
      { valence: 15 },
      { sex_excitation: 0, sex_inhibition: 0, baseline_libido: 0 },
      null
    );

    const matches = expressionEvaluatorService.evaluateAll(context);

    expect(matches[0]).toMatchObject({
      id: 'test:simulator-eval',
      priority: 99999,
    });
  });

  it('provides zeroed previous* defaults for simulator contexts', () => {
    const actorId = 'sim-previous-defaults';

    const context = expressionContextBuilder.buildContext(
      actorId,
      { valence: 15 },
      { sex_excitation: 0, sex_inhibition: 0, baseline_libido: 0 },
      null
    );

    expectZeroedState(context.previousEmotions, MOCK_EMOTION_KEYS);
    expectZeroedState(context.previousSexualStates, MOCK_SEXUAL_KEYS);
    expectZeroedState(context.previousMoodAxes, MOOD_AXES_KEYS);
  });
});
