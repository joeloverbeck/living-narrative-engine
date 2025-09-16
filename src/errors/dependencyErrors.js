/**
 * @file Error classes for dependency validation failures
 * @description Custom error types for enhanced dependency validation system
 */

import BaseError from './baseError.js';

/**
 * Error thrown when a required dependency is missing
 */
export class MissingDependencyError extends BaseError {
  /**
   * Creates a new MissingDependencyError instance
   *
   * @param {string} dependencyName - Name of the missing dependency
   * @param {string} controllerName - Name of the controller that requires the dependency
   */
  constructor(dependencyName, controllerName) {
    const message = `${controllerName}: Missing required dependency '${dependencyName}'`;
    const context = { dependencyName, controllerName };
    super(message, 'MISSING_DEPENDENCY_ERROR', context);
    this.name = 'MissingDependencyError';
    // Backward compatibility
    this.dependencyName = dependencyName;
    this.controllerName = controllerName;
  }

  /**
   * @returns {string} Severity level for missing dependency errors
   */
  getSeverity() {
    return 'critical';
  }

  /**
   * @returns {boolean} Missing dependency errors are not recoverable
   */
  isRecoverable() {
    return false;
  }
}

/**
 * Error thrown when a dependency has an invalid interface
 */
export class InvalidDependencyError extends BaseError {
  /**
   * Creates a new InvalidDependencyError instance
   *
   * @param {string} dependencyName - Name of the invalid dependency
   * @param {string} controllerName - Name of the controller that requires the dependency
   * @param {string} details - Additional details about what makes the dependency invalid
   */
  constructor(dependencyName, controllerName, details) {
    const message = `${controllerName}: Invalid dependency '${dependencyName}'. ${details}`;
    const context = { dependencyName, controllerName, details };
    super(message, 'INVALID_DEPENDENCY_ERROR', context);
    this.name = 'InvalidDependencyError';
    // Backward compatibility
    this.dependencyName = dependencyName;
    this.controllerName = controllerName;
    this.details = details;
  }

  /**
   * @returns {string} Severity level for invalid dependency errors
   */
  getSeverity() {
    return 'critical';
  }

  /**
   * @returns {boolean} Invalid dependency errors are not recoverable
   */
  isRecoverable() {
    return false;
  }
}
