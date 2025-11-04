/**
 * @file Body descriptor validation utilities
 * Centralized validation logic for body-level descriptors
 */

import {
  DESCRIPTOR_METADATA,
  SUPPORTED_DESCRIPTOR_PROPERTIES,
} from '../constants/bodyDescriptorConstants.js';
import { BodyDescriptorValidationError } from '../errors/bodyDescriptorValidationError.js';

export class BodyDescriptorValidator {
  /**
   * Validates a complete body descriptors object
   *
   * @param {object | null | undefined} bodyDescriptors - The descriptors to validate
   * @param {string} context - Context for error messages (e.g., recipe ID)
   * @throws {BodyDescriptorValidationError} If validation fails
   */
  static validate(bodyDescriptors, context = 'unknown') {
    if (!bodyDescriptors) {
      return; // null/undefined is valid (optional field)
    }

    if (typeof bodyDescriptors !== 'object' || Array.isArray(bodyDescriptors)) {
      throw new BodyDescriptorValidationError(
        `Body descriptors must be an object in ${context}`
      );
    }

    // Check for unknown properties first
    this.validateNoUnknownProperties(bodyDescriptors, context);

    // Validate each descriptor property
    for (const [property, value] of Object.entries(bodyDescriptors)) {
      this.validateDescriptorProperty(property, value, context);
    }
  }

  /**
   * Validates a single descriptor property
   *
   * @param {string} property - The property name
   * @param {*} value - The property value
   * @param {string} context - Context for error messages
   * @throws {BodyDescriptorValidationError} If validation fails
   */
  static validateDescriptorProperty(property, value, context = 'unknown') {
    const metadata = DESCRIPTOR_METADATA[property];

    if (!metadata) {
      throw new BodyDescriptorValidationError(
        `Unknown body descriptor property '${property}' in ${context}. Supported properties: ${SUPPORTED_DESCRIPTOR_PROPERTIES.join(', ')}`
      );
    }

    // Validate value type
    if (typeof value !== 'string') {
      throw new BodyDescriptorValidationError(
        `Body descriptor '${property}' must be a string in ${context}, got ${typeof value}`
      );
    }

    // Validate enum values (skip skinColor as it's free-form)
    if (metadata.validValues && !metadata.validValues.includes(value)) {
      throw new BodyDescriptorValidationError(
        `Invalid ${property} descriptor: '${value}' in ${context}. Must be one of: ${metadata.validValues.join(', ')}`
      );
    }
  }

  /**
   * Validates that no unknown properties are present
   *
   * @param {object} bodyDescriptors - The descriptors object
   * @param {string} context - Context for error messages
   * @throws {BodyDescriptorValidationError} If unknown properties found
   */
  static validateNoUnknownProperties(bodyDescriptors, context = 'unknown') {
    const unknownProperties = Object.keys(bodyDescriptors).filter(
      (prop) => !SUPPORTED_DESCRIPTOR_PROPERTIES.includes(prop)
    );

    if (unknownProperties.length > 0) {
      throw new BodyDescriptorValidationError(
        `Unknown body descriptor properties in ${context}: ${unknownProperties.join(', ')}`
      );
    }
  }

  /**
   * Validates a specific descriptor type
   *
   * @param {'build'|'hairDensity'|'composition'|'skinColor'|'smell'|'height'} descriptorType - The descriptor type
   * @param {string} value - The value to validate
   * @param {string} context - Context for error messages
   * @throws {BodyDescriptorValidationError} If validation fails
   */
  static validateDescriptorType(descriptorType, value, context = 'unknown') {
    this.validateDescriptorProperty(descriptorType, value, context);
  }

  /**
   * Gets display label for a descriptor property
   *
   * @param {string} property - The property name
   * @returns {string} The display label
   */
  static getDescriptorLabel(property) {
    const metadata = DESCRIPTOR_METADATA[property];
    return metadata ? metadata.label : property;
  }

  /**
   * Gets valid values for a descriptor property
   *
   * @param {string} property - The property name
   * @returns {string[]|null} Array of valid values or null if free-form
   */
  static getValidValues(property) {
    const metadata = DESCRIPTOR_METADATA[property];
    return metadata ? metadata.validValues : null;
  }

  /**
   * Checks if a descriptor property supports enum validation
   *
   * @param {string} property - The property name
   * @returns {boolean} True if property has enum validation
   */
  static hasEnumValidation(property) {
    return Boolean(DESCRIPTOR_METADATA[property]?.validValues);
  }
}
