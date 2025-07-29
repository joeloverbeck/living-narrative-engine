// tests/logic/operationHandlers/queryComponentsHandler.test.js

import { describe, beforeEach, test, expect, jest } from '@jest/globals';
import QueryComponentsHandler from '../../../../src/logic/operationHandlers/queryComponentsHandler.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../../src/constants/eventIds.js';

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

  describe('evaluation context validation', () => {
    test('returns early when evaluation context cannot be ensured', () => {
      // Mock ensureEvaluationContext to return null/false by removing evaluationContext
      const invalidExecCtx = { logger: makeLogger() };

      const params = {
        entity_ref: 'actor',
        pairs: [{ component_type: 'core:name', result_variable: 'nameComp' }],
      };

      handler.execute(params, invalidExecCtx);

      expect(entityManager.getComponentData).not.toHaveBeenCalled();
      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.objectContaining({
          message: expect.stringContaining('evaluationContext'),
        })
      );
    });
  });

  describe('pairs array validation', () => {
    test('dispatches error when pairs is not an array', () => {
      const params = {
        entity_ref: 'actor',
        pairs: 'invalid-not-array',
      };

      handler.execute(params, execCtx);

      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.objectContaining({
          message: expect.stringContaining('"pairs" must be a non-empty array'),
        })
      );
      expect(entityManager.getComponentData).not.toHaveBeenCalled();
    });

    test('dispatches error when pairs is empty array', () => {
      const params = {
        entity_ref: 'actor',
        pairs: [],
      };

      handler.execute(params, execCtx);

      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.objectContaining({
          message: expect.stringContaining('"pairs" must be a non-empty array'),
        })
      );
      expect(entityManager.getComponentData).not.toHaveBeenCalled();
    });

    test('skips invalid pair objects and continues processing', () => {
      entityManager.getComponentData.mockReturnValue({ text: 'Hero' });

      const params = {
        entity_ref: 'actor',
        pairs: [
          null, // Invalid pair
          'invalid-string', // Invalid pair
          { component_type: 'core:name', result_variable: 'nameComp' }, // Valid pair
        ],
      };

      handler.execute(params, execCtx);

      // Should process only the valid pair
      expect(entityManager.getComponentData).toHaveBeenCalledTimes(1);
      expect(entityManager.getComponentData).toHaveBeenCalledWith(
        actorId,
        'core:name'
      );
      expect(execCtx.evaluationContext.context.nameComp).toEqual({
        text: 'Hero',
      });
    });
  });

  describe('entity and component validation', () => {
    test('dispatches error and continues when entity_ref is invalid', () => {
      entityManager.getComponentData.mockReturnValue({ text: 'Hero' });

      const params = {
        entity_ref: 'actor',
        pairs: [
          { component_type: null, result_variable: 'comp1' }, // Invalid component_type
          { component_type: 'core:name', result_variable: 'comp2' }, // Valid pair
        ],
      };

      handler.execute(params, execCtx);

      // Should skip first pair and process second
      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.objectContaining({
          message: expect.stringContaining(
            'Invalid entity_ref or component_type in pair'
          ),
        })
      );
      expect(entityManager.getComponentData).toHaveBeenCalledTimes(1);
      expect(entityManager.getComponentData).toHaveBeenCalledWith(
        actorId,
        'core:name'
      );
    });

    test('dispatches error when entity_ref resolves to null', () => {
      const invalidExecCtx = {
        evaluationContext: { actor: null, target: null, context: {} },
        logger: makeLogger(),
      };

      const params = {
        entity_ref: 'actor',
        pairs: [{ component_type: 'core:name', result_variable: 'nameComp' }],
      };

      handler.execute(params, invalidExecCtx);

      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.objectContaining({
          message: expect.stringContaining(
            'Invalid entity_ref or component_type in pair'
          ),
        })
      );
      expect(entityManager.getComponentData).not.toHaveBeenCalled();
    });
  });

  describe('result_variable validation', () => {
    test('dispatches error when result_variable is missing', () => {
      entityManager.getComponentData.mockReturnValue({ text: 'Hero' });

      const params = {
        entity_ref: 'actor',
        pairs: [
          { component_type: 'core:name' }, // Missing result_variable
          { component_type: 'core:pos', result_variable: 'posComp' }, // Valid pair
        ],
      };

      handler.execute(params, execCtx);

      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.objectContaining({
          message: expect.stringContaining('Invalid result_variable in pair'),
        })
      );
      // Should still process the valid pair
      expect(entityManager.getComponentData).toHaveBeenCalledWith(
        actorId,
        'core:pos'
      );
    });

    test('dispatches error when result_variable is not a string', () => {
      const params = {
        entity_ref: 'actor',
        pairs: [{ component_type: 'core:name', result_variable: 123 }],
      };

      handler.execute(params, execCtx);

      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.objectContaining({
          message: expect.stringContaining('Invalid result_variable in pair'),
        })
      );
      expect(entityManager.getComponentData).not.toHaveBeenCalled();
    });

    test('dispatches error when result_variable is empty string', () => {
      const params = {
        entity_ref: 'actor',
        pairs: [{ component_type: 'core:name', result_variable: '   ' }],
      };

      handler.execute(params, execCtx);

      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.objectContaining({
          message: expect.stringContaining('Invalid result_variable in pair'),
        })
      );
      expect(entityManager.getComponentData).not.toHaveBeenCalled();
    });

    test('trims whitespace from result_variable name', () => {
      entityManager.getComponentData.mockReturnValue({ text: 'Hero' });

      const params = {
        entity_ref: 'actor',
        pairs: [
          { component_type: 'core:name', result_variable: '  nameComp  ' },
        ],
      };

      handler.execute(params, execCtx);

      expect(execCtx.evaluationContext.context.nameComp).toEqual({
        text: 'Hero',
      });
      expect(execCtx.logger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          'Stored component "core:name" value in "nameComp"'
        )
      );
    });
  });

  describe('component retrieval error handling', () => {
    test('handles EntityManager errors gracefully', () => {
      const error = new Error('Database connection failed');
      entityManager.getComponentData.mockImplementation(() => {
        throw error;
      });

      const params = {
        entity_ref: 'actor',
        pairs: [{ component_type: 'core:name', result_variable: 'nameComp' }],
      };

      handler.execute(params, execCtx);

      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.objectContaining({
          message: expect.stringContaining(
            'Error retrieving component "core:name" from entity'
          ),
          details: expect.objectContaining({
            error: 'Database connection failed',
            stack: expect.any(String),
          }),
        })
      );
      // Should store null when error occurs
      expect(execCtx.evaluationContext.context.nameComp).toBeNull();
    });

    test('continues processing other pairs after component retrieval error', () => {
      entityManager.getComponentData.mockImplementation((id, type) => {
        if (type === 'core:broken') throw new Error('Component error');
        if (type === 'core:name') return { text: 'Hero' };
        return undefined;
      });

      const params = {
        entity_ref: 'actor',
        pairs: [
          { component_type: 'core:broken', result_variable: 'brokenComp' },
          { component_type: 'core:name', result_variable: 'nameComp' },
        ],
      };

      handler.execute(params, execCtx);

      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.objectContaining({
          message: expect.stringContaining(
            'Error retrieving component "core:broken"'
          ),
        })
      );
      expect(execCtx.evaluationContext.context.brokenComp).toBeNull();
      expect(execCtx.evaluationContext.context.nameComp).toEqual({
        text: 'Hero',
      });
    });
  });

  describe('comprehensive integration scenarios', () => {
    test('processes mixed success and failure scenarios correctly', () => {
      entityManager.getComponentData.mockImplementation((id, type) => {
        if (type === 'core:name') return { text: 'Hero' };
        if (type === 'core:error') throw new Error('Test error');
        return undefined;
      });

      const params = {
        entity_ref: 'actor',
        pairs: [
          null, // Invalid pair object
          { component_type: 'core:name', result_variable: 'nameComp' }, // Valid
          { component_type: null, result_variable: 'invalidComp' }, // Invalid component
          { component_type: 'core:missing', result_variable: 'missingComp' }, // Missing component
          { component_type: 'core:error', result_variable: 'errorComp' }, // Error during retrieval
          { component_type: 'core:pos', result_variable: '' }, // Invalid result_variable
        ],
      };

      handler.execute(params, execCtx);

      // Verify all expected behavior
      expect(execCtx.evaluationContext.context.nameComp).toEqual({
        text: 'Hero',
      });
      expect(execCtx.evaluationContext.context.missingComp).toBeNull();
      expect(execCtx.evaluationContext.context.errorComp).toBeNull();

      // Should not have set invalidComp or the invalid result_variable
      expect(execCtx.evaluationContext.context.invalidComp).toBeUndefined();

      // Should have dispatched errors for invalid pairs
      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.objectContaining({
          message: expect.stringContaining(
            'Invalid entity_ref or component_type in pair'
          ),
        })
      );
      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.objectContaining({
          message: expect.stringContaining('Invalid result_variable in pair'),
        })
      );
      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.objectContaining({
          message: expect.stringContaining(
            'Error retrieving component "core:error"'
          ),
        })
      );
    });

    test('logs debug messages for successful and failed component retrievals', () => {
      entityManager.getComponentData.mockImplementation((id, type) => {
        if (type === 'core:name') return { text: 'Hero' };
        return undefined;
      });

      const params = {
        entity_ref: 'actor',
        pairs: [
          { component_type: 'core:name', result_variable: 'nameComp' },
          { component_type: 'core:missing', result_variable: 'missingComp' },
        ],
      };

      handler.execute(params, execCtx);

      expect(execCtx.logger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          'Stored component "core:name" value in "nameComp"'
        )
      );
      expect(execCtx.logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Component "core:missing" not found on entity')
      );
      expect(execCtx.logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Stored null in "missingComp"')
      );
    });
  });
});
