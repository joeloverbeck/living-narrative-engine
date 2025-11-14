/**
 * @file Integration tests covering failure and diagnostic paths for RecipePreflightValidator.
 */

import { describe, it, beforeEach, afterEach, expect, jest } from '@jest/globals';
import RecipePreflightValidator from '../../../../src/anatomy/validation/RecipePreflightValidator.js';
import InMemoryDataRegistry from '../../../../src/data/inMemoryDataRegistry.js';
import AnatomyBlueprintRepository from '../../../../src/anatomy/repositories/anatomyBlueprintRepository.js';
import SlotGenerator from '../../../../src/anatomy/slotGenerator.js';
import EntityMatcherService from '../../../../src/anatomy/services/entityMatcherService.js';
import { ValidationReport } from '../../../../src/anatomy/validation/ValidationReport.js';
import * as patternMatchingValidatorModule from '../../../../src/anatomy/validation/patternMatchingValidator.js';

class ThrowingDataRegistry extends InMemoryDataRegistry {
  constructor({ logger, throwsOnGetAll = new Set() } = {}) {
    super({ logger });
    this.throwsOnGetAll = throwsOnGetAll;
  }

  getAll(type) {
    if (this.throwsOnGetAll.has(type)) {
      throw new Error(`ThrowingDataRegistry.getAll triggered for ${type}`);
    }
    return super.getAll(type);
  }
}

describe('RecipePreflightValidator - Failure mode integration coverage', () => {
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

  function createValidator(overrides = {}) {
    const entityMatcherService = new EntityMatcherService({
      logger,
      dataRegistry,
    });

    return new RecipePreflightValidator({
      dataRegistry,
      anatomyBlueprintRepository,
      schemaValidator,
      slotGenerator,
      entityMatcherService,
      logger,
      ...overrides,
    });
  }

  function seedCoreComponents() {
    dataRegistry.store('components', 'core:muscle', {
      id: 'core:muscle',
      dataSchema: { type: 'object', properties: { strength: { type: 'string' } } },
    });
    dataRegistry.store('components', 'descriptors:muscle', {
      id: 'descriptors:muscle',
      dataSchema: { type: 'object', properties: { tone: { type: 'string' } } },
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
    seedCoreComponents();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('logs pattern warning when blueprint is missing and skips generated slot validation', async () => {
    const validator = createValidator();
    const recipe = {
      recipeId: 'test:missing_blueprint',
      blueprintId: 'test:missing_blueprint',
      patterns: [
        {
          partType: 'arm',
          matchesGroup: 'limbSet:arm',
          tags: ['core:muscle'],
        },
      ],
    };

    const report = await validator.validate(recipe);
    const json = report.toJSON();

    expect(report).toBeInstanceOf(ValidationReport);
    expect(json.errors.some((e) => e.type === 'BLUEPRINT_NOT_FOUND')).toBe(true);
    expect(logger.warn).toHaveBeenCalledWith(
      "Cannot validate patterns: blueprint 'test:missing_blueprint' not found"
    );
  });

  it('captures pattern matching failures as warnings when the validator throws', async () => {
    const validator = createValidator();
    dataRegistry.store('anatomyBlueprints', 'test:armature', {
      id: 'test:armature',
      schemaVersion: '1.0',
      root: 'test:root',
      slots: {
        arm_primary: {
          requirements: {
            partType: 'arm',
            components: ['core:muscle'],
          },
        },
      },
    });
    dataRegistry.store('entityDefinitions', 'test:root', {
      id: 'test:root',
      components: {
        'anatomy:sockets': { sockets: [] },
      },
    });

    const spy = jest
      .spyOn(patternMatchingValidatorModule, 'validatePatternMatching')
      .mockImplementation(() => {
        throw new Error('pattern dry-run failure');
      });

    const recipe = {
      recipeId: 'test:arm_recipe',
      blueprintId: 'test:armature',
      patterns: [
        {
          partType: 'arm',
          matchesPattern: 'arm_*',
          tags: ['core:muscle'],
        },
      ],
    };

    const report = await validator.validate(recipe, {
      skipDescriptorChecks: true,
      skipPartAvailabilityChecks: true,
      skipGeneratedSlotChecks: true,
      skipRecipeUsageCheck: true,
    });

    const json = report.toJSON();
    expect(report).toBeInstanceOf(ValidationReport);
    expect(json.warnings.some((w) => w.check === 'pattern_matching')).toBe(true);
    expect(logger.error).toHaveBeenCalledWith(
      'Pattern matching check failed',
      expect.any(Error)
    );

    spy.mockRestore();
  });

  it('swallows descriptor coverage errors caused by preferred slot lookup', async () => {
    const validator = createValidator();
    dataRegistry.store('anatomyBlueprints', 'test:descriptor_blueprint', {
      id: 'test:descriptor_blueprint',
      schemaVersion: '1.0',
      root: 'test:descriptor_root',
    });
    dataRegistry.store('entityDefinitions', 'test:descriptor_root', {
      id: 'test:descriptor_root',
      components: {
        'anatomy:sockets': { sockets: [] },
      },
    });

    const throwingSlot = { properties: {} };
    Object.defineProperty(throwingSlot, 'preferId', {
      get() {
        throw new Error('preferred entity lookup failed');
      },
    });

    const recipe = {
      recipeId: 'test:descriptor_recipe',
      blueprintId: 'test:descriptor_blueprint',
      slots: {
        problematic: throwingSlot,
      },
    };

    const report = await validator.validate(recipe, {
      skipPatternValidation: true,
      skipPartAvailabilityChecks: true,
      skipGeneratedSlotChecks: true,
      skipRecipeUsageCheck: true,
    });

    expect(report).toBeInstanceOf(ValidationReport);
    expect(logger.error).toHaveBeenCalledWith(
      'Descriptor coverage check failed',
      expect.any(Error)
    );
  });

  it('returns false from preferred entity descriptor check when registry throws', async () => {
    dataRegistry = new ThrowingDataRegistry({
      logger,
      throwsOnGetAll: new Set(['entityDefinitions']),
    });
    anatomyBlueprintRepository = new AnatomyBlueprintRepository({
      logger,
      dataRegistry,
    });
    seedCoreComponents();
    const validator = createValidator();

    dataRegistry.store('anatomyBlueprints', 'test:descriptor_blueprint', {
      id: 'test:descriptor_blueprint',
      schemaVersion: '1.0',
      root: 'test:descriptor_root',
    });
    dataRegistry.store('entityDefinitions', 'test:descriptor_root', {
      id: 'test:descriptor_root',
      components: {
        'anatomy:sockets': { sockets: [] },
      },
    });

    const recipe = {
      recipeId: 'test:descriptor_recipe',
      blueprintId: 'test:descriptor_blueprint',
      slots: {
        lacking: {
          properties: {},
          preferId: 'missing:entity',
        },
      },
    };

    const report = await validator.validate(recipe, {
      skipPatternValidation: true,
      skipPartAvailabilityChecks: true,
      skipGeneratedSlotChecks: true,
      skipRecipeUsageCheck: true,
    });

    expect(report).toBeInstanceOf(ValidationReport);
    expect(logger.error).toHaveBeenCalledWith(
      "Failed to check descriptors for preferred entity 'missing:entity'",
      expect.any(Error)
    );
  });

  it('records part availability validation errors when registry access fails', async () => {
    dataRegistry = new ThrowingDataRegistry({
      logger,
      throwsOnGetAll: new Set(['entityDefinitions']),
    });
    anatomyBlueprintRepository = new AnatomyBlueprintRepository({
      logger,
      dataRegistry,
    });
    seedCoreComponents();
    const validator = createValidator();

    dataRegistry.store('anatomyBlueprints', 'test:part_blueprint', {
      id: 'test:part_blueprint',
      schemaVersion: '1.0',
      root: 'test:part_root',
      slots: {},
    });
    dataRegistry.store('entityDefinitions', 'test:part_root', {
      id: 'test:part_root',
      components: {
        'anatomy:sockets': { sockets: [] },
      },
    });

    const recipe = {
      recipeId: 'test:part_recipe',
      blueprintId: 'test:part_blueprint',
      slots: {
        arm: {
          partType: 'arm',
          tags: ['core:muscle'],
        },
      },
    };

    const report = await validator.validate(recipe, {
      skipPatternValidation: true,
      skipDescriptorChecks: true,
      skipGeneratedSlotChecks: true,
      skipRecipeUsageCheck: true,
    });

    const json = report.toJSON();
    expect(logger.error).toHaveBeenCalledWith(
      'Part availability check failed',
      expect.any(Error)
    );
    expect(
      json.errors.some((entry) => entry.check === 'part_availability')
    ).toBe(true);
  });

  it('records generated slot availability failure when registry throws', async () => {
    dataRegistry = new ThrowingDataRegistry({
      logger,
      throwsOnGetAll: new Set(['entityDefinitions']),
    });
    anatomyBlueprintRepository = new AnatomyBlueprintRepository({
      logger,
      dataRegistry,
    });
    seedCoreComponents();
    const validator = createValidator();

    dataRegistry.store('anatomyStructureTemplates', 'test:armature_template', {
      id: 'test:armature_template',
      topology: {
        rootType: 'torso',
        limbSets: [
          {
            type: 'arm',
            count: 1,
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
    dataRegistry.store('anatomyBlueprints', 'test:armature_blueprint', {
      id: 'test:armature_blueprint',
      schemaVersion: '2.0',
      root: 'test:armature_root',
      structureTemplate: 'test:armature_template',
    });
    dataRegistry.store('entityDefinitions', 'test:armature_root', {
      id: 'test:armature_root',
      components: {
        'anatomy:sockets': { sockets: [] },
      },
    });

    const recipe = {
      recipeId: 'test:armature_recipe',
      blueprintId: 'test:armature_blueprint',
      patterns: [
        {
          partType: 'arm',
          matchesGroup: 'limbSet:arm',
        },
      ],
    };

    const report = await validator.validate(recipe, {
      skipDescriptorChecks: true,
      skipPartAvailabilityChecks: true,
      skipRecipeUsageCheck: true,
    });

    const json = report.toJSON();
    expect(logger.error).toHaveBeenCalledWith(
      'Generated slot part availability check failed',
      expect.any(Error)
    );
    expect(
      json.errors.some((entry) => entry.check === 'generated_slot_part_availability')
    ).toBe(true);
  });

  it('logs when pattern matches slots missing from blueprint or template', async () => {
    const validator = createValidator();
    dataRegistry.store('anatomyBlueprints', 'test:ghost_blueprint', {
      id: 'test:ghost_blueprint',
      schemaVersion: '1.0',
      root: 'test:ghost_root',
      slots: {},
    });
    dataRegistry.store('entityDefinitions', 'test:ghost_root', {
      id: 'test:ghost_root',
      components: {
        'anatomy:sockets': { sockets: [] },
      },
    });

    const spy = jest
      .spyOn(patternMatchingValidatorModule, 'findMatchingSlots')
      .mockImplementation(() => ({
        matches: ['phantom_slot'],
        availableSlots: [],
        matcherType: 'matchesPattern',
      }));

    const recipe = {
      recipeId: 'test:ghost_recipe',
      blueprintId: 'test:ghost_blueprint',
      patterns: [
        {
          partType: 'arm',
          matchesPattern: 'phantom_*',
        },
      ],
    };

    await validator.validate(recipe, {
      skipDescriptorChecks: true,
      skipPartAvailabilityChecks: true,
      skipRecipeUsageCheck: true,
    });

    expect(logger.warn).toHaveBeenCalledWith(
      "RecipePreflightValidator: Slot 'phantom_slot' matched by pattern but not found in blueprint or structure template"
    );

    spy.mockRestore();
  });

  it('provides detailed generated slot errors including pattern descriptions', async () => {
    const validator = createValidator();

    dataRegistry.store('anatomyStructureTemplates', 'test:pattern_template', {
      id: 'test:pattern_template',
      topology: {
        rootType: 'torso',
        limbSets: [
          {
            type: 'arm',
            count: 1,
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

    dataRegistry.store('anatomyBlueprints', 'test:pattern_blueprint', {
      id: 'test:pattern_blueprint',
      schemaVersion: '2.0',
      root: 'test:pattern_root',
      structureTemplate: 'test:pattern_template',
      slots: {
        featured: {
          socket: 'arm_1',
          requirements: {
            partType: 'arm',
            components: ['core:muscle', 'descriptors:muscle'],
            properties: {
              'descriptors:muscle': { tone: 'defined' },
            },
          },
        },
      },
    });

    dataRegistry.store('entityDefinitions', 'test:pattern_root', {
      id: 'test:pattern_root',
      components: {
        'anatomy:sockets': {
          sockets: [{ id: 'arm_1', allowedTypes: ['arm'] }],
        },
      },
    });

    const recipe = {
      recipeId: 'test:pattern_recipe',
      blueprintId: 'test:pattern_blueprint',
      patterns: [
        {
          partType: 'arm',
          matchesPattern: 'arm_*',
          tags: ['core:muscle'],
        },
        {
          partType: 'arm',
          matchesAll: { slotType: 'arm', orientation: '*', socketId: 'arm_*' },
        },
      ],
    };

    const report = await validator.validate(recipe, {
      skipDescriptorChecks: true,
      skipPartAvailabilityChecks: true,
      skipRecipeUsageCheck: true,
    });

    const json = report.toJSON();
    const generatedSlotError = json.errors.find(
      (entry) => entry.type === 'GENERATED_SLOT_PART_UNAVAILABLE'
    );

    expect(generatedSlotError).toBeDefined();
    expect(generatedSlotError.location.pattern).toContain("matchesPattern 'arm_*");
  });

  it('reports generic entity load failures and logs diagnostic errors', async () => {
    const validator = createValidator({
      loadFailures: {
        entityDefinitions: {
          failures: [
            {
              file: 'broken.entity.json',
              error: new Error('Unexpected parse failure'),
            },
          ],
        },
      },
    });

    dataRegistry.store('anatomyBlueprints', 'test:load_failure_blueprint', {
      id: 'test:load_failure_blueprint',
      schemaVersion: '1.0',
      root: 'test:load_failure_root',
    });
    dataRegistry.store('entityDefinitions', 'test:load_failure_root', {
      id: 'test:load_failure_root',
      components: {
        'anatomy:sockets': { sockets: [] },
      },
    });

    const recipe = {
      recipeId: 'test:load_failure_recipe',
      blueprintId: 'test:load_failure_blueprint',
    };

    const report = await validator.validate(recipe, {
      skipPatternValidation: true,
      skipDescriptorChecks: true,
      skipPartAvailabilityChecks: true,
      skipGeneratedSlotChecks: true,
      skipRecipeUsageCheck: true,
    });

    const json = report.toJSON();
    const failure = json.errors.find((entry) => entry.type === 'ENTITY_LOAD_FAILURE');

    expect(failure).toBeDefined();
    expect(failure.details.error).toBe('Unexpected parse failure');
    expect(logger.debug).toHaveBeenCalledWith(
      'RecipePreflightValidator: Found 1 entity definition load failures'
    );
  });

  it('handles recipe usage diagnostics when entity registry access fails', async () => {
    dataRegistry = new ThrowingDataRegistry({
      logger,
      throwsOnGetAll: new Set(['entityDefinitions']),
    });
    anatomyBlueprintRepository = new AnatomyBlueprintRepository({
      logger,
      dataRegistry,
    });
    seedCoreComponents();
    const validator = createValidator();

    dataRegistry.store('anatomyBlueprints', 'test:usage_blueprint', {
      id: 'test:usage_blueprint',
      schemaVersion: '1.0',
      root: 'test:usage_root',
    });
    dataRegistry.store('entityDefinitions', 'test:usage_root', {
      id: 'test:usage_root',
      components: {
        'anatomy:sockets': { sockets: [] },
      },
    });

    const recipe = {
      recipeId: 'test:usage_recipe',
      blueprintId: 'test:usage_blueprint',
    };

    const report = await validator.validate(recipe, {
      skipPatternValidation: true,
      skipDescriptorChecks: true,
      skipPartAvailabilityChecks: true,
      skipGeneratedSlotChecks: true,
    });

    expect(report).toBeInstanceOf(ValidationReport);
    expect(logger.error).toHaveBeenCalledWith(
      'Recipe usage check failed',
      expect.any(Error)
    );
  });
});
