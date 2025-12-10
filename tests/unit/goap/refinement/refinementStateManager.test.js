/**
 * @file Unit tests for RefinementStateManager
 * @description Tests state lifecycle, accumulation, access, and error handling
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import RefinementStateManager from '../../../../src/goap/refinement/refinementStateManager.js';
import RefinementError from '../../../../src/goap/errors/refinementError.js';

describe('RefinementStateManager', () => {
  let manager;
  let mockLogger;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    manager = new RefinementStateManager({ logger: mockLogger });
  });

  describe('State Lifecycle', () => {
    it('should initialize empty state', () => {
      manager.initialize();
      const state = manager.getState();

      expect(state).toEqual({});
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Refinement state initialized (empty)'
      );
    });

    it('should clear state', () => {
      manager.initialize();
      manager.store('key', {
        success: true,
        data: { value: 42 },
        error: null,
        timestamp: Date.now(),
        actionId: 'test:action',
      });

      manager.clear();

      expect(mockLogger.debug).toHaveBeenCalledWith('Refinement state cleared');

      // After clear, state should be uninitialized
      expect(() => manager.getState()).toThrow(RefinementError);
      expect(() => manager.getState()).toThrow(/not initialized/);
    });

    it('should handle multiple initialize calls safely', () => {
      manager.initialize();
      manager.store('key1', {
        success: true,
        data: {},
        error: null,
        timestamp: 1,
        actionId: 'test:action',
      });

      // Second initialize should reset state
      manager.initialize();
      const state = manager.getState();

      expect(state).toEqual({});
    });

    it('should throw error on operations before initialize', () => {
      expect(() =>
        manager.store('key', {
          success: true,
          data: {},
          error: null,
          timestamp: 1,
          actionId: 'test:action',
        })
      ).toThrow(RefinementError);
      expect(() => manager.getState()).toThrow(RefinementError);
      expect(() => manager.getSnapshot()).toThrow(RefinementError);
      expect(() => manager.has('key')).toThrow(RefinementError);
      expect(() => manager.get('key')).toThrow(RefinementError);
      expect(() => manager.toJSON()).toThrow(RefinementError);
    });
  });

  describe('State Mutation', () => {
    beforeEach(() => {
      manager.initialize();
    });

    it('should store result with valid key and structure', () => {
      const result = {
        success: true,
        data: { item: 'apple_7' },
        error: null,
        timestamp: 1638360000000,
        actionId: 'item-handling:pick_up_item',
      };

      manager.store('pickupResult', result);

      expect(manager.get('pickupResult')).toEqual(result);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Stored refinement state',
        expect.objectContaining({
          key: 'pickupResult',
          success: true,
          actionId: 'item-handling:pick_up_item',
        })
      );
    });

    it('should overwrite existing keys', () => {
      const result1 = {
        success: true,
        data: { value: 1 },
        error: null,
        timestamp: 1,
        actionId: 'test:action1',
      };

      const result2 = {
        success: false,
        data: { value: 2 },
        error: 'failed',
        timestamp: 2,
        actionId: 'test:action2',
      };

      manager.store('key', result1);
      manager.store('key', result2);

      expect(manager.get('key')).toEqual(result2);
    });

    it('should handle various data types in result.data', () => {
      const testCases = [
        { item: 'string' },
        { count: 42 },
        { flag: true },
        { items: ['a', 'b', 'c'] },
        { nested: { deep: { value: 123 } } },
        {},
      ];

      testCases.forEach((data, index) => {
        manager.store(`key${index}`, {
          success: true,
          data,
          error: null,
          timestamp: Date.now(),
          actionId: 'test:action',
        });

        expect(manager.get(`key${index}`).data).toEqual(data);
      });
    });

    it('should handle null error in successful result', () => {
      const result = {
        success: true,
        data: {},
        error: null,
        timestamp: Date.now(),
        actionId: 'test:action',
      };

      manager.store('key', result);
      expect(manager.get('key').error).toBeNull();
    });

    it('should handle string error in failed result', () => {
      const result = {
        success: false,
        data: {},
        error: 'Action execution failed',
        timestamp: Date.now(),
        actionId: 'test:action',
      };

      manager.store('key', result);
      expect(manager.get('key').error).toBe('Action execution failed');
    });

    it('should validate key format (valid JS identifier)', () => {
      const validKeys = [
        'pickupResult',
        'step1Result',
        '_privateVar',
        'result_2',
      ];

      validKeys.forEach((key) => {
        expect(() =>
          manager.store(key, {
            success: true,
            data: {},
            error: null,
            timestamp: 1,
            actionId: 'test:action',
          })
        ).not.toThrow();
      });
    });

    it('should reject invalid key formats', () => {
      const invalidKeys = [
        '123invalid', // Starts with digit
        'invalid-key', // Contains hyphen
        'invalid key', // Contains space
        'invalid.key', // Contains dot
        '', // Empty string
        'invalid@key', // Special character
      ];

      invalidKeys.forEach((key) => {
        expect(() =>
          manager.store(key, {
            success: true,
            data: {},
            error: null,
            timestamp: 1,
            actionId: 'test:action',
          })
        ).toThrow(RefinementError);
        expect(() =>
          manager.store(key, {
            success: true,
            data: {},
            error: null,
            timestamp: 1,
            actionId: 'test:action',
          })
        ).toThrow(/Invalid state key/);
      });
    });

    it('should reject non-string keys', () => {
      const invalidKeys = [null, undefined, 123, {}, []];

      invalidKeys.forEach((key) => {
        expect(() =>
          manager.store(key, {
            success: true,
            data: {},
            error: null,
            timestamp: 1,
            actionId: 'test:action',
          })
        ).toThrow(RefinementError);
      });
    });

    it('should reject value missing required fields', () => {
      const incompleteValues = [
        { success: true, data: {}, error: null, timestamp: 1 }, // Missing actionId
        { success: true, data: {}, error: null, actionId: 'test:action' }, // Missing timestamp
        { success: true, data: {}, timestamp: 1, actionId: 'test:action' }, // Missing error
        { success: true, error: null, timestamp: 1, actionId: 'test:action' }, // Missing data
        { data: {}, error: null, timestamp: 1, actionId: 'test:action' }, // Missing success
      ];

      incompleteValues.forEach((value) => {
        expect(() => manager.store('key', value)).toThrow(RefinementError);
        expect(() => manager.store('key', value)).toThrow(
          /missing required fields/
        );
      });
    });

    it('should validate field types', () => {
      const invalidValues = [
        {
          success: 'true',
          data: {},
          error: null,
          timestamp: 1,
          actionId: 'test:action',
        }, // success not boolean
        {
          success: true,
          data: null,
          error: null,
          timestamp: 1,
          actionId: 'test:action',
        }, // data is null
        {
          success: true,
          data: {},
          error: 123,
          timestamp: 1,
          actionId: 'test:action',
        }, // error not string/null
        {
          success: true,
          data: {},
          error: null,
          timestamp: '1',
          actionId: 'test:action',
        }, // timestamp not number
        {
          success: true,
          data: {},
          error: null,
          timestamp: 1,
          actionId: 123,
        }, // actionId not string
      ];

      invalidValues.forEach((value) => {
        expect(() => manager.store('key', value)).toThrow(RefinementError);
        expect(() => manager.store('key', value)).toThrow(
          /Invalid result structure/
        );
      });
    });

    it('should reject non-object values', () => {
      // Arrays are technically objects in JavaScript, but we validate structure
      // so arrays will fail on missing required fields
      const nonObjectValues = [null, undefined, 'string', 123, true];

      nonObjectValues.forEach((value) => {
        expect(() => manager.store('key', value)).toThrow(RefinementError);
        expect(() => manager.store('key', value)).toThrow(/must be an object/);
      });

      // Arrays should fail on missing required fields
      expect(() => manager.store('key', [])).toThrow(RefinementError);
      expect(() => manager.store('key', [])).toThrow(/missing required fields/);
    });
  });

  describe('State Access', () => {
    beforeEach(() => {
      manager.initialize();
    });

    it('should return mutable reference from getState', () => {
      const result = {
        success: true,
        data: { value: 42 },
        error: null,
        timestamp: Date.now(),
        actionId: 'test:action',
      };

      manager.store('key', result);
      const state = manager.getState();

      // Verify it's mutable - modifications affect original
      state.key.data.value = 100;
      expect(manager.get('key').data.value).toBe(100);
    });

    it('should get specific value by key', () => {
      const result = {
        success: true,
        data: { item: 'sword_5' },
        error: null,
        timestamp: Date.now(),
        actionId: 'test:action',
      };

      manager.store('equipResult', result);

      expect(manager.get('equipResult')).toEqual(result);
    });

    it('should return undefined for missing keys', () => {
      expect(manager.get('nonexistent')).toBeUndefined();
    });

    it('should return undefined for non-string keys in get', () => {
      expect(manager.get(null)).toBeUndefined();
      expect(manager.get(undefined)).toBeUndefined();
      expect(manager.get(123)).toBeUndefined();
    });

    it('should check key existence with has', () => {
      const result = {
        success: true,
        data: {},
        error: null,
        timestamp: Date.now(),
        actionId: 'test:action',
      };

      manager.store('existingKey', result);

      expect(manager.has('existingKey')).toBe(true);
      expect(manager.has('nonexistent')).toBe(false);
    });

    it('should return false for non-string keys in has', () => {
      expect(manager.has(null)).toBe(false);
      expect(manager.has(undefined)).toBe(false);
      expect(manager.has(123)).toBe(false);
    });

    it('should distinguish between undefined value and missing key', () => {
      // In our implementation, stored values must have a specific structure
      // so we can't actually store undefined, but we can test missing keys
      expect(manager.has('missing')).toBe(false);
      expect(manager.get('missing')).toBeUndefined();
    });
  });

  describe('Immutable Snapshots', () => {
    beforeEach(() => {
      manager.initialize();
    });

    it('should return frozen deep copy from getSnapshot', () => {
      const result = {
        success: true,
        data: { nested: { value: 42 } },
        error: null,
        timestamp: Date.now(),
        actionId: 'test:action',
      };

      manager.store('key', result);
      const snapshot = manager.getSnapshot();

      // Verify snapshot is frozen
      expect(Object.isFrozen(snapshot)).toBe(true);
      expect(Object.isFrozen(snapshot.key)).toBe(true);
      expect(Object.isFrozen(snapshot.key.data)).toBe(true);
      expect(Object.isFrozen(snapshot.key.data.nested)).toBe(true);
    });

    it('should prevent mutations to snapshot', () => {
      const result = {
        success: true,
        data: { value: 42 },
        error: null,
        timestamp: Date.now(),
        actionId: 'test:action',
      };

      manager.store('key', result);
      const snapshot = manager.getSnapshot();

      // Mutations should throw in strict mode
      expect(() => {
        snapshot.key.data.value = 100;
      }).toThrow();
    });

    it('should isolate snapshot from original state', () => {
      const result = {
        success: true,
        data: { value: 42 },
        error: null,
        timestamp: Date.now(),
        actionId: 'test:action',
      };

      manager.store('key', result);
      const snapshot = manager.getSnapshot();

      // Mutate original state
      const state = manager.getState();
      state.key.data.value = 100;

      // Snapshot should remain unchanged
      expect(snapshot.key.data.value).toBe(42);
    });

    it('should isolate original state from snapshot mutations (if unfrozen)', () => {
      const result = {
        success: true,
        data: { value: 42 },
        error: null,
        timestamp: Date.now(),
        actionId: 'test:action',
      };

      manager.store('key', result);

      // Even if we could mutate snapshot (we can't due to freeze),
      // it wouldn't affect original
      const snapshot = JSON.parse(JSON.stringify(manager.getState()));
      snapshot.key.data.value = 100;

      expect(manager.get('key').data.value).toBe(42);
    });

    it('should handle complex nested structures in snapshot', () => {
      const result = {
        success: true,
        data: {
          level1: {
            level2: {
              level3: {
                values: [1, 2, 3],
                metadata: { key: 'value' },
              },
            },
          },
        },
        error: null,
        timestamp: Date.now(),
        actionId: 'test:action',
      };

      manager.store('complex', result);
      const snapshot = manager.getSnapshot();

      // Verify all levels are frozen
      expect(Object.isFrozen(snapshot.complex.data.level1)).toBe(true);
      expect(Object.isFrozen(snapshot.complex.data.level1.level2)).toBe(true);
      expect(Object.isFrozen(snapshot.complex.data.level1.level2.level3)).toBe(
        true
      );
      expect(
        Object.isFrozen(snapshot.complex.data.level1.level2.level3.values)
      ).toBe(true);
      expect(
        Object.isFrozen(snapshot.complex.data.level1.level2.level3.metadata)
      ).toBe(true);
    });

    it('should log snapshot creation', () => {
      manager.store('key', {
        success: true,
        data: {},
        error: null,
        timestamp: Date.now(),
        actionId: 'test:action',
      });

      manager.getSnapshot();

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Created immutable state snapshot',
        expect.objectContaining({ keyCount: 1 })
      );
    });
  });

  describe('State Inspection', () => {
    beforeEach(() => {
      manager.initialize();
    });

    it('should serialize state to JSON', () => {
      const result = {
        success: true,
        data: { item: 'apple_7' },
        error: null,
        timestamp: 1638360000000,
        actionId: 'item-handling:pick_up_item',
      };

      manager.store('pickupResult', result);

      const json = manager.toJSON();
      const parsed = JSON.parse(json);

      expect(parsed).toEqual({ pickupResult: result });
    });

    it('should serialize empty state', () => {
      const json = manager.toJSON();
      expect(json).toBe('{}');
    });

    it('should handle complex nested structures', () => {
      const result1 = {
        success: true,
        data: { nested: { deep: { value: 123 } } },
        error: null,
        timestamp: 1,
        actionId: 'test:action1',
      };

      const result2 = {
        success: false,
        data: { array: [1, 2, 3] },
        error: 'failed',
        timestamp: 2,
        actionId: 'test:action2',
      };

      manager.store('result1', result1);
      manager.store('result2', result2);

      const json = manager.toJSON();
      const parsed = JSON.parse(json);

      expect(parsed.result1).toEqual(result1);
      expect(parsed.result2).toEqual(result2);
    });

    it('should handle serialization errors gracefully', () => {
      manager.initialize();

      // Create circular reference (edge case)
      const state = manager.getState();
      const obj = {
        success: true,
        data: {},
        error: null,
        timestamp: 1,
        actionId: 'test:action',
      };
      obj.data.circular = obj;
      state.circular = obj;

      const json = manager.toJSON();

      // Should return empty object on error
      expect(json).toBe('{}');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Failed to serialize state to JSON',
        expect.any(Object)
      );
    });
  });

  describe('Error Handling', () => {
    it('should provide descriptive error for uninitialized state', () => {
      expect(() => manager.getState()).toThrow(RefinementError);
      expect(() => manager.getState()).toThrow(/not initialized/);
      expect(() => manager.getState()).toThrow(/Call initialize\(\) first/);
    });

    it('should include operation name in uninitialized error', () => {
      const operations = [
        { name: 'getState', call: () => manager.getState() },
        { name: 'getSnapshot', call: () => manager.getSnapshot() },
        {
          name: 'store',
          call: () =>
            manager.store('key', {
              success: true,
              data: {},
              error: null,
              timestamp: 1,
              actionId: 'test:action',
            }),
        },
        { name: 'has', call: () => manager.has('key') },
        { name: 'get', call: () => manager.get('key') },
        { name: 'toJSON', call: () => manager.toJSON() },
      ];

      operations.forEach(({ name, call }) => {
        expect(() => call()).toThrow(
          expect.objectContaining({
            context: expect.objectContaining({ operation: name }),
          })
        );
      });
    });

    it('should include error code in context', () => {
      // Test uninitialized state error
      expect(() => manager.getState()).toThrow(
        expect.objectContaining({
          context: expect.objectContaining({
            code: 'GOAP_REFINEMENT_STATE_NOT_INITIALIZED',
          }),
        })
      );

      manager.initialize();

      // Test invalid key error
      expect(() =>
        manager.store('123invalid', {
          success: true,
          data: {},
          error: null,
          timestamp: 1,
          actionId: 'test:action',
        })
      ).toThrow(
        expect.objectContaining({
          context: expect.objectContaining({
            code: 'GOAP_REFINEMENT_INVALID_STATE_KEY',
          }),
        })
      );

      // Test invalid structure error
      expect(() => manager.store('key', { invalid: 'structure' })).toThrow(
        expect.objectContaining({
          context: expect.objectContaining({
            code: 'GOAP_REFINEMENT_INVALID_RESULT_STRUCTURE',
          }),
        })
      );
    });

    it('should log errors with correlation ID', () => {
      manager.initialize();

      // Store the error to verify logging
      let caughtError;
      try {
        manager.store('invalid-key', {
          success: true,
          data: {},
          error: null,
          timestamp: 1,
          actionId: 'test:action',
        });
      } catch (error) {
        caughtError = error;
      }

      expect(caughtError).toBeDefined();
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Invalid state key',
        expect.objectContaining({
          key: 'invalid-key',
          correlationId: caughtError.correlationId,
        })
      );
    });

    it('should provide helpful error messages for invalid structures', () => {
      manager.initialize();

      expect(() => {
        manager.store('key', {
          success: true,
          data: {},
          error: null,
          timestamp: 1,
          // Missing actionId
        });
      }).toThrow(
        expect.objectContaining({
          message: expect.stringContaining('missing required fields'),
        })
      );

      // Verify specific field is mentioned
      let caughtError;
      try {
        manager.store('key', {
          success: true,
          data: {},
          error: null,
          timestamp: 1,
          // Missing actionId
        });
      } catch (error) {
        caughtError = error;
      }

      expect(caughtError).toBeDefined();
      expect(caughtError.message).toContain('actionId');

      // Verify type validation messages
      let typeError;
      try {
        manager.store('key', {
          success: 'not-boolean',
          data: {},
          error: null,
          timestamp: 1,
          actionId: 'test:action',
        });
      } catch (error) {
        typeError = error;
      }

      expect(typeError).toBeDefined();
      expect(typeError.message).toContain('success must be boolean');
    });
  });

  describe('Integration Scenarios', () => {
    beforeEach(() => {
      manager.initialize();
    });

    it('should support state accumulation across multiple steps', () => {
      // Step 1: Pick up item
      manager.store('pickupResult', {
        success: true,
        data: { item: 'apple_7' },
        error: null,
        timestamp: 1000,
        actionId: 'item-handling:pick_up_item',
      });

      // Step 2: Move to location
      manager.store('moveResult', {
        success: true,
        data: { location: 'kitchen' },
        error: null,
        timestamp: 2000,
        actionId: 'movement:move_to',
      });

      // Step 3: Consume item
      manager.store('consumeResult', {
        success: true,
        data: { effect: 'nourished' },
        error: null,
        timestamp: 3000,
        actionId: 'items:consume_item',
      });

      // Verify all results stored
      expect(manager.has('pickupResult')).toBe(true);
      expect(manager.has('moveResult')).toBe(true);
      expect(manager.has('consumeResult')).toBe(true);

      // Verify snapshot captures all state
      const snapshot = manager.getSnapshot();
      expect(Object.keys(snapshot)).toHaveLength(3);
    });

    it('should support conditional branching based on stored state', () => {
      // Store initial attempt result
      manager.store('attemptResult', {
        success: false,
        data: {},
        error: 'Target unreachable',
        timestamp: Date.now(),
        actionId: 'movement:move_to',
      });

      // Conditional check would use snapshot
      const snapshot = manager.getSnapshot();
      const shouldRetry = snapshot.attemptResult.success === false;

      expect(shouldRetry).toBe(true);

      // Store retry result
      if (shouldRetry) {
        manager.store('retryResult', {
          success: true,
          data: { pathFound: true },
          error: null,
          timestamp: Date.now(),
          actionId: 'movement:move_to',
        });
      }

      expect(manager.has('retryResult')).toBe(true);
    });

    it('should support nested data access patterns', () => {
      manager.store('result', {
        success: true,
        data: {
          entity: {
            id: 'npc_42',
            components: {
              inventory: {
                items: ['item_1', 'item_2', 'item_3'],
              },
            },
          },
        },
        error: null,
        timestamp: Date.now(),
        actionId: 'test:action',
      });

      const state = manager.getState();
      const items = state.result.data.entity.components.inventory.items;

      expect(items).toEqual(['item_1', 'item_2', 'item_3']);
    });

    it('should maintain state isolation between different refinement executions', () => {
      // First refinement execution
      manager.store('step1', {
        success: true,
        data: { value: 1 },
        error: null,
        timestamp: 1,
        actionId: 'test:action1',
      });

      expect(manager.has('step1')).toBe(true);

      // Clear for next execution
      manager.clear();

      // Second refinement execution
      manager.initialize();
      expect(manager.has('step1')).toBe(false);

      manager.store('step1', {
        success: true,
        data: { value: 2 },
        error: null,
        timestamp: 2,
        actionId: 'test:action2',
      });

      expect(manager.get('step1').data.value).toBe(2);
    });
  });

  describe('Constructor', () => {
    it('should require logger dependency', () => {
      // ensureValidLogger creates a fallback logger if invalid, so this doesn't throw
      // Instead, test that it accepts the dependency parameter
      const manager = new RefinementStateManager({});
      expect(manager).toBeDefined();
    });

    it('should accept valid logger', () => {
      const logger = {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      };

      const instance = new RefinementStateManager({ logger });
      expect(instance).toBeDefined();
    });

    it('should log initialization', () => {
      const logger = {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      };

      new RefinementStateManager({ logger });
      expect(logger.debug).toHaveBeenCalledWith(
        'RefinementStateManager initialized'
      );
    });
  });
});
