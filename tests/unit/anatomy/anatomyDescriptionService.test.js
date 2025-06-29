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
      getEntity: jest.fn(),
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
      const bodyEntity = {
        id: 'body-1',
        components: {
          [ANATOMY_BODY_COMPONENT_ID]: {
            rootPartId: 'torso-1',
          },
        },
      };

      const partIds = ['torso-1', 'head-1', 'arm-1', 'arm-2'];
      mockBodyGraphService.getAllParts.mockReturnValue(partIds);

      const mockParts = {
        'torso-1': {
          id: 'torso-1',
          components: {
            [ANATOMY_PART_COMPONENT_ID]: { subType: 'torso' },
          },
        },
        'head-1': {
          id: 'head-1',
          components: {
            [ANATOMY_PART_COMPONENT_ID]: { subType: 'head' },
          },
        },
        'arm-1': {
          id: 'arm-1',
          components: {
            [ANATOMY_PART_COMPONENT_ID]: { subType: 'arm' },
          },
        },
        'arm-2': {
          id: 'arm-2',
          components: {
            [ANATOMY_PART_COMPONENT_ID]: { subType: 'arm' },
          },
        },
      };

      mockEntityFinder.getEntity.mockImplementation(
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
        rootPartId: 'torso-1',
      });

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
      const invalidEntity = {
        id: 'invalid-1',
        components: {},
      };

      expect(() => service.generateAllDescriptions(invalidEntity)).toThrow(
        'Entity must have an anatomy:body component'
      );
    });

    it('should throw error if body component has no rootPartId', () => {
      const invalidEntity = {
        id: 'body-1',
        components: {
          [ANATOMY_BODY_COMPONENT_ID]: {},
        },
      };

      expect(() => service.generateAllDescriptions(invalidEntity)).toThrow(
        'Body component must have a rootPartId'
      );
    });
  });

  describe('generatePartDescription', () => {
    it('should generate and store description for a body part', () => {
      // Arrange
      const partEntity = {
        id: 'arm-1',
        components: {
          [ANATOMY_PART_COMPONENT_ID]: { subType: 'arm' },
          'descriptors:length_category': { length: 'long' },
        },
      };

      mockEntityFinder.getEntity.mockReturnValue(partEntity);
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
      const nonPartEntity = {
        id: 'item-1',
        components: {},
      };

      mockEntityFinder.getEntity.mockReturnValue(nonPartEntity);

      service.generatePartDescription('item-1');

      expect(
        mockBodyPartDescriptionBuilder.buildDescription
      ).not.toHaveBeenCalled();
      expect(mockComponentManager.addComponent).not.toHaveBeenCalled();
    });
  });

  describe('updateDescription', () => {
    it('should update existing description component', () => {
      const entity = {
        id: 'entity-1',
        components: {
          [DESCRIPTION_COMPONENT_ID]: { text: 'old description' },
        },
      };

      mockEntityFinder.getEntity.mockReturnValue(entity);

      service.updateDescription('entity-1', 'new description');

      expect(mockComponentManager.updateComponent).toHaveBeenCalledWith(
        'entity-1',
        DESCRIPTION_COMPONENT_ID,
        { text: 'new description' }
      );
    });

    it('should add description component if not exists', () => {
      const entity = {
        id: 'entity-1',
        components: {},
      };

      mockEntityFinder.getEntity.mockReturnValue(entity);

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
      const entity = {
        id: 'npc-1',
        components: {
          [DESCRIPTION_COMPONENT_ID]: { text: 'A regular NPC' },
        },
      };

      const result = service.getOrGenerateBodyDescription(entity);
      expect(result).toBe('A regular NPC');
    });

    it('should generate description for anatomy entity without description', () => {
      const bodyEntity = {
        id: 'body-1',
        components: {
          [ANATOMY_BODY_COMPONENT_ID]: {
            rootPartId: 'torso-1',
          },
        },
      };

      mockBodyGraphService.getAllParts.mockReturnValue(['torso-1']);
      mockEntityFinder.getEntity.mockReturnValue({
        id: 'torso-1',
        components: { [ANATOMY_PART_COMPONENT_ID]: { subType: 'torso' } },
      });
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
