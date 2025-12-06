import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import {
  freeze,
  deepClone,
  deepFreeze,
  safeDeepClone,
} from '../../../src/utils/cloneUtils.js';
import { PersistenceErrorCodes } from '../../../src/persistence/persistenceErrors.js';

describe('cloneUtils additional coverage', () => {
  describe('freeze', () => {
    it('freezes objects in place and prevents mutation', () => {
      const payload = { value: 1 };

      const frozen = freeze(payload);

      expect(frozen).toBe(payload);
      expect(Object.isFrozen(frozen)).toBe(true);
      expect(() => {
        frozen.value = 2;
      }).toThrow(TypeError);
    });
  });

  describe('deepClone primitives', () => {
    it('returns primitive values as-is without cloning', () => {
      expect(deepClone(42)).toBe(42);
      expect(deepClone('text')).toBe('text');
      expect(deepClone(null)).toBeNull();
    });
  });

  describe('deepFreeze', () => {
    it('recursively freezes nested objects and arrays', () => {
      const payload = {
        outer: {
          inner: { value: 1 },
        },
        list: [{ flag: true }],
      };

      const result = deepFreeze(payload);

      expect(result).toBe(payload);
      expect(Object.isFrozen(result)).toBe(true);
      expect(Object.isFrozen(result.outer)).toBe(true);
      expect(Object.isFrozen(result.outer.inner)).toBe(true);
      expect(Object.isFrozen(result.list)).toBe(true);
      expect(Object.isFrozen(result.list[0])).toBe(true);
      expect(() => {
        result.outer.inner.value = 2;
      }).toThrow(TypeError);
      expect(() => {
        result.list.push({ flag: false });
      }).toThrow(TypeError);
    });

    it('returns non-object inputs unchanged', () => {
      expect(deepFreeze(undefined)).toBeUndefined();
      expect(deepFreeze(5)).toBe(5);
    });
  });

  describe('safeDeepClone', () => {
    let logger;
    let originalStructuredClone;

    beforeEach(() => {
      logger = {
        error: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
      };
      originalStructuredClone = global.structuredClone;
    });

    afterEach(() => {
      global.structuredClone = originalStructuredClone;
      jest.restoreAllMocks();
    });

    it('returns a success result when cloning succeeds', () => {
      const source = { nested: { value: 'ok' } };

      const result = safeDeepClone(source, logger);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(source);
      expect(result.data).not.toBe(source);
      expect(logger.error).not.toHaveBeenCalled();
    });

    it('logs and returns a failure result when deepClone throws', () => {
      global.structuredClone = undefined; // force JSON fallback that cannot handle circular refs
      const circular = {};
      circular.self = circular;

      const result = safeDeepClone(circular, logger);

      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(Error);
      expect(result.error.code).toBe(PersistenceErrorCodes.DEEP_CLONE_FAILED);
      expect(logger.error).toHaveBeenCalledWith(
        'DeepClone failed:',
        expect.any(Error)
      );
    });

    it('falls back to console logging when logger is missing', () => {
      global.structuredClone = undefined;
      const circular = {};
      circular.self = circular;
      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      const result = safeDeepClone(circular, null);

      expect(result.success).toBe(false);
      expect(result.error.code).toBe(PersistenceErrorCodes.DEEP_CLONE_FAILED);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'CloneUtils: ',
        'DeepClone failed:',
        expect.any(Error)
      );
    });
  });
});
