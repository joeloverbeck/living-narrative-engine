import {
  beforeEach,
  afterEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import AnatomyIntegrationTestBed from '../../common/anatomy/anatomyIntegrationTestBed.js';

describe('BodyBlueprintFactory - Torso Override Integration', () => {
  let testBed;
  let factory;
  let originalGet;
  let createdEntities;
  let entityCounter;

  // Mock data from actual recipe files
  const mockHumanMaleRecipe = {
    recipeId: 'anatomy:human_male',
    blueprintId: 'anatomy:human_male',
    slots: {
      torso: {
        partType: 'torso',
        preferId: 'anatomy:human_male_torso',
      },
      head: {
        partType: 'head',
        preferId: 'anatomy:humanoid_head',
      },
    },
    patterns: [
      {
        matches: ['left_arm', 'right_arm'],
        partType: 'arm',
        preferId: 'anatomy:humanoid_arm',
      },
      {
        matches: ['left_leg', 'right_leg'],
        partType: 'leg',
        preferId: 'anatomy:humanoid_leg',
      },
    ],
  };

  const mockHumanFemaleRecipe = {
    recipeId: 'anatomy:human_female',
    blueprintId: 'anatomy:human_female',
    slots: {
      torso: {
        partType: 'torso',
        preferId: 'anatomy:human_female_torso',
      },
      head: {
        partType: 'head',
        preferId: 'anatomy:humanoid_head',
      },
    },
    patterns: [
      {
        matches: ['left_arm', 'right_arm'],
        partType: 'arm',
        preferId: 'anatomy:humanoid_arm',
      },
      {
        matches: ['left_leg', 'right_leg'],
        partType: 'leg',
        preferId: 'anatomy:humanoid_leg',
      },
    ],
  };

  beforeEach(() => {
    testBed = new AnatomyIntegrationTestBed();
    factory = testBed.bodyBlueprintFactory;

    // Initialize tracking variables
    createdEntities = new Map();
    entityCounter = 0;

    // Load required entity definitions for the tests
    testBed.loadEntityDefinitions({
      'anatomy:humanoid_head': {
        id: 'anatomy:humanoid_head',
        components: {
          'anatomy:part': { subType: 'head' },
          'anatomy:sockets': {
            sockets: [
              {
                id: 'left_eye',
                orientation: 'left',
                allowedTypes: ['eye'],
                nameTpl: '{{orientation}} {{type}}',
              },
              {
                id: 'right_eye',
                orientation: 'right',
                allowedTypes: ['eye'],
                nameTpl: '{{orientation}} {{type}}',
              },
              { id: 'scalp', allowedTypes: ['hair'], nameTpl: '{{type}}' },
            ],
          },
          'core:name': { text: 'head' },
        },
      },
      'anatomy:humanoid_arm': {
        id: 'anatomy:humanoid_arm',
        components: {
          'anatomy:part': { subType: 'arm' },
          'anatomy:sockets': {
            sockets: [
              {
                id: 'wrist',
                allowedTypes: ['hand'],
                nameTpl: '{{parent.name}} {{type}}',
              },
            ],
          },
          'core:name': { text: 'arm' },
        },
      },
      'anatomy:humanoid_leg': {
        id: 'anatomy:humanoid_leg',
        components: {
          'anatomy:part': { subType: 'leg' },
          'anatomy:sockets': {
            sockets: [
              {
                id: 'knee',
                orientation: 'lower',
                allowedTypes: ['lower_leg'],
                nameTpl: '{{parent.name}} lower leg',
              },
            ],
          },
          'core:name': { text: 'leg' },
        },
      },
      'anatomy:human_leg_shapely': {
        id: 'anatomy:human_leg_shapely',
        components: {
          'anatomy:part': { subType: 'leg' },
          'descriptors:length_category': { length: 'long' },
          'descriptors:build': { build: 'shapely' },
          'core:name': { text: 'leg' },
        },
      },
      'anatomy:human_breast_d_cup': {
        id: 'anatomy:human_breast_d_cup',
        components: {
          'anatomy:part': { subType: 'breast' },
          'descriptors:size_specific': { size: 'D-cup' },
          'descriptors:weight_feel': { weight: 'meaty' },
          'descriptors:firmness': { firmness: 'soft' },
          'core:name': { text: 'breast' },
        },
      },
      'anatomy:human_hair_raven': {
        id: 'anatomy:human_hair_raven',
        components: {
          'anatomy:part': { subType: 'hair' },
          'descriptors:color_extended': { color: 'raven-black' },
          'descriptors:length_hair': { length: 'long' },
          'descriptors:hair_style': { style: 'straight' },
          'core:name': { text: 'hair' },
        },
      },
      'anatomy:human_eye_cobalt': {
        id: 'anatomy:human_eye_cobalt',
        components: {
          'anatomy:part': { subType: 'eye' },
          'descriptors:color_extended': { color: 'cobalt' },
          'descriptors:shape_eye': { shape: 'almond' },
          'core:name': { text: 'eye' },
        },
      },
    });

    // Set up mocks on the test bed's services
    jest
      .spyOn(testBed.entityManager, 'createEntityInstance')
      .mockImplementation((defId) => {
        const entityId = defId.includes('torso')
          ? 'torso-1'
          : `entity-${++entityCounter}`;
        const entity = {
          id: entityId,
          definitionId: defId,
        };
        createdEntities.set(entityId, entity);
        return entity;
      });

    jest
      .spyOn(testBed.entityManager, 'addComponent')
      .mockImplementation(() => {});

    // Mock getEntityInstance to return entity data
    jest
      .spyOn(testBed.entityManager, 'getEntityInstance')
      .mockImplementation((entityId) => {
        return createdEntities.get(entityId) || null;
      });

    // Mock getComponentData to return component data based on entity definitions
    jest
      .spyOn(testBed.entityManager, 'getComponentData')
      .mockImplementation((entityId, componentId) => {
        const entity = createdEntities.get(entityId);
        if (!entity) return null;

        // Get the entity definition to extract component data
        const definition = testBed.registry.get(
          'entityDefinitions',
          entity.definitionId
        );
        if (
          definition &&
          definition.components &&
          definition.components[componentId]
        ) {
          return definition.components[componentId];
        }

        // Special handling for torso entities that may not be in the loaded definitions
        if (
          entity.definitionId.includes('torso') &&
          componentId === 'anatomy:sockets'
        ) {
          return {
            sockets: [
              { id: 'head_socket', allowedTypes: ['head'], maxCount: 1 },
              { id: 'arm_socket', allowedTypes: ['arm'], maxCount: 2 },
              { id: 'leg_socket', allowedTypes: ['leg'], maxCount: 2 },
              { id: 'breast_socket', allowedTypes: ['breast'], maxCount: 2 },
            ],
          };
        }

        return null;
      });
    // Note: removeEntity is not available on the test bed's entity manager

    // Create a reference to the original get method before mocking
    originalGet = testBed.registry.get.bind(testBed.registry);

    jest.spyOn(testBed.registry, 'get').mockImplementation((registry, id) => {
      // For entity definitions, use the actual registry
      if (registry === 'entityDefinitions') {
        return originalGet(registry, id);
      }
      return null;
    });

    jest.spyOn(testBed.validator, 'validateGraph').mockResolvedValue({
      valid: true,
      errors: [],
      warnings: [],
    });
  });

  afterEach(async () => {
    await testBed.cleanup();
  });

  describe('existing recipe integration tests', () => {
    it('should use male torso override from human_male recipe', async () => {
      const blueprint = {
        id: 'anatomy:human_male',
        root: 'anatomy:default_torso', // Different from recipe
        slots: {
          head: { parent: null, socket: 'head_socket', requirements: {} },
          left_arm: { parent: null, socket: 'arm_socket', requirements: {} },
          right_arm: { parent: null, socket: 'arm_socket', requirements: {} },
          left_leg: { parent: null, socket: 'leg_socket', requirements: {} },
          right_leg: { parent: null, socket: 'leg_socket', requirements: {} },
        },
      };

      testBed.registry.get.mockImplementation((registry, id) => {
        if (registry === 'anatomyBlueprints' && id === 'anatomy:human_male')
          return blueprint;
        if (registry === 'anatomyRecipes' && id === 'anatomy:human_male')
          return mockHumanMaleRecipe;
        if (
          registry === 'entityDefinitions' &&
          id === 'anatomy:human_male_torso'
        ) {
          return {
            id: 'anatomy:human_male_torso',
            components: {
              'anatomy:part': { subType: 'torso' },
              'anatomy:sockets': {
                sockets: [
                  { id: 'head_socket', allowedTypes: ['head'], maxCount: 1 },
                  { id: 'arm_socket', allowedTypes: ['arm'], maxCount: 2 },
                  { id: 'leg_socket', allowedTypes: ['leg'], maxCount: 2 },
                  {
                    id: 'breast_socket',
                    allowedTypes: ['breast'],
                    maxCount: 2,
                  },
                ],
              },
              'core:name': { text: 'torso' },
            },
          };
        }
        // Fall back to original registry for other entity definitions
        if (registry === 'entityDefinitions') {
          return originalGet(registry, id);
        }
        return null;
      });

      // No need to override createEntityInstance - the global mock handles it

      const result = await factory.createAnatomyGraph(
        'anatomy:human_male',
        'anatomy:human_male'
      );

      expect(testBed.entityManager.createEntityInstance).toHaveBeenCalledWith(
        'anatomy:human_male_torso',
        { componentOverrides: {} }
      );
      expect(testBed.logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Using recipe torso override')
      );
      expect(result.rootId).toBe('torso-1');
    });

    it('should use female torso override from human_female recipe', async () => {
      const blueprint = {
        id: 'anatomy:human_female',
        root: 'anatomy:default_torso', // Different from recipe
        slots: {
          head: { parent: null, socket: 'head_socket', requirements: {} },
          left_arm: { parent: null, socket: 'arm_socket', requirements: {} },
          right_arm: { parent: null, socket: 'arm_socket', requirements: {} },
          left_leg: { parent: null, socket: 'leg_socket', requirements: {} },
          right_leg: { parent: null, socket: 'leg_socket', requirements: {} },
        },
      };

      testBed.registry.get.mockImplementation((registry, id) => {
        if (registry === 'anatomyBlueprints' && id === 'anatomy:human_female')
          return blueprint;
        if (registry === 'anatomyRecipes' && id === 'anatomy:human_female')
          return mockHumanFemaleRecipe;
        if (
          registry === 'entityDefinitions' &&
          id === 'anatomy:human_female_torso'
        ) {
          return {
            id: 'anatomy:human_female_torso',
            components: {
              'anatomy:part': { subType: 'torso' },
              'anatomy:sockets': {
                sockets: [
                  { id: 'head_socket', allowedTypes: ['head'], maxCount: 1 },
                  { id: 'arm_socket', allowedTypes: ['arm'], maxCount: 2 },
                  { id: 'leg_socket', allowedTypes: ['leg'], maxCount: 2 },
                  {
                    id: 'breast_socket',
                    allowedTypes: ['breast'],
                    maxCount: 2,
                  },
                ],
              },
              'core:name': { text: 'torso' },
            },
          };
        }
        // Fall back to original registry for other entity definitions
        if (registry === 'entityDefinitions') {
          return originalGet(registry, id);
        }
        return null;
      });

      // No need to override createEntityInstance - the global mock handles it

      const result = await factory.createAnatomyGraph(
        'anatomy:human_female',
        'anatomy:human_female'
      );

      expect(testBed.entityManager.createEntityInstance).toHaveBeenCalledWith(
        'anatomy:human_female_torso',
        { componentOverrides: {} }
      );
      expect(testBed.logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Using recipe torso override')
      );
      expect(result.rootId).toBe('torso-1');
    });

    it('should use female torso override from human_female recipe', async () => {
      const blueprint = {
        id: 'anatomy:human_female',
        root: 'anatomy:default_torso', // Different from recipe
        slots: {
          head: { parent: null, socket: 'head_socket', requirements: {} },
          hair: { parent: 'head', socket: 'scalp', requirements: {} },
          left_eye: { parent: 'head', socket: 'left_eye', requirements: {} },
          right_eye: { parent: 'head', socket: 'right_eye', requirements: {} },
          left_arm: { parent: null, socket: 'arm_socket', requirements: {} },
          right_arm: { parent: null, socket: 'arm_socket', requirements: {} },
          left_leg: { parent: null, socket: 'leg_socket', requirements: {} },
          right_leg: { parent: null, socket: 'leg_socket', requirements: {} },
          left_breast: {
            parent: null,
            socket: 'breast_socket',
            requirements: {},
          },
          right_breast: {
            parent: null,
            socket: 'breast_socket',
            requirements: {},
          },
        },
      };

      testBed.registry.get.mockImplementation((registry, id) => {
        if (registry === 'anatomyBlueprints' && id === 'anatomy:human_female')
          return blueprint;
        if (registry === 'anatomyRecipes' && id === 'anatomy:human_female')
          return mockHumanFemaleRecipe;
        if (
          registry === 'entityDefinitions' &&
          id === 'anatomy:human_female_torso'
        ) {
          return {
            id: 'anatomy:human_female_torso',
            components: {
              'anatomy:part': { subType: 'torso' },
              'anatomy:sockets': {
                sockets: [
                  { id: 'head_socket', allowedTypes: ['head'], maxCount: 1 },
                  { id: 'arm_socket', allowedTypes: ['arm'], maxCount: 2 },
                  { id: 'leg_socket', allowedTypes: ['leg'], maxCount: 2 },
                  {
                    id: 'breast_socket',
                    allowedTypes: ['breast'],
                    maxCount: 2,
                  },
                ],
              },
              'core:name': { text: 'torso' },
            },
          };
        }
        // Fall back to original registry for other entity definitions
        if (registry === 'entityDefinitions') {
          return originalGet(registry, id);
        }
        return null;
      });

      // No need to override createEntityInstance - the global mock handles it

      const result = await factory.createAnatomyGraph(
        'anatomy:human_female',
        'anatomy:human_female'
      );

      expect(testBed.entityManager.createEntityInstance).toHaveBeenCalledWith(
        'anatomy:human_female_torso',
        { componentOverrides: {} }
      );
      expect(testBed.logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Using recipe torso override')
      );
      expect(result.rootId).toBe('torso-1');
    });

    it('should work when recipe torso matches blueprint default', async () => {
      const blueprint = {
        root: 'anatomy:human_male_torso', // Same as recipe
        slots: {
          head: { parent: null, socket: 'head_socket', requirements: {} },
          left_arm: { parent: null, socket: 'arm_socket', requirements: {} },
          right_arm: { parent: null, socket: 'arm_socket', requirements: {} },
          left_leg: { parent: null, socket: 'leg_socket', requirements: {} },
          right_leg: { parent: null, socket: 'leg_socket', requirements: {} },
        },
      };

      testBed.registry.get.mockImplementation((registry, id) => {
        if (registry === 'anatomyBlueprints' && id === 'anatomy:human_male')
          return blueprint;
        if (registry === 'anatomyRecipes' && id === 'anatomy:human_male')
          return mockHumanMaleRecipe;
        if (
          registry === 'entityDefinitions' &&
          id === 'anatomy:human_male_torso'
        ) {
          return {
            id: 'anatomy:human_male_torso',
            components: {
              'anatomy:part': { subType: 'torso' },
              'anatomy:sockets': {
                sockets: [
                  { id: 'head_socket', allowedTypes: ['head'], maxCount: 1 },
                  { id: 'arm_socket', allowedTypes: ['arm'], maxCount: 2 },
                  { id: 'leg_socket', allowedTypes: ['leg'], maxCount: 2 },
                  {
                    id: 'breast_socket',
                    allowedTypes: ['breast'],
                    maxCount: 2,
                  },
                ],
              },
              'core:name': { text: 'torso' },
            },
          };
        }
        // Fall back to original registry for other entity definitions
        if (registry === 'entityDefinitions') {
          return originalGet(registry, id);
        }
        return null;
      });

      // No need to override createEntityInstance - the global mock handles it

      const result = await factory.createAnatomyGraph(
        'anatomy:human_male',
        'anatomy:human_male'
      );

      expect(testBed.entityManager.createEntityInstance).toHaveBeenCalledWith(
        'anatomy:human_male_torso',
        { componentOverrides: {} }
      );
      expect(testBed.logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Using recipe torso override')
      );
      expect(result.rootId).toBe('torso-1');
    });
  });
});
