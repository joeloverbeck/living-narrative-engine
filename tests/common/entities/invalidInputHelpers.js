/**
 * @file Utility helpers for invalid input tests for EntityManager methods.
 * @see tests/common/entities/invalidInputHelpers.js
 */
/* eslint-env jest */
/* global it, expect */

import { TestData } from './testData.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';

/**
 * Runs a parameterized test for a list of invalid inputs.
 *
 * @description Private helper used by the exported test helpers to avoid
 *   repeating the same `it.each` logic.
 * @param {Array<*>|Array<Array<*>>} values - Invalid values to iterate over.
 * @param {string} message - Test description passed to `it.each`.
 * @param {() => import('./entityManagerTestBed.js').EntityManagerTestBed} getBed - Callback returning the
 *   active {@link EntityManagerTestBed} instance.
 * @param {(em: import('../../../src/entities/entityManager.js').default,
 *   ...args: any[]) => any} invoke - Function that calls the method under test
 *   using the provided EntityManager instance.
 * @returns {void}
 */
function runInvalidCases(values, message, getBed, invoke) {
  it.each(values)(message, async (...args) => {
    const { entityManager, mocks } = getBed();
    // Check if the method returns a promise
    const result = invoke(entityManager, ...args);
    if (result && typeof result.then === 'function') {
      await expect(result).rejects.toThrow(InvalidArgumentError);
    } else {
      expect(() => result).toThrow(InvalidArgumentError);
    }
    expect(mocks.logger.warn).toHaveBeenCalled();
  });
}

/**
 * Generates a test function verifying that a method throws for invalid inputs.
 *
 * @description Factory used to create helpers for checking InvalidArgumentError
 *   handling in EntityManager methods.
 * @param {Array<*>|Array<Array<*>>} values - Invalid values passed to `it.each`.
 * @param {string} message - Description used in the generated test.
 * @returns {(getBed: () => import('./entityManagerTestBed.js').EntityManagerTestBed,
 *   invoke: (em: import('../../../src/entities/entityManager.js').default,
 *   ...args: any[]) => any) => void} Function executing the parameterized test.
 */
function createInvalidInputTest(values, message) {
  return (getBed, invoke) => runInvalidCases(values, message, getBed, invoke);
}

/**
 * Runs a parameterized test verifying how a method handles invalid entity and
 * component ID pairs.
 *
 * @description Helper for entity component methods like addComponent and
 * removeComponent that should throw InvalidArgumentError when called with invalid IDs.
 * @param {() => import('./entityManagerTestBed.js').EntityManagerTestBed} getBed - Callback to retrieve
 *   the active {@link EntityManagerTestBed} instance.
 * @param {(em: import('../../../src/entities/entityManager.js').default, instanceId: *, componentId: *) => *} invoke
 *   - Function that invokes the target EntityManager method.
 * @returns {void}
 */
export function runInvalidIdPairTests(getBed, invoke) {
  it.each(TestData.InvalidValues.invalidIdPairs)(
    'should throw InvalidArgumentError for invalid inputs',
    async (instanceId, componentId) => {
      const { entityManager, mocks } = getBed();
      let error;
      try {
        const result = invoke(entityManager, instanceId, componentId);
        if (result && typeof result.then === 'function') {
          await result;
        }
      } catch (err) {
        error = err;
      }
      expect(error).toBeInstanceOf(InvalidArgumentError);
      expect(error.message).toContain('Invalid ID:');
      expect(mocks.logger.error).toHaveBeenCalled();
    }
  );
}

/**
 * Runs a parameterized test verifying how a method handles invalid entity IDs.
 *
 * @description Helper for entity methods like removeEntityInstance that should throw InvalidArgumentError when called with invalid IDs.
 * @param {() => import('./entityManagerTestBed.js').EntityManagerTestBed} getBed - Callback to retrieve
 *   the active {@link EntityManagerTestBed} instance.
 * @param {(em: import('../../../src/entities/entityManager.js').default, instanceId: *) => *} invoke
 *   - Function that invokes the target EntityManager method.
 * @returns {void}
 */
export function runInvalidEntityIdTests(getBed, invoke) {
  createInvalidInputTest(
    TestData.InvalidValues.invalidIds,
    'should throw InvalidArgumentError for invalid instanceId %p'
  )(getBed, invoke);
}

/**
 * Runs a parameterized test verifying how a method handles invalid definition IDs.
 *
 * @description Helper for methods that accept a definitionId and should throw
 * InvalidArgumentError when called with invalid IDs.
 * @param {() => import('./entityManagerTestBed.js').EntityManagerTestBed} getBed - Callback to retrieve
 *   the active {@link EntityManagerTestBed} instance.
 * @param {(em: import('../../../src/entities/entityManager.js').default, definitionId: *) => *} invoke
 *   - Function that invokes the target EntityManager method.
 * @returns {void}
 */
export function runInvalidDefinitionIdTests(getBed, invoke) {
  createInvalidInputTest(
    TestData.InvalidValues.invalidDefinitionIds,
    'should throw InvalidArgumentError for invalid definitionId %p'
  )(getBed, invoke);
}

/**
 * Asserts that invoking {@code fn} throws the expected error type and message.
 *
 * @param {Function} fn - Function expected to throw.
 * @param {new (...args: any[]) => Error} ErrorClass - Expected error constructor.
 * @param {string|RegExp} message - Message substring or regex expected in the error.
 * @returns {void}
 */
export function expectErrorWithMessage(fn, ErrorClass, message) {
  let error;
  try {
    fn();
  } catch (err) {
    error = err;
  }
  expect(error).toBeInstanceOf(ErrorClass);
  if (message instanceof RegExp) {
    expect(error.message).toMatch(message);
  } else {
    expect(error.message).toContain(message);
  }
}

/**
 * Asserts that the provided async function rejects with the expected error type
 * and message.
 *
 * @param {Function} asyncFn - Async function expected to reject.
 * @param {new (...args: any[]) => Error} ErrorClass - Expected error constructor.
 * @param {string|RegExp} message - Expected error message substring or regex.
 * @returns {Promise<void>}
 */
export async function expectAsyncErrorWithMessage(
  asyncFn,
  ErrorClass,
  message
) {
  let error;
  try {
    await asyncFn();
  } catch (err) {
    error = err;
  }
  expect(error).toBeInstanceOf(ErrorClass);
  if (message instanceof RegExp) {
    expect(error.message).toMatch(message);
  } else {
    expect(error.message).toContain(message);
  }
}
