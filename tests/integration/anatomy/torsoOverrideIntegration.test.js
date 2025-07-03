import { beforeEach, afterEach, describe, expect, it, jest } from '@jest/globals';
import AnatomyIntegrationTestBed from '../../common/anatomy/anatomyIntegrationTestBed.js';

describe('BodyBlueprintFactory - Torso Override Integration', () => {
  let testBed;
  let factory;

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
    testBed = new AnatomyIntegrationTestBed();
    factory = testBed.bodyBlueprintFactory;

    // Set up mocks on the test bed's services
    jest.spyOn(testBed.entityManager, 'createEntityInstance').mockImplementation((defId) => ({
      id: `entity_${defId}`,
      definitionId: defId,
    }));
    jest.spyOn(testBed.entityManager, 'addComponent').mockImplementation(() => {});
    jest.spyOn(testBed.entityManager, 'getComponentData').mockImplementation(() => null);
    // Note: removeEntity is not available on the test bed's entity manager

    jest.spyOn(testBed.registry, 'get').mockImplementation(() => null);
    jest.spyOn(testBed.registry, 'getAll').mockReturnValue([]);

    jest.spyOn(testBed.validator, 'validateGraph').mockResolvedValue({ 
      valid: true, 
      errors: [], 
      warnings: [] 
    });
  });

  afterEach(async () => {
    await testBed.cleanup();
  });

  describe('existing recipe integration tests', () => {
    it('should use male torso override from human_male recipe', async () => {
      const blueprint = {
        root: 'anatomy:default_torso', // Different from recipe
        slots: {},
      };

      testBed.registry.get.mockImplementation((registry, id) => {
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
      testBed.entityManager.createEntityInstance.mockReturnValue(mockMaleTorsoEntity);

      const result = await factory.createAnatomyGraph(
        'anatomy:human_male',
        'anatomy:human_male'
      );

      expect(testBed.entityManager.createEntityInstance).toHaveBeenCalledWith(
        'anatomy:human_male_torso'
      );
      expect(testBed.logger.debug).toHaveBeenCalledWith(
        expect.stringContaining("Using recipe torso override")
      );
      expect(result.rootId).toBe('torso-1');
    });

    it('should use female torso override from human_female recipe', async () => {
      const blueprint = {
        root: 'anatomy:default_torso', // Different from recipe
        slots: {},
      };

      testBed.registry.get.mockImplementation((registry, id) => {
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
      testBed.entityManager.createEntityInstance.mockReturnValue(mockFemaleTorsoEntity);

      const result = await factory.createAnatomyGraph(
        'anatomy:human_female',
        'anatomy:human_female'
      );

      expect(testBed.entityManager.createEntityInstance).toHaveBeenCalledWith(
        'anatomy:human_female_torso'
      );
      expect(testBed.logger.debug).toHaveBeenCalledWith(
        expect.stringContaining("Using recipe torso override")
      );
      expect(result.rootId).toBe('torso-1');
    });

    it('should use female torso override from gorgeous_milf recipe', async () => {
      const blueprint = {
        root: 'anatomy:default_torso', // Different from recipe
        slots: {},
      };

      testBed.registry.get.mockImplementation((registry, id) => {
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
      testBed.entityManager.createEntityInstance.mockReturnValue(mockFemaleTorsoEntity);

      const result = await factory.createAnatomyGraph(
        'anatomy:human_female',
        'anatomy:gorgeous_milf'
      );

      expect(testBed.entityManager.createEntityInstance).toHaveBeenCalledWith(
        'anatomy:human_female_torso'
      );
      expect(testBed.logger.debug).toHaveBeenCalledWith(
        expect.stringContaining("Using recipe torso override")
      );
      expect(result.rootId).toBe('torso-1');
    });

    it('should work when recipe torso matches blueprint default', async () => {
      const blueprint = {
        root: 'anatomy:human_male_torso', // Same as recipe
        slots: {},
      };

      testBed.registry.get.mockImplementation((registry, id) => {
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
      testBed.entityManager.createEntityInstance.mockReturnValue(mockMaleTorsoEntity);

      const result = await factory.createAnatomyGraph(
        'anatomy:human_male',
        'anatomy:human_male'
      );

      expect(testBed.entityManager.createEntityInstance).toHaveBeenCalledWith(
        'anatomy:human_male_torso'
      );
      expect(testBed.logger.debug).toHaveBeenCalledWith(
        expect.stringContaining("Using recipe torso override")
      );
      expect(result.rootId).toBe('torso-1');
    });
  });
});