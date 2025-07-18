/**
 * @file IEnvironmentProvider - Interface for environment configuration providers
 * @module IEnvironmentProvider
 */

/**
 * @typedef {object} EnvironmentInfo
 * @property {string} NODE_ENV - Current environment (development, production, test)
 * @property {boolean} IS_PRODUCTION - True if production environment
 * @property {boolean} IS_DEVELOPMENT - True if development environment
 * @property {boolean} IS_TEST - True if test environment
 */

/**
 * @interface IEnvironmentProvider
 * @description Interface for providing environment configuration
 */
export class IEnvironmentProvider {
  /**
   * Gets the current environment information.
   *
   * @returns {EnvironmentInfo} Environment information
   */
  getEnvironment() {
    throw new Error('IEnvironmentProvider.getEnvironment must be implemented');
  }

  /**
   * Checks if running in production environment.
   *
   * @returns {boolean} True if production
   */
  isProduction() {
    throw new Error('IEnvironmentProvider.isProduction must be implemented');
  }

  /**
   * Checks if running in development environment.
   *
   * @returns {boolean} True if development
   */
  isDevelopment() {
    throw new Error('IEnvironmentProvider.isDevelopment must be implemented');
  }

  /**
   * Checks if running in test environment.
   *
   * @returns {boolean} True if test
   */
  isTest() {
    throw new Error('IEnvironmentProvider.isTest must be implemented');
  }
}
