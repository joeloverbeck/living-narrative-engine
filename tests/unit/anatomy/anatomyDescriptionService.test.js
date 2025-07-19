import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { AnatomyDescriptionService } from '../../../src/anatomy/anatomyDescriptionService.js';
import {
  ANATOMY_BODY_COMPONENT_ID,
  ANATOMY_PART_COMPONENT_ID,
  DESCRIPTION_COMPONENT_ID,
} from '../../../src/constants/componentIds.js';

describe('AnatomyDescriptionService', () => {
  let service;
  let mockBodyPartDescriptionBuilder;
  let mockBodyDescriptionComposer;
  let mockBodyGraphService;
  let mockEntityFinder;
  let mockComponentManager;
  let mockEventDispatchService;

  // Helper function to create mock entities with the correct interface
  const createMockEntity = (id, components) => {
    return {
      id,
      hasComponent: jest.fn((componentId) => !!components[componentId]),
      getComponentData: jest.fn((componentId) => components[componentId]),
    };
  };

  beforeEach(() => {
    // Create mocks
    mockBodyPartDescriptionBuilder = {
      buildDescription: jest.fn(),
    };

    mockBodyDescriptionComposer = {
      composeDescription: jest.fn(),
    };

    mockBodyGraphService = {
      getAllParts: jest.fn(),
    };

    mockEntityFinder = {
      getEntityInstance: jest.fn(),
    };

    mockComponentManager = {
      addComponent: jest.fn(),
      updateComponent: jest.fn(),
    };

    mockEventDispatchService = {
      safeDispatchEvent: jest.fn(),
    };

    // Create service instance
    service = new AnatomyDescriptionService({
      bodyPartDescriptionBuilder: mockBodyPartDescriptionBuilder,
      bodyDescriptionComposer: mockBodyDescriptionComposer,
      bodyGraphService: mockBodyGraphService,
      entityFinder: mockEntityFinder,
      componentManager: mockComponentManager,
      eventDispatchService: mockEventDispatchService,
    });
  });

  describe('generateAllDescriptions', () => {
    it('should generate descriptions for all body parts and the body itself', async () => {
      // Arrange
      const bodyEntity = createMockEntity('body-1', {
        [ANATOMY_BODY_COMPONENT_ID]: {
          body: {
            root: 'torso-1',
          },
        },
      });

      const partIds = ['torso-1', 'head-1', 'arm-1', 'arm-2'];
      mockBodyGraphService.getAllParts.mockReturnValue(partIds);

      const mockParts = {
        'torso-1': createMockEntity('torso-1', {
          [ANATOMY_PART_COMPONENT_ID]: { subType: 'torso' },
        }),
        'head-1': createMockEntity('head-1', {
          [ANATOMY_PART_COMPONENT_ID]: { subType: 'head' },
        }),
        'arm-1': createMockEntity('arm-1', {
          [ANATOMY_PART_COMPONENT_ID]: { subType: 'arm' },
        }),
        'arm-2': createMockEntity('arm-2', {
          [ANATOMY_PART_COMPONENT_ID]: { subType: 'arm' },
        }),
      };

      mockEntityFinder.getEntityInstance.mockImplementation(
        (id) => mockParts[id] || bodyEntity
      );
      mockBodyPartDescriptionBuilder.buildDescription.mockReturnValue(
        'a body part'
      );
      mockBodyDescriptionComposer.composeDescription.mockResolvedValue(
        'A complete body description.'
      );

      // Act
      await service.generateAllDescriptions(bodyEntity);

      // Assert
      expect(mockBodyGraphService.getAllParts).toHaveBeenCalledWith({
        root: 'torso-1',
      });
      expect(bodyEntity.getComponentData).toHaveBeenCalledWith(
        ANATOMY_BODY_COMPONENT_ID
      );

      // Verify descriptions were generated for each part
      expect(
        mockBodyPartDescriptionBuilder.buildDescription
      ).toHaveBeenCalledTimes(4);

      // Each part gets a description added (4), plus the body gets a description (1) = 5 total
      expect(mockComponentManager.addComponent).toHaveBeenCalledTimes(5);

      // Verify body description was composed
      expect(
        mockBodyDescriptionComposer.composeDescription
      ).toHaveBeenCalledWith(bodyEntity);
    });

    it('should create description component even when body description is empty', async () => {
      // Arrange
      const bodyEntity = createMockEntity('body-1', {
        [ANATOMY_BODY_COMPONENT_ID]: {
          body: {
            root: 'torso-1',
          },
        },
      });

      const partIds = ['torso-1'];
      mockBodyGraphService.getAllParts.mockReturnValue(partIds);

      mockEntityFinder.getEntityInstance.mockReturnValue(
        createMockEntity('torso-1', {
          [ANATOMY_PART_COMPONENT_ID]: { subType: 'torso' },
        })
      );
      mockBodyPartDescriptionBuilder.buildDescription.mockReturnValue('');
      mockBodyDescriptionComposer.composeDescription.mockResolvedValue('');

      // Act
      await service.generateAllDescriptions(bodyEntity);

      // Assert
      // Verify body description was composed even though it's empty
      expect(
        mockBodyDescriptionComposer.composeDescription
      ).toHaveBeenCalledWith(bodyEntity);

      // Verify the empty description was still added to the entity
      expect(mockComponentManager.addComponent).toHaveBeenCalledWith(
        'body-1',
        DESCRIPTION_COMPONENT_ID,
        { text: '' }
      );
    });

    it('should throw error if entity has no anatomy:body component', async () => {
      const invalidEntity = createMockEntity('invalid-1', {});

      await expect(
        service.generateAllDescriptions(invalidEntity)
      ).rejects.toThrow('Entity must have an anatomy:body component');
    });

    it('should throw error if body component has no body.root property', async () => {
      const invalidEntity = createMockEntity('body-1', {
        [ANATOMY_BODY_COMPONENT_ID]: {},
      });

      await expect(
        service.generateAllDescriptions(invalidEntity)
      ).rejects.toThrow('Body component must have a body.root property');
    });
  });

  describe('generatePartDescription', () => {
    it('should generate and store description for a body part', () => {
      // Arrange
      const partEntity = createMockEntity('arm-1', {
        [ANATOMY_PART_COMPONENT_ID]: { subType: 'arm' },
        'descriptors:length_category': { length: 'long' },
      });

      mockEntityFinder.getEntityInstance.mockReturnValue(partEntity);
      mockBodyPartDescriptionBuilder.buildDescription.mockReturnValue(
        'a long arm'
      );

      // Act
      service.generatePartDescription('arm-1');

      // Assert
      expect(
        mockBodyPartDescriptionBuilder.buildDescription
      ).toHaveBeenCalledWith(partEntity);
      expect(mockComponentManager.addComponent).toHaveBeenCalledWith(
        'arm-1',
        DESCRIPTION_COMPONENT_ID,
        { text: 'a long arm' }
      );
    });

    it('should not generate description for non-anatomy parts', () => {
      const nonPartEntity = createMockEntity('item-1', {});

      mockEntityFinder.getEntityInstance.mockReturnValue(nonPartEntity);

      service.generatePartDescription('item-1');

      expect(
        mockBodyPartDescriptionBuilder.buildDescription
      ).not.toHaveBeenCalled();
      expect(mockComponentManager.addComponent).not.toHaveBeenCalled();
    });
  });

  describe('updateDescription', () => {
    it('should update existing description component', () => {
      const entity = createMockEntity('entity-1', {
        [DESCRIPTION_COMPONENT_ID]: { text: 'old description' },
      });

      mockEntityFinder.getEntityInstance.mockReturnValue(entity);

      service.updateDescription('entity-1', 'new description');

      expect(mockComponentManager.addComponent).toHaveBeenCalledWith(
        'entity-1',
        DESCRIPTION_COMPONENT_ID,
        { text: 'new description' }
      );
    });

    it('should add description component if not exists', () => {
      const entity = createMockEntity('entity-1', {});

      mockEntityFinder.getEntityInstance.mockReturnValue(entity);

      service.updateDescription('entity-1', 'new description');

      expect(mockComponentManager.addComponent).toHaveBeenCalledWith(
        'entity-1',
        DESCRIPTION_COMPONENT_ID,
        { text: 'new description' }
      );
    });
  });

  describe('getOrGenerateBodyDescription', () => {
    it('should return null for null entity', async () => {
      const result = await service.getOrGenerateBodyDescription(null);
      expect(result).toBeNull();
    });

    it('should return existing description for non-anatomy entity', async () => {
      const entity = createMockEntity('npc-1', {
        [DESCRIPTION_COMPONENT_ID]: { text: 'A regular NPC' },
      });

      const result = await service.getOrGenerateBodyDescription(entity);
      expect(result).toBe('A regular NPC');
    });

    it('should generate description for anatomy entity without description', async () => {
      const bodyEntity = createMockEntity('body-1', {
        [ANATOMY_BODY_COMPONENT_ID]: {
          body: {
            root: 'torso-1',
          },
        },
      });

      mockBodyGraphService.getAllParts.mockReturnValue(['torso-1']);
      mockEntityFinder.getEntityInstance.mockReturnValue(
        createMockEntity('torso-1', {
          [ANATOMY_PART_COMPONENT_ID]: { subType: 'torso' },
        })
      );
      mockBodyDescriptionComposer.composeDescription.mockReturnValue(
        'Generated body description'
      );

      const result = await service.getOrGenerateBodyDescription(bodyEntity);

      expect(
        mockBodyDescriptionComposer.composeDescription
      ).toHaveBeenCalledWith(bodyEntity);
      expect(mockComponentManager.addComponent).toHaveBeenCalled();
      expect(result).toBe('Generated body description');
    });
  });

  describe('generateBodyDescription', () => {
    it('should dispatch error event when description is empty', async () => {
      // Arrange
      const bodyEntity = createMockEntity('body-1', {
        [ANATOMY_BODY_COMPONENT_ID]: {
          recipeId: 'anatomy:human_male',
          body: { root: 'torso-1' },
        },
        'core:name': { text: 'Joel Overberus' },
      });

      // Mock composer to return empty string
      mockBodyDescriptionComposer.composeDescription.mockResolvedValue('');
      // Mock entityFinder to return the entity when updateDescription is called
      mockEntityFinder.getEntityInstance.mockReturnValue(bodyEntity);

      // Act
      await service.generateBodyDescription(bodyEntity);

      // Assert
      expect(mockEventDispatchService.safeDispatchEvent).toHaveBeenCalledWith(
        'core:system_error_occurred',
        expect.objectContaining({
          message:
            'Failed to generate body description for entity "Joel Overberus": Description is empty',
          details: expect.objectContaining({
            raw: 'Entity ID: body-1, Recipe ID: anatomy:human_male',
            timestamp: expect.any(String),
          }),
        })
      );

      // Also verify that updateDescription was still called with empty string
      expect(mockComponentManager.addComponent).toHaveBeenCalledWith(
        'body-1',
        DESCRIPTION_COMPONENT_ID,
        { text: '' }
      );
    });

    it('should not dispatch error when description is not empty', async () => {
      // Arrange
      const bodyEntity = createMockEntity('body-1', {
        [ANATOMY_BODY_COMPONENT_ID]: {
          body: { root: 'torso-1' },
        },
      });

      // Mock composer to return valid description
      mockBodyDescriptionComposer.composeDescription.mockResolvedValue(
        'Valid description'
      );
      // Mock entityFinder to return the entity when updateDescription is called
      mockEntityFinder.getEntityInstance.mockReturnValue(bodyEntity);

      // Act
      await service.generateBodyDescription(bodyEntity);

      // Assert
      expect(mockEventDispatchService.safeDispatchEvent).not.toHaveBeenCalled();
      expect(mockComponentManager.addComponent).toHaveBeenCalledWith(
        'body-1',
        DESCRIPTION_COMPONENT_ID,
        { text: 'Valid description' }
      );
    });

    it('should handle missing eventDispatchService gracefully', async () => {
      // Create service without eventDispatchService
      const serviceWithoutDispatcher = new AnatomyDescriptionService({
        bodyPartDescriptionBuilder: mockBodyPartDescriptionBuilder,
        bodyDescriptionComposer: mockBodyDescriptionComposer,
        bodyGraphService: mockBodyGraphService,
        entityFinder: mockEntityFinder,
        componentManager: mockComponentManager,
        eventDispatchService: null,
      });

      const bodyEntity = createMockEntity('body-1', {
        [ANATOMY_BODY_COMPONENT_ID]: {
          body: { root: 'torso-1' },
        },
      });

      mockBodyDescriptionComposer.composeDescription.mockResolvedValue('');
      // Mock entityFinder to return the entity when updateDescription is called
      mockEntityFinder.getEntityInstance.mockReturnValue(bodyEntity);

      // Should not throw error
      await expect(async () => {
        await serviceWithoutDispatcher.generateBodyDescription(bodyEntity);
      }).resolves.not.toThrow();

      expect(mockComponentManager.addComponent).toHaveBeenCalled();
    });
  });
});
