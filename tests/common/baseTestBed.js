/**
 * @file Provides a shared base class for unit test beds.
 */

import { jest } from '@jest/globals';
import { clearMockFunctions } from './jestHelpers.js';
import { createMockEnvironment } from './buildTestEnvironment.js';
import { runWithReset } from './testBedHelpers.js';

/**
 * @description Base class that stores mocks and exposes a reset helper.
 * @class
 */
export class BaseTestBed {
  /**
   * Creates a new BaseTestBed instance.
   *
   * @param {Record<string, object>} [mocks] - The mocks used by the test bed. Each
   *   provided mock is also assigned directly as a property on the instance for
   *   easier access.
   */
  constructor(mocks = {}) {
    /**
     * Collection of mocks used by the test bed.
     *
     * @type {Record<string, object>}
     * @private
     */
    this.mocks = mocks;

    Object.entries(mocks).forEach(([key, value]) => {
      this[key] = value;
    });
  }

  /**
   * Creates mocks from factory functions and returns them with a cleanup helper.
   *
   * @param {Record<string, () => any>} factoryMap - Map of mock factory functions.
   * @param {object} [extraProps] - Additional data merged into the result.
   * @returns {{ mocks: Record<string, any>, cleanup: () => void } & object}
   *   Generated mocks and cleanup function.
   */
  static fromFactories(factoryMap, extraProps = {}) {
    return { ...createMockEnvironment(factoryMap), ...extraProps };
  }

  /**
   * Initializes the test bed's mocks from factory functions.
   *
   * @param {Record<string, () => any>} factoryMap - Map of mock factory
   *   functions.
   * @returns {void}
   */
  initializeFromFactories(factoryMap) {
    const { mocks } = BaseTestBed.fromFactories(factoryMap);
    this.mocks = mocks;
    Object.entries(mocks).forEach(([k, v]) => {
      this[k] = v;
    });
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
   * Executes a callback and resets mocks when finished.
   *
   * @param {(bed: this) => (Promise<void>|void)} fn - Callback executed with this test bed.
   * @returns {Promise<void>} Resolves once the callback and reset logic complete.
   */
  async withReset(fn) {
    await runWithReset(this, fn);
  }

  /**
   * Performs setup before each test run.
   * Override this method in subclasses for custom setup logic.
   *
   * @returns {Promise<void>} Promise resolving when setup is complete.
   */
  async setup() {
    // Initialize basic services for subclasses
    this._initializeBasicServices();
    await this._afterSetup();
  }

  /**
   * Initialize basic services commonly needed by test beds
   *
   * @private
   */
  _initializeBasicServices() {
    // Create basic mock services if not already defined
    if (!this.logger) {
      this.logger = {
        debug: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        info: jest.fn(),
        log: jest.fn(),
      };
    }

    if (!this.eventDispatcher) {
      this.eventDispatcher = {
        dispatch: jest.fn(),
      };
    }

    if (!this.entityManager) {
      this.entityManager = {
        entities: new Map(),
        getEntityInstance: jest.fn((id) => this.entityManager.entities.get(id)),
        setComponentData: jest.fn((entityId, componentId, data) => {
          const entity = this.entityManager.entities.get(entityId);
          if (entity) {
            entity.components[componentId] = data;
          }
        }),
        getComponentData: jest.fn((entityId, componentId) => {
          const entity = this.entityManager.entities.get(entityId);
          return entity?.components?.[componentId] || null;
        }),
      };
    }
  }

  /**
   * Hook invoked at the end of {@link BaseTestBed#setup} for subclass-specific
   * setup logic.
   *
   * @protected
   * @returns {Promise<void>} Promise resolving when subclass setup is complete.
   */
  async _afterSetup() {}

  /**
   * Performs cleanup after each test run.
   *
   * @returns {Promise<void>} Promise resolving when cleanup is complete.
   */
  async cleanup() {
    jest.useRealTimers();
    jest.clearAllTimers();
    jest.clearAllMocks();
    this.resetMocks();
    await this._afterCleanup();
  }

  /**
   * Hook invoked at the end of {@link BaseTestBed#cleanup} for subclass-specific
   * teardown logic.
   *
   * @protected
   * @returns {Promise<void>} Promise resolving when subclass cleanup is complete.
   */
  async _afterCleanup() {}
}

export default BaseTestBed;
