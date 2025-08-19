/**
 * @file Body descriptor validation error
 * Custom error class for body descriptor validation failures
 */

import { ValidationError } from '../../errors/validationError.js';

export class BodyDescriptorValidationError extends ValidationError {
  constructor(message, descriptorProperty = null, invalidValue = null) {
    super(message);
    this.name = 'BodyDescriptorValidationError';
    this.descriptorProperty = descriptorProperty;
    this.invalidValue = invalidValue;

    // Capture stack trace
    Error.captureStackTrace(this, BodyDescriptorValidationError);
  }

  /**
   * Creates error for invalid enum value
   *
   * @param {string} property - The descriptor property
   * @param {string} value - The invalid value
   * @param {string[]} validValues - Array of valid values
   * @param {string} context - Context for error
   * @returns {BodyDescriptorValidationError}
   */
  static invalidEnumValue(property, value, validValues, context = 'unknown') {
    const message = `Invalid ${property} descriptor: '${value}' in ${context}. Must be one of: ${validValues.join(', ')}`;
    return new BodyDescriptorValidationError(message, property, value);
  }

  /**
   * Creates error for unknown property
   *
   * @param {string} property - The unknown property
   * @param {string[]} supportedProperties - Array of supported properties
   * @param {string} context - Context for error
   * @returns {BodyDescriptorValidationError}
   */
  static unknownProperty(property, supportedProperties, context = 'unknown') {
    const message = `Unknown body descriptor property '${property}' in ${context}. Supported properties: ${supportedProperties.join(', ')}`;
    return new BodyDescriptorValidationError(message, property, null);
  }
}
