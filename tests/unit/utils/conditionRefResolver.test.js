import { describe, it, expect, jest } from '@jest/globals';
import { resolveConditionRefs } from '../../../src/utils/conditionRefResolver.js';

/**
 * Helper for creating a fake repository that returns definitions by ID.
 *
 * @param {Record<string, any>} definitions
 */
function createRepository(definitions) {
  return {
    getConditionDefinition: jest.fn((conditionId) => definitions[conditionId] ?? null),
  };
}

describe('resolveConditionRefs', () => {
  it('returns primitive values unchanged', () => {
    const repo = createRepository({});
    const logger = { debug: jest.fn() };

    expect(resolveConditionRefs('literal', repo, logger)).toBe('literal');
    expect(resolveConditionRefs(42, repo, logger)).toBe(42);
    expect(resolveConditionRefs(null, repo, logger)).toBeNull();
  });

  it('resolves arrays by mapping each entry with isolated visited sets', () => {
    const repo = createRepository({
      condA: { logic: { result: 'A resolved' } },
    });
    const logger = { debug: 'not-a-function' }; // exercise branch when logger.debug is not callable

    const logic = [
      { condition_ref: 'condA' },
      { condition_ref: 'condA' },
    ];

    const resolved = resolveConditionRefs(logic, repo, logger);

    expect(resolved).toEqual([
      { result: 'A resolved' },
      { result: 'A resolved' },
    ]);
    expect(repo.getConditionDefinition).toHaveBeenCalledTimes(2);
  });

  it('logs and resolves referenced condition definitions recursively', () => {
    const repo = createRepository({
      alpha: {
        logic: {
          nested: { condition_ref: 'beta' },
        },
      },
      beta: {
        logic: { value: 'resolved' },
      },
    });
    const logger = { debug: jest.fn() };

    const resolved = resolveConditionRefs({ condition_ref: 'alpha' }, repo, logger);

    expect(resolved).toEqual({ nested: { value: 'resolved' } });
    expect(logger.debug).toHaveBeenCalledWith("Resolving condition_ref 'alpha'...");
    expect(logger.debug).toHaveBeenCalledWith("Resolving condition_ref 'beta'...");
    expect(repo.getConditionDefinition).toHaveBeenNthCalledWith(1, 'alpha');
    expect(repo.getConditionDefinition).toHaveBeenNthCalledWith(2, 'beta');
  });

  it('throws when condition_ref value is not a string', () => {
    const repo = createRepository({});
    const logger = { debug: jest.fn() };

    expect(() =>
      resolveConditionRefs({ condition_ref: 123 }, repo, logger)
    ).toThrow('Invalid condition_ref value: not a string.');
  });

  it('throws with a descriptive path when a circular reference is detected', () => {
    const repo = createRepository({
      first: { logic: { condition_ref: 'second' } },
      second: { logic: { condition_ref: 'first' } },
    });
    const logger = { debug: jest.fn() };

    expect(() =>
      resolveConditionRefs({ condition_ref: 'first' }, repo, logger)
    ).toThrow("Circular condition_ref detected. Path: first -> second -> first");
  });

  it.each([
    [null, "Could not resolve condition_ref 'missing'. Definition or its logic property not found."],
    [{}, "Could not resolve condition_ref 'missing'. Definition or its logic property not found."],
  ])('throws when repository does not return usable definition (%s)', (definition) => {
    const repo = createRepository({ missing: definition });
    const logger = { debug: jest.fn() };

    expect(() =>
      resolveConditionRefs({ condition_ref: 'missing' }, repo, logger)
    ).toThrow(
      "Could not resolve condition_ref 'missing'. Definition or its logic property not found."
    );
  });

  it('recursively resolves plain objects without sharing visited state between keys', () => {
    const repo = createRepository({
      shared: { logic: { outcome: 'ok' } },
    });
    const logger = { debug: jest.fn() };

    const logic = {
      first: { condition_ref: 'shared' },
      second: { condition_ref: 'shared' },
    };

    const resolved = resolveConditionRefs(logic, repo, logger);

    expect(resolved).toEqual({
      first: { outcome: 'ok' },
      second: { outcome: 'ok' },
    });
    expect(repo.getConditionDefinition).toHaveBeenCalledTimes(2);
  });
});
