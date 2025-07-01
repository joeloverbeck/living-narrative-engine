import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { AnatomyDescriptionService } from '../../../src/anatomy/anatomyDescriptionService.js';
import {
  ANATOMY_BODY_COMPONENT_ID,
  ANATOMY_PART_COMPONENT_ID,
  DESCRIPTION_COMPONENT_ID,
} from '../../../src/constants/componentIds.js';

describe('AnatomyDescriptionService - EntityFinder method calls', () => {
  let service;
  let mockEntityFinder;
  let mockBodyPartDescriptionBuilder;
  let mockBodyDescriptionComposer;
  let mockBodyGraphService;
  let mockComponentManager;

  beforeEach(() => {
    // Create mocks
    mockEntityFinder = {
      getEntityInstance: jest.fn(),
    };

    mockBodyPartDescriptionBuilder = {
      buildDescription: jest.fn(),
    };

    mockBodyDescriptionComposer = {
      composeDescription: jest.fn(),
    };

    mockBodyGraphService = {
      getAllParts: jest.fn(),
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

  describe('generatePartDescription', () => {
    it('should call entityFinder.getEntityInstance with the correct partId', () => {
      const partId = 'test-part-id';
      const mockEntity = {
        id: partId,
        hasComponent: jest.fn().mockReturnValue(true),
        getComponentData: jest.fn().mockReturnValue({ type: 'arm' }),
      };

      mockEntityFinder.getEntityInstance.mockReturnValue(mockEntity);
      mockBodyPartDescriptionBuilder.buildDescription.mockReturnValue('Test description');

      service.generatePartDescription(partId);

      expect(mockEntityFinder.getEntityInstance).toHaveBeenCalledWith(partId);
      // Note: getEntityInstance is called twice - once in generatePartDescription and once in updateDescription
      expect(mockEntityFinder.getEntityInstance).toHaveBeenCalledTimes(2);
    });

    it('should handle null entity gracefully', () => {
      const partId = 'non-existent-part';
      mockEntityFinder.getEntityInstance.mockReturnValue(null);

      // Should not throw
      expect(() => service.generatePartDescription(partId)).not.toThrow();
      
      expect(mockEntityFinder.getEntityInstance).toHaveBeenCalledWith(partId);
      expect(mockBodyPartDescriptionBuilder.buildDescription).not.toHaveBeenCalled();
    });
  });

  describe('updateDescription', () => {
    it('should call entityFinder.getEntityInstance with the correct entityId', () => {
      const entityId = 'test-entity-id';
      const description = 'New description';
      const mockEntity = {
        id: entityId,
        hasComponent: jest.fn().mockReturnValue(false),
      };

      mockEntityFinder.getEntityInstance.mockReturnValue(mockEntity);

      service.updateDescription(entityId, description);

      expect(mockEntityFinder.getEntityInstance).toHaveBeenCalledWith(entityId);
      expect(mockEntityFinder.getEntityInstance).toHaveBeenCalledTimes(1);
    });

    it('should handle null entity gracefully', () => {
      const entityId = 'non-existent-entity';
      const description = 'New description';
      mockEntityFinder.getEntityInstance.mockReturnValue(null);

      // Should not throw
      expect(() => service.updateDescription(entityId, description)).not.toThrow();
      
      expect(mockEntityFinder.getEntityInstance).toHaveBeenCalledWith(entityId);
      expect(mockComponentManager.addComponent).not.toHaveBeenCalled();
      expect(mockComponentManager.updateComponent).not.toHaveBeenCalled();
    });
  });

  describe('regenerateDescriptions', () => {
    it('should call entityFinder.getEntityInstance with the correct entityId', () => {
      const entityId = 'test-entity-id';
      const mockEntity = {
        id: entityId,
        hasComponent: jest.fn().mockReturnValue(true),
        getComponentData: jest.fn().mockReturnValue({
          body: { root: 'root-part-id' },
        }),
      };

      mockEntityFinder.getEntityInstance.mockReturnValue(mockEntity);
      mockBodyGraphService.getAllParts.mockReturnValue(['part1', 'part2']);

      service.regenerateDescriptions(entityId);

      expect(mockEntityFinder.getEntityInstance).toHaveBeenCalledWith(entityId);
      // getEntityInstance is called multiple times: once for initial check, then for each part and body description
      expect(mockEntityFinder.getEntityInstance.mock.calls.length).toBeGreaterThan(0);
      expect(mockEntityFinder.getEntityInstance.mock.calls[0][0]).toBe(entityId);
    });

    it('should handle entity without anatomy:body component', () => {
      const entityId = 'non-anatomy-entity';
      const mockEntity = {
        id: entityId,
        hasComponent: jest.fn().mockReturnValue(false),
      };

      mockEntityFinder.getEntityInstance.mockReturnValue(mockEntity);

      // Should not throw
      expect(() => service.regenerateDescriptions(entityId)).not.toThrow();
      
      expect(mockEntityFinder.getEntityInstance).toHaveBeenCalledWith(entityId);
      expect(mockBodyGraphService.getAllParts).not.toHaveBeenCalled();
    });
  });

  describe('Integration with IEntityManager interface', () => {
    it('should work correctly when entityFinder is IEntityManager', () => {
      // Simulate IEntityManager interface
      const mockIEntityManager = {
        getEntityInstance: jest.fn().mockReturnValue({
          id: 'test-id',
          hasComponent: jest.fn().mockReturnValue(true),
          getComponentData: jest.fn().mockReturnValue({ type: 'torso' }),
        }),
      };

      const serviceWithIEntityManager = new AnatomyDescriptionService({
        bodyPartDescriptionBuilder: mockBodyPartDescriptionBuilder,
        bodyDescriptionComposer: mockBodyDescriptionComposer,
        bodyGraphService: mockBodyGraphService,
        entityFinder: mockIEntityManager,
        componentManager: mockComponentManager,
      });

      mockBodyPartDescriptionBuilder.buildDescription.mockReturnValue('Torso description');

      serviceWithIEntityManager.generatePartDescription('test-id');

      expect(mockIEntityManager.getEntityInstance).toHaveBeenCalledWith('test-id');
      // getEntityInstance is called twice - once in generatePartDescription and once in updateDescription
      expect(mockIEntityManager.getEntityInstance).toHaveBeenCalledTimes(2);
    });
  });
});