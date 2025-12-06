import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import AnatomyValidationPhase from '../../../../src/loaders/phases/anatomyValidationPhase.js';
import { LoadTimeValidationContext } from '../../../../src/anatomy/validation/loadTimeValidationContext.js';
import { createTestBed } from '../../../common/testBed.js';

describe('AnatomyValidationPhase', () => {
  let validationPhase;
  let testBed;
  let mockLogger;
  let mockValidationRule;

  beforeEach(() => {
    testBed = createTestBed();
    mockLogger = testBed.mockLogger;

    // Create mock validation rule
    mockValidationRule = testBed.createMock('blueprintRecipeValidationRule', [
      'ruleId',
      'shouldApply',
      'validate',
    ]);
    mockValidationRule.ruleId = 'blueprint-recipe-coverage';

    // Create mock component existence validation rule
    const mockComponentExistenceRule = testBed.createMock(
      'componentExistenceValidationRule',
      ['ruleId', 'shouldApply', 'validate']
    );
    mockComponentExistenceRule.ruleId = 'component-existence';

    // Create mock property schema validation rule
    const mockPropertySchemaRule = testBed.createMock(
      'propertySchemaValidationRule',
      ['ruleId', 'shouldApply', 'validate']
    );
    mockPropertySchemaRule.ruleId = 'property-schema-validation';

    validationPhase = new AnatomyValidationPhase({
      logger: mockLogger,
      blueprintRecipeValidationRule: mockValidationRule,
      componentExistenceValidationRule: mockComponentExistenceRule,
      propertySchemaValidationRule: mockPropertySchemaRule,
    });
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('phase metadata', () => {
    it('should have correct phase name', () => {
      expect(validationPhase.name).toBe('anatomy-validation');
    });
  });

  describe('execute - skip scenarios', () => {
    it('should skip validation when no blueprints loaded', async () => {
      const ctx = createMockContext({
        blueprints: [],
        recipes: [{ id: 'test:recipe' }],
      });

      const result = await validationPhase.execute(ctx);

      expect(result).toBe(ctx);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Skipping anatomy validation')
      );
      expect(mockValidationRule.validate).not.toHaveBeenCalled();
    });

    it('should skip validation when no recipes loaded', async () => {
      const ctx = createMockContext({
        blueprints: [{ id: 'test:blueprint' }],
        recipes: [],
      });

      const result = await validationPhase.execute(ctx);

      expect(result).toBe(ctx);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Skipping anatomy validation')
      );
      expect(mockValidationRule.validate).not.toHaveBeenCalled();
    });

    it('should skip validation when both blueprints and recipes are empty', async () => {
      const ctx = createMockContext({
        blueprints: [],
        recipes: [],
      });

      const result = await validationPhase.execute(ctx);

      expect(result).toBe(ctx);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Skipping anatomy validation')
      );
    });
  });

  describe('execute - successful validation', () => {
    it('should execute validation with no issues', async () => {
      const ctx = createMockContext({
        blueprints: [
          { id: 'test:blueprint', slots: { left_hand: {}, right_hand: {} } },
        ],
        recipes: [
          {
            id: 'test:recipe',
            targetBlueprint: 'test:blueprint',
            patterns: [],
          },
        ],
      });

      mockValidationRule.shouldApply = jest.fn().mockReturnValue(true);
      mockValidationRule.validate = jest.fn().mockResolvedValue([]);

      const result = await validationPhase.execute(ctx);

      expect(result.anatomyValidation).toBeDefined();
      expect(result.anatomyValidation.errors).toBe(0);
      expect(result.anatomyValidation.warnings).toBe(0);
      expect(result.anatomyValidation.issues).toEqual([]);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Anatomy validation completed successfully'
      );
    });

    it('should attach validation results to context', async () => {
      const ctx = createMockContext({
        blueprints: [{ id: 'test:blueprint', slots: {} }],
        recipes: [{ id: 'test:recipe', patterns: [] }],
      });

      mockValidationRule.shouldApply = jest.fn().mockReturnValue(true);
      mockValidationRule.validate = jest.fn().mockResolvedValue([]);

      const result = await validationPhase.execute(ctx);

      expect(result.anatomyValidation).toMatchObject({
        issues: [],
        errors: 0,
        warnings: 0,
      });
      expect(result.anatomyValidation.timestamp).toBeDefined();
      expect(typeof result.anatomyValidation.timestamp).toBe('number');
    });
  });

  describe('execute - validation with warnings', () => {
    it('should handle validation warnings', async () => {
      const ctx = createMockContext({
        blueprints: [{ id: 'test:blueprint', slots: {} }],
        recipes: [{ id: 'test:recipe', patterns: [] }],
      });

      const warnings = [
        {
          severity: 'warning',
          type: 'incomplete_coverage',
          message: 'Recipe covers only 50% of blueprint',
        },
        {
          severity: 'warning',
          type: 'zero_matches',
          message: 'Pattern matches zero slots',
        },
      ];

      mockValidationRule.shouldApply = jest.fn().mockReturnValue(true);
      mockValidationRule.validate = jest.fn().mockResolvedValue(warnings);

      const result = await validationPhase.execute(ctx);

      expect(result.anatomyValidation.errors).toBe(0);
      expect(result.anatomyValidation.warnings).toBe(2);
      expect(result.anatomyValidation.issues).toEqual(warnings);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Anatomy validation completed with 2 warning(s)'
      );
    });
  });

  describe('execute - validation with errors', () => {
    it('should handle validation errors without strict mode', async () => {
      const ctx = createMockContext({
        blueprints: [{ id: 'test:blueprint', slots: {} }],
        recipes: [{ id: 'test:recipe', patterns: [] }],
      });

      const issues = [
        {
          severity: 'error',
          type: 'no_patterns',
          message: 'Recipe has no patterns defined',
        },
        {
          severity: 'warning',
          type: 'incomplete_coverage',
          message: 'Recipe coverage is low',
        },
      ];

      mockValidationRule.shouldApply = jest.fn().mockReturnValue(true);
      mockValidationRule.validate = jest.fn().mockResolvedValue(issues);

      const result = await validationPhase.execute(ctx);

      expect(result.anatomyValidation.errors).toBe(1);
      expect(result.anatomyValidation.warnings).toBe(1);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Anatomy validation found 1 error(s) and 1 warning(s)'
      );
    });
  });

  describe('execute - mixed severity issues', () => {
    it('should correctly categorize mixed severity issues', async () => {
      const ctx = createMockContext({
        blueprints: [{ id: 'test:blueprint', slots: {} }],
        recipes: [{ id: 'test:recipe', patterns: [] }],
      });

      const issues = [
        { severity: 'error', message: 'Critical error' },
        { severity: 'warning', message: 'Warning 1' },
        { severity: 'error', message: 'Error 2' },
        { severity: 'warning', message: 'Warning 2' },
        { severity: 'warning', message: 'Warning 3' },
      ];

      mockValidationRule.shouldApply = jest.fn().mockReturnValue(true);
      mockValidationRule.validate = jest.fn().mockResolvedValue(issues);

      const result = await validationPhase.execute(ctx);

      expect(result.anatomyValidation.errors).toBe(2);
      expect(result.anatomyValidation.warnings).toBe(3);
      expect(result.anatomyValidation.issues.length).toBe(5);
    });
  });

  describe('blueprint and recipe extraction', () => {
    it('should extract blueprints from registry', async () => {
      const blueprints = [
        { id: 'bp1', slots: {} },
        { id: 'bp2', slots: {} },
        { id: 'bp3', slots: {} },
      ];

      const ctx = createMockContext({
        blueprints,
        recipes: [{ id: 'recipe1', patterns: [] }],
      });

      mockValidationRule.shouldApply = jest.fn().mockReturnValue(true);
      mockValidationRule.validate = jest.fn().mockResolvedValue([]);

      await validationPhase.execute(ctx);

      // Validation rule should be called with context containing all blueprints
      expect(mockValidationRule.validate).toHaveBeenCalled();
      const validationContext = mockValidationRule.validate.mock.calls[0][0];
      expect(validationContext).toBeInstanceOf(LoadTimeValidationContext);
      expect(validationContext.getBlueprints()).toMatchObject({
        bp1: blueprints[0],
        bp2: blueprints[1],
        bp3: blueprints[2],
      });
    });

    it('should extract recipes from registry', async () => {
      const recipes = [
        { id: 'recipe1', patterns: [] },
        { id: 'recipe2', patterns: [] },
      ];

      const ctx = createMockContext({
        blueprints: [{ id: 'bp1', slots: {} }],
        recipes,
      });

      mockValidationRule.shouldApply = jest.fn().mockReturnValue(true);
      mockValidationRule.validate = jest.fn().mockResolvedValue([]);

      await validationPhase.execute(ctx);

      const validationContext = mockValidationRule.validate.mock.calls[0][0];
      expect(validationContext.getRecipes()).toMatchObject({
        recipe1: recipes[0],
        recipe2: recipes[1],
      });
    });

    it('should handle blueprints without id gracefully', async () => {
      const ctx = createMockContext({
        blueprints: [
          { id: 'bp1', slots: {} },
          { slots: {} }, // Missing id
          { id: 'bp2', slots: {} },
        ],
        recipes: [{ id: 'recipe1', patterns: [] }],
      });

      mockValidationRule.shouldApply = jest.fn().mockReturnValue(true);
      mockValidationRule.validate = jest.fn().mockResolvedValue([]);

      await validationPhase.execute(ctx);

      const validationContext = mockValidationRule.validate.mock.calls[0][0];
      const blueprints = validationContext.getBlueprints();

      // Should only include blueprints with valid IDs
      expect(Object.keys(blueprints)).toEqual(['bp1', 'bp2']);
    });

    it('should handle recipes without id gracefully', async () => {
      const ctx = createMockContext({
        blueprints: [{ id: 'bp1', slots: {} }],
        recipes: [
          { id: 'recipe1', patterns: [] },
          { patterns: [] }, // Missing id
          { id: 'recipe2', patterns: [] },
        ],
      });

      mockValidationRule.shouldApply = jest.fn().mockReturnValue(true);
      mockValidationRule.validate = jest.fn().mockResolvedValue([]);

      await validationPhase.execute(ctx);

      const validationContext = mockValidationRule.validate.mock.calls[0][0];
      const recipes = validationContext.getRecipes();

      expect(Object.keys(recipes)).toEqual(['recipe1', 'recipe2']);
    });
  });

  describe('validation chain integration', () => {
    it('should create and execute ValidationRuleChain', async () => {
      const ctx = createMockContext({
        blueprints: [{ id: 'bp1', slots: {} }],
        recipes: [{ id: 'recipe1', patterns: [] }],
      });

      mockValidationRule.shouldApply = jest.fn().mockReturnValue(true);
      mockValidationRule.validate = jest.fn().mockResolvedValue([]);

      await validationPhase.execute(ctx);

      // Verify validation rule was called
      expect(mockValidationRule.validate).toHaveBeenCalledTimes(1);
      expect(mockValidationRule.validate).toHaveBeenCalledWith(
        expect.any(LoadTimeValidationContext)
      );
    });
  });

  describe('context preservation', () => {
    it('should preserve original context properties', async () => {
      const ctx = createMockContext({
        blueprints: [{ id: 'bp1', slots: {} }],
        recipes: [{ id: 'recipe1', patterns: [] }],
      });

      ctx.worldName = 'TestWorld';
      ctx.requestedMods = ['core', 'test_mod'];
      ctx.customProperty = 'preserved';

      mockValidationRule.shouldApply = jest.fn().mockReturnValue(true);
      mockValidationRule.validate = jest.fn().mockResolvedValue([]);

      const result = await validationPhase.execute(ctx);

      expect(result.worldName).toBe('TestWorld');
      expect(result.requestedMods).toEqual(['core', 'test_mod']);
      expect(result.customProperty).toBe('preserved');
    });
  });
});

/**
 * Helper function to create mock LoadContext
 *
 * @param {object} params - Configuration for mock context
 * @param {Array} params.blueprints - Array of blueprints
 * @param {Array} params.recipes - Array of recipes
 * @returns {object} Mock LoadContext
 */
function createMockContext({ blueprints = [], recipes = [] }) {
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
