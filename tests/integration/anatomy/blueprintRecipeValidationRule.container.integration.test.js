/**
 * @file Dependency validation test for BlueprintRecipeValidationRule
 * Verifies that the rule instantiates correctly with ISafeEventDispatcher
 * This test prevents regression of the dependency mismatch bug
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { BlueprintRecipeValidationRule } from '../../../src/anatomy/validation/rules/blueprintRecipeValidationRule.js';
import { createTestBed } from '../../common/testBed.js';

describe('BlueprintRecipeValidationRule - Dependency Validation', () => {
  let testBed;
  let mockLogger;
  let mockRecipePatternResolver;
  let mockSafeEventDispatcher;

  beforeEach(() => {
    testBed = createTestBed();
    mockLogger = testBed.mockLogger;

    mockRecipePatternResolver = testBed.createMock('recipePatternResolver', [
      'resolveRecipePatterns',
    ]);

    // This is the key test - verify it expects safeEventDispatcher with dispatch method
    mockSafeEventDispatcher = testBed.createMock('safeEventDispatcher', [
      'dispatch',
    ]);
  });

  afterEach(() => {
    testBed.cleanup();
  });

  it('should instantiate with ISafeEventDispatcher that has dispatch method', () => {
    // This test prevents regression of the dependency mismatch bug where
    // EventDispatchService was being passed instead of ISafeEventDispatcher

    // Act - should not throw
    const rule = new BlueprintRecipeValidationRule({
      logger: mockLogger,
      recipePatternResolver: mockRecipePatternResolver,
      safeEventDispatcher: mockSafeEventDispatcher,
    });

    // Assert
    expect(rule).toBeDefined();
    expect(rule.ruleId).toBe('blueprint-recipe-coverage');
    expect(rule.ruleName).toBe('Blueprint Recipe Coverage Validation');
  });

  it('should reject dependency without dispatch method', () => {
    // Arrange - create mock without dispatch method
    const invalidDispatcher = testBed.createMock('invalidDispatcher', [
      'dispatchWithLogging', // Wrong method!
    ]);

    // Act & Assert - should throw during validation
    expect(() => {
      new BlueprintRecipeValidationRule({
        logger: mockLogger,
        recipePatternResolver: mockRecipePatternResolver,
        safeEventDispatcher: invalidDispatcher,
      });
    }).toThrow(/Invalid or missing method 'dispatch'/);
  });

  it('should successfully dispatch events with safeEventDispatcher', async () => {
    // Arrange
    mockRecipePatternResolver.resolveRecipePatterns.mockRejectedValue(
      new Error('Test error to trigger dispatch')
    );

    const rule = new BlueprintRecipeValidationRule({
      logger: mockLogger,
      recipePatternResolver: mockRecipePatternResolver,
      safeEventDispatcher: mockSafeEventDispatcher,
    });

    const context = {
      hasBlueprints: () => true,
      hasRecipes: () => true,
      getBlueprints: () => ({ 'test:blueprint': { id: 'test:blueprint', slots: {} } }),
      getRecipes: () => ({
        'test:recipe': {
          id: 'test:recipe',
          patterns: [{ type: 'exact', value: 'test' }],
        },
      }),
    };

    // Act
    await rule.validate(context);

    // Assert - dispatch should have been called with error event
    expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith({
      type: 'SYSTEM_ERROR_OCCURRED',
      payload: expect.objectContaining({
        error: 'Test error to trigger dispatch',
      }),
    });
  });
});
