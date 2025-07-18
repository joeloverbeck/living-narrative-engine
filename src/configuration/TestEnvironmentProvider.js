/**
 * @file TestEnvironmentProvider - Test environment provider with configurable environment
 * @module TestEnvironmentProvider
 */

import { IEnvironmentProvider } from '../interfaces/IEnvironmentProvider.js';

/**
 * @class TestEnvironmentProvider
 * @augments {IEnvironmentProvider}
 * @description Test environment provider that allows configuration of environment values
 */
export class TestEnvironmentProvider extends IEnvironmentProvider {
  /** @type {import('../interfaces/IEnvironmentProvider.js').EnvironmentInfo} */
  #environment;

  /**
   * @param {object} [config] - Environment configuration
   * @param {string} [config.NODE_ENV] - Environment name
   * @param {boolean} [config.IS_PRODUCTION] - Production flag
   * @param {boolean} [config.IS_DEVELOPMENT] - Development flag
   * @param {boolean} [config.IS_TEST] - Test flag
   */
  constructor(config = {}) {
    super();

    const {
      NODE_ENV = 'test',
      IS_PRODUCTION = false,
      IS_DEVELOPMENT = false,
      IS_TEST = true,
    } = config;

    this.#environment = {
      NODE_ENV,
      IS_PRODUCTION,
      IS_DEVELOPMENT,
      IS_TEST,
    };
  }

  /**
   * @override
   * @returns {import('../interfaces/IEnvironmentProvider.js').EnvironmentInfo} Environment information
   */
  getEnvironment() {
    return { ...this.#environment };
  }

  /**
   * @override
   * @returns {boolean} True if production
   */
  isProduction() {
    return this.#environment.IS_PRODUCTION;
  }

  /**
   * @override
   * @returns {boolean} True if development
   */
  isDevelopment() {
    return this.#environment.IS_DEVELOPMENT;
  }

  /**
   * @override
   * @returns {boolean} True if test
   */
  isTest() {
    return this.#environment.IS_TEST;
  }

  /**
   * Updates the environment configuration.
   *
   * @param {Partial<import('../interfaces/IEnvironmentProvider.js').EnvironmentInfo>} config - New environment config
   */
  updateEnvironment(config) {
    this.#environment = { ...this.#environment, ...config };
  }
}
