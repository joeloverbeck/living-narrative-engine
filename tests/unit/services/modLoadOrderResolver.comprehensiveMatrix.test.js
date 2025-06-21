// src/tests/services/modLoadOrderResolver.comprehensiveMatrix.test.js

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

/* ============================================================= */
/* Happy-path matrix                                             */
/* ============================================================= */

describe('T-7 Comprehensive Matrix – happy paths', () => {
  let logger;
  let resolver;

  beforeEach(() => {
    logger = createMockLogger();
    resolver = new ModLoadOrderResolver(logger);
    jest.clearAllMocks();
  });

  it('single-mod scenario: requested=[core] yields [core]', () => {
    const requested = [CORE_MOD_ID];
    const manifests = new Map([[CORE_MOD_ID, makeManifest(CORE_MOD_ID)]]);
    const order = resolver.resolve(requested, manifests);
    expect(order).toEqual([CORE_MOD_ID]);
  });

  it('linear chain A→B→C resolves to [core,A,B,C]', () => {
    const requested = ['A', 'B', 'C'];
    const manifests = new Map([
      ['a', makeManifest('A')],
      ['b', makeManifest('B', [{ id: 'A', required: true }])],
      ['c', makeManifest('C', [{ id: 'B', required: true }])],
    ]);
    const order = resolver.resolve(requested, manifests);
    expect(order).toEqual([CORE_MOD_ID, 'A', 'B', 'C']);
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
    const order = resolver.resolve(requested, manifests);
    expect(order).toEqual([CORE_MOD_ID, 'A', 'B', 'C']);
  });

  it('optional dependency present – B (optional→A) with A requested', () => {
    const requested = ['A', 'B'];
    const manifests = new Map([
      ['a', makeManifest('A')],
      ['b', makeManifest('B', [{ id: 'A', required: false }])],
    ]);
    const order = resolver.resolve(requested, manifests);
    expect(order).toEqual([CORE_MOD_ID, 'A', 'B']);
  });

  it('optional dependency absent – B (optional→A) without A requested', () => {
    const requested = ['B'];
    const manifests = new Map([
      ['a', makeManifest('A')], // Manifest for A exists
      ['b', makeManifest('B', [{ id: 'A', required: false }])],
    ]);
    const order = resolver.resolve(requested, manifests);
    expect(order).toEqual([CORE_MOD_ID, 'B']);
    // ensure A was not implicitly introduced
    expect(order).not.toContain('A');
  });
});

/* ============================================================= */
/* Failure-path matrix                                           */
/* ============================================================= */

describe('T-7 Comprehensive Matrix – failure paths', () => {
  let logger;
  let resolver;

  beforeEach(() => {
    logger = createMockLogger();
    resolver = new ModLoadOrderResolver(logger);
    jest.clearAllMocks();
  });

  it('cycle (two-node A↔B) throws ModDependencyError', () => {
    const requested = ['A', 'B'];
    const manifests = new Map([
      ['a', makeManifest('A', [{ id: 'B', required: true }])],
      ['b', makeManifest('B', [{ id: 'A', required: true }])],
    ]);
    expect(() => resolver.resolve(requested, manifests)).toThrow(
      ModDependencyError
    );
  });

  it('cycle (three-node A→B→C→A) throws ModDependencyError', () => {
    const requested = ['A', 'B', 'C'];
    const manifests = new Map([
      ['a', makeManifest('A', [{ id: 'B', required: true }])],
      ['b', makeManifest('B', [{ id: 'C', required: true }])],
      ['c', makeManifest('C', [{ id: 'A', required: true }])],
    ]);
    expect(() => resolver.resolve(requested, manifests)).toThrow(
      ModDependencyError
    );
  });

  it('missing required dependency (B→A, A absent) throws ModDependencyError', () => {
    const requested = ['B'];
    const manifests = new Map([
      ['b', makeManifest('B', [{ id: 'A', required: true }])],
      // note: no manifest for A provided
    ]);
    expect(() => resolver.resolve(requested, manifests)).toThrow(
      ModDependencyError
    );
  });

  it('core omitted from requestedIds is injected automatically', () => {
    const requested = ['A'];
    const manifests = new Map([['a', makeManifest('A')]]);
    const order = resolver.resolve(requested, manifests);
    expect(order[0].toLowerCase()).toBe(CORE_MOD_ID);
    expect(order).toEqual([CORE_MOD_ID, 'A']);
  });
});