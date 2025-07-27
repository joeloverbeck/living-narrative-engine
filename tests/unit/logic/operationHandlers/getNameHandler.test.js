/**
 * @file Unit tests for GetNameHandler operation handler
 * @see src/logic/operationHandlers/getNameHandler.js
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import GetNameHandler from '../../../../src/logic/operationHandlers/getNameHandler.js';
import { NAME_COMPONENT_ID } from '../../../../src/constants/componentIds.js';
import { DEFAULT_FALLBACK_CHARACTER_NAME } from '../../../../src/constants/textDefaults.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../../src/constants/eventIds.js';

describe('GetNameHandler', () => {
  let handler;
  let mockEntityManager;
  let mockLogger;
  let mockSafeEventDispatcher;
  let executionContext;

  beforeEach(() => {
    mockEntityManager = {
      getComponentData: jest.fn(),
    };

    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    mockSafeEventDispatcher = {
      dispatch: jest.fn(),
    };

    executionContext = {
      evaluationContext: {
        context: {},
        actor: { id: 'actor-123' },
        target: { id: 'target-456' },
      },
      logger: mockLogger,
    };

    handler = new GetNameHandler({
      entityManager: mockEntityManager,
      logger: mockLogger,
      safeEventDispatcher: mockSafeEventDispatcher,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Constructor', () => {
    it('should initialize successfully with valid dependencies', () => {
      expect(
        () =>
          new GetNameHandler({
            entityManager: mockEntityManager,
            logger: mockLogger,
            safeEventDispatcher: mockSafeEventDispatcher,
          })
      ).not.toThrow();
    });

    it('should throw error when entityManager is missing', () => {
      expect(
        () =>
          new GetNameHandler({
            logger: mockLogger,
            safeEventDispatcher: mockSafeEventDispatcher,
          })
      ).toThrow();
    });

    it('should throw error when logger is missing', () => {
      expect(
        () =>
          new GetNameHandler({
            entityManager: mockEntityManager,
            safeEventDispatcher: mockSafeEventDispatcher,
          })
      ).toThrow();
    });

    it('should throw error when safeEventDispatcher is missing', () => {
      expect(
        () =>
          new GetNameHandler({
            entityManager: mockEntityManager,
            logger: mockLogger,
          })
      ).toThrow();
    });

    it('should throw error when entityManager lacks required methods', () => {
      expect(
        () =>
          new GetNameHandler({
            entityManager: {},
            logger: mockLogger,
            safeEventDispatcher: mockSafeEventDispatcher,
          })
      ).toThrow();
    });

    it('should throw error when safeEventDispatcher lacks required methods', () => {
      expect(
        () =>
          new GetNameHandler({
            entityManager: mockEntityManager,
            logger: mockLogger,
            safeEventDispatcher: {},
          })
      ).toThrow();
    });
  });

  describe('Parameter Validation', () => {
    it('should dispatch error and return early when params is null', () => {
      handler.execute(null, executionContext);

      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.objectContaining({
          message: 'GET_NAME: params missing or invalid.',
        })
      );
      expect(mockEntityManager.getComponentData).not.toHaveBeenCalled();
    });

    it('should dispatch error and return early when params is undefined', () => {
      handler.execute(undefined, executionContext);

      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.objectContaining({
          message: 'GET_NAME: params missing or invalid.',
        })
      );
      expect(mockEntityManager.getComponentData).not.toHaveBeenCalled();
    });

    it('should dispatch error and return early when params is not an object', () => {
      handler.execute('string', executionContext);

      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.objectContaining({
          message: 'GET_NAME: params missing or invalid.',
        })
      );
      expect(mockEntityManager.getComponentData).not.toHaveBeenCalled();
    });

    it('should dispatch error when entity_ref is missing', () => {
      const params = {
        result_variable: 'testVar',
      };

      handler.execute(params, executionContext);

      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.objectContaining({
          message: 'GET_NAME: "entity_ref" parameter is required.',
        })
      );
      expect(mockEntityManager.getComponentData).not.toHaveBeenCalled();
    });

    it('should dispatch error when entity_ref is null', () => {
      const params = {
        entity_ref: null,
        result_variable: 'testVar',
      };

      handler.execute(params, executionContext);

      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.objectContaining({
          message: 'GET_NAME: "entity_ref" parameter is required.',
        })
      );
      expect(mockEntityManager.getComponentData).not.toHaveBeenCalled();
    });

    it('should dispatch error when result_variable is missing', () => {
      const params = {
        entity_ref: 'actor',
      };

      handler.execute(params, executionContext);

      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.objectContaining({
          message: 'GET_NAME: "result_variable" must be a non-empty string.',
        })
      );
      expect(mockEntityManager.getComponentData).not.toHaveBeenCalled();
    });

    it('should dispatch error when result_variable is null', () => {
      const params = {
        entity_ref: 'actor',
        result_variable: null,
      };

      handler.execute(params, executionContext);

      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.objectContaining({
          message: 'GET_NAME: "result_variable" must be a non-empty string.',
        })
      );
      expect(mockEntityManager.getComponentData).not.toHaveBeenCalled();
    });

    it('should dispatch error when result_variable is empty string', () => {
      const params = {
        entity_ref: 'actor',
        result_variable: '',
      };

      handler.execute(params, executionContext);

      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.objectContaining({
          message: 'GET_NAME: "result_variable" must be a non-empty string.',
        })
      );
      expect(mockEntityManager.getComponentData).not.toHaveBeenCalled();
    });

    it('should dispatch error when result_variable is whitespace only', () => {
      const params = {
        entity_ref: 'actor',
        result_variable: '   ',
      };

      handler.execute(params, executionContext);

      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.objectContaining({
          message: 'GET_NAME: "result_variable" must be a non-empty string.',
        })
      );
      expect(mockEntityManager.getComponentData).not.toHaveBeenCalled();
    });

    it('should dispatch error when result_variable is not a string', () => {
      const params = {
        entity_ref: 'actor',
        result_variable: 123,
      };

      handler.execute(params, executionContext);

      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.objectContaining({
          message: 'GET_NAME: "result_variable" must be a non-empty string.',
        })
      );
      expect(mockEntityManager.getComponentData).not.toHaveBeenCalled();
    });
  });

  describe('Execution Context Validation', () => {
    const validParams = {
      entity_ref: 'actor',
      result_variable: 'testVar',
    };

    it('should dispatch error when execution context is null', () => {
      handler.execute(validParams, null);

      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.objectContaining({
          message:
            'ensureEvaluationContext: executionContext.evaluationContext.context is missing or invalid.',
        })
      );
      expect(mockEntityManager.getComponentData).not.toHaveBeenCalled();
    });

    it('should dispatch error when execution context is undefined', () => {
      handler.execute(validParams, undefined);

      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.objectContaining({
          message:
            'ensureEvaluationContext: executionContext.evaluationContext.context is missing or invalid.',
        })
      );
      expect(mockEntityManager.getComponentData).not.toHaveBeenCalled();
    });

    it('should dispatch error when evaluationContext is missing', () => {
      const invalidContext = {
        logger: mockLogger,
      };

      handler.execute(validParams, invalidContext);

      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.objectContaining({
          message:
            'ensureEvaluationContext: executionContext.evaluationContext.context is missing or invalid.',
        })
      );
      expect(mockEntityManager.getComponentData).not.toHaveBeenCalled();
    });

    it('should dispatch error when evaluationContext.context is missing', () => {
      const invalidContext = {
        evaluationContext: {},
        logger: mockLogger,
      };

      handler.execute(validParams, invalidContext);

      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.objectContaining({
          message:
            'ensureEvaluationContext: executionContext.evaluationContext.context is missing or invalid.',
        })
      );
      expect(mockEntityManager.getComponentData).not.toHaveBeenCalled();
    });
  });

  describe('Entity Resolution', () => {
    const baseParams = {
      result_variable: 'testVar',
    };

    it('should resolve "actor" keyword to actor ID from execution context', () => {
      const params = {
        ...baseParams,
        entity_ref: 'actor',
      };
      const componentData = { text: 'Actor Name' };
      mockEntityManager.getComponentData.mockReturnValue(componentData);

      handler.execute(params, executionContext);

      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        'actor-123',
        NAME_COMPONENT_ID
      );
      expect(executionContext.evaluationContext.context.testVar).toBe(
        'Actor Name'
      );
    });

    it('should resolve "target" keyword to target ID from execution context', () => {
      const params = {
        ...baseParams,
        entity_ref: 'target',
      };
      const componentData = { text: 'Target Name' };
      mockEntityManager.getComponentData.mockReturnValue(componentData);

      handler.execute(params, executionContext);

      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        'target-456',
        NAME_COMPONENT_ID
      );
      expect(executionContext.evaluationContext.context.testVar).toBe(
        'Target Name'
      );
    });

    it('should use direct entity ID when provided as string', () => {
      const params = {
        ...baseParams,
        entity_ref: 'entity-789',
      };
      const componentData = { text: 'Entity Name' };
      mockEntityManager.getComponentData.mockReturnValue(componentData);

      handler.execute(params, executionContext);

      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        'entity-789',
        NAME_COMPONENT_ID
      );
      expect(executionContext.evaluationContext.context.testVar).toBe(
        'Entity Name'
      );
    });

    it('should handle EntityRefObject when provided', () => {
      const params = {
        ...baseParams,
        entity_ref: { entityId: 'ref-object-123' },
      };
      const componentData = { text: 'Ref Object Name' };
      mockEntityManager.getComponentData.mockReturnValue(componentData);

      handler.execute(params, executionContext);

      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        'ref-object-123',
        NAME_COMPONENT_ID
      );
      expect(executionContext.evaluationContext.context.testVar).toBe(
        'Ref Object Name'
      );
    });

    it('should log warning and use fallback when entity resolution fails', () => {
      const params = {
        ...baseParams,
        entity_ref: '   ', // Empty string that will fail resolution
      };

      handler.execute(params, executionContext);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Could not resolve entity from entity_ref'),
        expect.objectContaining({
          entity_ref: '   ',
        })
      );
      expect(executionContext.evaluationContext.context.testVar).toBe(
        DEFAULT_FALLBACK_CHARACTER_NAME
      );
      expect(mockEntityManager.getComponentData).not.toHaveBeenCalled();
    });
  });

  describe('Core Functionality - Success Cases', () => {
    const baseParams = {
      entity_ref: 'actor',
      result_variable: 'testVar',
    };

    it('should retrieve and store component text when component exists', () => {
      const params = baseParams;
      const componentData = { text: 'Character Name' };
      mockEntityManager.getComponentData.mockReturnValue(componentData);

      handler.execute(params, executionContext);

      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        'actor-123',
        NAME_COMPONENT_ID
      );
      expect(executionContext.evaluationContext.context.testVar).toBe(
        'Character Name'
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "GET_NAME: Resolved name for 'actor-123' -> 'Character Name'."
      );
    });

    it('should trim whitespace from component text', () => {
      const params = baseParams;
      const componentData = { text: '  Trimmed Name  ' };
      mockEntityManager.getComponentData.mockReturnValue(componentData);

      handler.execute(params, executionContext);

      expect(executionContext.evaluationContext.context.testVar).toBe(
        'Trimmed Name'
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "GET_NAME: Resolved name for 'actor-123' -> 'Trimmed Name'."
      );
    });

    it('should trim whitespace from result_variable before storing', () => {
      const params = {
        entity_ref: 'actor',
        result_variable: '  testVar  ',
      };
      const componentData = { text: 'Test Name' };
      mockEntityManager.getComponentData.mockReturnValue(componentData);

      handler.execute(params, executionContext);

      expect(executionContext.evaluationContext.context).toHaveProperty(
        'testVar'
      );
      expect(executionContext.evaluationContext.context.testVar).toBe(
        'Test Name'
      );
      expect(executionContext.evaluationContext.context).not.toHaveProperty(
        '  testVar  '
      );
    });

    it('should use custom default_value when provided and component is missing', () => {
      const params = {
        entity_ref: 'actor',
        result_variable: 'testVar',
        default_value: 'Custom Default',
      };
      mockEntityManager.getComponentData.mockReturnValue(null);

      handler.execute(params, executionContext);

      expect(executionContext.evaluationContext.context.testVar).toBe(
        'Custom Default'
      );
    });

    it('should trim whitespace from custom default_value', () => {
      const params = {
        entity_ref: 'actor',
        result_variable: 'testVar',
        default_value: '  Custom Default  ',
      };
      mockEntityManager.getComponentData.mockReturnValue(null);

      handler.execute(params, executionContext);

      expect(executionContext.evaluationContext.context.testVar).toBe(
        'Custom Default'
      );
    });

    it('should use DEFAULT_FALLBACK_CHARACTER_NAME when no custom default provided and component missing', () => {
      const params = {
        entity_ref: 'actor',
        result_variable: 'testVar',
      };
      mockEntityManager.getComponentData.mockReturnValue(null);

      handler.execute(params, executionContext);

      expect(executionContext.evaluationContext.context.testVar).toBe(
        DEFAULT_FALLBACK_CHARACTER_NAME
      );
    });

    it('should use DEFAULT_FALLBACK_CHARACTER_NAME when custom default is empty/whitespace', () => {
      const params = {
        entity_ref: 'actor',
        result_variable: 'testVar',
        default_value: '   ',
      };
      mockEntityManager.getComponentData.mockReturnValue(null);

      handler.execute(params, executionContext);

      expect(executionContext.evaluationContext.context.testVar).toBe(
        DEFAULT_FALLBACK_CHARACTER_NAME
      );
    });
  });

  describe('Core Functionality - Fallback Cases', () => {
    const baseParams = {
      entity_ref: 'actor',
      result_variable: 'testVar',
    };

    it('should use fallback when component is null', () => {
      const params = baseParams;
      mockEntityManager.getComponentData.mockReturnValue(null);

      handler.execute(params, executionContext);

      expect(executionContext.evaluationContext.context.testVar).toBe(
        DEFAULT_FALLBACK_CHARACTER_NAME
      );
    });

    it('should use fallback when component is undefined', () => {
      const params = baseParams;
      mockEntityManager.getComponentData.mockReturnValue(undefined);

      handler.execute(params, executionContext);

      expect(executionContext.evaluationContext.context.testVar).toBe(
        DEFAULT_FALLBACK_CHARACTER_NAME
      );
    });

    it('should use fallback when component text is missing', () => {
      const params = baseParams;
      const componentData = { notText: 'wrong field' };
      mockEntityManager.getComponentData.mockReturnValue(componentData);

      handler.execute(params, executionContext);

      expect(executionContext.evaluationContext.context.testVar).toBe(
        DEFAULT_FALLBACK_CHARACTER_NAME
      );
    });

    it('should use fallback when component text is null', () => {
      const params = baseParams;
      const componentData = { text: null };
      mockEntityManager.getComponentData.mockReturnValue(componentData);

      handler.execute(params, executionContext);

      expect(executionContext.evaluationContext.context.testVar).toBe(
        DEFAULT_FALLBACK_CHARACTER_NAME
      );
    });

    it('should use fallback when component text is empty string', () => {
      const params = baseParams;
      const componentData = { text: '' };
      mockEntityManager.getComponentData.mockReturnValue(componentData);

      handler.execute(params, executionContext);

      expect(executionContext.evaluationContext.context.testVar).toBe(
        DEFAULT_FALLBACK_CHARACTER_NAME
      );
    });

    it('should use fallback when component text is whitespace only', () => {
      const params = baseParams;
      const componentData = { text: '   ' };
      mockEntityManager.getComponentData.mockReturnValue(componentData);

      handler.execute(params, executionContext);

      expect(executionContext.evaluationContext.context.testVar).toBe(
        DEFAULT_FALLBACK_CHARACTER_NAME
      );
    });

    it('should use fallback when component text is not a string', () => {
      const params = baseParams;
      const componentData = { text: 123 };
      mockEntityManager.getComponentData.mockReturnValue(componentData);

      handler.execute(params, executionContext);

      expect(executionContext.evaluationContext.context.testVar).toBe(
        DEFAULT_FALLBACK_CHARACTER_NAME
      );
    });
  });

  describe('Error Handling', () => {
    const baseParams = {
      entity_ref: 'actor',
      result_variable: 'testVar',
    };

    it('should handle error during getComponentData and use fallback', () => {
      const params = baseParams;
      const error = new Error('Database connection failed');
      mockEntityManager.getComponentData.mockImplementation(() => {
        throw error;
      });

      handler.execute(params, executionContext);

      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.objectContaining({
          message: `GET_NAME: Error retrieving '${NAME_COMPONENT_ID}' from 'actor-123'. Using fallback.`,
          details: expect.objectContaining({
            error: 'Database connection failed',
            stack: expect.any(String),
          }),
        })
      );
      expect(executionContext.evaluationContext.context.testVar).toBe(
        DEFAULT_FALLBACK_CHARACTER_NAME
      );
    });

    it('should handle error during getComponentData and use custom fallback', () => {
      const params = {
        ...baseParams,
        default_value: 'Custom Fallback',
      };
      const error = new Error('Network timeout');
      mockEntityManager.getComponentData.mockImplementation(() => {
        throw error;
      });

      handler.execute(params, executionContext);

      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.objectContaining({
          message: `GET_NAME: Error retrieving '${NAME_COMPONENT_ID}' from 'actor-123'. Using fallback.`,
          details: expect.objectContaining({
            error: 'Network timeout',
            stack: expect.any(String),
          }),
        })
      );
      expect(executionContext.evaluationContext.context.testVar).toBe(
        'Custom Fallback'
      );
    });

    it('should continue execution after error and still store fallback value', () => {
      const params = baseParams;
      mockEntityManager.getComponentData.mockImplementation(() => {
        throw new Error('Test error');
      });

      handler.execute(params, executionContext);

      // Should dispatch error but still complete execution
      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalled();
      expect(executionContext.evaluationContext.context.testVar).toBe(
        DEFAULT_FALLBACK_CHARACTER_NAME
      );
      // Should not throw or crash
    });
  });

  describe('Edge Cases', () => {
    it('should handle entity_ref as empty object', () => {
      const params = {
        entity_ref: {},
        result_variable: 'testVar',
      };

      handler.execute(params, executionContext);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Could not resolve entity from entity_ref'),
        expect.objectContaining({
          entity_ref: {},
        })
      );
      expect(executionContext.evaluationContext.context.testVar).toBe(
        DEFAULT_FALLBACK_CHARACTER_NAME
      );
    });

    it('should handle complex entity_ref object without entityId', () => {
      const params = {
        entity_ref: { someOtherField: 'value' },
        result_variable: 'testVar',
      };

      handler.execute(params, executionContext);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Could not resolve entity from entity_ref'),
        expect.objectContaining({
          entity_ref: { someOtherField: 'value' },
        })
      );
      expect(executionContext.evaluationContext.context.testVar).toBe(
        DEFAULT_FALLBACK_CHARACTER_NAME
      );
    });

    it('should overwrite existing context variable', () => {
      executionContext.evaluationContext.context.testVar = 'old value';
      const params = {
        entity_ref: 'actor',
        result_variable: 'testVar',
      };
      const componentData = { text: 'New Name' };
      mockEntityManager.getComponentData.mockReturnValue(componentData);

      handler.execute(params, executionContext);

      expect(executionContext.evaluationContext.context.testVar).toBe(
        'New Name'
      );
    });

    it('should handle zero-length component text after trimming', () => {
      const params = {
        entity_ref: 'actor',
        result_variable: 'testVar',
      };
      const componentData = { text: '\t\n\r ' }; // Only whitespace characters
      mockEntityManager.getComponentData.mockReturnValue(componentData);

      handler.execute(params, executionContext);

      expect(executionContext.evaluationContext.context.testVar).toBe(
        DEFAULT_FALLBACK_CHARACTER_NAME
      );
    });
  });
});
