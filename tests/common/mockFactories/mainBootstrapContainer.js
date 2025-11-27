/**
 * @file Factory for creating mock containers for main.js bootstrap tests.
 * @description Provides properly configured container mocks with resolve mappings
 * required by bootstrap stages. Update this file when new bootstrap stages are added.
 */

import { jest } from '@jest/globals';

/**
 * Creates a mock container for main.js bootstrap tests.
 * Includes all resolve mappings required by bootstrap stages.
 *
 * @param {object} [overrides] - Override specific token mappings
 * @returns {object} Mock container with resolve method
 */
export function createMainBootstrapContainerMock(overrides = {}) {
  // Default mocks for services resolved during bootstrap
  const defaultMocks = {
    HandlerCompletenessValidator: {
      validateHandlerRegistryCompleteness: jest.fn().mockReturnValue({
        isComplete: true,
        missingHandlers: [],
        orphanedHandlers: [],
      }),
    },
    OperationRegistry: {
      getRegisteredTypes: jest.fn().mockReturnValue([]),
    },
  };

  const mocks = { ...defaultMocks, ...overrides };

  return {
    resolve: jest.fn((token) => {
      if (mocks[token]) return mocks[token];
      return {};
    }),
  };
}

export default createMainBootstrapContainerMock;
