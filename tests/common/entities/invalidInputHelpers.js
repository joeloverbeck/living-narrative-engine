/**
 * @file Utility helpers for invalid input tests for EntityManager methods.
 * @see tests/common/entities/invalidInputHelpers.js
 */

import { TestData } from './testBed.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';

/**
 * Runs a parameterized test verifying how a method handles invalid entity and
 * component ID pairs.
 *
 * @description Helper for entity component methods like addComponent and
 * removeComponent that should throw InvalidArgumentError when called with invalid IDs.
 * @param {() => import('./testBed.js').TestBed} getBed - Callback to retrieve
 *   the active {@link TestBed} instance.
 * @param {(em: import('../../../src/entities/entityManager.js').default, instanceId: *, componentId: *) => *} method
 *   - Function that invokes the target EntityManager method.
 * @returns {void}
 */
export function runInvalidIdPairTests(getBed, method) {
  it.each(TestData.InvalidValues.invalidIdPairs)(
    'should throw InvalidArgumentError for invalid inputs',
    (instanceId, componentId) => {
      const { entityManager, mocks } = getBed();
      expect(() => method(entityManager, instanceId, componentId)).toThrow(InvalidArgumentError);
      expect(mocks.logger.warn).toHaveBeenCalled();
    }
  );
}

/**
 * Runs a parameterized test verifying how a method handles invalid entity IDs.
 *
 * @description Helper for entity methods like removeEntityInstance that should throw InvalidArgumentError when called with invalid IDs.
 * @param {() => import('./testBed.js').TestBed} getBed - Callback to retrieve
 *   the active {@link TestBed} instance.
 * @param {(em: import('../../../src/entities/entityManager.js').default, instanceId: *) => *} method
 *   - Function that invokes the target EntityManager method.
 * @returns {void}
 */
export function runInvalidEntityIdTests(getBed, method) {
  it.each(TestData.InvalidValues.invalidIds)(
    'should throw InvalidArgumentError for invalid instanceId %p',
    (invalidId) => {
      const { entityManager, mocks } = getBed();
      expect(() => method(entityManager, invalidId)).toThrow(InvalidArgumentError);
      expect(mocks.logger.warn).toHaveBeenCalled();
    }
  );
}
