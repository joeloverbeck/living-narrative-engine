import { describe, test, expect, jest } from '@jest/globals';
import { ProcessingCommandState } from '../../../../src/turns/states/processingCommandState.js';
import TurnDirectiveStrategyResolver, {
  DEFAULT_STRATEGY_MAP,
} from '../../../../src/turns/strategies/turnDirectiveStrategyResolver.js';

describe('ProcessingCommandState constructor validation', () => {
  const validDeps = {
    handler: { getLogger: () => ({ debug: jest.fn(), error: jest.fn() }) },
    commandProcessor: { dispatchAction: jest.fn() },
    commandOutcomeInterpreter: { interpret: jest.fn() },
    commandString: 'valid command',
    turnAction: { actionDefinitionId: 'valid', commandString: 'valid command' },
    directiveResolver: new TurnDirectiveStrategyResolver(DEFAULT_STRATEGY_MAP),
  };

  describe('_throwConstructionError', () => {
    test('should log error and throw with correct message format', () => {
      const mockLogger = { debug: jest.fn(), error: jest.fn() };
      const mockHandler = { getLogger: () => mockLogger };

      // Create a partial state to test _throwConstructionError
      const state = Object.create(ProcessingCommandState.prototype);
      state._handler = mockHandler;
      state.getStateName = () => 'ProcessingCommandState';

      expect(() => {
        state._throwConstructionError('test error message');
      }).toThrow('ProcessingCommandState Constructor: test error message');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'ProcessingCommandState Constructor: test error message'
      );
    });
  });

  describe('_validateDependencies', () => {
    test('should throw error when commandProcessor is null', () => {
      const deps = { ...validDeps, commandProcessor: null };

      expect(() => {
        new ProcessingCommandState(deps);
      }).toThrow(
        'ProcessingCommandState Constructor: commandProcessor is required'
      );
    });

    test('should throw error when commandProcessor is undefined', () => {
      const deps = { ...validDeps, commandProcessor: undefined };

      expect(() => {
        new ProcessingCommandState(deps);
      }).toThrow(
        'ProcessingCommandState Constructor: commandProcessor is required'
      );
    });

    test('should throw error when commandOutcomeInterpreter is null', () => {
      const deps = { ...validDeps, commandOutcomeInterpreter: null };

      expect(() => {
        new ProcessingCommandState(deps);
      }).toThrow(
        'ProcessingCommandState Constructor: commandOutcomeInterpreter is required'
      );
    });

    test('should throw error when commandOutcomeInterpreter is undefined', () => {
      const deps = { ...validDeps, commandOutcomeInterpreter: undefined };

      expect(() => {
        new ProcessingCommandState(deps);
      }).toThrow(
        'ProcessingCommandState Constructor: commandOutcomeInterpreter is required'
      );
    });

    test('should throw error when commandString is invalid', () => {
      const deps = { ...validDeps, commandString: '' };

      expect(() => {
        new ProcessingCommandState(deps);
      }).toThrow('ProcessingCommandState Constructor:');
    });

    test('should throw error when commandString is null', () => {
      const deps = { ...validDeps, commandString: null };

      expect(() => {
        new ProcessingCommandState(deps);
      }).toThrow('ProcessingCommandState Constructor:');
    });

    test('should throw error when turnAction is invalid', () => {
      const deps = { ...validDeps, turnAction: {} };

      expect(() => {
        new ProcessingCommandState(deps);
      }).toThrow('ProcessingCommandState Constructor:');
    });

    test('should allow null turnAction', () => {
      const deps = { ...validDeps, turnAction: null };

      expect(() => {
        new ProcessingCommandState(deps);
      }).not.toThrow();
    });

    test('should throw error when directiveResolver is explicitly null', () => {
      const deps = { ...validDeps, directiveResolver: null };

      expect(() => {
        new ProcessingCommandState(deps);
      }).toThrow(
        'ProcessingCommandState Constructor: directiveResolver is required'
      );
    });

    test('should use default directiveResolver when undefined is passed', () => {
      const deps = { ...validDeps, directiveResolver: undefined };

      expect(() => {
        new ProcessingCommandState(deps);
      }).not.toThrow();
    });

    test('should pass validation with all valid dependencies', () => {
      expect(() => {
        new ProcessingCommandState(validDeps);
      }).not.toThrow();
    });
  });
});
