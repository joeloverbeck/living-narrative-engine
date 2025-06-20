/**
 * @file Utility for creating a mock environment for tests.
 */

import { jest } from '@jest/globals';

/**
 * Creates mocks using the provided factory functions.
 *
 * @description Given a mapping of keys to factory functions, this helper
 *   instantiates each mock and returns them along with a cleanup function
 *   that clears and restores jest mocks.
 * @param {Record<string, () => any>} factories - Map of mock factory functions.
 * @returns {{ mocks: Record<string, any>, cleanup: () => void }}
 *   Generated mocks and a cleanup method.
 */
export function createMockEnvironment(factories) {
  jest.clearAllMocks();

  const mocks = {};
  for (const [name, factory] of Object.entries(factories)) {
    mocks[name] = factory();
  }

  const cleanup = () => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  };

  return { mocks, cleanup };
}
