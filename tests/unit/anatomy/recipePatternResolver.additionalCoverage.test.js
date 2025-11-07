import { describe, it, expect, jest, afterEach } from '@jest/globals';

const createLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
});

/**
 * Loads the RecipePatternResolver with optional mocks
 *
 * @param {object} options - Configuration options
 * @param {boolean} options.mockAssertNonBlankString - Whether to mock assertNonBlankString
 * @returns {Promise<object>} The resolver class
 */
async function loadResolver({ mockAssertNonBlankString = false } = {}) {
  jest.resetModules();

  if (mockAssertNonBlankString) {
    jest.doMock('../../../src/utils/dependencyUtils.js', () => {
      const actual = jest.requireActual(
        '../../../src/utils/dependencyUtils.js'
      );
      return {
        ...actual,
        assertNonBlankString: jest.fn(),
      };
    });
  }

  const module = await import(
    '../../../src/anatomy/recipePatternResolver/patternResolver.js'
  );
  return module.default;
}

afterEach(() => {
  jest.resetModules();
});

describe('RecipePatternResolver additional coverage', () => {
  it('wraps structure template lookup failures with pattern context', async () => {
    const RecipePatternResolver = await loadResolver();
    const logger = createLogger();
    const dataRegistry = {
      get: jest.fn(),
    };
    dataRegistry.get.mockImplementation(() => {
      const callIndex = dataRegistry.get.mock.calls.length;
      if (callIndex <= 2) {
        return {
          topology: {
            limbSets: [
              {
                type: 'wing',
                id: 'wing_primary',
              },
            ],
          },
        };
      }
      return undefined;
    });
    const slotGenerator = {
      extractSlotKeysFromLimbSet: jest.fn().mockReturnValue([]),
      extractSlotKeysFromAppendage: jest.fn(),
    };

    const resolver = new RecipePatternResolver({
      dataRegistry,
      slotGenerator,
      logger,
    });

    const recipe = {
      patterns: [{ matchesGroup: 'limbSet:wing', partType: 'wing_segment' }],
    };

    const blueprint = {
      schemaVersion: '2.0',
      structureTemplate: 'missing-template',
      slots: {},
    };

    let thrown;
    try {
      resolver.resolveRecipePatterns(recipe, blueprint);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeDefined();
    expect(thrown.name).toBe('ValidationError');
    expect(thrown.message).toContain(
      'Pattern 1: Structure template not found: missing-template'
    );
    expect(dataRegistry.get).toHaveBeenCalledWith(
      'anatomyStructureTemplates',
      'missing-template'
    );
  });

  it('omits slot group warning when matchesGroup reference becomes falsy', async () => {
    const RecipePatternResolver = await loadResolver({
      mockAssertNonBlankString: true,
    });
    const logger = createLogger();
    const dataRegistry = {
      get: jest.fn().mockReturnValue({
        topology: {
          limbSets: [
            {
              type: 'arm',
              id: 'arm_primary',
            },
          ],
        },
      }),
    };
    const slotGenerator = {
      extractSlotKeysFromLimbSet: jest.fn().mockReturnValue([]),
      extractSlotKeysFromAppendage: jest.fn(),
    };

    const resolver = new RecipePatternResolver({
      dataRegistry,
      slotGenerator,
      logger,
    });

    let accessCount = 0;
    const pattern = {
      partType: 'arm_segment',
      get matchesGroup() {
        accessCount += 1;
        // Return '' earlier so validation catches it
        return accessCount <= 2 ? 'limbSet:arm' : '';
      },
    };

    const recipe = { patterns: [pattern] };
    const blueprint = {
      schemaVersion: '2.0',
      structureTemplate: 'sentinel-golem',
      slots: {},
    };

    let thrown;
    try {
      resolver.resolveRecipePatterns(recipe, blueprint);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeDefined();
    expect(thrown.name).toBe('ValidationError');
    expect(thrown.message).toContain(
      "Invalid slot group reference format: ''"
    );
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(
      "Pattern 1: Invalid slot group reference format: ''"
    );
  });

  it('treats patterns without active matchers as non-conflicting overrides', async () => {
    const RecipePatternResolver = await loadResolver();
    const logger = createLogger();
    const dataRegistry = {
      get: jest.fn().mockReturnValue({
        topology: {
          appendages: [
            {
              type: 'tail',
              id: 'tail_primary',
            },
          ],
        },
      }),
    };
    const slotGenerator = {
      extractSlotKeysFromLimbSet: jest.fn(),
      extractSlotKeysFromAppendage: jest
        .fn()
        .mockReturnValue(['shoulder_joint', 'forearm_joint']),
    };

    const resolver = new RecipePatternResolver({
      dataRegistry,
      slotGenerator,
      logger,
    });

    let accessCount = 0;
    const pattern = {
      partType: 'arm_segment',
      get matchesGroup() {
        accessCount += 1;
        return accessCount <= 6 ? 'appendage:tail' : undefined;
      },
    };

    const recipe = {
      slots: {
        shoulder_joint: { partType: 'existing_socket' },
      },
      patterns: [pattern],
    };

    const blueprint = {
      schemaVersion: '2.0',
      structureTemplate: 'wyrm-body',
      slots: {
        shoulder_joint: {},
        forearm_joint: {},
      },
      additionalSlots: {
        forearm_joint: { partType: 'built_in' },
      },
    };

    const result = resolver.resolveRecipePatterns(recipe, blueprint);

    expect(result.slots.shoulder_joint.partType).toBe('existing_socket');
    expect(Object.prototype.hasOwnProperty.call(result.slots, 'forearm_joint'))
      .toBe(false);
    const overrideLogs = logger.info.mock.calls
      .map(call => call[0])
      .filter(message => message.includes('overrides Pattern'));
    expect(overrideLogs).toHaveLength(0);
  });

  it('resolves appendage slot groups via slot generator', async () => {
    const RecipePatternResolver = await loadResolver();
    const logger = createLogger();
    const dataRegistry = {
      get: jest.fn().mockReturnValue({
        topology: {
          appendages: [
            {
              type: 'tail',
              id: 'tail_primary',
            },
          ],
        },
      }),
    };
    const slotGenerator = {
      extractSlotKeysFromLimbSet: jest.fn(),
      extractSlotKeysFromAppendage: jest
        .fn()
        .mockReturnValue(['tail_base', 'tail_tip']),
    };

    const resolver = new RecipePatternResolver({
      dataRegistry,
      slotGenerator,
      logger,
    });

    const recipe = {
      patterns: [{ matchesGroup: 'appendage:tail', partType: 'tail_segment' }],
    };

    const blueprint = {
      schemaVersion: '2.0',
      structureTemplate: 'wyrm-body',
      slots: {
        tail_base: {},
        tail_tip: {},
      },
    };

    const result = resolver.resolveRecipePatterns(recipe, blueprint);

    expect(slotGenerator.extractSlotKeysFromAppendage).toHaveBeenCalledWith({
      type: 'tail',
      id: 'tail_primary',
    });
    expect(result.slots.tail_base.partType).toBe('tail_segment');
    expect(result.slots.tail_tip.partType).toBe('tail_segment');
  });

  it('expands matchesAll filters into resolved slots', async () => {
    const RecipePatternResolver = await loadResolver();
    const logger = createLogger();
    const dataRegistry = { get: jest.fn() };
    const slotGenerator = {
      extractSlotKeysFromLimbSet: jest.fn(),
      extractSlotKeysFromAppendage: jest.fn(),
    };

    const resolver = new RecipePatternResolver({
      dataRegistry,
      slotGenerator,
      logger,
    });

    const recipe = {
      patterns: [
        {
          matchesAll: {
            slotType: 'socket',
            orientation: '*_left',
          },
          partType: 'left_socket',
          tags: ['adaptive'],
        },
      ],
    };

    const blueprint = {
      slots: {
        arm_left: {
          requirements: { partType: 'socket' },
          orientation: 'upper_left',
          socket: 'arm_socket',
        },
        arm_right: {
          requirements: { partType: 'socket' },
          orientation: 'upper_right',
          socket: 'arm_socket',
        },
      },
      additionalSlots: {
        arm_left: { partType: 'built_in' },
      },
    };

    const result = resolver.resolveRecipePatterns(recipe, blueprint);

    expect(result.slots.arm_left).toBeUndefined();
    expect(result.slots.arm_right).toBeUndefined();
    expect(result._patternConflicts).toContainEqual(
      expect.objectContaining({
        pattern: "matchesAll: {\"slotType\":\"socket\",\"orientation\":\"*_left\"}",
        slotKey: 'arm_left',
      })
    );
  });
});
