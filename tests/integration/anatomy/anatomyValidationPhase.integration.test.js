/**
 * @file Integration tests for AnatomyValidationPhase in the mod loading pipeline
 * @description Tests the full anatomy validation phase integration
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import AnatomyValidationPhase from '../../../src/loaders/phases/anatomyValidationPhase.js';
import { BlueprintRecipeValidationRule } from '../../../src/anatomy/validation/rules/blueprintRecipeValidationRule.js';
import { createTestBed } from '../../common/testBed.js';

describe('AnatomyValidationPhase Integration', () => {
  let testBed;
  let mockLogger;
  let mockRecipePatternResolver;
  let mockSafeEventDispatcher;
  let validationRule;
  let validationPhase;

  beforeEach(() => {
    testBed = createTestBed();
    mockLogger = testBed.mockLogger;

    mockRecipePatternResolver = testBed.createMock(
      'recipePatternResolver',
      ['resolveRecipePatterns']
    );

    mockSafeEventDispatcher = testBed.createMock('safeEventDispatcher', [
      'dispatch',
    ]);

    validationRule = new BlueprintRecipeValidationRule({
      logger: mockLogger,
      recipePatternResolver: mockRecipePatternResolver,
      safeEventDispatcher: mockSafeEventDispatcher,
    });

    validationPhase = new AnatomyValidationPhase({
      logger: mockLogger,
      blueprintRecipeValidationRule: validationRule,
    });
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('Pipeline Integration', () => {
    it('should integrate into mod loading pipeline and execute validation', async () => {
      const ctx = createLoadContext({
        blueprints: [
          {
            id: 'test:blueprint',
            slots: {
              left_hand: { type: 'hand' },
              right_hand: { type: 'hand' },
            },
          },
        ],
        recipes: [
          {
            id: 'test:recipe',
            targetBlueprint: 'test:blueprint',
            patterns: [{ matchesPattern: '*_hand', partType: 'test:hand' }],
          },
        ],
      });

      // Mock complete coverage (100%)
      mockRecipePatternResolver.resolveRecipePatterns.mockResolvedValue({
        left_hand: { partType: 'test:hand', patternIndex: 0 },
        right_hand: { partType: 'test:hand', patternIndex: 0 },
      });

      const result = await validationPhase.execute(ctx);

      // Verify validation was executed
      expect(mockRecipePatternResolver.resolveRecipePatterns).toHaveBeenCalled();

      // Verify results were attached to context
      expect(result.anatomyValidation).toBeDefined();
      expect(result.anatomyValidation.errors).toBe(0);
      expect(result.anatomyValidation.warnings).toBe(0);
      expect(result.anatomyValidation.issues).toHaveLength(0);
    });

    it('should detect incomplete coverage and add warnings to context', async () => {
      const ctx = createLoadContext({
        blueprints: [
          {
            id: 'test:blueprint',
            slots: {
              left_hand: {},
              right_hand: {},
              head: {},
              torso: {},
            },
          },
        ],
        recipes: [
          {
            id: 'test:recipe',
            targetBlueprint: 'test:blueprint',
            patterns: [{ matchesPattern: '*_hand', partType: 'test:hand' }],
          },
        ],
      });

      // Mock 50% coverage
      mockRecipePatternResolver.resolveRecipePatterns.mockResolvedValue({
        left_hand: { partType: 'test:hand', patternIndex: 0 },
        right_hand: { partType: 'test:hand', patternIndex: 0 },
      });

      const result = await validationPhase.execute(ctx);

      expect(result.anatomyValidation.warnings).toBe(1);
      expect(result.anatomyValidation.issues[0].type).toBe(
        'incomplete_coverage'
      );
      expect(result.anatomyValidation.issues[0].uncoveredSlots).toContain(
        'head'
      );
      expect(result.anatomyValidation.issues[0].uncoveredSlots).toContain(
        'torso'
      );
    });

    it('should error on critically low coverage', async () => {
      const ctx = createLoadContext({
        blueprints: [
          {
            id: 'test:blueprint',
            slots: {
              slot1: {},
              slot2: {},
              slot3: {},
              slot4: {},
            },
          },
        ],
        recipes: [
          {
            id: 'test:recipe',
            targetBlueprint: 'test:blueprint',
            patterns: [{ matches: ['slot1'], partType: 'test:part' }],
          },
        ],
      });

      // Mock 25% coverage (critically low)
      mockRecipePatternResolver.resolveRecipePatterns.mockResolvedValue({
        slot1: { partType: 'test:part', patternIndex: 0 },
      });

      const result = await validationPhase.execute(ctx);

      expect(result.anatomyValidation.errors).toBeGreaterThanOrEqual(1);
      const criticalError = result.anatomyValidation.issues.find(
        (i) => i.type === 'critically_incomplete'
      );
      expect(criticalError).toBeDefined();
    });

  });

  describe('Multi-Blueprint Validation', () => {
    it('should validate multiple blueprints in single phase execution', async () => {
      const ctx = createLoadContext({
        blueprints: [
          { id: 'test:bp1', slots: { slot1: {}, slot2: {} } },
          { id: 'test:bp2', slots: { slot3: {}, slot4: {} } },
        ],
        recipes: [
          {
            id: 'test:recipe1',
            targetBlueprint: 'test:bp1',
            patterns: [{ matches: ['slot1', 'slot2'], partType: 'test:part' }],
          },
          {
            id: 'test:recipe2',
            targetBlueprint: 'test:bp2',
            patterns: [{ matches: ['slot3', 'slot4'], partType: 'test:part' }],
          },
        ],
      });

      // Mock 100% coverage for both
      mockRecipePatternResolver.resolveRecipePatterns.mockImplementation(
        (recipe, blueprint) => {
          if (blueprint.id === 'test:bp1') {
            return Promise.resolve({
              slot1: { partType: 'test:part', patternIndex: 0 },
              slot2: { partType: 'test:part', patternIndex: 0 },
            });
          }
          return Promise.resolve({
            slot3: { partType: 'test:part', patternIndex: 0 },
            slot4: { partType: 'test:part', patternIndex: 0 },
          });
        }
      );

      const result = await validationPhase.execute(ctx);

      expect(result.anatomyValidation.errors).toBe(0);
      expect(result.anatomyValidation.warnings).toBe(0);
      expect(
        mockRecipePatternResolver.resolveRecipePatterns
      ).toHaveBeenCalledTimes(2);
    });

    it('should ignore recipes targeting other blueprints when using blueprintId', async () => {
      const ctx = createLoadContext({
        blueprints: [{ id: 'test:bp1', slots: { slot1: {} } }],
        recipes: [
          {
            id: 'other:recipe',
            blueprintId: 'other:blueprint',
            patterns: [{ matchesPattern: '*', partType: 'test:part' }],
          },
        ],
      });

      mockRecipePatternResolver.resolveRecipePatterns.mockImplementation(() => {
        throw new Error('should not be called for non-matching blueprint');
      });

      const result = await validationPhase.execute(ctx);

      expect(mockRecipePatternResolver.resolveRecipePatterns).not.toHaveBeenCalled();
      expect(result.anatomyValidation.errors).toBe(0);
      expect(result.anatomyValidation.warnings).toBe(0);
      expect(result.anatomyValidation.issues).toHaveLength(0);
    });
  });

  describe('Error Handling', () => {
    it('should dispatch error events on validation failures', async () => {
      const ctx = createLoadContext({
        blueprints: [{ id: 'test:blueprint', slots: { slot1: {} } }],
        recipes: [
          {
            id: 'test:recipe',
            targetBlueprint: 'test:blueprint',
            patterns: [{ matchesPattern: 'test', partType: 'test:part' }],
          },
        ],
      });

      // Mock pattern resolution failure
      mockRecipePatternResolver.resolveRecipePatterns.mockRejectedValue(
        new Error('Pattern resolution failed')
      );

      const result = await validationPhase.execute(ctx);

      // Event dispatch signature: dispatch(eventId, payload)
      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        'core:system_error_occurred',
        expect.objectContaining({
          error: 'Pattern resolution failed',
          context: expect.objectContaining({
            blueprintId: 'test:blueprint',
            recipeId: 'test:recipe',
            validationRule: 'blueprint-recipe-coverage',
          }),
        })
      );

      expect(result.anatomyValidation.errors).toBeGreaterThanOrEqual(1);
    });
  });
});

/**
 * Create mock LoadContext for testing
 *
 * @param {object} params - Context parameters
 * @param {Array} params.blueprints - Blueprints array
 * @param {Array} params.recipes - Recipes array
 * @returns {object} Mock LoadContext
 */
function createLoadContext({ blueprints = [], recipes = [] }) {
  const registry = {
    getAll: jest.fn((type) => {
      if (type === 'anatomyBlueprints') return blueprints;
      if (type === 'anatomyRecipes') return recipes;
      return [];
    }),
  };

  return {
    registry,
    worldName: 'test-world',
    requestedMods: ['core'],
    finalModOrder: ['core'],
    totals: {},
  };
}
