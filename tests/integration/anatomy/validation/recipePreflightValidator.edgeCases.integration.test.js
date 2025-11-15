/**
 * @file Additional integration coverage for RecipePreflightValidator focusing on
 * rare failure handling paths and defensive branches.
 */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import RecipePreflightValidator from '../../../../src/anatomy/validation/RecipePreflightValidator.js';
import InMemoryDataRegistry from '../../../../src/data/inMemoryDataRegistry.js';
import AnatomyBlueprintRepository from '../../../../src/anatomy/repositories/anatomyBlueprintRepository.js';
import SlotGenerator from '../../../../src/anatomy/slotGenerator.js';
import EntityMatcherService from '../../../../src/anatomy/services/entityMatcherService.js';
import * as socketSlotCompatibilityValidatorModule from '../../../../src/anatomy/validation/socketSlotCompatibilityValidator.js';
import * as patternMatchingValidatorModule from '../../../../src/anatomy/validation/validators/PatternMatchingValidator.js';

class ComponentThrowingRegistry extends InMemoryDataRegistry {
  constructor({ logger, componentIdsToThrow = new Set() }) {
    super({ logger });
    this.componentIdsToThrow = componentIdsToThrow;
  }

  get(type, id) {
    if (type === 'components' && this.componentIdsToThrow.has(id)) {
      throw new Error(`component registry access failed for ${id}`);
    }
    return super.get(type, id);
  }
}

class AnatomyBodyThrowingRegistry extends InMemoryDataRegistry {
  constructor({ logger }) {
    super({ logger });
  }

  get(type, id) {
    if (type === 'components' && id === 'anatomy:body') {
      throw new Error('anatomy:body component lookup exploded');
    }
    return super.get(type, id);
  }
}

class FlakyComponentRegistry extends InMemoryDataRegistry {
  constructor({ logger, throwOnSecondGetFor = new Set() }) {
    super({ logger });
    this.throwOnSecondGetFor = throwOnSecondGetFor;
    this.invocationCounts = new Map();
  }

  get(type, id) {
    if (type === 'components' && this.throwOnSecondGetFor.has(id)) {
      const count = this.invocationCounts.get(id) ?? 0;
      this.invocationCounts.set(id, count + 1);
      if (count >= 1) {
        throw new Error(`component registry subsequent access failed for ${id}`);
      }
    }
    return super.get(type, id);
  }
}

class FlakyBlueprintRepository extends AnatomyBlueprintRepository {
  constructor({ logger, dataRegistry }) {
    super({ logger, dataRegistry });
    this.calls = 0;
  }

  async getBlueprint(id) {
    this.calls += 1;
    if (this.calls < 3) {
      return super.getBlueprint(id);
    }
    return null;
  }
}

class ThrowingBlueprintRepository extends AnatomyBlueprintRepository {
  async getBlueprint() {
    throw new Error('blueprint storage unavailable');
  }
}

function createLogger() {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };
}

describe('RecipePreflightValidator edge-case integration coverage', () => {
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

  function seedCommonComponents() {
    dataRegistry.store('components', 'core:muscle', {
      id: 'core:muscle',
      dataSchema: { type: 'object' },
    });
    dataRegistry.store('components', 'descriptors:size_category', {
      id: 'descriptors:size_category',
      dataSchema: { type: 'object' },
    });
  }

  function seedBlueprintWithRoot({ blueprintId = 'test:blueprint', rootId = 'test:root' } = {}) {
    dataRegistry.store('anatomyBlueprints', blueprintId, {
      id: blueprintId,
      schemaVersion: '1.0',
      root: rootId,
      slots: {},
    });
    dataRegistry.store('entityDefinitions', rootId, {
      id: rootId,
      components: {
        'anatomy:sockets': { sockets: [] },
      },
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
    seedCommonComponents();
  });

  it('captures component existence rule failures when the registry throws', async () => {
    dataRegistry = new ComponentThrowingRegistry({
      logger,
      componentIdsToThrow: new Set(['core:muscle']),
    });
    anatomyBlueprintRepository = new AnatomyBlueprintRepository({
      logger,
      dataRegistry,
    });
    seedCommonComponents();
    const validator = createValidator();

    const recipe = {
      recipeId: 'test:component_throw',
      blueprintId: 'missing:blueprint',
      slots: {
        arm: { partType: 'arm', tags: ['core:muscle'] },
      },
    };

    const report = await validator.validate(recipe, {
      failFast: true,
      skipPatternValidation: true,
      skipDescriptorChecks: true,
      skipPartAvailabilityChecks: true,
      skipGeneratedSlotChecks: true,
      skipLoadFailureChecks: true,
      skipRecipeUsageCheck: true,
    });

    const json = report.toJSON();
    expect(logger.error).toHaveBeenCalledWith(
      'Component existence check failed',
      expect.any(Error)
    );
    expect(
      json.errors.some(
        (entry) => entry.check === 'component_existence' && entry.type === 'VALIDATION_ERROR'
      )
    ).toBe(true);
  });

  it('records property schema validation failures when schema validator throws', async () => {
    dataRegistry = new FlakyComponentRegistry({
      logger,
      throwOnSecondGetFor: new Set(['descriptors:size_category']),
    });
    anatomyBlueprintRepository = new AnatomyBlueprintRepository({
      logger,
      dataRegistry,
    });
    seedCommonComponents();
    dataRegistry.store('components', 'descriptors:size_category', {
      id: 'descriptors:size_category',
      dataSchema: { type: 'object', properties: { size: { type: 'string' } } },
    });
    seedBlueprintWithRoot();
    const validator = createValidator();

    const recipe = {
      recipeId: 'test:property_throw',
      blueprintId: 'test:blueprint',
      slots: {
        torso: {
          partType: 'torso',
          tags: ['core:muscle'],
          properties: {
            'descriptors:size_category': { size: 'large' },
          },
        },
      },
    };

    const report = await validator.validate(recipe, {
      skipPatternValidation: true,
      skipDescriptorChecks: true,
      skipPartAvailabilityChecks: true,
      skipGeneratedSlotChecks: true,
      skipLoadFailureChecks: true,
      skipRecipeUsageCheck: true,
    });

    const json = report.toJSON();
    expect(logger.error).toHaveBeenCalledWith(
      'Property schema check failed',
      expect.any(Error)
    );
    expect(
      json.errors.some(
        (entry) => entry.check === 'property_schemas' && entry.type === 'VALIDATION_ERROR'
      )
    ).toBe(true);
  });

  it('logs a warning when the anatomy:body component lacks a descriptors schema', async () => {
    seedBlueprintWithRoot();
    dataRegistry.store('components', 'anatomy:body', {
      id: 'anatomy:body',
      dataSchema: { type: 'object' },
    });
    const validator = createValidator();

    const recipe = {
      recipeId: 'test:missing_descriptor_schema',
      blueprintId: 'test:blueprint',
      bodyDescriptors: { stature: 'tall' },
    };

    await validator.validate(recipe, {
      skipPatternValidation: true,
      skipDescriptorChecks: true,
      skipPartAvailabilityChecks: true,
      skipGeneratedSlotChecks: true,
      skipLoadFailureChecks: true,
      skipRecipeUsageCheck: true,
    });

    expect(logger.warn).toHaveBeenCalledWith(
      'anatomy:body component missing descriptors schema, skipping bodyDescriptors validation'
    );
  });

  it('marks body descriptors as passing when the recipe omits them', async () => {
    seedBlueprintWithRoot();
    dataRegistry.store('components', 'anatomy:body', {
      id: 'anatomy:body',
      dataSchema: {
        type: 'object',
        properties: {
          body: {
            properties: {
              descriptors: {
                properties: {
                  stature: { type: 'string', enum: ['tall', 'short'] },
                },
              },
            },
          },
        },
      },
    });
    const validator = createValidator();

    const recipe = {
      recipeId: 'test:no_descriptors',
      blueprintId: 'test:blueprint',
    };

    const report = await validator.validate(recipe, {
      skipPatternValidation: true,
      skipDescriptorChecks: true,
      skipPartAvailabilityChecks: true,
      skipGeneratedSlotChecks: true,
      skipLoadFailureChecks: true,
      skipRecipeUsageCheck: true,
    });

    expect(
      report
        .toJSON()
        .passed.some((entry) => entry.check === 'body_descriptors' && entry.message.includes('No bodyDescriptors'))
    ).toBe(true);
  });

  it('captures invalid body descriptor types', async () => {
    seedBlueprintWithRoot();
    dataRegistry.store('components', 'anatomy:body', {
      id: 'anatomy:body',
      dataSchema: {
        type: 'object',
        properties: {
          body: {
            properties: {
              descriptors: {
                properties: {
                  stature: { type: 'string', enum: ['tall', 'short'] },
                },
              },
            },
          },
        },
      },
    });
    const validator = createValidator();

    const recipe = {
      recipeId: 'test:descriptor_type',
      blueprintId: 'test:blueprint',
      bodyDescriptors: { stature: 42 },
    };

    const report = await validator.validate(recipe, {
      skipPatternValidation: true,
      skipDescriptorChecks: true,
      skipPartAvailabilityChecks: true,
      skipGeneratedSlotChecks: true,
      skipLoadFailureChecks: true,
      skipRecipeUsageCheck: true,
    });

    expect(
      report
        .toJSON()
        .errors.some((entry) => entry.type === 'INVALID_BODY_DESCRIPTOR_TYPE' && entry.field === 'stature')
    ).toBe(true);
  });

  it('records descriptor validation failures when the registry throws during lookup', async () => {
    dataRegistry = new AnatomyBodyThrowingRegistry({ logger });
    anatomyBlueprintRepository = new AnatomyBlueprintRepository({
      logger,
      dataRegistry,
    });
    seedCommonComponents();
    const validator = createValidator();

    const recipe = {
      recipeId: 'test:body_descriptor_throw',
      blueprintId: 'missing:blueprint',
      bodyDescriptors: { stature: 'tall' },
    };

    const report = await validator.validate(recipe, {
      skipPatternValidation: true,
      skipDescriptorChecks: true,
      skipPartAvailabilityChecks: true,
      skipGeneratedSlotChecks: true,
      skipLoadFailureChecks: true,
      skipRecipeUsageCheck: true,
    });

    const json = report.toJSON();
    expect(logger.error).toHaveBeenCalledWith(
      'Body descriptors check failed',
      expect.any(Error)
    );
    expect(
      json.errors.some((entry) => entry.check === 'body_descriptors' && entry.type === 'VALIDATION_ERROR')
    ).toBe(true);
  });

  it('records blueprint validation failures when the repository throws', async () => {
    anatomyBlueprintRepository = new ThrowingBlueprintRepository({
      logger,
      dataRegistry,
    });
    const validator = createValidator();

    const recipe = {
      recipeId: 'test:blueprint_throw',
      blueprintId: 'test:throws',
    };

    const report = await validator.validate(recipe, {
      skipPatternValidation: true,
      skipDescriptorChecks: true,
      skipPartAvailabilityChecks: true,
      skipGeneratedSlotChecks: true,
      skipLoadFailureChecks: true,
      skipRecipeUsageCheck: true,
    });

    const json = report.toJSON();
    expect(logger.error).toHaveBeenCalledWith(
      'Blueprint existence check failed',
      expect.any(Error)
    );
    expect(
      json.errors.some((entry) => entry.check === 'blueprint_exists' && entry.type === 'VALIDATION_ERROR')
    ).toBe(true);
  });

  it('downgrades socket compatibility failures to warnings when validation throws', async () => {
    seedBlueprintWithRoot();
    const compatibilitySpy = jest
      .spyOn(socketSlotCompatibilityValidatorModule, 'validateSocketSlotCompatibility')
      .mockImplementation(() => {
        throw new Error('compatibility subsystem offline');
      });
    const validator = createValidator();

    const recipe = {
      recipeId: 'test:socket_throw',
      blueprintId: 'test:blueprint',
    };

    const report = await validator.validate(recipe, {
      skipPatternValidation: true,
      skipDescriptorChecks: true,
      skipPartAvailabilityChecks: true,
      skipGeneratedSlotChecks: true,
      skipLoadFailureChecks: true,
      skipRecipeUsageCheck: true,
    });

    const json = report.toJSON();
    expect(logger.error).toHaveBeenCalledWith(
      'Socket/slot compatibility check failed',
      expect.any(Error)
    );
    expect(
      json.warnings.some((entry) => entry.check === 'socket_slot_compatibility')
    ).toBe(true);

    compatibilitySpy.mockRestore();
  });

  it('gracefully handles part availability lookups when entities lack required tags', async () => {
    seedBlueprintWithRoot();
    dataRegistry.store('entityDefinitions', 'test:arm_part', {
      id: 'test:arm_part',
      components: {
        'anatomy:part': { subType: 'arm' },
      },
    });
    const validator = createValidator();

    const recipe = {
      recipeId: 'test:part_availability',
      blueprintId: 'test:blueprint',
      slots: {
        arm: {
          partType: 'arm',
          tags: ['core:muscle'],
          properties: 'unexpected',
        },
      },
    };

    const report = await validator.validate(recipe, {
      skipPatternValidation: true,
      skipDescriptorChecks: true,
      skipGeneratedSlotChecks: true,
      skipLoadFailureChecks: true,
      skipRecipeUsageCheck: true,
    });

    const json = report.toJSON();
    expect(json.errors.some((entry) => entry.type === 'PART_UNAVAILABLE')).toBe(true);
  });

  it('skips generated slot validation when the blueprint becomes unavailable mid-run', async () => {
    seedBlueprintWithRoot({ blueprintId: 'test:flaky', rootId: 'test:flaky_root' });
    anatomyBlueprintRepository = new FlakyBlueprintRepository({
      logger,
      dataRegistry,
    });
    const validator = createValidator();

    const recipe = {
      recipeId: 'test:flaky',
      blueprintId: 'test:flaky',
      patterns: [
        {
          partType: 'arm',
          matchesPattern: 'anything',
          tags: ['core:muscle'],
        },
      ],
    };

    const report = await validator.validate(recipe, {
      skipDescriptorChecks: true,
      skipPartAvailabilityChecks: true,
      skipLoadFailureChecks: true,
      skipRecipeUsageCheck: true,
    });

    expect(report.toJSON().errors.some((entry) => entry.type === 'BLUEPRINT_NOT_FOUND')).toBe(false);
  });

  it('merges blueprint slot property requirements with pattern constraints', async () => {
    seedBlueprintWithRoot({ blueprintId: 'test:generated', rootId: 'test:generated_root' });
    dataRegistry.store('anatomyBlueprints', 'test:generated', {
      id: 'test:generated',
      schemaVersion: '1.0',
      root: 'test:generated_root',
      slots: {
        arm_primary: {
          allowedTypes: ['arm'],
          requirements: {
            components: ['core:muscle'],
            properties: {
              'descriptors:venom': { color: 'green' },
            },
          },
        },
      },
    });
    dataRegistry.store('entityDefinitions', 'test:generated_root', {
      id: 'test:generated_root',
      components: {
        'anatomy:sockets': { sockets: [] },
      },
    });
    dataRegistry.store('entityDefinitions', 'test:plain_arm', {
      id: 'test:plain_arm',
      components: {
        'anatomy:part': { subType: 'arm' },
      },
    });
    const validator = createValidator();

    const recipe = {
      recipeId: 'test:generated',
      blueprintId: 'test:generated',
      patterns: [
        {
          partType: 'arm',
          matchesPattern: 'arm_*',
        },
      ],
    };

    const report = await validator.validate(recipe, {
      skipDescriptorChecks: true,
      skipPartAvailabilityChecks: true,
      skipLoadFailureChecks: true,
      skipRecipeUsageCheck: true,
    });

    const json = report.toJSON();
    expect(
      json.errors.some((entry) => entry.type === 'GENERATED_SLOT_PART_UNAVAILABLE')
    ).toBe(true);
  });

  it('provides an unknown pattern description when matcher metadata is unavailable', async () => {
    seedBlueprintWithRoot({ blueprintId: 'test:unknown_pattern', rootId: 'test:unknown_root' });
    dataRegistry.store('anatomyBlueprints', 'test:unknown_pattern', {
      id: 'test:unknown_pattern',
      schemaVersion: '1.0',
      root: 'test:unknown_root',
      slots: {
        torso: {},
      },
    });
    dataRegistry.store('entityDefinitions', 'test:unknown_root', {
      id: 'test:unknown_root',
      components: {
        'anatomy:sockets': { sockets: [] },
      },
    });
    const findMatchingSlotsSpy = jest
      .spyOn(patternMatchingValidatorModule, 'findMatchingSlots')
      .mockReturnValue({ matches: ['torso'], availableSlots: ['torso'], matcherType: 'custom' });
    const validator = createValidator();

    const recipe = {
      recipeId: 'test:unknown_pattern',
      blueprintId: 'test:unknown_pattern',
      patterns: [
        {
          partType: 'torso',
        },
      ],
    };

    const report = await validator.validate(recipe, {
      skipDescriptorChecks: true,
      skipPartAvailabilityChecks: true,
      skipLoadFailureChecks: true,
      skipRecipeUsageCheck: true,
    });

    const json = report.toJSON();
    expect(
      json.errors.some(
        (entry) =>
          entry.type === 'GENERATED_SLOT_PART_UNAVAILABLE' && entry.location.pattern === 'unknown pattern'
      )
    ).toBe(true);

    findMatchingSlotsSpy.mockRestore();
  });

  it('handles load failure diagnostics that throw during inspection', async () => {
    const loadFailures = {
      get entityDefinitions() {
        throw new Error('inspection failure');
      },
    };
    const validator = createValidator({ loadFailures });

    const recipe = {
      recipeId: 'test:load_failure_throw',
      blueprintId: 'missing:blueprint',
    };

    await validator.validate(recipe, {
      failFast: true,
      skipPatternValidation: true,
      skipDescriptorChecks: true,
      skipPartAvailabilityChecks: true,
      skipGeneratedSlotChecks: true,
      skipRecipeUsageCheck: true,
    });

    expect(logger.error).toHaveBeenCalledWith(
      'Load failure validation failed',
      expect.any(Error)
    );
  });

  it('falls back to generic component validation details when enum matches are absent', async () => {
    const loadFailures = {
      entityDefinitions: {
        failures: [
          {
            file: 'creature.entity.json',
            error: new Error('Invalid components: [descriptors:color]'),
          },
        ],
      },
    };
    const validator = createValidator({ loadFailures });

    const recipe = {
      recipeId: 'test:load_failure_details',
      blueprintId: 'missing:blueprint',
    };

    const report = await validator.validate(recipe, {
      failFast: true,
      skipPatternValidation: true,
      skipDescriptorChecks: true,
      skipPartAvailabilityChecks: true,
      skipGeneratedSlotChecks: true,
      skipRecipeUsageCheck: true,
    });

    expect(
      report
        .toJSON()
        .errors.some(
          (entry) =>
            entry.type === 'ENTITY_LOAD_FAILURE' &&
            entry.details.validationDetails.some((detail) =>
              detail.issue.includes('Component validation failed')
            )
        )
    ).toBe(true);
  });
});
