// tests/logic/operationRegistry.test.js

/**
 * @jest-environment node
 */
import { describe, expect, test, jest, beforeEach } from '@jest/globals';
import OperationRegistry from '../../src/logic/operationRegistry.js';

/** @typedef {import('../../src/interfaces/coreServices.js').ILogger} ILogger */

/** @type {jest.Mocked<ILogger>} */
let mockLogger;
/** @type {import('../../src/logic/defs.js').OperationHandler} */
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

  test('constructor works without logger', () => {
    const registry = new OperationRegistry();
    expect(registry).toBeInstanceOf(OperationRegistry);
  });

  describe('register()', () => {
    test('registers handler and logs debug', () => {
      const registry = new OperationRegistry({ logger: mockLogger });
      registry.register('TEST', dummyHandler);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'OperationRegistry: OperationRegistry: Registered handler for operation type "TEST".'
      );
      expect(registry.getHandler('TEST')).toBe(dummyHandler);
    });

    test('warns when overwriting existing handler', () => {
      const registry = new OperationRegistry({ logger: mockLogger });
      registry.register('TEST', dummyHandler);
      mockLogger.debug.mockClear();
      registry.register('TEST', dummyHandler);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'OperationRegistry: OperationRegistry: Overwriting existing handler for operation type "TEST".'
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'OperationRegistry: OperationRegistry: Registered handler for operation type "TEST".'
      );
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

    test('logs warn for non-string type', () => {
      registry.getHandler(123);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'OperationRegistry: OperationRegistry.getHandler: Received non-string operationType: number. Returning undefined.'
      );
    });
  });
});
