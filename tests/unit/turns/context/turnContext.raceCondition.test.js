/**
 * @file Unit tests for TurnContext race condition management methods.
 * Tests pending turn end event and early listener unsubscribe management (lines 220-274).
 */

import { describe, beforeEach, test, expect, jest } from '@jest/globals';
import { mock, mockDeep } from 'jest-mock-extended';
import { TurnContext } from '../../../../src/turns/context/turnContext.js';

/** @typedef {import('../../../../src/entities/entity.js').default} Entity */
/** @typedef {import('../../../../src/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../../../src/turns/interfaces/IActorTurnStrategy.js').IActorTurnStrategy} IActorTurnStrategy */
/** @typedef {import('../../../../src/turns/handlers/baseTurnHandler.js').BaseTurnHandler} BaseTurnHandler */

describe('TurnContext Race Condition Management', () => {
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

  describe('Pending Turn End Event Management - lines 219-240', () => {
    describe('setPendingTurnEndEvent() - lines 219-224', () => {
      test('should store the event', () => {
        const event = { type: 'turn_ended', payload: { actorId: 'test-actor' } };

        turnContext.setPendingTurnEndEvent(event);

        expect(turnContext.consumePendingTurnEndEvent()).toBe(event);
      });

      test('should log debug message with actor ID', () => {
        const event = { type: 'turn_ended', payload: { actorId: 'test-actor' } };

        turnContext.setPendingTurnEndEvent(event);

        expect(mockLogger.debug).toHaveBeenCalledWith(
          'TurnContext for test-actor: stored pending turn_ended event'
        );
      });

      test('should overwrite previous event when called again', () => {
        const firstEvent = { type: 'turn_ended', payload: { first: true } };
        const secondEvent = { type: 'turn_ended', payload: { second: true } };

        turnContext.setPendingTurnEndEvent(firstEvent);
        turnContext.setPendingTurnEndEvent(secondEvent);

        expect(turnContext.consumePendingTurnEndEvent()).toBe(secondEvent);
      });
    });

    describe('consumePendingTurnEndEvent() - lines 231-240', () => {
      test('should return null when no event was set', () => {
        const result = turnContext.consumePendingTurnEndEvent();

        expect(result).toBeNull();
      });

      test('should return the stored event when one was set', () => {
        const event = { type: 'turn_ended', payload: { actorId: 'test-actor' } };
        turnContext.setPendingTurnEndEvent(event);

        const result = turnContext.consumePendingTurnEndEvent();

        expect(result).toBe(event);
      });

      test('should clear the event after consuming', () => {
        const event = { type: 'turn_ended', payload: { actorId: 'test-actor' } };
        turnContext.setPendingTurnEndEvent(event);

        turnContext.consumePendingTurnEndEvent();
        const secondResult = turnContext.consumePendingTurnEndEvent();

        expect(secondResult).toBeNull();
      });

      test('should log when event was present', () => {
        const event = { type: 'turn_ended', payload: { actorId: 'test-actor' } };
        turnContext.setPendingTurnEndEvent(event);
        mockLogger.debug.mockClear();

        turnContext.consumePendingTurnEndEvent();

        expect(mockLogger.debug).toHaveBeenCalledWith(
          'TurnContext for test-actor: consumed pending turn_ended event'
        );
      });

      test('should NOT log when returning null', () => {
        mockLogger.debug.mockClear();

        turnContext.consumePendingTurnEndEvent();

        expect(mockLogger.debug).not.toHaveBeenCalled();
      });
    });
  });

  describe('Early Listener Unsubscribe Management - lines 251-275', () => {
    describe('setEarlyListenerUnsubscribe() - lines 251-258', () => {
      test('should store the unsubscribe function', () => {
        const unsubscribe = jest.fn();

        turnContext.setEarlyListenerUnsubscribe(unsubscribe);

        expect(turnContext.consumeEarlyListenerUnsubscribe()).toBe(unsubscribe);
      });

      test('should log debug message when function is provided', () => {
        const unsubscribe = jest.fn();

        turnContext.setEarlyListenerUnsubscribe(unsubscribe);

        expect(mockLogger.debug).toHaveBeenCalledWith(
          'TurnContext for test-actor: stored early listener unsubscribe function'
        );
      });

      test('should NOT log when null is provided', () => {
        mockLogger.debug.mockClear();

        turnContext.setEarlyListenerUnsubscribe(null);

        expect(mockLogger.debug).not.toHaveBeenCalled();
      });

      test('should allow overwriting with null', () => {
        const unsubscribe = jest.fn();
        turnContext.setEarlyListenerUnsubscribe(unsubscribe);

        turnContext.setEarlyListenerUnsubscribe(null);

        expect(turnContext.consumeEarlyListenerUnsubscribe()).toBeNull();
      });
    });

    describe('consumeEarlyListenerUnsubscribe() - lines 266-275', () => {
      test('should return null when no function was set', () => {
        const result = turnContext.consumeEarlyListenerUnsubscribe();

        expect(result).toBeNull();
      });

      test('should return the stored function when one was set', () => {
        const unsubscribe = jest.fn();
        turnContext.setEarlyListenerUnsubscribe(unsubscribe);

        const result = turnContext.consumeEarlyListenerUnsubscribe();

        expect(result).toBe(unsubscribe);
      });

      test('should clear the function after consuming', () => {
        const unsubscribe = jest.fn();
        turnContext.setEarlyListenerUnsubscribe(unsubscribe);

        turnContext.consumeEarlyListenerUnsubscribe();
        const secondResult = turnContext.consumeEarlyListenerUnsubscribe();

        expect(secondResult).toBeNull();
      });

      test('should log when function was present', () => {
        const unsubscribe = jest.fn();
        turnContext.setEarlyListenerUnsubscribe(unsubscribe);
        mockLogger.debug.mockClear();

        turnContext.consumeEarlyListenerUnsubscribe();

        expect(mockLogger.debug).toHaveBeenCalledWith(
          'TurnContext for test-actor: consumed early listener unsubscribe function'
        );
      });

      test('should NOT log when returning null', () => {
        mockLogger.debug.mockClear();

        turnContext.consumeEarlyListenerUnsubscribe();

        expect(mockLogger.debug).not.toHaveBeenCalled();
      });
    });
  });
});
