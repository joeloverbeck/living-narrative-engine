/**
 * @file Test suite for SafeEventDispatcher fail-fast parameter validation
 * @description Ensures SafeEventDispatcher.dispatch() throws immediately when called
 * with incorrect legacy object pattern instead of silently failing.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { SafeEventDispatcher } from '../../../src/events/safeEventDispatcher.js';

describe('SafeEventDispatcher - Fail-Fast Parameter Validation', () => {
  let mockLogger;
  let mockValidatedEventDispatcher;
  let safeDispatcher;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockValidatedEventDispatcher = {
      dispatch: jest.fn().mockResolvedValue(true),
      subscribe: jest.fn().mockReturnValue(() => {}),
      unsubscribe: jest.fn(),
    };

    safeDispatcher = new SafeEventDispatcher({
      validatedEventDispatcher: mockValidatedEventDispatcher,
      logger: mockLogger,
    });
  });

  describe('dispatch() - Incorrect Object Pattern Detection', () => {
    it('should throw when called with object containing "type" property', async () => {
      const incorrectCall = { type: 'SOME_EVENT' };

      await expect(safeDispatcher.dispatch(incorrectCall)).rejects.toThrow(
        'SafeEventDispatcher.dispatch() requires (eventName, payload) signature'
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Received object with "type" properties'),
        expect.objectContaining({ receivedObject: incorrectCall })
      );

      // Should NOT have called the underlying dispatcher
      expect(mockValidatedEventDispatcher.dispatch).not.toHaveBeenCalled();
    });

    it('should throw when called with object containing "type" and "payload" properties', async () => {
      const incorrectCall = { type: 'SOME_EVENT', payload: { data: 'test' } };

      await expect(safeDispatcher.dispatch(incorrectCall)).rejects.toThrow(
        'SafeEventDispatcher.dispatch() requires (eventName, payload) signature'
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Received object with "type" and "payload"'),
        expect.objectContaining({ receivedObject: incorrectCall })
      );

      expect(mockValidatedEventDispatcher.dispatch).not.toHaveBeenCalled();
    });

    it('should throw when called with object containing only "payload" property', async () => {
      const incorrectCall = { payload: { data: 'test' } };

      await expect(safeDispatcher.dispatch(incorrectCall)).rejects.toThrow(
        'SafeEventDispatcher.dispatch() requires (eventName, payload) signature'
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Received object with "payload" properties'),
        expect.objectContaining({ receivedObject: incorrectCall })
      );

      expect(mockValidatedEventDispatcher.dispatch).not.toHaveBeenCalled();
    });

    it('should throw when called with generic object as first parameter', async () => {
      const incorrectCall = { someOtherProperty: 'value' };

      await expect(safeDispatcher.dispatch(incorrectCall)).rejects.toThrow(
        'SafeEventDispatcher.dispatch() requires string eventName as first parameter'
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Received: object (object)')
      );

      expect(mockValidatedEventDispatcher.dispatch).not.toHaveBeenCalled();
    });

    it('should throw when called with empty object as first parameter', async () => {
      const incorrectCall = {};

      await expect(safeDispatcher.dispatch(incorrectCall)).rejects.toThrow(
        'SafeEventDispatcher.dispatch() requires string eventName as first parameter'
      );

      expect(mockValidatedEventDispatcher.dispatch).not.toHaveBeenCalled();
    });

    it('should throw when called with array as first parameter', async () => {
      const incorrectCall = ['SOME_EVENT'];

      await expect(safeDispatcher.dispatch(incorrectCall)).rejects.toThrow(
        'SafeEventDispatcher.dispatch() requires string eventName as first parameter'
      );

      expect(mockValidatedEventDispatcher.dispatch).not.toHaveBeenCalled();
    });

    it('should include fix suggestion in error message', async () => {
      const incorrectCall = { type: 'SOME_EVENT', payload: {} };

      await expect(safeDispatcher.dispatch(incorrectCall)).rejects.toThrow(
        'dispatch({ type: "X", payload: Y }) → dispatch("X", Y)'
      );
    });
  });

  describe('dispatch() - Correct Signature Acceptance', () => {
    it('should NOT throw for correct signature with string eventName and object payload', async () => {
      const result = await safeDispatcher.dispatch('SOME_EVENT', { data: 'test' });

      expect(result).toBe(true);
      expect(mockValidatedEventDispatcher.dispatch).toHaveBeenCalledWith(
        'SOME_EVENT',
        { data: 'test' },
        {}
      );
    });

    it('should NOT throw for correct signature with string eventName and empty payload', async () => {
      const result = await safeDispatcher.dispatch('SOME_EVENT', {});

      expect(result).toBe(true);
      expect(mockValidatedEventDispatcher.dispatch).toHaveBeenCalledWith(
        'SOME_EVENT',
        {},
        {}
      );
    });

    it('should NOT throw for correct signature with options', async () => {
      const result = await safeDispatcher.dispatch(
        'SOME_EVENT',
        { data: 'test' },
        { skipValidation: true }
      );

      expect(result).toBe(true);
      expect(mockValidatedEventDispatcher.dispatch).toHaveBeenCalledWith(
        'SOME_EVENT',
        { data: 'test' },
        { skipValidation: true }
      );
    });

    it('should allow null as payload (will be handled by underlying dispatcher)', async () => {
      const result = await safeDispatcher.dispatch('SOME_EVENT', null);

      expect(result).toBe(true);
      expect(mockValidatedEventDispatcher.dispatch).toHaveBeenCalledWith(
        'SOME_EVENT',
        null,
        {}
      );
    });

    it('should allow undefined as payload (will be handled by underlying dispatcher)', async () => {
      const result = await safeDispatcher.dispatch('SOME_EVENT', undefined);

      expect(result).toBe(true);
      expect(mockValidatedEventDispatcher.dispatch).toHaveBeenCalledWith(
        'SOME_EVENT',
        undefined,
        {}
      );
    });
  });

  describe('dispatch() - Edge Cases', () => {
    it('should allow null as first parameter (legacy null check downstream)', async () => {
      // null is not an object with properties, so it passes the fail-fast check
      // and goes to the underlying dispatcher which handles it
      await safeDispatcher.dispatch(null, {});

      // The underlying dispatcher is called - it handles null eventName
      expect(mockValidatedEventDispatcher.dispatch).toHaveBeenCalledWith(
        null,
        {},
        {}
      );
    });

    it('should NOT throw for payload object with "type" property (only checks first param)', async () => {
      // The "type" check is only on the first parameter
      const result = await safeDispatcher.dispatch('SOME_EVENT', {
        type: 'inner_type',
        payload: 'inner_payload',
      });

      expect(result).toBe(true);
      expect(mockValidatedEventDispatcher.dispatch).toHaveBeenCalledWith(
        'SOME_EVENT',
        { type: 'inner_type', payload: 'inner_payload' },
        {}
      );
    });
  });
});
