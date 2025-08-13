import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ActionExecutionTraceFactory } from '../../../../src/actions/tracing/actionExecutionTraceFactory.js';
import { ActionExecutionTrace } from '../../../../src/actions/tracing/actionExecutionTrace.js';
import { InvalidArgumentError } from '../../../../src/errors/invalidArgumentError.js';

// Mock ActionExecutionTrace to verify factory calls it correctly
jest.mock('../../../../src/actions/tracing/actionExecutionTrace.js');

describe('ActionExecutionTraceFactory', () => {
  let factory;
  let mockLogger;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create mock logger that will be used by the factory
    // Make sure it has all required methods for ensureValidLogger
    mockLogger = {
      debug: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
    };

    // Mock ActionExecutionTrace constructor
    ActionExecutionTrace.mockImplementation((params) => {
      return {
        actionId: params.actionId,
        actorId: params.actorId,
        turnAction: params.turnAction,
        enableTiming: params.enableTiming,
      };
    });

    factory = new ActionExecutionTraceFactory({ logger: mockLogger });
  });

  describe('Constructor', () => {
    it('should create factory with valid logger', () => {
      expect(factory).toBeDefined();
      expect(factory).toBeInstanceOf(ActionExecutionTraceFactory);
    });

    it('should create factory with fallback logger when logger is missing', () => {
      const factoryWithoutLogger = new ActionExecutionTraceFactory({});
      expect(factoryWithoutLogger).toBeDefined();
      expect(factoryWithoutLogger).toBeInstanceOf(ActionExecutionTraceFactory);
    });

    it('should create factory with fallback logger when logger is invalid', () => {
      const factoryWithNullLogger = new ActionExecutionTraceFactory({
        logger: null,
      });
      expect(factoryWithNullLogger).toBeDefined();

      const factoryWithInvalidLogger = new ActionExecutionTraceFactory({
        logger: 'not-a-logger',
      });
      expect(factoryWithInvalidLogger).toBeDefined();
    });
  });

  describe('createTrace()', () => {
    const validTurnAction = {
      actionDefinitionId: 'core:go',
      commandString: 'go north',
      parameters: { direction: 'north' },
    };

    it('should create trace with valid parameters and log debug message', () => {
      const result = factory.createTrace({
        actionId: 'core:go',
        actorId: 'player-1',
        turnAction: validTurnAction,
        enableTiming: true,
      });

      expect(ActionExecutionTrace).toHaveBeenCalledWith({
        actionId: 'core:go',
        actorId: 'player-1',
        turnAction: validTurnAction,
        enableTiming: true,
      });

      expect(result).toBeDefined();
      expect(result.actionId).toBe('core:go');
      expect(result.actorId).toBe('player-1');

      // Verify debug logging occurs after successful creation
      expect(mockLogger.debug).toHaveBeenCalledTimes(1);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "Created execution trace for action 'core:go' by actor 'player-1'"
      );
    });

    it('should create trace with default enableTiming=true', () => {
      factory.createTrace({
        actionId: 'core:go',
        actorId: 'player-1',
        turnAction: validTurnAction,
      });

      expect(ActionExecutionTrace).toHaveBeenCalledWith(
        expect.objectContaining({ enableTiming: true })
      );
    });

    it('should create trace with enableTiming=false when specified', () => {
      factory.createTrace({
        actionId: 'core:go',
        actorId: 'player-1',
        turnAction: validTurnAction,
        enableTiming: false,
      });

      expect(ActionExecutionTrace).toHaveBeenCalledWith(
        expect.objectContaining({ enableTiming: false })
      );
    });

    it('should throw error for null actionId', () => {
      expect(() =>
        factory.createTrace({
          actionId: null,
          actorId: 'player-1',
          turnAction: validTurnAction,
        })
      ).toThrow('actionId');
    });

    it('should throw error for empty actionId', () => {
      expect(() =>
        factory.createTrace({
          actionId: '',
          actorId: 'player-1',
          turnAction: validTurnAction,
        })
      ).toThrow('actionId');
    });

    it('should throw error for non-string actionId', () => {
      expect(() =>
        factory.createTrace({
          actionId: 123,
          actorId: 'player-1',
          turnAction: validTurnAction,
        })
      ).toThrow('actionId');
    });

    it('should throw error for null actorId', () => {
      expect(() =>
        factory.createTrace({
          actionId: 'core:go',
          actorId: null,
          turnAction: validTurnAction,
        })
      ).toThrow('actorId');
    });

    it('should throw error for empty actorId', () => {
      expect(() =>
        factory.createTrace({
          actionId: 'core:go',
          actorId: '',
          turnAction: validTurnAction,
        })
      ).toThrow('actorId');
    });

    it('should throw error for non-string actorId', () => {
      expect(() =>
        factory.createTrace({
          actionId: 'core:go',
          actorId: 123,
          turnAction: validTurnAction,
        })
      ).toThrow('actorId');
    });

    it('should throw Error wrapping InvalidArgumentError for null turnAction', () => {
      expect(() =>
        factory.createTrace({
          actionId: 'core:go',
          actorId: 'player-1',
          turnAction: null,
        })
      ).toThrow(
        'Failed to create execution trace: Turn action is required and must be an object'
      );
    });

    it('should throw Error wrapping InvalidArgumentError for non-object turnAction', () => {
      expect(() =>
        factory.createTrace({
          actionId: 'core:go',
          actorId: 'player-1',
          turnAction: 'not-an-object',
        })
      ).toThrow(
        'Failed to create execution trace: Turn action is required and must be an object'
      );
    });

    it('should throw error for turnAction missing actionDefinitionId', () => {
      expect(() =>
        factory.createTrace({
          actionId: 'core:go',
          actorId: 'player-1',
          turnAction: { commandString: 'go north' },
        })
      ).toThrow('Turn action missing required actionDefinitionId');
    });

    it('should log warning for invalid commandString type', () => {
      const invalidTurnAction = {
        actionDefinitionId: 'core:go',
        commandString: 123, // should be string
        parameters: { direction: 'north' },
      };

      // The warning comes from the private #validateTurnAction method
      factory.createTrace({
        actionId: 'core:go',
        actorId: 'player-1',
        turnAction: invalidTurnAction,
      });

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Turn action commandString should be string, got number'
      );
    });

    it('should log warning for invalid parameters type', () => {
      const invalidTurnAction = {
        actionDefinitionId: 'core:go',
        commandString: 'go north',
        parameters: 'should-be-object', // should be object
      };

      factory.createTrace({
        actionId: 'core:go',
        actorId: 'player-1',
        turnAction: invalidTurnAction,
      });

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Turn action parameters should be object, got string'
      );
    });

    it('should not warn for valid commandString and parameters types', () => {
      factory.createTrace({
        actionId: 'core:go',
        actorId: 'player-1',
        turnAction: validTurnAction,
      });

      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it('should handle missing optional fields gracefully', () => {
      const minimalTurnAction = {
        actionDefinitionId: 'core:go',
      };

      expect(() =>
        factory.createTrace({
          actionId: 'core:go',
          actorId: 'player-1',
          turnAction: minimalTurnAction,
        })
      ).not.toThrow();

      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it('should handle ActionExecutionTrace constructor errors', () => {
      // Mock ActionExecutionTrace to throw an error
      ActionExecutionTrace.mockImplementation(() => {
        throw new Error('ActionExecutionTrace constructor failed');
      });

      expect(() =>
        factory.createTrace({
          actionId: 'core:go',
          actorId: 'player-1',
          turnAction: validTurnAction,
        })
      ).toThrow(
        'Failed to create execution trace: ActionExecutionTrace constructor failed'
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to create ActionExecutionTrace',
        expect.any(Error)
      );
    });
  });

  describe('createFromTurnAction()', () => {
    const validTurnAction = {
      actionDefinitionId: 'core:go',
      commandString: 'go north',
      parameters: { direction: 'north' },
    };

    it('should create trace from turn action with valid parameters', () => {
      const result = factory.createFromTurnAction(validTurnAction, 'player-1');

      expect(ActionExecutionTrace).toHaveBeenCalledWith({
        actionId: 'core:go',
        actorId: 'player-1',
        turnAction: validTurnAction,
        enableTiming: true,
      });

      expect(result).toBeDefined();
    });

    it('should create trace with custom enableTiming=false', () => {
      factory.createFromTurnAction(validTurnAction, 'player-1', false);

      expect(ActionExecutionTrace).toHaveBeenCalledWith(
        expect.objectContaining({ enableTiming: false })
      );
    });

    it('should use default enableTiming=true', () => {
      factory.createFromTurnAction(validTurnAction, 'player-1');

      expect(ActionExecutionTrace).toHaveBeenCalledWith(
        expect.objectContaining({ enableTiming: true })
      );
    });

    it('should extract actionId from turnAction.actionDefinitionId', () => {
      factory.createFromTurnAction(validTurnAction, 'player-1');

      expect(ActionExecutionTrace).toHaveBeenCalledWith(
        expect.objectContaining({ actionId: 'core:go' })
      );
    });

    it('should throw InvalidArgumentError for null turnAction', () => {
      expect(() => factory.createFromTurnAction(null, 'player-1')).toThrow(
        InvalidArgumentError
      );
      expect(() => factory.createFromTurnAction(null, 'player-1')).toThrow(
        'Turn action is required and must be an object'
      );
    });

    it('should throw InvalidArgumentError for non-object turnAction', () => {
      expect(() =>
        factory.createFromTurnAction('not-an-object', 'player-1')
      ).toThrow(InvalidArgumentError);
      expect(() =>
        factory.createFromTurnAction('not-an-object', 'player-1')
      ).toThrow('Turn action is required and must be an object');
    });

    it('should throw error for null actorId', () => {
      expect(() => factory.createFromTurnAction(validTurnAction, null)).toThrow(
        'actorId'
      );
    });

    it('should throw error for empty actorId', () => {
      expect(() => factory.createFromTurnAction(validTurnAction, '')).toThrow(
        'actorId'
      );
    });

    it('should throw error for non-string actorId', () => {
      expect(() => factory.createFromTurnAction(validTurnAction, 123)).toThrow(
        'actorId'
      );
    });

    it('should throw InvalidArgumentError for missing actionDefinitionId', () => {
      const turnActionWithoutId = {
        commandString: 'go north',
        parameters: { direction: 'north' },
      };

      expect(() =>
        factory.createFromTurnAction(turnActionWithoutId, 'player-1')
      ).toThrow(InvalidArgumentError);
      expect(() =>
        factory.createFromTurnAction(turnActionWithoutId, 'player-1')
      ).toThrow('Turn action missing actionDefinitionId');
    });

    it('should delegate to createTrace with extracted actionId', () => {
      // Spy on createTrace to verify delegation
      const createTraceSpy = jest.spyOn(factory, 'createTrace');

      factory.createFromTurnAction(validTurnAction, 'player-1', false);

      expect(createTraceSpy).toHaveBeenCalledWith({
        actionId: 'core:go',
        actorId: 'player-1',
        turnAction: validTurnAction,
        enableTiming: false,
      });

      createTraceSpy.mockRestore();
    });
  });

  describe('Error handling and logging', () => {
    it('should log debug message on successful trace creation', () => {
      const validTurnAction = {
        actionDefinitionId: 'core:test',
      };

      factory.createTrace({
        actionId: 'core:test',
        actorId: 'test-actor',
        turnAction: validTurnAction,
      });

      expect(mockLogger.debug).toHaveBeenCalledWith(
        "Created execution trace for action 'core:test' by actor 'test-actor'"
      );
    });

    it('should log error and re-throw with context on failure', () => {
      // Mock ActionExecutionTrace to throw
      const originalError = new Error('Construction failed');
      ActionExecutionTrace.mockImplementation(() => {
        throw originalError;
      });

      const validTurnAction = {
        actionDefinitionId: 'core:test',
      };

      expect(() =>
        factory.createTrace({
          actionId: 'core:test',
          actorId: 'test-actor',
          turnAction: validTurnAction,
        })
      ).toThrow('Failed to create execution trace: Construction failed');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to create ActionExecutionTrace',
        originalError
      );
    });
  });
});
