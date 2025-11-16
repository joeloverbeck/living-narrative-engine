/**
 * @file Additional integration coverage for RecipeValidationRunner focusing on
 * generated slot availability, blueprint processing, and load failure diagnostics.
 */

import { describe, it, beforeEach, expect, jest } from '@jest/globals';
import RecipeValidationRunner from '../../../../src/anatomy/validation/RecipeValidationRunner.js';
import InMemoryDataRegistry from '../../../../src/data/inMemoryDataRegistry.js';
import AnatomyBlueprintRepository from '../../../../src/anatomy/repositories/anatomyBlueprintRepository.js';
import SlotGenerator from '../../../../src/anatomy/slotGenerator.js';
import EntityMatcherService from '../../../../src/anatomy/services/entityMatcherService.js';
import { ValidationReport } from '../../../../src/anatomy/validation/ValidationReport.js';

describe('RecipeValidationRunner - Generated slot integration coverage', () => {
  /** @type {ReturnType<typeof createLogger>} */
  let logger;
  /** @type {InMemoryDataRegistry} */
  let dataRegistry;
  /** @type {AnatomyBlueprintRepository} */
  let anatomyBlueprintRepository;
  /** @type {{ validate: jest.Mock }} */
  let schemaValidator;
  /** @type {SlotGenerator} */
  let slotGenerator;

  function createLogger() {
    return {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };
  }

  function createValidator(extraOptions = {}) {
    const entityMatcherService = new EntityMatcherService({
      logger,
      dataRegistry,
    });

    return new RecipeValidationRunner({
      dataRegistry,
      anatomyBlueprintRepository,
      schemaValidator,
      slotGenerator,
      entityMatcherService,
      logger,
      ...extraOptions,
    });
  }

  beforeEach(() => {
    logger = createLogger();
    dataRegistry = new InMemoryDataRegistry({ logger });
    anatomyBlueprintRepository = new AnatomyBlueprintRepository({
      logger,
      dataRegistry,
    });
    schemaValidator = {
      validate: jest.fn(() => ({ isValid: true, errors: [] })),
    };
    slotGenerator = new SlotGenerator({ logger });
  });

  function seedCommonComponents() {
    dataRegistry.store('components', 'core:muscle', {
      id: 'core:muscle',
      dataSchema: {
        type: 'object',
        properties: {
          strength: { type: 'string' },
        },
      },
    });

    dataRegistry.store('components', 'descriptors:muscle', {
      id: 'descriptors:muscle',
      dataSchema: {
        type: 'object',
        properties: {
          tone: { type: 'string' },
          density: { type: 'string' },
        },
      },
    });

    dataRegistry.store('components', 'descriptors:size_category', {
      id: 'descriptors:size_category',
      dataSchema: {
        type: 'object',
        properties: {
          size: { type: 'string' },
        },
      },
    });
  }

  function seedStructureTemplate(templateId, { limbCount = 2 } = {}) {
    dataRegistry.store('anatomyStructureTemplates', templateId, {
      id: templateId,
      topology: {
        rootType: 'torso',
        limbSets: [
          {
            type: 'arm',
            count: limbCount,
            arrangement: 'bilateral',
            socketPattern: {
              idTemplate: 'arm_{{index}}',
              orientationScheme: 'indexed',
              allowedTypes: ['arm'],
            },
          },
        ],
      },
    });
  }

  it('validates generated slots and pattern coverage using real generators', async () => {
    seedCommonComponents();
    seedStructureTemplate('test:humanoid_template', { limbCount: 2 });

    dataRegistry.store('anatomyBlueprints', 'test:humanoid_blueprint', {
      id: 'test:humanoid_blueprint',
      schemaVersion: '2.0',
      root: 'test:humanoid_root',
      structureTemplate: 'test:humanoid_template',
      additionalSlots: {
        arm_1: {
          socket: 'arm_1',
          requirements: {
            partType: 'arm',
            components: ['core:muscle'],
            properties: {
              'descriptors:muscle': { density: 'dense' },
            },
          },
        },
      },
    });

    dataRegistry.store('entityDefinitions', 'test:humanoid_root', {
      id: 'test:humanoid_root',
      components: {
        'anatomy:sockets': {
          sockets: [
            { id: 'arm_1', allowedTypes: ['arm'] },
            { id: 'arm_2', allowedTypes: ['arm'] },
          ],
        },
      },
    });

    dataRegistry.store('entityDefinitions', 'test:arm_left', {
      id: 'test:arm_left',
      components: {
        'anatomy:part': { subType: 'arm' },
        'core:muscle': { strength: 'athletic' },
        'descriptors:muscle': { tone: 'defined', density: 'dense' },
        'descriptors:size_category': { size: 'medium' },
      },
    });

    dataRegistry.store('entityDefinitions', 'test:arm_right', {
      id: 'test:arm_right',
      components: {
        'anatomy:part': { subType: 'arm' },
        'core:muscle': { strength: 'athletic' },
        'descriptors:muscle': { tone: 'defined', density: 'dense' },
        'descriptors:size_category': { size: 'medium' },
      },
    });

    const validator = createValidator();
    const recipe = {
      recipeId: 'test:humanoid_recipe',
      blueprintId: 'test:humanoid_blueprint',
      slots: {
        featured_arm: {
          partType: 'arm',
          tags: ['core:muscle', 'descriptors:muscle'],
          properties: {
            'descriptors:muscle': { tone: 'defined' },
          },
          preferId: 'test:arm_left',
        },
      },
      patterns: [
        {
          partType: 'arm',
          matchesGroup: 'limbSet:arm',
          tags: ['core:muscle'],
          properties: {
            'descriptors:muscle': { tone: 'defined', density: 'dense' },
          },
        },
      ],
    };

    const report = await validator.validate(recipe);

    expect(report).toBeInstanceOf(ValidationReport);
    expect(report.isValid).toBe(true);

    const json = report.toJSON();
    const patternCheck = json.passed.find(
      (entry) => entry.check === 'pattern_matching'
    );
    expect(patternCheck).toBeDefined();
    expect(patternCheck.message).toContain('pattern(s) have matching slots');

    const generatedSlotCheck = json.passed.find(
      (entry) => entry.check === 'generated_slot_part_availability'
    );
    expect(generatedSlotCheck).toBeDefined();
    expect(generatedSlotCheck.message).toContain('generated slot(s)');
    expect(generatedSlotCheck.message).toContain('matching entity definitions');
  });

  it('reports generated slot availability issues with merged requirements and allowed types', async () => {
    seedCommonComponents();
    seedStructureTemplate('test:limited_template', { limbCount: 1 });

    dataRegistry.store('anatomyBlueprints', 'test:limited_blueprint', {
      id: 'test:limited_blueprint',
      schemaVersion: '2.0',
      root: 'test:limited_root',
      structureTemplate: 'test:limited_template',
      additionalSlots: {
        custom_socket: {
          socket: 'custom_socket',
          allowedTypes: ['humanoid_arm'],
          requirements: {
            partType: 'arm',
            components: ['anatomy:part', 'core:muscle'],
            properties: {
              'descriptors:muscle': { tone: 'defined' },
            },
          },
        },
      },
    });

    dataRegistry.store('entityDefinitions', 'test:limited_root', {
      id: 'test:limited_root',
      components: {
        'anatomy:sockets': {
          sockets: [
            { id: 'arm_1', allowedTypes: ['arm'] },
            { id: 'custom_socket', allowedTypes: ['arm'] },
          ],
        },
      },
    });

    dataRegistry.store('entityDefinitions', 'test:arm_candidate', {
      id: 'test:arm_candidate',
      components: {
        'anatomy:part': { subType: 'arm' },
        'core:muscle': { strength: 'basic' },
        'descriptors:muscle': { tone: 'relaxed' },
      },
    });

    const validator = createValidator();
    const recipe = {
      recipeId: 'test:limited_recipe',
      blueprintId: 'test:limited_blueprint',
      slots: {},
      patterns: [
        {
          partType: 'arm',
          matchesGroup: 'limbSet:arm',
          tags: ['core:muscle'],
          properties: {
            'descriptors:muscle': { tone: 'defined', density: 'dense' },
          },
        },
        {
          partType: 'arm',
          matches: ['custom_socket'],
          tags: ['core:muscle'],
          properties: {
            'descriptors:muscle': { tone: 'defined' },
          },
        },
      ],
    };

    const report = await validator.validate(recipe);
    const generatedSlotErrors = report.errors.filter(
      (error) => error.type === 'GENERATED_SLOT_PART_UNAVAILABLE'
    );

    expect(generatedSlotErrors.length).toBeGreaterThanOrEqual(2);

    const limbSlotError = generatedSlotErrors.find(
      (error) => error.location.slotKey === 'arm_1'
    );
    expect(limbSlotError).toBeDefined();
    expect(limbSlotError.details.requiredProperties).toContain(
      'descriptors:muscle'
    );
    expect(limbSlotError.details.requiredTags).toEqual(
      expect.arrayContaining(['core:muscle', 'anatomy:part'])
    );

    const customSlotError = generatedSlotErrors.find(
      (error) => error.location.slotKey === 'custom_socket'
    );
    expect(customSlotError).toBeDefined();
    expect(customSlotError.details.allowedTypes).toEqual(['humanoid_arm']);
    expect(customSlotError.details.requiredTags).toEqual(
      expect.arrayContaining(['core:muscle', 'anatomy:part'])
    );
    expect(customSlotError.fix).toContain(
      'Required tags (pattern + blueprint)'
    );
  });

  it('reports entity load failures with validation details and recipe usage', async () => {
    seedCommonComponents();

    dataRegistry.store('anatomyBlueprints', 'test:minimal_blueprint', {
      id: 'test:minimal_blueprint',
      root: 'test:minimal_root',
      additionalSlots: {},
    });

    dataRegistry.store('entityDefinitions', 'test:minimal_root', {
      id: 'test:minimal_root',
      components: {
        'anatomy:sockets': { sockets: [] },
      },
    });

    dataRegistry.store('entityDefinitions', 'test:recipe_consumer', {
      id: 'test:recipe_consumer',
      components: {
        'anatomy:body': { recipeId: 'test:minimal_recipe' },
      },
    });

    const loadFailureError = new Error(
      'Invalid components: [descriptors:build] data/build must be equal to one of the allowed values'
    );

    const validator = createValidator({
      loadFailures: {
        entityDefinitions: {
          failures: [
            {
              file: 'bad_entity.entity.json',
              error: loadFailureError,
            },
          ],
        },
      },
    });

    const recipe = {
      recipeId: 'test:minimal_recipe',
      blueprintId: 'test:minimal_blueprint',
      slots: {},
      patterns: [],
    };

    const report = await validator.validate(recipe);
    expect(report.isValid).toBe(false);

    const loadFailure = report.errors.find(
      (error) => error.type === 'ENTITY_LOAD_FAILURE'
    );
    expect(loadFailure).toBeDefined();
    expect(loadFailure.details.failedComponents).toContain('descriptors:build');
    expect(loadFailure.details.validationDetails[0].issue).toContain(
      'invalid value'
    );

    const json = report.toJSON();
    const recipeUsage = json.passed.find(
      (entry) => entry.check === 'recipe_usage'
    );
    expect(recipeUsage).toBeDefined();
    expect(recipeUsage.details.referencingEntities).toContain(
      'test:recipe_consumer'
    );
  });
});
