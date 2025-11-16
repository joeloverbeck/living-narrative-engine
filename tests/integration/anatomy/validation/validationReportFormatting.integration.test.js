/**
 * @file Integration tests for ValidationReport formatting with real validator pipeline
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import RecipeValidationRunner from '../../../../src/anatomy/validation/RecipeValidationRunner.js';
import InMemoryDataRegistry from '../../../../src/data/inMemoryDataRegistry.js';
import AnatomyBlueprintRepository from '../../../../src/anatomy/repositories/anatomyBlueprintRepository.js';
import EntityMatcherService from '../../../../src/anatomy/services/entityMatcherService.js';
import { ValidationReport } from '../../../../src/anatomy/validation/ValidationReport.js';

describe('ValidationReport formatting - Integration', () => {
  let validator;
  let dataRegistry;
  let anatomyBlueprintRepository;
  let mockLogger;
  let mockSchemaValidator;
  let loadFailures;

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
      generateBlueprintSlots: () => ({ additionalSlots: {} }),
    };

    const mockEntityMatcherService = new EntityMatcherService({
      logger: mockLogger,
      dataRegistry,
    });

    const componentFailureError = new Error(
      'Invalid components: [descriptors:size_category, missing:component] data/value must be equal to one of the allowed values'
    );

    loadFailures = {
      entityDefinitions: {
        failures: [
          {
            file: 'mods/anatomy/broken_head.entity.json',
            error: componentFailureError,
          },
        ],
      },
    };

    validator = new RecipeValidationRunner({
      dataRegistry,
      anatomyBlueprintRepository,
      schemaValidator: mockSchemaValidator,
      slotGenerator: mockSlotGenerator,
      entityMatcherService: mockEntityMatcherService,
      logger: mockLogger,
      loadFailures,
    });
  });

  it('should produce a richly formatted report with errors, warnings, and suggestions', async () => {
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

    dataRegistry.store('entityDefinitions', 'test:root', {
      id: 'test:root',
      components: {
        'anatomy:sockets': { sockets: [] },
      },
    });

    dataRegistry.store('entityDefinitions', 'test:head_entity', {
      id: 'test:head_entity',
      components: {
        'anatomy:part': { subType: 'head' },
        'test:component1': { value: 'valid' },
        'missing:component': {},
      },
    });

    const recipe = {
      recipeId: 'test:complex_recipe',
      blueprintId: 'test:blueprint',
      recipePath: 'mods/test/recipes/complex.recipe.json',
      slots: {
        head: {
          partType: 'head',
          tags: ['test:component1', 'missing:component'],
          properties: {
            'test:component1': { value: 'valid' },
          },
        },
      },
      patterns: [],
    };

    const report = await validator.validate(recipe, {
      recipePath: recipe.recipePath,
    });

    expect(report).toBeInstanceOf(ValidationReport);
    expect(report.isValid).toBe(false);
    expect(report.hasWarnings).toBe(true);
    expect(report.hasSuggestions).toBe(true);
    expect(report.passed.length).toBeGreaterThan(0);

    const rawResults = report.toJSON();

    rawResults.errors.push({
      type: 'COMPONENT_CONFIGURATION_ERROR',
      message: "Component 'test:component1' configuration mismatch",
      location: { type: 'slot', name: 'head' },
      componentId: 'test:component1',
      fix: 'Review the slot component configuration in the recipe.',
      suggestion:
        'Ensure the slot configuration matches the entity definition.',
      context: {
        location: { type: 'slot', name: 'head' },
      },
    });

    const formatted = report.toString();

    expect(formatted).toContain('Validation Report: test:complex_recipe');
    expect(formatted).toContain('Path: mods/test/recipes/complex.recipe.json');
    expect(formatted).toContain('✓ Passed Checks:');
    expect(formatted).toContain('✗ Errors:');
    expect(formatted).toContain(
      "Location: entity_definition 'mods/anatomy/broken_head.entity.json'"
    );
    expect(formatted).toContain(
      'Failed Components: descriptors:size_category, missing:component'
    );
    expect(formatted).toContain(
      'Error Details: Invalid components: [descriptors:size_category, missing:component]'
    );
    expect(formatted).toContain('Fix: Fix validation errors:');
    expect(formatted).toContain("Location: slot 'head'");
    expect(formatted).toContain('Component: test:component1');
    expect(formatted).toContain(
      'Suggestion: Ensure the slot configuration matches the entity definition.'
    );
    expect(formatted).toContain('⚠ Warnings:');
    expect(formatted).toContain('💡 Suggestions:');

    const formatter = report.formatter();
    const markdown = formatter.toMarkdown();
    const csv = formatter.toCSV();

    expect(markdown).toContain('Validation Report: test:complex_recipe');
    expect(markdown).toContain('| Errors |');
    expect(csv).toContain('Severity,Type,Message');
    expect(csv).toContain('Error,ENTITY_LOAD_FAILURE');
  });
});
