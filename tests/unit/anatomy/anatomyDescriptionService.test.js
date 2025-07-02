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

    // Create service instance
    service = new AnatomyDescriptionService({
      bodyPartDescriptionBuilder: mockBodyPartDescriptionBuilder,
      bodyDescriptionComposer: mockBodyDescriptionComposer,
      bodyGraphService: mockBodyGraphService,
      entityFinder: mockEntityFinder,
      componentManager: mockComponentManager,
    });
  });

  describe('generateAllDescriptions', () => {
    it('should generate descriptions for all body parts and the body itself', () => {
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
      mockBodyDescriptionComposer.composeDescription.mockReturnValue(
        'A complete body description.'
      );

      // Act
      service.generateAllDescriptions(bodyEntity);

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

    it('should throw error if entity has no anatomy:body component', () => {
      const invalidEntity = createMockEntity('invalid-1', {});

      expect(() => service.generateAllDescriptions(invalidEntity)).toThrow(
        'Entity must have an anatomy:body component'
      );
    });

    it('should throw error if body component has no body.root property', () => {
      const invalidEntity = createMockEntity('body-1', {
        [ANATOMY_BODY_COMPONENT_ID]: {},
      });

      expect(() => service.generateAllDescriptions(invalidEntity)).toThrow(
        'Body component must have a body.root property'
      );
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
    it('should return null for null entity', () => {
      const result = service.getOrGenerateBodyDescription(null);
      expect(result).toBeNull();
    });

    it('should return existing description for non-anatomy entity', () => {
      const entity = createMockEntity('npc-1', {
        [DESCRIPTION_COMPONENT_ID]: { text: 'A regular NPC' },
      });

      const result = service.getOrGenerateBodyDescription(entity);
      expect(result).toBe('A regular NPC');
    });

    it('should generate description for anatomy entity without description', () => {
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

      const result = service.getOrGenerateBodyDescription(bodyEntity);

      expect(
        mockBodyDescriptionComposer.composeDescription
      ).toHaveBeenCalledWith(bodyEntity);
      expect(mockComponentManager.addComponent).toHaveBeenCalled();
      expect(result).toBe('Generated body description');
    });
  });
});
