import {
  beforeEach,
  describe,
  expect,
  it,
  jest,
  afterEach,
} from '@jest/globals';
import { RecipeConstraintRule } from '../../../../../src/anatomy/validation/rules/recipeConstraintRule.js';
import { RecipeConstraintEvaluator } from '../../../../../src/anatomy/recipeConstraintEvaluator.js';
import { createMockLogger } from '../../../../common/mockFactories/loggerMocks.js';

describe('RecipeConstraintRule', () => {
  let logger;
  let context;
  let providedEvaluator;
  let rule;

  beforeEach(() => {
    logger = createMockLogger();
    providedEvaluator = {
      evaluateConstraints: jest.fn(),
    };

    context = {
      entityIds: ['entity-1', 'entity-2'],
      recipe: {
        constraints: {},
      },
      logger,
      entityManager: {},
    };

    rule = new RecipeConstraintRule({
      recipeConstraintEvaluator: providedEvaluator,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('metadata', () => {
    it('exposes identifiers for rule and display name', () => {
      expect(rule.ruleId).toBe('recipe-constraints');
      expect(rule.ruleName).toBe('Recipe Constraint Validation');
    });
  });

  describe('shouldApply', () => {
    it('returns false when there are no constraints or slots', () => {
      expect(
        rule.shouldApply({
          recipe: {},
        })
      ).toBe(false);
    });

    it('returns true when requires constraints are present', () => {
      expect(
        rule.shouldApply({
          recipe: { constraints: { requires: [{}] } },
        })
      ).toBe(true);
    });

    it('returns true when excludes constraints are present', () => {
      expect(
        rule.shouldApply({
          recipe: { constraints: { excludes: [{}] } },
        })
      ).toBe(true);
    });

    it('returns true when slot definitions exist', () => {
      expect(
        rule.shouldApply({
          recipe: { slots: [{ id: 'slot-1' }] },
        })
      ).toBe(true);
    });
  });

  describe('validate with provided evaluator', () => {
    it('delegates to the provided evaluator and maps issues', async () => {
      providedEvaluator.evaluateConstraints.mockReturnValue({
        errors: ['missing component', 'missing slot'],
        warnings: ['optional accessory not equipped'],
      });

      const issues = await rule.validate(context);

      expect(providedEvaluator.evaluateConstraints).toHaveBeenCalledWith(
        context.entityIds,
        context.recipe
      );
      expect(logger.debug).toHaveBeenNthCalledWith(
        1,
        'RecipeConstraintRule: Validating recipe constraints for 2 entities'
      );
      expect(logger.debug).toHaveBeenNthCalledWith(
        2,
        'RecipeConstraintRule: Found 2 errors and 1 warnings'
      );
      expect(issues).toEqual([
        {
          severity: 'error',
          message: 'missing component',
          ruleId: 'recipe-constraints',
          context: {},
        },
        {
          severity: 'error',
          message: 'missing slot',
          ruleId: 'recipe-constraints',
          context: {},
        },
        {
          severity: 'warning',
          message: 'optional accessory not equipped',
          ruleId: 'recipe-constraints',
          context: {},
        },
      ]);
    });

    it('returns an empty array when evaluator reports no problems', async () => {
      providedEvaluator.evaluateConstraints.mockReturnValue({
        errors: [],
        warnings: [],
      });

      const issues = await rule.validate(context);

      expect(providedEvaluator.evaluateConstraints).toHaveBeenCalledWith(
        context.entityIds,
        context.recipe
      );
      expect(logger.debug).toHaveBeenNthCalledWith(
        1,
        'RecipeConstraintRule: Validating recipe constraints for 2 entities'
      );
      expect(logger.debug).toHaveBeenNthCalledWith(
        2,
        'RecipeConstraintRule: Found 0 errors and 0 warnings'
      );
      expect(issues).toEqual([]);
    });
  });

  describe('validate without provided evaluator', () => {
    it('creates an evaluator from the context when one is not supplied', async () => {
      const evaluateSpy = jest
        .spyOn(RecipeConstraintEvaluator.prototype, 'evaluateConstraints')
        .mockReturnValue({
          errors: ['auto-generated error'],
          warnings: ['auto-generated warning'],
        });

      const fallbackRule = new RecipeConstraintRule({
        recipeConstraintEvaluator: undefined,
      });

      const issues = await fallbackRule.validate({
        ...context,
        entityManager: {
          getComponentData: jest.fn(),
          getAllComponentTypesForEntity: jest.fn(),
        },
      });

      expect(evaluateSpy).toHaveBeenCalledWith(
        context.entityIds,
        context.recipe
      );
      expect(logger.debug).toHaveBeenNthCalledWith(
        1,
        'RecipeConstraintRule: Validating recipe constraints for 2 entities'
      );
      expect(logger.debug).toHaveBeenNthCalledWith(
        2,
        'RecipeConstraintRule: Found 1 errors and 1 warnings'
      );
      expect(issues).toEqual([
        {
          severity: 'error',
          message: 'auto-generated error',
          ruleId: 'recipe-constraints',
          context: {},
        },
        {
          severity: 'warning',
          message: 'auto-generated warning',
          ruleId: 'recipe-constraints',
          context: {},
        },
      ]);
    });
  });
});
