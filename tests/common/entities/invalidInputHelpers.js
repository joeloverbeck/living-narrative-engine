/**
 * @file Utility helpers for invalid input tests for EntityManager methods.
 * @see tests/common/entities/invalidInputHelpers.js
 */

import { TestData } from './testBed.js';

/**
 * Runs a parameterized test verifying how a method handles invalid entity and
 * component ID pairs.
 *
 * @description Helper for entity component methods like addComponent and
 * removeComponent that should return a consistent value and log a warning when
 * called with invalid IDs.
 * @param {() => import('./testBed.js').TestBed} getBed - Callback to retrieve
 *   the active {@link TestBed} instance.
 * @param {(em: import('../../../src/entities/entityManager.js').default, instanceId: *, componentId: *) => *} method
 *   - Function that invokes the target EntityManager method.
 * @param {false|undefined} expected - Expected return value from the method
 *   when invalid IDs are supplied.
 * @returns {void}
 */
export function runInvalidIdPairTests(getBed, method, expected) {
  it.each(TestData.InvalidValues.invalidIdPairs)(
    'should return %p for invalid inputs',
    (instanceId, componentId) => {
      const { entityManager, mocks } = getBed();
      const result = method(entityManager, instanceId, componentId);
      expect(result).toBe(expected);
      expect(mocks.logger.warn).toHaveBeenCalled();
    }
  );
}
