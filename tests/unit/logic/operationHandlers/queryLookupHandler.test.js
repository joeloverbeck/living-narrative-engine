/**
 * @file Unit tests for QueryLookupHandler operation handler.
 * @jest-environment node
 */

import {
  describe,
  expect,
  test,
  jest,
  beforeEach,
  afterEach,
} from '@jest/globals';
import QueryLookupHandler from '../../../../src/logic/operationHandlers/queryLookupHandler.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../../src/constants/systemEventIds.js';

const createMockLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
});

const createMockDispatcher = () => ({
  dispatch: jest.fn(),
});

const createMockDataRegistry = (lookups = {}) => ({
  get: jest.fn((type, id) => {
    if (type === 'lookups') {
      return lookups[id];
    }
    return undefined;
  }),
});

/**
 * Builds a mock execution context with evaluation context.
 * Note: Does not set a logger property so that the handler uses
 * the logger passed to its constructor.
 *
 * @param {object} [contextData] - Initial context variables
 * @returns {object} Mock execution context
 */
function buildExecutionContext(contextData = {}) {
  return {
    evaluationContext: {
      context: contextData,
      event: { type: 'test_event' },
      actor: { id: 'actor1' },
      target: { id: 'target1' },
    },
    // No logger property - handler will use constructor's logger
  };
}

describe('QueryLookupHandler', () => {
  let handler;
  let mockLogger;
  let mockDispatcher;
  let mockDataRegistry;

  beforeEach(() => {
    jest.clearAllMocks();
    mockLogger = createMockLogger();
    mockDispatcher = createMockDispatcher();
    mockDataRegistry = createMockDataRegistry({
      'test:sample_lookup': {
        id: 'test:sample_lookup',
        entries: {
          key1: { value: 'data1', nested: { prop: 'nested1' } },
          key2: { value: 'data2' },
          key3: null,
          key4: 'primitive_string_entry',
          key5: 12345,
        },
      },
    });

    handler = new QueryLookupHandler({
      dataRegistry: mockDataRegistry,
      logger: mockLogger,
      safeEventDispatcher: mockDispatcher,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Constructor', () => {
    test('throws if dataRegistry dependency is missing or invalid', () => {
      expect(
        () =>
          new QueryLookupHandler({
            logger: mockLogger,
            safeEventDispatcher: mockDispatcher,
          })
      ).toThrow();
    });

    test('throws if logger dependency is missing or invalid', () => {
      expect(
        () =>
          new QueryLookupHandler({
            dataRegistry: mockDataRegistry,
            safeEventDispatcher: mockDispatcher,
          })
      ).toThrow();
    });

    test('throws if safeEventDispatcher dependency is missing or invalid', () => {
      expect(
        () =>
          new QueryLookupHandler({
            dataRegistry: mockDataRegistry,
            logger: mockLogger,
          })
      ).toThrow();
    });

    test('constructs successfully with all required dependencies', () => {
      expect(
        () =>
          new QueryLookupHandler({
            dataRegistry: mockDataRegistry,
            logger: mockLogger,
            safeEventDispatcher: mockDispatcher,
          })
      ).not.toThrow();
    });
  });

  describe('Parameter validation', () => {
    test('dispatches error when params is null', () => {
      const executionContext = buildExecutionContext();
      handler.execute(null, executionContext);

      expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.objectContaining({
          message: expect.any(String),
        })
      );
    });

    test('dispatches error when params is not an object', () => {
      const executionContext = buildExecutionContext();
      handler.execute('invalid', executionContext);

      expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.objectContaining({
          message: expect.any(String),
        })
      );
    });

    test('dispatches error when lookup_id is missing', () => {
      const executionContext = buildExecutionContext();
      handler.execute(
        {
          entry_key: 'key1',
          result_variable: 'myResult',
        },
        executionContext
      );

      expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.objectContaining({
          message: expect.stringContaining('lookup_id'),
        })
      );
    });

    test('dispatches error when entry_key is missing', () => {
      const executionContext = buildExecutionContext();
      handler.execute(
        {
          lookup_id: 'test:sample_lookup',
          result_variable: 'myResult',
        },
        executionContext
      );

      expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.objectContaining({
          message: expect.stringContaining('entry_key'),
        })
      );
    });

    test('dispatches error when result_variable is missing', () => {
      const executionContext = buildExecutionContext();
      handler.execute(
        {
          lookup_id: 'test:sample_lookup',
          entry_key: 'key1',
        },
        executionContext
      );

      expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.objectContaining({
          message: expect.stringContaining('result_variable'),
        })
      );
    });

    test('dispatches error when evaluationContext is missing', () => {
      const executionContext = {};
      handler.execute(
        {
          lookup_id: 'test:sample_lookup',
          entry_key: 'key1',
          result_variable: 'myResult',
        },
        executionContext
      );

      expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.objectContaining({
          message: expect.any(String),
        })
      );
    });
  });

  describe('Lookup retrieval', () => {
    test('retrieves lookup entry and stores in context', () => {
      const executionContext = buildExecutionContext();
      const params = {
        lookup_id: 'test:sample_lookup',
        entry_key: 'key1',
        result_variable: 'myResult',
      };

      handler.execute(params, executionContext);

      expect(executionContext.evaluationContext.context.myResult).toEqual({
        value: 'data1',
        nested: { prop: 'nested1' },
      });
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Successfully queried')
      );
    });

    test('handles null entry value correctly', () => {
      const executionContext = buildExecutionContext();
      const params = {
        lookup_id: 'test:sample_lookup',
        entry_key: 'key3',
        result_variable: 'myResult',
      };

      handler.execute(params, executionContext);

      expect(executionContext.evaluationContext.context.myResult).toBeNull();
    });

    test('handles primitive string entry value correctly', () => {
      const executionContext = buildExecutionContext();
      const params = {
        lookup_id: 'test:sample_lookup',
        entry_key: 'key4',
        result_variable: 'myResult',
      };

      handler.execute(params, executionContext);

      expect(executionContext.evaluationContext.context.myResult).toBe(
        'primitive_string_entry'
      );
      // Verify the primitive is logged directly (not JSON.stringify'd)
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('primitive_string_entry')
      );
    });

    test('handles primitive number entry value correctly', () => {
      const executionContext = buildExecutionContext();
      const params = {
        lookup_id: 'test:sample_lookup',
        entry_key: 'key5',
        result_variable: 'myResult',
      };

      handler.execute(params, executionContext);

      expect(executionContext.evaluationContext.context.myResult).toBe(12345);
      // Verify the primitive is logged directly (not JSON.stringify'd)
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('12345')
      );
    });

    test('uses missing_value when lookup not found', () => {
      const executionContext = buildExecutionContext();
      const params = {
        lookup_id: 'test:nonexistent',
        entry_key: 'key1',
        result_variable: 'myResult',
        missing_value: { default: true },
      };

      handler.execute(params, executionContext);

      expect(executionContext.evaluationContext.context.myResult).toEqual({
        default: true,
      });
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('not found in data registry')
      );
    });

    test('uses missing_value when entry key not found', () => {
      const executionContext = buildExecutionContext();
      const params = {
        lookup_id: 'test:sample_lookup',
        entry_key: 'nonexistent_key',
        result_variable: 'myResult',
        missing_value: { fallback: 'value' },
      };

      handler.execute(params, executionContext);

      expect(executionContext.evaluationContext.context.myResult).toEqual({
        fallback: 'value',
      });
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Entry "nonexistent_key" not found')
      );
    });

    test('stores undefined when missing_value not provided and entry not found', () => {
      const executionContext = buildExecutionContext();
      const params = {
        lookup_id: 'test:sample_lookup',
        entry_key: 'nonexistent_key',
        result_variable: 'myResult',
      };

      handler.execute(params, executionContext);

      expect(
        executionContext.evaluationContext.context.myResult
      ).toBeUndefined();
    });

    test('stores undefined when missing_value not provided and lookup not found', () => {
      const executionContext = buildExecutionContext();
      const params = {
        lookup_id: 'test:nonexistent',
        entry_key: 'key1',
        result_variable: 'myResult',
      };

      handler.execute(params, executionContext);

      expect(
        executionContext.evaluationContext.context.myResult
      ).toBeUndefined();
    });
  });

  describe('Edge cases', () => {
    test('handles lookup without entries object', () => {
      mockDataRegistry = createMockDataRegistry({
        'test:broken_lookup': {
          id: 'test:broken_lookup',
        },
      });

      handler = new QueryLookupHandler({
        dataRegistry: mockDataRegistry,
        logger: mockLogger,
        safeEventDispatcher: mockDispatcher,
      });

      const executionContext = buildExecutionContext();
      const params = {
        lookup_id: 'test:broken_lookup',
        entry_key: 'key1',
        result_variable: 'myResult',
        missing_value: 'fallback',
      };

      handler.execute(params, executionContext);

      expect(executionContext.evaluationContext.context.myResult).toBe(
        'fallback'
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('has no entries object')
      );
    });

    test('handles data registry throwing error', () => {
      mockDataRegistry.get = jest.fn(() => {
        throw new Error('Registry error');
      });

      handler = new QueryLookupHandler({
        dataRegistry: mockDataRegistry,
        logger: mockLogger,
        safeEventDispatcher: mockDispatcher,
      });

      const executionContext = buildExecutionContext();
      const params = {
        lookup_id: 'test:sample_lookup',
        entry_key: 'key1',
        result_variable: 'myResult',
        missing_value: 'error_fallback',
      };

      handler.execute(params, executionContext);

      expect(executionContext.evaluationContext.context.myResult).toBe(
        'error_fallback'
      );
      expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.objectContaining({
          message: expect.any(String),
        })
      );
    });

    test('trims whitespace from parameters', () => {
      const executionContext = buildExecutionContext();
      const params = {
        lookup_id: '  test:sample_lookup  ',
        entry_key: '  key1  ',
        result_variable: '  myResult  ',
      };

      handler.execute(params, executionContext);

      expect(executionContext.evaluationContext.context.myResult).toEqual({
        value: 'data1',
        nested: { prop: 'nested1' },
      });
    });

    test('can overwrite existing context variables', () => {
      const executionContext = buildExecutionContext({ myResult: 'old_value' });
      const params = {
        lookup_id: 'test:sample_lookup',
        entry_key: 'key2',
        result_variable: 'myResult',
      };

      handler.execute(params, executionContext);

      expect(executionContext.evaluationContext.context.myResult).toEqual({
        value: 'data2',
      });
    });
  });

  describe('Integration with context variable utilities', () => {
    test('stores complex nested objects correctly', () => {
      const executionContext = buildExecutionContext();
      const params = {
        lookup_id: 'test:sample_lookup',
        entry_key: 'key1',
        result_variable: 'complexResult',
      };

      handler.execute(params, executionContext);

      const storedValue =
        executionContext.evaluationContext.context.complexResult;
      expect(storedValue).toHaveProperty('nested.prop', 'nested1');
      expect(storedValue).toHaveProperty('value', 'data1');
    });

    test('handles multiple sequential queries', () => {
      const executionContext = buildExecutionContext();

      handler.execute(
        {
          lookup_id: 'test:sample_lookup',
          entry_key: 'key1',
          result_variable: 'result1',
        },
        executionContext
      );

      handler.execute(
        {
          lookup_id: 'test:sample_lookup',
          entry_key: 'key2',
          result_variable: 'result2',
        },
        executionContext
      );

      expect(executionContext.evaluationContext.context.result1).toEqual({
        value: 'data1',
        nested: { prop: 'nested1' },
      });
      expect(executionContext.evaluationContext.context.result2).toEqual({
        value: 'data2',
      });
    });
  });

  describe('Logging behavior', () => {
    test('logs debug messages during successful query', () => {
      const executionContext = buildExecutionContext();
      const params = {
        lookup_id: 'test:sample_lookup',
        entry_key: 'key1',
        result_variable: 'myResult',
      };

      handler.execute(params, executionContext);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Attempting to query entry')
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Successfully queried')
      );
    });

    test('logs debug message when using missing_value', () => {
      const executionContext = buildExecutionContext();
      const params = {
        lookup_id: 'test:nonexistent',
        entry_key: 'key1',
        result_variable: 'myResult',
        missing_value: 'fallback',
      };

      handler.execute(params, executionContext);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('not found in data registry')
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Stored')
      );
    });
  });

  describe('missingValue formatting in logs', () => {
    describe('when lookup not found', () => {
      test('logs "null" when missing_value is null', () => {
        const executionContext = buildExecutionContext();
        const params = {
          lookup_id: 'test:nonexistent',
          entry_key: 'key1',
          result_variable: 'myResult',
          missing_value: null,
        };

        handler.execute(params, executionContext);

        expect(executionContext.evaluationContext.context.myResult).toBeNull();
        expect(mockLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining("Stored 'null'")
        );
      });

      test('logs "undefined" when missing_value is undefined', () => {
        const executionContext = buildExecutionContext();
        const params = {
          lookup_id: 'test:nonexistent',
          entry_key: 'key1',
          result_variable: 'myResult',
          // missing_value omitted - defaults to undefined
        };

        handler.execute(params, executionContext);

        expect(
          executionContext.evaluationContext.context.myResult
        ).toBeUndefined();
        expect(mockLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining("Stored 'undefined'")
        );
      });

      test('logs string directly when missing_value is a string', () => {
        const executionContext = buildExecutionContext();
        const params = {
          lookup_id: 'test:nonexistent',
          entry_key: 'key1',
          result_variable: 'myResult',
          missing_value: 'fallback_string',
        };

        handler.execute(params, executionContext);

        expect(executionContext.evaluationContext.context.myResult).toBe(
          'fallback_string'
        );
        expect(mockLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining("Stored 'fallback_string'")
        );
      });

      test('logs JSON.stringify result when missing_value is an object', () => {
        const executionContext = buildExecutionContext();
        const params = {
          lookup_id: 'test:nonexistent',
          entry_key: 'key1',
          result_variable: 'myResult',
          missing_value: { key: 'val' },
        };

        handler.execute(params, executionContext);

        expect(executionContext.evaluationContext.context.myResult).toEqual({
          key: 'val',
        });
        expect(mockLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining('{"key":"val"}')
        );
      });
    });

    describe('when entry key not found', () => {
      test('logs "null" when missing_value is null', () => {
        const executionContext = buildExecutionContext();
        const params = {
          lookup_id: 'test:sample_lookup',
          entry_key: 'nonexistent_key',
          result_variable: 'myResult',
          missing_value: null,
        };

        handler.execute(params, executionContext);

        expect(executionContext.evaluationContext.context.myResult).toBeNull();
        expect(mockLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining("Stored 'null'")
        );
        expect(mockLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining('(entry not found)')
        );
      });

      test('logs "undefined" when missing_value is undefined', () => {
        const executionContext = buildExecutionContext();
        const params = {
          lookup_id: 'test:sample_lookup',
          entry_key: 'nonexistent_key',
          result_variable: 'myResult',
          // missing_value omitted - defaults to undefined
        };

        handler.execute(params, executionContext);

        expect(
          executionContext.evaluationContext.context.myResult
        ).toBeUndefined();
        expect(mockLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining("Stored 'undefined'")
        );
        expect(mockLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining('(entry not found)')
        );
      });

      test('logs string when missing_value is a string', () => {
        const executionContext = buildExecutionContext();
        const params = {
          lookup_id: 'test:sample_lookup',
          entry_key: 'nonexistent_key',
          result_variable: 'myResult',
          missing_value: 'entry_fallback',
        };

        handler.execute(params, executionContext);

        expect(executionContext.evaluationContext.context.myResult).toBe(
          'entry_fallback'
        );
        expect(mockLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining("Stored 'entry_fallback'")
        );
      });

      test('logs number when missing_value is a number', () => {
        const executionContext = buildExecutionContext();
        const params = {
          lookup_id: 'test:sample_lookup',
          entry_key: 'nonexistent_key',
          result_variable: 'myResult',
          missing_value: 42,
        };

        handler.execute(params, executionContext);

        expect(executionContext.evaluationContext.context.myResult).toBe(42);
        expect(mockLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining("Stored '42'")
        );
      });
    });
  });

  describe('Error handling and recovery logging', () => {
    test('logs warning with "null" on recovery with null missing_value', () => {
      mockDataRegistry.get = jest.fn(() => {
        throw new Error('Registry error');
      });

      handler = new QueryLookupHandler({
        dataRegistry: mockDataRegistry,
        logger: mockLogger,
        safeEventDispatcher: mockDispatcher,
      });

      const executionContext = buildExecutionContext();
      const params = {
        lookup_id: 'test:sample_lookup',
        entry_key: 'key1',
        result_variable: 'myResult',
        missing_value: null,
      };

      handler.execute(params, executionContext);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining("Stored 'null'")
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('due to error')
      );
    });

    test('logs warning with "undefined" on recovery with undefined missing_value', () => {
      mockDataRegistry.get = jest.fn(() => {
        throw new Error('Registry error');
      });

      handler = new QueryLookupHandler({
        dataRegistry: mockDataRegistry,
        logger: mockLogger,
        safeEventDispatcher: mockDispatcher,
      });

      const executionContext = buildExecutionContext();
      const params = {
        lookup_id: 'test:sample_lookup',
        entry_key: 'key1',
        result_variable: 'myResult',
        // missing_value omitted - defaults to undefined
      };

      handler.execute(params, executionContext);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining("Stored 'undefined'")
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('due to error')
      );
    });

    test('logs warning with JSON string on recovery with object missing_value', () => {
      mockDataRegistry.get = jest.fn(() => {
        throw new Error('Registry error');
      });

      handler = new QueryLookupHandler({
        dataRegistry: mockDataRegistry,
        logger: mockLogger,
        safeEventDispatcher: mockDispatcher,
      });

      const executionContext = buildExecutionContext();
      const params = {
        lookup_id: 'test:sample_lookup',
        entry_key: 'key1',
        result_variable: 'myResult',
        missing_value: { error: 'fallback' },
      };

      handler.execute(params, executionContext);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('{"error":"fallback"}')
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('due to error')
      );
    });

    test('logs warning with primitive value on recovery with string missing_value', () => {
      mockDataRegistry.get = jest.fn(() => {
        throw new Error('Registry error');
      });

      handler = new QueryLookupHandler({
        dataRegistry: mockDataRegistry,
        logger: mockLogger,
        safeEventDispatcher: mockDispatcher,
      });

      const executionContext = buildExecutionContext();
      const params = {
        lookup_id: 'test:sample_lookup',
        entry_key: 'key1',
        result_variable: 'myResult',
        missing_value: 'error_recovery_value',
      };

      handler.execute(params, executionContext);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining("Stored 'error_recovery_value'")
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('due to error')
      );
    });

    test('does not log warning when writeContextVariable fails during error recovery', () => {
      mockDataRegistry.get = jest.fn(() => {
        throw new Error('Registry error');
      });

      handler = new QueryLookupHandler({
        dataRegistry: mockDataRegistry,
        logger: mockLogger,
        safeEventDispatcher: mockDispatcher,
      });

      // Create execution context with frozen context object
      const frozenContext = Object.freeze({});
      const executionContext = {
        evaluationContext: {
          context: frozenContext,
          event: { type: 'test_event' },
          actor: { id: 'actor1' },
          target: { id: 'target1' },
        },
      };

      const params = {
        lookup_id: 'test:sample_lookup',
        entry_key: 'key1',
        result_variable: 'myResult',
        missing_value: 'should_not_log',
      };

      handler.execute(params, executionContext);

      // Assert mockLogger.warn was NOT called (line 286 branch = false)
      expect(mockLogger.warn).not.toHaveBeenCalled();

      // Assert error was still dispatched
      expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.any(Object)
      );
    });
  });
});
