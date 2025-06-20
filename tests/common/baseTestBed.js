/**
 * @file Provides a base test bed class with common mock management utilities.
 * @see tests/common/baseTestBed.js
 */

import { jest } from '@jest/globals';
import { clearMockFunctions } from './jestHelpers.js';

/**
 * Base class for test beds that store and reset mocks.
 *
 * @class
 */
export class BaseTestBed {
  /** @type {Record<string, any>} */
  mocks;

  /**
   * Constructs the base test bed.
   *
   * @param {Record<string, any>} [mocks] - Collection of mocks to manage.
   */
  constructor(mocks = {}) {
    this.mocks = mocks;
  }

  /**
   * Clears call history on all managed mocks.
   *
   * @returns {void} Nothing.
   */
  resetMocks() {
    clearMockFunctions(...Object.values(this.mocks));
  }

  /**
   * Clears all Jest mocks then resets managed mocks. Intended to be overridden
   * by subclasses for additional cleanup.
   *
   * @returns {Promise<void>} Resolves when cleanup is finished.
   */
  async cleanup() {
    jest.clearAllMocks();
    this.resetMocks();
  }
}

export default BaseTestBed;
