// src/tests/core/services/modLoadOrderResolver.test.js

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import {
  buildDependencyGraph,
  resolveOrder,
} from '../../src/modding/modLoadOrderResolver.js';
import ModDependencyError from '../../src/errors/modDependencyError.js';

/**
 * Convenience factory for a minimal manifest object.
 * @param {string} id
 * @param {Array<object>} [dependencies]
 * @returns {import('../../src/modding/modDependencyValidator.js').ModManifest}
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
 * @returns {import('../../src/interfaces/coreServices.js').ILogger}
 */
const createMockLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
});

/**
 * Helper to create an empty Map for manifests.
 * @returns {Map<string, import('../../src/modding/modDependencyValidator.js').ModManifest>}
 */
const createEmptyManifestMap = () => new Map();

/* ==================================================================== */
/* Input validation & basic behaviour                                   */
/* ==================================================================== */

describe('modLoadOrderResolver – input validation', () => {
  let mockLogger;

  beforeEach(() => {
    mockLogger = createMockLogger();
    jest.clearAllMocks();
  });

  it('throws if requestedIds is null or undefined', () => {
    const manifests = createEmptyManifestMap();
    // @ts-expect-error – invalid input on purpose
    expect(() => resolveOrder(null, manifests, mockLogger)).toThrow();
    // @ts-expect-error – invalid input on purpose
    expect(() => resolveOrder(undefined, manifests, mockLogger)).toThrow();
  });

  it('throws if requestedIds is not an array', () => {
    const manifests = createEmptyManifestMap();
    // @ts-expect-error – invalid input on purpose
    expect(() => resolveOrder({}, manifests, mockLogger)).toThrow();
  });

  it('throws if manifestsMap is null, undefined, or not a Map', () => {
    const requested = [];
    // @ts-expect-error
    expect(() => resolveOrder(requested, null, mockLogger)).toThrow();
    // @ts-expect-error
    expect(() => resolveOrder(requested, {}, mockLogger)).toThrow();
  });

  it('throws if logger is missing required methods', () => {
    const requested = [];
    const manifests = createEmptyManifestMap();
    // @ts-expect-error
    expect(() =>
      resolveOrder(requested, manifests, { info: 'notFn' })
    ).toThrow();
  });

  it('returns [] and logs when no mods are requested', () => {
    const requested = [];
    const manifests = createEmptyManifestMap();
    const result = resolveOrder(requested, manifests, mockLogger);
    expect(result).toEqual([]);
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.stringContaining('Resolved load order')
    );
  });
});

/* ==================================================================== */
/* Ticket T‑2 – buildDependencyGraph acceptance‑criteria unit tests      */
/* ==================================================================== */

describe('buildDependencyGraph (Ticket T‑2)', () => {
  it('required dependency produces an edge dep → mod', () => {
    const requested = ['modA', 'modB'];
    const manifests = new Map([
      ['moda', makeManifest('modA')],
      [
        'modb',
        makeManifest('modB', [
          { id: 'modA', version: '^1.0.0', required: true },
        ]),
      ],
    ]);
    const graph = buildDependencyGraph(requested, manifests);
    expect(graph.edges.get('modA')).toBeDefined();
    expect(graph.edges.get('modA').has('modB')).toBe(true);
  });

  it('optional dependency NOT in requestedIds does NOT create an edge', () => {
    const requested = ['modB'];
    const manifests = new Map([
      [
        'modb',
        makeManifest('modB', [
          { id: 'modA', version: '^1.0.0', required: false },
        ]),
      ],
    ]);
    const graph = buildDependencyGraph(requested, manifests);
    expect(graph.edges.get('modA')).toBeUndefined();
  });

  it('always adds implicit edge core → X for every non‑core requested mod', () => {
    const requested = ['modX'];
    const manifests = createEmptyManifestMap();
    const graph = buildDependencyGraph(requested, manifests);
    expect(graph.edges.get('core')).toBeDefined();
    expect(graph.edges.get('core').has('modX')).toBe(true);
  });

  it('does NOT mutate the input requestedIds array or manifestsMap', () => {
    const requested = ['modA', 'modB'];
    const manifests = new Map([
      ['moda', makeManifest('modA')],
      ['modb', makeManifest('modB', [{ id: 'modA' }])],
    ]);
    const snapReq = deepSnapshot(requested);
    const snapMan = deepSnapshot(manifests);
    buildDependencyGraph(requested, manifests);
    expect(deepSnapshot(requested)).toBe(snapReq);
    expect(deepSnapshot(manifests)).toBe(snapMan);
  });
});

/* ==================================================================== */
/* Ticket T‑3 – resolveOrder acceptance‑criteria unit tests               */
/* ==================================================================== */

describe('resolveOrder (Ticket T‑3)', () => {
  let mockLogger;

  beforeEach(() => {
    mockLogger = createMockLogger();
    jest.clearAllMocks();
  });

  it('requested=[A,B,C] with dependency B→A yields [core,A,B,C]', () => {
    const requested = ['A', 'B', 'C'];
    const manifests = new Map([
      ['a', makeManifest('A')],
      ['b', makeManifest('B', [{ id: 'A', required: true }])],
      ['c', makeManifest('C')],
    ]);
    const order = resolveOrder(requested, manifests, mockLogger);
    expect(order).toEqual(['core', 'A', 'B', 'C']);
  });

  it('cycle A↔B throws ModDependencyError containing both IDs', () => {
    const requested = ['A', 'B'];
    const manifests = new Map([
      ['a', makeManifest('A', [{ id: 'B', required: true }])],
      ['b', makeManifest('B', [{ id: 'A', required: true }])],
    ]);
    expect(() => resolveOrder(requested, manifests, mockLogger)).toThrow(
      ModDependencyError
    );
    try {
      resolveOrder(requested, manifests, mockLogger);
    } catch (e) {
      expect(e.message).toMatch(/A/);
      expect(e.message).toMatch(/B/);
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
    const order = resolveOrder(requested, manifests, mockLogger);
    const durationMs = Date.now() - start;

    // core + N mods
    expect(order.length).toBe(N + 1);
    // should finish well under a second on typical CI machines
    expect(durationMs).toBeLessThan(500);
  });
});

/* ==================================================================== */
/* Ticket T-4 – adjustment-log unit tests                                */
/* ==================================================================== */

describe('resolveOrder – adjustment-log (Ticket T-4)', () => {
  let mockLogger;

  beforeEach(() => {
    mockLogger = createMockLogger();
    jest.clearAllMocks();
  });

  it('emits a log when the resolver reorders mods', () => {
    const requested = ['B', 'A']; // invalid, B depends on A
    const manifests = new Map([
      ['a', makeManifest('A')],
      ['b', makeManifest('B', [{ id: 'A', required: true }])],
    ]);

    resolveOrder(requested, manifests, mockLogger);

    const logged = mockLogger.info.mock.calls.some(([msg]) =>
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

    resolveOrder(requested, manifests, mockLogger);

    const logged = mockLogger.info.mock.calls.some(([msg]) =>
      msg.includes('Mod load order adjusted to satisfy dependencies.')
    );
    expect(logged).toBe(false);
  });
});
