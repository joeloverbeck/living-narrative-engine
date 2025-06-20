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
   * Collection of mocks used by the test bed.
   *
   * @type {Record<string, object>}
   */
  mocks = {};

  /**
   * Clears call history on all mocks stored in {@link BaseTestBed#mocks}.
   *
   * @returns {void}
   */
  resetMocks() {
    jest.clearAllMocks();
    clearMockFunctions(...Object.values(this.mocks));
  }
}

export default BaseTestBed;
