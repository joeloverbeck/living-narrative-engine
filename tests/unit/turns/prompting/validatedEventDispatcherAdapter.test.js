/**
 * @file Unit tests for ValidatedEventDispatcherAdapter
 * @see src/turns/prompting/validatedEventDispatcherAdapter.js
 */

import { jest, describe, beforeEach, it, expect } from '@jest/globals';
import ValidatedEventDispatcherAdapter from '../../../../src/turns/prompting/validatedEventDispatcherAdapter.js';
import { IPlayerTurnEvents } from '../../../../src/turns/interfaces/IPlayerTurnEvents.js';
import { createSimpleMock } from '../../../common/mockFactories/coreServices.js';

describe('ValidatedEventDispatcherAdapter', () => {
  let mockValidatedEventDispatcher;
  let mockUnsubscribeFn;

  beforeEach(() => {
    mockUnsubscribeFn = jest.fn();
    mockValidatedEventDispatcher = createSimpleMock(['subscribe'], {
      subscribe: jest.fn().mockReturnValue(mockUnsubscribeFn),
    });
  });

  describe('Constructor', () => {
    it('should create instance successfully with valid validatedEventDispatcher dependency', () => {
      const adapter = new ValidatedEventDispatcherAdapter({
        validatedEventDispatcher: mockValidatedEventDispatcher,
      });

      expect(adapter).toBeInstanceOf(ValidatedEventDispatcherAdapter);
      expect(adapter).toBeInstanceOf(IPlayerTurnEvents);
    });

    it('should throw error when validatedEventDispatcher is null', () => {
      expect(() => {
        new ValidatedEventDispatcherAdapter({
          validatedEventDispatcher: null,
        });
      }).toThrow(
        'ValidatedEventDispatcherAdapter: Missing or invalid validatedEventDispatcher dependency.'
      );
    });

    it('should throw error when validatedEventDispatcher is undefined', () => {
      expect(() => {
        new ValidatedEventDispatcherAdapter({
          validatedEventDispatcher: undefined,
        });
      }).toThrow(
        'ValidatedEventDispatcherAdapter: Missing or invalid validatedEventDispatcher dependency.'
      );
    });

    it('should throw error when validatedEventDispatcher is missing subscribe method', () => {
      const invalidDispatcher = {};

      expect(() => {
        new ValidatedEventDispatcherAdapter({
          validatedEventDispatcher: invalidDispatcher,
        });
      }).toThrow(
        'ValidatedEventDispatcherAdapter: Missing or invalid validatedEventDispatcher dependency.'
      );
    });

    it('should throw error when validatedEventDispatcher.subscribe is not a function', () => {
      const invalidDispatcher = { subscribe: 'not-a-function' };

      expect(() => {
        new ValidatedEventDispatcherAdapter({
          validatedEventDispatcher: invalidDispatcher,
        });
      }).toThrow(
        'ValidatedEventDispatcherAdapter: Missing or invalid validatedEventDispatcher dependency.'
      );
    });

    it('should accept validatedEventDispatcher with subscribe method', () => {
      const validDispatcher = { subscribe: jest.fn() };

      expect(() => {
        new ValidatedEventDispatcherAdapter({
          validatedEventDispatcher: validDispatcher,
        });
      }).not.toThrow();
    });
  });

  describe('subscribe method', () => {
    let adapter;

    beforeEach(() => {
      adapter = new ValidatedEventDispatcherAdapter({
        validatedEventDispatcher: mockValidatedEventDispatcher,
      });
    });

    it('should delegate subscribe call to underlying validatedEventDispatcher', () => {
      const eventId = 'test-event';
      const handler = jest.fn();

      adapter.subscribe(eventId, handler);

      expect(mockValidatedEventDispatcher.subscribe).toHaveBeenCalledWith(
        eventId,
        handler
      );
      expect(mockValidatedEventDispatcher.subscribe).toHaveBeenCalledTimes(1);
    });

    it('should return the unsubscribe function from underlying dispatcher', () => {
      const eventId = 'test-event';
      const handler = jest.fn();

      const result = adapter.subscribe(eventId, handler);

      expect(result).toBe(mockUnsubscribeFn);
    });

    it('should handle multiple subscriptions correctly', () => {
      const eventId1 = 'event-1';
      const eventId2 = 'event-2';
      const handler1 = jest.fn();
      const handler2 = jest.fn();

      const unsubscribe1 = adapter.subscribe(eventId1, handler1);
      const unsubscribe2 = adapter.subscribe(eventId2, handler2);

      expect(mockValidatedEventDispatcher.subscribe).toHaveBeenCalledTimes(2);
      expect(mockValidatedEventDispatcher.subscribe).toHaveBeenNthCalledWith(
        1,
        eventId1,
        handler1
      );
      expect(mockValidatedEventDispatcher.subscribe).toHaveBeenNthCalledWith(
        2,
        eventId2,
        handler2
      );
      expect(unsubscribe1).toBe(mockUnsubscribeFn);
      expect(unsubscribe2).toBe(mockUnsubscribeFn);
    });

    it('should pass through different event IDs correctly', () => {
      const handler = jest.fn();
      const eventIds = ['player:input', 'game:state-changed', 'turn:ended'];

      eventIds.forEach((eventId, index) => {
        adapter.subscribe(eventId, handler);
        expect(mockValidatedEventDispatcher.subscribe).toHaveBeenNthCalledWith(
          index + 1,
          eventId,
          handler
        );
      });
    });

    it('should pass through different handler functions correctly', () => {
      const eventId = 'test-event';
      const handler1 = jest.fn().mockName('handler1');
      const handler2 = jest.fn().mockName('handler2');
      const handler3 = jest.fn().mockName('handler3');

      adapter.subscribe(eventId, handler1);
      adapter.subscribe(eventId, handler2);
      adapter.subscribe(eventId, handler3);

      expect(mockValidatedEventDispatcher.subscribe).toHaveBeenCalledTimes(3);
      expect(mockValidatedEventDispatcher.subscribe).toHaveBeenNthCalledWith(
        1,
        eventId,
        handler1
      );
      expect(mockValidatedEventDispatcher.subscribe).toHaveBeenNthCalledWith(
        2,
        eventId,
        handler2
      );
      expect(mockValidatedEventDispatcher.subscribe).toHaveBeenNthCalledWith(
        3,
        eventId,
        handler3
      );
    });
  });

  describe('Interface Restriction', () => {
    let adapter;

    beforeEach(() => {
      adapter = new ValidatedEventDispatcherAdapter({
        validatedEventDispatcher: mockValidatedEventDispatcher,
      });
    });

    it('should only expose subscribe method, not dispatch or unsubscribe', () => {
      expect(typeof adapter.subscribe).toBe('function');
      expect(adapter.dispatch).toBeUndefined();
      expect(adapter.unsubscribe).toBeUndefined();
    });

    it('should inherit from IPlayerTurnEvents interface', () => {
      expect(adapter).toBeInstanceOf(IPlayerTurnEvents);
    });
  });

  describe('Realistic Usage Scenarios', () => {
    let adapter;

    beforeEach(() => {
      adapter = new ValidatedEventDispatcherAdapter({
        validatedEventDispatcher: mockValidatedEventDispatcher,
      });
    });

    it('should work in PromptCoordinator-like scenario', () => {
      // Simulate how PromptCoordinator uses this adapter
      const eventBus = adapter; // This is how it's used in PromptSession
      const mockHandler = jest.fn();

      // Subscribe to player input events
      const unsubscribe = eventBus.subscribe('player:input', mockHandler);

      expect(mockValidatedEventDispatcher.subscribe).toHaveBeenCalledWith(
        'player:input',
        mockHandler
      );
      expect(typeof unsubscribe).toBe('function');
    });

    it('should handle error conditions from underlying dispatcher gracefully', () => {
      const errorDispatcher = {
        subscribe: jest.fn().mockImplementation(() => {
          throw new Error('Subscription failed');
        }),
      };

      const adapter = new ValidatedEventDispatcherAdapter({
        validatedEventDispatcher: errorDispatcher,
      });

      expect(() => {
        adapter.subscribe('test-event', jest.fn());
      }).toThrow('Subscription failed');
    });

    it('should handle null return value from underlying dispatcher', () => {
      const nullReturningDispatcher = {
        subscribe: jest.fn().mockReturnValue(null),
      };

      const adapter = new ValidatedEventDispatcherAdapter({
        validatedEventDispatcher: nullReturningDispatcher,
      });

      const result = adapter.subscribe('test-event', jest.fn());
      expect(result).toBeNull();
    });
  });
});
