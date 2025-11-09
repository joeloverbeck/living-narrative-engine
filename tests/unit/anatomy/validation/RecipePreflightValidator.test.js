/**
 * @file Unit tests for RecipePreflightValidator
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import RecipePreflightValidator from '../../../../src/anatomy/validation/RecipePreflightValidator.js';
import { ValidationReport } from '../../../../src/anatomy/validation/ValidationReport.js';

describe('RecipePreflightValidator', () => {
  let validator;
  let mockLogger;
  let mockDataRegistry;
  let mockAnatomyBlueprintRepository;
  let mockSchemaValidator;
  let mockSlotGenerator;

  beforeEach(() => {
    mockLogger = {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
    };

    mockDataRegistry = {
      get: () => undefined,
      getAll: () => [],
    };

    mockAnatomyBlueprintRepository = {
      getBlueprint: async () => null,
      getRecipe: async () => null,
    };

    mockSchemaValidator = {
      validate: () => ({ isValid: true, errors: [] }),
    };

    mockSlotGenerator = {
      extractSlotKeysFromLimbSet: () => [],
      extractSlotKeysFromAppendage: () => [],
    };

    validator = new RecipePreflightValidator({
      dataRegistry: mockDataRegistry,
      anatomyBlueprintRepository: mockAnatomyBlueprintRepository,
      schemaValidator: mockSchemaValidator,
      slotGenerator: mockSlotGenerator,
      logger: mockLogger,
    });
  });

  describe('Constructor', () => {
    it('should create instance with valid dependencies', () => {
      expect(validator).toBeDefined();
    });

    it('should throw error when dataRegistry is missing required methods', () => {
      expect(
        () =>
          new RecipePreflightValidator({
            dataRegistry: {},
            anatomyBlueprintRepository: mockAnatomyBlueprintRepository,
            schemaValidator: mockSchemaValidator,
            slotGenerator: mockSlotGenerator,
            logger: mockLogger,
          })
      ).toThrow();
    });

    it('should throw error when anatomyBlueprintRepository is missing required methods', () => {
      expect(
        () =>
          new RecipePreflightValidator({
            dataRegistry: mockDataRegistry,
            anatomyBlueprintRepository: {},
            schemaValidator: mockSchemaValidator,
            slotGenerator: mockSlotGenerator,
            logger: mockLogger,
          })
      ).toThrow();
    });

    it('should throw error when schemaValidator is missing required methods', () => {
      expect(
        () =>
          new RecipePreflightValidator({
            dataRegistry: mockDataRegistry,
            anatomyBlueprintRepository: mockAnatomyBlueprintRepository,
            schemaValidator: {},
            slotGenerator: mockSlotGenerator,
            logger: mockLogger,
          })
      ).toThrow();
    });
  });

  describe('validate', () => {
    it('should return ValidationReport instance', async () => {
      const recipe = {
        recipeId: 'test:recipe',
        blueprintId: 'test:blueprint',
        slots: {},
        patterns: [],
      };

      const report = await validator.validate(recipe);

      expect(report).toBeInstanceOf(ValidationReport);
    });

    it('should include recipe metadata in report', async () => {
      const recipe = {
        recipeId: 'test:recipe',
        blueprintId: 'test:blueprint',
        slots: {},
        patterns: [],
      };

      const report = await validator.validate(recipe, {
        recipePath: 'data/mods/test/recipes/recipe.json',
      });

      expect(report.summary.recipeId).toBe('test:recipe');
      expect(report.summary.recipePath).toBe('data/mods/test/recipes/recipe.json');
      expect(report.summary.timestamp).toBeDefined();
    });

    it('should pass validation when all checks succeed', async () => {
      mockAnatomyBlueprintRepository.getBlueprint = async () => ({
        id: 'test:blueprint',
        root: 'test:root',
        structureTemplate: 'test:template',
        additionalSlots: {},
      });

      mockDataRegistry.get = (type, id) => {
        if (type === 'entityDefinitions' && id === 'test:root') {
          return { id: 'test:root', components: {} };
        }
        return undefined;
      };

      const recipe = {
        recipeId: 'test:recipe',
        blueprintId: 'test:blueprint',
        slots: {},
        patterns: [],
      };

      const report = await validator.validate(recipe);

      expect(report.isValid).toBe(true);
      expect(report.errors.length).toBe(0);
    });

    it('should fail validation when blueprint does not exist', async () => {
      mockAnatomyBlueprintRepository.getBlueprint = async () => null;

      const recipe = {
        recipeId: 'test:recipe',
        blueprintId: 'test:blueprint',
        slots: {},
        patterns: [],
      };

      const report = await validator.validate(recipe);

      expect(report.isValid).toBe(false);
      expect(report.errors.length).toBeGreaterThan(0);
      expect(report.errors[0].type).toBe('BLUEPRINT_NOT_FOUND');
    });

    it('should collect multiple errors when failFast is false', async () => {
      mockAnatomyBlueprintRepository.getBlueprint = async () => null;
      mockDataRegistry.get = () => {
        // Return undefined for all components to trigger errors
        return undefined;
      };

      const recipe = {
        recipeId: 'test:recipe',
        blueprintId: 'test:blueprint',
        slots: {
          slot1: {
            tags: ['test:component1'],
            properties: {},
          },
        },
        patterns: [],
      };

      const report = await validator.validate(recipe, { failFast: false });

      expect(report.isValid).toBe(false);
      expect(report.errors.length).toBeGreaterThan(1);
    });

    it('should stop after first error when failFast is true', async () => {
      mockDataRegistry.get = () => undefined;

      const recipe = {
        recipeId: 'test:recipe',
        blueprintId: 'test:blueprint',
        slots: {
          slot1: {
            tags: ['test:component1'],
            properties: {},
          },
        },
        patterns: [],
      };

      const report = await validator.validate(recipe, { failFast: true });

      expect(report.isValid).toBe(false);
    });

    it('should skip pattern validation when skipPatternValidation is true', async () => {
      mockAnatomyBlueprintRepository.getBlueprint = async () => ({
        id: 'test:blueprint',
        root: 'test:root',
        structureTemplate: 'test:template',
      });

      const recipe = {
        recipeId: 'test:recipe',
        blueprintId: 'test:blueprint',
        slots: {},
        patterns: [
          {
            matches: ['test:pattern'],
            tags: [],
          },
        ],
      };

      const report = await validator.validate(recipe, {
        skipPatternValidation: true,
      });

      const passedChecks = report.toJSON().passed;
      const hasPatternCheck = passedChecks.some(
        (check) => check.check === 'pattern_matching'
      );
      expect(hasPatternCheck).toBe(false);
    });

    it('should skip descriptor checks when skipDescriptorChecks is true', async () => {
      mockAnatomyBlueprintRepository.getBlueprint = async () => ({
        id: 'test:blueprint',
        root: 'test:root',
        structureTemplate: 'test:template',
      });

      const recipe = {
        recipeId: 'test:recipe',
        blueprintId: 'test:blueprint',
        slots: {
          slot1: {
            tags: ['test:component1'],
          },
        },
        patterns: [],
      };

      const report = await validator.validate(recipe, {
        skipDescriptorChecks: true,
      });

      const passedChecks = report.toJSON().passed;
      const hasDescriptorCheck = passedChecks.some(
        (check) => check.check === 'descriptor_coverage'
      );
      expect(hasDescriptorCheck).toBe(false);
    });

    it('should add suggestions when slots have no descriptor components', async () => {
      mockAnatomyBlueprintRepository.getBlueprint = async () => ({
        id: 'test:blueprint',
        root: 'test:root',
        structureTemplate: 'test:template',
      });

      mockDataRegistry.get = () => ({ id: 'test:component1' });

      const recipe = {
        recipeId: 'test:recipe',
        blueprintId: 'test:blueprint',
        slots: {
          slot1: {
            tags: ['test:component1'],
          },
        },
        patterns: [],
      };

      const report = await validator.validate(recipe);

      expect(report.hasSuggestions).toBe(true);
      expect(report.suggestions.length).toBeGreaterThan(0);
      expect(report.suggestions[0].type).toBe('MISSING_DESCRIPTORS');
    });

    it('should not add suggestions when slots have descriptor components', async () => {
      mockAnatomyBlueprintRepository.getBlueprint = async () => ({
        id: 'test:blueprint',
        root: 'test:root',
        structureTemplate: 'test:template',
      });

      mockDataRegistry.get = () => ({ id: 'descriptors:size_category' });

      mockDataRegistry.getAll = (type) => {
        if (type === 'entityDefinitions') {
          return [
            {
              id: 'test:entity',
              components: {
                'anatomy:part': { subType: 'test_part' },
                'descriptors:size_category': { size: 'large' },
              },
            },
          ];
        }
        return [];
      };

      const recipe = {
        recipeId: 'test:recipe',
        blueprintId: 'test:blueprint',
        slots: {
          slot1: {
            partType: 'test_part',
            tags: ['descriptors:size_category'],
            properties: {
              'descriptors:size_category': { size: 'large' },
            },
          },
        },
        patterns: [],
      };

      const report = await validator.validate(recipe);

      expect(report.hasSuggestions).toBe(false);
    });

    it('should handle validation errors gracefully', async () => {
      mockAnatomyBlueprintRepository.getBlueprint = async () => {
        throw new Error('Test error');
      };

      const recipe = {
        recipeId: 'test:recipe',
        blueprintId: 'test:blueprint',
        slots: {},
        patterns: [],
      };

      const report = await validator.validate(recipe);

      expect(report.isValid).toBe(false);
      expect(report.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Component existence validation', () => {
    it('should pass when all component references exist', async () => {
      mockAnatomyBlueprintRepository.getBlueprint = async (blueprintId) => {
        if (blueprintId === 'test:blueprint') {
          return {
            id: 'test:blueprint',
            root: 'test:root',
            structureTemplate: 'test:template',
            additionalSlots: {},
          };
        }
        return null;
      };

      mockDataRegistry.get = (type, id) => {
        if (type === 'components') {
          return {
            id,
            dataSchema: {
              type: 'object',
              properties: {
                value: { type: 'string' },
              },
            },
          };
        }
        if (type === 'entityDefinitions' && id === 'test:root') {
          return { id: 'test:root', components: {} };
        }
        return undefined;
      };

      mockDataRegistry.getAll = (type) => {
        if (type === 'entityDefinitions') {
          return [
            {
              id: 'test:entity',
              components: {
                'anatomy:part': { subType: 'test_part' },
                'test:component1': {},
                'test:component2': { value: 'test' },
              },
            },
          ];
        }
        return [];
      };

      const recipe = {
        recipeId: 'test:recipe',
        blueprintId: 'test:blueprint',
        slots: {
          slot1: {
            partType: 'test_part',
            tags: ['test:component1'],
            properties: {
              'test:component2': { value: 'test' },
            },
          },
        },
        patterns: [],
      };

      const report = await validator.validate(recipe);

      expect(report.isValid).toBe(true);
    });

    it('should fail when component references do not exist', async () => {
      mockAnatomyBlueprintRepository.getBlueprint = async () => ({
        id: 'test:blueprint',
        root: 'test:root',
        structureTemplate: 'test:template',
      });

      mockDataRegistry.get = () => undefined;

      const recipe = {
        recipeId: 'test:recipe',
        blueprintId: 'test:blueprint',
        slots: {
          slot1: {
            tags: ['test:component1'],
            properties: {},
          },
        },
        patterns: [],
      };

      const report = await validator.validate(recipe);

      expect(report.isValid).toBe(false);
      expect(report.errors.some((e) => e.type === 'COMPONENT_NOT_FOUND')).toBe(
        true
      );
    });
  });

  describe('Property schema validation', () => {
    it('should pass when property values match schemas', async () => {
      mockAnatomyBlueprintRepository.getBlueprint = async () => ({
        id: 'test:blueprint',
        root: 'test:root',
        structureTemplate: 'test:template',
        additionalSlots: {},
      });

      mockDataRegistry.get = (type, id) => {
        if (type === 'components') {
          return {
            id,
            dataSchema: {
              type: 'object',
              properties: {
                value: { type: 'string' },
              },
            },
          };
        }
        if (type === 'entityDefinitions' && id === 'test:root') {
          return { id: 'test:root', components: {} };
        }
        return undefined;
      };

      mockSchemaValidator.validate = () => ({
        isValid: true,
        errors: [],
      });

      mockDataRegistry.getAll = (type) => {
        if (type === 'entityDefinitions') {
          return [
            {
              id: 'test:entity',
              components: {
                'anatomy:part': { subType: 'test_part' },
                'test:component1': { value: 'test' },
              },
            },
          ];
        }
        return [];
      };

      const recipe = {
        recipeId: 'test:recipe',
        blueprintId: 'test:blueprint',
        slots: {
          slot1: {
            partType: 'test_part',
            tags: [],
            properties: {
              'test:component1': { value: 'test' },
            },
          },
        },
        patterns: [],
      };

      const report = await validator.validate(recipe);

      expect(report.isValid).toBe(true);
    });

    it('should fail when property values do not match schemas', async () => {
      mockAnatomyBlueprintRepository.getBlueprint = async () => ({
        id: 'test:blueprint',
        root: 'test:root',
        structureTemplate: 'test:template',
      });

      mockDataRegistry.get = (type, id) => {
        if (type === 'components') {
          return {
            id,
            dataSchema: {
              type: 'object',
              properties: {
                value: { type: 'string' },
              },
              required: ['value'],
            },
          };
        }
        return undefined;
      };

      mockSchemaValidator.validate = () => {
        // Return validation failure
        return {
          isValid: false,
          errors: [{ message: 'Missing required property: value' }],
        };
      };

      const recipe = {
        recipeId: 'test:recipe',
        blueprintId: 'test:blueprint',
        slots: {
          slot1: {
            tags: [],
            properties: {
              'test:component1': {}, // Missing required 'value' property
            },
          },
        },
        patterns: [],
      };

      const report = await validator.validate(recipe);

      expect(report.isValid).toBe(false);
      expect(
        report.errors.some((e) => e.type === 'INVALID_PROPERTY_VALUE')
      ).toBe(true);
    });
  });

  describe('Socket/slot compatibility', () => {
    it('should pass when blueprint exists', async () => {
      mockAnatomyBlueprintRepository.getBlueprint = async () => ({
        id: 'test:blueprint',
        root: 'test:root',
        structureTemplate: 'test:template',
        additionalSlots: {},
      });

      mockDataRegistry.get = (type, id) => {
        if (type === 'entityDefinitions' && id === 'test:root') {
          return { id: 'test:root', components: {} };
        }
        return undefined;
      };

      const recipe = {
        recipeId: 'test:recipe',
        blueprintId: 'test:blueprint',
        slots: {},
        patterns: [],
      };

      const report = await validator.validate(recipe);

      const passedChecks = report.toJSON().passed;
      const hasSocketCheck = passedChecks.some(
        (check) => check.check === 'socket_slot_compatibility'
      );
      expect(hasSocketCheck).toBe(true);
    });

    it('should skip when blueprint does not exist', async () => {
      mockAnatomyBlueprintRepository.getBlueprint = async () => null;

      const recipe = {
        recipeId: 'test:recipe',
        blueprintId: 'test:blueprint',
        slots: {},
        patterns: [],
      };

      const report = await validator.validate(recipe);

      const passedChecks = report.toJSON().passed;
      const hasSocketCheck = passedChecks.some(
        (check) => check.check === 'socket_slot_compatibility'
      );
      expect(hasSocketCheck).toBe(false);
    });
  });

  describe('Pattern matching', () => {
    it('should pass when no patterns exist', async () => {
      mockAnatomyBlueprintRepository.getBlueprint = async () => ({
        id: 'test:blueprint',
        root: 'test:root',
        structureTemplate: 'test:template',
      });

      const recipe = {
        recipeId: 'test:recipe',
        blueprintId: 'test:blueprint',
        slots: {},
        patterns: [],
      };

      const report = await validator.validate(recipe);

      const passedChecks = report.toJSON().passed;
      const patternCheck = passedChecks.find(
        (check) => check.check === 'pattern_matching'
      );
      expect(patternCheck).toBeDefined();
      expect(patternCheck.message).toContain('No patterns');
    });

    it('should validate patterns when they exist', async () => {
      mockAnatomyBlueprintRepository.getBlueprint = async () => ({
        id: 'test:blueprint',
        root: 'test:root',
        structureTemplate: 'test:template',
        slots: {
          'test:pattern': {
            socket: 'test:pattern',
            requirements: { partType: 'test' },
          },
        },
      });

      const recipe = {
        recipeId: 'test:recipe',
        blueprintId: 'test:blueprint',
        slots: {},
        patterns: [
          {
            matches: ['test:pattern'],
            tags: [],
          },
        ],
      };

      const report = await validator.validate(recipe);

      const passedChecks = report.toJSON().passed;
      const patternCheck = passedChecks.find(
        (check) => check.check === 'pattern_matching'
      );
      expect(patternCheck).toBeDefined();
      expect(patternCheck.message).toContain('1 pattern(s)');
    });
  });

  describe('Error handling', () => {
    it('should handle socket/slot compatibility check throwing an error', async () => {
      // First getBlueprint call should succeed, second should throw
      let callCount = 0;
      mockAnatomyBlueprintRepository.getBlueprint = async () => {
        callCount++;
        if (callCount === 1) {
          return {
            id: 'test:blueprint',
            root: 'test:root',
            structureTemplate: 'test:template',
            additionalSlots: {},
          };
        }
        if (callCount === 2) {
          return {
            id: 'test:blueprint',
            root: 'test:root',
            structureTemplate: 'test:template',
            additionalSlots: {},
          };
        }
        throw new Error('Blueprint fetch error');
      };

      mockDataRegistry.get = (type, id) => {
        if (type === 'entityDefinitions' && id === 'test:root') {
          throw new Error('Entity fetch error');
        }
        return undefined;
      };

      const originalError = mockLogger.error;
      let errorLogged = false;
      mockLogger.error = (message, error) => {
        if (message === 'Socket/slot compatibility check failed') {
          errorLogged = true;
        }
        originalError.call(mockLogger, message, error);
      };

      const recipe = {
        recipeId: 'test:recipe',
        blueprintId: 'test:blueprint',
        slots: {},
        patterns: [],
      };

      const report = await validator.validate(recipe);

      expect(errorLogged).toBe(true);
      expect(
        report.warnings.some(
          (w) => w.check === 'socket_slot_compatibility'
        )
      ).toBe(true);

      // Restore
      mockLogger.error = originalError;
    });

    it('should handle pattern matching check throwing an error', async () => {
      mockAnatomyBlueprintRepository.getBlueprint = async () => ({
        id: 'test:blueprint',
        root: 'test:root',
        structureTemplate: 'test:template',
      });

      const originalError = mockLogger.error;
      let errorLogged = false;
      mockLogger.error = (message, error) => {
        if (message === 'Pattern matching check failed') {
          errorLogged = true;
        }
        originalError.call(mockLogger, message, error);
      };

      // Create a recipe with patterns that will cause an error when accessed
      const recipe = new Proxy(
        {
          recipeId: 'test:recipe',
          blueprintId: 'test:blueprint',
          slots: {},
        },
        {
          get(target, prop) {
            if (prop === 'patterns') {
              throw new Error('Pattern access error');
            }
            return target[prop];
          },
        }
      );

      const report = await validator.validate(recipe);

      expect(errorLogged).toBe(true);
      expect(
        report.warnings.some((w) => w.check === 'pattern_matching')
      ).toBe(true);

      // Restore
      mockLogger.error = originalError;
    });

    it('should handle descriptor coverage check throwing an error', async () => {
      mockAnatomyBlueprintRepository.getBlueprint = async () => ({
        id: 'test:blueprint',
        root: 'test:root',
        structureTemplate: 'test:template',
      });

      const originalError = mockLogger.error;
      let errorLogged = false;
      mockLogger.error = (message, error) => {
        if (message === 'Descriptor coverage check failed') {
          errorLogged = true;
        }
        originalError.call(mockLogger, message, error);
      };

      // Create a recipe with slots that will cause an error when accessed
      const recipe = new Proxy(
        {
          recipeId: 'test:recipe',
          blueprintId: 'test:blueprint',
          patterns: [],
        },
        {
          get(target, prop) {
            if (prop === 'slots') {
              throw new Error('Slots access error');
            }
            return target[prop];
          },
        }
      );

      await validator.validate(recipe);

      // Error is logged but not added to report (it's optional)
      expect(errorLogged).toBe(true);

      // Restore
      mockLogger.error = originalError;
    });
  });
});
