/**
 * @file Generic test bed for working with a DI container.
 */

import { jest } from '@jest/globals';
import BaseTestBed from './baseTestBed.js';
import { TokenOverrideMixin } from './tokenOverrideMixin.js';

/**
 * @description Base class that manages a DI container and allows overriding
 * token resolution during tests.
 * @class
 */
export class ContainerTestBed extends TokenOverrideMixin(BaseTestBed) {
  /** @type {{ resolve: jest.Mock }} */
  container;

  /**
   * @description Constructs the test bed with the provided container.
   * @param {{ resolve: jest.Mock }} container - DI container instance.
   * @param {Record<string, object>} [mocks] - Additional mocks to store.
   */
  constructor(container, mocks = {}) {
    super(mocks);
    this.container = container;
    this._initTokenOverrides(container);
  }
}
export default ContainerTestBed;
