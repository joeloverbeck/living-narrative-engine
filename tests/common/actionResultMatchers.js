/**
 * @file Custom Jest matchers for ActionResult testing
 * @see src/actions/core/actionResult.js
 */

import { expect } from '@jest/globals';

/**
 * Deep equality check for objects
 *
 * @param {*} a - First value
 * @param {*} b - Second value
 * @returns {boolean} True if deeply equal
 */
function deepEqual(a, b) {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a !== 'object' || typeof b !== 'object') return false;

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);

  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    if (!keysB.includes(key)) return false;
    if (!deepEqual(a[key], b[key])) return false;
  }

  return true;
}

/**
 * Custom Jest matchers for ActionResult
 */
export const actionResultMatchers = {
  /**
   * Matches a successful ActionResult with expected value
   *
   * @param {ActionResult} received - The ActionResult to test
   * @param {*} expectedValue - The expected value
   * @returns {object} Jest matcher result
   */
  toBeSuccessfulActionResult(received, expectedValue) {
    const pass =
      received != null &&
      received.success === true &&
      deepEqual(received.value, expectedValue);

    const message = () => {
      if (pass) {
        return `Expected ActionResult not to be successful with value ${JSON.stringify(
          expectedValue
        )}, but it was`;
      }

      if (!received) {
        return `Expected a successful ActionResult with value ${JSON.stringify(
          expectedValue
        )}, but received ${received}`;
      }

      if (!received.success) {
        return `Expected a successful ActionResult with value ${JSON.stringify(
          expectedValue
        )}, but it was a failure with errors: ${JSON.stringify(
          received.errors
        )}`;
      }

      return `Expected ActionResult value to be ${JSON.stringify(
        expectedValue
      )}, but it was ${JSON.stringify(received.value)}`;
    };

    return { pass, message };
  },

  /**
   * Matches a failed ActionResult with expected errors
   *
   * @param {ActionResult} received - The ActionResult to test
   * @param {Array} expectedErrors - The expected errors (or error messages)
   * @returns {object} Jest matcher result
   */
  toBeFailedActionResult(received, expectedErrors) {
    // Allow flexibility in what constitutes expected errors
    const normalizeErrors = (errors) => {
      if (!Array.isArray(errors)) return [];
      return errors.map((err) => {
        if (typeof err === 'string') return err;
        if (err instanceof Error) return err.message;
        if (err.message) return err.message;
        if (err.error) return err.error.message || err.error;
        return err;
      });
    };

    const receivedErrors = received?.errors
      ? normalizeErrors(received.errors)
      : [];
    const expectedErrorMessages = normalizeErrors(expectedErrors);

    const pass =
      received != null &&
      received.success === false &&
      deepEqual(receivedErrors, expectedErrorMessages);

    const message = () => {
      if (pass) {
        return `Expected ActionResult not to be failed with errors ${JSON.stringify(
          expectedErrorMessages
        )}, but it was`;
      }

      if (!received) {
        return `Expected a failed ActionResult with errors ${JSON.stringify(
          expectedErrorMessages
        )}, but received ${received}`;
      }

      if (received.success) {
        return `Expected a failed ActionResult with errors ${JSON.stringify(
          expectedErrorMessages
        )}, but it was successful with value: ${JSON.stringify(received.value)}`;
      }

      return `Expected ActionResult errors to be ${JSON.stringify(
        expectedErrorMessages
      )}, but they were ${JSON.stringify(receivedErrors)}`;
    };

    return { pass, message };
  },

  /**
   * Matches any successful ActionResult regardless of value
   *
   * @param {ActionResult} received - The ActionResult to test
   * @returns {object} Jest matcher result
   */
  toBeSuccessfulActionResultWithAnyValue(received) {
    const pass = received != null && received.success === true;

    const message = () => {
      if (pass) {
        return `Expected ActionResult not to be successful, but it was successful with value: ${JSON.stringify(
          received.value
        )}`;
      }

      if (!received) {
        return `Expected a successful ActionResult, but received ${received}`;
      }

      return `Expected a successful ActionResult, but it was a failure with errors: ${JSON.stringify(
        received.errors
      )}`;
    };

    return { pass, message };
  },

  /**
   * Matches any failed ActionResult regardless of errors
   *
   * @param {ActionResult} received - The ActionResult to test
   * @returns {object} Jest matcher result
   */
  toBeFailedActionResultWithAnyError(received) {
    const pass =
      received != null &&
      received.success === false &&
      received.errors &&
      received.errors.length > 0;

    const message = () => {
      if (pass) {
        return `Expected ActionResult not to be failed, but it was failed with errors: ${JSON.stringify(
          received.errors
        )}`;
      }

      if (!received) {
        return `Expected a failed ActionResult, but received ${received}`;
      }

      if (received.success) {
        return `Expected a failed ActionResult, but it was successful with value: ${JSON.stringify(
          received.value
        )}`;
      }

      return `Expected a failed ActionResult with errors, but errors were: ${JSON.stringify(
        received.errors
      )}`;
    };

    return { pass, message };
  },
};

/**
 * Extends Jest's expect with custom ActionResult matchers
 */
export function extendExpectWithActionResultMatchers() {
  expect.extend(actionResultMatchers);
}

// Auto-extend when imported
extendExpectWithActionResultMatchers();

export default actionResultMatchers;
