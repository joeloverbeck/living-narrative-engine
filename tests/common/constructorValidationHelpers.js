/* eslint-env jest */
/* global describe, test, expect */
/**
 * @file Utilities for generating constructor validation test cases.
 *
 * Usage:
 *   const cases = buildMissingDependencyCases(createDeps, {
 *     logger: { error: /logger/, methods: ['info'] }
 *   });
 *   it.each(cases)('%s', (desc, mutate, regex) => {
 *     const deps = createDeps();
 *     mutate(deps);
 *     expect(() => new MyClass(deps)).toThrow(regex);
 *   });
 */

/**
 * Builds test cases for missing dependency scenarios.
 *
 * @description Accepts a factory returning valid dependency objects and a
 * specification describing expected error patterns and required methods for
 * each dependency. Returns an array of cases suitable for `it.each` where each
 * case is `[description, mutateFn, expectedError]`.
 * @param {() => Record<string, any>} factoryFn - Produces valid dependencies.
 * @param {Record<string, {error: RegExp, methods: string[]}>} spec - Mapping of
 *   dependency keys to validation info.
 * @returns {Array<[string, (deps: Record<string, any>) => void, RegExp]>}
 *   Generated test cases.
 */
export function buildMissingDependencyCases(factoryFn, spec) {
  /** @type {Array<[string, (deps: Record<string, any>) => void, RegExp]>} */
  const cases = [];
  for (const [depKey, { error, methods }] of Object.entries(spec)) {
    cases.push([
      `missing ${depKey}`,
      (deps) => {
        delete deps[depKey];
      },
      error,
    ]);
    for (const method of methods) {
      cases.push([
        `missing ${depKey}.${method}`,
        (deps) => {
          if (deps[depKey]) {
            delete deps[depKey][method];
          }
        },
        error,
      ]);
    }
  }
  return cases;
}

/**
 * Defines a describe block verifying constructor dependency checks.
 *
 * @description Generates cases via {@link buildMissingDependencyCases} and
 * asserts that constructing {@code Class} throws when required dependencies are
 * missing.
 * @param {Function} Class - Constructor under test.
 * @param {() => Record<string, any>} createDeps - Factory for valid dependencies.
 * @param {Record<string, {error: RegExp, methods: string[]}>} spec - Dependency
 *   specification.
 * @returns {void}
 */
export function describeConstructorValidation(Class, createDeps, spec) {
  describe('constructor validation', () => {
    const cases = buildMissingDependencyCases(createDeps, spec);
    test.each(cases)('throws when %s', (_d, mutate, regex) => {
      const deps = createDeps();
      mutate(deps);
      expect(() => new Class(deps)).toThrow(regex);
    });
  });
}
