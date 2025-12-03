import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  PreferredPartSocketValidator,
  __testables__,
} from '../../../../../src/anatomy/validation/validators/PreferredPartSocketValidator.js';
import { createTestBed } from '../../../../common/testBed.js';

const baseBlueprint = {
  id: 'anatomy:test_blueprint',
  slots: {
    head: {
      socket: 'neck',
      requirements: {
        partType: 'chicken_head',
      },
    },
    brain: {
      parent: 'head',
      socket: 'brain_socket',
      requirements: {
        partType: 'chicken_brain',
      },
    },
  },
};

const recipeWithPreferredHead = {
  recipeId: 'core:test_recipe',
  blueprintId: 'anatomy:test_blueprint',
  slots: {
    head: {
      partType: 'chicken_head',
      preferId: 'anatomy:variant_head',
    },
  },
};

const createSocketComponent = (socketIds = []) => ({
  components: {
    'anatomy:sockets': {
      sockets: socketIds.map((id) => ({ id })),
    },
  },
});

const slotGenerator = {
  extractSlotKeysFromLimbSet: jest.fn(),
  extractSlotKeysFromAppendage: jest.fn(),
  generateBlueprintSlots: jest.fn().mockReturnValue({}),
};

const createValidator = ({
  blueprint = baseBlueprint,
  registryLookup,
} = {}) => {
  const testBed = createTestBed();
  const logger = testBed.logger;
  const anatomyBlueprintRepository = {
    getBlueprint: jest.fn().mockResolvedValue(blueprint),
  };

  const dataRegistry = {
    get: jest.fn((collection, id) => registryLookup?.(collection, id)),
    getEntityDefinition: jest.fn((id) => registryLookup?.('entityDefinitions', id)),
  };

  const validator = new PreferredPartSocketValidator({
    logger,
    dataRegistry,
    slotGenerator,
    anatomyBlueprintRepository,
  });

  return { validator, dataRegistry, anatomyBlueprintRepository, logger };
};

describe('PreferredPartSocketValidator', () => {
  describe('performValidation', () => {
    it('passes when preferred part exposes all required sockets for its children', async () => {
      const { validator } = createValidator({
        registryLookup: (_collection, id) =>
          id === 'anatomy:variant_head' ? { id, ...createSocketComponent(['brain_socket']) } : undefined,
      });

      const result = await validator.validate(recipeWithPreferredHead);

      expect(result.errors).toHaveLength(0);
      expect(result.passed).toContainEqual(
        expect.objectContaining({
          check: 'preferred_part_sockets',
        })
      );
    });

    it('raises an error when preferred part is missing sockets needed by child slots', async () => {
      const { validator } = createValidator({
        registryLookup: (_collection, id) =>
          id === 'anatomy:variant_head'
            ? { id, ...createSocketComponent(['beak_mount']) }
            : undefined,
      });

      const result = await validator.validate(recipeWithPreferredHead);

      expect(result.errors).toContainEqual(
        expect.objectContaining({
          type: 'PREFERRED_PART_MISSING_SOCKETS',
          slotName: 'head',
          preferId: 'anatomy:variant_head',
          missingSockets: ['brain_socket'],
        })
      );
    });

    it('validates preferred parts declared through pattern matches', async () => {
      const recipe = {
        ...recipeWithPreferredHead,
        slots: {},
        patterns: [
          {
            matches: ['head'],
            preferId: 'anatomy:variant_head',
          },
        ],
      };

      const { validator } = createValidator({
        registryLookup: (_collection, id) =>
          id === 'anatomy:variant_head'
            ? { id, ...createSocketComponent(['beak_mount']) }
            : undefined,
      });

      const result = await validator.validate(recipe);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toMatchObject({ slotName: 'head' });
    });

    it('adds a warning instead of throwing when dependencies fail', async () => {
      const logger = createTestBed().logger;
      const validator = new PreferredPartSocketValidator({
        logger,
        dataRegistry: {
          get: () => {
            throw new Error('registry failure');
          },
        },
        slotGenerator,
        anatomyBlueprintRepository: {
          getBlueprint: () => {
            throw new Error('blueprint load failure');
          },
        },
      });

      const result = await validator.validate(recipeWithPreferredHead);

      expect(logger.error).toHaveBeenCalledWith(
        'preferred-part-sockets check failed',
        expect.any(Error)
      );
      expect(result.warnings).toContainEqual(
        expect.objectContaining({ check: 'preferred_part_sockets' })
      );
    });
  });

  describe('__testables__', () => {
    const { addPreferredId, buildParentSocketRequirements, collectPreferredIds, getEntityDefinition } =
      __testables__;

    it('collects preferred ids from slots and patterns', () => {
      const recipe = {
        slots: {
          head: { preferId: 'head:id' },
        },
        patterns: [
          { matches: ['tail'], preferId: 'tail:id' },
        ],
      };

      const preferred = collectPreferredIds(recipe, baseBlueprint, {}, slotGenerator);
      expect(preferred.get('head')).toEqual(new Set(['head:id']));
      expect(preferred.get('tail')).toEqual(new Set(['tail:id']));
    });

    it('builds parent socket requirements from blueprint children', () => {
      const requirements = buildParentSocketRequirements(baseBlueprint);
      expect(requirements.get('head')).toEqual(new Set(['brain_socket']));
    });

    it('supports legacy registry lookup when getEntityDefinition is absent', () => {
      const registry = {
        get: jest.fn().mockReturnValue({ id: 'demo' }),
      };

      expect(getEntityDefinition(registry, 'demo')).toEqual({ id: 'demo' });
      expect(registry.get).toHaveBeenCalledWith('entityDefinitions', 'demo');
    });
  });
});
