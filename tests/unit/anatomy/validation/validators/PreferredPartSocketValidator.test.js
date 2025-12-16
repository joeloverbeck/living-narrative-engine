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
    getEntityDefinition: jest.fn((id) =>
      registryLookup?.('entityDefinitions', id)
    ),
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
          id === 'anatomy:variant_head'
            ? { id, ...createSocketComponent(['brain_socket']) }
            : undefined,
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
    const {
      addPreferredId,
      buildParentSocketRequirements,
      collectPreferredIds,
      getEntityDefinition,
    } = __testables__;

    it('collects preferred ids from slots and patterns', () => {
      const recipe = {
        slots: {
          head: { preferId: 'head:id' },
        },
        patterns: [{ matches: ['tail'], preferId: 'tail:id' }],
      };

      const preferred = collectPreferredIds(
        recipe,
        baseBlueprint,
        {},
        slotGenerator
      );
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

    describe('addPreferredId edge cases', () => {
      it('returns early when slotName is null', () => {
        const map = new Map();
        addPreferredId(map, null, 'preferId');
        expect(map.size).toBe(0);
      });

      it('returns early when slotName is undefined', () => {
        const map = new Map();
        addPreferredId(map, undefined, 'preferId');
        expect(map.size).toBe(0);
      });

      it('returns early when preferId is null', () => {
        const map = new Map();
        addPreferredId(map, 'slot', null);
        expect(map.size).toBe(0);
      });

      it('returns early when preferId is undefined', () => {
        const map = new Map();
        addPreferredId(map, 'slot', undefined);
        expect(map.size).toBe(0);
      });

      it('returns early when slotName is empty after trim', () => {
        const map = new Map();
        addPreferredId(map, '   ', 'preferId');
        expect(map.size).toBe(0);
      });

      it('returns early when slotName is empty string', () => {
        const map = new Map();
        addPreferredId(map, '', 'preferId');
        expect(map.size).toBe(0);
      });

      it('adds to existing set when slot already has preferred ids', () => {
        const map = new Map();
        addPreferredId(map, 'head', 'first:id');
        addPreferredId(map, 'head', 'second:id');
        expect(map.get('head')).toEqual(new Set(['first:id', 'second:id']));
      });

      it('trims and normalizes slot names', () => {
        const map = new Map();
        addPreferredId(map, '  head  ', 'preferId');
        expect(map.has('head')).toBe(true);
        expect(map.get('head')).toEqual(new Set(['preferId']));
      });
    });

    describe('buildParentSocketRequirements edge cases', () => {
      it('skips null slotConfig entries', () => {
        const blueprint = {
          slots: {
            valid: { parent: 'parent', socket: 'sock' },
            invalid: null,
          },
        };
        const requirements = buildParentSocketRequirements(blueprint);
        expect(requirements.get('parent')).toEqual(new Set(['sock']));
      });

      it('skips non-object slotConfig entries', () => {
        const blueprint = {
          slots: {
            valid: { parent: 'parent', socket: 'sock' },
            stringSlot: 'not-an-object',
            numberSlot: 42,
          },
        };
        const requirements = buildParentSocketRequirements(blueprint);
        expect(requirements.get('parent')).toEqual(new Set(['sock']));
        expect(requirements.size).toBe(1);
      });

      it('skips slots without parent reference', () => {
        const blueprint = {
          slots: {
            root: { socket: 'root_socket' }, // no parent
            child: { parent: 'root', socket: 'child_socket' },
          },
        };
        const requirements = buildParentSocketRequirements(blueprint);
        expect(requirements.get('root')).toEqual(new Set(['child_socket']));
        expect(requirements.size).toBe(1);
      });

      it('skips slots without socket reference', () => {
        const blueprint = {
          slots: {
            parent: { socket: 'parent_socket' },
            child: { parent: 'parent' }, // no socket
          },
        };
        const requirements = buildParentSocketRequirements(blueprint);
        expect(requirements.size).toBe(0);
      });

      it('skips optional slots', () => {
        const blueprint = {
          slots: {
            parent: { socket: 'parent_socket' },
            optionalChild: { parent: 'parent', socket: 'opt_socket', optional: true },
            requiredChild: { parent: 'parent', socket: 'req_socket' },
          },
        };
        const requirements = buildParentSocketRequirements(blueprint);
        expect(requirements.get('parent')).toEqual(new Set(['req_socket']));
      });

      it('includes additionalSlots in requirements', () => {
        const blueprint = {
          slots: {
            head: { socket: 'neck' },
          },
          additionalSlots: {
            brain: { parent: 'head', socket: 'brain_socket' },
          },
        };
        const requirements = buildParentSocketRequirements(blueprint);
        expect(requirements.get('head')).toEqual(new Set(['brain_socket']));
      });

      it('returns empty map for null blueprint', () => {
        const requirements = buildParentSocketRequirements(null);
        expect(requirements.size).toBe(0);
      });

      it('returns empty map for blueprint without slots', () => {
        const requirements = buildParentSocketRequirements({});
        expect(requirements.size).toBe(0);
      });
    });

    describe('collectPreferredIds edge cases', () => {
      it('skips patterns without preferId', () => {
        const recipe = {
          patterns: [
            { matches: ['head'] }, // no preferId
            { matches: ['tail'], preferId: 'tail:id' },
          ],
        };
        const preferred = collectPreferredIds(recipe, {}, {}, slotGenerator);
        expect(preferred.has('head')).toBe(false);
        expect(preferred.get('tail')).toEqual(new Set(['tail:id']));
      });

      it('handles null pattern in patterns array', () => {
        const recipe = {
          patterns: [
            null,
            { matches: ['tail'], preferId: 'tail:id' },
          ],
        };
        const preferred = collectPreferredIds(recipe, {}, {}, slotGenerator);
        expect(preferred.get('tail')).toEqual(new Set(['tail:id']));
      });

      it('collects preferred ids from matchesPattern patterns', () => {
        const blueprint = {
          slots: { finger_1: {}, finger_2: {}, thumb: {} },
        };
        const recipe = {
          patterns: [
            { matchesPattern: 'finger_*', preferId: 'anat:finger_variant' },
          ],
        };
        const mockLogger = createTestBed().logger;
        const preferred = collectPreferredIds(
          recipe,
          blueprint,
          {},
          slotGenerator,
          mockLogger
        );
        // matchesPattern should resolve to finger_1, finger_2
        expect(preferred.get('finger_1')).toEqual(new Set(['anat:finger_variant']));
        expect(preferred.get('finger_2')).toEqual(new Set(['anat:finger_variant']));
        expect(preferred.has('thumb')).toBe(false);
      });

      it('handles empty recipe slots', () => {
        const recipe = { slots: {} };
        const preferred = collectPreferredIds(recipe, {}, {}, slotGenerator);
        expect(preferred.size).toBe(0);
      });

      it('handles null recipe', () => {
        const preferred = collectPreferredIds(null, {}, {}, slotGenerator);
        expect(preferred.size).toBe(0);
      });

      it('handles recipe without slots property', () => {
        const recipe = { patterns: [] };
        const preferred = collectPreferredIds(recipe, {}, {}, slotGenerator);
        expect(preferred.size).toBe(0);
      });

      it('filters non-string entries from explicit matches array', () => {
        const recipe = {
          patterns: [
            { matches: ['head', null, 42, 'tail'], preferId: 'variant:id' },
          ],
        };
        const preferred = collectPreferredIds(recipe, {}, {}, slotGenerator);
        expect(preferred.get('head')).toEqual(new Set(['variant:id']));
        expect(preferred.get('tail')).toEqual(new Set(['variant:id']));
        expect(preferred.size).toBe(2);
      });

      it('handles pattern.matches that is not an array', () => {
        const recipe = {
          patterns: [
            { matches: 'not-an-array', preferId: 'variant:id' },
          ],
        };
        const preferred = collectPreferredIds(recipe, {}, {}, slotGenerator);
        expect(preferred.size).toBe(0);
      });
    });

    describe('getEntityDefinition edge cases', () => {
      it('returns undefined when registry is null', () => {
        expect(getEntityDefinition(null, 'someId')).toBeUndefined();
      });

      it('returns undefined when registry is undefined', () => {
        expect(getEntityDefinition(undefined, 'someId')).toBeUndefined();
      });

      it('returns undefined when entityId is null', () => {
        const registry = { get: jest.fn() };
        expect(getEntityDefinition(registry, null)).toBeUndefined();
        expect(registry.get).not.toHaveBeenCalled();
      });

      it('returns undefined when entityId is undefined', () => {
        const registry = { get: jest.fn() };
        expect(getEntityDefinition(registry, undefined)).toBeUndefined();
        expect(registry.get).not.toHaveBeenCalled();
      });

      it('returns undefined when entityId is empty string', () => {
        const registry = { get: jest.fn() };
        expect(getEntityDefinition(registry, '')).toBeUndefined();
        expect(registry.get).not.toHaveBeenCalled();
      });

      it('prefers getEntityDefinition over get when both exist', () => {
        const registry = {
          getEntityDefinition: jest.fn().mockReturnValue({ id: 'fromGetEntityDef' }),
          get: jest.fn().mockReturnValue({ id: 'fromGet' }),
        };
        const result = getEntityDefinition(registry, 'testId');
        expect(result).toEqual({ id: 'fromGetEntityDef' });
        expect(registry.getEntityDefinition).toHaveBeenCalledWith('testId');
        expect(registry.get).not.toHaveBeenCalled();
      });
    });
  });

  describe('constructor validation', () => {
    it('throws when dataRegistry lacks both getEntityDefinition and get methods', () => {
      const testBed = createTestBed();
      expect(() => {
        new PreferredPartSocketValidator({
          logger: testBed.logger,
          dataRegistry: {},
          slotGenerator,
          anatomyBlueprintRepository: { getBlueprint: jest.fn() },
        });
      }).toThrow(/requires IDataRegistry with getEntityDefinition\(\) or get\(\)/);
    });

    it('accepts dataRegistry with only getEntityDefinition method', () => {
      const testBed = createTestBed();
      expect(() => {
        new PreferredPartSocketValidator({
          logger: testBed.logger,
          dataRegistry: { getEntityDefinition: jest.fn() },
          slotGenerator,
          anatomyBlueprintRepository: { getBlueprint: jest.fn() },
        });
      }).not.toThrow();
    });

    it('accepts dataRegistry with only get method', () => {
      const testBed = createTestBed();
      expect(() => {
        new PreferredPartSocketValidator({
          logger: testBed.logger,
          dataRegistry: { get: jest.fn() },
          slotGenerator,
          anatomyBlueprintRepository: { getBlueprint: jest.fn() },
        });
      }).not.toThrow();
    });
  });

  describe('performValidation edge cases', () => {
    it('returns early with warning when blueprint is not found', async () => {
      const testBed = createTestBed();
      const logger = testBed.logger;
      const anatomyBlueprintRepository = {
        getBlueprint: jest.fn().mockResolvedValue(null),
      };

      const validator = new PreferredPartSocketValidator({
        logger,
        dataRegistry: { get: jest.fn() },
        slotGenerator,
        anatomyBlueprintRepository,
      });

      const recipe = {
        recipeId: 'core:test_recipe',
        blueprintId: 'anatomy:missing_blueprint',
        slots: {
          head: { preferId: 'anatomy:variant_head' },
        },
      };

      const result = await validator.validate(recipe);

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining("Blueprint 'anatomy:missing_blueprint' not found")
      );
      // No errors or passed since we return early
      expect(result.errors).toHaveLength(0);
    });

    it('adds passed result when no preferred parts have child socket requirements', async () => {
      // Blueprint has no parent relationships (no children need sockets)
      const blueprintNoChildren = {
        id: 'anatomy:simple_blueprint',
        slots: {
          head: { socket: 'neck' },
          body: { socket: 'torso' },
        },
      };
      const recipe = {
        recipeId: 'core:simple_recipe',
        blueprintId: 'anatomy:simple_blueprint',
        slots: {
          head: { preferId: 'anatomy:variant_head' },
        },
      };

      const { validator } = createValidator({
        blueprint: blueprintNoChildren,
        registryLookup: () => undefined,
      });

      const result = await validator.validate(recipe);

      expect(result.errors).toHaveLength(0);
      expect(result.passed).toContainEqual(
        expect.objectContaining({
          message: 'No preferred parts with child socket requirements to validate',
          check: 'preferred_part_sockets',
        })
      );
    });

    it('adds passed result when recipe has no preferred parts', async () => {
      const recipe = {
        recipeId: 'core:no_preferred_recipe',
        blueprintId: 'anatomy:test_blueprint',
        slots: {
          head: { partType: 'chicken_head' }, // no preferId
        },
      };

      const { validator } = createValidator();

      const result = await validator.validate(recipe);

      expect(result.errors).toHaveLength(0);
      expect(result.passed).toContainEqual(
        expect.objectContaining({
          message: 'No preferred parts with child socket requirements to validate',
          check: 'preferred_part_sockets',
        })
      );
    });

    it('skips slots that have no required sockets (preferred on non-parent slot)', async () => {
      // head has children requiring sockets, tail does not
      const blueprintWithTail = {
        id: 'anatomy:tail_blueprint',
        slots: {
          head: { socket: 'neck' },
          brain: { parent: 'head', socket: 'brain_socket' },
          tail: { socket: 'tail_base' }, // no children
        },
      };
      const recipe = {
        recipeId: 'core:tail_recipe',
        blueprintId: 'anatomy:tail_blueprint',
        slots: {
          tail: { preferId: 'anatomy:fluffy_tail' }, // preferred on slot with no child socket reqs
        },
      };

      const { validator } = createValidator({
        blueprint: blueprintWithTail,
        registryLookup: () => undefined, // would fail if checked
      });

      const result = await validator.validate(recipe);

      // Should pass because tail has no child socket requirements
      // checksPerformed is 0 because the slot iteration skips slots without requirements
      expect(result.errors).toHaveLength(0);
      expect(result.passed).toContainEqual(
        expect.objectContaining({
          message: expect.stringContaining('0 preferred part override'),
          check: 'preferred_part_sockets',
        })
      );
    });

    it('reports PREFERRED_ENTITY_NOT_FOUND when entity is missing from registry', async () => {
      const { validator } = createValidator({
        registryLookup: () => undefined, // entity not found
      });

      const result = await validator.validate(recipeWithPreferredHead);

      expect(result.errors).toContainEqual(
        expect.objectContaining({
          type: 'PREFERRED_ENTITY_NOT_FOUND',
          slotName: 'head',
          preferId: 'anatomy:variant_head',
          message: expect.stringContaining("not found in registry"),
        })
      );
    });

    it('validates multiple preferred parts and reports all issues', async () => {
      const blueprintMultiple = {
        id: 'anatomy:multi_blueprint',
        slots: {
          head: { socket: 'neck' },
          brain: { parent: 'head', socket: 'brain_socket' },
          torso: { socket: 'hip' },
          heart: { parent: 'torso', socket: 'heart_socket' },
        },
      };
      const recipe = {
        recipeId: 'core:multi_recipe',
        blueprintId: 'anatomy:multi_blueprint',
        slots: {
          head: { preferId: 'anatomy:head_variant' },
          torso: { preferId: 'anatomy:torso_variant' },
        },
      };

      const { validator } = createValidator({
        blueprint: blueprintMultiple,
        registryLookup: (_collection, id) => {
          if (id === 'anatomy:head_variant') {
            return { id, ...createSocketComponent(['beak_mount']) }; // missing brain_socket
          }
          if (id === 'anatomy:torso_variant') {
            return undefined; // entity not found
          }
          return undefined;
        },
      });

      const result = await validator.validate(recipe);

      expect(result.errors).toHaveLength(2);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          type: 'PREFERRED_PART_MISSING_SOCKETS',
          slotName: 'head',
        })
      );
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          type: 'PREFERRED_ENTITY_NOT_FOUND',
          slotName: 'torso',
        })
      );
    });

    it('counts checks correctly and reports success count', async () => {
      const blueprintTwoChildren = {
        id: 'anatomy:two_children',
        slots: {
          head: { socket: 'neck' },
          brain: { parent: 'head', socket: 'brain_socket' },
          eye: { parent: 'head', socket: 'eye_socket' },
        },
      };
      const recipe = {
        recipeId: 'core:success_recipe',
        blueprintId: 'anatomy:two_children',
        slots: {
          head: { preferId: 'anatomy:good_head' },
        },
      };

      const { validator } = createValidator({
        blueprint: blueprintTwoChildren,
        registryLookup: (_collection, id) =>
          id === 'anatomy:good_head'
            ? { id, ...createSocketComponent(['brain_socket', 'eye_socket']) }
            : undefined,
      });

      const result = await validator.validate(recipe);

      expect(result.errors).toHaveLength(0);
      expect(result.passed).toContainEqual(
        expect.objectContaining({
          message: expect.stringContaining('1 preferred part override'),
          check: 'preferred_part_sockets',
        })
      );
    });
  });
});
