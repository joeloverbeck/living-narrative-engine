/**
 * @file Additional integration coverage for RecipeValidationRunner focusing on
 * rare failure handling paths and defensive branches.
 */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import RecipeValidationRunner from '../../../../src/anatomy/validation/RecipeValidationRunner.js';
import InMemoryDataRegistry from '../../../../src/data/inMemoryDataRegistry.js';
import AnatomyBlueprintRepository from '../../../../src/anatomy/repositories/anatomyBlueprintRepository.js';
import SlotGenerator from '../../../../src/anatomy/slotGenerator.js';
import EntityMatcherService from '../../../../src/anatomy/services/entityMatcherService.js';

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

describe('RecipeValidationRunner edge-case integration coverage', () => {
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

    return new RecipeValidationRunner({
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
      'component-existence check failed',
      expect.any(Error)
    );
    expect(
      json.errors.some(
        (entry) => entry.check === 'component_existence' && entry.type === 'VALIDATION_ERROR'
      )
    ).toBe(true);
  });

  it('halts downstream validators when multiple components are missing', async () => {
    seedBlueprintWithRoot();
    const validator = createValidator();

    const recipe = {
      recipeId: 'test:missing-components',
      blueprintId: 'test:blueprint',
      slots: {
        head: { tags: ['core:missing-one', 'core:missing-two'] },
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
    const missingComponentErrors = json.errors.filter(
      (entry) => entry.type === 'COMPONENT_NOT_FOUND'
    );
    expect(missingComponentErrors).toHaveLength(2);
    expect(json.errors.some((entry) => entry.type === 'PART_UNAVAILABLE')).toBe(false);
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
      'property-schemas check failed',
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
    seedBlueprintWithRoot({ blueprintId: 'test:valid_blueprint', rootId: 'test:root' });
    const validator = createValidator();

    const recipe = {
      recipeId: 'test:body_descriptor_throw',
      blueprintId: 'test:valid_blueprint',
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
      'body-descriptors check failed',
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
      'blueprint-existence check failed',
      expect.any(Error)
    );
    expect(
      json.errors.some((entry) => entry.check === 'blueprint_exists' && entry.type === 'VALIDATION_ERROR')
    ).toBe(true);
  });

  // Note: Test removed due to architectural limitations.
  // SocketSlotCompatibilityValidator's error handling (try-catch in performValidation)
  // cannot be integration tested because:
  // 1. ESM modules don't allow mocking internal function calls (validateSocketSlotCompatibility is called within the same module)
  // 2. Creating data that causes real errors is fragile and couples tests to implementation details
  // The error handling logic is covered by unit tests of SocketSlotCompatibilityValidator instead.

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
    expect(json.errors.every((entry) => entry.type !== 'COMPONENT_NOT_FOUND')).toBe(true);
  });

  it('reports INVALID_PROPERTY_OBJECT instead of treating numeric keys as components', async () => {
    seedBlueprintWithRoot();
    const validator = createValidator();

    const recipe = {
      recipeId: 'test:invalid-properties',
      blueprintId: 'test:blueprint',
      slots: {
        head: {
          properties: ['bad', 'data'],
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
    expect(json.errors.some((entry) => entry.type === 'INVALID_PROPERTY_OBJECT')).toBe(true);
    expect(
      json.errors.some(
        (entry) => entry.type === 'COMPONENT_NOT_FOUND' && entry.context?.componentId === '0'
      )
    ).toBe(false);
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

  // Note: Test removed due to ESM module mocking limitations.
  // The test attempted to mock findMatchingSlots which is an internal function
  // called within the same module, which cannot be mocked in ESM.
  // The pattern description logic is covered by unit tests instead.

  it('handles load failure diagnostics that throw during inspection', async () => {
    seedBlueprintWithRoot({ blueprintId: 'test:valid_blueprint' });
    const loadFailures = {
      get entityDefinitions() {
        throw new Error('inspection failure');
      },
    };
    const validator = createValidator({ loadFailures });

    const recipe = {
      recipeId: 'test:load_failure_throw',
      blueprintId: 'test:valid_blueprint',
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
      'load-failures check failed',
      expect.any(Error)
    );
  });

  it('falls back to generic component validation details when enum matches are absent', async () => {
    seedBlueprintWithRoot({ blueprintId: 'test:valid_blueprint' });
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
      blueprintId: 'test:valid_blueprint',
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
