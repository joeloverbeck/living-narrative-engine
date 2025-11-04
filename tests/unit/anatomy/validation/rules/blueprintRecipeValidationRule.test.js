import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { BlueprintRecipeValidationRule } from '../../../../../src/anatomy/validation/rules/blueprintRecipeValidationRule.js';
import { LoadTimeValidationContext } from '../../../../../src/anatomy/validation/loadTimeValidationContext.js';
import { createTestBed } from '../../../../common/testBed.js';

describe('BlueprintRecipeValidationRule', () => {
  let validationRule;
  let testBed;
  let mockLogger;
  let mockPatternResolver;
  let mockSafeEventDispatcher;

  beforeEach(() => {
    testBed = createTestBed();
    mockLogger = testBed.mockLogger;

    // Create mock pattern resolver
    mockPatternResolver = testBed.createMock('recipePatternResolver', [
      'resolveRecipePatterns',
    ]);

    // Create mock safe event dispatcher
    mockSafeEventDispatcher = testBed.createMock('safeEventDispatcher', [
      'dispatch',
    ]);

    validationRule = new BlueprintRecipeValidationRule({
      logger: mockLogger,
      recipePatternResolver: mockPatternResolver,
      safeEventDispatcher: mockSafeEventDispatcher,
    });
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('ruleId and ruleName', () => {
    it('should have correct rule ID', () => {
      expect(validationRule.ruleId).toBe('blueprint-recipe-coverage');
    });

    it('should have correct rule name', () => {
      expect(validationRule.ruleName).toBe(
        'Blueprint Recipe Coverage Validation'
      );
    });
  });

  describe('shouldApply', () => {
    it('should return true when context has blueprints and recipes', () => {
      const context = new LoadTimeValidationContext({
        blueprints: { 'test:blueprint': {} },
        recipes: { 'test:recipe': {} },
      });

      expect(validationRule.shouldApply(context)).toBe(true);
    });

    it('should return false when context has no blueprints', () => {
      const context = new LoadTimeValidationContext({
        blueprints: {},
        recipes: { 'test:recipe': {} },
      });

      expect(validationRule.shouldApply(context)).toBe(false);
    });

    it('should return false when context has no recipes', () => {
      const context = new LoadTimeValidationContext({
        blueprints: { 'test:blueprint': {} },
        recipes: {},
      });

      expect(validationRule.shouldApply(context)).toBe(false);
    });
  });

  describe('coverage validation', () => {
    it('should calculate 100% coverage for complete recipe', async () => {
      const blueprint = {
        id: 'test:blueprint',
        slots: {
          left_hand: { type: 'hand' },
          right_hand: { type: 'hand' },
        },
      };

      const recipe = {
        id: 'test:recipe',
        targetBlueprint: 'test:blueprint',
        patterns: [{ matchesPattern: '*_hand', partType: 'test:hand' }],
      };

      // Mock pattern resolver to return 100% coverage
      mockPatternResolver.resolveRecipePatterns.mockResolvedValue({
        left_hand: { partType: 'test:hand', patternIndex: 0 },
        right_hand: { partType: 'test:hand', patternIndex: 0 },
      });

      const context = new LoadTimeValidationContext({
        blueprints: { 'test:blueprint': blueprint },
        recipes: { 'test:recipe': recipe },
      });

      const issues = await validationRule.validate(context);

      // 100% coverage = no issues
      expect(issues).toHaveLength(0);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('100% coverage')
      );
    });

    it('should warn about incomplete coverage', async () => {
      const blueprint = {
        id: 'test:blueprint',
        slots: {
          left_hand: { type: 'hand' },
          right_hand: { type: 'hand' },
          left_foot: { type: 'foot' },
          right_foot: { type: 'foot' },
        },
      };

      const recipe = {
        id: 'test:recipe',
        targetBlueprint: 'test:blueprint',
        patterns: [{ matchesPattern: '*_hand', partType: 'test:hand' }],
      };

      // Mock pattern resolver to return 50% coverage
      mockPatternResolver.resolveRecipePatterns.mockResolvedValue({
        left_hand: { partType: 'test:hand', patternIndex: 0 },
        right_hand: { partType: 'test:hand', patternIndex: 0 },
      });

      const context = new LoadTimeValidationContext({
        blueprints: { 'test:blueprint': blueprint },
        recipes: { 'test:recipe': recipe },
      });

      const issues = await validationRule.validate(context);

      expect(issues).toHaveLength(1);
      expect(issues[0].type).toBe('incomplete_coverage');
      expect(issues[0].severity).toBe('warning');
      expect(issues[0].uncoveredSlots).toEqual(['left_foot', 'right_foot']);
    });

    it('should error on critically low coverage', async () => {
      const blueprint = {
        id: 'test:blueprint',
        slots: {
          slot1: {},
          slot2: {},
          slot3: {},
          slot4: {},
        },
      };

      const recipe = {
        id: 'test:recipe',
        targetBlueprint: 'test:blueprint',
        patterns: [{ matches: ['slot1'], partType: 'test:part' }],
      };

      // Mock pattern resolver to return 25% coverage
      mockPatternResolver.resolveRecipePatterns.mockResolvedValue({
        slot1: { partType: 'test:part', patternIndex: 0 },
      });

      const context = new LoadTimeValidationContext({
        blueprints: { 'test:blueprint': blueprint },
        recipes: { 'test:recipe': recipe },
      });

      const issues = await validationRule.validate(context);

      const errors = issues.filter((i) => i.severity === 'error');
      expect(errors.length).toBeGreaterThanOrEqual(1);
      expect(errors.some((e) => e.type === 'critically_incomplete')).toBe(true);
    });
  });

  describe('recipe targeting', () => {
    it('should skip recipes targeting other blueprints via blueprintId', async () => {
      const blueprint = {
        id: 'test:blueprint',
        slots: { slot1: {} },
      };

      const recipe = {
        id: 'other:recipe',
        blueprintId: 'other:blueprint',
        patterns: [{ matchesPattern: '*', partType: 'test:part' }],
      };

      mockPatternResolver.resolveRecipePatterns.mockImplementation(() => {
        throw new Error('should not be called for non-matching blueprints');
      });

      const context = new LoadTimeValidationContext({
        blueprints: { 'test:blueprint': blueprint },
        recipes: { 'other:recipe': recipe },
      });

      const issues = await validationRule.validate(context);

      expect(mockPatternResolver.resolveRecipePatterns).not.toHaveBeenCalled();
      expect(issues).toHaveLength(0);
    });

    it('should validate recipes that use blueprintId when targetBlueprint is missing', async () => {
      const blueprint = {
        id: 'test:blueprint',
        slots: { slot1: {} },
      };

      const recipe = {
        id: 'test:recipe',
        blueprintId: 'test:blueprint',
        patterns: [{ matchesPattern: 'slot1', partType: 'test:part' }],
      };

      mockPatternResolver.resolveRecipePatterns.mockResolvedValue({
        slot1: { partType: 'test:part', patternIndex: 0 },
      });

      const context = new LoadTimeValidationContext({
        blueprints: { 'test:blueprint': blueprint },
        recipes: { 'test:recipe': recipe },
      });

      const issues = await validationRule.validate(context);

      expect(mockPatternResolver.resolveRecipePatterns).toHaveBeenCalledWith(
        recipe,
        blueprint
      );
      expect(issues).toHaveLength(0);
    });
  });

  describe('pattern matching validation', () => {
    it('should warn about zero-match patterns', async () => {
      const blueprint = {
        id: 'test:blueprint',
        slots: {
          left_hand: { type: 'hand' },
          right_hand: { type: 'hand' },
        },
      };

      const recipe = {
        id: 'test:recipe',
        targetBlueprint: 'test:blueprint',
        patterns: [
          { matchesPattern: 'tentacle_*', partType: 'test:tentacle' },
          { matchesPattern: 'wing_*', partType: 'test:wing' },
        ],
      };

      // Mock pattern resolver to return no matches for either pattern
      mockPatternResolver.resolveRecipePatterns.mockResolvedValue({});

      const context = new LoadTimeValidationContext({
        blueprints: { 'test:blueprint': blueprint },
        recipes: { 'test:recipe': recipe },
      });

      const issues = await validationRule.validate(context);

      const zeroMatchWarnings = issues.filter((i) => i.type === 'zero_matches');
      expect(zeroMatchWarnings.length).toBe(2); // Both patterns match zero
    });
  });

  describe('error detection', () => {
    it('should error on recipe with no patterns', async () => {
      const blueprint = {
        id: 'test:blueprint',
        slots: { left_hand: {} },
      };

      const recipe = {
        id: 'test:recipe',
        targetBlueprint: 'test:blueprint',
        patterns: [],
      };

      const context = new LoadTimeValidationContext({
        blueprints: { 'test:blueprint': blueprint },
        recipes: { 'test:recipe': recipe },
      });

      const issues = await validationRule.validate(context);

      const errors = issues.filter((i) => i.severity === 'error');
      expect(errors.length).toBeGreaterThanOrEqual(1);
      expect(errors.some((e) => e.type === 'no_patterns')).toBe(true);
    });

    it('should dispatch error events on validation failure', async () => {
      const blueprint = {
        id: 'test:blueprint',
        slots: { left_hand: {} },
      };

      const recipe = {
        id: 'test:recipe',
        targetBlueprint: 'test:blueprint',
        patterns: [{ matchesPattern: '*_hand', partType: 'test:hand' }],
      };

      // Mock pattern resolver to throw error
      mockPatternResolver.resolveRecipePatterns.mockRejectedValue(
        new Error('Pattern resolution failed')
      );

      const context = new LoadTimeValidationContext({
        blueprints: { 'test:blueprint': blueprint },
        recipes: { 'test:recipe': recipe },
      });

      const issues = await validationRule.validate(context);

      // Should have dispatched error event
      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith({
        type: 'SYSTEM_ERROR_OCCURRED',
        payload: expect.objectContaining({
          error: 'Pattern resolution failed',
          context: expect.objectContaining({
            blueprintId: 'test:blueprint',
            recipeId: 'test:recipe',
          }),
        }),
      });

      // Should have error issue
      expect(issues.some((i) => i.type === 'validation_error')).toBe(true);
    });
  });

  describe('recipe targeting', () => {
    it('should validate recipe without targetBlueprint against all blueprints', async () => {
      const blueprint1 = {
        id: 'test:blueprint1',
        slots: { slot1: {} },
      };

      const blueprint2 = {
        id: 'test:blueprint2',
        slots: { slot2: {} },
      };

      const recipe = {
        id: 'test:recipe',
        // No targetBlueprint - should apply to both
        patterns: [{ matchesPattern: '*', partType: 'test:part' }],
      };

      mockPatternResolver.resolveRecipePatterns.mockResolvedValue({
        slot1: { partType: 'test:part', patternIndex: 0 },
      });

      const context = new LoadTimeValidationContext({
        blueprints: {
          'test:blueprint1': blueprint1,
          'test:blueprint2': blueprint2,
        },
        recipes: { 'test:recipe': recipe },
      });

      await validationRule.validate(context);

      // Should have called resolver twice (once for each blueprint)
      expect(mockPatternResolver.resolveRecipePatterns).toHaveBeenCalledTimes(
        2
      );
    });

    it('should only validate recipe with targetBlueprint against specified blueprint', async () => {
      const blueprint1 = {
        id: 'test:blueprint1',
        slots: { slot1: {} },
      };

      const blueprint2 = {
        id: 'test:blueprint2',
        slots: { slot2: {} },
      };

      const recipe = {
        id: 'test:recipe',
        targetBlueprint: 'test:blueprint1', // Only targets blueprint1
        patterns: [{ matchesPattern: '*', partType: 'test:part' }],
      };

      mockPatternResolver.resolveRecipePatterns.mockResolvedValue({
        slot1: { partType: 'test:part', patternIndex: 0 },
      });

      const context = new LoadTimeValidationContext({
        blueprints: {
          'test:blueprint1': blueprint1,
          'test:blueprint2': blueprint2,
        },
        recipes: { 'test:recipe': recipe },
      });

      await validationRule.validate(context);

      // Should have called resolver only once (for blueprint1)
      expect(mockPatternResolver.resolveRecipePatterns).toHaveBeenCalledTimes(
        1
      );
      expect(mockPatternResolver.resolveRecipePatterns).toHaveBeenCalledWith(
        recipe,
        blueprint1
      );
    });
  });
});
