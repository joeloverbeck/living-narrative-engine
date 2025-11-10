/**
 * @file Unit tests for RecipePreflightValidator
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import RecipePreflightValidator from '../../../../src/anatomy/validation/RecipePreflightValidator.js';
import { ValidationReport } from '../../../../src/anatomy/validation/ValidationReport.js';
import * as patternMatchingValidator from '../../../../src/anatomy/validation/patternMatchingValidator.js';
import * as socketSlotCompatibilityValidator from '../../../../src/anatomy/validation/socketSlotCompatibilityValidator.js';
import { ComponentExistenceValidationRule } from '../../../../src/anatomy/validation/rules/componentExistenceValidationRule.js';
import { PropertySchemaValidationRule } from '../../../../src/anatomy/validation/rules/propertySchemaValidationRule.js';

describe('RecipePreflightValidator', () => {
  let validator;
  let mockLogger;
  let mockDataRegistry;
  let mockAnatomyBlueprintRepository;
  let mockSchemaValidator;
  let mockSlotGenerator;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    mockDataRegistry = {
      get: jest.fn(() => undefined),
      getAll: jest.fn(() => []),
    };

    mockAnatomyBlueprintRepository = {
      getBlueprint: jest.fn(async () => null),
      getRecipe: jest.fn(async () => null),
    };

    mockSchemaValidator = {
      validate: jest.fn(() => ({ isValid: true, errors: [] })),
    };

    mockSlotGenerator = {
      extractSlotKeysFromLimbSet: jest.fn(() => []),
      extractSlotKeysFromAppendage: jest.fn(() => []),
      generateBlueprintSlots: jest.fn(() => ({})),
    };

    validator = new RecipePreflightValidator({
      dataRegistry: mockDataRegistry,
      anatomyBlueprintRepository: mockAnatomyBlueprintRepository,
      schemaValidator: mockSchemaValidator,
      slotGenerator: mockSlotGenerator,
      logger: mockLogger,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
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

    it('should warn when pattern matching blueprint is missing', async () => {
      jest
        .spyOn(ComponentExistenceValidationRule.prototype, 'validate')
        .mockResolvedValue([]);
      jest
        .spyOn(PropertySchemaValidationRule.prototype, 'validate')
        .mockResolvedValue([]);

      mockAnatomyBlueprintRepository.getBlueprint = jest.fn(async () => null);

      const recipe = {
        recipeId: 'test:recipe',
        blueprintId: 'missing:blueprint',
        slots: {},
        patterns: [
          {
            matches: ['slot1'],
          },
        ],
      };

      await validator.validate(recipe, {
        skipDescriptorChecks: true,
        skipPartAvailabilityChecks: true,
      });

      expect(mockLogger.warn).toHaveBeenCalledWith(
        "Cannot validate patterns: blueprint 'missing:blueprint' not found"
      );
    });

    it('should include pattern warnings when pattern matching reports issues', async () => {
      jest
        .spyOn(ComponentExistenceValidationRule.prototype, 'validate')
        .mockResolvedValue([]);
      jest
        .spyOn(PropertySchemaValidationRule.prototype, 'validate')
        .mockResolvedValue([]);
      jest
        .spyOn(socketSlotCompatibilityValidator, 'validateSocketSlotCompatibility')
        .mockResolvedValue([]);

      const patternWarning = {
        type: 'NO_MATCHING_SLOTS',
        check: 'pattern_matching',
        message: 'Pattern has no matches',
      };

      jest
        .spyOn(patternMatchingValidator, 'validatePatternMatching')
        .mockReturnValue([patternWarning]);

      mockAnatomyBlueprintRepository.getBlueprint = jest.fn(async () => ({
        id: 'test:blueprint',
        root: 'test:root',
        structureTemplate: 'test:template',
        slots: { slot1: {} },
        additionalSlots: {},
      }));

      const recipe = {
        recipeId: 'test:recipe',
        blueprintId: 'test:blueprint',
        slots: {},
        patterns: [
          {
            matches: ['slot1'],
          },
        ],
      };

      const report = await validator.validate(recipe, {
        skipDescriptorChecks: true,
        skipPartAvailabilityChecks: true,
      });

      expect(patternMatchingValidator.validatePatternMatching).toHaveBeenCalled();
      expect(report.warnings).toContainEqual(patternWarning);
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

  describe('Part availability validation', () => {
    it('should report errors when no entities satisfy slot or pattern requirements', async () => {
      jest
        .spyOn(ComponentExistenceValidationRule.prototype, 'validate')
        .mockResolvedValue([]);
      jest
        .spyOn(PropertySchemaValidationRule.prototype, 'validate')
        .mockResolvedValue([]);
      jest
        .spyOn(socketSlotCompatibilityValidator, 'validateSocketSlotCompatibility')
        .mockResolvedValue([]);

      mockAnatomyBlueprintRepository.getBlueprint = jest.fn(async () => ({
        id: 'test:blueprint',
        root: 'test:root',
        structureTemplate: 'test:template',
        additionalSlots: {},
      }));

      mockDataRegistry.getAll = jest.fn((type) => {
        if (type === 'entityDefinitions') {
          return [
            {
              id: 'entity:wrongPartType',
              components: {
                'anatomy:part': { subType: 'leg' },
                'component:tag': {},
                'component:prop': {},
              },
            },
            {
              id: 'entity:missingTag',
              components: {
                'anatomy:part': { subType: 'arm' },
                'component:prop': {},
              },
            },
            {
              id: 'entity:missingProperty',
              components: {
                'anatomy:part': { subType: 'arm' },
                'component:tag': {},
              },
            },
          ];
        }
        return [];
      });

      const recipe = {
        recipeId: 'test:recipe',
        blueprintId: 'test:blueprint',
        slots: {
          slot1: {
            partType: 'arm',
            tags: ['component:tag'],
            properties: {
              'component:prop': {},
            },
          },
        },
        patterns: [
          {
            partType: 'arm',
            tags: ['component:tag'],
            properties: {
              'component:prop': {},
            },
          },
        ],
      };

      const report = await validator.validate(recipe, {
        skipDescriptorChecks: true,
        skipPatternValidation: true,
      });

      expect(report.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'PART_UNAVAILABLE',
            location: { type: 'slot', name: 'slot1' },
          }),
          expect.objectContaining({
            type: 'PART_UNAVAILABLE',
            location: { type: 'pattern', index: 0 },
          }),
        ])
      );
    });

    it('should report errors when entity property values do not match recipe requirements', async () => {
      jest
        .spyOn(ComponentExistenceValidationRule.prototype, 'validate')
        .mockResolvedValue([]);
      jest
        .spyOn(PropertySchemaValidationRule.prototype, 'validate')
        .mockResolvedValue([]);
      jest
        .spyOn(socketSlotCompatibilityValidator, 'validateSocketSlotCompatibility')
        .mockResolvedValue([]);

      mockAnatomyBlueprintRepository.getBlueprint = jest.fn(async () => ({
        id: 'test:blueprint',
        root: 'test:root',
        structureTemplate: 'test:template',
        additionalSlots: {},
      }));

      mockDataRegistry.getAll = jest.fn((type) => {
        if (type === 'entityDefinitions') {
          return [
            {
              id: 'entity:surface_eye',
              components: {
                'anatomy:part': { subType: 'eldritch_surface_eye' },
                'descriptors:animation': {
                  animation: 'unblinking-independent-motion', // Does NOT match recipe requirement
                },
                'descriptors:luminosity': {
                  luminosity: 'faint-glow', // Matches
                },
              },
            },
          ];
        }
        return [];
      });

      const recipe = {
        recipeId: 'test:recipe',
        blueprintId: 'test:blueprint',
        slots: {
          surface_eye_1: {
            partType: 'eldritch_surface_eye',
            tags: ['anatomy:part'],
            properties: {
              'descriptors:animation': {
                animation: 'unblinking', // Requires exact match
              },
              'descriptors:luminosity': {
                luminosity: 'faint-glow',
              },
            },
          },
        },
        patterns: [],
      };

      const report = await validator.validate(recipe, {
        skipDescriptorChecks: true,
        skipPatternValidation: true,
      });

      // Should fail because property value doesn't match
      expect(report.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'PART_UNAVAILABLE',
            location: { type: 'slot', name: 'surface_eye_1' },
            message: expect.stringContaining("No entity definitions found for slot 'surface_eye_1'"),
          }),
        ])
      );
    });

    it('should pass when entity property values exactly match recipe requirements', async () => {
      jest
        .spyOn(ComponentExistenceValidationRule.prototype, 'validate')
        .mockResolvedValue([]);
      jest
        .spyOn(PropertySchemaValidationRule.prototype, 'validate')
        .mockResolvedValue([]);
      jest
        .spyOn(socketSlotCompatibilityValidator, 'validateSocketSlotCompatibility')
        .mockResolvedValue([]);

      mockAnatomyBlueprintRepository.getBlueprint = jest.fn(async () => ({
        id: 'test:blueprint',
        root: 'test:root',
        structureTemplate: 'test:template',
        additionalSlots: {},
      }));

      mockDataRegistry.getAll = jest.fn((type) => {
        if (type === 'entityDefinitions') {
          return [
            {
              id: 'entity:surface_eye',
              components: {
                'anatomy:part': { subType: 'eldritch_surface_eye' },
                'descriptors:animation': {
                  animation: 'unblinking', // Exact match
                },
                'descriptors:luminosity': {
                  luminosity: 'faint-glow', // Exact match
                },
              },
            },
          ];
        }
        return [];
      });

      const recipe = {
        recipeId: 'test:recipe',
        blueprintId: 'test:blueprint',
        slots: {
          surface_eye_1: {
            partType: 'eldritch_surface_eye',
            tags: ['anatomy:part'],
            properties: {
              'descriptors:animation': {
                animation: 'unblinking',
              },
              'descriptors:luminosity': {
                luminosity: 'faint-glow',
              },
            },
          },
        },
        patterns: [],
      };

      const report = await validator.validate(recipe, {
        skipDescriptorChecks: true,
        skipPatternValidation: true,
      });

      // Should pass because property values match exactly
      expect(report.isValid).toBe(true);
      expect(report.errors.filter(e => e.type === 'PART_UNAVAILABLE')).toHaveLength(0);
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

  describe('Blueprint Processing (#ensureBlueprintProcessed)', () => {
    it('should process V2 blueprint with structure template', async () => {
      const structureTemplate = {
        id: 'test:template',
        topology: {
          limbSets: [
            {
              type: 'leg',
              count: 4,
              arrangement: 'quadrupedal',
              socketPattern: {
                idTemplate: 'leg_{{orientation}}',
                orientationScheme: 'bilateral',
                allowedTypes: ['leg'],
              },
            },
          ],
          appendages: [],
        },
      };

      const rawBlueprint = {
        id: 'test:blueprint',
        schemaVersion: '2.0',
        root: 'test:root',
        structureTemplate: 'test:template',
        additionalSlots: {
          arm_left: {
            socket: 'arm_left',
            requirements: { partType: 'arm', components: ['anatomy:part'] },
          },
        },
      };

      // Mock entity definitions for part availability checks
      const mockEntityDefs = [
        {
          id: 'test:leg_part',
          components: {
            'anatomy:part': { subType: 'front_leg' },
          },
        },
        {
          id: 'test:arm_part',
          components: {
            'anatomy:part': { subType: 'arm' },
          },
        },
      ];

      mockDataRegistry.get = jest.fn((type, id) => {
        if (type === 'anatomyStructureTemplates' && id === 'test:template') {
          return structureTemplate;
        }
        if (type === 'components' && id === 'anatomy:part') {
          return { id: 'anatomy:part', dataSchema: {} };
        }
        if (type === 'entityDefinitions' && id === 'test:root') {
          return {
            id: 'test:root',
            components: {
              'anatomy:sockets': {
                sockets: [
                  { id: 'arm_left', allowedTypes: ['arm'] },
                ],
              },
            },
          };
        }
        return undefined;
      });

      mockDataRegistry.getAll = jest.fn((type) => {
        if (type === 'entityDefinitions') {
          return mockEntityDefs;
        }
        if (type === 'components') {
          return [{ id: 'anatomy:part', dataSchema: {} }];
        }
        return [];
      });

      mockSlotGenerator.generateBlueprintSlots = jest.fn(() => ({
        leg_left_front: {
          socket: 'leg_left_front',
          orientation: 'left_front',
          requirements: { partType: 'leg', components: ['anatomy:part'] },
        },
        leg_right_front: {
          socket: 'leg_right_front',
          orientation: 'right_front',
          requirements: { partType: 'leg', components: ['anatomy:part'] },
        },
        leg_left_rear: {
          socket: 'leg_left_rear',
          orientation: 'left_rear',
          requirements: { partType: 'leg', components: ['anatomy:part'] },
        },
        leg_right_rear: {
          socket: 'leg_right_rear',
          orientation: 'right_rear',
          requirements: { partType: 'leg', components: ['anatomy:part'] },
        },
      }));

      mockAnatomyBlueprintRepository.getBlueprint = async () => rawBlueprint;

      const recipe = {
        recipeId: 'test:recipe',
        blueprintId: 'test:blueprint',
        slots: {},
        patterns: [
          {
            matchesAll: { slotType: 'leg', orientation: '*_front' },
            partType: 'front_leg',
            tags: ['anatomy:part'],
            properties: {},
          },
          {
            matchesAll: { slotType: 'arm' },
            partType: 'arm',
            tags: ['anatomy:part'],
            properties: {},
          },
        ],
      };

      const report = await validator.validate(recipe);

      // Should pass pattern matching now that slots are generated and merged
      expect(report.isValid).toBe(true);
      expect(report.warnings).toHaveLength(0);
      expect(
        report.passed.some((p) => p.check === 'pattern_matching')
      ).toBe(true);
    });

    it('should handle V1 blueprints without processing', async () => {
      const v1Blueprint = {
        id: 'test:blueprint_v1',
        root: 'test:root',
        slots: {
          leg_1: {
            socket: 'leg_1',
            requirements: { partType: 'leg', components: ['anatomy:part'] },
          },
        },
      };

      const mockEntityDefs = [
        {
          id: 'test:leg_part',
          components: {
            'anatomy:part': { subType: 'leg' },
          },
        },
      ];

      mockDataRegistry.get = jest.fn((type, id) => {
        if (type === 'components' && id === 'anatomy:part') {
          return { id: 'anatomy:part', dataSchema: {} };
        }
        if (type === 'entityDefinitions' && id === 'test:root') {
          return {
            id: 'test:root',
            components: {
              'anatomy:sockets': {
                sockets: [
                  { id: 'leg_1', allowedTypes: ['leg'] },
                ],
              },
            },
          };
        }
        return undefined;
      });

      mockDataRegistry.getAll = jest.fn((type) => {
        if (type === 'entityDefinitions') {
          return mockEntityDefs;
        }
        if (type === 'components') {
          return [{ id: 'anatomy:part', dataSchema: {} }];
        }
        return [];
      });

      mockAnatomyBlueprintRepository.getBlueprint = async () => v1Blueprint;

      const recipe = {
        recipeId: 'test:recipe',
        blueprintId: 'test:blueprint_v1',
        slots: {},
        patterns: [
          {
            matchesAll: { slotType: 'leg' },
            partType: 'leg',
            tags: ['anatomy:part'],
            properties: {},
          },
        ],
      };

      const report = await validator.validate(recipe);

      // Should validate without processing since it's V1
      expect(report.isValid).toBe(true);
      expect(mockSlotGenerator.generateBlueprintSlots).not.toHaveBeenCalled();
    });

    it('should handle missing structure template gracefully', async () => {
      const rawBlueprint = {
        id: 'test:blueprint',
        schemaVersion: '2.0',
        structureTemplate: 'test:missing_template',
        additionalSlots: {
          arm_left: {
            socket: 'arm_left',
            requirements: { partType: 'arm', components: ['anatomy:part'] },
          },
        },
      };

      mockDataRegistry.get = jest.fn(() => undefined); // Template not found
      mockAnatomyBlueprintRepository.getBlueprint = async () => rawBlueprint;

      const recipe = {
        recipeId: 'test:recipe',
        blueprintId: 'test:blueprint',
        patterns: [
          {
            matchesAll: { slotType: 'arm' },
            partType: 'arm',
            tags: ['anatomy:part'],
          },
        ],
      };

      const report = await validator.validate(recipe);

      // Should warn about missing template but continue with raw blueprint
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Structure template')
      );
      // Pattern should fail since slots aren't generated
      expect(report.warnings.length).toBeGreaterThan(0);
    });

    it('should merge additionalSlots with generated slots (additionalSlots precedence)', async () => {
      const structureTemplate = {
        id: 'test:template',
        topology: {
          limbSets: [],
          appendages: [
            {
              type: 'head',
              count: 1,
              socketPattern: {
                idTemplate: 'head',
                allowedTypes: ['head'],
              },
            },
          ],
        },
      };

      const rawBlueprint = {
        id: 'test:blueprint',
        schemaVersion: '2.0',
        root: 'test:root',
        structureTemplate: 'test:template',
        additionalSlots: {
          head: {
            socket: 'head',
            requirements: {
              partType: 'custom_head', // Override
              components: ['anatomy:part', 'anatomy:special'],
            },
          },
        },
      };

      const mockEntityDefs = [
        {
          id: 'test:custom_head_part',
          components: {
            'anatomy:part': { subType: 'custom_head' },
            'anatomy:special': {},
          },
        },
      ];

      mockDataRegistry.get = jest.fn((type, id) => {
        if (type === 'anatomyStructureTemplates' && id === 'test:template') {
          return structureTemplate;
        }
        if (type === 'components' && (id === 'anatomy:part' || id === 'anatomy:special')) {
          return { id, dataSchema: {} };
        }
        if (type === 'entityDefinitions' && id === 'test:root') {
          return {
            id: 'test:root',
            components: {
              'anatomy:sockets': {
                sockets: [
                  { id: 'head', allowedTypes: ['head', 'custom_head'] },
                ],
              },
            },
          };
        }
        return undefined;
      });

      mockDataRegistry.getAll = jest.fn((type) => {
        if (type === 'entityDefinitions') {
          return mockEntityDefs;
        }
        if (type === 'components') {
          return [
            { id: 'anatomy:part', dataSchema: {} },
            { id: 'anatomy:special', dataSchema: {} },
          ];
        }
        return [];
      });

      mockSlotGenerator.generateBlueprintSlots = jest.fn(() => ({
        head: {
          socket: 'head',
          requirements: { partType: 'head', components: ['anatomy:part'] },
        },
      }));

      mockAnatomyBlueprintRepository.getBlueprint = async () => rawBlueprint;

      const recipe = {
        recipeId: 'test:recipe',
        blueprintId: 'test:blueprint',
        slots: {},
        patterns: [
          {
            matchesAll: { slotType: 'custom_head' }, // Should match the override
            partType: 'custom_head',
            tags: ['anatomy:part'],
            properties: {},
          },
        ],
      };

      const report = await validator.validate(recipe);

      // Pattern should match because additionalSlots overrides generated slot
      expect(report.isValid).toBe(true);
      expect(report.warnings).toHaveLength(0);
    });

    it('should avoid reprocessing already-processed blueprints', async () => {
      const processedBlueprint = {
        id: 'test:blueprint',
        schemaVersion: '2.0',
        root: 'test:root',
        structureTemplate: 'test:template',
        slots: {
          leg_1: { socket: 'leg_1', requirements: { partType: 'leg', components: ['anatomy:part'] } },
        },
        _generatedSockets: true, // Already processed marker
      };

      const mockEntityDefs = [
        {
          id: 'test:leg_part',
          components: {
            'anatomy:part': { subType: 'leg' },
          },
        },
      ];

      // Reset mock counters
      mockSlotGenerator.generateBlueprintSlots.mockClear();
      mockDataRegistry.get.mockClear();

      mockDataRegistry.getAll = jest.fn((type) => {
        if (type === 'entityDefinitions') {
          return mockEntityDefs;
        }
        return [];
      });

      mockAnatomyBlueprintRepository.getBlueprint = async () => processedBlueprint;

      const recipe = {
        recipeId: 'test:recipe',
        blueprintId: 'test:blueprint',
        slots: {},
        patterns: [
          {
            matchesAll: { slotType: 'leg' },
            partType: 'leg',
            tags: ['anatomy:part'],
            properties: {},
          },
        ],
      };

      await validator.validate(recipe);

      // Should not call slot generator since blueprint is already processed
      expect(mockSlotGenerator.generateBlueprintSlots).not.toHaveBeenCalled();
      // get() might be called for other purposes, so we just verify generateBlueprintSlots wasn't called
    });
  });
});
