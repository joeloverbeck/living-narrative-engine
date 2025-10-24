import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import FormattingErrorHandler from '../../../../../../../src/actions/pipeline/stages/actionFormatting/legacy/FormattingErrorHandler.js';

// Factory function following project patterns
const createHandler = (overrides = {}) => {
  const mockLogger = {
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };

  const mockCreateError = jest.fn(
    (payload, action, actorId, trace, resolvedTargetId, originalTargetId) => ({
      payload,
      actionId: action.id,
      actorId,
      resolvedTargetId,
      originalTargetId,
    })
  );

  const dependencies = {
    logger: mockLogger,
    createErrorFn: mockCreateError,
  };

  const finalDeps = { ...dependencies, ...overrides };

  const handler = new FormattingErrorHandler(
    finalDeps.logger,
    finalDeps.createErrorFn
  );

  return {
    handler,
    mockLogger: finalDeps.logger,
    mockCreateError: finalDeps.createErrorFn,
  };
};

describe('FormattingErrorHandler', () => {
  let mockLogger;
  let mockCreateError;
  let handler;

  beforeEach(() => {
    const testBed = createHandler();
    handler = testBed.handler;
    mockLogger = testBed.mockLogger;
    mockCreateError = testBed.mockCreateError;
  });

  describe('handleFormattingError', () => {
    it('should log warning and create error object', () => {
      const error = new Error('Format failed');
      const actionDef = { id: 'test_action', name: 'Test Action' };
      const actorId = 'actor1';
      const targetContext = { entityId: 'target1' };
      const trace = { captureActionData: jest.fn() };

      const result = handler.handleFormattingError({
        error,
        actionDef,
        actorId,
        targetContext,
        trace,
      });

      expect(mockLogger.warn).toHaveBeenCalledWith(
        "Failed to format command for action 'test_action' with target 'target1'",
        expect.objectContaining({ error, actionDef, targetContext })
      );

      expect(mockCreateError).toHaveBeenCalledWith(
        error,
        actionDef,
        actorId,
        trace,
        'target1',
        'target1'
      );

      expect(result).toEqual({
        payload: error,
        actionId: 'test_action',
        actorId: 'actor1',
        resolvedTargetId: 'target1',
        originalTargetId: 'target1',
      });
    });

    it('should resolve target ID from error object', () => {
      const error = { target: { entityId: 'error_target' }, message: 'Failed' };
      const actionDef = { id: 'test_action' };
      const actorId = 'actor1';

      handler.handleFormattingError({
        error,
        actionDef,
        actorId,
        targetContext: null,
        trace: null,
      });

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('error_target'),
        expect.anything()
      );
    });

    it('should use "unknown" when target ID cannot be resolved', () => {
      const error = new Error('Failed');
      const actionDef = { id: 'test_action' };
      const actorId = 'actor1';

      handler.handleFormattingError({
        error,
        actionDef,
        actorId,
        targetContext: null,
        trace: null,
      });

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('unknown'),
        expect.anything()
      );
    });

    it('should include additional context in logging', () => {
      const error = new Error('Failed');
      const actionDef = { id: 'test_action' };
      const actorId = 'actor1';
      const context = { attemptNumber: 2, reason: 'timeout' };

      handler.handleFormattingError({
        error,
        actionDef,
        actorId,
        targetContext: null,
        trace: null,
        context,
      });

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining(context)
      );
    });
  });

  describe('handleNormalizationError', () => {
    it('should log warning and create error object', () => {
      const error = { message: 'Normalization failed' };
      const actionDef = { id: 'test_action' };
      const actorId = 'actor1';
      const trace = { captureActionData: jest.fn() };

      handler.handleNormalizationError({
        error,
        actionDef,
        actorId,
        trace,
      });

      expect(mockLogger.warn).toHaveBeenCalledWith(
        "Normalization failed for action 'test_action'",
        expect.objectContaining({ error, actionDef })
      );

      expect(mockCreateError).toHaveBeenCalledWith(
        error,
        actionDef,
        actorId,
        trace,
        undefined,
        undefined
      );
    });
  });

  describe('handleValidationError', () => {
    it('should log warning without creating error object', () => {
      const message = 'Missing required targets';
      const actionDef = { id: 'test_action' };
      const context = { targetCount: 0 };

      handler.handleValidationError({ message, actionDef, context });

      expect(mockLogger.warn).toHaveBeenCalledWith(
        "Validation failed for action 'test_action': Missing required targets",
        expect.objectContaining({ actionDef, targetCount: 0 })
      );

      expect(mockCreateError).not.toHaveBeenCalled();
    });

    it('should work without additional context', () => {
      const message = 'Invalid action';
      const actionDef = { id: 'test_action' };

      handler.handleValidationError({ message, actionDef });

      expect(mockLogger.warn).toHaveBeenCalled();
    });
  });

  describe('handleException', () => {
    it('should log error and create error object', () => {
      const exception = new Error('Unexpected error');
      const actionDef = { id: 'test_action' };
      const actorId = 'actor1';
      const targetContext = { entityId: 'target1' };
      const trace = { captureActionData: jest.fn() };

      handler.handleException({
        exception,
        actionDef,
        actorId,
        targetContext,
        trace,
        operation: 'multi-target formatting',
      });

      expect(mockLogger.error).toHaveBeenCalledWith(
        "Unexpected exception during multi-target formatting for action 'test_action' with target 'target1'",
        expect.objectContaining({ exception, actionDef, targetContext })
      );

      expect(mockCreateError).toHaveBeenCalledWith(
        exception,
        actionDef,
        actorId,
        trace,
        'target1',
        'target1'
      );
    });

    it('should use default operation name', () => {
      const exception = new Error('Error');
      const actionDef = { id: 'test_action' };
      const actorId = 'actor1';

      handler.handleException({
        exception,
        actionDef,
        actorId,
        targetContext: null,
        trace: null,
      });

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('formatting'),
        expect.anything()
      );
    });
  });

  describe('target ID resolution', () => {
    it('should prioritize error.target.entityId', () => {
      const error = {
        target: { entityId: 'priority1' },
        entityId: 'priority2',
      };
      const targetContext = { entityId: 'priority3' };

      handler.handleFormattingError({
        error,
        actionDef: { id: 'test' },
        actorId: 'actor1',
        targetContext,
        trace: null,
      });

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('priority1'),
        expect.anything()
      );
    });

    it('should fallback to error.entityId', () => {
      const error = { entityId: 'priority2' };
      const targetContext = { entityId: 'priority3' };

      handler.handleFormattingError({
        error,
        actionDef: { id: 'test' },
        actorId: 'actor1',
        targetContext,
        trace: null,
      });

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('priority2'),
        expect.anything()
      );
    });

    it('should fallback to targetContext.entityId', () => {
      const error = new Error('No entity ID');
      const targetContext = { entityId: 'priority3' };

      handler.handleFormattingError({
        error,
        actionDef: { id: 'test' },
        actorId: 'actor1',
        targetContext,
        trace: null,
      });

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('priority3'),
        expect.anything()
      );
    });
  });
});
