import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { SocketSlotCompatibilityValidator } from '../../../../../src/anatomy/validation/validators/SocketSlotCompatibilityValidator.js';
import { createTestBed } from '../../../../common/testBed.js';

const createRecipe = (overrides = {}) => ({
  recipeId: 'core:test_recipe',
  blueprintId: 'anatomy:test_blueprint',
  ...overrides,
});

const createBlueprint = (overrides = {}) => ({
  id: 'anatomy:test_blueprint',
  root: 'anatomy:test_root',
  additionalSlots: {
    torso: { socket: 'torso_socket' },
  },
  ...overrides,
});

const createEntityDefinition = (overrides = {}) => ({
  id: 'anatomy:test_root',
  components: {
    'anatomy:sockets': {
      sockets: [
        { id: 'torso_socket' },
        { id: 'arm_socket' },
      ],
    },
  },
  _sourceFile: 'data/mods/core/entities/definitions/test_root.entity.json',
  ...overrides,
});

describe('SocketSlotCompatibilityValidator', () => {
  let logger;

  beforeEach(() => {
    const testBed = createTestBed();
    logger = testBed.createMockLogger();
  });

  const createValidator = ({
    blueprint = createBlueprint(),
    entityDefinition = createEntityDefinition(),
    blueprintOverride,
    dataRegistryOverride,
  } = {}) => {
    const anatomyBlueprintRepository = {
      getBlueprint: jest.fn().mockResolvedValue(blueprint),
      ...blueprintOverride,
    };

    const dataRegistry = {
      getEntityDefinition: jest.fn().mockReturnValue(entityDefinition),
      ...dataRegistryOverride,
    };

    const validator = new SocketSlotCompatibilityValidator({
      logger,
      dataRegistry,
      anatomyBlueprintRepository,
    });

    return { validator, anatomyBlueprintRepository, dataRegistry };
  };

  describe('constructor', () => {
    it('initializes metadata and dependencies', () => {
      const { validator } = createValidator();

      expect(validator.name).toBe('socket-slot-compatibility');
      expect(validator.priority).toBe(20);
      expect(validator.failFast).toBe(false);
    });

    it('validates data registry dependency', () => {
      expect(
        () =>
          new SocketSlotCompatibilityValidator({
            logger,
            dataRegistry: {},
            anatomyBlueprintRepository: { getBlueprint: jest.fn() },
          })
      ).toThrow(
        "Invalid or missing method 'getEntityDefinition' on dependency 'IDataRegistry'."
      );
    });

    it('validates anatomy blueprint repository dependency', () => {
      expect(
        () =>
          new SocketSlotCompatibilityValidator({
            logger,
            dataRegistry: { getEntityDefinition: jest.fn() },
            anatomyBlueprintRepository: {},
          })
      ).toThrow(
        "Invalid or missing method 'getBlueprint' on dependency 'IAnatomyBlueprintRepository'."
      );
    });
  });

  describe('performValidation', () => {
    it('records passed check when all sockets match', async () => {
      const { validator, anatomyBlueprintRepository, dataRegistry } =
        createValidator();

      const result = await validator.validate(createRecipe());

      expect(anatomyBlueprintRepository.getBlueprint).toHaveBeenCalledWith(
        'anatomy:test_blueprint'
      );
      expect(dataRegistry.getEntityDefinition).toHaveBeenCalledWith(
        'anatomy:test_root'
      );
      expect(result.errors).toHaveLength(0);
      expect(result.passed).toContainEqual({
        message: 'All 1 additionalSlot socket references valid',
        check: 'socket_slot_compatibility',
      });
    });

    it('skips validation when blueprint is missing', async () => {
      const { validator, anatomyBlueprintRepository } = createValidator({
        blueprintOverride: { getBlueprint: jest.fn().mockResolvedValue(null) },
      });

      const result = await validator.validate(createRecipe());

      expect(anatomyBlueprintRepository.getBlueprint).toHaveBeenCalled();
      expect(result.errors).toHaveLength(0);
      expect(result.passed).toHaveLength(0);
    });

    it('reports ROOT_ENTITY_NOT_FOUND when registry misses root', async () => {
      const blueprint = createBlueprint();
      const { validator, dataRegistry } = createValidator({
        blueprint,
        dataRegistryOverride: {
          getEntityDefinition: jest.fn().mockReturnValue(undefined),
        },
      });

      const result = await validator.validate(createRecipe());

      expect(dataRegistry.getEntityDefinition).toHaveBeenCalledWith(
        blueprint.root
      );
      expect(result.errors).toEqual([
        {
          type: 'ROOT_ENTITY_NOT_FOUND',
          severity: 'error',
          message: `Root entity '${blueprint.root}' not found`,
          blueprintId: blueprint.id,
          rootEntityId: blueprint.root,
          fix: 'Create entity at data/mods/*/entities/definitions/test_root.entity.json',
        },
      ]);
    });

    it('reports missing socket reference when slot omits socket property', async () => {
      const blueprint = createBlueprint({
        additionalSlots: {
          torso: {},
        },
      });
      const { validator } = createValidator({ blueprint });

      const result = await validator.validate(createRecipe());

      expect(result.errors).toContainEqual({
        type: 'MISSING_SOCKET_REFERENCE',
        severity: 'error',
        blueprintId: blueprint.id,
        slotName: 'torso',
        message: "Slot 'torso' has no socket reference",
        fix: 'Add "socket" property to additionalSlots.torso',
      });
    });

    it('reports SOCKET_NOT_FOUND with suggestion when socket is misspelled', async () => {
      const blueprint = createBlueprint({
        additionalSlots: {
          torso: { socket: 'torso_soket' },
        },
      });
      const { validator } = createValidator({ blueprint });

      const result = await validator.validate(createRecipe());

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toMatchObject({
        type: 'SOCKET_NOT_FOUND',
        severity: 'error',
        slotName: 'torso',
        message: "Socket 'torso_soket' not found on root entity 'anatomy:test_root'",
      });
      expect(result.errors[0].fix).toContain("Did you mean 'torso_socket'");
    });

    it('skips optional slots when sockets are missing', async () => {
      const blueprint = createBlueprint({
        additionalSlots: {
          optionalWing: { socket: 'wing_socket', optional: true },
        },
      });
      const { validator } = createValidator({ blueprint });

      const result = await validator.validate(createRecipe());

      expect(result.errors).toHaveLength(0);
      expect(result.passed).toContainEqual({
        message: 'All 1 additionalSlot socket references valid',
        check: 'socket_slot_compatibility',
      });
    });

    it('records warning when validation throws unexpected error', async () => {
      const repositoryError = new Error('Repository unavailable');
      const { validator } = createValidator({
        blueprintOverride: {
          getBlueprint: jest.fn().mockRejectedValue(repositoryError),
        },
      });

      const result = await validator.validate(createRecipe());

      expect(logger.error).toHaveBeenCalledWith(
        'Socket/slot compatibility check failed',
        repositoryError
      );
      expect(result.warnings).toEqual([
        {
          type: 'VALIDATION_WARNING',
          severity: 'warning',
          message: 'Failed to validate socket/slot compatibility',
          check: 'socket_slot_compatibility',
          error: 'Repository unavailable',
        },
      ]);
    });

    it('handles entities without sockets by providing guidance', async () => {
      const blueprint = createBlueprint({
        additionalSlots: {
          tail: { socket: 'tail_socket' },
        },
      });
      const { validator } = createValidator({
        blueprint,
        entityDefinition: createEntityDefinition({
          components: {},
        }),
      });

      const result = await validator.validate(createRecipe());

      expect(result.errors[0].fix).toContain('Root entity has no sockets');
      expect(result.errors[0].availableSockets).toEqual([]);
    });

    it('counts zero slots as success when additionalSlots is empty', async () => {
      const blueprint = createBlueprint({ additionalSlots: {} });
      const { validator } = createValidator({ blueprint });

      const result = await validator.validate(createRecipe());

      expect(result.errors).toHaveLength(0);
      expect(result.passed).toEqual([
        {
          message: 'All 0 additionalSlot socket references valid',
          check: 'socket_slot_compatibility',
        },
      ]);
    });
  });
});
