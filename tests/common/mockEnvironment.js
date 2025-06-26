/**
 * @file Utility for creating a mock environment for tests.
 */

import {
  createMockEnvironment,
  buildTestEnvironment,
} from './buildTestEnvironment.js';

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
export { createMockEnvironment };

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
export { buildTestEnvironment };

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
/**
 * Internal helper used by environment builders.
 *
 * @param {object} config - Configuration options.
 * @param {Record<string, () => any>} config.factoryMap
 * @param {Record<string | symbol, string | ((m: Record<string, any>) => any) | any>} config.tokenMap
 * @param {Record<string | symbol, any>} [config.overrides]
 * @param {(container: any, mocks: Record<string, any>) => any} [config.create]
 * @returns {{
 *   mocks: Record<string, any>,
 *   mockContainer: { resolve: jest.Mock },
 *   instance: any,
 *   cleanup: () => void,
 * }}
 *   Generated environment pieces.
 */
function _buildEnvironment({ factoryMap, tokenMap, overrides = {}, create }) {
  const { mocks, mockContainer, cleanup } = buildTestEnvironment(
    factoryMap,
    tokenMap,
    overrides
  );
  const instance = create ? create(mockContainer, mocks) : undefined;
  return { mocks, mockContainer, instance, cleanup };
}

/**
 *
 * @param root0
 * @param root0.factoryMap
 * @param root0.tokenMap
 * @param root0.overrides
 * @param root0.create
 */
export function buildEnvironment({
  factoryMap,
  tokenMap,
  overrides = {},
  create,
}) {
  return _buildEnvironment({ factoryMap, tokenMap, overrides, create });
}

/**
 * Creates a reusable test environment factory.
 *
 * @description Partially applies {@link buildEnvironment} with the provided
 *   factory and token maps plus an optional creation function. The returned
 *   function accepts overrides passed through to {@link buildEnvironment}.
 * @param {object} config - Builder configuration.
 * @param {Record<string, () => any>} config.factoryMap - Map of mock factory
 *   functions to create.
 * @param {Record<string | symbol, string | ((m: Record<string, any>) => any) | any>} config.tokenMap
 *   Map of DI tokens to mock keys, provider callbacks or constant values.
 * @param {(container: any, mocks: Record<string, any>) => any} [config.create]
 *   Function returning the system under test when provided the mock container
 *   and generated mocks.
 * @returns {(overrides?: Record<string | symbol, any>) => {
 *   mocks: Record<string, any>,
 *   mockContainer: { resolve: jest.Mock },
 *   instance: any,
 *   cleanup: () => void,
 * }} Function that builds the environment.
 */
export function createTestEnvironmentBuilder({ factoryMap, tokenMap, create }) {
  return function build(overrides = {}) {
    return _buildEnvironment({ factoryMap, tokenMap, overrides, create });
  };
}

/**
 * Builds and immediately returns a test environment for a service.
 *
 * @description Convenience helper around {@link createTestEnvironmentBuilder}
 *   that invokes the returned builder. Overrides can be supplied to alter
 *   token mappings per test.
 * @param {object} config - Configuration for building the environment.
 * @param {Record<string, () => any>} config.factoryMap - Map of mock factory
 *   functions to create.
 * @param {Record<string | symbol, string | ((m: Record<string, any>) => any) | any>} config.tokenMap
 *   Map of DI tokens to mock keys, provider callbacks or constant values.
 * @param {(container: any, mocks: Record<string, any>) => any} config.build
 *   Factory that constructs the system under test when provided the mock
 *   container and generated mocks.
 * @param {(mocks: Record<string, any>, container: any) => void} [config.setupMocks]
 *   Optional callback invoked before each service creation to allow adjustment
 *   of mocks.
 * @param {Record<string | symbol, any>} [config.overrides] - Per-test DI token
 *   overrides.
 * @returns {{
 *   mocks: Record<string, any>,
 *   mockContainer: { resolve: jest.Mock },
 *   instance: any,
 *   createInstance: () => any,
 *   cleanup: () => void,
 * }}
 *   Generated environment instance.
 */
export function createServiceTestEnvironment({
  factoryMap,
  tokenMap,
  build,
  setupMocks,
  overrides = {},
}) {
  const { mocks, mockContainer, instance, cleanup } = _buildEnvironment({
    factoryMap,
    tokenMap,
    overrides,
    create: (container, m) => {
      if (typeof setupMocks === 'function') {
        setupMocks(m, container);
      }
      return build(container, m);
    },
  });

  const createInstance = () => {
    if (typeof setupMocks === 'function') {
      setupMocks(mocks, mockContainer);
    }
    return build(mockContainer, mocks);
  };

  return { mocks, mockContainer, instance, createInstance, cleanup };
}

/**
 * Builds a test environment for a specific service using its constructor.
 *
 * @param {Record<string, () => any>} factoryMap - Map of mock factory functions.
 * @param {Record<string | symbol, string | ((m: Record<string, any>) => any) | any>} tokenMap - Map of DI tokens to mock keys or providers.
 * @param {new (args: {container: any, mocks?: Record<string, any>}) => any} serviceCtor - Constructor for the service under test.
 *   It is expected to accept an object with `container` and optionally `mocks`.
 * @param {Record<string | symbol, any>} [overrides] - Optional per-test token overrides for the container.
 * @param {(mocks: Record<string, any>, container: any) => void} [setupMocks] - Optional callback invoked before service creation to allow adjustment of mocks.
 * @returns {{
 *   mocks: Record<string, any>,
 *   mockContainer: { resolve: jest.Mock },
 *   service: any,
 *   createInstance: () => any,
 *   cleanup: () => void
 * }} Generated environment with the service instance.
 */
export function buildServiceEnvironment(factoryMap, tokenMap, serviceCtor, overrides = {}, setupMocks) {
  const { mocks, mockContainer, instance, cleanup, createInstance } = createServiceTestEnvironment({
    factoryMap,
    tokenMap,
    build: (container, localMocks) => new serviceCtor({ container, mocks: localMocks }),
    overrides,
    setupMocks,
  });
  return { mocks, mockContainer, service: instance, cleanup, createInstance };
}
