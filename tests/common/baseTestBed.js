/**
 * @file Provides a shared base class for unit test beds.
 */

import { jest } from '@jest/globals';
import { clearMockFunctions } from './jestHelpers.js';

/**
 * @description Base class that stores mocks and exposes a reset helper.
 * @class
 */
export class BaseTestBed {
  /**
   * Creates a new BaseTestBed instance.
   *
   * @param {Record<string, object>} [mocks] - The mocks used by the test bed.
   */
  constructor(mocks = {}) {
    /**
     * Collection of mocks used by the test bed.
     *
     * @type {Record<string, object>}
     */
    this.mocks = mocks;
  }

  /**
   * Clears call history on all mocks stored in {@link BaseTestBed#mocks}.
   *
   * @returns {void}
   */
  resetMocks() {
    clearMockFunctions(...Object.values(this.mocks));
  }

  /**
   * Performs cleanup after each test run.
   *
   * @returns {Promise<void>} Promise resolving when cleanup is complete.
   */
  async cleanup() {
    jest.clearAllMocks();
    this.resetMocks();
  }
}

export default BaseTestBed;
