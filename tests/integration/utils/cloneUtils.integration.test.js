import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import {
  safeDeepClone,
  freezeMap,
  deepClone,
} from '../../../src/utils/cloneUtils.js';
import {
  PersistenceError,
  PersistenceErrorCodes,
} from '../../../src/persistence/persistenceErrors.js';

/**
 * @file Integration tests for cloneUtils ensuring coordination with
 * persistence utilities and logger fallbacks.
 */

describe('cloneUtils integration', () => {
  let warnSpy;

  beforeEach(() => {
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('uses the fallback logger when safeDeepClone receives an invalid logger', () => {
    const partialLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      // debug intentionally omitted to trigger ensureValidLogger fallback
    };

    const payload = {
      name: 'Archivist',
      inventory: ['quill', 'inkwell'],
      metadata: { level: 5 },
    };

    const result = safeDeepClone(payload, partialLogger);

    expect(result.success).toBe(true);
    expect(result.data).toEqual(payload);
    expect(result.data).not.toBe(payload);

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('CloneUtils'),
      expect.stringContaining('invalid logger instance')
    );
    expect(partialLogger.warn).not.toHaveBeenCalled();
  });

  it('maps cloning failures to persistence errors and logs the failure', () => {
    const structured = {};
    structured.self = structured;

    const logger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    const hadStructuredClone = Object.prototype.hasOwnProperty.call(
      globalThis,
      'structuredClone'
    );
    const originalStructuredClone = globalThis.structuredClone;

    globalThis.structuredClone = undefined;

    try {
      const result = safeDeepClone(structured, logger);

      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(PersistenceError);
      expect(result.error.code).toBe(PersistenceErrorCodes.DEEP_CLONE_FAILED);
      expect(result.error.message).toBe('Failed to deep clone object.');
      expect(logger.error).toHaveBeenCalledWith(
        'DeepClone failed:',
        expect.any(Error)
      );
    } finally {
      if (hadStructuredClone) {
        globalThis.structuredClone = originalStructuredClone;
      } else {
        delete globalThis.structuredClone;
      }
    }
  });

  it('freezes maps deeply while preserving map semantics', () => {
    const original = new Map([
      [
        'alpha',
        { label: 'Alpha', nested: { count: 1 }, tags: ['leader', 'scout'] },
      ],
      ['beta', { label: 'Beta', nested: { count: 2 } }],
    ]);

    const frozen = freezeMap(original);

    expect(Object.isFrozen(original)).toBe(true);
    const alpha = frozen.get('alpha');
    expect(alpha.label).toBe('Alpha');
    expect(Object.isFrozen(alpha)).toBe(true);
    expect(Object.isFrozen(alpha.nested)).toBe(true);
    expect(Object.isFrozen(alpha.tags)).toBe(true);

    expect(() => {
      alpha.nested.count = 5;
    }).toThrow();

    expect(() => frozen.set('gamma', { label: 'Gamma' })).toThrow(
      new TypeError('Cannot modify frozen map')
    );
    expect(() => frozen.delete('alpha')).toThrow(
      new TypeError('Cannot modify frozen map')
    );
    expect(() => frozen.clear()).toThrow(
      new TypeError('Cannot modify frozen map')
    );

    const collected = Array.from(frozen.entries());
    expect(collected).toEqual([
      [
        'alpha',
        { label: 'Alpha', nested: { count: 1 }, tags: ['leader', 'scout'] },
      ],
      ['beta', { label: 'Beta', nested: { count: 2 } }],
    ]);

    const get = frozen.get;
    expect(get('beta')).toEqual({ label: 'Beta', nested: { count: 2 } });

    const clones = deepClone(collected);
    expect(clones).toEqual(collected);
    expect(clones).not.toBe(collected);
  });
});
