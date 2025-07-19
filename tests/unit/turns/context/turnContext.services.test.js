/**
 * @file Unit tests for TurnContext service access methods and error handling.
 * Tests service retrieval, #require() method error paths, and external event handling.
 */

import { describe, beforeEach, test, expect, jest } from '@jest/globals';
import { mock, mockDeep } from 'jest-mock-extended';
import { TurnContext } from '../../../../src/turns/context/turnContext.js';

// Type imports for better IDE support
/** @typedef {import('../../../../src/entities/entity.js').default} Entity */
/** @typedef {import('../../../../src/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../../../src/turns/interfaces/IActorTurnStrategy.js').IActorTurnStrategy} IActorTurnStrategy */
/** @typedef {import('../../../../src/turns/handlers/baseTurnHandler.js').BaseTurnHandler} BaseTurnHandler */

describe('TurnContext Service Access & Error Handling', () => {
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

    mockServices = {
      promptCoordinator: mockDeep(),
      safeEventDispatcher: mockDeep(),
      turnEndPort: mockDeep(),
      entityManager: mockDeep(),
    };
  });

  /**
   *
   * @param services
   */
  function createTurnContext(services = mockServices) {
    return new TurnContext({
      actor: mockActor,
      logger: mockLogger,
      services: services,
      strategy: mockStrategy,
      onEndTurnCallback: mockOnEndTurnCallback,
      handlerInstance: mockHandlerInstance,
    });
  }

  describe('Service retrieval methods', () => {
    describe('getPlayerPromptService() - line 137', () => {
      test('should return promptCoordinator when available', () => {
        turnContext = createTurnContext();

        const result = turnContext.getPlayerPromptService();

        expect(result).toBe(mockServices.promptCoordinator);
      });

      test('should throw error when promptCoordinator is missing', () => {
        const servicesWithoutPrompt = { ...mockServices };
        delete servicesWithoutPrompt.promptCoordinator;
        turnContext = createTurnContext(servicesWithoutPrompt);

        expect(() => turnContext.getPlayerPromptService()).toThrow(
          'TurnContext: PlayerPromptService not available in services bag.'
        );
      });

      test('should log error when promptCoordinator is missing', () => {
        const servicesWithoutPrompt = { ...mockServices };
        delete servicesWithoutPrompt.promptCoordinator;
        turnContext = createTurnContext(servicesWithoutPrompt);

        expect(() => turnContext.getPlayerPromptService()).toThrow();
        expect(mockLogger.error).toHaveBeenCalledWith(
          'TurnContext: PlayerPromptService not available in services bag.'
        );
      });
    });

    describe('getSafeEventDispatcher()', () => {
      test('should return safeEventDispatcher when available', () => {
        turnContext = createTurnContext();

        const result = turnContext.getSafeEventDispatcher();

        expect(result).toBe(mockServices.safeEventDispatcher);
      });

      test('should throw error when safeEventDispatcher is missing', () => {
        const servicesWithoutDispatcher = { ...mockServices };
        delete servicesWithoutDispatcher.safeEventDispatcher;
        turnContext = createTurnContext(servicesWithoutDispatcher);

        expect(() => turnContext.getSafeEventDispatcher()).toThrow(
          'TurnContext: SafeEventDispatcher not available in services bag.'
        );
      });

      test('should log error when safeEventDispatcher is missing', () => {
        const servicesWithoutDispatcher = { ...mockServices };
        delete servicesWithoutDispatcher.safeEventDispatcher;
        turnContext = createTurnContext(servicesWithoutDispatcher);

        expect(() => turnContext.getSafeEventDispatcher()).toThrow();
        expect(mockLogger.error).toHaveBeenCalledWith(
          'TurnContext: SafeEventDispatcher not available in services bag.'
        );
      });
    });

    describe('getTurnEndPort()', () => {
      test('should return turnEndPort when available', () => {
        turnContext = createTurnContext();

        const result = turnContext.getTurnEndPort();

        expect(result).toBe(mockServices.turnEndPort);
      });

      test('should throw error when turnEndPort is missing', () => {
        const servicesWithoutPort = { ...mockServices };
        delete servicesWithoutPort.turnEndPort;
        turnContext = createTurnContext(servicesWithoutPort);

        expect(() => turnContext.getTurnEndPort()).toThrow(
          'TurnContext: TurnEndPort not available in services bag.'
        );
      });

      test('should log error when turnEndPort is missing', () => {
        const servicesWithoutPort = { ...mockServices };
        delete servicesWithoutPort.turnEndPort;
        turnContext = createTurnContext(servicesWithoutPort);

        expect(() => turnContext.getTurnEndPort()).toThrow();
        expect(mockLogger.error).toHaveBeenCalledWith(
          'TurnContext: TurnEndPort not available in services bag.'
        );
      });
    });
  });

  describe('#require() internal method error handling - lines 275-277', () => {
    test('should throw and log error for missing service', () => {
      const servicesWithoutPrompt = {};
      turnContext = createTurnContext(servicesWithoutPrompt);

      expect(() => turnContext.getPlayerPromptService()).toThrow(
        'TurnContext: PlayerPromptService not available in services bag.'
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        'TurnContext: PlayerPromptService not available in services bag.'
      );
    });

    test('should throw and log error for null service', () => {
      const servicesWithNullPrompt = { promptCoordinator: null };
      turnContext = createTurnContext(servicesWithNullPrompt);

      expect(() => turnContext.getPlayerPromptService()).toThrow(
        'TurnContext: PlayerPromptService not available in services bag.'
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        'TurnContext: PlayerPromptService not available in services bag.'
      );
    });

    test('should throw and log error for undefined service', () => {
      const servicesWithUndefinedPrompt = { promptCoordinator: undefined };
      turnContext = createTurnContext(servicesWithUndefinedPrompt);

      expect(() => turnContext.getPlayerPromptService()).toThrow(
        'TurnContext: PlayerPromptService not available in services bag.'
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        'TurnContext: PlayerPromptService not available in services bag.'
      );
    });
  });

  describe('External event handling - lines 168-196', () => {
    describe('isAwaitingExternalEvent()', () => {
      test('should return false by default when no provider is set', () => {
        turnContext = createTurnContext();

        const result = turnContext.isAwaitingExternalEvent();

        expect(result).toBe(false);
      });

      test('should return provider result when provider is set', () => {
        const mockProvider = jest.fn().mockReturnValue(true);
        turnContext = new TurnContext({
          actor: mockActor,
          logger: mockLogger,
          services: mockServices,
          strategy: mockStrategy,
          onEndTurnCallback: mockOnEndTurnCallback,
          handlerInstance: mockHandlerInstance,
          isAwaitingExternalEventProvider: mockProvider,
        });

        const result = turnContext.isAwaitingExternalEvent();

        expect(result).toBe(true);
        expect(mockProvider).toHaveBeenCalledTimes(1);
      });

      test('should handle provider error and fall back to internal flag - lines 172-177', () => {
        const mockProvider = jest.fn().mockImplementation(() => {
          throw new Error('Provider error');
        });
        turnContext = new TurnContext({
          actor: mockActor,
          logger: mockLogger,
          services: mockServices,
          strategy: mockStrategy,
          onEndTurnCallback: mockOnEndTurnCallback,
          handlerInstance: mockHandlerInstance,
          isAwaitingExternalEventProvider: mockProvider,
        });

        const result = turnContext.isAwaitingExternalEvent();

        expect(result).toBe(false); // falls back to internal flag
        expect(mockLogger.warn).toHaveBeenCalledWith(
          'TurnContext.isAwaitingExternalEvent: provider error – Provider error',
          expect.any(Error)
        );
      });

      test('should return internal flag value when provider throws', () => {
        const mockProvider = jest.fn().mockImplementation(() => {
          throw new Error('Provider error');
        });
        turnContext = new TurnContext({
          actor: mockActor,
          logger: mockLogger,
          services: mockServices,
          strategy: mockStrategy,
          onEndTurnCallback: mockOnEndTurnCallback,
          handlerInstance: mockHandlerInstance,
          isAwaitingExternalEventProvider: mockProvider,
        });

        // Set internal flag to true first
        turnContext.setAwaitingExternalEvent(true);

        const result = turnContext.isAwaitingExternalEvent();

        expect(result).toBe(true); // should return internal flag value
      });
    });

    describe('setAwaitingExternalEvent() - lines 181-199', () => {
      test('should set internal flag to true', () => {
        turnContext = createTurnContext();

        turnContext.setAwaitingExternalEvent(true);

        expect(turnContext.isAwaitingExternalEvent()).toBe(true);
      });

      test('should set internal flag to false', () => {
        turnContext = createTurnContext();
        turnContext.setAwaitingExternalEvent(true); // set to true first

        turnContext.setAwaitingExternalEvent(false);

        expect(turnContext.isAwaitingExternalEvent()).toBe(false);
      });

      test('should coerce truthy values to true', () => {
        turnContext = createTurnContext();

        turnContext.setAwaitingExternalEvent('truthy string');

        expect(turnContext.isAwaitingExternalEvent()).toBe(true);
      });

      test('should coerce falsy values to false', () => {
        turnContext = createTurnContext();
        turnContext.setAwaitingExternalEvent(true); // set to true first

        turnContext.setAwaitingExternalEvent(0);

        expect(turnContext.isAwaitingExternalEvent()).toBe(false);
      });

      test('should call callback when provided', () => {
        const mockCallback = jest.fn();
        turnContext = new TurnContext({
          actor: mockActor,
          logger: mockLogger,
          services: mockServices,
          strategy: mockStrategy,
          onEndTurnCallback: mockOnEndTurnCallback,
          handlerInstance: mockHandlerInstance,
          onSetAwaitingExternalEventCallback: mockCallback,
        });

        turnContext.setAwaitingExternalEvent(true, 'test-actor-id');

        expect(mockCallback).toHaveBeenCalledWith(true, 'test-actor-id');
      });

      test('should handle callback error - lines 189-194', () => {
        const mockCallback = jest.fn().mockImplementation(() => {
          throw new Error('Callback error');
        });
        turnContext = new TurnContext({
          actor: mockActor,
          logger: mockLogger,
          services: mockServices,
          strategy: mockStrategy,
          onEndTurnCallback: mockOnEndTurnCallback,
          handlerInstance: mockHandlerInstance,
          onSetAwaitingExternalEventCallback: mockCallback,
        });

        turnContext.setAwaitingExternalEvent(true, 'test-actor-id');

        expect(mockLogger.error).toHaveBeenCalledWith(
          'TurnContext.setAwaitingExternalEvent: callback error – Callback error',
          expect.any(Error)
        );
      });

      test('should log debug message', () => {
        turnContext = createTurnContext();

        turnContext.setAwaitingExternalEvent(true);

        expect(mockLogger.debug).toHaveBeenCalledWith(
          'TurnContext for test-actor awaitingExternalEvent → true'
        );
      });

      test('should work without callback', () => {
        turnContext = createTurnContext();

        expect(() => turnContext.setAwaitingExternalEvent(true)).not.toThrow();
        expect(turnContext.isAwaitingExternalEvent()).toBe(true);
      });
    });
  });
});
