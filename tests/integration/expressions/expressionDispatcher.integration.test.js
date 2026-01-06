/**
 * @file Integration tests for ExpressionDispatcher.
 */

import { describe, expect, it, jest } from '@jest/globals';
import ExpressionDispatcher from '../../../src/expressions/expressionDispatcher.js';
import {
  NAME_COMPONENT_ID,
  POSITION_COMPONENT_ID,
} from '../../../src/constants/componentIds.js';

const createEntityManagerStub = () => {
  const components = new Map();
  const getKey = (entityId, componentId) => `${entityId}:${componentId}`;

  return {
    setComponent(entityId, componentId, data) {
      components.set(getKey(entityId, componentId), data);
    },
    getComponentData: jest.fn((entityId, componentId) => {
      return components.get(getKey(entityId, componentId)) ?? null;
    }),
  };
};

const createLoggerStub = () => ({
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

describe('ExpressionDispatcher - Integration', () => {
  it('replaces placeholders in descriptionText and alternateDescriptions', async () => {
    const eventBus = { dispatch: jest.fn().mockResolvedValue() };
    const entityManager = createEntityManagerStub();
    const logger = createLoggerStub();
    const dispatcher = new ExpressionDispatcher({
      eventBus,
      entityManager,
      logger,
    });

    const actorId = 'actor-1';
    entityManager.setComponent(actorId, POSITION_COMPONENT_ID, {
      locationId: 'loc-1',
    });
    entityManager.setComponent(actorId, NAME_COMPONENT_ID, { text: 'Avery' });

    const expression = {
      id: 'test:placeholder_expression',
      description_text: '{actor} looks around.',
      alternate_descriptions: {
        observer: '{actor} scans the room.',
      },
    };

    const dispatched = await dispatcher.dispatch(actorId, expression, 1);

    expect(dispatched).toBe(true);
    expect(eventBus.dispatch).toHaveBeenCalledTimes(1);
    const [, payload] = eventBus.dispatch.mock.calls[0];
    expect(payload.descriptionText).toBe('Avery looks around.');
    expect(payload.alternateDescriptions).toEqual({
      observer: 'Avery scans the room.',
    });
    expect(payload.descriptionText).not.toContain('{actor}');
    expect(payload.contextualData.expressionId).toBe(expression.id);
  });

  it('rate limits dispatches within the same turn and allows later turns', async () => {
    const eventBus = { dispatch: jest.fn().mockResolvedValue() };
    const entityManager = createEntityManagerStub();
    const logger = createLoggerStub();
    const dispatcher = new ExpressionDispatcher({
      eventBus,
      entityManager,
      logger,
    });

    const actorId = 'actor-2';
    entityManager.setComponent(actorId, POSITION_COMPONENT_ID, {
      locationId: 'loc-2',
    });
    entityManager.setComponent(actorId, NAME_COMPONENT_ID, { text: 'Jordan' });

    const expression = {
      id: 'test:rate_limit_expression',
      description_text: '{actor} sighs.',
    };

    const firstDispatch = await dispatcher.dispatch(actorId, expression, 4);
    const secondDispatch = await dispatcher.dispatch(actorId, expression, 4);
    const thirdDispatch = await dispatcher.dispatch(actorId, expression, 5);

    expect(firstDispatch).toBe(true);
    expect(secondDispatch).toBe(false);
    expect(thirdDispatch).toBe(true);
    expect(eventBus.dispatch).toHaveBeenCalledTimes(2);
  });
});
