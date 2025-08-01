/**
 * @file Error classes for dependency validation failures
 * @description Custom error types for enhanced dependency validation system
 */

/**
 * Error thrown when a required dependency is missing
 */
export class MissingDependencyError extends Error {
  /**
   * Creates a new MissingDependencyError instance
   *
   * @param {string} dependencyName - Name of the missing dependency
   * @param {string} controllerName - Name of the controller that requires the dependency
   */
  constructor(dependencyName, controllerName) {
    super(`${controllerName}: Missing required dependency '${dependencyName}'`);
    this.name = 'MissingDependencyError';
    this.dependencyName = dependencyName;
    this.controllerName = controllerName;
  }
}

/**
 * Error thrown when a dependency has an invalid interface
 */
export class InvalidDependencyError extends Error {
  /**
   * Creates a new InvalidDependencyError instance
   *
   * @param {string} dependencyName - Name of the invalid dependency
   * @param {string} controllerName - Name of the controller that requires the dependency
   * @param {string} details - Additional details about what makes the dependency invalid
   */
  constructor(dependencyName, controllerName, details) {
    super(
      `${controllerName}: Invalid dependency '${dependencyName}'. ${details}`
    );
    this.name = 'InvalidDependencyError';
    this.dependencyName = dependencyName;
    this.controllerName = controllerName;
    this.details = details;
  }
}