/**
 * @file Utility for creating a mock environment for tests.
 */

import { jest } from '@jest/globals';
import { createMockContainer } from './mockFactories';

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

/**
 * Builds a full test environment including a mock DI container.
 *
 * @description Creates mocks from the provided factory map and sets up a mock
 *   DI container resolving tokens to those mocks. Overrides allow per-test
 *   replacements similar to {@link createMockContainer}.
 * @param {Record<string, () => any>} factoryMap - Map of mock factory
 *   functions to create.
 * @param {Record<string | symbol, string | ((m: Record<string, any>) => any) | any>} tokenMap
 *   Map of DI tokens to mock keys, provider callbacks, or constant values.
 * @param {Record<string | symbol, any>} [overrides] - Optional per-test token
 *   overrides for the container.
 * @returns {{ mocks: Record<string, any>, mockContainer: { resolve: jest.Mock }, cleanup: () => void }}
 *   Mocks, container and cleanup helper.
 */
export function buildTestEnvironment(factoryMap, tokenMap, overrides = {}) {
  const { mocks, cleanup } = createMockEnvironment(factoryMap);

  const mapping = {};
  for (const [token, ref] of Object.entries(tokenMap)) {
    if (typeof ref === 'string') {
      mapping[token] = mocks[ref];
    } else if (typeof ref === 'function') {
      mapping[token] = ref(mocks);
    } else {
      mapping[token] = ref;
    }
  }

  const mockContainer = createMockContainer(mapping, overrides);

  return { mocks, mockContainer, cleanup };
}

/**
 * Builds and optionally instantiates a test environment.
 *
 * @description Wrapper around {@link buildTestEnvironment} that also
 *   constructs an instance of the system under test using the provided
 *   creation callback.
 * @param {Record<string, () => any>} factoryMap - Map of mock factory
 *   functions to create.
 * @param {Record<string | symbol, string | ((m: Record<string, any>) => any) | any>} tokenMap
 *   Map of DI tokens to mock keys, provider callbacks, or constant values.
 * @param {Record<string | symbol, any>} [overrides] - Optional per-test token
 *   overrides for the container.
 * @param {(container: any, mocks: Record<string, any>) => any} [createFn]
 *   Function that returns the system under test when provided the mock
 *   container and generated mocks.
 * @returns {{
 *   mocks: Record<string, any>,
 *   mockContainer: { resolve: jest.Mock },
 *   instance: any,
 *   cleanup: () => void,
 * }}
 *   Mocks, container, optionally created instance and cleanup helper.
 */
export function buildEnvironment(
  factoryMap,
  tokenMap,
  overrides = {},
  createFn
) {
  const { mocks, mockContainer, cleanup } = buildTestEnvironment(
    factoryMap,
    tokenMap,
    overrides
  );
  const instance = createFn ? createFn(mockContainer, mocks) : undefined;
  return { mocks, mockContainer, instance, cleanup };
}
