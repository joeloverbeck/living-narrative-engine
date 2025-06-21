/**
 * @file Unit tests for constructor validation helpers.
 */

import { describe, it, expect, jest } from '@jest/globals';
import {
  buildMissingDependencyCases,
  describeConstructorValidation,
} from '../../common/constructorValidationHelpers.js';

/**
 *
 */
function createDeps() {
  return {
    logger: { info: jest.fn(), error: jest.fn() },
    service: { start: jest.fn(), stop: jest.fn() },
  };
}

const spec = {
  logger: { error: /logger/, methods: ['info', 'error'] },
  service: { error: /service/, methods: ['start'] },
};

describe('buildMissingDependencyCases', () => {
  const cases = buildMissingDependencyCases(createDeps, spec);

  it('generates a case for each missing dependency and method', () => {
    const descriptions = cases.map((c) => c[0]);
    expect(descriptions).toEqual([
      'missing logger',
      'missing logger.info',
      'missing logger.error',
      'missing service',
      'missing service.start',
    ]);
  });

  it('mutate functions remove properties as described', () => {
    const [, mutateLogger] = cases[0];
    const deps1 = createDeps();
    mutateLogger(deps1);
    expect(deps1.logger).toBeUndefined();

    const [, mutateMethod] = cases[1];
    const deps2 = createDeps();
    mutateMethod(deps2);
    expect(deps2.logger.info).toBeUndefined();
  });

  it('returns the expected error regex for each case', () => {
    for (const [, , regex] of cases) {
      expect(regex).toBeInstanceOf(RegExp);
    }
  });
});

describe('describeConstructorValidation', () => {
  class DummyClass {
    constructor(deps) {
      if (!deps.logger?.info || !deps.logger?.error) {
        throw new Error('logger');
      }
      if (!deps.service?.start) {
        throw new Error('service');
      }
    }
  }

  describeConstructorValidation(DummyClass, createDeps, spec);

  it('allows construction when all dependencies are present', () => {
    expect(() => new DummyClass(createDeps())).not.toThrow();
  });
});
