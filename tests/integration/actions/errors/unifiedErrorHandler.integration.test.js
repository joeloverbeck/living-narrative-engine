/**
 * @file Integration tests for UnifiedErrorHandler
 * @description Ensures the unified error handling utility logs and builds contexts consistently across phases.
 */

import { jest } from '@jest/globals';
import { describe, it, expect, beforeEach } from '@jest/globals';
import { UnifiedErrorHandler } from '../../../../src/actions/errors/unifiedErrorHandler.js';
import { ERROR_PHASES } from '../../../../src/actions/errors/actionErrorTypes.js';

/**
 * Creates a reusable set of dependencies for the handler under test.
 *
 * @returns {{ builder: { buildErrorContext: jest.Mock }, logger: { error: jest.Mock }, handler: UnifiedErrorHandler }}
 */
function createTestHarness() {
  const builder = {
    buildErrorContext: jest.fn((context) => ({ built: true, ...context })),
  };

  const logger = {
    error: jest.fn(),
  };

  return {
    builder,
    logger,
    handler: new UnifiedErrorHandler({
      actionErrorContextBuilder: builder,
      logger,
    }),
  };
}

describe('UnifiedErrorHandler integration', () => {
  let builder;
  let logger;
  let handler;

  beforeEach(() => {
    ({ builder, logger, handler } = createTestHarness());
  });

  describe('constructor validation', () => {
    it('throws when the actionErrorContextBuilder dependency is missing', () => {
      expect(() => {
        return new UnifiedErrorHandler({
          logger: { error: jest.fn() },
        });
      }).toThrow('UnifiedErrorHandler requires actionErrorContextBuilder');
    });

    it('throws when the logger dependency is missing', () => {
      expect(() => {
        return new UnifiedErrorHandler({
          actionErrorContextBuilder: { buildErrorContext: jest.fn() },
        });
      }).toThrow('UnifiedErrorHandler requires logger');
    });
  });

  describe('createContext', () => {
    it('logs the error and builds context with fallback defaults when optional fields are omitted', () => {
      const error = new Error('execution failure');

      const context = handler.createContext({
        error,
        phase: ERROR_PHASES.EXECUTION,
        actionDef: null,
        actorId: 'actor-1',
      });

      expect(logger.error).toHaveBeenCalledWith('Error in execution phase', {
        error: error.message,
        stack: error.stack,
        actionId: undefined,
        actorId: 'actor-1',
        targetId: null,
        phase: ERROR_PHASES.EXECUTION,
      });

      expect(builder.buildErrorContext).toHaveBeenCalledWith({
        error,
        actionDef: { id: 'unknown', name: 'Unknown Action' },
        actorId: 'actor-1',
        phase: ERROR_PHASES.EXECUTION,
        trace: null,
        targetId: null,
        additionalContext: {},
      });

      expect(context).toEqual({
        built: true,
        error,
        actionDef: { id: 'unknown', name: 'Unknown Action' },
        actorId: 'actor-1',
        phase: ERROR_PHASES.EXECUTION,
        trace: null,
        targetId: null,
        additionalContext: {},
      });
    });

    it('passes through provided action definition, target and additional context', () => {
      const error = new Error('discovery mismatch');
      const actionDef = { id: 'discover', name: 'Discovery Action' };
      const additionalContext = { severity: 'high' };

      handler.createContext({
        error,
        phase: ERROR_PHASES.DISCOVERY,
        actionDef,
        actorId: 'actor-2',
        targetId: 'target-7',
        trace: { id: 'trace-1' },
        additionalContext,
      });

      expect(logger.error).toHaveBeenCalledWith('Error in discovery phase', {
        error: error.message,
        stack: error.stack,
        actionId: 'discover',
        actorId: 'actor-2',
        targetId: 'target-7',
        phase: ERROR_PHASES.DISCOVERY,
        severity: 'high',
      });

      expect(builder.buildErrorContext).toHaveBeenCalledWith({
        error,
        actionDef,
        actorId: 'actor-2',
        phase: ERROR_PHASES.DISCOVERY,
        targetId: 'target-7',
        trace: { id: 'trace-1' },
        additionalContext: {
          severity: 'high',
        },
      });
    });
  });

  describe('phase specific helpers', () => {
    it('handleDiscoveryError attaches discovery stage metadata', () => {
      const error = new Error('discovery broke');

      handler.handleDiscoveryError(error, {
        actorId: 'actor-3',
        actionDef: { id: 'act', name: 'Action' },
        trace: { id: 'trace-discovery' },
        additionalContext: { hint: 'check scope' },
      });

      expect(builder.buildErrorContext).toHaveBeenLastCalledWith({
        error,
        actionDef: { id: 'act', name: 'Action' },
        actorId: 'actor-3',
        phase: ERROR_PHASES.DISCOVERY,
        targetId: null,
        trace: { id: 'trace-discovery' },
        additionalContext: {
          stage: 'discovery',
          hint: 'check scope',
        },
      });
    });

    it('handleDiscoveryError falls back to defaults when optional context is missing', () => {
      const error = new Error('empty discovery context');

      handler.handleDiscoveryError(error, {
        actorId: 'actor-3b',
      });

      expect(builder.buildErrorContext).toHaveBeenLastCalledWith({
        error,
        actionDef: { id: 'unknown', name: 'Unknown Action' },
        actorId: 'actor-3b',
        phase: ERROR_PHASES.DISCOVERY,
        targetId: null,
        trace: null,
        additionalContext: {
          stage: 'discovery',
        },
      });
    });

    it('handleExecutionError merges execution stage metadata and target', () => {
      const error = new Error('execution broke');

      handler.handleExecutionError(error, {
        actorId: 'actor-4',
        actionDef: { id: 'exec', name: 'Execution Action' },
        targetId: 'target-2',
        trace: { id: 'trace-execution' },
        additionalContext: { attempt: 2 },
      });

      expect(builder.buildErrorContext).toHaveBeenLastCalledWith({
        error,
        actionDef: { id: 'exec', name: 'Execution Action' },
        actorId: 'actor-4',
        phase: ERROR_PHASES.EXECUTION,
        targetId: 'target-2',
        trace: { id: 'trace-execution' },
        additionalContext: {
          stage: 'execution',
          attempt: 2,
        },
      });
    });

    it('handleExecutionError applies default metadata when optional fields are absent', () => {
      const error = new Error('execution defaults');

      handler.handleExecutionError(error, {
        actorId: 'actor-4b',
        actionDef: { id: 'exec2', name: 'Execution Action 2' },
      });

      expect(builder.buildErrorContext).toHaveBeenLastCalledWith({
        error,
        actionDef: { id: 'exec2', name: 'Execution Action 2' },
        actorId: 'actor-4b',
        phase: ERROR_PHASES.EXECUTION,
        targetId: null,
        trace: null,
        additionalContext: {
          stage: 'execution',
        },
      });
    });

    it('handleValidationError merges validation stage metadata', () => {
      const error = new Error('validation broke');

      handler.handleValidationError(error, {
        actorId: 'actor-5',
        actionDef: { id: 'validate', name: 'Validation Action' },
        targetId: 'target-3',
        trace: { id: 'trace-validation' },
        additionalContext: { field: 'name' },
      });

      expect(builder.buildErrorContext).toHaveBeenLastCalledWith({
        error,
        actionDef: { id: 'validate', name: 'Validation Action' },
        actorId: 'actor-5',
        phase: ERROR_PHASES.VALIDATION,
        targetId: 'target-3',
        trace: { id: 'trace-validation' },
        additionalContext: {
          stage: 'validation',
          field: 'name',
        },
      });
    });

    it('handleValidationError applies defaults for missing optional fields', () => {
      const error = new Error('validation defaults');

      handler.handleValidationError(error, {
        actorId: 'actor-5b',
        actionDef: { id: 'validate2', name: 'Validation Action 2' },
      });

      expect(builder.buildErrorContext).toHaveBeenLastCalledWith({
        error,
        actionDef: { id: 'validate2', name: 'Validation Action 2' },
        actorId: 'actor-5b',
        phase: ERROR_PHASES.VALIDATION,
        targetId: null,
        trace: null,
        additionalContext: {
          stage: 'validation',
        },
      });
    });

    it('handleProcessingError maps pipeline stage names and uses execution phase', () => {
      const error = new Error('processing broke');

      handler.handleProcessingError(error, {
        actorId: 'actor-6',
        stage: 'dispatch',
        actionDef: { id: 'process', name: 'Processing Action' },
        additionalContext: { retry: true },
      });

      expect(builder.buildErrorContext).toHaveBeenLastCalledWith({
        error,
        actionDef: { id: 'process', name: 'Processing Action' },
        actorId: 'actor-6',
        phase: ERROR_PHASES.EXECUTION,
        targetId: null,
        trace: null,
        additionalContext: {
          stage: 'command_processing_dispatch',
          retry: true,
        },
      });
    });

    it('handleProcessingError supports minimal context when only stage is provided', () => {
      const error = new Error('processing defaults');

      handler.handleProcessingError(error, {
        actorId: 'actor-6b',
        stage: 'interpretation',
      });

      expect(builder.buildErrorContext).toHaveBeenLastCalledWith({
        error,
        actionDef: { id: 'unknown', name: 'Unknown Action' },
        actorId: 'actor-6b',
        phase: ERROR_PHASES.EXECUTION,
        targetId: null,
        trace: null,
        additionalContext: {
          stage: 'command_processing_interpretation',
        },
      });
    });
  });

  describe('utility helpers', () => {
    it('logError proxies to the logger', () => {
      const error = new Error('simple failure');

      handler.logError('Something happened', error, { scope: 'test' });

      expect(logger.error).toHaveBeenCalledWith('Something happened', {
        error: error.message,
        stack: error.stack,
        scope: 'test',
      });

      handler.logError('Without context', error);

      expect(logger.error).toHaveBeenLastCalledWith('Without context', {
        error: error.message,
        stack: error.stack,
      });
    });

    it('createSimpleErrorResponse returns consistent payload', () => {
      const error = new Error('fatal');

      expect(
        handler.createSimpleErrorResponse(error, 'User friendly message')
      ).toEqual({
        success: false,
        error: 'User friendly message',
        details: 'fatal',
      });
    });
  });
});
