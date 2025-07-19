/**
 * @file Unit tests for UnifiedErrorHandler
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { UnifiedErrorHandler } from '../../../../src/actions/errors/unifiedErrorHandler.js';
import { ERROR_PHASES } from '../../../../src/actions/errors/actionErrorTypes.js';
import { TraceContext } from '../../../../src/actions/tracing/traceContext.js';

describe('UnifiedErrorHandler', () => {
  let handler;
  let mockActionErrorContextBuilder;
  let mockLogger;
  let mockError;
  let mockActionDef;
  let mockTraceContext;

  beforeEach(() => {
    // Setup mocks
    mockLogger = {
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      info: jest.fn(),
    };

    mockActionErrorContextBuilder = {
      buildErrorContext: jest.fn().mockReturnValue({
        error: 'mock error',
        phase: 'mock phase',
        actorId: 'mock-actor',
        actionDef: { id: 'mock:action', name: 'Mock Action' },
        trace: null,
        targetId: null,
        additionalContext: {},
        timestamp: new Date().toISOString(),
      }),
    };

    mockError = new Error('Test error');
    mockError.stack = 'Test stack trace';

    mockActionDef = {
      id: 'test:action',
      name: 'Test Action',
      type: 'movement',
    };

    mockTraceContext = new TraceContext();

    handler = new UnifiedErrorHandler({
      actionErrorContextBuilder: mockActionErrorContextBuilder,
      logger: mockLogger,
    });
  });

  describe('constructor', () => {
    it('should create instance with valid dependencies', () => {
      expect(handler).toBeDefined();
      expect(handler).toBeInstanceOf(UnifiedErrorHandler);
    });

    it('should throw error when actionErrorContextBuilder is missing', () => {
      expect(() => {
        new UnifiedErrorHandler({
          actionErrorContextBuilder: null,
          logger: mockLogger,
        });
      }).toThrow('UnifiedErrorHandler requires actionErrorContextBuilder');
    });

    it('should throw error when logger is missing', () => {
      expect(() => {
        new UnifiedErrorHandler({
          actionErrorContextBuilder: mockActionErrorContextBuilder,
          logger: null,
        });
      }).toThrow('UnifiedErrorHandler requires logger');
    });
  });

  describe('createContext', () => {
    it('should create error context with all required fields', () => {
      const result = handler.createContext({
        error: mockError,
        phase: ERROR_PHASES.DISCOVERY,
        actionDef: mockActionDef,
        actorId: 'actor-123',
      });

      expect(mockLogger.error).toHaveBeenCalledWith('Error in discovery phase', {
        error: 'Test error',
        stack: 'Test stack trace',
        actionId: 'test:action',
        actorId: 'actor-123',
        targetId: null,
        phase: ERROR_PHASES.DISCOVERY,
      });

      expect(mockActionErrorContextBuilder.buildErrorContext).toHaveBeenCalledWith({
        error: mockError,
        actionDef: mockActionDef,
        actorId: 'actor-123',
        phase: ERROR_PHASES.DISCOVERY,
        trace: null,
        targetId: null,
        additionalContext: {},
      });

      expect(result).toBeDefined();
    });

    it('should create error context with optional targetId', () => {
      handler.createContext({
        error: mockError,
        phase: ERROR_PHASES.EXECUTION,
        actionDef: mockActionDef,
        actorId: 'actor-123',
        targetId: 'target-456',
      });

      expect(mockLogger.error).toHaveBeenCalledWith('Error in execution phase', {
        error: 'Test error',
        stack: 'Test stack trace',
        actionId: 'test:action',
        actorId: 'actor-123',
        targetId: 'target-456',
        phase: ERROR_PHASES.EXECUTION,
      });

      expect(mockActionErrorContextBuilder.buildErrorContext).toHaveBeenCalledWith({
        error: mockError,
        actionDef: mockActionDef,
        actorId: 'actor-123',
        phase: ERROR_PHASES.EXECUTION,
        trace: null,
        targetId: 'target-456',
        additionalContext: {},
      });
    });

    it('should create error context with trace context', () => {
      handler.createContext({
        error: mockError,
        phase: ERROR_PHASES.VALIDATION,
        actionDef: mockActionDef,
        actorId: 'actor-123',
        trace: mockTraceContext,
      });

      expect(mockActionErrorContextBuilder.buildErrorContext).toHaveBeenCalledWith({
        error: mockError,
        actionDef: mockActionDef,
        actorId: 'actor-123',
        phase: ERROR_PHASES.VALIDATION,
        trace: mockTraceContext,
        targetId: null,
        additionalContext: {},
      });
    });

    it('should create error context with additional context', () => {
      const additionalContext = {
        customField: 'custom value',
        debugInfo: { level: 'critical' },
      };

      handler.createContext({
        error: mockError,
        phase: ERROR_PHASES.EXECUTION,
        actionDef: mockActionDef,
        actorId: 'actor-123',
        additionalContext,
      });

      expect(mockLogger.error).toHaveBeenCalledWith('Error in execution phase', {
        error: 'Test error',
        stack: 'Test stack trace',
        actionId: 'test:action',
        actorId: 'actor-123',
        targetId: null,
        phase: ERROR_PHASES.EXECUTION,
        customField: 'custom value',
        debugInfo: { level: 'critical' },
      });

      expect(mockActionErrorContextBuilder.buildErrorContext).toHaveBeenCalledWith({
        error: mockError,
        actionDef: mockActionDef,
        actorId: 'actor-123',
        phase: ERROR_PHASES.EXECUTION,
        trace: null,
        targetId: null,
        additionalContext,
      });
    });

    it('should handle missing actionDef', () => {
      handler.createContext({
        error: mockError,
        phase: ERROR_PHASES.DISCOVERY,
        actionDef: null,
        actorId: 'actor-123',
      });

      expect(mockActionErrorContextBuilder.buildErrorContext).toHaveBeenCalledWith({
        error: mockError,
        actionDef: { id: 'unknown', name: 'Unknown Action' },
        actorId: 'actor-123',
        phase: ERROR_PHASES.DISCOVERY,
        trace: null,
        targetId: null,
        additionalContext: {},
      });
    });
  });

  describe('handleDiscoveryError', () => {
    it('should handle basic discovery error', () => {
      const result = handler.handleDiscoveryError(mockError, {
        actorId: 'actor-123',
      });

      expect(mockLogger.error).toHaveBeenCalledWith('Error in discovery phase', {
        error: 'Test error',
        stack: 'Test stack trace',
        actionId: undefined,
        actorId: 'actor-123',
        targetId: null,
        phase: ERROR_PHASES.DISCOVERY,
        stage: 'discovery',
      });

      expect(mockActionErrorContextBuilder.buildErrorContext).toHaveBeenCalledWith({
        error: mockError,
        actionDef: { id: 'unknown', name: 'Unknown Action' },
        actorId: 'actor-123',
        phase: ERROR_PHASES.DISCOVERY,
        trace: null,
        targetId: null,
        additionalContext: { stage: 'discovery' },
      });

      expect(result).toBeDefined();
    });

    it('should handle discovery error with actionDef', () => {
      handler.handleDiscoveryError(mockError, {
        actorId: 'actor-123',
        actionDef: mockActionDef,
      });

      expect(mockActionErrorContextBuilder.buildErrorContext).toHaveBeenCalledWith({
        error: mockError,
        actionDef: mockActionDef,
        actorId: 'actor-123',
        phase: ERROR_PHASES.DISCOVERY,
        trace: null,
        targetId: null,
        additionalContext: { stage: 'discovery' },
      });
    });

    it('should handle discovery error with trace context', () => {
      handler.handleDiscoveryError(mockError, {
        actorId: 'actor-123',
        trace: mockTraceContext,
      });

      expect(mockActionErrorContextBuilder.buildErrorContext).toHaveBeenCalledWith({
        error: mockError,
        actionDef: { id: 'unknown', name: 'Unknown Action' },
        actorId: 'actor-123',
        phase: ERROR_PHASES.DISCOVERY,
        trace: mockTraceContext,
        targetId: null,
        additionalContext: { stage: 'discovery' },
      });
    });

    it('should handle discovery error with additional context', () => {
      const additionalContext = { customData: 'test' };

      handler.handleDiscoveryError(mockError, {
        actorId: 'actor-123',
        additionalContext,
      });

      expect(mockActionErrorContextBuilder.buildErrorContext).toHaveBeenCalledWith({
        error: mockError,
        actionDef: { id: 'unknown', name: 'Unknown Action' },
        actorId: 'actor-123',
        phase: ERROR_PHASES.DISCOVERY,
        trace: null,
        targetId: null,
        additionalContext: { stage: 'discovery', customData: 'test' },
      });
    });
  });

  describe('handleExecutionError', () => {
    it('should handle basic execution error', () => {
      const result = handler.handleExecutionError(mockError, {
        actorId: 'actor-123',
        actionDef: mockActionDef,
      });

      expect(mockLogger.error).toHaveBeenCalledWith('Error in execution phase', {
        error: 'Test error',
        stack: 'Test stack trace',
        actionId: 'test:action',
        actorId: 'actor-123',
        targetId: null,
        phase: ERROR_PHASES.EXECUTION,
        stage: 'execution',
      });

      expect(mockActionErrorContextBuilder.buildErrorContext).toHaveBeenCalledWith({
        error: mockError,
        actionDef: mockActionDef,
        actorId: 'actor-123',
        phase: ERROR_PHASES.EXECUTION,
        trace: null,
        targetId: null,
        additionalContext: { stage: 'execution' },
      });

      expect(result).toBeDefined();
    });

    it('should handle execution error with targetId', () => {
      handler.handleExecutionError(mockError, {
        actorId: 'actor-123',
        actionDef: mockActionDef,
        targetId: 'target-456',
      });

      expect(mockActionErrorContextBuilder.buildErrorContext).toHaveBeenCalledWith({
        error: mockError,
        actionDef: mockActionDef,
        actorId: 'actor-123',
        phase: ERROR_PHASES.EXECUTION,
        trace: null,
        targetId: 'target-456',
        additionalContext: { stage: 'execution' },
      });
    });

    it('should handle execution error with trace context', () => {
      handler.handleExecutionError(mockError, {
        actorId: 'actor-123',
        actionDef: mockActionDef,
        trace: mockTraceContext,
      });

      expect(mockActionErrorContextBuilder.buildErrorContext).toHaveBeenCalledWith({
        error: mockError,
        actionDef: mockActionDef,
        actorId: 'actor-123',
        phase: ERROR_PHASES.EXECUTION,
        trace: mockTraceContext,
        targetId: null,
        additionalContext: { stage: 'execution' },
      });
    });

    it('should handle execution error with additional context', () => {
      const additionalContext = { executionDetail: 'failed at step 3' };

      handler.handleExecutionError(mockError, {
        actorId: 'actor-123',
        actionDef: mockActionDef,
        additionalContext,
      });

      expect(mockActionErrorContextBuilder.buildErrorContext).toHaveBeenCalledWith({
        error: mockError,
        actionDef: mockActionDef,
        actorId: 'actor-123',
        phase: ERROR_PHASES.EXECUTION,
        trace: null,
        targetId: null,
        additionalContext: { stage: 'execution', executionDetail: 'failed at step 3' },
      });
    });
  });

  describe('handleValidationError', () => {
    it('should handle basic validation error', () => {
      const result = handler.handleValidationError(mockError, {
        actorId: 'actor-123',
        actionDef: mockActionDef,
      });

      expect(mockLogger.error).toHaveBeenCalledWith('Error in validation phase', {
        error: 'Test error',
        stack: 'Test stack trace',
        actionId: 'test:action',
        actorId: 'actor-123',
        targetId: null,
        phase: ERROR_PHASES.VALIDATION,
        stage: 'validation',
      });

      expect(mockActionErrorContextBuilder.buildErrorContext).toHaveBeenCalledWith({
        error: mockError,
        actionDef: mockActionDef,
        actorId: 'actor-123',
        phase: ERROR_PHASES.VALIDATION,
        trace: null,
        targetId: null,
        additionalContext: { stage: 'validation' },
      });

      expect(result).toBeDefined();
    });

    it('should handle validation error with targetId', () => {
      handler.handleValidationError(mockError, {
        actorId: 'actor-123',
        actionDef: mockActionDef,
        targetId: 'target-789',
      });

      expect(mockActionErrorContextBuilder.buildErrorContext).toHaveBeenCalledWith({
        error: mockError,
        actionDef: mockActionDef,
        actorId: 'actor-123',
        phase: ERROR_PHASES.VALIDATION,
        trace: null,
        targetId: 'target-789',
        additionalContext: { stage: 'validation' },
      });
    });

    it('should handle validation error with trace context', () => {
      handler.handleValidationError(mockError, {
        actorId: 'actor-123',
        actionDef: mockActionDef,
        trace: mockTraceContext,
      });

      expect(mockActionErrorContextBuilder.buildErrorContext).toHaveBeenCalledWith({
        error: mockError,
        actionDef: mockActionDef,
        actorId: 'actor-123',
        phase: ERROR_PHASES.VALIDATION,
        trace: mockTraceContext,
        targetId: null,
        additionalContext: { stage: 'validation' },
      });
    });

    it('should handle validation error with additional context', () => {
      const additionalContext = { validationRule: 'range_check' };

      handler.handleValidationError(mockError, {
        actorId: 'actor-123',
        actionDef: mockActionDef,
        additionalContext,
      });

      expect(mockActionErrorContextBuilder.buildErrorContext).toHaveBeenCalledWith({
        error: mockError,
        actionDef: mockActionDef,
        actorId: 'actor-123',
        phase: ERROR_PHASES.VALIDATION,
        trace: null,
        targetId: null,
        additionalContext: { stage: 'validation', validationRule: 'range_check' },
      });
    });
  });

  describe('handleProcessingError', () => {
    it('should handle processing error with dispatch stage', () => {
      const result = handler.handleProcessingError(mockError, {
        actorId: 'actor-123',
        stage: 'dispatch',
      });

      expect(mockLogger.error).toHaveBeenCalledWith('Error in execution phase', {
        error: 'Test error',
        stack: 'Test stack trace',
        actionId: undefined,
        actorId: 'actor-123',
        targetId: null,
        phase: ERROR_PHASES.EXECUTION,
        stage: 'command_processing_dispatch',
      });

      expect(mockActionErrorContextBuilder.buildErrorContext).toHaveBeenCalledWith({
        error: mockError,
        actionDef: { id: 'unknown', name: 'Unknown Action' },
        actorId: 'actor-123',
        phase: ERROR_PHASES.EXECUTION,
        trace: null,
        targetId: null,
        additionalContext: { stage: 'command_processing_dispatch' },
      });

      expect(result).toBeDefined();
    });

    it('should handle processing error with interpretation stage', () => {
      handler.handleProcessingError(mockError, {
        actorId: 'actor-123',
        stage: 'interpretation',
      });

      expect(mockActionErrorContextBuilder.buildErrorContext).toHaveBeenCalledWith({
        error: mockError,
        actionDef: { id: 'unknown', name: 'Unknown Action' },
        actorId: 'actor-123',
        phase: ERROR_PHASES.EXECUTION,
        trace: null,
        targetId: null,
        additionalContext: { stage: 'command_processing_interpretation' },
      });
    });

    it('should handle processing error with directive stage', () => {
      handler.handleProcessingError(mockError, {
        actorId: 'actor-123',
        stage: 'directive',
      });

      expect(mockActionErrorContextBuilder.buildErrorContext).toHaveBeenCalledWith({
        error: mockError,
        actionDef: { id: 'unknown', name: 'Unknown Action' },
        actorId: 'actor-123',
        phase: ERROR_PHASES.EXECUTION,
        trace: null,
        targetId: null,
        additionalContext: { stage: 'command_processing_directive' },
      });
    });

    it('should handle processing error with actionDef', () => {
      handler.handleProcessingError(mockError, {
        actorId: 'actor-123',
        stage: 'dispatch',
        actionDef: mockActionDef,
      });

      expect(mockActionErrorContextBuilder.buildErrorContext).toHaveBeenCalledWith({
        error: mockError,
        actionDef: mockActionDef,
        actorId: 'actor-123',
        phase: ERROR_PHASES.EXECUTION,
        trace: null,
        targetId: null,
        additionalContext: { stage: 'command_processing_dispatch' },
      });
    });

    it('should handle processing error with additional context', () => {
      const additionalContext = { processingStep: 'validation', attemptCount: 3 };

      handler.handleProcessingError(mockError, {
        actorId: 'actor-123',
        stage: 'dispatch',
        additionalContext,
      });

      expect(mockActionErrorContextBuilder.buildErrorContext).toHaveBeenCalledWith({
        error: mockError,
        actionDef: { id: 'unknown', name: 'Unknown Action' },
        actorId: 'actor-123',
        phase: ERROR_PHASES.EXECUTION,
        trace: null,
        targetId: null,
        additionalContext: {
          stage: 'command_processing_dispatch',
          processingStep: 'validation',
          attemptCount: 3,
        },
      });
    });
  });

  describe('logError', () => {
    it('should log error with message only', () => {
      handler.logError('Something went wrong', mockError);

      expect(mockLogger.error).toHaveBeenCalledWith('Something went wrong', {
        error: 'Test error',
        stack: 'Test stack trace',
      });
    });

    it('should log error with additional context', () => {
      const context = {
        userId: 'user-123',
        operation: 'update',
        metadata: { version: 2 },
      };

      handler.logError('Operation failed', mockError, context);

      expect(mockLogger.error).toHaveBeenCalledWith('Operation failed', {
        error: 'Test error',
        stack: 'Test stack trace',
        userId: 'user-123',
        operation: 'update',
        metadata: { version: 2 },
      });
    });

    it('should handle empty context', () => {
      handler.logError('Error occurred', mockError, {});

      expect(mockLogger.error).toHaveBeenCalledWith('Error occurred', {
        error: 'Test error',
        stack: 'Test stack trace',
      });
    });
  });

  describe('createSimpleErrorResponse', () => {
    it('should create simple error response', () => {
      const result = handler.createSimpleErrorResponse(
        mockError,
        'Operation failed. Please try again.'
      );

      expect(result).toEqual({
        success: false,
        error: 'Operation failed. Please try again.',
        details: 'Test error',
      });
    });

    it('should handle different user messages', () => {
      const customError = new Error('Database connection failed');
      const result = handler.createSimpleErrorResponse(
        customError,
        'Unable to connect to database'
      );

      expect(result).toEqual({
        success: false,
        error: 'Unable to connect to database',
        details: 'Database connection failed',
      });
    });

    it('should always set success to false', () => {
      const results = [
        handler.createSimpleErrorResponse(mockError, 'Error 1'),
        handler.createSimpleErrorResponse(new Error('Another error'), 'Error 2'),
        handler.createSimpleErrorResponse(new Error(''), 'Error 3'),
      ];

      results.forEach((result) => {
        expect(result.success).toBe(false);
      });
    });
  });
});