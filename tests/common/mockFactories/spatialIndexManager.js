import { createSimpleMock } from './coreServices.js';

/**
 * @file Factory for SpatialIndexManager mocks used in tests.
 * @see tests/common/mockFactories/spatialIndexManager.js
 */

/**
 * Creates a mock implementation of {@link module:ISpatialIndexManager}.
 *
 * @description Provides jest.fn stubs for the basic spatial index methods.
 * @returns {object} Mocked spatial index manager with jest.fn methods.
 */
export function createMockSpatialIndexManager() {
  return createSimpleMock([
    'addEntity',
    'removeEntity',
    'updateEntityLocation',
    'clearIndex',
    'getEntitiesInLocation',
  ]);
}
