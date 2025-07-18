/**
 * @file ProcessEnvironmentProvider - Production environment provider that reads from process.env
 * @module ProcessEnvironmentProvider
 */

import { IEnvironmentProvider } from '../interfaces/IEnvironmentProvider.js';

/**
 * @class ProcessEnvironmentProvider
 * @augments {IEnvironmentProvider}
 * @description Production environment provider that reads from process.env
 */
export class ProcessEnvironmentProvider extends IEnvironmentProvider {
  /**
   * @override
   * @returns {import('../interfaces/IEnvironmentProvider.js').EnvironmentInfo} Environment information
   */
  getEnvironment() {
    const nodeEnv = globalThis.process?.env.NODE_ENV || 'development';

    return {
      NODE_ENV: nodeEnv,
      IS_PRODUCTION: nodeEnv === 'production',
      IS_DEVELOPMENT: nodeEnv === 'development',
      IS_TEST: nodeEnv === 'test',
    };
  }

  /**
   * @override
   * @returns {boolean} True if production
   */
  isProduction() {
    return this.getEnvironment().IS_PRODUCTION;
  }

  /**
   * @override
   * @returns {boolean} True if development
   */
  isDevelopment() {
    return this.getEnvironment().IS_DEVELOPMENT;
  }

  /**
   * @override
   * @returns {boolean} True if test
   */
  isTest() {
    return this.getEnvironment().IS_TEST;
  }
}
