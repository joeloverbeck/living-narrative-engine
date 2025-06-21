/**
 * @file Generic test bed for working with a DI container.
 */

import { jest } from '@jest/globals';
import BaseTestBed from './baseTestBed.js';

/**
 * @description Base class that manages a DI container and allows overriding
 * token resolution during tests.
 * @class
 */
export class ContainerTestBed extends BaseTestBed {
  /** @type {{ resolve: jest.Mock }} */
  container;
  /** @type {Map<any, any>} */
  #tokenOverrides = new Map();
  /** @type {Function} */
  #originalResolve;

  /**
   * @description Constructs the test bed with the provided container.
   * @param {{ resolve: jest.Mock }} container - DI container instance.
   * @param {Record<string, object>} [mocks] - Additional mocks to store.
   */
  constructor(container, mocks = {}) {
    super(mocks);
    this.container = container;
    this.#originalResolve =
      this.container.resolve.getMockImplementation?.() ??
      this.container.resolve;
  }

  /**
   * Temporarily overrides container token resolution.
   *
   * @param {any} token - Token to override.
   * @param {any | (() => any)} value - Replacement value or function.
   * @returns {void}
   */
  withTokenOverride(token, value) {
    this.#tokenOverrides.set(token, value);
    this.container.resolve.mockImplementation((tok) => {
      if (this.#tokenOverrides.has(tok)) {
        const override = this.#tokenOverrides.get(tok);
        return typeof override === 'function' ? override() : override;
      }
      return this.#originalResolve(tok);
    });
  }

  /**
   * Restores the container state and clears overrides.
   *
   * @returns {Promise<void>} Promise resolving when cleanup is complete.
   */
  async cleanup() {
    await super.cleanup();
  }

  /**
   * Restores the container state and clears overrides after base cleanup.
   *
   * @protected
   * @returns {Promise<void>} Promise resolving when container cleanup is complete.
   */
  async _afterCleanup() {
    this.container.resolve.mockImplementation(this.#originalResolve);
    this.#tokenOverrides.clear();
    await super._afterCleanup();
  }
}

export default ContainerTestBed;
