import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { GeneratedSlotPartsValidator } from '../../../../../src/anatomy/validation/validators/GeneratedSlotPartsValidator.js';
import SocketGenerator from '../../../../../src/anatomy/socketGenerator.js';
import { createTestBed } from '../../../../common/testBed.js';

const VALIDATION_CHECK = 'generated_slot_part_availability';

const createRecipe = (overrides = {}) => ({
  recipeId: 'core:test_recipe',
  blueprintId: 'core:test_blueprint',
  patterns: [],
  ...overrides,
});

const createBlueprint = (overrides = {}) => ({
  id: 'core:test_blueprint',
  slots: {
    arm_left: {
      allowedTypes: ['core:arm'],
      requirements: {
        components: ['anatomy:part', 'socket:arm'],
        properties: { baseline: true },
      },
    },
  },
  ...overrides,
});

describe('GeneratedSlotPartsValidator', () => {
  let logger;

  beforeEach(() => {
    const testBed = createTestBed();
    logger = testBed.logger;
    jest.clearAllMocks();
  });

  const createValidatorContext = ({
    blueprint = createBlueprint(),
    entityDefinitions = [{ id: 'core:entity' }],
    dataRegistryOverrides = {},
    entityMatcherOverrides = {},
    slotGeneratorOverrides = {},
    anatomyBlueprintOverrides = {},
  } = {}) => {
    const slotGenerator = {
      generateBlueprintSlots: jest.fn().mockReturnValue(blueprint.slots),
      extractSlotKeysFromLimbSet: jest.fn(),
      extractSlotKeysFromAppendage: jest.fn(),
      ...slotGeneratorOverrides,
    };

    const dataRegistry = {
      get: jest.fn(),
      getAll: jest.fn().mockReturnValue(entityDefinitions),
      ...dataRegistryOverrides,
    };

    const entityMatcherService = {
      findMatchingEntitiesForSlot: jest.fn().mockReturnValue([{ id: 'match' }]),
      mergePropertyRequirements: jest
        .fn()
        .mockImplementation((patternProps = {}, blueprintProps = {}) => ({
          ...patternProps,
          ...blueprintProps,
        })),
      ...entityMatcherOverrides,
    };

    const anatomyBlueprintRepository = {
      getBlueprint: jest.fn().mockResolvedValue(blueprint),
      ...anatomyBlueprintOverrides,
    };

    const validator = new GeneratedSlotPartsValidator({
      logger,
      slotGenerator,
      dataRegistry,
      entityMatcherService,
      anatomyBlueprintRepository,
    });

    return {
      validator,
      slotGenerator,
      dataRegistry,
      entityMatcherService,
      anatomyBlueprintRepository,
      blueprint,
    };
  };

  describe('constructor', () => {
    it('configures validator defaults', () => {
      const { validator } = createValidatorContext();

      expect(validator.name).toBe('generated-slot-parts');
      expect(validator.priority).toBe(30);
      expect(validator.failFast).toBe(false);
    });

    it('validates slot generator dependency', () => {
      expect(
        () =>
          new GeneratedSlotPartsValidator({
            logger,
            slotGenerator: {},
            dataRegistry: { get: jest.fn(), getAll: jest.fn() },
            entityMatcherService: {
              findMatchingEntitiesForSlot: jest.fn(),
              mergePropertyRequirements: jest.fn(),
            },
            anatomyBlueprintRepository: { getBlueprint: jest.fn() },
          })
      ).toThrow(
        "Invalid or missing method 'generateBlueprintSlots' on dependency 'ISlotGenerator'."
      );
    });

    it('validates data registry dependency', () => {
      expect(
        () =>
          new GeneratedSlotPartsValidator({
            logger,
            slotGenerator: {
              generateBlueprintSlots: jest.fn(),
              extractSlotKeysFromLimbSet: jest.fn(),
              extractSlotKeysFromAppendage: jest.fn(),
            },
            dataRegistry: { get: jest.fn() },
            entityMatcherService: {
              findMatchingEntitiesForSlot: jest.fn(),
              mergePropertyRequirements: jest.fn(),
            },
            anatomyBlueprintRepository: { getBlueprint: jest.fn() },
          })
      ).toThrow(
        "Invalid or missing method 'getAll' on dependency 'IDataRegistry'."
      );
    });

    it('validates entity matcher dependency', () => {
      expect(
        () =>
          new GeneratedSlotPartsValidator({
            logger,
            slotGenerator: {
              generateBlueprintSlots: jest.fn(),
              extractSlotKeysFromLimbSet: jest.fn(),
              extractSlotKeysFromAppendage: jest.fn(),
            },
            dataRegistry: { get: jest.fn(), getAll: jest.fn() },
            entityMatcherService: { findMatchingEntitiesForSlot: jest.fn() },
            anatomyBlueprintRepository: { getBlueprint: jest.fn() },
          })
      ).toThrow(
        "Invalid or missing method 'mergePropertyRequirements' on dependency 'IEntityMatcherService'."
      );
    });

    it('validates blueprint repository dependency', () => {
      expect(
        () =>
          new GeneratedSlotPartsValidator({
            logger,
            slotGenerator: {
              generateBlueprintSlots: jest.fn(),
              extractSlotKeysFromLimbSet: jest.fn(),
              extractSlotKeysFromAppendage: jest.fn(),
            },
            dataRegistry: { get: jest.fn(), getAll: jest.fn() },
            entityMatcherService: {
              findMatchingEntitiesForSlot: jest.fn(),
              mergePropertyRequirements: jest.fn(),
            },
            anatomyBlueprintRepository: {},
          })
      ).toThrow(
        "Invalid or missing method 'getBlueprint' on dependency 'IAnatomyBlueprintRepository'."
      );
    });
  });

  describe('performValidation', () => {
    it('adds pass result when recipe has no patterns', async () => {
      const recipe = createRecipe();
      const { validator } = createValidatorContext();

      const result = await validator.validate(recipe);

      expect(result.errors).toHaveLength(0);
      expect(result.passed).toContainEqual({
        message: 'No patterns to validate for generated slots',
        check: VALIDATION_CHECK,
      });
    });

    it('skips when blueprint cannot be loaded', async () => {
      const recipe = createRecipe({
        patterns: [{ matches: ['arm_left'] }],
      });
      const { validator, anatomyBlueprintRepository } = createValidatorContext({
        anatomyBlueprintOverrides: {
          getBlueprint: jest.fn().mockResolvedValue(null),
        },
      });

      const result = await validator.validate(recipe);

      expect(anatomyBlueprintRepository.getBlueprint).toHaveBeenCalledWith(
        'core:test_blueprint'
      );
      expect(logger.warn).toHaveBeenCalledWith(
        "GeneratedSlotPartsValidator: Blueprint 'core:test_blueprint' not found, skipping generated slot checks"
      );
      expect(result.errors).toHaveLength(0);
      expect(result.passed).toHaveLength(0);
    });

    it('passes when all generated slots have matching entities', async () => {
      const recipe = createRecipe({
        patterns: [
          {
            matches: ['arm_left'],
            partType: 'core:arm',
            tags: ['anatomy:limb'],
            properties: { orientation: 'left' },
          },
        ],
      });
      const { validator, entityMatcherService, dataRegistry } =
        createValidatorContext();

      const result = await validator.validate(recipe);

      expect(dataRegistry.getAll).toHaveBeenCalledWith('entityDefinitions');
      expect(
        entityMatcherService.mergePropertyRequirements
      ).toHaveBeenCalledWith({ orientation: 'left' }, { baseline: true });
      expect(
        entityMatcherService.findMatchingEntitiesForSlot
      ).toHaveBeenCalledWith(
        {
          partType: 'core:arm',
          allowedTypes: ['core:arm'],
          tags: ['anatomy:limb', 'anatomy:part', 'socket:arm'],
          properties: { orientation: 'left', baseline: true },
        },
        [{ id: 'core:entity' }]
      );
      expect(result.passed).toContainEqual({
        message:
          'All 1 generated slot(s) from patterns have matching entity definitions',
        check: VALIDATION_CHECK,
      });
      expect(result.errors).toHaveLength(0);
    });

    it('records error when no entities match generated slot requirements', async () => {
      const recipe = createRecipe({
        patterns: [
          {
            matches: ['arm_left'],
            partType: 'core:arm',
            tags: ['anatomy:limb'],
            properties: { orientation: 'left' },
          },
        ],
      });
      const { validator, entityMatcherService } = createValidatorContext({
        entityMatcherOverrides: {
          findMatchingEntitiesForSlot: jest.fn().mockReturnValue([]),
        },
      });

      const result = await validator.validate(recipe);

      expect(
        entityMatcherService.findMatchingEntitiesForSlot
      ).toHaveBeenCalled();
      expect(result.errors).toEqual([
        {
          type: 'GENERATED_SLOT_PART_UNAVAILABLE',
          severity: 'error',
          location: {
            type: 'generated_slot',
            slotKey: 'arm_left',
            patternIndex: 0,
            pattern: 'explicit matches [arm_left]',
          },
          message:
            "No entity definitions found for generated slot 'arm_left' (matched by pattern 0)",
          details: {
            slotKey: 'arm_left',
            patternIndex: 0,
            partType: 'core:arm',
            allowedTypes: ['core:arm'],
            requiredTags: ['anatomy:limb', 'anatomy:part', 'socket:arm'],
            requiredProperties: ['orientation', 'baseline'],
            totalEntitiesChecked: 1,
            blueprintRequiredComponents: ['anatomy:part', 'socket:arm'],
            blueprintRequiredProperties: ['baseline'],
          },
          fix:
            'Create an entity definition in data/mods/anatomy/entities/definitions/ with:\n' +
            '  - anatomy:part component with subType: "core:arm"\n' +
            '  - Required tags (pattern + blueprint): ["anatomy:limb","anatomy:part","socket:arm"]\n' +
            '  - Required property components: ["orientation","baseline"]',
        },
      ]);
      expect(result.passed).toHaveLength(0);
    });

    it('aggregates errors for multiple matched slots', async () => {
      const recipe = createRecipe({
        patterns: [
          {
            matches: ['arm_left', 'arm_right'],
            partType: 'core:arm',
          },
        ],
      });
      const { validator } = createValidatorContext({
        blueprint: createBlueprint({
          slots: {
            arm_left: {
              allowedTypes: ['core:arm'],
              requirements: { components: ['anatomy:part'] },
            },
            arm_right: {
              allowedTypes: ['core:arm'],
              requirements: { components: ['anatomy:part'] },
            },
          },
        }),
        entityMatcherOverrides: {
          findMatchingEntitiesForSlot: jest.fn().mockReturnValue([]),
        },
      });

      const result = await validator.validate(recipe);

      expect(result.errors).toHaveLength(2);
      expect(result.errors[0].location.slotKey).toBe('arm_left');
      expect(result.errors[1].location.slotKey).toBe('arm_right');
    });

    it('handles patterns that match no slots', async () => {
      const recipe = createRecipe({
        patterns: [{ matches: ['missing_slot'] }],
      });
      const { validator } = createValidatorContext();

      const result = await validator.validate(recipe);

      expect(result.errors).toHaveLength(0);
      expect(result.passed).toContainEqual({
        message:
          'All 0 generated slot(s) from patterns have matching entity definitions',
        check: VALIDATION_CHECK,
      });
    });

    it('falls back to wildcard allowed types when blueprint omits them', async () => {
      const recipe = createRecipe({
        patterns: [{ matches: ['arm_left'], partType: 'core:arm' }],
      });
      const { validator, entityMatcherService } = createValidatorContext({
        blueprint: createBlueprint({
          slots: {
            arm_left: {
              requirements: { components: ['anatomy:part'] },
            },
          },
        }),
      });

      await validator.validate(recipe);

      expect(
        entityMatcherService.findMatchingEntitiesForSlot
      ).toHaveBeenCalledWith(
        expect.objectContaining({ allowedTypes: ['*'] }),
        expect.any(Array)
      );
    });

    it('logs warning when matched slot disappears from blueprint map', async () => {
      const slotAccessSpy = jest.fn();
      const dynamicSlots = {};
      Object.defineProperty(dynamicSlots, 'arm_left', {
        enumerable: true,
        configurable: true,
        get() {
          slotAccessSpy();
          if (slotAccessSpy.mock.calls.length === 1) {
            return {
              allowedTypes: ['core:arm'],
              requirements: { components: ['anatomy:part'] },
            };
          }
          return undefined;
        },
      });
      const recipe = createRecipe({
        patterns: [{ matches: ['arm_left'], partType: 'core:arm' }],
      });
      const { validator, entityMatcherService } = createValidatorContext({
        blueprint: createBlueprint({ slots: dynamicSlots }),
      });

      const result = await validator.validate(recipe);

      expect(slotAccessSpy).toHaveBeenCalledTimes(2);
      expect(logger.warn).toHaveBeenCalledWith(
        "GeneratedSlotPartsValidator: Slot 'arm_left' matched by pattern but not found in blueprint or structure template"
      );
      expect(
        entityMatcherService.findMatchingEntitiesForSlot
      ).not.toHaveBeenCalled();
      expect(result.passed).toContainEqual({
        message:
          'All 1 generated slot(s) from patterns have matching entity definitions',
        check: VALIDATION_CHECK,
      });
    });

    it('generates sockets when structure template exists', async () => {
      const structureTemplate = {
        topology: { limbSets: [], appendages: [] },
      };
      const generateSocketsSpy = jest
        .spyOn(SocketGenerator.prototype, 'generateSockets')
        .mockReturnValue([
          {
            id: 'arm_left',
            allowedTypes: ['core:arm'],
            requirements: { components: ['template:component'] },
          },
        ]);
      const recipe = createRecipe({
        patterns: [{ matches: ['arm_left'], partType: 'core:arm' }],
      });
      const { validator, dataRegistry } = createValidatorContext({
        blueprint: createBlueprint({ structureTemplate: 'core:template' }),
        dataRegistryOverrides: {
          get: jest
            .fn()
            .mockImplementation((collection, key) =>
              collection === 'anatomyStructureTemplates' &&
              key === 'core:template'
                ? structureTemplate
                : undefined
            ),
        },
      });

      await validator.validate(recipe);

      expect(dataRegistry.get).toHaveBeenCalledWith(
        'anatomyStructureTemplates',
        'core:template'
      );
      expect(generateSocketsSpy).toHaveBeenCalledWith(structureTemplate);
      generateSocketsSpy.mockRestore();
    });

    it('skips socket generation when structure template is missing from registry', async () => {
      const generateSocketsSpy = jest.spyOn(
        SocketGenerator.prototype,
        'generateSockets'
      );
      const recipe = createRecipe({
        patterns: [{ matches: ['arm_left'] }],
      });
      const { validator, dataRegistry } = createValidatorContext({
        blueprint: createBlueprint({ structureTemplate: 'core:missing' }),
        dataRegistryOverrides: {
          get: jest.fn().mockReturnValue(undefined),
        },
      });

      await validator.validate(recipe);

      expect(dataRegistry.get).toHaveBeenCalledWith(
        'anatomyStructureTemplates',
        'core:missing'
      );
      expect(logger.warn).toHaveBeenCalledWith(
        "GeneratedSlotPartsValidator: Structure template 'core:missing' not found in data registry"
      );
      expect(generateSocketsSpy).not.toHaveBeenCalled();
      generateSocketsSpy.mockRestore();
    });

    it('records validation error when matcher throws', async () => {
      const recipe = createRecipe({
        patterns: [{ matches: ['arm_left'] }],
      });
      const { validator } = createValidatorContext({
        entityMatcherOverrides: {
          findMatchingEntitiesForSlot: jest.fn(() => {
            throw new Error('matcher failure');
          }),
        },
      });

      const result = await validator.validate(recipe);

      expect(result.errors).toContainEqual({
        type: 'VALIDATION_ERROR',
        severity: 'error',
        message: 'Failed to validate generated slot part availability',
        check: VALIDATION_CHECK,
        error: 'matcher failure',
      });
    });

    it('treats missing entity registry entries as zero totalEntitiesChecked', async () => {
      const recipe = createRecipe({
        patterns: [{ matches: ['arm_left'], partType: 'core:arm' }],
      });
      const { validator } = createValidatorContext({
        dataRegistryOverrides: {
          getAll: jest.fn().mockReturnValue(undefined),
        },
        entityMatcherOverrides: {
          findMatchingEntitiesForSlot: jest.fn().mockReturnValue([]),
        },
      });

      const result = await validator.validate(recipe);

      expect(result.errors[0].details.totalEntitiesChecked).toBe(0);
    });
  });
});
