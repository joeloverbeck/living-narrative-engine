// src/tests/services/modLoadOrderResolver.test.js

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import ModLoadOrderResolver from '../../../src/modding/modLoadOrderResolver.js';
import ModDependencyError from '../../../src/errors/modDependencyError.js';
import { CORE_MOD_ID } from '../../../src/constants/core';

/**
 * Convenience factory for a minimal manifest object.
 *
 * @param {string} id
 * @param {Array<object>} [dependencies]
 * @returns {import('../../../src/modding/modDependencyValidator.js').ModManifest}
 */
const makeManifest = (id, dependencies = []) => ({
  id,
  version: '1.0.0',
  dependencies,
});

/**
 * Serialises complex input (Set/Map) to a plain value so we can compare
 * before/after for mutation tests.
 * This is NOT for equality of Sets/Maps, only to detect structural mutation
 * of the original object reference.
 *
 * @param {any} value
 */
const deepSnapshot = (value) => {
  const replacer = (_k, v) => {
    if (v instanceof Map) {
      return { __map__: [...v.entries()] };
    }
    if (v instanceof Set) {
      return { __set__: [...v.values()] };
    }
    return v;
  };
  return JSON.stringify(value, replacer);
};

/**
 * Creates a mock logger instance matching the ILogger interface.
 *
 * @returns {import('../../../src/interfaces/coreServices.js').ILogger}
 */
const createMockLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
});

/**
 * Helper to create an empty Map for manifests.
 *
 * @returns {Map<string, import('../../../src/modding/modDependencyValidator.js').ModManifest>}
 */
const createEmptyManifestMap = () => new Map();

/* ==================================================================== */
/* Input validation & basic behaviour                                   */
/* ==================================================================== */

describe('ModLoadOrderResolver – input validation', () => {
  let mockLogger;

  beforeEach(() => {
    mockLogger = createMockLogger();
    jest.clearAllMocks();
  });

  it('throws if logger is missing or invalid in constructor', () => {
    // @ts-expect-error - testing invalid input
    expect(() => new ModLoadOrderResolver(null)).toThrow(
      'constructor requires a valid logger'
    );
    // @ts-expect-error - testing invalid input
    expect(() => new ModLoadOrderResolver({ info: 'not a function' })).toThrow(
      'constructor requires a valid logger'
    );
  });

  it('throws if requestedIds is null or undefined on resolve', () => {
    const resolver = new ModLoadOrderResolver(mockLogger);
    const manifests = createEmptyManifestMap();
    // @ts-expect-error – invalid input on purpose
    expect(() => resolver.resolve(null, manifests)).toThrow();
    // @ts-expect-error – invalid input on purpose
    expect(() => resolver.resolve(undefined, manifests)).toThrow();
  });

  it('throws if requestedIds is not an array on resolve', () => {
    const resolver = new ModLoadOrderResolver(mockLogger);
    const manifests = createEmptyManifestMap();
    // @ts-expect-error – invalid input on purpose
    expect(() => resolver.resolve({}, manifests)).toThrow();
  });

  it('throws if manifestsMap is null, undefined, or not a Map on resolve', () => {
    const resolver = new ModLoadOrderResolver(mockLogger);
    const requested = [];
    // @ts-expect-error
    expect(() => resolver.resolve(requested, null)).toThrow();
    // @ts-expect-error
    expect(() => resolver.resolve(requested, {})).toThrow();
  });

  it('returns [] and logs when no mods are requested', () => {
    const resolver = new ModLoadOrderResolver(mockLogger);
    const requested = [];
    const manifests = createEmptyManifestMap();
    const result = resolver.resolve(requested, manifests);
    expect(result).toEqual([]);
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining('Resolved load order (0 mods)')
    );
  });
});


/* ==================================================================== */
/* Core resolution logic tests                                          */
/* ==================================================================== */

describe('ModLoadOrderResolver – resolution logic', () => {
  let mockLogger;
  let resolver;

  beforeEach(() => {
    mockLogger = createMockLogger();
    resolver = new ModLoadOrderResolver(mockLogger);
    jest.clearAllMocks();
  });

  it('requested=[A,B,C] with dependency B→A yields [core,A,B,C]', () => {
    const requested = ['A', 'B', 'C'];
    const manifests = new Map([
      ['a', makeManifest('A')],
      ['b', makeManifest('B', [{ id: 'A', required: true }])],
      ['c', makeManifest('C')],
    ]);
    const order = resolver.resolve(requested, manifests);
    expect(order).toEqual([CORE_MOD_ID, 'A', 'B', 'C']);
  });

  it('cycle A↔B throws ModDependencyError containing both IDs', () => {
    const requested = ['A', 'B'];
    const manifests = new Map([
      ['a', makeManifest('A', [{ id: 'B', required: true }])],
      ['b', makeManifest('B', [{ id: 'A', required: true }])],
    ]);
    expect(() => resolver.resolve(requested, manifests)).toThrow(
      ModDependencyError
    );
    try {
      resolver.resolve(requested, manifests);
    } catch (e) {
      expect(e.message).toMatch(/A/);
      expect(e.message).toMatch(/B/);
      expect(e.message).toContain('Cyclic dependency');
    }
  });

  it('algorithm completes quickly (≈O(N+E)) for large linear chain', () => {
    const N = 5000; // large but safe for CI
    const requested = Array.from({ length: N }, (_, i) => `Mod${i}`);
    const manifests = new Map();
    requested.forEach((id, idx) => {
      const deps = idx === 0 ? [] : [{ id: `Mod${idx - 1}`, required: true }];
      manifests.set(id.toLowerCase(), makeManifest(id, deps));
    });

    const start = Date.now();
    const order = resolver.resolve(requested, manifests);
    const durationMs = Date.now() - start;

    expect(order.length).toBe(N + 1);
    // should finish well under a second on typical CI machines
    expect(durationMs).toBeLessThan(500);
  });

  it('does NOT mutate the input requestedIds array or manifestsMap', () => {
    const requested = ['modA', 'modB'];
    const manifests = new Map([
      ['moda', makeManifest('modA')],
      ['modb', makeManifest('modB', [{ id: 'modA' }])],
    ]);
    const snapReq = deepSnapshot(requested);
    const snapMan = deepSnapshot(manifests);
    resolver.resolve(requested, manifests);
    expect(deepSnapshot(requested)).toBe(snapReq);
    expect(deepSnapshot(manifests)).toBe(snapMan);
  });

  it('does not include an unrequested optional dependency in the final order', () => {
    const requested = ['modB'];
    const manifests = new Map([
      ['modb', makeManifest('modB', [{ id: 'modA', required: false }])],
      ['moda', makeManifest('modA')],
    ]);
    const order = resolver.resolve(requested, manifests);
    expect(order).toEqual([CORE_MOD_ID, 'modB']);
  });
});


/* ==================================================================== */
/* Adjustment logging tests                                             */
/* ==================================================================== */

describe('ModLoadOrderResolver – adjustment logging', () => {
  let mockLogger;
  let resolver;

  beforeEach(() => {
    mockLogger = createMockLogger();
    resolver = new ModLoadOrderResolver(mockLogger);
    jest.clearAllMocks();
  });

  it('emits a log when the resolver reorders mods', () => {
    const requested = ['B', 'A']; // invalid, B depends on A
    const manifests = new Map([
      ['a', makeManifest('A')],
      ['b', makeManifest('B', [{ id: 'A', required: true }])],
    ]);

    resolver.resolve(requested, manifests);

    const logged = mockLogger.debug.mock.calls.some(([msg]) =>
      msg.includes('Mod load order adjusted to satisfy dependencies.')
    );
    expect(logged).toBe(true);
  });

  it('does NOT emit the adjustment log when input order is already valid', () => {
    const requested = ['A', 'B']; // valid order
    const manifests = new Map([
      ['a', makeManifest('A')],
      ['b', makeManifest('B', [{ id: 'A', required: true }])],
    ]);

    resolver.resolve(requested, manifests);

    const logged = mockLogger.debug.mock.calls.some(([msg]) =>
      msg.includes('Mod load order adjusted to satisfy dependencies.')
    );
    expect(logged).toBe(false);
  });
});