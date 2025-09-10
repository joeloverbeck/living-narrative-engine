/**
 * @file Unit tests for DispatchThoughtHandler
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import DispatchThoughtHandler from '../../../../src/logic/operationHandlers/dispatchThoughtHandler.js';
import { DISPLAY_THOUGHT_ID } from '../../../../src/constants/eventIds.js';

describe('DispatchThoughtHandler', () => {
  let handler;
  let mockDispatcher;
  let mockLogger;

  beforeEach(() => {
    mockDispatcher = {
      dispatch: jest.fn(),
    };

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    handler = new DispatchThoughtHandler({
      dispatcher: mockDispatcher,
      logger: mockLogger,
    });
  });

  describe('constructor', () => {
    it('should create handler with required dependencies', () => {
      expect(handler).toBeInstanceOf(DispatchThoughtHandler);
    });

    it('should validate dispatcher has required methods', () => {
      expect(() => {
        new DispatchThoughtHandler({
          dispatcher: {},
          logger: mockLogger,
        });
      }).toThrow();
    });
  });

  describe('execute', () => {
    const executionContext = {
      event: { payload: { entityId: 'test-entity' } },
      context: {},
      ruleId: 'test-rule',
      logger: null, // Will use handler's logger
    };

    it('should dispatch thought event with valid parameters', () => {
      const params = {
        entity_id: 'test-entity',
        thoughts: 'I am thinking about testing',
      };

      handler.execute(params, executionContext);

      expect(mockDispatcher.dispatch).toHaveBeenCalledWith(DISPLAY_THOUGHT_ID, {
        entityId: 'test-entity',
        thoughts: 'I am thinking about testing',
      });
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'DispatchThoughtHandler: DISPATCH_THOUGHT: dispatching display_thought',
        expect.any(Object)
      );
    });

    it('should include optional notes in payload when provided as array', () => {
      const params = {
        entity_id: 'test-entity',
        thoughts: 'I am thinking about testing',
        notes: [
          {
            text: 'Optional test note',
            subject: 'testing',
            subjectType: 'concept',
          },
        ],
      };

      handler.execute(params, executionContext);

      expect(mockDispatcher.dispatch).toHaveBeenCalledWith(DISPLAY_THOUGHT_ID, {
        entityId: 'test-entity',
        thoughts: 'I am thinking about testing',
        notes: [
          {
            text: 'Optional test note',
            subject: 'testing',
            subjectType: 'concept',
          },
        ],
      });
    });

    it('should not include notes when undefined', () => {
      const params = {
        entity_id: 'test-entity',
        thoughts: 'I am thinking about testing',
      };

      handler.execute(params, executionContext);

      const callArgs = mockDispatcher.dispatch.mock.calls[0][1];
      expect(callArgs).not.toHaveProperty('notes');
    });

    it('should not include notes when empty array', () => {
      const params = {
        entity_id: 'test-entity',
        thoughts: 'I am thinking about testing',
        notes: [],
      };

      handler.execute(params, executionContext);

      const callArgs = mockDispatcher.dispatch.mock.calls[0][1];
      expect(callArgs).not.toHaveProperty('notes');
    });

    it('should return early if params is null', () => {
      handler.execute(null, executionContext);

      expect(mockDispatcher.dispatch).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('should return early if entity_id is missing', () => {
      const params = {
        thoughts: 'I am thinking',
      };

      handler.execute(params, executionContext);

      // Handler dispatches an error event when validation fails
      expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
        'core:system_error_occurred',
        expect.objectContaining({
          message: expect.stringContaining('entity_id'),
        })
      );
    });

    it('should return early if thoughts is missing', () => {
      const params = {
        entity_id: 'test-entity',
      };

      handler.execute(params, executionContext);

      // Handler dispatches an error event when validation fails
      expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
        'core:system_error_occurred',
        expect.objectContaining({
          message: expect.stringContaining('thoughts'),
        })
      );
    });

    it('should handle dispatch errors gracefully', () => {
      const params = {
        entity_id: 'test-entity',
        thoughts: 'I am thinking',
      };

      const error = new Error('Dispatch failed');
      let callCount = 0;
      mockDispatcher.dispatch.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          throw error;
        }
      });

      // Should not throw
      expect(() => {
        handler.execute(params, executionContext);
      }).not.toThrow();

      // Should dispatch error event
      expect(mockDispatcher.dispatch).toHaveBeenCalledTimes(2);
      expect(mockDispatcher.dispatch).toHaveBeenLastCalledWith(
        'core:system_error_occurred',
        expect.objectContaining({
          details: expect.objectContaining({
            errorMessage: 'Dispatch failed',
          }),
        })
      );
    });

    it('should use execution context logger when available', () => {
      const contextLogger = {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      };

      const contextWithLogger = {
        ...executionContext,
        logger: contextLogger,
      };

      const params = {
        entity_id: 'test-entity',
        thoughts: 'I am thinking',
      };

      handler.execute(params, contextWithLogger);

      expect(contextLogger.debug).toHaveBeenCalled();
      expect(mockLogger.debug).not.toHaveBeenCalled();
    });
  });
});
