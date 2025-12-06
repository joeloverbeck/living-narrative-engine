/**
 * @file Utility functions for working with apparent age components
 * @see ../entities/entityManager.js
 */

import { assertPresent } from './dependencyUtils.js';

/**
 * @typedef {object} AgeComponent
 * @property {number} minAge - Minimum perceived age in years
 * @property {number} maxAge - Maximum perceived age in years
 * @property {number} [bestGuess] - Most likely age estimate in years (optional)
 */

/**
 * Utility functions for working with age ranges and age perception
 */
export class AgeUtils {
  /**
   * Calculates the average age from an age component
   *
   * @param {AgeComponent} ageComponent - The age component data
   * @returns {number} The average age or best guess if available
   * @throws {Error} If ageComponent is invalid
   */
  static getAverageAge(ageComponent) {
    assertPresent(ageComponent, 'Age component is required');
    assertPresent(ageComponent.minAge, 'Age component must have minAge');
    assertPresent(ageComponent.maxAge, 'Age component must have maxAge');

    if (
      typeof ageComponent.minAge !== 'number' ||
      typeof ageComponent.maxAge !== 'number'
    ) {
      throw new Error('Age values must be numbers');
    }

    if (ageComponent.maxAge < ageComponent.minAge) {
      throw new Error('maxAge must be greater than or equal to minAge');
    }

    const { bestGuess } = ageComponent;
    const hasBestGuess = bestGuess !== undefined && bestGuess !== null;

    if (hasBestGuess) {
      if (typeof bestGuess !== 'number') {
        throw new Error('bestGuess must be a number');
      }

      return bestGuess;
    }

    return (ageComponent.minAge + ageComponent.maxAge) / 2;
  }

  /**
   * Calculates the uncertainty range of an age component
   *
   * @param {AgeComponent} ageComponent - The age component data
   * @returns {number} The uncertainty range (maxAge - minAge)
   * @throws {Error} If ageComponent is invalid
   */
  static getAgeUncertainty(ageComponent) {
    assertPresent(ageComponent, 'Age component is required');
    assertPresent(ageComponent.minAge, 'Age component must have minAge');
    assertPresent(ageComponent.maxAge, 'Age component must have maxAge');

    if (
      typeof ageComponent.minAge !== 'number' ||
      typeof ageComponent.maxAge !== 'number'
    ) {
      throw new Error('Age values must be numbers');
    }

    if (ageComponent.maxAge < ageComponent.minAge) {
      throw new Error('maxAge must be greater than or equal to minAge');
    }

    return ageComponent.maxAge - ageComponent.minAge;
  }

  /**
   * Checks if a target age falls within the age range
   *
   * @param {AgeComponent} ageComponent - The age component data
   * @param {number} targetAge - The age to check
   * @returns {boolean} True if the target age is within range
   * @throws {Error} If inputs are invalid
   */
  static isAgeInRange(ageComponent, targetAge) {
    assertPresent(ageComponent, 'Age component is required');
    assertPresent(ageComponent.minAge, 'Age component must have minAge');
    assertPresent(ageComponent.maxAge, 'Age component must have maxAge');
    assertPresent(targetAge, 'Target age is required');

    if (
      typeof ageComponent.minAge !== 'number' ||
      typeof ageComponent.maxAge !== 'number'
    ) {
      throw new Error('Age values must be numbers');
    }

    if (typeof targetAge !== 'number') {
      throw new Error('Target age must be a number');
    }

    if (ageComponent.maxAge < ageComponent.minAge) {
      throw new Error('maxAge must be greater than or equal to minAge');
    }

    return targetAge >= ageComponent.minAge && targetAge <= ageComponent.maxAge;
  }

  /**
   * Formats an age component into a human-readable description
   *
   * @param {AgeComponent} ageComponent - The age component data
   * @returns {string} A formatted description of the age
   * @throws {Error} If ageComponent is invalid
   */
  static formatAgeDescription(ageComponent) {
    assertPresent(ageComponent, 'Age component is required');
    assertPresent(ageComponent.minAge, 'Age component must have minAge');
    assertPresent(ageComponent.maxAge, 'Age component must have maxAge');

    if (
      typeof ageComponent.minAge !== 'number' ||
      typeof ageComponent.maxAge !== 'number'
    ) {
      throw new Error('Age values must be numbers');
    }

    if (ageComponent.maxAge < ageComponent.minAge) {
      throw new Error('maxAge must be greater than or equal to minAge');
    }

    const { bestGuess } = ageComponent;
    const hasBestGuess = bestGuess !== undefined && bestGuess !== null;

    if (hasBestGuess) {
      if (typeof bestGuess !== 'number') {
        throw new Error('bestGuess must be a number');
      }

      if (bestGuess < ageComponent.minAge || bestGuess > ageComponent.maxAge) {
        throw new Error('bestGuess must be between minAge and maxAge');
      }

      return `around ${bestGuess} years old`;
    }

    if (ageComponent.minAge === ageComponent.maxAge) {
      return `${ageComponent.minAge} years old`;
    }

    return `between ${ageComponent.minAge} and ${ageComponent.maxAge} years old`;
  }

  /**
   * Validates that an age component has valid business logic constraints
   *
   * @param {AgeComponent} ageComponent - The age component data to validate
   * @returns {boolean} True if valid, throws error if invalid
   * @throws {Error} If validation fails
   */
  static validateAgeComponent(ageComponent) {
    assertPresent(ageComponent, 'Age component is required');
    assertPresent(ageComponent.minAge, 'Age component must have minAge');
    assertPresent(ageComponent.maxAge, 'Age component must have maxAge');

    if (
      typeof ageComponent.minAge !== 'number' ||
      typeof ageComponent.maxAge !== 'number'
    ) {
      throw new Error('Age values must be numbers');
    }

    if (ageComponent.minAge < 0 || ageComponent.maxAge < 0) {
      throw new Error('Age values must be non-negative');
    }

    if (ageComponent.minAge > 200 || ageComponent.maxAge > 200) {
      throw new Error('Age values must not exceed 200');
    }

    if (ageComponent.maxAge < ageComponent.minAge) {
      throw new Error('maxAge must be greater than or equal to minAge');
    }

    if (ageComponent.bestGuess !== undefined) {
      if (typeof ageComponent.bestGuess !== 'number') {
        throw new Error('bestGuess must be a number');
      }

      if (ageComponent.bestGuess < 0 || ageComponent.bestGuess > 200) {
        throw new Error('bestGuess must be between 0 and 200');
      }

      if (
        ageComponent.bestGuess < ageComponent.minAge ||
        ageComponent.bestGuess > ageComponent.maxAge
      ) {
        throw new Error('bestGuess must be between minAge and maxAge');
      }
    }

    return true;
  }
}
