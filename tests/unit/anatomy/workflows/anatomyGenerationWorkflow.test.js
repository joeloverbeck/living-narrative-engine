import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { AnatomyGenerationWorkflow } from '../../../../src/anatomy/workflows/anatomyGenerationWorkflow.js';
import { ValidationError } from '../../../../src/errors/validationError.js';
import { BodyDescriptorValidator } from '../../../../src/anatomy/utils/bodyDescriptorValidator.js';

describe('AnatomyGenerationWorkflow', () => {
  let workflow;
  let mockEntityManager;
  let mockDataRegistry;
  let mockLogger;
  let mockBodyBlueprintFactory;
  let mockClothingInstantiationService;

  beforeEach(() => {
    // Create mocks
    mockEntityManager = {
      getEntityInstance: jest.fn(),
      getComponentData: jest.fn(),
      addComponent: jest.fn(),
      createEntityInstance: jest.fn(),
    };

    mockDataRegistry = {
      get: jest.fn(),
    };

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockBodyBlueprintFactory = {
      createAnatomyGraph: jest.fn(),
    };

    mockClothingInstantiationService = {
      instantiateRecipeClothing: jest.fn(),
    };

    // Create workflow instance
    workflow = new AnatomyGenerationWorkflow({
      entityManager: mockEntityManager,
      dataRegistry: mockDataRegistry,
      logger: mockLogger,
      bodyBlueprintFactory: mockBodyBlueprintFactory,
      clothingInstantiationService: mockClothingInstantiationService,
    });
  });

  describe('generate', () => {
    const blueprintId = 'test-blueprint';
    const recipeId = 'test-recipe';
    const ownerId = 'owner-entity';
    const rootId = 'root-entity';
    const partIds = ['arm-1', 'arm-2'];

    beforeEach(() => {
      // Setup default successful generation
      const graphResult = {
        rootId,
        entities: [rootId, ...partIds],
        slotToPartMappings: new Map([
          ['slot-left-arm', 'arm-1'],
          ['slot-right-arm', 'arm-2'],
        ]),
      };
      mockBodyBlueprintFactory.createAnatomyGraph.mockResolvedValue(
        graphResult
      );
    });

    it('should generate anatomy graph successfully', async () => {
      // Mock entities with names
      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === 'arm-1') {
          return {
            hasComponent: jest.fn(
              (compId) => compId === 'core:name' || compId === 'anatomy:part'
            ),
            getComponentData: jest.fn().mockReturnValue({ text: 'left_arm' }),
          };
        }
        if (id === 'arm-2') {
          return {
            hasComponent: jest.fn(
              (compId) => compId === 'core:name' || compId === 'anatomy:part'
            ),
            getComponentData: jest.fn().mockReturnValue({ text: 'right_arm' }),
          };
        }
        return {
          hasComponent: jest.fn().mockReturnValue(false),
        };
      });

      const result = await workflow.generate(blueprintId, recipeId, {
        ownerId,
      });

      expect(result.rootId).toEqual(rootId);
      expect(result.entities).toEqual([rootId, ...partIds]);
      expect(result.partsMap).toBeInstanceOf(Map);
      expect(result.partsMap.get('left_arm')).toBe('arm-1');
      expect(result.partsMap.get('right_arm')).toBe('arm-2');
      expect(result.slotEntityMappings).toBeInstanceOf(Map);
      expect(result.slotToPartMappings).toBeInstanceOf(Map);
      expect(result.slotToPartMappings.get('slot-left-arm')).toBe('arm-1');

      expect(mockBodyBlueprintFactory.createAnatomyGraph).toHaveBeenCalledWith(
        blueprintId,
        recipeId,
        { ownerId }
      );

      const anatomyAddCall = mockEntityManager.addComponent.mock.calls.find(
        ([, componentId]) => componentId === 'anatomy:body'
      );
      expect(anatomyAddCall[2].body.slotToPartMappings).toEqual({
        'slot-left-arm': 'arm-1',
        'slot-right-arm': 'arm-2',
      });
    });

    it('should handle parts without names', async () => {
      // Mock entities without names
      mockEntityManager.getEntityInstance.mockImplementation(() => {
        return {
          hasComponent: jest.fn().mockReturnValue(false),
        };
      });

      const result = await workflow.generate(blueprintId, recipeId, {
        ownerId,
      });

      expect(result.partsMap).toBeInstanceOf(Map);
      expect(result.partsMap.size).toBe(0);
      expect(result.slotEntityMappings).toBeInstanceOf(Map);
    });

    it('should handle parts with null name data', async () => {
      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === 'arm-1') {
          return {
            hasComponent: jest.fn((compId) => compId === 'core:name'),
            getComponentData: jest.fn().mockReturnValue(null),
          };
        }
        return null;
      });

      const result = await workflow.generate(blueprintId, recipeId, {
        ownerId,
      });

      expect(result.partsMap).toBeInstanceOf(Map);
      expect(result.partsMap.size).toBe(0);
      expect(result.slotEntityMappings).toBeInstanceOf(Map);
    });

    it('should handle parts with empty names', async () => {
      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === 'arm-1') {
          return {
            hasComponent: jest.fn((compId) => compId === 'core:name'),
            getComponentData: jest.fn().mockReturnValue({ text: '' }),
          };
        }
        return null;
      });

      const result = await workflow.generate(blueprintId, recipeId, {
        ownerId,
      });

      expect(result.partsMap).toBeInstanceOf(Map);
      expect(result.partsMap.size).toBe(0);
      expect(result.slotEntityMappings).toBeInstanceOf(Map);
    });

    it('should persist recipe body descriptors on the anatomy body component', async () => {
      const descriptorRecipeId = 'recipe-with-body-descriptors';
      const descriptorBlueprintId = 'blueprint-with-body-descriptors';
      const descriptorOwnerId = 'descriptor-owner';
      const graphResult = { rootId: 'root-entity', entities: ['root-entity'] };

      mockBodyBlueprintFactory.createAnatomyGraph.mockResolvedValue(
        graphResult
      );

      mockEntityManager.getEntityInstance.mockReturnValue({
        hasComponent: jest.fn().mockReturnValue(false),
        getComponentData: jest.fn(),
      });
      mockEntityManager.getComponentData.mockReturnValue({ existing: true });

      const recipeBodyDescriptors = {
        build: 'athletic',
        composition: 'lean',
      };

      mockDataRegistry.get.mockImplementation((collection) => {
        if (collection === 'anatomyRecipes') {
          return {
            blueprintId: descriptorBlueprintId,
            bodyDescriptors: recipeBodyDescriptors,
          };
        }

        if (collection === 'anatomyBlueprints') {
          return {
            slots: null,
            clothingSlotMappings: null,
          };
        }

        return undefined;
      });

      await workflow.generate(descriptorBlueprintId, descriptorRecipeId, {
        ownerId: descriptorOwnerId,
      });

      const anatomyBodyCall = mockEntityManager.addComponent.mock.calls.find(
        ([, componentId]) => componentId === 'anatomy:body'
      );

      expect(anatomyBodyCall).toBeDefined();
      expect(anatomyBodyCall[0]).toBe(descriptorOwnerId);
      expect(anatomyBodyCall[2].body.descriptors).toEqual(
        recipeBodyDescriptors
      );
    });

    it('should propagate errors from bodyBlueprintFactory', async () => {
      const error = new Error('Blueprint creation failed');
      mockBodyBlueprintFactory.createAnatomyGraph.mockRejectedValue(error);

      await expect(
        workflow.generate(blueprintId, recipeId, { ownerId })
      ).rejects.toThrow('Blueprint creation failed');
    });

    describe('with clothing instantiation', () => {
      const mockClothingResult = {
        instantiated: [
          { clothingId: 'clothing_1', entityDefinitionId: 'clothing:shirt' },
          { clothingId: 'clothing_2', entityDefinitionId: 'clothing:pants' },
        ],
        equipped: ['clothing_1', 'clothing_2'],
        errors: [],
      };

      beforeEach(() => {
        // Mock successful clothing instantiation
        mockClothingInstantiationService.instantiateRecipeClothing.mockResolvedValue(
          mockClothingResult
        );

        // Mock entities with names for parts map
        mockEntityManager.getEntityInstance.mockImplementation((id) => {
          if (id === 'arm-1') {
            return {
              hasComponent: jest.fn(
                (compId) => compId === 'core:name' || compId === 'anatomy:part'
              ),
              getComponentData: jest.fn().mockReturnValue({ text: 'left_arm' }),
            };
          }
          return {
            hasComponent: jest.fn().mockReturnValue(false),
          };
        });
      });

      it('should instantiate clothing when recipe contains clothingEntities', async () => {
        const recipeWithClothing = {
          blueprintId,
          clothingEntities: [
            { entityId: 'clothing:shirt', equip: true },
            { entityId: 'clothing:pants', equip: true },
          ],
        };

        // Mock data registry to return recipe with clothing
        mockDataRegistry.get.mockReturnValue(recipeWithClothing);

        const result = await workflow.generate(blueprintId, recipeId, {
          ownerId,
        });

        // Verify clothing instantiation was called
        expect(
          mockClothingInstantiationService.instantiateRecipeClothing
        ).toHaveBeenCalledWith(ownerId, recipeWithClothing, {
          partsMap: expect.any(Map),
          slotEntityMappings: expect.any(Map),
        });

        // Verify the result includes clothing data
        expect(result.rootId).toBe(rootId);
        expect(result.entities).toEqual([rootId, ...partIds]);
        expect(result.partsMap).toBeInstanceOf(Map);
        expect(result.partsMap.get('left_arm')).toBe('arm-1');
        expect(result.slotEntityMappings).toBeInstanceOf(Map);
        expect(result.clothingResult).toEqual(mockClothingResult);
      });

      it('should pass correct parts map to clothing instantiation', async () => {
        const recipeWithClothing = {
          blueprintId,
          clothingEntities: [{ entityId: 'clothing:shirt' }],
        };

        mockDataRegistry.get.mockReturnValue(recipeWithClothing);

        await workflow.generate(blueprintId, recipeId, { ownerId });

        // Get the anatomy data that was passed
        const passedAnatomyData =
          mockClothingInstantiationService.instantiateRecipeClothing.mock
            .calls[0][2];

        expect(passedAnatomyData).toBeDefined();
        expect(passedAnatomyData.partsMap).toBeInstanceOf(Map);
        expect(passedAnatomyData.partsMap.get('left_arm')).toBe('arm-1');
        expect(passedAnatomyData.slotEntityMappings).toBeInstanceOf(Map);
      });

      it('should not call clothing instantiation when recipe has no clothingEntities', async () => {
        const recipeWithoutClothing = {
          blueprintId,
          // No clothingEntities
        };

        mockDataRegistry.get.mockReturnValue(recipeWithoutClothing);

        const result = await workflow.generate(blueprintId, recipeId, {
          ownerId,
        });

        expect(
          mockClothingInstantiationService.instantiateRecipeClothing
        ).not.toHaveBeenCalled();
        expect(result.clothingResult).toBeUndefined();
      });

      it('should handle empty clothingEntities array', async () => {
        const recipeWithEmptyClothing = {
          blueprintId,
          clothingEntities: [],
        };

        mockDataRegistry.get.mockReturnValue(recipeWithEmptyClothing);

        const result = await workflow.generate(blueprintId, recipeId, {
          ownerId,
        });

        expect(
          mockClothingInstantiationService.instantiateRecipeClothing
        ).not.toHaveBeenCalled();
        expect(result.clothingResult).toBeUndefined();
      });

      it('should include clothing errors in result when instantiation has errors', async () => {
        const clothingWithErrors = {
          instantiated: [
            { clothingId: 'clothing_1', entityDefinitionId: 'clothing:shirt' },
          ],
          equipped: [],
          errors: ['Failed to equip pants: slot occupied'],
        };

        mockClothingInstantiationService.instantiateRecipeClothing.mockResolvedValue(
          clothingWithErrors
        );

        const recipeWithClothing = {
          blueprintId,
          clothingEntities: [
            { entityId: 'clothing:shirt' },
            { entityId: 'clothing:pants' },
          ],
        };

        mockDataRegistry.get.mockReturnValue(recipeWithClothing);

        const result = await workflow.generate(blueprintId, recipeId, {
          ownerId,
        });

        expect(result.clothingResult.errors).toHaveLength(1);
        expect(result.clothingResult.errors[0]).toBe(
          'Failed to equip pants: slot occupied'
        );
      });

      it('should handle clothing instantiation failure gracefully', async () => {
        const recipeWithClothing = {
          blueprintId,
          clothingEntities: [{ entityId: 'clothing:shirt' }],
        };

        mockDataRegistry.get.mockReturnValue(recipeWithClothing);
        mockClothingInstantiationService.instantiateRecipeClothing.mockRejectedValue(
          new Error('Clothing service error')
        );

        // Should not throw - errors are logged but generation continues
        const result = await workflow.generate(blueprintId, recipeId, {
          ownerId,
        });

        expect(result.rootId).toBe(rootId);
        expect(result.entities).toEqual([rootId, ...partIds]);
        expect(result.clothingResult).toBeUndefined();
        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.stringContaining('Failed to instantiate clothing'),
          expect.any(Error)
        );
      });
    });
  });

  describe('validateRecipe', () => {
    it('should validate recipe successfully', () => {
      const recipeId = 'test-recipe';
      const blueprintId = 'test-blueprint';

      mockDataRegistry.get.mockReturnValue({
        blueprintId,
        otherData: 'preserved',
      });

      const result = workflow.validateRecipe(recipeId);

      expect(result).toBe(blueprintId);
      expect(mockDataRegistry.get).toHaveBeenCalledWith(
        'anatomyRecipes',
        recipeId
      );
    });

    it('should throw error if recipe not found', () => {
      mockDataRegistry.get.mockReturnValue(null);

      expect(() => workflow.validateRecipe('missing-recipe')).toThrow(
        ValidationError
      );
      expect(() => workflow.validateRecipe('missing-recipe')).toThrow(
        "Recipe 'missing-recipe' not found"
      );
    });

    it('should throw error if recipe has no blueprintId', () => {
      mockDataRegistry.get.mockReturnValue({
        otherData: 'exists',
        // No blueprintId
      });

      expect(() => workflow.validateRecipe('test-recipe')).toThrow(
        ValidationError
      );
      expect(() => workflow.validateRecipe('test-recipe')).toThrow(
        "Recipe 'test-recipe' does not specify a blueprintId"
      );
    });
  });

  describe('validateBodyDescriptors', () => {
    it('should validate valid complete body descriptors', () => {
      const bodyDescriptors = {
        build: 'muscular',
        hairDensity: 'hairy',
        composition: 'lean',
        skinColor: 'tanned',
      };

      // Should not throw
      expect(() =>
        workflow.validateBodyDescriptors(bodyDescriptors, 'test-recipe')
      ).not.toThrow();
    });

    it('should validate valid partial body descriptors', () => {
      const bodyDescriptors = {
        build: 'athletic',
        composition: 'lean',
      };

      // Should not throw
      expect(() =>
        workflow.validateBodyDescriptors(bodyDescriptors, 'test-recipe')
      ).not.toThrow();
    });

    it('should validate empty body descriptors object', () => {
      const bodyDescriptors = {};

      // Should not throw
      expect(() =>
        workflow.validateBodyDescriptors(bodyDescriptors, 'test-recipe')
      ).not.toThrow();
    });

    it('should not throw for missing/null body descriptors', () => {
      // Should not throw for null
      expect(() =>
        workflow.validateBodyDescriptors(null, 'test-recipe')
      ).not.toThrow();

      // Should not throw for undefined
      expect(() =>
        workflow.validateBodyDescriptors(undefined, 'test-recipe')
      ).not.toThrow();
    });

    it('should throw error for invalid build value', () => {
      const bodyDescriptors = {
        build: 'invalid-build',
      };

      expect(() =>
        workflow.validateBodyDescriptors(bodyDescriptors, 'test-recipe')
      ).toThrow(ValidationError);
      expect(() =>
        workflow.validateBodyDescriptors(bodyDescriptors, 'test-recipe')
      ).toThrow(
        "Invalid build descriptor: 'invalid-build' in recipe 'test-recipe'. Must be one of: skinny, slim, lissom, toned, athletic, shapely, hourglass, thick, muscular, hulking, stocky"
      );
    });

    it('should throw error for invalid density value', () => {
      const bodyDescriptors = {
        hairDensity: 'super-hairy',
      };

      expect(() =>
        workflow.validateBodyDescriptors(bodyDescriptors, 'test-recipe')
      ).toThrow(ValidationError);
      expect(() =>
        workflow.validateBodyDescriptors(bodyDescriptors, 'test-recipe')
      ).toThrow(
        "Invalid hairDensity descriptor: 'super-hairy' in recipe 'test-recipe'. Must be one of: hairless, sparse, light, moderate, hairy, very-hairy"
      );
    });

    it('should throw error for invalid composition value', () => {
      const bodyDescriptors = {
        composition: 'extremely-overweight',
      };

      expect(() =>
        workflow.validateBodyDescriptors(bodyDescriptors, 'test-recipe')
      ).toThrow(ValidationError);
      expect(() =>
        workflow.validateBodyDescriptors(bodyDescriptors, 'test-recipe')
      ).toThrow(
        "Invalid composition descriptor: 'extremely-overweight' in recipe 'test-recipe'. Must be one of: underweight, lean, dense, average, soft, bumpy, chubby, overweight, obese, atrophied, emaciated, skeletal, malnourished, dehydrated, wasted, desiccated, bloated, rotting"
      );
    });

    it('should accept any string value for skinColor', () => {
      const bodyDescriptors = {
        skinColor: 'custom-color-value',
      };

      // Should not throw
      expect(() =>
        workflow.validateBodyDescriptors(bodyDescriptors, 'test-recipe')
      ).not.toThrow();
    });

    it('should throw error for unknown properties', () => {
      const bodyDescriptors = {
        build: 'athletic',
        unknownProp: 'value',
        anotherUnknown: 'test',
      };

      expect(() =>
        workflow.validateBodyDescriptors(bodyDescriptors, 'test-recipe')
      ).toThrow(ValidationError);
      expect(() =>
        workflow.validateBodyDescriptors(bodyDescriptors, 'test-recipe')
      ).toThrow(
        "Unknown body descriptor properties in recipe 'test-recipe': unknownProp, anotherUnknown"
      );
    });

    it('should validate all valid enum values for build', () => {
      const validBuilds = [
        'skinny',
        'slim',
        'lissom',
        'toned',
        'athletic',
        'shapely',
        'hourglass',
        'thick',
        'muscular',
        'hulking',
        'stocky',
      ];

      validBuilds.forEach((build) => {
        const bodyDescriptors = { build };
        expect(() =>
          workflow.validateBodyDescriptors(bodyDescriptors, 'test-recipe')
        ).not.toThrow();
      });
    });

    it('should validate all valid enum values for density', () => {
      const validDensities = [
        'hairless',
        'sparse',
        'light',
        'moderate',
        'hairy',
        'very-hairy',
      ];

      validDensities.forEach((hairDensity) => {
        const bodyDescriptors = { hairDensity };
        expect(() =>
          workflow.validateBodyDescriptors(bodyDescriptors, 'test-recipe')
        ).not.toThrow();
      });
    });

    it('should validate all valid enum values for composition', () => {
      const validCompositions = [
        'underweight',
        'lean',
        'average',
        'soft',
        'chubby',
        'overweight',
        'obese',
      ];

      validCompositions.forEach((composition) => {
        const bodyDescriptors = { composition };
        expect(() =>
          workflow.validateBodyDescriptors(bodyDescriptors, 'test-recipe')
        ).not.toThrow();
      });
    });

    it('should rethrow unexpected errors from the body descriptor validator', () => {
      const unexpectedError = new Error('Unexpected validator failure');
      const validatorSpy = jest
        .spyOn(BodyDescriptorValidator, 'validate')
        .mockImplementation(() => {
          throw unexpectedError;
        });

      expect(() =>
        workflow.validateBodyDescriptors({ build: 'athletic' }, 'test-recipe')
      ).toThrow(unexpectedError);

      validatorSpy.mockRestore();
    });
  });

  describe('validateRecipe with bodyDescriptors', () => {
    it('should validate recipe with valid body descriptors', () => {
      const recipeId = 'test-recipe';
      const blueprintId = 'test-blueprint';

      mockDataRegistry.get.mockReturnValue({
        blueprintId,
        bodyDescriptors: {
          build: 'athletic',
          composition: 'lean',
        },
      });

      const result = workflow.validateRecipe(recipeId);

      expect(result).toBe(blueprintId);
      expect(mockDataRegistry.get).toHaveBeenCalledWith(
        'anatomyRecipes',
        recipeId
      );
    });

    it('should throw error for recipe with invalid body descriptors', () => {
      const recipeId = 'test-recipe';

      mockDataRegistry.get.mockReturnValue({
        blueprintId: 'test-blueprint',
        bodyDescriptors: {
          build: 'invalid-build',
        },
      });

      expect(() => workflow.validateRecipe(recipeId)).toThrow(ValidationError);
      expect(() => workflow.validateRecipe(recipeId)).toThrow(
        "Invalid build descriptor: 'invalid-build' in recipe 'test-recipe'"
      );
    });

    it('should validate recipe without body descriptors', () => {
      const recipeId = 'test-recipe';
      const blueprintId = 'test-blueprint';

      mockDataRegistry.get.mockReturnValue({
        blueprintId,
        // No bodyDescriptors
      });

      const result = workflow.validateRecipe(recipeId);

      expect(result).toBe(blueprintId);
    });
  });

  describe('blueprint slot entity creation', () => {
    const blueprintId = 'test-blueprint';
    const recipeId = 'test-recipe';
    const ownerId = 'owner-entity';
    const rootId = 'root-entity';
    const partIds = ['arm-1', 'arm-2'];

    beforeEach(() => {
      // Setup default successful generation
      const graphResult = {
        rootId,
        entities: [rootId, ...partIds],
      };
      mockBodyBlueprintFactory.createAnatomyGraph.mockResolvedValue(
        graphResult
      );

      // Mock entities with names for parts map
      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === 'arm-1') {
          return {
            hasComponent: jest.fn(
              (compId) => compId === 'core:name' || compId === 'anatomy:part'
            ),
            getComponentData: jest.fn().mockReturnValue({ text: 'left_arm' }),
          };
        }
        if (id === 'arm-2') {
          return {
            hasComponent: jest.fn(
              (compId) => compId === 'core:name' || compId === 'anatomy:part'
            ),
            getComponentData: jest.fn().mockReturnValue({ text: 'right_arm' }),
          };
        }
        return {
          hasComponent: jest.fn().mockReturnValue(false),
        };
      });
    });

    describe('error handling in #createBlueprintSlotEntities', () => {
      it('should handle invalid entity return types from createEntityInstance', async () => {
        // Setup blueprint with slots
        const blueprint = {
          slots: {
            'main-hand': {
              socket: 'hand',
              requirements: {},
            },
          },
        };
        mockDataRegistry.get.mockImplementation((type, id) => {
          if (type === 'anatomyBlueprints' && id === blueprintId) {
            return blueprint;
          }
          return null;
        });

        // Mock createEntityInstance to return invalid type
        mockEntityManager.createEntityInstance.mockResolvedValue(42); // Invalid: number

        await expect(
          workflow.generate(blueprintId, recipeId, { ownerId })
        ).rejects.toThrow('Invalid entity returned for slot main-hand');

        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.stringContaining('Unexpected entity type returned')
        );
      });

      it('should handle null entity return from createEntityInstance', async () => {
        // Setup blueprint with slots
        const blueprint = {
          slots: {
            'main-hand': {
              socket: 'hand',
              requirements: {},
            },
          },
        };
        mockDataRegistry.get.mockImplementation((type, id) => {
          if (type === 'anatomyBlueprints' && id === blueprintId) {
            return blueprint;
          }
          return null;
        });

        // Mock createEntityInstance to return null
        mockEntityManager.createEntityInstance.mockResolvedValue(null);

        await expect(
          workflow.generate(blueprintId, recipeId, { ownerId })
        ).rejects.toThrow('Invalid entity returned for slot main-hand');

        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.stringContaining('Unexpected entity type returned')
        );
      });

      it('should handle entity object with invalid id property', async () => {
        // Setup blueprint with slots
        const blueprint = {
          slots: {
            'main-hand': {
              socket: 'hand',
              requirements: {},
            },
          },
        };
        mockDataRegistry.get.mockImplementation((type, id) => {
          if (type === 'anatomyBlueprints' && id === blueprintId) {
            return blueprint;
          }
          return null;
        });

        // Mock createEntityInstance to return object with invalid id
        mockEntityManager.createEntityInstance.mockResolvedValue({
          id: null, // Invalid: null id
        });

        await expect(
          workflow.generate(blueprintId, recipeId, { ownerId })
        ).rejects.toThrow('Invalid entity returned for slot main-hand');

        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.stringContaining('Unexpected entity type returned')
        );
      });

      it('should handle entity object with missing id property', async () => {
        // Setup blueprint with slots
        const blueprint = {
          slots: {
            'main-hand': {
              socket: 'hand',
              requirements: {},
            },
          },
        };
        mockDataRegistry.get.mockImplementation((type, id) => {
          if (type === 'anatomyBlueprints' && id === blueprintId) {
            return blueprint;
          }
          return null;
        });

        // Mock createEntityInstance to return object without id
        mockEntityManager.createEntityInstance.mockResolvedValue({
          someProperty: 'value',
          // No id property
        });

        await expect(
          workflow.generate(blueprintId, recipeId, { ownerId })
        ).rejects.toThrow('Invalid entity returned for slot main-hand');

        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.stringContaining('Unexpected entity type returned')
        );
      });

      it('should handle extracted entity ID validation failure', async () => {
        // Setup blueprint with slots
        const blueprint = {
          slots: {
            'main-hand': {
              socket: 'hand',
              requirements: {},
            },
          },
        };
        mockDataRegistry.get.mockImplementation((type, id) => {
          if (type === 'anatomyBlueprints' && id === blueprintId) {
            return blueprint;
          }
          return null;
        });

        // Mock createEntityInstance to return a string, but then mock the ID validation to fail
        // This will pass the first validation but fail the second validation
        mockEntityManager.createEntityInstance.mockResolvedValue(''); // Empty string - invalid ID

        await expect(
          workflow.generate(blueprintId, recipeId, { ownerId })
        ).rejects.toThrow('Invalid entity ID for slot main-hand');

        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.stringContaining('Invalid entity ID extracted')
        );
      });

      it('should handle component addition failures', async () => {
        // Setup blueprint with slots
        const blueprint = {
          slots: {
            'main-hand': {
              socket: 'hand',
              requirements: {},
            },
          },
        };
        mockDataRegistry.get.mockImplementation((type, id) => {
          if (type === 'anatomyBlueprints' && id === blueprintId) {
            return blueprint;
          }
          return null;
        });

        // Mock successful entity creation
        mockEntityManager.createEntityInstance.mockResolvedValue(
          'slot-entity-1'
        );

        // Mock component addition failure
        mockEntityManager.addComponent.mockImplementation(
          (entityId, compId) => {
            if (compId === 'anatomy:blueprintSlot') {
              throw new Error('Component addition failed');
            }
            return true;
          }
        );

        await expect(
          workflow.generate(blueprintId, recipeId, { ownerId })
        ).rejects.toThrow('Component addition failed');

        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.stringContaining('Failed to add component to slot entity'),
          expect.any(Error)
        );
      });

      it('should handle component verification failures', async () => {
        // Setup blueprint with slots
        const blueprint = {
          slots: {
            'main-hand': {
              socket: 'hand',
              requirements: {},
            },
          },
        };
        mockDataRegistry.get.mockImplementation((type, id) => {
          if (type === 'anatomyBlueprints' && id === blueprintId) {
            return blueprint;
          }
          return null;
        });

        // Mock successful entity creation
        mockEntityManager.createEntityInstance.mockResolvedValue(
          'slot-entity-1'
        );

        // Mock successful component addition
        mockEntityManager.addComponent.mockReturnValue(true);

        // Mock entity retrieval for verification failure
        mockEntityManager.getEntityInstance.mockImplementation((id) => {
          if (id === 'slot-entity-1') {
            return {
              hasComponent: jest.fn().mockReturnValue(false), // Verification fails
            };
          }
          // Return normal entities for other IDs
          if (id === 'arm-1') {
            return {
              hasComponent: jest.fn((compId) => compId === 'core:name'),
              getComponentData: jest.fn().mockReturnValue({ text: 'left_arm' }),
            };
          }
          if (id === 'arm-2') {
            return {
              hasComponent: jest.fn((compId) => compId === 'core:name'),
              getComponentData: jest
                .fn()
                .mockReturnValue({ text: 'right_arm' }),
            };
          }
          return {
            hasComponent: jest.fn().mockReturnValue(false),
          };
        });

        await expect(
          workflow.generate(blueprintId, recipeId, { ownerId })
        ).rejects.toThrow(
          'Component addition verification failed for slot main-hand'
        );

        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.stringContaining('Component verification failed')
        );
      });

      it('should handle entity creation failures', async () => {
        // Setup blueprint with slots
        const blueprint = {
          slots: {
            'main-hand': {
              socket: 'hand',
              requirements: {},
            },
          },
        };
        mockDataRegistry.get.mockImplementation((type, id) => {
          if (type === 'anatomyBlueprints' && id === blueprintId) {
            return blueprint;
          }
          return null;
        });

        // Mock entity creation failure
        mockEntityManager.createEntityInstance.mockRejectedValue(
          new Error('Entity creation failed')
        );

        await expect(
          workflow.generate(blueprintId, recipeId, { ownerId })
        ).rejects.toThrow('Entity creation failed');

        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.stringContaining('Failed to create blueprint slot entity'),
          expect.any(Error)
        );
      });

      it('should handle top-level error propagation', async () => {
        // Setup blueprint with slots
        const blueprint = {
          slots: {
            'main-hand': {
              socket: 'hand',
              requirements: {},
            },
          },
        };
        mockDataRegistry.get.mockImplementation((type, id) => {
          if (type === 'anatomyBlueprints' && id === blueprintId) {
            return blueprint;
          }
          return null;
        });

        // Mock any failure in the slot creation process
        mockEntityManager.createEntityInstance.mockRejectedValue(
          new Error('General slot creation error')
        );

        await expect(
          workflow.generate(blueprintId, recipeId, { ownerId })
        ).rejects.toThrow('General slot creation error');

        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.stringContaining('Failed to create blueprint slot entities'),
          expect.any(Error)
        );
      });
    });

    describe('edge cases for blueprint slot processing', () => {
      it('should handle blueprint with no slots', async () => {
        // Setup blueprint without slots
        const blueprint = {
          // No slots property
        };
        mockDataRegistry.get.mockImplementation((type, id) => {
          if (type === 'anatomyBlueprints' && id === blueprintId) {
            return blueprint;
          }
          return null;
        });

        const result = await workflow.generate(blueprintId, recipeId, {
          ownerId,
        });

        expect(result.rootId).toBe(rootId);
        expect(result.entities).toEqual([rootId, ...partIds]);
        expect(mockLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining('No blueprint slots found')
        );
      });

      it('should handle blueprint with empty slots object', async () => {
        // Setup blueprint with empty slots
        const blueprint = {
          slots: {},
        };
        mockDataRegistry.get.mockImplementation((type, id) => {
          if (type === 'anatomyBlueprints' && id === blueprintId) {
            return blueprint;
          }
          return null;
        });

        const result = await workflow.generate(blueprintId, recipeId, {
          ownerId,
        });

        expect(result.rootId).toBe(rootId);
        expect(result.entities).toEqual([rootId, ...partIds]);
        expect(mockLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining('Found 0 slots in blueprint')
        );
      });

      it('should handle null blueprint', async () => {
        // Setup null blueprint
        mockDataRegistry.get.mockImplementation((type, id) => {
          if (type === 'anatomyBlueprints' && id === blueprintId) {
            return null;
          }
          return null;
        });

        const result = await workflow.generate(blueprintId, recipeId, {
          ownerId,
        });

        expect(result.rootId).toBe(rootId);
        expect(result.entities).toEqual([rootId, ...partIds]);
        expect(mockLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining('No blueprint slots found')
        );
      });

      it('should successfully create blueprint slot entities', async () => {
        // Setup blueprint with slots
        const blueprint = {
          slots: {
            'main-hand': {
              socket: 'hand',
              requirements: { strength: 10 },
            },
            'off-hand': {
              socket: 'hand',
              requirements: { dexterity: 8 },
            },
          },
        };
        mockDataRegistry.get.mockImplementation((type, id) => {
          if (type === 'anatomyBlueprints' && id === blueprintId) {
            return blueprint;
          }
          return null;
        });

        // Mock successful entity creation
        let entityIdCounter = 0;
        mockEntityManager.createEntityInstance.mockImplementation(() => {
          entityIdCounter++;
          return Promise.resolve(`slot-entity-${entityIdCounter}`);
        });

        // Mock successful component addition
        mockEntityManager.addComponent.mockReturnValue(true);

        // Mock entity retrieval for verification
        mockEntityManager.getEntityInstance.mockImplementation((id) => {
          if (id.startsWith('slot-entity-')) {
            return {
              hasComponent: jest.fn().mockReturnValue(true),
              getComponentData: jest.fn().mockReturnValue({
                slotId: id === 'slot-entity-1' ? 'main-hand' : 'off-hand',
                socketId: 'hand',
                requirements:
                  id === 'slot-entity-1' ? { strength: 10 } : { dexterity: 8 },
              }),
            };
          }
          // Return normal entities for other IDs
          if (id === 'arm-1') {
            return {
              hasComponent: jest.fn((compId) => compId === 'core:name'),
              getComponentData: jest.fn().mockReturnValue({ text: 'left_arm' }),
            };
          }
          if (id === 'arm-2') {
            return {
              hasComponent: jest.fn((compId) => compId === 'core:name'),
              getComponentData: jest
                .fn()
                .mockReturnValue({ text: 'right_arm' }),
            };
          }
          return {
            hasComponent: jest.fn().mockReturnValue(false),
          };
        });

        const result = await workflow.generate(blueprintId, recipeId, {
          ownerId,
        });

        expect(result.rootId).toBe(rootId);
        expect(result.entities).toContain('slot-entity-1');
        expect(result.entities).toContain('slot-entity-2');
        expect(result.slotEntityMappings.get('main-hand')).toBe(
          'slot-entity-1'
        );
        expect(result.slotEntityMappings.get('off-hand')).toBe('slot-entity-2');

        expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
          'slot-entity-1',
          'anatomy:blueprintSlot',
          {
            slotId: 'main-hand',
            socketId: 'hand',
            requirements: { strength: 10 },
          }
        );

        expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
          'slot-entity-2',
          'anatomy:blueprintSlot',
          {
            slotId: 'off-hand',
            socketId: 'hand',
            requirements: { dexterity: 8 },
          }
        );
      });

      it('should handle entity creation returning entity object with valid id', async () => {
        // Setup blueprint with slots
        const blueprint = {
          slots: {
            'main-hand': {
              socket: 'hand',
              requirements: { strength: 10 },
            },
          },
        };
        mockDataRegistry.get.mockImplementation((type, id) => {
          if (type === 'anatomyBlueprints' && id === blueprintId) {
            return blueprint;
          }
          return null;
        });

        // Mock entity creation returning entity object with valid id
        mockEntityManager.createEntityInstance.mockResolvedValue({
          id: 'slot-entity-1',
          otherProperty: 'value',
        });

        // Mock successful component addition
        mockEntityManager.addComponent.mockReturnValue(true);

        // Mock entity retrieval for verification
        mockEntityManager.getEntityInstance.mockImplementation((id) => {
          if (id === 'slot-entity-1') {
            return {
              hasComponent: jest.fn().mockReturnValue(true),
              getComponentData: jest.fn().mockReturnValue({
                slotId: 'main-hand',
                socketId: 'hand',
                requirements: { strength: 10 },
              }),
            };
          }
          // Return normal entities for other IDs
          if (id === 'arm-1') {
            return {
              hasComponent: jest.fn((compId) => compId === 'core:name'),
              getComponentData: jest.fn().mockReturnValue({ text: 'left_arm' }),
            };
          }
          if (id === 'arm-2') {
            return {
              hasComponent: jest.fn((compId) => compId === 'core:name'),
              getComponentData: jest
                .fn()
                .mockReturnValue({ text: 'right_arm' }),
            };
          }
          return {
            hasComponent: jest.fn().mockReturnValue(false),
          };
        });

        const result = await workflow.generate(blueprintId, recipeId, {
          ownerId,
        });

        expect(result.rootId).toBe(rootId);
        expect(result.entities).toContain('slot-entity-1');
        expect(result.slotEntityMappings.get('main-hand')).toBe(
          'slot-entity-1'
        );

        expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
          'slot-entity-1',
          'anatomy:blueprintSlot',
          {
            slotId: 'main-hand',
            socketId: 'hand',
            requirements: { strength: 10 },
          }
        );
      });
    });
  });

  describe('without clothing instantiation service', () => {
    const blueprintId = 'test-blueprint';
    const recipeId = 'test-recipe';
    const ownerId = 'owner-entity';
    const rootId = 'root-entity';
    const partIds = ['arm-1', 'arm-2'];

    beforeEach(() => {
      // Create workflow without clothing instantiation service
      workflow = new AnatomyGenerationWorkflow({
        entityManager: mockEntityManager,
        dataRegistry: mockDataRegistry,
        logger: mockLogger,
        bodyBlueprintFactory: mockBodyBlueprintFactory,
        // No clothingInstantiationService
      });

      // Setup default successful generation
      const graphResult = {
        rootId,
        entities: [rootId, ...partIds],
      };
      mockBodyBlueprintFactory.createAnatomyGraph.mockResolvedValue(
        graphResult
      );

      // Mock entities with names for parts map
      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === 'arm-1') {
          return {
            hasComponent: jest.fn(
              (compId) => compId === 'core:name' || compId === 'anatomy:part'
            ),
            getComponentData: jest.fn().mockReturnValue({ text: 'left_arm' }),
          };
        }
        if (id === 'arm-2') {
          return {
            hasComponent: jest.fn(
              (compId) => compId === 'core:name' || compId === 'anatomy:part'
            ),
            getComponentData: jest.fn().mockReturnValue({ text: 'right_arm' }),
          };
        }
        return {
          hasComponent: jest.fn().mockReturnValue(false),
        };
      });
    });

    it('should skip clothing instantiation when service is not provided', async () => {
      const result = await workflow.generate(blueprintId, recipeId, {
        ownerId,
      });

      expect(result.rootId).toBe(rootId);
      expect(result.entities).toEqual([rootId, ...partIds]);
      expect(result.clothingResult).toBeUndefined();
    });
  });

  describe('#updateAnatomyBodyComponent', () => {
    const blueprintId = 'test-blueprint';
    const recipeId = 'test-recipe';
    const ownerId = 'owner-entity';
    const rootId = 'root-entity';
    const partIds = ['arm-1', 'arm-2'];

    beforeEach(() => {
      // Setup default successful generation
      const graphResult = {
        rootId,
        entities: [rootId, ...partIds],
      };
      mockBodyBlueprintFactory.createAnatomyGraph.mockResolvedValue(
        graphResult
      );

      // Mock entities with names for parts map
      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === 'arm-1') {
          return {
            hasComponent: jest.fn(
              (compId) => compId === 'core:name' || compId === 'anatomy:part'
            ),
            getComponentData: jest.fn().mockReturnValue({ text: 'left_arm' }),
          };
        }
        if (id === 'arm-2') {
          return {
            hasComponent: jest.fn(
              (compId) => compId === 'core:name' || compId === 'anatomy:part'
            ),
            getComponentData: jest.fn().mockReturnValue({ text: 'right_arm' }),
          };
        }
        return {
          hasComponent: jest.fn().mockReturnValue(false),
        };
      });
    });

    it('should update anatomy body component with new structure', async () => {
      mockEntityManager.getComponentData.mockReturnValue(null);

      const result = await workflow.generate(blueprintId, recipeId, {
        ownerId,
      });

      expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
        ownerId,
        'anatomy:body',
        expect.objectContaining({
          recipeId,
          body: expect.objectContaining({
            root: rootId,
            parts: {
              left_arm: 'arm-1',
              right_arm: 'arm-2',
            },
            slotToPartMappings: {},
          }),
        })
      );

      expect(result.rootId).toBe(rootId);
      expect(result.entities).toEqual([rootId, ...partIds]);
    });

    it('should preserve existing anatomy data when updating', async () => {
      const existingData = {
        someExistingField: 'preserved',
        oldRecipeId: 'old-recipe',
      };

      mockEntityManager.getComponentData.mockReturnValue(existingData);

      const result = await workflow.generate(blueprintId, recipeId, {
        ownerId,
      });

      expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
        ownerId,
        'anatomy:body',
        expect.objectContaining({
          someExistingField: 'preserved',
          oldRecipeId: 'old-recipe',
          recipeId,
          body: expect.objectContaining({
            root: rootId,
            parts: {
              left_arm: 'arm-1',
              right_arm: 'arm-2',
            },
            slotToPartMappings: {},
          }),
        })
      );

      expect(result.rootId).toBe(rootId);
      expect(result.entities).toEqual([rootId, ...partIds]);
    });

    it('should handle Map to object conversion for backward compatibility', async () => {
      mockEntityManager.getComponentData.mockReturnValue(null);

      const result = await workflow.generate(blueprintId, recipeId, {
        ownerId,
      });

      // Verify that the parts map is converted to a plain object
      const addComponentCall = mockEntityManager.addComponent.mock.calls.find(
        (call) => call[1] === 'anatomy:body'
      );
      expect(addComponentCall[2].body.parts).toEqual({
        left_arm: 'arm-1',
        right_arm: 'arm-2',
      });
      expect(addComponentCall[2].body.parts).not.toBeInstanceOf(Map);

      expect(result.rootId).toBe(rootId);
      expect(result.entities).toEqual([rootId, ...partIds]);
    });

    it('should handle non-Map parts object correctly', async () => {
      mockEntityManager.getComponentData.mockReturnValue(null);

      // Create a test workflow that overrides the private method through a test backdoor
      class TestWorkflow extends AnatomyGenerationWorkflow {
        // Override the updateAnatomyBodyComponent to use a plain object
        async updateAnatomyBodyComponent(entityId, recipeId, graphResult) {
          // Get existing anatomy data to preserve any additional fields
          const existingData =
            this.entityManager.getComponentData(entityId, 'anatomy:body') || {};

          // Use a plain object instead of Map
          const partsObject = {
            left_arm: 'arm-1',
            right_arm: 'arm-2',
          };

          const updatedData = {
            ...existingData,
            recipeId,
            body: {
              root: graphResult.rootId,
              parts: partsObject,
            },
          };

          this.entityManager.addComponent(
            entityId,
            'anatomy:body',
            updatedData
          );
        }

        get entityManager() {
          return this._entityManager;
        }

        set entityManager(value) {
          this._entityManager = value;
        }
      }

      const testWorkflow = new TestWorkflow({
        entityManager: mockEntityManager,
        dataRegistry: mockDataRegistry,
        logger: mockLogger,
        bodyBlueprintFactory: mockBodyBlueprintFactory,
        clothingInstantiationService: mockClothingInstantiationService,
      });

      testWorkflow.entityManager = mockEntityManager;

      const result = await testWorkflow.generate(blueprintId, recipeId, {
        ownerId,
      });

      // Verify that the parts object is used directly
      const addComponentCall = mockEntityManager.addComponent.mock.calls.find(
        (call) => call[1] === 'anatomy:body'
      );
      expect(addComponentCall[2].body.parts).toEqual({
        left_arm: 'arm-1',
        right_arm: 'arm-2',
      });
      expect(addComponentCall[2].body.parts).not.toBeInstanceOf(Map);

      expect(result.rootId).toBe(rootId);
      expect(result.entities).toEqual([rootId, ...partIds]);
    });
  });

  describe('#createClothingSlotMetadata functionality', () => {
    const blueprintId = 'test-blueprint';
    const recipeId = 'test-recipe';
    const ownerId = 'owner-entity';
    const rootId = 'root-entity';
    const partIds = ['arm-1', 'arm-2'];

    beforeEach(() => {
      // Setup default successful generation
      const graphResult = {
        rootId,
        entities: [rootId, ...partIds],
      };
      mockBodyBlueprintFactory.createAnatomyGraph.mockResolvedValue(
        graphResult
      );

      // Mock entities with names for parts map
      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === 'arm-1') {
          return {
            hasComponent: jest.fn(
              (compId) => compId === 'core:name' || compId === 'anatomy:part'
            ),
            getComponentData: jest.fn().mockReturnValue({ text: 'left_arm' }),
          };
        }
        if (id === 'arm-2') {
          return {
            hasComponent: jest.fn(
              (compId) => compId === 'core:name' || compId === 'anatomy:part'
            ),
            getComponentData: jest.fn().mockReturnValue({ text: 'right_arm' }),
          };
        }
        return {
          hasComponent: jest.fn().mockReturnValue(false),
        };
      });

      // Mock successful component addition by default
      mockEntityManager.addComponent.mockResolvedValue(true);
    });

    it('should create clothing slot metadata with valid clothing slot mappings', async () => {
      // Setup blueprint with clothing slot mappings
      const blueprint = {
        clothingSlotMappings: {
          'torso-slot': {
            anatomySockets: ['chest', 'back'],
            allowedLayers: ['base', 'outer'],
          },
          'head-slot': {
            anatomySockets: ['head'],
            allowedLayers: ['base'],
          },
        },
      };

      mockDataRegistry.get.mockImplementation((type, id) => {
        if (type === 'anatomyBlueprints' && id === blueprintId) {
          return blueprint;
        }
        return null;
      });

      await workflow.generate(blueprintId, recipeId, { ownerId });

      // Verify the clothing:slot_metadata component was created
      expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
        ownerId,
        'clothing:slot_metadata',
        {
          slotMappings: {
            'torso-slot': {
              coveredSockets: ['chest', 'back'],
              allowedLayers: ['base', 'outer'],
            },
            'head-slot': {
              coveredSockets: ['head'],
              allowedLayers: ['base'],
            },
          },
        }
      );

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          'Created clothing:slot_metadata component with 2 slot mappings'
        )
      );
    });

    it('should handle blueprint with clothing slot mappings but missing allowedLayers', async () => {
      // Setup blueprint with slot mapping missing allowedLayers
      const blueprint = {
        clothingSlotMappings: {
          'arm-slot': {
            anatomySockets: ['left_arm', 'right_arm'],
            // allowedLayers missing
          },
        },
      };

      mockDataRegistry.get.mockImplementation((type, id) => {
        if (type === 'anatomyBlueprints' && id === blueprintId) {
          return blueprint;
        }
        return null;
      });

      await workflow.generate(blueprintId, recipeId, { ownerId });

      // Verify the component was created with empty allowedLayers array
      expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
        ownerId,
        'clothing:slot_metadata',
        {
          slotMappings: {
            'arm-slot': {
              coveredSockets: ['left_arm', 'right_arm'],
              allowedLayers: [],
            },
          },
        }
      );
    });

    it('should skip slots without anatomySockets in clothing slot mappings', async () => {
      // Setup blueprint with mixed valid/invalid slot mappings
      const blueprint = {
        clothingSlotMappings: {
          'valid-slot': {
            anatomySockets: ['chest'],
            allowedLayers: ['base'],
          },
          'invalid-slot-no-anatomy': {
            allowedLayers: ['base'],
            // No anatomySockets
          },
          'invalid-slot-null-anatomy': {
            anatomySockets: null,
            allowedLayers: ['base'],
          },
        },
      };

      mockDataRegistry.get.mockImplementation((type, id) => {
        if (type === 'anatomyBlueprints' && id === blueprintId) {
          return blueprint;
        }
        return null;
      });

      await workflow.generate(blueprintId, recipeId, { ownerId });

      // Verify only the valid slot was included
      expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
        ownerId,
        'clothing:slot_metadata',
        {
          slotMappings: {
            'valid-slot': {
              coveredSockets: ['chest'],
              allowedLayers: ['base'],
            },
          },
        }
      );

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          'Created clothing:slot_metadata component with 1 slot mappings'
        )
      );
    });

    it('should skip slots with empty anatomySockets arrays', async () => {
      // Setup blueprint with empty anatomySockets
      const blueprint = {
        clothingSlotMappings: {
          'empty-slot': {
            anatomySockets: [],
            allowedLayers: ['base'],
          },
          'valid-slot': {
            anatomySockets: ['head'],
            allowedLayers: ['base'],
          },
        },
      };

      mockDataRegistry.get.mockImplementation((type, id) => {
        if (type === 'anatomyBlueprints' && id === blueprintId) {
          return blueprint;
        }
        return null;
      });

      await workflow.generate(blueprintId, recipeId, { ownerId });

      // Verify only the slot with non-empty anatomySockets was included
      expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
        ownerId,
        'clothing:slot_metadata',
        {
          slotMappings: {
            'valid-slot': {
              coveredSockets: ['head'],
              allowedLayers: ['base'],
            },
          },
        }
      );
    });

    it('should not create component when no valid slot mappings exist', async () => {
      // Setup blueprint with only invalid slot mappings
      const blueprint = {
        clothingSlotMappings: {
          'invalid-slot-1': {
            allowedLayers: ['base'],
            // No anatomySockets
          },
          'invalid-slot-2': {
            anatomySockets: [],
            allowedLayers: ['base'],
          },
        },
      };

      mockDataRegistry.get.mockImplementation((type, id) => {
        if (type === 'anatomyBlueprints' && id === blueprintId) {
          return blueprint;
        }
        return null;
      });

      await workflow.generate(blueprintId, recipeId, { ownerId });

      // Verify no clothing:slot_metadata component was created
      expect(mockEntityManager.addComponent).not.toHaveBeenCalledWith(
        ownerId,
        'clothing:slot_metadata',
        expect.anything()
      );
    });

    it('should handle error during clothing slot metadata creation gracefully', async () => {
      // Setup blueprint with valid clothing slot mappings
      const blueprint = {
        clothingSlotMappings: {
          'torso-slot': {
            anatomySockets: ['chest'],
            allowedLayers: ['base'],
          },
        },
      };

      mockDataRegistry.get.mockImplementation((type, id) => {
        if (type === 'anatomyBlueprints' && id === blueprintId) {
          return blueprint;
        }
        return null;
      });

      // Mock addComponent to throw error for clothing:slot_metadata
      mockEntityManager.addComponent.mockImplementation(
        (entityId, componentId) => {
          if (componentId === 'clothing:slot_metadata') {
            throw new Error('Failed to add metadata component');
          }
          return true;
        }
      );

      // Should not throw - error should be handled gracefully
      const result = await workflow.generate(blueprintId, recipeId, {
        ownerId,
      });

      expect(result.rootId).toBe(rootId);
      expect(result.entities).toEqual([rootId, ...partIds]);

      // Verify error was logged
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to create clothing slot metadata'),
        expect.any(Error)
      );
    });

    it('should handle blueprint without clothingSlotMappings', async () => {
      // Setup blueprint without clothingSlotMappings
      const blueprint = {
        // No clothingSlotMappings property
        slots: {},
      };

      mockDataRegistry.get.mockImplementation((type, id) => {
        if (type === 'anatomyBlueprints' && id === blueprintId) {
          return blueprint;
        }
        return null;
      });

      await workflow.generate(blueprintId, recipeId, { ownerId });

      // Verify no clothing:slot_metadata component was created
      expect(mockEntityManager.addComponent).not.toHaveBeenCalledWith(
        ownerId,
        'clothing:slot_metadata',
        expect.anything()
      );

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('No clothing slot mappings found')
      );
    });

    it('should handle null blueprint', async () => {
      // Setup null blueprint
      mockDataRegistry.get.mockImplementation((type, id) => {
        if (type === 'anatomyBlueprints' && id === blueprintId) {
          return null;
        }
        return null;
      });

      await workflow.generate(blueprintId, recipeId, { ownerId });

      // Verify no clothing:slot_metadata component was created
      expect(mockEntityManager.addComponent).not.toHaveBeenCalledWith(
        ownerId,
        'clothing:slot_metadata',
        expect.anything()
      );

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('No clothing slot mappings found')
      );
    });

    it('should preserve anatomySockets array content correctly', async () => {
      // Setup blueprint with specific socket names to verify array copying
      const blueprint = {
        clothingSlotMappings: {
          'complex-slot': {
            anatomySockets: ['socket1', 'socket2', 'socket3'],
            allowedLayers: ['layer1', 'layer2'],
          },
        },
      };

      mockDataRegistry.get.mockImplementation((type, id) => {
        if (type === 'anatomyBlueprints' && id === blueprintId) {
          return blueprint;
        }
        return null;
      });

      await workflow.generate(blueprintId, recipeId, { ownerId });

      // Verify the array was copied correctly (not reference)
      const addComponentCall = mockEntityManager.addComponent.mock.calls.find(
        (call) => call[1] === 'clothing:slot_metadata'
      );

      expect(
        addComponentCall[2].slotMappings['complex-slot'].coveredSockets
      ).toEqual(['socket1', 'socket2', 'socket3']);
      expect(
        addComponentCall[2].slotMappings['complex-slot'].allowedLayers
      ).toEqual(['layer1', 'layer2']);

      // Verify it's a new array (spread operator used)
      expect(
        addComponentCall[2].slotMappings['complex-slot'].coveredSockets
      ).not.toBe(blueprint.clothingSlotMappings['complex-slot'].anatomySockets);
    });
  });

  describe('#buildSlotEntityMappings edge cases', () => {
    const blueprintId = 'test-blueprint';
    const recipeId = 'test-recipe';
    const ownerId = 'owner-entity';
    const rootId = 'root-entity';
    const partIds = ['arm-1', 'arm-2'];

    beforeEach(() => {
      // Setup default successful generation
      const graphResult = {
        rootId,
        entities: [rootId, ...partIds, 'slot-entity-1'],
      };
      mockBodyBlueprintFactory.createAnatomyGraph.mockResolvedValue(
        graphResult
      );

      // Mock entities with names for parts map
      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === 'arm-1') {
          return {
            hasComponent: jest.fn(
              (compId) => compId === 'core:name' || compId === 'anatomy:part'
            ),
            getComponentData: jest.fn().mockReturnValue({ text: 'left_arm' }),
          };
        }
        if (id === 'arm-2') {
          return {
            hasComponent: jest.fn(
              (compId) => compId === 'core:name' || compId === 'anatomy:part'
            ),
            getComponentData: jest.fn().mockReturnValue({ text: 'right_arm' }),
          };
        }
        return {
          hasComponent: jest.fn().mockReturnValue(false),
        };
      });
    });

    it('should handle entities without blueprint slot components', async () => {
      const result = await workflow.generate(blueprintId, recipeId, {
        ownerId,
      });

      expect(result.slotEntityMappings.size).toBe(0);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('has anatomy:blueprintSlot component: false')
      );
    });

    it('should handle entities with invalid slot component data', async () => {
      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === 'slot-entity-1') {
          return {
            hasComponent: jest.fn(
              (compId) => compId === 'anatomy:blueprintSlot'
            ),
            getComponentData: jest.fn().mockReturnValue(null), // Invalid data
          };
        }
        if (id === 'arm-1') {
          return {
            hasComponent: jest.fn((compId) => compId === 'core:name'),
            getComponentData: jest.fn().mockReturnValue({ text: 'left_arm' }),
          };
        }
        if (id === 'arm-2') {
          return {
            hasComponent: jest.fn((compId) => compId === 'core:name'),
            getComponentData: jest.fn().mockReturnValue({ text: 'right_arm' }),
          };
        }
        return {
          hasComponent: jest.fn().mockReturnValue(false),
        };
      });

      const result = await workflow.generate(blueprintId, recipeId, {
        ownerId,
      });

      expect(result.slotEntityMappings.size).toBe(0);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Component data missing or invalid')
      );
    });

    it('should handle entities with missing slot IDs in components', async () => {
      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === 'slot-entity-1') {
          return {
            hasComponent: jest.fn(
              (compId) => compId === 'anatomy:blueprintSlot'
            ),
            getComponentData: jest.fn().mockReturnValue({
              socketId: 'hand',
              requirements: {},
              // Missing slotId
            }),
          };
        }
        if (id === 'arm-1') {
          return {
            hasComponent: jest.fn((compId) => compId === 'core:name'),
            getComponentData: jest.fn().mockReturnValue({ text: 'left_arm' }),
          };
        }
        if (id === 'arm-2') {
          return {
            hasComponent: jest.fn((compId) => compId === 'core:name'),
            getComponentData: jest.fn().mockReturnValue({ text: 'right_arm' }),
          };
        }
        return {
          hasComponent: jest.fn().mockReturnValue(false),
        };
      });

      const result = await workflow.generate(blueprintId, recipeId, {
        ownerId,
      });

      expect(result.slotEntityMappings.size).toBe(0);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Component data missing or invalid')
      );
    });

    it('should handle entities that cannot be retrieved', async () => {
      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === 'slot-entity-1') {
          return null; // Entity not found
        }
        if (id === 'arm-1') {
          return {
            hasComponent: jest.fn((compId) => compId === 'core:name'),
            getComponentData: jest.fn().mockReturnValue({ text: 'left_arm' }),
          };
        }
        if (id === 'arm-2') {
          return {
            hasComponent: jest.fn((compId) => compId === 'core:name'),
            getComponentData: jest.fn().mockReturnValue({ text: 'right_arm' }),
          };
        }
        return {
          hasComponent: jest.fn().mockReturnValue(false),
        };
      });

      const result = await workflow.generate(blueprintId, recipeId, {
        ownerId,
      });

      expect(result.slotEntityMappings.size).toBe(0);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Could not retrieve entity instance')
      );
    });

    it('should successfully build slot entity mappings', async () => {
      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === 'slot-entity-1') {
          return {
            hasComponent: jest.fn(
              (compId) => compId === 'anatomy:blueprintSlot'
            ),
            getComponentData: jest.fn().mockReturnValue({
              slotId: 'main-hand',
              socketId: 'hand',
              requirements: { strength: 10 },
            }),
          };
        }
        if (id === 'arm-1') {
          return {
            hasComponent: jest.fn((compId) => compId === 'core:name'),
            getComponentData: jest.fn().mockReturnValue({ text: 'left_arm' }),
          };
        }
        if (id === 'arm-2') {
          return {
            hasComponent: jest.fn((compId) => compId === 'core:name'),
            getComponentData: jest.fn().mockReturnValue({ text: 'right_arm' }),
          };
        }
        return {
          hasComponent: jest.fn().mockReturnValue(false),
        };
      });

      const result = await workflow.generate(blueprintId, recipeId, {
        ownerId,
      });

      expect(result.slotEntityMappings.size).toBe(1);
      expect(result.slotEntityMappings.get('main-hand')).toBe('slot-entity-1');
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          "Successfully mapped slot 'main-hand' to entity 'slot-entity-1'"
        )
      );
    });
  });
});
