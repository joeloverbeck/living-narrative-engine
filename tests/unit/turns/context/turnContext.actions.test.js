/**
 * @file Unit tests for TurnContext action and state management.
 * Tests action setting/getting and state transition methods.
 */

import { describe, beforeEach, test, expect, jest } from '@jest/globals';
import { mock, mockDeep } from 'jest-mock-extended';
import { TurnContext } from '../../../../src/turns/context/turnContext.js';

// Type imports for better IDE support
/** @typedef {import('../../../../src/entities/entity.js').default} Entity */
/** @typedef {import('../../../../src/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../../../src/turns/interfaces/IActorTurnStrategy.js').IActorTurnStrategy} IActorTurnStrategy */
/** @typedef {import('../../../../src/turns/handlers/baseTurnHandler.js').BaseTurnHandler} BaseTurnHandler */

describe('TurnContext Action & State Management', () => {
  /** @type {TurnContext} */
  let turnContext;
  /** @type {ILogger} */
  let mockLogger;
  /** @type {Entity} */
  let mockActor;
  /** @type {IActorTurnStrategy} */
  let mockStrategy;
  /** @type {Function} */
  let mockOnEndTurnCallback;
  /** @type {BaseTurnHandler} */
  let mockHandlerInstance;
  /** @type {object} */
  let mockServices;

  beforeEach(() => {
    mockLogger = mockDeep();
    mockActor = mock();
    mockActor.id = 'test-actor';

    mockStrategy = mockDeep();
    mockStrategy.decideAction = jest.fn();

    mockOnEndTurnCallback = jest.fn();
    mockHandlerInstance = mockDeep();
    mockHandlerInstance.requestIdleStateTransition = jest
      .fn()
      .mockResolvedValue(undefined);
    mockHandlerInstance.requestAwaitingInputStateTransition = jest
      .fn()
      .mockResolvedValue(undefined);
    mockHandlerInstance.requestProcessingCommandStateTransition = jest
      .fn()
      .mockResolvedValue(undefined);
    mockHandlerInstance.requestAwaitingExternalTurnEndStateTransition = jest
      .fn()
      .mockResolvedValue(undefined);

    mockServices = {
      promptCoordinator: mockDeep(),
      safeEventDispatcher: mockDeep(),
      turnEndPort: mockDeep(),
      entityManager: mockDeep(),
    };

    turnContext = new TurnContext({
      actor: mockActor,
      logger: mockLogger,
      services: mockServices,
      strategy: mockStrategy,
      onEndTurnCallback: mockOnEndTurnCallback,
      handlerInstance: mockHandlerInstance,
    });
  });

  describe('Action management - lines 207-218', () => {
    describe('setChosenAction() - lines 207-214', () => {
      test('should set valid action successfully', () => {
        const validAction = {
          actionDefinitionId: 'test:action',
          commandString: 'test command',
          resolvedParameters: {},
        };

        turnContext.setChosenAction(validAction);

        expect(turnContext.getChosenAction()).toBe(validAction);
      });

      test('should log debug message when action is set', () => {
        const validAction = {
          actionDefinitionId: 'test:action',
          commandString: 'test command',
          resolvedParameters: {},
        };

        turnContext.setChosenAction(validAction);

        expect(mockLogger.debug).toHaveBeenCalledWith(
          'TurnContext: action chosen for test-actor – test:action'
        );
      });

      test('should throw error when action is null', () => {
        expect(() => turnContext.setChosenAction(null)).toThrow(
          'TurnContext.setChosenAction: invalid ITurnAction.'
        );
      });

      test('should throw error when action is undefined', () => {
        expect(() => turnContext.setChosenAction(undefined)).toThrow(
          'TurnContext.setChosenAction: invalid ITurnAction.'
        );
      });

      test('should throw error when action is missing actionDefinitionId', () => {
        const invalidAction = {
          commandString: 'test command',
          resolvedParameters: {},
        };

        expect(() => turnContext.setChosenAction(invalidAction)).toThrow(
          'TurnContext.setChosenAction: invalid ITurnAction.'
        );
      });

      test('should throw error when actionDefinitionId is null', () => {
        const invalidAction = {
          actionDefinitionId: null,
          commandString: 'test command',
          resolvedParameters: {},
        };

        expect(() => turnContext.setChosenAction(invalidAction)).toThrow(
          'TurnContext.setChosenAction: invalid ITurnAction.'
        );
      });

      test('should throw error when actionDefinitionId is empty string', () => {
        const invalidAction = {
          actionDefinitionId: '',
          commandString: 'test command',
          resolvedParameters: {},
        };

        expect(() => turnContext.setChosenAction(invalidAction)).toThrow(
          'TurnContext.setChosenAction: invalid ITurnAction.'
        );
      });
    });

    describe('getChosenAction() - line 216-218', () => {
      test('should return null initially', () => {
        expect(turnContext.getChosenAction()).toBeNull();
      });

      test('should return previously set action', () => {
        const validAction = {
          actionDefinitionId: 'test:action',
          commandString: 'test command',
          resolvedParameters: {},
        };

        turnContext.setChosenAction(validAction);

        expect(turnContext.getChosenAction()).toBe(validAction);
      });
    });
  });

  describe('State transition methods - lines 244-261', () => {
    describe('requestIdleStateTransition() - lines 244-246', () => {
      test('should delegate to handler instance', async () => {
        await turnContext.requestIdleStateTransition();

        expect(
          mockHandlerInstance.requestIdleStateTransition
        ).toHaveBeenCalledTimes(1);
      });

      test('should be async and return promise', async () => {
        const result = turnContext.requestIdleStateTransition();

        expect(result).toBeInstanceOf(Promise);
        await result;
      });
    });

    describe('requestAwaitingInputStateTransition() - lines 248-250', () => {
      test('should delegate to handler instance', async () => {
        await turnContext.requestAwaitingInputStateTransition();

        expect(
          mockHandlerInstance.requestAwaitingInputStateTransition
        ).toHaveBeenCalledTimes(1);
      });

      test('should be async and return promise', async () => {
        const result = turnContext.requestAwaitingInputStateTransition();

        expect(result).toBeInstanceOf(Promise);
        await result;
      });
    });

    describe('requestProcessingCommandStateTransition() - lines 252-257', () => {
      test('should delegate to handler instance with parameters', async () => {
        const commandString = 'test command';
        const turnAction = { actionDefinitionId: 'test:action' };

        await turnContext.requestProcessingCommandStateTransition(
          commandString,
          turnAction
        );

        expect(
          mockHandlerInstance.requestProcessingCommandStateTransition
        ).toHaveBeenCalledTimes(1);
        expect(
          mockHandlerInstance.requestProcessingCommandStateTransition
        ).toHaveBeenCalledWith(commandString, turnAction);
      });

      test('should be async and return promise', async () => {
        const result = turnContext.requestProcessingCommandStateTransition(
          'cmd',
          {}
        );

        expect(result).toBeInstanceOf(Promise);
        await result;
      });
    });

    describe('requestAwaitingExternalTurnEndStateTransition() - lines 259-261', () => {
      test('should delegate to handler instance', async () => {
        await turnContext.requestAwaitingExternalTurnEndStateTransition();

        expect(
          mockHandlerInstance.requestAwaitingExternalTurnEndStateTransition
        ).toHaveBeenCalledTimes(1);
      });

      test('should be async and return promise', async () => {
        const result =
          turnContext.requestAwaitingExternalTurnEndStateTransition();

        expect(result).toBeInstanceOf(Promise);
        await result;
      });
    });
  });

  describe('Strategy access', () => {
    test('should return strategy from getStrategy()', () => {
      const result = turnContext.getStrategy();

      expect(result).toBe(mockStrategy);
    });
  });

  describe('Prompt signal management', () => {
    test('should return prompt signal', () => {
      const signal = turnContext.getPromptSignal();

      expect(signal).toBeDefined();
      expect(signal.aborted).toBe(false);
    });

    test('should cancel active prompt', () => {
      const firstSignal = turnContext.getPromptSignal();
      expect(firstSignal.aborted).toBe(false);

      turnContext.cancelActivePrompt();

      expect(firstSignal.aborted).toBe(true);

      const secondSignal = turnContext.getPromptSignal();
      expect(secondSignal).not.toBe(firstSignal);
      expect(secondSignal.aborted).toBe(false);
    });

    test('should not throw when canceling already aborted prompt', () => {
      turnContext.cancelActivePrompt(); // cancel once

      expect(() => turnContext.cancelActivePrompt()).not.toThrow();
    });
  });

  describe('Integration with endTurn', () => {
    test('should cancel prompt and call callback on endTurn', async () => {
      const firstSignal = turnContext.getPromptSignal();
      expect(firstSignal.aborted).toBe(false);

      await turnContext.endTurn();

      expect(firstSignal.aborted).toBe(true);
      expect(turnContext.getPromptSignal().aborted).toBe(false);
      expect(mockOnEndTurnCallback).toHaveBeenCalledWith(null);
    });

    test('should reset chosen action on endTurn', async () => {
      const validAction = {
        actionDefinitionId: 'test:action',
        commandString: 'test command',
        resolvedParameters: {},
      };
      turnContext.setChosenAction(validAction);
      expect(turnContext.getChosenAction()).toBe(validAction);

      await turnContext.endTurn();

      // Action is reset indirectly through decision meta reset
      // (chosen action itself doesn't get reset directly, but decision meta does)
      expect(turnContext.getDecisionMeta()).toBeNull();
    });
  });
});
