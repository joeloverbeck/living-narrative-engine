/**
 * @file ITestModule - Base interface for all test modules
 * @description Defines the contract that all test module implementations must follow
 */

/**
 * @typedef {object} ValidationResult
 * @property {boolean} valid - Whether the configuration is valid
 * @property {Array<{field: string, message: string, code?: string}>} errors - Validation errors
 * @property {Array<{field: string, message: string, code?: string}>} [warnings] - Validation warnings
 */

/**
 * @typedef {object} TestEnvironment
 * @property {object} world - The test world configuration
 * @property {object} actors - The test actors
 * @property {object} config - The configuration used to build the environment
 * @property {object} facades - The facade instances
 * @property {Function} executeAITurn - Execute an AI turn
 * @property {Function} cleanup - Cleanup function
 * @property {Function} [getCapturedEvents] - Get captured events (if event capture enabled)
 * @property {Function} [getPerformanceMetrics] - Get performance metrics (if performance tracking enabled)
 */

/**
 * Base interface for all test modules.
 * This class defines the contract that all test module implementations must follow.
 * 
 * @abstract
 * @interface ITestModule
 */
export class ITestModule {
  /**
   * Builds and returns the configured test environment.
   * This method should validate the configuration and create all necessary
   * test resources based on the module's configuration.
   * 
   * @abstract
   * @returns {Promise<TestEnvironment>} The configured test environment
   * @throws {TestModuleValidationError} If configuration is invalid
   */
  async build() {
    throw new Error('ITestModule.build() must be implemented by subclass');
  }

  /**
   * Validates the current configuration without building.
   * This allows tests to check configuration validity before attempting to build.
   * 
   * @abstract
   * @returns {ValidationResult} The validation result
   */
  validate() {
    throw new Error('ITestModule.validate() must be implemented by subclass');
  }

  /**
   * Resets the module to its default configuration.
   * This is useful for test cleanup or when reusing a module instance.
   * 
   * @abstract
   * @returns {ITestModule} The module instance for chaining
   */
  reset() {
    throw new Error('ITestModule.reset() must be implemented by subclass');
  }

  /**
   * Gets the current configuration (read-only).
   * This is useful for debugging or asserting on configuration in tests.
   * 
   * @abstract
   * @returns {object} A frozen copy of the current configuration
   */
  getConfiguration() {
    throw new Error('ITestModule.getConfiguration() must be implemented by subclass');
  }

  /**
   * Clones the current module with its configuration.
   * This allows creating variations of a configured module.
   * 
   * @abstract
   * @returns {ITestModule} A new instance with the same configuration
   */
  clone() {
    throw new Error('ITestModule.clone() must be implemented by subclass');
  }
}