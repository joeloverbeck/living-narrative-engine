import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { BodyBlueprintFactory } from '../../../src/anatomy/bodyBlueprintFactory.js';

describe('BodyBlueprintFactory - Torso Override Integration', () => {
  let factory;
  let mockEntityManager;
  let mockDataRegistry;
  let mockLogger;
  let mockEventDispatcher;
  let mockEventDispatchService;
  let mockValidator;

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

  const mockGorgeousMilfRecipe = {
    recipeId: 'anatomy:gorgeous_milf',
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
      hair: {
        partType: 'hair',
        preferId: 'anatomy:human_hair_raven',
        properties: {
          'descriptors:color_extended': {
            color: 'raven-black',
          },
          'descriptors:length_hair': {
            length: 'long',
          },
          'descriptors:hair_style': {
            style: 'straight',
          },
        },
      },
    },
    patterns: [
      {
        matches: ['left_eye', 'right_eye'],
        partType: 'eye',
        preferId: 'anatomy:human_eye_cobalt',
        properties: {
          'descriptors:color_extended': {
            color: 'cobalt',
          },
          'descriptors:shape_eye': {
            shape: 'almond',
          },
        },
      },
      {
        matches: ['left_arm', 'right_arm'],
        partType: 'arm',
        preferId: 'anatomy:humanoid_arm',
      },
      {
        matches: ['left_leg', 'right_leg'],
        partType: 'leg',
        preferId: 'anatomy:human_leg_shapely',
        properties: {
          'descriptors:length_category': {
            length: 'long',
          },
          'descriptors:build': {
            build: 'shapely',
          },
        },
      },
      {
        matches: ['left_breast', 'right_breast'],
        partType: 'breast',
        preferId: 'anatomy:human_breast_d_cup',
        properties: {
          'descriptors:size_specific': {
            size: 'D-cup',
          },
          'descriptors:weight_feel': {
            weight: 'meaty',
          },
          'descriptors:firmness': {
            firmness: 'soft',
          },
        },
      },
    ],
  };

  beforeEach(() => {
    mockEntityManager = {
      getEntityInstance: jest.fn(),
      createEntityInstance: jest.fn(),
      createEntity: jest.fn(),
      addComponent: jest.fn(),
      getComponentData: jest.fn(),
      removeEntity: jest.fn(),
    };

    mockDataRegistry = {
      get: jest.fn(),
      getAll: jest.fn(),
    };

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockEventDispatcher = {
      dispatch: jest.fn().mockResolvedValue(undefined),
    };

    mockValidator = {
      validateGraph: jest
        .fn()
        .mockResolvedValue({ valid: true, errors: [], warnings: [] }),
    };

    mockEventDispatchService = {
      dispatchWithLogging: jest.fn().mockResolvedValue(undefined),
      dispatchWithErrorHandling: jest.fn().mockResolvedValue(true),
      safeDispatchEvent: jest.fn().mockResolvedValue(undefined),
    };

    factory = new BodyBlueprintFactory({
      entityManager: mockEntityManager,
      dataRegistry: mockDataRegistry,
      logger: mockLogger,
      eventDispatcher: mockEventDispatcher,
      eventDispatchService: mockEventDispatchService,
      validator: mockValidator,
    });
  });

  describe('existing recipe integration tests', () => {
    it('should use male torso override from human_male recipe', async () => {
      const blueprint = {
        root: 'anatomy:default_torso', // Different from recipe
        slots: {},
      };

      mockDataRegistry.get.mockImplementation((registry, id) => {
        if (registry === 'anatomyBlueprints' && id === 'anatomy:human_male')
          return blueprint;
        if (registry === 'anatomyRecipes' && id === 'anatomy:human_male')
          return mockHumanMaleRecipe;
        if (registry === 'entityDefinitions' && id === 'anatomy:human_male_torso') {
          return {
            id: 'anatomy:human_male_torso',
            components: {
              'anatomy:part': { subType: 'torso' },
              'anatomy:sockets': { sockets: [] },
              'core:name': { text: 'torso' },
            },
          };
        }
        return null;
      });

      const mockMaleTorsoEntity = {
        id: 'torso-1',
        definitionId: 'anatomy:human_male_torso',
      };
      mockEntityManager.createEntityInstance.mockReturnValue(mockMaleTorsoEntity);

      const result = await factory.createAnatomyGraph(
        'anatomy:human_male',
        'anatomy:human_male'
      );

      expect(mockEntityManager.createEntityInstance).toHaveBeenCalledWith(
        'anatomy:human_male_torso'
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "Using recipe torso override: 'anatomy:human_male_torso' instead of blueprint default: 'anatomy:default_torso'"
      );
      expect(result.rootId).toBe('torso-1');
    });

    it('should use female torso override from human_female recipe', async () => {
      const blueprint = {
        root: 'anatomy:default_torso', // Different from recipe
        slots: {},
      };

      mockDataRegistry.get.mockImplementation((registry, id) => {
        if (registry === 'anatomyBlueprints' && id === 'anatomy:human_female')
          return blueprint;
        if (registry === 'anatomyRecipes' && id === 'anatomy:human_female')
          return mockHumanFemaleRecipe;
        if (registry === 'entityDefinitions' && id === 'anatomy:human_female_torso') {
          return {
            id: 'anatomy:human_female_torso',
            components: {
              'anatomy:part': { subType: 'torso' },
              'anatomy:sockets': { sockets: [] },
              'core:name': { text: 'torso' },
            },
          };
        }
        return null;
      });

      const mockFemaleTorsoEntity = {
        id: 'torso-1',
        definitionId: 'anatomy:human_female_torso',
      };
      mockEntityManager.createEntityInstance.mockReturnValue(mockFemaleTorsoEntity);

      const result = await factory.createAnatomyGraph(
        'anatomy:human_female',
        'anatomy:human_female'
      );

      expect(mockEntityManager.createEntityInstance).toHaveBeenCalledWith(
        'anatomy:human_female_torso'
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "Using recipe torso override: 'anatomy:human_female_torso' instead of blueprint default: 'anatomy:default_torso'"
      );
      expect(result.rootId).toBe('torso-1');
    });

    it('should use female torso override from gorgeous_milf recipe', async () => {
      const blueprint = {
        root: 'anatomy:default_torso', // Different from recipe
        slots: {},
      };

      mockDataRegistry.get.mockImplementation((registry, id) => {
        if (registry === 'anatomyBlueprints' && id === 'anatomy:human_female')
          return blueprint;
        if (registry === 'anatomyRecipes' && id === 'anatomy:gorgeous_milf')
          return mockGorgeousMilfRecipe;
        if (registry === 'entityDefinitions' && id === 'anatomy:human_female_torso') {
          return {
            id: 'anatomy:human_female_torso',
            components: {
              'anatomy:part': { subType: 'torso' },
              'anatomy:sockets': { sockets: [] },
              'core:name': { text: 'torso' },
            },
          };
        }
        return null;
      });

      const mockFemaleTorsoEntity = {
        id: 'torso-1',
        definitionId: 'anatomy:human_female_torso',
      };
      mockEntityManager.createEntityInstance.mockReturnValue(mockFemaleTorsoEntity);

      const result = await factory.createAnatomyGraph(
        'anatomy:human_female',
        'anatomy:gorgeous_milf'
      );

      expect(mockEntityManager.createEntityInstance).toHaveBeenCalledWith(
        'anatomy:human_female_torso'
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "Using recipe torso override: 'anatomy:human_female_torso' instead of blueprint default: 'anatomy:default_torso'"
      );
      expect(result.rootId).toBe('torso-1');
    });

    it('should work when recipe torso matches blueprint default', async () => {
      const blueprint = {
        root: 'anatomy:human_male_torso', // Same as recipe
        slots: {},
      };

      mockDataRegistry.get.mockImplementation((registry, id) => {
        if (registry === 'anatomyBlueprints' && id === 'anatomy:human_male')
          return blueprint;
        if (registry === 'anatomyRecipes' && id === 'anatomy:human_male')
          return mockHumanMaleRecipe;
        if (registry === 'entityDefinitions' && id === 'anatomy:human_male_torso') {
          return {
            id: 'anatomy:human_male_torso',
            components: {
              'anatomy:part': { subType: 'torso' },
              'anatomy:sockets': { sockets: [] },
              'core:name': { text: 'torso' },
            },
          };
        }
        return null;
      });

      const mockMaleTorsoEntity = {
        id: 'torso-1',
        definitionId: 'anatomy:human_male_torso',
      };
      mockEntityManager.createEntityInstance.mockReturnValue(mockMaleTorsoEntity);

      const result = await factory.createAnatomyGraph(
        'anatomy:human_male',
        'anatomy:human_male'
      );

      expect(mockEntityManager.createEntityInstance).toHaveBeenCalledWith(
        'anatomy:human_male_torso'
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "Using recipe torso override: 'anatomy:human_male_torso' instead of blueprint default: 'anatomy:human_male_torso'"
      );
      expect(result.rootId).toBe('torso-1');
    });
  });
});