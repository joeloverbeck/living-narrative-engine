/**
 * @file directiveExecutor.test.js
 * @description Unit tests for DirectiveExecutor service.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { DirectiveExecutor } from '../../../../../../src/turns/states/helpers/services/directiveExecutor.js';

// Mock the BaseService to avoid its dependencies  
jest.mock('../../../../../../src/utils/serviceBase.js', () => ({
  BaseService: class MockBaseService {
    _init(serviceName, logger, deps) {
      // Mock the _init method to validate dependencies and return logger
      if (!logger) {
        throw new Error('Logger is required');
      }
      
      // Validate dependencies if provided
      if (deps) {
        Object.entries(deps).forEach(([key, spec]) => {
          if (!spec.value) {
            throw new Error(`${key} is required`);
          }
          if (spec.requiredMethods) {
            spec.requiredMethods.forEach(method => {
              if (typeof spec.value[method] !== 'function') {
                throw new Error(`${key} must have method ${method}`);
              }
            });
          }
        });
      }
      
      return logger;
    }
  }
}));

describe('DirectiveExecutor', () => {
  let directiveExecutor;
  let mockDirectiveStrategyResolver;
  let mockUnifiedErrorHandler;
  let mockLogger;
  let mockTurnContext;
  let mockStrategy;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock strategy
    mockStrategy = {
      constructor: { name: 'MockStrategy' },
      execute: jest.fn(),
    };

    // Mock directive strategy resolver
    mockDirectiveStrategyResolver = {
      resolveStrategy: jest.fn(() => mockStrategy),
    };

    // Mock unified error handler
    mockUnifiedErrorHandler = {
      handleProcessingError: jest.fn(),
      logError: jest.fn(),
    };

    // Mock logger
    mockLogger = {
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      info: jest.fn(),
    };

    // Mock turn context with actor
    mockTurnContext = {
      getActor: jest.fn(() => ({ id: 'test-actor-id' })),
    };

    // Create service instance
    directiveExecutor = new DirectiveExecutor({
      directiveStrategyResolver: mockDirectiveStrategyResolver,
      unifiedErrorHandler: mockUnifiedErrorHandler,
      logger: mockLogger,
    });
  });

  describe('constructor', () => {
    it('should create instance with valid dependencies', () => {
      expect(directiveExecutor).toBeInstanceOf(DirectiveExecutor);
    });

    it('should require logger', () => {
      expect(() => {
        new DirectiveExecutor({
          directiveStrategyResolver: mockDirectiveStrategyResolver,
          unifiedErrorHandler: mockUnifiedErrorHandler,
          logger: null,
        });
      }).toThrow('Logger is required');
    });

    it('should require directiveStrategyResolver', () => {
      expect(() => {
        new DirectiveExecutor({
          directiveStrategyResolver: null,
          unifiedErrorHandler: mockUnifiedErrorHandler,
          logger: mockLogger,
        });
      }).toThrow('directiveStrategyResolver is required');
    });

    it('should require unifiedErrorHandler', () => {
      expect(() => {
        new DirectiveExecutor({
          directiveStrategyResolver: mockDirectiveStrategyResolver,
          unifiedErrorHandler: null,
          logger: mockLogger,
        });
      }).toThrow('unifiedErrorHandler is required');
    });

    it('should validate directiveStrategyResolver has resolveStrategy method', () => {
      const invalidResolver = {};
      
      expect(() => {
        new DirectiveExecutor({
          directiveStrategyResolver: invalidResolver,
          unifiedErrorHandler: mockUnifiedErrorHandler,
          logger: mockLogger,
        });
      }).toThrow('directiveStrategyResolver must have method resolveStrategy');
    });

    it('should validate unifiedErrorHandler has required methods', () => {
      const invalidErrorHandler = {
        handleProcessingError: jest.fn(),
        // missing logError method
      };
      
      expect(() => {
        new DirectiveExecutor({
          directiveStrategyResolver: mockDirectiveStrategyResolver,
          unifiedErrorHandler: invalidErrorHandler,
          logger: mockLogger,
        });
      }).toThrow('unifiedErrorHandler must have method logError');
    });
  });

  describe('execute', () => {
    const stateName = 'TestState';
    const directiveType = 'END_TURN_SUCCESS';
    const mockCommandResult = { success: true, data: 'test result' };

    it('should successfully execute directive strategy', async () => {
      mockStrategy.execute.mockResolvedValue(undefined);

      const result = await directiveExecutor.execute({
        turnContext: mockTurnContext,
        directiveType,
        commandResult: mockCommandResult,
        stateName,
      });

      expect(mockDirectiveStrategyResolver.resolveStrategy).toHaveBeenCalledWith(directiveType);
      expect(mockStrategy.execute).toHaveBeenCalledWith(
        mockTurnContext,
        directiveType,
        mockCommandResult
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(`Resolved strategy ${mockStrategy.constructor.name}`)
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(`Directive strategy ${mockStrategy.constructor.name} executed`)
      );
      expect(result).toEqual({ executed: true, stateChanged: false });
    });

    it('should handle missing strategy and return error', async () => {
      mockDirectiveStrategyResolver.resolveStrategy.mockReturnValue(null);

      const result = await directiveExecutor.execute({
        turnContext: mockTurnContext,
        directiveType,
        commandResult: mockCommandResult,
        stateName,
      });

      expect(mockUnifiedErrorHandler.handleProcessingError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          actorId: 'test-actor-id',
          stage: 'directive_execution',
          additionalContext: expect.objectContaining({
            stateName,
            directiveType,
            commandSuccess: mockCommandResult.success,
          }),
        })
      );
      expect(result).toEqual({ executed: false, stateChanged: false });
    });

    it('should handle strategy execution error', async () => {
      const executionError = new Error('Strategy execution failed');
      mockStrategy.execute.mockRejectedValue(executionError);

      const result = await directiveExecutor.execute({
        turnContext: mockTurnContext,
        directiveType,
        commandResult: mockCommandResult,
        stateName,
      });

      expect(mockUnifiedErrorHandler.handleProcessingError).toHaveBeenCalledWith(
        executionError,
        expect.objectContaining({
          actorId: 'test-actor-id',
          stage: 'directive_execution',
          additionalContext: expect.objectContaining({
            stateName,
            directiveType,
            commandSuccess: mockCommandResult.success,
          }),
        })
      );
      expect(result).toEqual({ executed: false, stateChanged: false });
    });

    it('should handle turn context with no actor', async () => {
      mockTurnContext.getActor.mockReturnValue(null);
      mockStrategy.execute.mockResolvedValue(undefined);

      const result = await directiveExecutor.execute({
        turnContext: mockTurnContext,
        directiveType,
        commandResult: mockCommandResult,
        stateName,
      });

      expect(result).toEqual({ executed: true, stateChanged: false });
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Actor UnknownActor -')
      );
    });

    it('should handle turn context with undefined actor', async () => {
      mockTurnContext.getActor.mockReturnValue(undefined);
      mockStrategy.execute.mockResolvedValue(undefined);

      const result = await directiveExecutor.execute({
        turnContext: mockTurnContext,
        directiveType,
        commandResult: mockCommandResult,
        stateName,
      });

      expect(result).toEqual({ executed: true, stateChanged: false });
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Actor UnknownActor -')
      );
    });

    it('should log correct actor ID and directive details', async () => {
      const customActor = { id: 'custom-actor-123' };
      const customDirective = 'END_TURN_FAILURE';
      mockTurnContext.getActor.mockReturnValue(customActor);
      mockStrategy.execute.mockResolvedValue(undefined);

      await directiveExecutor.execute({
        turnContext: mockTurnContext,
        directiveType: customDirective,
        commandResult: mockCommandResult,
        stateName,
      });

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(`Actor ${customActor.id} - Resolved strategy ${mockStrategy.constructor.name} for directive ${customDirective}`)
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(`Actor ${customActor.id} - Directive strategy ${mockStrategy.constructor.name} executed`)
      );
    });
  });

  describe('validateDirective', () => {
    it('should return true for valid string directive', () => {
      const result = directiveExecutor.validateDirective('END_TURN_SUCCESS');
      expect(result).toBe(true);
    });

    it('should return false for null directive', () => {
      const result = directiveExecutor.validateDirective(null);
      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Invalid directive type',
        { directiveType: null }
      );
    });

    it('should return false for undefined directive', () => {
      const result = directiveExecutor.validateDirective(undefined);
      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Invalid directive type',
        { directiveType: undefined }
      );
    });

    it('should return false for non-string directive', () => {
      const result = directiveExecutor.validateDirective(123);
      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Invalid directive type',
        { directiveType: 123 }
      );
    });

    it('should return false for empty string directive', () => {
      const result = directiveExecutor.validateDirective('');
      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith('Invalid directive type', { directiveType: '' });
    });

    it('should return false for whitespace-only directive', () => {
      const result = directiveExecutor.validateDirective('   ');
      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith('Empty directive type');
    });

    it('should return true for directive with leading/trailing whitespace', () => {
      const result = directiveExecutor.validateDirective('  END_TURN_SUCCESS  ');
      expect(result).toBe(true); // trim() removes whitespace, leaving valid content
      expect(mockLogger.error).not.toHaveBeenCalled();
    });
  });

  describe('hasStrategy', () => {
    it('should return true when strategy exists', () => {
      mockDirectiveStrategyResolver.resolveStrategy.mockReturnValue(mockStrategy);

      const result = directiveExecutor.hasStrategy('END_TURN_SUCCESS');

      expect(result).toBe(true);
      expect(mockDirectiveStrategyResolver.resolveStrategy).toHaveBeenCalledWith('END_TURN_SUCCESS');
    });

    it('should return false when strategy does not exist', () => {
      mockDirectiveStrategyResolver.resolveStrategy.mockReturnValue(null);

      const result = directiveExecutor.hasStrategy('UNKNOWN_DIRECTIVE');

      expect(result).toBe(false);
      expect(mockDirectiveStrategyResolver.resolveStrategy).toHaveBeenCalledWith('UNKNOWN_DIRECTIVE');
    });

    it('should return false when strategy resolution throws error', () => {
      const resolutionError = new Error('Resolution failed');
      mockDirectiveStrategyResolver.resolveStrategy.mockImplementation(() => {
        throw resolutionError;
      });

      const result = directiveExecutor.hasStrategy('ERROR_DIRECTIVE');

      expect(result).toBe(false);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'No strategy found for directive: ERROR_DIRECTIVE',
        { error: resolutionError.message }
      );
    });

    it('should handle undefined return from strategy resolver', () => {
      mockDirectiveStrategyResolver.resolveStrategy.mockReturnValue(undefined);

      const result = directiveExecutor.hasStrategy('UNDEFINED_DIRECTIVE');

      expect(result).toBe(false);
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete workflow with validation and execution', async () => {
      const directiveType = 'END_TURN_SUCCESS';
      const commandResult = { success: true };
      
      // Validate directive first
      const isValid = directiveExecutor.validateDirective(directiveType);
      expect(isValid).toBe(true);

      // Check if strategy exists
      const hasStrategy = directiveExecutor.hasStrategy(directiveType);
      expect(hasStrategy).toBe(true);

      // Execute directive
      mockStrategy.execute.mockResolvedValue(undefined);
      const result = await directiveExecutor.execute({
        turnContext: mockTurnContext,
        directiveType,
        commandResult,
        stateName: 'TestState',
      });

      expect(result).toEqual({ executed: true, stateChanged: false });
    });

    it('should handle workflow with invalid directive', async () => {
      const directiveType = '';
      const commandResult = { success: true };
      
      // Validate directive first
      const isValid = directiveExecutor.validateDirective(directiveType);
      expect(isValid).toBe(false);

      // Still attempt execution to test robustness
      mockDirectiveStrategyResolver.resolveStrategy.mockReturnValue(null);
      const result = await directiveExecutor.execute({
        turnContext: mockTurnContext,
        directiveType,
        commandResult,
        stateName: 'TestState',
      });

      expect(result).toEqual({ executed: false, stateChanged: false });
    });
  });
});