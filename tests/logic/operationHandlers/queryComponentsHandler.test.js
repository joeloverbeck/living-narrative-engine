// tests/logic/operationHandlers/queryComponentsHandler.test.js

import { describe, beforeEach, test, expect, jest } from '@jest/globals';
import QueryComponentsHandler from '../../../src/logic/operationHandlers/queryComponentsHandler.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../src/constants/eventIds.js';

const makeLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
});

describe('QueryComponentsHandler', () => {
  let entityManager;
  let logger;
  let dispatcher;
  let handler;

  const actorId = 'actor-1';
  const execCtx = {
    evaluationContext: { actor: { id: actorId }, target: null, context: {} },
    logger: makeLogger(),
  };

  beforeEach(() => {
    entityManager = { getComponentData: jest.fn() };
    logger = makeLogger();
    dispatcher = { dispatch: jest.fn() };
    handler = new QueryComponentsHandler({
      entityManager,
      logger,
      safeEventDispatcher: dispatcher,
    });
    jest.clearAllMocks();
    execCtx.evaluationContext.context = {};
  });

  test('fetches each component and stores results', () => {
    entityManager.getComponentData.mockImplementation((id, type) => {
      if (type === 'core:name') return { text: 'Hero' };
      if (type === 'core:pos') return { locationId: 'room1' };
      return undefined;
    });

    const params = {
      entity_ref: 'actor',
      pairs: [
        { component_type: 'core:name', result_variable: 'nameComp' },
        { component_type: 'core:pos', result_variable: 'posComp' },
      ],
    };

    handler.execute(params, execCtx);

    expect(entityManager.getComponentData).toHaveBeenCalledWith(
      actorId,
      'core:name'
    );
    expect(entityManager.getComponentData).toHaveBeenCalledWith(
      actorId,
      'core:pos'
    );
    expect(execCtx.evaluationContext.context.nameComp).toEqual({
      text: 'Hero',
    });
    expect(execCtx.evaluationContext.context.posComp).toEqual({
      locationId: 'room1',
    });
  });

  test('stores null when a component is missing', () => {
    entityManager.getComponentData.mockReturnValue(undefined);

    const params = {
      entity_ref: 'actor',
      pairs: [{ component_type: 'core:missing', result_variable: 'miss' }],
    };

    handler.execute(params, execCtx);

    expect(execCtx.evaluationContext.context.miss).toBeNull();
    expect(execCtx.logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('Stored null in "miss"')
    );
  });

  test('logs error when params invalid', () => {
    handler.execute(null, execCtx);
    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({
        message: expect.stringContaining('params missing'),
      })
    );
  });
});
