/**
 * @file Test to verify getAllThematicDirections method was added to CharacterBuilderService
 * @description Simple verification that the method exists on the prototype
 */

import { describe, it, expect } from '@jest/globals';

describe('CharacterBuilderService - Method Existence Verification', () => {
  it('should have getAllThematicDirections method on the prototype', async () => {
    // Import the CharacterBuilderService class
    const { CharacterBuilderService } = await import(
      '../../../../src/characterBuilder/services/characterBuilderService.js'
    );

    // Act & Assert: Check that the method exists on the prototype
    expect(
      typeof CharacterBuilderService.prototype.getAllThematicDirections
    ).toBe('function');
  });

  it('should have getAllThematicDirectionsWithConcepts method on the prototype', async () => {
    // Import the CharacterBuilderService class
    const { CharacterBuilderService } = await import(
      '../../../../src/characterBuilder/services/characterBuilderService.js'
    );

    // Act & Assert: Check that the existing method is still there
    expect(
      typeof CharacterBuilderService.prototype
        .getAllThematicDirectionsWithConcepts
    ).toBe('function');
  });

  it('should verify that both methods exist and are different', async () => {
    // Import the CharacterBuilderService class
    const { CharacterBuilderService } = await import(
      '../../../../src/characterBuilder/services/characterBuilderService.js'
    );

    // Act & Assert: Both methods should exist and be different functions
    expect(
      CharacterBuilderService.prototype.getAllThematicDirections
    ).toBeDefined();
    expect(
      CharacterBuilderService.prototype.getAllThematicDirectionsWithConcepts
    ).toBeDefined();
    expect(CharacterBuilderService.prototype.getAllThematicDirections).not.toBe(
      CharacterBuilderService.prototype.getAllThematicDirectionsWithConcepts
    );
  });

  it('should verify that TraitsDisplayEnhancer can be imported', async () => {
    // Import the TraitsDisplayEnhancer class to verify it exists
    const { TraitsDisplayEnhancer } = await import(
      '../../../../src/characterBuilder/services/TraitsDisplayEnhancer.js'
    );

    // Act & Assert: Class should be importable and be a constructor function
    expect(typeof TraitsDisplayEnhancer).toBe('function');
    expect(TraitsDisplayEnhancer.prototype.constructor).toBe(
      TraitsDisplayEnhancer
    );
  });
});
