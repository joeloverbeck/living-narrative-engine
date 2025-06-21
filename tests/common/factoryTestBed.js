/**
 * @file Provides a simple base class for creating mocks from factory functions.
 */

import BaseTestBed from './baseTestBed.js';

/**
 * @description Base class that automatically creates mocks from a factory map.
 * @class
 */
export class FactoryTestBed extends BaseTestBed {
  /**
   * @description Constructs the test bed using the provided factory map.
   * @param {Record<string, () => any>} factoryMap - Map of mock factory functions.
   */
  constructor(factoryMap = {}) {
    const { mocks } = BaseTestBed.fromFactories(factoryMap);
    super(mocks);
  }
}

export default FactoryTestBed;
