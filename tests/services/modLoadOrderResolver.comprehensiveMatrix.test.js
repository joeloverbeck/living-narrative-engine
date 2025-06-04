// src/tests/core/services/modLoadOrderResolver.comprehensiveMatrix.test.js

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { resolveOrder } from '../../src/modding/modLoadOrderResolver.js';
import ModDependencyError from '../../src/errors/modDependencyError.js';

/**
 * Convenience factory for a minimal manifest object.
 *
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
 * Creates a mock logger instance matching the ILogger interface.
 *
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
 *
 * @returns {Map<string, import('../../src/modding/modDependencyValidator.js').ModManifest>}
 */
const createEmptyManifestMap = () => new Map();

/* ============================================================= */
/* Happy‑path matrix                                             */
/* ============================================================= */

describe('T‑7 Comprehensive Matrix – happy paths', () => {
  let logger;

  beforeEach(() => {
    logger = createMockLogger();
    jest.clearAllMocks();
  });

  it('single‑mod scenario: requested=[core] yields [core]', () => {
    const requested = ['core'];
    const manifests = new Map([['core', makeManifest('core')]]);
    const order = resolveOrder(requested, manifests, logger);
    expect(order).toEqual(['core']);
  });

  it('linear chain A→B→C resolves to [core,A,B,C]', () => {
    const requested = ['A', 'B', 'C'];
    const manifests = new Map([
      ['a', makeManifest('A')],
      ['b', makeManifest('B', [{ id: 'A', required: true }])],
      ['c', makeManifest('C', [{ id: 'B', required: true }])],
    ]);
    const order = resolveOrder(requested, manifests, logger);
    expect(order).toEqual(['core', 'A', 'B', 'C']);
  });

  it('branch graph (A→C, B→C) keeps original relative order', () => {
    const requested = ['A', 'B', 'C'];
    const manifests = new Map([
      ['a', makeManifest('A')],
      ['b', makeManifest('B')],
      [
        'c',
        makeManifest('C', [
          { id: 'A', required: true },
          { id: 'B', required: true },
        ]),
      ],
    ]);
    const order = resolveOrder(requested, manifests, logger);
    expect(order).toEqual(['core', 'A', 'B', 'C']);
  });

  it('optional dependency present – B (optional→A) with A requested', () => {
    const requested = ['A', 'B'];
    const manifests = new Map([
      ['a', makeManifest('A')],
      ['b', makeManifest('B', [{ id: 'A', required: false }])],
    ]);
    const order = resolveOrder(requested, manifests, logger);
    expect(order).toEqual(['core', 'A', 'B']);
  });

  it('optional dependency absent – B (optional→A) without A requested', () => {
    const requested = ['B'];
    const manifests = new Map([
      ['b', makeManifest('B', [{ id: 'A', required: false }])],
    ]);
    const order = resolveOrder(requested, manifests, logger);
    expect(order).toEqual(['core', 'B']);
    // ensure A was not implicitly introduced
    expect(order).not.toContain('A');
  });
});

/* ============================================================= */
/* Failure‑path matrix                                           */
/* ============================================================= */

describe('T‑7 Comprehensive Matrix – failure paths', () => {
  let logger;

  beforeEach(() => {
    logger = createMockLogger();
    jest.clearAllMocks();
  });

  it('cycle (two‑node A↔B) throws ModDependencyError', () => {
    const requested = ['A', 'B'];
    const manifests = new Map([
      ['a', makeManifest('A', [{ id: 'B', required: true }])],
      ['b', makeManifest('B', [{ id: 'A', required: true }])],
    ]);
    expect(() => resolveOrder(requested, manifests, logger)).toThrow(
      ModDependencyError
    );
  });

  it('cycle (three‑node A→B→C→A) throws ModDependencyError', () => {
    const requested = ['A', 'B', 'C'];
    const manifests = new Map([
      ['a', makeManifest('A', [{ id: 'B', required: true }])],
      ['b', makeManifest('B', [{ id: 'C', required: true }])],
      ['c', makeManifest('C', [{ id: 'A', required: true }])],
    ]);
    expect(() => resolveOrder(requested, manifests, logger)).toThrow(
      ModDependencyError
    );
  });

  it('missing required dependency (B→A, A absent) throws ModDependencyError', () => {
    const requested = ['B'];
    const manifests = new Map([
      ['b', makeManifest('B', [{ id: 'A', required: true }])],
      // note: no manifest for A provided
    ]);
    expect(() => resolveOrder(requested, manifests, logger)).toThrow(
      ModDependencyError
    );
  });

  it('core omitted from requestedIds is injected automatically', () => {
    const requested = ['A'];
    const manifests = new Map([['a', makeManifest('A')]]);
    const order = resolveOrder(requested, manifests, logger);
    expect(order[0].toLowerCase()).toBe('core');
    expect(order).toEqual(['core', 'A']);
  });
});
