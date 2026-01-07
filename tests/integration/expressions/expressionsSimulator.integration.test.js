/**
 * @file Integration tests for expressions simulator data flow.
 */

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import path from 'node:path';
import { readFile, readdir } from 'node:fs/promises';
import { IntegrationTestBed } from '../../common/integrationTestBed.js';
import {
  buildStateMap,
  collectExpressionStateKeys,
} from '../../common/expressionTestUtils.js';
import { registerExpressionServices } from '../../../src/dependencyInjection/registrations/expressionsRegistrations.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import {
  NAME_COMPONENT_ID,
  POSITION_COMPONENT_ID,
} from '../../../src/constants/componentIds.js';

const EXPRESSIONS_DIR = path.resolve(
  process.cwd(),
  'data',
  'mods',
  'emotions',
  'expressions'
);

const loadExpressions = async (dataRegistry) => {
  const files = await readdir(EXPRESSIONS_DIR);
  const expressions = [];

  for (const file of files) {
    if (!file.endsWith('.expression.json')) {
      continue;
    }

    const expression = JSON.parse(
      await readFile(path.join(EXPRESSIONS_DIR, file), 'utf-8')
    );
    dataRegistry.store('expressions', expression.id, expression);
    expressions.push(expression);
  }

  return expressions;
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
  let emotionKeys;
  let sexualKeys;

  beforeEach(async () => {
    testBed = new IntegrationTestBed();
    await testBed.initialize();

    container = testBed.container;
    entityManager = createEntityManagerStub();
    testBed.setOverride(tokens.IEntityManager, entityManager);

    registerExpressionServices(container);

    dataRegistry = container.resolve(tokens.IDataRegistry);
    loadedExpressions = await loadExpressions(dataRegistry);

    emotionCalculator = container.resolve(tokens.IEmotionCalculatorService);
    ({ emotionKeys, sexualKeys } = collectExpressionStateKeys(loadedExpressions));
    emotionCalculator.getEmotionPrototypeKeys.mockReturnValue(emotionKeys);
    emotionCalculator.getSexualPrototypeKeys.mockReturnValue(sexualKeys);
    emotionCalculator.calculateEmotions.mockReturnValue(buildStateMap(emotionKeys));
    emotionCalculator.calculateSexualStates.mockReturnValue(
      buildStateMap(sexualKeys)
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
});
