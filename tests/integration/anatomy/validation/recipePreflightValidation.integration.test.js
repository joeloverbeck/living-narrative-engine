/**
 * @file Integration tests for RecipePreflightValidator
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import RecipePreflightValidator from '../../../../src/anatomy/validation/RecipePreflightValidator.js';
import InMemoryDataRegistry from '../../../../src/data/inMemoryDataRegistry.js';
import AnatomyBlueprintRepository from '../../../../src/anatomy/repositories/anatomyBlueprintRepository.js';
import { ValidationReport } from '../../../../src/anatomy/validation/ValidationReport.js';

describe('RecipePreflightValidator - Integration', () => {
  let validator;
  let dataRegistry;
  let anatomyBlueprintRepository;
  let mockLogger;
  let mockSchemaValidator;

  beforeEach(() => {
    mockLogger = {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
    };

    dataRegistry = new InMemoryDataRegistry({ logger: mockLogger });

    anatomyBlueprintRepository = new AnatomyBlueprintRepository({
      logger: mockLogger,
      dataRegistry,
    });

    mockSchemaValidator = {
      validate: () => ({ isValid: true, errors: [] }),
    };

    const mockSlotGenerator = {
      extractSlotKeysFromLimbSet: () => [],
      extractSlotKeysFromAppendage: () => [],
    };

    validator = new RecipePreflightValidator({
      dataRegistry,
      anatomyBlueprintRepository,
      schemaValidator: mockSchemaValidator,
      slotGenerator: mockSlotGenerator,
      logger: mockLogger,
    });
  });

  describe('Full validation pipeline', () => {
    it('should validate a complete valid recipe', async () => {
      // Setup registry with components and blueprint
      dataRegistry.store('components', 'test:component1', {
        id: 'test:component1',
        dataSchema: {
          type: 'object',
          properties: {
            value: { type: 'string' },
          },
        },
      });

      dataRegistry.store('components', 'descriptors:size_category', {
        id: 'descriptors:size_category',
        dataSchema: {
          type: 'object',
          properties: {
            size: { type: 'string', enum: ['small', 'medium', 'large'] },
          },
        },
      });

      dataRegistry.store('anatomyBlueprints', 'test:blueprint', {
        id: 'test:blueprint',
        root: 'test:root',
        structureTemplate: 'test:template',
        parts: [],
      });

      // Add root entity definition required for socket/slot validation
      dataRegistry.store('entityDefinitions', 'test:root', {
        id: 'test:root',
        components: {
          'anatomy:sockets': { sockets: [] },
        },
      });

      // Add entity definition for head slot to pass part availability check
      dataRegistry.store('entityDefinitions', 'test:head_entity', {
        id: 'test:head_entity',
        components: {
          'anatomy:part': {
            subType: 'head',
          },
          'test:component1': { value: 'test' },
          'descriptors:size_category': { size: 'medium' },
        },
      });

      const recipe = {
        recipeId: 'test:recipe',
        blueprintId: 'test:blueprint',
        slots: {
          head: {
            partType: 'head',
            tags: ['test:component1', 'descriptors:size_category'],
            properties: {
              'test:component1': { value: 'test' },
              'descriptors:size_category': { size: 'medium' },
            },
          },
        },
        patterns: [],
      };

      const report = await validator.validate(recipe);

      expect(report).toBeInstanceOf(ValidationReport);
      expect(report.isValid).toBe(true);
      expect(report.errors.length).toBe(0);

      // The recipe is not referenced by any entity, so expect the RECIPE_UNUSED warning
      expect(report.warnings.length).toBe(1);
      expect(report.warnings[0].type).toBe('RECIPE_UNUSED');
      expect(report.hasSuggestions).toBe(false);
    });

    it('should detect missing components in recipe', async () => {
      // Setup blueprint but not components
      dataRegistry.store('anatomyBlueprints', 'test:blueprint', {
        id: 'test:blueprint',
        root: 'test:root',
        structureTemplate: 'test:template',
        parts: [],
      });

      const recipe = {
        recipeId: 'test:recipe',
        blueprintId: 'test:blueprint',
        slots: {
          head: {
            tags: ['test:missing_component'],
            properties: {},
          },
        },
        patterns: [],
      };

      const report = await validator.validate(recipe);

      expect(report.isValid).toBe(false);
      expect(report.errors.length).toBeGreaterThan(0);
      expect(report.errors.some((e) => e.type === 'COMPONENT_NOT_FOUND')).toBe(
        true
      );
    });

    it('should detect missing blueprint', async () => {
      const recipe = {
        recipeId: 'test:recipe',
        blueprintId: 'test:missing_blueprint',
        slots: {},
        patterns: [],
      };

      const report = await validator.validate(recipe);

      expect(report.isValid).toBe(false);
      expect(report.errors.length).toBeGreaterThan(0);
      expect(report.errors.some((e) => e.type === 'BLUEPRINT_NOT_FOUND')).toBe(
        true
      );
    });

    it('should suggest adding descriptors when missing', async () => {
      // Setup registry with component and blueprint
      dataRegistry.store('components', 'test:component1', {
        id: 'test:component1',
        dataSchema: {
          type: 'object',
          properties: {
            value: { type: 'string' },
          },
        },
      });

      dataRegistry.store('anatomyBlueprints', 'test:blueprint', {
        id: 'test:blueprint',
        root: 'test:root',
        structureTemplate: 'test:template',
        parts: [],
      });

      // Add root entity definition required for socket/slot validation
      dataRegistry.store('entityDefinitions', 'test:root', {
        id: 'test:root',
        components: {
          'anatomy:sockets': { sockets: [] },
        },
      });

      // Add entity definition for head slot (no descriptors to trigger suggestion)
      dataRegistry.store('entityDefinitions', 'test:head_entity', {
        id: 'test:head_entity',
        components: {
          'anatomy:part': {
            subType: 'head',
          },
          'test:component1': { value: 'test' },
        },
      });

      const recipe = {
        recipeId: 'test:recipe',
        blueprintId: 'test:blueprint',
        slots: {
          head: {
            partType: 'head',
            tags: ['test:component1'],
            properties: {},
          },
        },
        patterns: [],
      };

      const report = await validator.validate(recipe);

      expect(report.isValid).toBe(true);
      expect(report.hasSuggestions).toBe(true);
      expect(
        report.suggestions.some((s) => s.type === 'MISSING_DESCRIPTORS')
      ).toBe(true);
    });

    it('should validate property schemas against component definitions', async () => {
      // Setup component with strict schema
      dataRegistry.store('components', 'test:component1', {
        id: 'test:component1',
        dataSchema: {
          type: 'object',
          properties: {
            color: { type: 'string', enum: ['red', 'blue', 'green'] },
          },
          required: ['color'],
        },
      });

      dataRegistry.store('anatomyBlueprints', 'test:blueprint', {
        id: 'test:blueprint',
        root: 'test:root',
        structureTemplate: 'test:template',
        parts: [],
      });

      // Configure schema validator to fail for invalid values
      mockSchemaValidator.validate = (schemaId, data) => {
        if (data.color && !['red', 'blue', 'green'].includes(data.color)) {
          return {
            isValid: false,
            errors: [
              {
                message: 'must be equal to one of the allowed values',
                keyword: 'enum',
                params: { allowedValues: ['red', 'blue', 'green'] },
              },
            ],
          };
        }
        return { isValid: true, errors: [] };
      };

      const recipe = {
        recipeId: 'test:recipe',
        blueprintId: 'test:blueprint',
        slots: {
          head: {
            tags: [],
            properties: {
              'test:component1': { color: 'yellow' }, // Invalid color
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

    it('should handle multiple errors in single recipe', async () => {
      dataRegistry.store('anatomyBlueprints', 'test:blueprint', {
        id: 'test:blueprint',
        root: 'test:root',
        structureTemplate: 'test:template',
        parts: [],
      });

      // Add root entity definition to keep focus on component-not-found errors
      dataRegistry.store('entityDefinitions', 'test:root', {
        id: 'test:root',
        components: {
          'anatomy:sockets': { sockets: [] },
        },
      });

      const recipe = {
        recipeId: 'test:recipe',
        blueprintId: 'test:blueprint',
        slots: {
          head: {
            partType: 'head',
            tags: ['test:missing_component1'],
            properties: {
              'test:missing_component2': { value: 'test' },
            },
          },
          torso: {
            partType: 'torso',
            tags: ['test:missing_component3'],
            properties: {},
          },
        },
        patterns: [],
      };

      const report = await validator.validate(recipe, { failFast: false });

      expect(report.isValid).toBe(false);
      // 3 COMPONENT_NOT_FOUND errors + 2 PART_UNAVAILABLE errors (for head and torso slots)
      expect(report.errors.length).toBe(5);

      // Verify we have both types of errors
      const componentErrors = report.errors.filter(
        (e) => e.type === 'COMPONENT_NOT_FOUND'
      );
      const partErrors = report.errors.filter(
        (e) => e.type === 'PART_UNAVAILABLE'
      );

      expect(componentErrors.length).toBe(3);
      expect(partErrors.length).toBe(2);
    });

    it('should validate patterns in recipe', async () => {
      dataRegistry.store('components', 'test:pattern_component', {
        id: 'test:pattern_component',
        dataSchema: {
          type: 'object',
        },
      });

      dataRegistry.store('components', 'descriptors:size_category', {
        id: 'descriptors:size_category',
        dataSchema: {
          type: 'object',
        },
      });

      dataRegistry.store('anatomyBlueprints', 'test:blueprint', {
        id: 'test:blueprint',
        root: 'test:root',
        structureTemplate: 'test:template',
        additionalSlots: {
          'test:entity_pattern': {
            socket: 'test_socket',
            requirements: {
              partType: 'test_part',
              components: ['test:pattern_component'],
            },
          },
        },
      });

      // Add root entity definition with socket for the slot
      dataRegistry.store('entityDefinitions', 'test:root', {
        id: 'test:root',
        components: {
          'anatomy:sockets': {
            sockets: [
              {
                id: 'test_socket',
                childEntity: null,
              },
            ],
          },
        },
      });

      // Add entity definition for pattern slot
      dataRegistry.store('entityDefinitions', 'test:pattern_entity', {
        id: 'test:pattern_entity',
        components: {
          'anatomy:part': {
            subType: 'test_part',
          },
          'test:pattern_component': { value: 'pattern' },
          'descriptors:size_category': { size: 'medium' },
        },
      });

      const recipe = {
        recipeId: 'test:recipe',
        blueprintId: 'test:blueprint',
        slots: {
          // Add a slot that matches the pattern
          'test:entity_pattern': {
            partType: 'test_part',
            tags: ['test:pattern_component', 'descriptors:size_category'],
            properties: {},
          },
        },
        patterns: [
          {
            partType: 'test_part',
            matches: ['test:entity_pattern'],
            tags: ['test:pattern_component', 'descriptors:size_category'],
            properties: {},
          },
        ],
      };

      const report = await validator.validate(recipe);

      expect(report.isValid).toBe(true);

      // Verify pattern validation ran (either passed or warnings generated)
      const passedChecks = report.toJSON().passed;
      const warnings = report.toJSON().warnings;

      const patternCheck = passedChecks.find(
        (check) => check.check === 'pattern_matching'
      );
      const patternWarning = warnings.find(
        (w) => w.type === 'NO_MATCHING_SLOTS'
      );

      // Either pattern check passed OR pattern warnings were generated
      expect(patternCheck || patternWarning).toBeDefined();

      // Verify the message or type based on which path was taken
      const hasValidPatternCheck =
        patternCheck && patternCheck.message.includes('pattern(s)');
      const hasValidWarning = patternWarning && patternWarning.type === 'NO_MATCHING_SLOTS';

      expect(hasValidPatternCheck || hasValidWarning).toBe(true);
    });

    it('should provide detailed error messages for debugging', async () => {
      dataRegistry.store('anatomyBlueprints', 'test:blueprint', {
        id: 'test:blueprint',
        root: 'test:root',
        structureTemplate: 'test:template',
        parts: [],
      });

      const recipe = {
        recipeId: 'test:dragon_recipe',
        blueprintId: 'test:blueprint',
        slots: {
          head: {
            tags: ['test:missing_scale_component'],
            properties: {},
          },
        },
        patterns: [],
      };

      const report = await validator.validate(recipe, {
        recipePath: 'data/mods/test/recipes/dragon.recipe.json',
      });

      expect(report.isValid).toBe(false);

      const output = report.toString();
      expect(output).toContain('test:dragon_recipe');
      expect(output).toContain('dragon.recipe.json');
      expect(output).toContain('Component \'test:missing_scale_component\' does not exist');
      expect(output).toContain('❌ Validation FAILED');
    });

    it('should work with real component existence validation', async () => {
      // This tests the integration with ComponentExistenceValidationRule
      dataRegistry.store('components', 'core:actor', {
        id: 'core:actor',
        dataSchema: { type: 'object' },
      });

      dataRegistry.store('components', 'core:anatomy', {
        id: 'core:anatomy',
        dataSchema: { type: 'object' },
      });

      dataRegistry.store('anatomyBlueprints', 'core:humanoid', {
        id: 'core:humanoid',
        root: 'core:torso',
        structureTemplate: 'core:humanoid_template',
        parts: [],
      });

      // Add root entity definition (blueprint references 'core:torso')
      dataRegistry.store('entityDefinitions', 'core:torso', {
        id: 'core:torso',
        components: {
          'anatomy:sockets': { sockets: [] },
        },
      });

      // Add entity definition for torso slot with required components
      dataRegistry.store('entityDefinitions', 'core:torso_part', {
        id: 'core:torso_part',
        components: {
          'anatomy:part': {
            subType: 'torso',
          },
          'core:actor': { name: 'Human' },
          'core:anatomy': { type: 'humanoid' },
        },
      });

      const recipe = {
        recipeId: 'core:human',
        blueprintId: 'core:humanoid',
        slots: {
          torso: {
            partType: 'torso',
            tags: ['core:actor', 'core:anatomy'],
            properties: {},
          },
        },
        patterns: [],
      };

      const report = await validator.validate(recipe);

      expect(report.isValid).toBe(true);
      const passedChecks = report.toJSON().passed;
      const componentCheck = passedChecks.find(
        (check) => check.check === 'component_existence'
      );
      expect(componentCheck).toBeDefined();
      expect(componentCheck.message).toContain('2 component references exist');
    });

    it('should work with real property schema validation', async () => {
      // This tests the integration with PropertySchemaValidationRule
      dataRegistry.store('components', 'test:size', {
        id: 'test:size',
        dataSchema: {
          type: 'object',
          properties: {
            height: { type: 'number', minimum: 0 },
            width: { type: 'number', minimum: 0 },
          },
          required: ['height', 'width'],
        },
      });

      dataRegistry.store('anatomyBlueprints', 'test:blueprint', {
        id: 'test:blueprint',
        root: 'test:root',
        structureTemplate: 'test:template',
        parts: [],
      });

      // Add root entity definition required for socket/slot validation
      dataRegistry.store('entityDefinitions', 'test:root', {
        id: 'test:root',
        components: {
          'anatomy:sockets': { sockets: [] },
        },
      });

      // Add entity definition for body slot with valid property
      dataRegistry.store('entityDefinitions', 'test:body_entity', {
        id: 'test:body_entity',
        components: {
          'anatomy:part': {
            subType: 'body',
          },
          'test:size': {
            height: 180,
            width: 60,
          },
        },
      });

      const recipe = {
        recipeId: 'test:recipe',
        blueprintId: 'test:blueprint',
        slots: {
          body: {
            partType: 'body',
            tags: [],
            properties: {
              'test:size': {
                height: 180,
                width: 60,
              },
            },
          },
        },
        patterns: [],
      };

      const report = await validator.validate(recipe);

      expect(report.isValid).toBe(true);
      const passedChecks = report.toJSON().passed;
      const propertyCheck = passedChecks.find(
        (check) => check.check === 'property_schemas'
      );
      expect(propertyCheck).toBeDefined();
      expect(propertyCheck.message).toContain('1 property objects valid');
    });
  });

  describe('Validation options', () => {
    beforeEach(() => {
      dataRegistry.store('components', 'test:component1', {
        id: 'test:component1',
        dataSchema: { type: 'object' },
      });

      dataRegistry.store('anatomyBlueprints', 'test:blueprint', {
        id: 'test:blueprint',
        root: 'test:root',
        structureTemplate: 'test:template',
        parts: [],
      });
    });

    it('should skip pattern validation when option is set', async () => {
      const recipe = {
        recipeId: 'test:recipe',
        blueprintId: 'test:blueprint',
        slots: {},
        patterns: [
          {
            matches: ['test:pattern'],
            tags: ['test:component1'],
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

    it('should skip descriptor checks when option is set', async () => {
      const recipe = {
        recipeId: 'test:recipe',
        blueprintId: 'test:blueprint',
        slots: {
          head: {
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

    it('should support fail-fast mode', async () => {
      const recipe = {
        recipeId: 'test:recipe',
        blueprintId: 'test:blueprint',
        slots: {
          slot1: {
            tags: ['test:missing1'],
            properties: {},
          },
          slot2: {
            tags: ['test:missing2'],
            properties: {},
          },
        },
        patterns: [],
      };

      const report = await validator.validate(recipe, { failFast: true });

      expect(report.isValid).toBe(false);
      // In fail-fast mode, property validation should be skipped
      // because component validation failed
    });
  });

  describe('Report formatting', () => {
    it('should generate readable console output', async () => {
      dataRegistry.store('anatomyBlueprints', 'test:blueprint', {
        id: 'test:blueprint',
        root: 'test:root',
        structureTemplate: 'test:template',
        parts: [],
      });

      const recipe = {
        recipeId: 'test:dragon',
        blueprintId: 'test:blueprint',
        slots: {
          head: {
            tags: ['test:missing_component'],
            properties: {},
          },
        },
        patterns: [],
      };

      const report = await validator.validate(recipe, {
        recipePath: 'data/mods/creatures/recipes/dragon.recipe.json',
      });

      const output = report.toString();

      expect(output).toContain('Validation Report: test:dragon');
      expect(output).toContain('dragon.recipe.json');
      expect(output).toContain('❌ Validation FAILED');
      expect(output).toContain('✗ Errors:');
    });

    it('should generate JSON output for programmatic use', async () => {
      dataRegistry.store('anatomyBlueprints', 'test:blueprint', {
        id: 'test:blueprint',
        root: 'test:root',
        structureTemplate: 'test:template',
        parts: [],
      });

      const recipe = {
        recipeId: 'test:recipe',
        blueprintId: 'test:blueprint',
        slots: {},
        patterns: [],
      };

      const report = await validator.validate(recipe);
      const json = report.toJSON();

      expect(json.recipeId).toBe('test:recipe');
      expect(json.timestamp).toBeDefined();
      expect(json.errors).toBeDefined();
      expect(json.warnings).toBeDefined();
      expect(json.suggestions).toBeDefined();
      expect(json.passed).toBeDefined();
    });
  });
});
