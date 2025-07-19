/**
 * @file Unit tests for TurnContext constructor validation.
 * Tests all constructor parameter validation and error paths.
 */

import { describe, beforeEach, test, expect, jest } from '@jest/globals';
import { mock, mockDeep } from 'jest-mock-extended';
import { TurnContext } from '../../../../src/turns/context/turnContext.js';

// Type imports for better IDE support
/** @typedef {import('../../../../src/entities/entity.js').default} Entity */
/** @typedef {import('../../../../src/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../../../src/turns/interfaces/IActorTurnStrategy.js').IActorTurnStrategy} IActorTurnStrategy */
/** @typedef {import('../../../../src/turns/handlers/baseTurnHandler.js').BaseTurnHandler} BaseTurnHandler */

describe('TurnContext Constructor Validation', () => {
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
  let validServices;

  /** @type {object} */
  let baseConstructorArgs;

  beforeEach(() => {
    mockLogger = mockDeep();
    mockActor = mock();
    mockActor.id = 'test-actor';

    mockStrategy = mockDeep();
    mockStrategy.decideAction = jest.fn();

    mockOnEndTurnCallback = jest.fn();
    mockHandlerInstance = mockDeep();

    validServices = {
      entityManager: mockDeep(),
      promptCoordinator: mockDeep(),
      safeEventDispatcher: mockDeep(),
      turnEndPort: mockDeep(),
    };

    baseConstructorArgs = {
      actor: mockActor,
      logger: mockLogger,
      services: validServices,
      strategy: mockStrategy,
      onEndTurnCallback: mockOnEndTurnCallback,
      handlerInstance: mockHandlerInstance,
    };
  });

  describe('Required parameter validation', () => {
    test('should throw error when actor is missing', () => {
      const args = { ...baseConstructorArgs };
      delete args.actor;

      expect(() => new TurnContext(args)).toThrow(
        'TurnContext: actor is required.'
      );
    });

    test('should throw error when actor is null', () => {
      const args = { ...baseConstructorArgs, actor: null };

      expect(() => new TurnContext(args)).toThrow(
        'TurnContext: actor is required.'
      );
    });

    test('should throw error when actor is undefined', () => {
      const args = { ...baseConstructorArgs, actor: undefined };

      expect(() => new TurnContext(args)).toThrow(
        'TurnContext: actor is required.'
      );
    });

    test('should throw error when logger is missing', () => {
      const args = { ...baseConstructorArgs };
      delete args.logger;

      expect(() => new TurnContext(args)).toThrow(
        'TurnContext: logger is required.'
      );
    });

    test('should throw error when logger is null', () => {
      const args = { ...baseConstructorArgs, logger: null };

      expect(() => new TurnContext(args)).toThrow(
        'TurnContext: logger is required.'
      );
    });

    test('should throw error when services is missing', () => {
      const args = { ...baseConstructorArgs };
      delete args.services;

      expect(() => new TurnContext(args)).toThrow(
        'TurnContext: services bag required.'
      );
    });

    test('should throw error when services is null', () => {
      const args = { ...baseConstructorArgs, services: null };

      expect(() => new TurnContext(args)).toThrow(
        'TurnContext: services bag required.'
      );
    });
  });

  describe('Strategy validation (line 82-83)', () => {
    test('should throw error when strategy is missing', () => {
      const args = { ...baseConstructorArgs };
      delete args.strategy;

      expect(() => new TurnContext(args)).toThrow(
        'TurnContext: valid IActorTurnStrategy required.'
      );
    });

    test('should throw error when strategy is null', () => {
      const args = { ...baseConstructorArgs, strategy: null };

      expect(() => new TurnContext(args)).toThrow(
        'TurnContext: valid IActorTurnStrategy required.'
      );
    });

    test('should throw error when strategy is missing decideAction method', () => {
      const invalidStrategy = { someOtherMethod: jest.fn() };
      const args = { ...baseConstructorArgs, strategy: invalidStrategy };

      expect(() => new TurnContext(args)).toThrow(
        'TurnContext: valid IActorTurnStrategy required.'
      );
    });

    test('should throw error when strategy.decideAction is not a function', () => {
      const invalidStrategy = { decideAction: 'not-a-function' };
      const args = { ...baseConstructorArgs, strategy: invalidStrategy };

      expect(() => new TurnContext(args)).toThrow(
        'TurnContext: valid IActorTurnStrategy required.'
      );
    });

    test('should accept valid strategy with decideAction method', () => {
      expect(() => new TurnContext(baseConstructorArgs)).not.toThrow();
    });
  });

  describe('OnEndTurnCallback validation (line 84-85)', () => {
    test('should throw error when onEndTurnCallback is missing', () => {
      const args = { ...baseConstructorArgs };
      delete args.onEndTurnCallback;

      expect(() => new TurnContext(args)).toThrow(
        'TurnContext: onEndTurnCallback function required.'
      );
    });

    test('should throw error when onEndTurnCallback is null', () => {
      const args = { ...baseConstructorArgs, onEndTurnCallback: null };

      expect(() => new TurnContext(args)).toThrow(
        'TurnContext: onEndTurnCallback function required.'
      );
    });

    test('should throw error when onEndTurnCallback is not a function', () => {
      const args = {
        ...baseConstructorArgs,
        onEndTurnCallback: 'not-a-function',
      };

      expect(() => new TurnContext(args)).toThrow(
        'TurnContext: onEndTurnCallback function required.'
      );
    });

    test('should throw error when onEndTurnCallback is an object', () => {
      const args = { ...baseConstructorArgs, onEndTurnCallback: {} };

      expect(() => new TurnContext(args)).toThrow(
        'TurnContext: onEndTurnCallback function required.'
      );
    });

    test('should accept valid onEndTurnCallback function', () => {
      expect(() => new TurnContext(baseConstructorArgs)).not.toThrow();
    });
  });

  describe('HandlerInstance validation (line 86-89)', () => {
    test('should throw error when handlerInstance is missing', () => {
      const args = { ...baseConstructorArgs };
      delete args.handlerInstance;

      expect(() => new TurnContext(args)).toThrow(
        'TurnContext: handlerInstance (BaseTurnHandler) required.'
      );
    });

    test('should throw error when handlerInstance is null', () => {
      const args = { ...baseConstructorArgs, handlerInstance: null };

      expect(() => new TurnContext(args)).toThrow(
        'TurnContext: handlerInstance (BaseTurnHandler) required.'
      );
    });

    test('should throw error when handlerInstance is undefined', () => {
      const args = { ...baseConstructorArgs, handlerInstance: undefined };

      expect(() => new TurnContext(args)).toThrow(
        'TurnContext: handlerInstance (BaseTurnHandler) required.'
      );
    });

    test('should accept valid handlerInstance', () => {
      expect(() => new TurnContext(baseConstructorArgs)).not.toThrow();
    });
  });

  describe('Optional parameters', () => {
    test('should accept missing isAwaitingExternalEventProvider', () => {
      expect(() => new TurnContext(baseConstructorArgs)).not.toThrow();
    });

    test('should accept null isAwaitingExternalEventProvider', () => {
      const args = {
        ...baseConstructorArgs,
        isAwaitingExternalEventProvider: null,
      };
      expect(() => new TurnContext(args)).not.toThrow();
    });

    test('should accept missing onSetAwaitingExternalEventCallback', () => {
      expect(() => new TurnContext(baseConstructorArgs)).not.toThrow();
    });

    test('should accept null onSetAwaitingExternalEventCallback', () => {
      const args = {
        ...baseConstructorArgs,
        onSetAwaitingExternalEventCallback: null,
      };
      expect(() => new TurnContext(args)).not.toThrow();
    });
  });

  describe('Successful construction', () => {
    test('should construct successfully with all valid parameters', () => {
      const turnContext = new TurnContext(baseConstructorArgs);

      expect(turnContext).toBeInstanceOf(TurnContext);
      expect(turnContext.getActor()).toBe(mockActor);
      expect(turnContext.getLogger()).toBe(mockLogger);
      expect(turnContext.getStrategy()).toBe(mockStrategy);
    });

    test('should construct successfully with optional parameters provided', () => {
      const mockEventProvider = jest.fn();
      const mockEventCallback = jest.fn();

      const args = {
        ...baseConstructorArgs,
        isAwaitingExternalEventProvider: mockEventProvider,
        onSetAwaitingExternalEventCallback: mockEventCallback,
      };

      const turnContext = new TurnContext(args);

      expect(turnContext).toBeInstanceOf(TurnContext);
      expect(turnContext.getActor()).toBe(mockActor);
      expect(turnContext.getLogger()).toBe(mockLogger);
      expect(turnContext.getStrategy()).toBe(mockStrategy);
    });

    test('should initialize entityManager from services', () => {
      const turnContext = new TurnContext(baseConstructorArgs);

      expect(turnContext.entityManager).toBe(validServices.entityManager);
    });

    test('should set actingEntity alias to actor', () => {
      const turnContext = new TurnContext(baseConstructorArgs);

      expect(turnContext.actingEntity).toBe(mockActor);
    });

    test('should initialize promptAbortController', () => {
      const turnContext = new TurnContext(baseConstructorArgs);

      expect(turnContext.getPromptSignal()).toBeDefined();
      expect(turnContext.getPromptSignal().aborted).toBe(false);
    });
  });
});
