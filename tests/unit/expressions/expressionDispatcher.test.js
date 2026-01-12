import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import ExpressionDispatcher from '../../../src/expressions/expressionDispatcher.js';
import {
  NAME_COMPONENT_ID,
  POSITION_COMPONENT_ID,
} from '../../../src/constants/componentIds.js';

const createLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

const createDispatcher = ({
  eventBusOverrides = {},
  entityManagerOverrides = {},
  loggerOverrides = {},
} = {}) => {
  const eventBus = {
    dispatch: jest.fn().mockResolvedValue(),
    ...eventBusOverrides,
  };
  const entityManager = {
    getComponentData: jest.fn(),
    ...entityManagerOverrides,
  };
  const logger = { ...createLogger(), ...loggerOverrides };

  const dispatcher = new ExpressionDispatcher({
    eventBus,
    entityManager,
    logger,
  });

  return { dispatcher, eventBus, entityManager, logger };
};

const createExpression = (overrides = {}) => ({
  id: 'expr:one',
  actor_description: 'I feel heat rise.',
  description_text: '{actor} clenches their jaw.',
  alternate_descriptions: {
    auditory: '{actor} inhales sharply.',
  },
  perception_type: 'emotion.expression',
  category: 'anger',
  ...overrides,
});

const createComponentDataLookup = ({
  locationId = 'loc-1',
  nameData = { text: 'Alice' },
} = {}) => {
  return jest.fn((actorId, componentId) => {
    if (componentId === POSITION_COMPONENT_ID) {
      return locationId ? { locationId } : null;
    }
    if (componentId === NAME_COMPONENT_ID) {
      return nameData;
    }
    return null;
  });
};

describe('ExpressionDispatcher', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should dispatch expression as perceptible event', async () => {
    const { dispatcher, eventBus, entityManager } = createDispatcher();
    entityManager.getComponentData = createComponentDataLookup();

    const expression = createExpression();
    const result = await dispatcher.dispatch('actor-1', expression, 1);

    expect(result).toBe(true);
    expect(eventBus.dispatch).toHaveBeenCalledTimes(1);

    const [eventName, payload] = eventBus.dispatch.mock.calls[0];
    expect(eventName).toBe('core:perceptible_event');
    expect(payload).toMatchObject({
      eventName: 'core:perceptible_event',
      locationId: 'loc-1',
      originLocationId: 'loc-1',
      descriptionText: 'Alice clenches their jaw.',
      actorDescription: 'I feel heat rise.',
      perceptionType: 'emotion.expression',
      actorId: 'actor-1',
      targetId: null,
      involvedEntities: [],
      alternateDescriptions: {
        auditory: 'Alice inhales sharply.',
      },
      senseAware: true,
      contextualData: {
        source: 'expression_system',
        expressionId: 'expr:one',
        category: 'anger',
      },
    });
    expect(payload.timestamp).toEqual(expect.any(String));
    expect(Number.isNaN(Date.parse(payload.timestamp))).toBe(false);
  });

  it('should replace {actor} placeholder with actor name', async () => {
    const { dispatcher, eventBus, entityManager } = createDispatcher();
    entityManager.getComponentData = createComponentDataLookup({
      nameData: { text: 'Morgan' },
    });

    const expression = createExpression({
      description_text: '{actor} looks away.',
    });
    await dispatcher.dispatch('actor-1', expression, 1);

    const [, payload] = eventBus.dispatch.mock.calls[0];
    expect(payload.descriptionText).toBe('Morgan looks away.');
  });

  it('should use actor ID as fallback when name unavailable', async () => {
    const { dispatcher, eventBus, entityManager } = createDispatcher();
    entityManager.getComponentData = createComponentDataLookup({
      nameData: null,
    });

    const expression = createExpression({
      description_text: '{actor} shivers.',
    });
    await dispatcher.dispatch('actor-1', expression, 1);

    const [, payload] = eventBus.dispatch.mock.calls[0];
    expect(payload.descriptionText).toBe('actor-1 shivers.');
  });

  it('should include alternate descriptions in payload', async () => {
    const { dispatcher, eventBus, entityManager } = createDispatcher();
    entityManager.getComponentData = createComponentDataLookup();

    const expression = createExpression({
      alternate_descriptions: {
        auditory: '{actor} exhales.',
        olfactory: 'The air smells sharp.',
      },
    });
    await dispatcher.dispatch('actor-1', expression, 1);

    const [, payload] = eventBus.dispatch.mock.calls[0];
    expect(payload.alternateDescriptions).toEqual({
      auditory: 'Alice exhales.',
      olfactory: 'The air smells sharp.',
    });
  });

  it('should use default perception type when not specified', async () => {
    const { dispatcher, eventBus, entityManager } = createDispatcher();
    entityManager.getComponentData = createComponentDataLookup();

    const expression = createExpression({ perception_type: undefined });
    await dispatcher.dispatch('actor-1', expression, 1);

    const [, payload] = eventBus.dispatch.mock.calls[0];
    expect(payload.perceptionType).toBe('emotion.expression');
  });

  it('should rate limit to one expression per turn', async () => {
    const { dispatcher, eventBus, entityManager } = createDispatcher();
    entityManager.getComponentData = createComponentDataLookup();

    const expression = createExpression();
    const first = await dispatcher.dispatch('actor-1', expression, 1);
    const second = await dispatcher.dispatch('actor-2', expression, 1);

    expect(first).toBe(true);
    expect(second).toBe(false);
    expect(eventBus.dispatch).toHaveBeenCalledTimes(1);
  });

  it('should return false when actor has no location', async () => {
    const { dispatcher, eventBus, entityManager, logger } = createDispatcher();
    entityManager.getComponentData = createComponentDataLookup({
      locationId: null,
    });

    const expression = createExpression();
    const result = await dispatcher.dispatch('actor-1', expression, 1);

    expect(result).toBe(false);
    expect(eventBus.dispatch).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalled();
  });

  it('should clear rate limits with clearRateLimits method', async () => {
    const { dispatcher, eventBus, entityManager } = createDispatcher();
    entityManager.getComponentData = createComponentDataLookup();

    const expression = createExpression();
    await dispatcher.dispatch('actor-1', expression, 1);
    const blocked = await dispatcher.dispatch('actor-1', expression, 1);

    dispatcher.clearRateLimits();
    const allowed = await dispatcher.dispatch('actor-1', expression, 1);

    expect(blocked).toBe(false);
    expect(allowed).toBe(true);
    expect(eventBus.dispatch).toHaveBeenCalledTimes(2);
  });

  it('should handle dispatch errors gracefully', async () => {
    const { dispatcher, eventBus, entityManager, logger } = createDispatcher({
      eventBusOverrides: {
        dispatch: jest.fn().mockRejectedValue(new Error('boom')),
      },
    });
    entityManager.getComponentData = createComponentDataLookup();

    const expression = createExpression();
    const result = await dispatcher.dispatch('actor-1', expression, 1);

    expect(result).toBe(false);
    expect(eventBus.dispatch).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalled();
  });

  it('should validate dependencies in constructor', () => {
    const logger = createLogger();
    const entityManager = { getComponentData: jest.fn() };

    expect(
      () =>
        new ExpressionDispatcher({
          eventBus: null,
          entityManager,
          logger,
        })
    ).toThrow('Missing required dependency');

    expect(
      () =>
        new ExpressionDispatcher({
          eventBus: {},
          entityManager,
          logger,
        })
    ).toThrow('Invalid or missing method');
  });

  it('should include expression ID in payload for debugging', async () => {
    const { dispatcher, eventBus, entityManager } = createDispatcher();
    entityManager.getComponentData = createComponentDataLookup();

    const expression = createExpression({ id: 'expr:debug' });
    await dispatcher.dispatch('actor-1', expression, 1);

    const [, payload] = eventBus.dispatch.mock.calls[0];
    expect(payload.contextualData.expressionId).toBe('expr:debug');
  });

  it('should include category from expression in contextualData', async () => {
    const { dispatcher, eventBus, entityManager } = createDispatcher();
    entityManager.getComponentData = createComponentDataLookup();

    const expression = createExpression({ category: 'affection' });
    await dispatcher.dispatch('actor-1', expression, 1);

    const [, payload] = eventBus.dispatch.mock.calls[0];
    expect(payload.contextualData.category).toBe('affection');
  });

  it('should default category to calm when expression has no category', async () => {
    const { dispatcher, eventBus, entityManager } = createDispatcher();
    entityManager.getComponentData = createComponentDataLookup();

    const expression = createExpression({ category: undefined });
    await dispatcher.dispatch('actor-1', expression, 1);

    const [, payload] = eventBus.dispatch.mock.calls[0];
    expect(payload.contextualData.category).toBe('calm');
  });

  it('should default category to calm when expression.category is null', async () => {
    const { dispatcher, eventBus, entityManager } = createDispatcher();
    entityManager.getComponentData = createComponentDataLookup();

    const expression = createExpression({ category: null });
    await dispatcher.dispatch('actor-1', expression, 1);

    const [, payload] = eventBus.dispatch.mock.calls[0];
    expect(payload.contextualData.category).toBe('calm');
  });
});
