// tests/logic/operationRegistry.test.js

/**
 * @jest-environment node
 */
import { describe, expect, test, jest, beforeEach } from '@jest/globals';
import OperationRegistry from '../../../src/logic/operationRegistry.js';

/** @typedef {import('../../../src/interfaces/coreServices.js').ILogger} ILogger */

/** @type {jest.Mocked<ILogger>} */
let mockLogger;
/** @type {import('../../../src/logic/defs.js').OperationHandler} */
const dummyHandler = jest.fn();

beforeEach(() => {
  mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };
  dummyHandler.mockClear();
});

describe('OperationRegistry', () => {
  test('constructor uses provided logger', () => {
    new OperationRegistry({ logger: mockLogger });
    expect(mockLogger.info).toHaveBeenCalledWith(
      'OperationRegistry: OperationRegistry initialized.'
    );
  });

  test('constructor throws without logger', () => {
    expect(() => new OperationRegistry()).toThrow(
      'Missing required dependency: logger.'
    );
  });

  describe('register()', () => {
    test('registers handler and logs debug', () => {
      const registry = new OperationRegistry({ logger: mockLogger });
      const result = registry.register('TEST', dummyHandler);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'OperationRegistry: OperationRegistry: Registered handler for operation type "TEST".'
      );
      expect(registry.getHandler('TEST')).toBe(dummyHandler);
      expect(result).toBe(true);
    });

    test('warns when overwriting existing handler', () => {
      const registry = new OperationRegistry({ logger: mockLogger });
      const first = registry.register('TEST', dummyHandler);
      mockLogger.debug.mockClear();
      const second = registry.register('TEST', dummyHandler);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'OperationRegistry: OperationRegistry: Overwriting existing handler for operation type "TEST".'
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'OperationRegistry: OperationRegistry: Registered handler for operation type "TEST".'
      );
      expect(first).toBe(true);
      expect(second).toBe(false);
    });

    test('throws and logs error for invalid type', () => {
      const registry = new OperationRegistry({ logger: mockLogger });
      expect(() => registry.register('', dummyHandler)).toThrow(
        'OperationRegistry.register: operationType must be a non-empty string.'
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        'OperationRegistry: OperationRegistry.register: operationType must be a non-empty string.'
      );
    });

    test('throws and logs error for non-function handler', () => {
      const registry = new OperationRegistry({ logger: mockLogger });
      expect(() => registry.register('TEST', null)).toThrow(
        'OperationRegistry.register: handler for type "TEST" must be a function.'
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        'OperationRegistry: OperationRegistry.register: handler for type "TEST" must be a function.'
      );
    });
  });

  describe('getHandler()', () => {
    let registry;
    beforeEach(() => {
      registry = new OperationRegistry({ logger: mockLogger });
      registry.register('TEST', dummyHandler);
    });

    test('retrieves handler for registered type', () => {
      const handler = registry.getHandler('TEST');
      expect(handler).toBe(dummyHandler);
    });

    test('trims input before lookup', () => {
      const handler = registry.getHandler('  TEST  ');
      expect(handler).toBe(dummyHandler);
    });

    test('logs debug when handler not found', () => {
      registry.getHandler('MISSING');
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'OperationRegistry: OperationRegistry: No handler found for operation type "MISSING".'
      );
    });

    test('logs error for non-string type via helper', () => {
      registry.getHandler(123);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'OperationRegistry: OperationRegistry.getHandler: operationType must be a non-empty string.'
      );
    });
  });

  describe('hasHandler()', () => {
    let registry;
    beforeEach(() => {
      registry = new OperationRegistry({ logger: mockLogger });
      registry.register('TEST', dummyHandler);
    });

    test('returns true for registered operation type', () => {
      expect(registry.hasHandler('TEST')).toBe(true);
    });

    test('returns false for unregistered operation type', () => {
      expect(registry.hasHandler('MISSING')).toBe(false);
    });

    test('handles null input gracefully (returns false)', () => {
      expect(registry.hasHandler(null)).toBe(false);
    });

    test('handles undefined input gracefully (returns false)', () => {
      expect(registry.hasHandler(undefined)).toBe(false);
    });

    test('handles empty string input gracefully (returns false)', () => {
      expect(registry.hasHandler('')).toBe(false);
    });

    test('handles whitespace-only input gracefully (returns false)', () => {
      expect(registry.hasHandler('   ')).toBe(false);
    });

    test('uses normalized operation type (handles whitespace)', () => {
      expect(registry.hasHandler('  TEST  ')).toBe(true);
    });

    test('does NOT log debug when handler is missing (unlike getHandler)', () => {
      mockLogger.debug.mockClear();
      registry.hasHandler('MISSING');
      // hasHandler should NOT log anything for missing handlers
      expect(mockLogger.debug).not.toHaveBeenCalledWith(
        expect.stringContaining('No handler found')
      );
    });

    test('is consistent with getHandler - true case', () => {
      const hasIt = registry.hasHandler('TEST');
      const handler = registry.getHandler('TEST');
      expect(hasIt).toBe(true);
      expect(handler).toBeDefined();
      expect(handler).toBe(dummyHandler);
    });

    test('is consistent with getHandler - false case', () => {
      const hasIt = registry.hasHandler('NONEXISTENT');
      const handler = registry.getHandler('NONEXISTENT');
      expect(hasIt).toBe(false);
      expect(handler).toBeUndefined();
    });
  });

  describe('getRegisteredTypes()', () => {
    test('returns sorted list of registered operation types', () => {
      const registry = new OperationRegistry({ logger: mockLogger });

      registry.register('QUERY_COMPONENT', dummyHandler);
      registry.register('ADD_COMPONENT', dummyHandler);
      registry.register('REMOVE_COMPONENT', dummyHandler);

      const types = registry.getRegisteredTypes();

      expect(types).toEqual([
        'ADD_COMPONENT',
        'QUERY_COMPONENT',
        'REMOVE_COMPONENT',
      ]);
    });

    test('returns empty array when no operations registered', () => {
      const registry = new OperationRegistry({ logger: mockLogger });

      expect(registry.getRegisteredTypes()).toEqual([]);
    });

    test('returns sorted list regardless of registration order', () => {
      const registry = new OperationRegistry({ logger: mockLogger });

      registry.register('Z_OPERATION', dummyHandler);
      registry.register('A_OPERATION', dummyHandler);
      registry.register('M_OPERATION', dummyHandler);

      const types = registry.getRegisteredTypes();

      expect(types).toEqual(['A_OPERATION', 'M_OPERATION', 'Z_OPERATION']);
    });

    test('does not include duplicates after overwrite', () => {
      const registry = new OperationRegistry({ logger: mockLogger });

      registry.register('TEST', dummyHandler);
      registry.register('TEST', dummyHandler); // Overwrite

      const types = registry.getRegisteredTypes();

      expect(types).toEqual(['TEST']);
      expect(types.length).toBe(1);
    });
  });
});
