import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { InitialDamageSlotValidator } from '../../../../../src/anatomy/validation/validators/InitialDamageSlotValidator.js';
import { createTestBed } from '../../../../common/testBed.js';

const createSlotGenerator = () => ({
  generateBlueprintSlots: jest.fn(),
  extractSlotKeysFromLimbSet: jest.fn(),
  extractSlotKeysFromAppendage: jest.fn(),
});

describe('InitialDamageSlotValidator', () => {
  let logger;

  beforeEach(() => {
    const testBed = createTestBed();
    logger = testBed.mockLogger;
  });

  const createValidator = ({
    blueprint,
    rootDefinition,
  } = {}) => {
    const anatomyBlueprintRepository = {
      getBlueprint: jest.fn().mockResolvedValue(blueprint),
    };

    const dataRegistry = {
      get: jest.fn().mockImplementation((type, id) => {
        if (type === 'entityDefinitions' && id === rootDefinition?.id) {
          return rootDefinition.definition;
        }
        return null;
      }),
    };

    const slotGenerator = createSlotGenerator();

    const validator = new InitialDamageSlotValidator({
      logger,
      anatomyBlueprintRepository,
      dataRegistry,
      slotGenerator,
    });

    return { validator, anatomyBlueprintRepository, dataRegistry };
  };

  it('passes when all initialDamage slots exist in the blueprint', async () => {
    const blueprint = {
      id: 'test:bp',
      root: 'test:root',
      slots: { head: { socket: 'neck' } },
    };
    const rootDefinition = {
      id: 'test:root',
      definition: {
        components: {
          'anatomy:part': { subType: 'torso' },
        },
      },
    };
    const recipe = {
      recipeId: 'test:recipe',
      blueprintId: 'test:bp',
      initialDamage: {
        head: { amount: 5, name: 'blunt' },
      },
    };

    const { validator } = createValidator({ blueprint, rootDefinition });
    const result = await validator.validate(recipe);

    expect(result.errors).toHaveLength(0);
    expect(result.isValid).toBe(true);
  });

  it('accepts torso alias when root part is a torso', async () => {
    const blueprint = {
      id: 'test:bp',
      root: 'test:root',
      slots: {},
    };
    const rootDefinition = {
      id: 'test:root',
      definition: {
        components: {
          'anatomy:part': { subType: 'torso' },
        },
      },
    };
    const recipe = {
      recipeId: 'test:recipe',
      blueprintId: 'test:bp',
      initialDamage: {
        torso: { amount: 3, name: 'piercing' },
      },
    };

    const { validator } = createValidator({ blueprint, rootDefinition });
    const result = await validator.validate(recipe);

    expect(result.errors).toHaveLength(0);
    expect(result.isValid).toBe(true);
  });

  it('fails when initialDamage targets slots that cannot be generated', async () => {
    const blueprint = {
      id: 'test:bp',
      root: 'test:root',
      slots: { head: { socket: 'neck' } },
    };
    const rootDefinition = {
      id: 'test:root',
      definition: {
        components: {
          'anatomy:part': { subType: 'core' },
        },
      },
    };
    const recipe = {
      recipeId: 'test:recipe',
      blueprintId: 'test:bp',
      initialDamage: {
        missing_slot: { amount: 1, name: 'fire' },
      },
    };

    const { validator } = createValidator({ blueprint, rootDefinition });
    const result = await validator.validate(recipe);

    expect(result.isValid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].type).toBe('INITIAL_DAMAGE_SLOT_UNRESOLVED');
    expect(result.errors[0].missingSlots).toContain('missing_slot');
  });
});
