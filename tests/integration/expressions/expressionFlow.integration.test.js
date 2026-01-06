/**
 * @file Integration tests for expression flow via ExpressionPersistenceListener.
 */

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import path from 'node:path';
import { readFile, readdir } from 'node:fs/promises';
import { IntegrationTestBed } from '../../common/integrationTestBed.js';
import { registerExpressionServices } from '../../../src/dependencyInjection/registrations/expressionsRegistrations.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import { ACTION_DECIDED_ID } from '../../../src/constants/eventIds.js';
import {
  NAME_COMPONENT_ID,
  MOOD_COMPONENT_ID,
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
  const entityComponentIds = new Map();

  const getKey = (entityId, componentId) => `${entityId}:${componentId}`;
  const registerComponent = (entityId, componentId) => {
    if (!entityComponentIds.has(entityId)) {
      entityComponentIds.set(entityId, new Set());
    }
    entityComponentIds.get(entityId).add(componentId);
  };

  return {
    setComponent(entityId, componentId, data) {
      components.set(getKey(entityId, componentId), data);
      registerComponent(entityId, componentId);
    },
    getComponentData: jest.fn((entityId, componentId) => {
      return components.get(getKey(entityId, componentId)) ?? null;
    }),
    getAllComponentTypesForEntity: jest.fn((entityId) => {
      return Array.from(entityComponentIds.get(entityId) ?? []);
    }),
    hasComponent: jest.fn((entityId, componentId) => {
      return Boolean(entityComponentIds.get(entityId)?.has(componentId));
    }),
    getEntitiesInLocation: jest.fn(() => new Set()),
  };
};

const createEmotionMap = (values) => new Map(Object.entries(values));

const createTestExpression = ({
  id,
  priority = 999,
  prerequisites,
  descriptionText = '{actor} reacts to a test trigger.',
  actorDescription = 'Test actor description.',
} = {}) => ({
  $schema: 'schema://living-narrative-engine/expression.schema.json',
  id,
  description: 'Test expression',
  priority,
  prerequisites,
  actor_description: actorDescription,
  description_text: descriptionText,
});

describe('Expression Flow - Integration', () => {
  let testBed;
  let container;
  let eventBus;
  let entityManager;
  let emotionCalculator;
  let expressionListener;
  let dataRegistry;

  beforeEach(async () => {
    testBed = new IntegrationTestBed();
    await testBed.initialize();

    container = testBed.container;
    eventBus = { dispatch: jest.fn().mockResolvedValue() };
    entityManager = createEntityManagerStub();

    testBed.setOverride(tokens.IEventBus, eventBus);
    testBed.setOverride(tokens.IEntityManager, entityManager);

    registerExpressionServices(container);

    dataRegistry = container.resolve(tokens.IDataRegistry);
    await loadExpressions(dataRegistry);

    emotionCalculator = container.resolve(tokens.IEmotionCalculatorService);
    expressionListener = container.resolve(tokens.IExpressionPersistenceListener);
  });

  afterEach(async () => {
    if (testBed) {
      await testBed.cleanup();
    }
  });

  it('dispatches the highest priority anger expression when multiple match', async () => {
    const actorId = 'actor-1';
    entityManager.setComponent(actorId, POSITION_COMPONENT_ID, {
      locationId: 'loc-1',
    });
    entityManager.setComponent(actorId, NAME_COMPONENT_ID, { text: 'Avery' });

    emotionCalculator.calculateSexualArousal.mockReturnValue(0.2);
    emotionCalculator.calculateEmotions.mockReturnValue(
      createEmotionMap({ anger: 0.8 })
    );
    emotionCalculator.calculateSexualStates.mockReturnValue(new Map());

    await expressionListener.handleEvent({
      type: ACTION_DECIDED_ID,
      payload: {
        actorId,
        extractedData: {
          moodUpdate: {
            arousal: 60,
            agency_control: -40,
          },
        },
      },
    });

    expect(eventBus.dispatch).toHaveBeenCalledTimes(1);
    const [eventName, payload] = eventBus.dispatch.mock.calls[0];
    expect(eventName).toBe('core:perceptible_event');
    expect(payload.contextualData.expressionId).toBe('emotions:explosive_anger');
    expect(payload.descriptionText).toContain('Avery');
    expect(payload.descriptionText).not.toContain('{actor}');
    expect(payload.actorDescription).toBeDefined();
    expect(payload.perceptionType).toBe('emotion.expression');
  });

  it('dispatches quiet_contentment for low-arousal positive state', async () => {
    const actorId = 'actor-2';
    entityManager.setComponent(actorId, POSITION_COMPONENT_ID, {
      locationId: 'loc-2',
    });
    entityManager.setComponent(actorId, NAME_COMPONENT_ID, { text: 'Jordan' });

    emotionCalculator.calculateSexualArousal.mockReturnValue(0.1);
    emotionCalculator.calculateEmotions.mockReturnValue(
      createEmotionMap({ contentment: 0.6 })
    );
    emotionCalculator.calculateSexualStates.mockReturnValue(new Map());

    await expressionListener.handleEvent({
      type: ACTION_DECIDED_ID,
      payload: {
        actorId,
        extractedData: {
          moodUpdate: {
            arousal: 10,
            valence: 30,
          },
        },
      },
    });

    expect(eventBus.dispatch).toHaveBeenCalledTimes(1);
    const [, payload] = eventBus.dispatch.mock.calls[0];
    expect(payload.contextualData.expressionId).toBe('emotions:quiet_contentment');
  });

  it('does not dispatch when no expressions match', async () => {
    const actorId = 'actor-3';
    entityManager.setComponent(actorId, POSITION_COMPONENT_ID, {
      locationId: 'loc-3',
    });
    entityManager.setComponent(actorId, NAME_COMPONENT_ID, { text: 'Casey' });

    emotionCalculator.calculateSexualArousal.mockReturnValue(0);
    emotionCalculator.calculateEmotions.mockReturnValue(new Map());
    emotionCalculator.calculateSexualStates.mockReturnValue(new Map());

    await expressionListener.handleEvent({
      type: ACTION_DECIDED_ID,
      payload: {
        actorId,
        extractedData: {
          moodUpdate: {
            arousal: 0,
            valence: 0,
          },
        },
      },
    });

    expect(eventBus.dispatch).not.toHaveBeenCalled();
  });

  it('skips dispatch when the evaluation state is unchanged', async () => {
    const actorId = 'actor-4';
    entityManager.setComponent(actorId, POSITION_COMPONENT_ID, {
      locationId: 'loc-4',
    });
    entityManager.setComponent(actorId, NAME_COMPONENT_ID, { text: 'Robin' });

    emotionCalculator.calculateSexualArousal.mockReturnValue(0.1);
    emotionCalculator.calculateEmotions.mockReturnValue(
      createEmotionMap({ contentment: 0.6 })
    );
    emotionCalculator.calculateSexualStates.mockReturnValue(new Map());

    const payload = {
      type: ACTION_DECIDED_ID,
      payload: {
        actorId,
        extractedData: {
          moodUpdate: {
            arousal: 10,
            valence: 30,
          },
        },
      },
    };

    await expressionListener.handleEvent(payload);
    expect(eventBus.dispatch).toHaveBeenCalledTimes(1);

    await expressionListener.handleEvent(payload);
    expect(eventBus.dispatch).toHaveBeenCalledTimes(1);
  });

  it('requires all prerequisites to match before dispatching', async () => {
    const actorId = 'actor-5';
    entityManager.setComponent(actorId, POSITION_COMPONENT_ID, {
      locationId: 'loc-5',
    });
    entityManager.setComponent(actorId, NAME_COMPONENT_ID, { text: 'Morgan' });

    dataRegistry.store(
      'expressions',
      'test:multi_prereq',
      createTestExpression({
        id: 'test:multi_prereq',
        prerequisites: [
          { logic: { '>=': [{ var: 'moodAxes.valence' }, 10] } },
          { logic: { '>=': [{ var: 'moodAxes.arousal' }, 15] } },
        ],
      })
    );

    emotionCalculator.calculateSexualArousal.mockReturnValue(0);
    emotionCalculator.calculateEmotions.mockReturnValue(new Map());
    emotionCalculator.calculateSexualStates.mockReturnValue(new Map());

    await expressionListener.handleEvent({
      type: ACTION_DECIDED_ID,
      payload: {
        actorId,
        extractedData: {
          moodUpdate: {
            arousal: 0,
            valence: 12,
          },
        },
      },
    });

    expect(eventBus.dispatch).not.toHaveBeenCalled();

    await expressionListener.handleEvent({
      type: ACTION_DECIDED_ID,
      payload: {
        actorId,
        extractedData: {
          moodUpdate: {
            arousal: 20,
            valence: 12,
          },
        },
      },
    });

    expect(eventBus.dispatch).toHaveBeenCalledTimes(1);
    const [, payload] = eventBus.dispatch.mock.calls[0];
    expect(payload.contextualData.expressionId).toBe('test:multi_prereq');
  });

  it('uses cached prior state instead of current components for change detection', async () => {
    const actorId = 'actor-6';
    entityManager.setComponent(actorId, POSITION_COMPONENT_ID, {
      locationId: 'loc-6',
    });
    entityManager.setComponent(actorId, NAME_COMPONENT_ID, { text: 'Taylor' });

    dataRegistry.store(
      'expressions',
      'test:cache_precedes_components',
      createTestExpression({
        id: 'test:cache_precedes_components',
        priority: 1000,
        prerequisites: [
          { logic: { '>=': [{ var: 'moodAxes.valence' }, 0] } },
        ],
      })
    );

    emotionCalculator.calculateSexualArousal.mockReturnValue(0);
    emotionCalculator.calculateEmotions.mockReturnValue(new Map());
    emotionCalculator.calculateSexualStates.mockReturnValue(new Map());

    entityManager.setComponent(actorId, MOOD_COMPONENT_ID, {
      arousal: 0,
      valence: 5,
    });

    await expressionListener.handleEvent({
      type: ACTION_DECIDED_ID,
      payload: {
        actorId,
        extractedData: {
          moodUpdate: {
            arousal: 0,
            valence: 5,
          },
        },
      },
    });

    expect(eventBus.dispatch).toHaveBeenCalledTimes(1);

    entityManager.setComponent(actorId, MOOD_COMPONENT_ID, {
      arousal: 0,
      valence: 15,
    });

    await expressionListener.handleEvent({
      type: ACTION_DECIDED_ID,
      payload: {
        actorId,
        extractedData: {
          moodUpdate: {
            arousal: 0,
            valence: 15,
          },
        },
      },
    });

    expect(eventBus.dispatch).toHaveBeenCalledTimes(2);
    const [, payload] = eventBus.dispatch.mock.calls[1];
    expect(payload.contextualData.expressionId).toBe(
      'test:cache_precedes_components'
    );
  });
});
