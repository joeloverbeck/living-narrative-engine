import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import AnatomyIntegrationTestBed from '../../common/anatomy/anatomyIntegrationTestBed.js';
import { loadBlueprint } from '../../../src/anatomy/bodyBlueprintFactory/blueprintLoader.js';
import RecipePatternResolver from '../../../src/anatomy/recipePatternResolver/patternResolver.js';
import SlotGenerator from '../../../src/anatomy/slotGenerator.js';
import InMemoryDataRegistry from '../../../src/data/inMemoryDataRegistry.js';
import { ValidationError } from '../../../src/errors/validationError.js';
import { createMockLogger } from '../../common/mockFactories/index.js';

class FlakyTemplateRegistry extends InMemoryDataRegistry {
  constructor(options = {}) {
    super(options);
    this.templateCallCounts = new Map();
  }

  get(type, id) {
    if (type === 'anatomyStructureTemplates' && id) {
      const key = `${type}:${id}`;
      const callCount = this.templateCallCounts.get(key) ?? 0;
      this.templateCallCounts.set(key, callCount + 1);

      if (id === 'test:unstable_template' && callCount >= 3) {
        return undefined;
      }

      if (id === 'test:volatile_template' && callCount >= 3) {
        const template = super.get(type, id);
        if (!template) {
          return template;
        }

        return {
          ...template,
          topology: {
            ...template.topology,
            limbSets: [],
            appendages: [],
          },
        };
      }
    }

    return super.get(type, id);
  }
}

describe('RecipePatternResolver integration coverage', () => {
  let testBed;

  beforeEach(() => {
    testBed = new AnatomyIntegrationTestBed();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  const registerArmTemplate = () => {
    testBed.registry.store('anatomyStructureTemplates', 'test:arm_template', {
      id: 'test:arm_template',
      topology: {
        rootType: 'torso',
        limbSets: [
          {
            type: 'arm',
            count: 2,
            arrangement: 'bilateral',
            socketPattern: {
              idTemplate: 'arm_{{orientation}}',
              allowedTypes: ['test:arm_part'],
              orientationScheme: 'bilateral',
            },
          },
        ],
      },
    });
  };

  it('provides availability hints when exclusions remove all group matches', async () => {
    registerArmTemplate();

    testBed.registry.store('anatomyBlueprints', 'test:arm_blueprint', {
      id: 'test:arm_blueprint',
      root: 'anatomy:torso',
      schemaVersion: '2.0',
      structureTemplate: 'test:arm_template',
    });

    testBed.registry.store('anatomyRecipes', 'test:arm_recipe', {
      recipeId: 'test:arm_recipe',
      blueprintId: 'test:arm_blueprint',
      patterns: [
        {
          matchesGroup: 'limbSet:arm',
          partType: 'test:arm_part',
          exclude: {
            slotGroups: ['limbSet:arm'],
          },
        },
      ],
    });

    testBed.loadEntityDefinitions({
      'anatomy:torso': {
        id: 'anatomy:torso',
        components: {
          'anatomy:body_part': { partType: 'torso', name: 'Torso' },
          'anatomy:part': { subType: 'torso' },
        },
      },
    });

    await expect(
      testBed.bodyBlueprintFactory.createAnatomyGraph(
        'test:arm_blueprint',
        'test:arm_recipe'
      )
    ).rejects.toThrow(
      "after applying exclusions in structure template 'test:arm_template'. Available slot keys: arm_left, arm_right. Available orientations: left, right. Available sockets: arm_left, arm_right."
    );
  });

  it('records blueprint additionalSlots overrides as pattern conflicts', () => {
    registerArmTemplate();

    testBed.registry.store('anatomyBlueprints', 'test:override_blueprint', {
      id: 'test:override_blueprint',
      root: 'anatomy:torso',
      schemaVersion: '2.0',
      structureTemplate: 'test:arm_template',
      additionalSlots: {
        arm_left: {
          socket: 'arm_left',
          parent: 'anatomy:torso',
          requirements: {
            partType: 'override_part',
            components: ['anatomy:part'],
          },
        },
      },
    });

    const blueprint = loadBlueprint('test:override_blueprint', {
      dataRegistry: testBed.registry,
      logger: testBed.logger,
      socketGenerator: testBed.socketGenerator,
      slotGenerator: testBed.slotGenerator,
    });

    const recipe = {
      recipeId: 'test:override_recipe',
      patterns: [
        {
          matchesGroup: 'limbSet:arm',
          partType: 'test:arm_part',
        },
      ],
    };

    const resolved = testBed.recipePatternResolver.resolveRecipePatterns(
      recipe,
      blueprint
    );

    expect(resolved.slots.arm_right).toEqual({
      partType: 'test:arm_part',
      preferId: undefined,
      tags: undefined,
      notTags: undefined,
      properties: undefined,
    });
    expect(resolved.slots.arm_left).toBeUndefined();
    expect(resolved._patternConflicts).toEqual([
      expect.objectContaining({
        severity: 'warning',
        slotKey: 'arm_left',
      }),
    ]);
  });

  it('adds default matcher hint when pattern lacks a usable matcher type', () => {
    registerArmTemplate();

    testBed.registry.store('anatomyBlueprints', 'test:hint_blueprint', {
      id: 'test:hint_blueprint',
      root: 'anatomy:torso',
      schemaVersion: '2.0',
      structureTemplate: 'test:arm_template',
    });

    const blueprint = loadBlueprint('test:hint_blueprint', {
      dataRegistry: testBed.registry,
      logger: testBed.logger,
      socketGenerator: testBed.socketGenerator,
      slotGenerator: testBed.slotGenerator,
    });

    const recipe = {
      recipeId: 'test:hint_recipe',
      patterns: [
        {
          matches: 'not-an-array',
          partType: 'test:arm_part',
        },
      ],
    };

    const resolved = testBed.recipePatternResolver.resolveRecipePatterns(
      recipe,
      blueprint
    );

    expect(resolved._patternHints).toContain(
      'Pattern skipped: no matcher defined. Use matchesGroup selectors such as limbSet:leg or appendage:tail, matchesPattern wildcards, or matchesAll filters.'
    );
  });

  it('adds default matcher hint when explicit matches array is empty', () => {
    registerArmTemplate();

    testBed.registry.store('anatomyBlueprints', 'test:empty_matches_blueprint', {
      id: 'test:empty_matches_blueprint',
      root: 'anatomy:torso',
      schemaVersion: '2.0',
      structureTemplate: 'test:arm_template',
    });

    const blueprint = loadBlueprint('test:empty_matches_blueprint', {
      dataRegistry: testBed.registry,
      logger: testBed.logger,
      socketGenerator: testBed.socketGenerator,
      slotGenerator: testBed.slotGenerator,
    });

    const recipe = {
      recipeId: 'test:empty_matches_recipe',
      patterns: [
        {
          matches: [],
          partType: 'test:arm_part',
        },
      ],
    };

    const resolved = testBed.recipePatternResolver.resolveRecipePatterns(
      recipe,
      blueprint
    );

    expect(resolved._patternHints).toContain(
      'Pattern skipped: no matcher defined. Use matchesGroup selectors such as limbSet:leg or appendage:tail, matchesPattern wildcards, or matchesAll filters.'
    );
  });

  it('returns original recipe when no patterns are defined', () => {
    registerArmTemplate();

    testBed.registry.store('anatomyBlueprints', 'test:hint_blueprint', {
      id: 'test:hint_blueprint',
      root: 'anatomy:torso',
      schemaVersion: '2.0',
      structureTemplate: 'test:arm_template',
    });

    const blueprint = loadBlueprint('test:hint_blueprint', {
      dataRegistry: testBed.registry,
      logger: testBed.logger,
      socketGenerator: testBed.socketGenerator,
      slotGenerator: testBed.slotGenerator,
    });

    const recipe = {
      recipeId: 'test:no_patterns_recipe',
      slots: {
        arm_left: { partType: 'explicit' },
      },
    };

    const resolved = testBed.recipePatternResolver.resolveRecipePatterns(
      recipe,
      blueprint
    );

    expect(resolved).toBe(recipe);
  });

  it('rethrows structure template lookup failures during group resolution', () => {
    const logger = createMockLogger();
    const registry = new FlakyTemplateRegistry({ logger });
    const slotGenerator = new SlotGenerator({ logger });
    const resolver = new RecipePatternResolver({
      dataRegistry: registry,
      slotGenerator,
      logger,
    });

    registry.store('anatomyStructureTemplates', 'test:unstable_template', {
      id: 'test:unstable_template',
      topology: {
        rootType: 'torso',
        limbSets: [
          {
            type: 'arm',
            count: 2,
            socketPattern: {
              idTemplate: 'arm_{{index}}',
              allowedTypes: ['test:arm_part'],
            },
          },
        ],
      },
    });

    const blueprint = {
      id: 'test:unstable_blueprint',
      schemaVersion: '2.0',
      structureTemplate: 'test:unstable_template',
      slots: {
        arm_1: { socket: 'arm_1' },
        arm_2: { socket: 'arm_2' },
      },
    };

    const recipe = {
      patterns: [
        {
          matchesGroup: 'limbSet:arm',
          partType: 'test:arm_part',
        },
      ],
    };

    expect.assertions(2);

    try {
      resolver.resolveRecipePatterns(recipe, blueprint);
      throw new Error('Expected ValidationError');
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      expect(error.message).toBe(
        'Structure template not found: test:unstable_template'
      );
    }
  });

  it('wraps slot group lookup failures with pattern context', () => {
    const logger = createMockLogger();
    const registry = new FlakyTemplateRegistry({ logger });
    const slotGenerator = new SlotGenerator({ logger });
    const resolver = new RecipePatternResolver({
      dataRegistry: registry,
      slotGenerator,
      logger,
    });

    registry.store('anatomyStructureTemplates', 'test:volatile_template', {
      id: 'test:volatile_template',
      topology: {
        rootType: 'torso',
        limbSets: [
          {
            type: 'arm',
            count: 2,
            socketPattern: {
              idTemplate: 'arm_{{index}}',
              allowedTypes: ['test:arm_part'],
            },
          },
        ],
      },
    });

    const blueprint = {
      id: 'test:volatile_blueprint',
      schemaVersion: '2.0',
      structureTemplate: 'test:volatile_template',
      slots: {
        arm_1: { socket: 'arm_1' },
        arm_2: { socket: 'arm_2' },
      },
    };

    const recipe = {
      patterns: [
        {
          matchesGroup: 'limbSet:arm',
          partType: 'test:arm_part',
        },
      ],
    };

    expect.assertions(2);

    try {
      resolver.resolveRecipePatterns(recipe, blueprint);
      throw new Error('Expected ValidationError');
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      expect(error.message).toBe(
        "Pattern 1: Slot group 'limbSet:arm' not found in structure template 'test:volatile_template'."
      );
    }
  });
});
