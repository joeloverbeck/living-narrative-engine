import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { AnatomyDescriptionService } from '../../../src/anatomy/anatomyDescriptionService.js';
import {
  ANATOMY_BODY_COMPONENT_ID,
  ANATOMY_PART_COMPONENT_ID,
  DESCRIPTION_COMPONENT_ID,
} from '../../../src/constants/componentIds.js';

describe('AnatomyDescriptionService - Delegation Coverage', () => {
  let service;
  let mockPartDescriptionGenerator;
  let mockBodyDescriptionOrchestrator;
  let mockDescriptionPersistenceService;
  let mockEntityFinder;
  let mockComponentManager;

  // Helper function to create mock entities
  const createMockEntity = (id, components) => {
    return {
      id,
      hasComponent: jest.fn((componentId) => !!components[componentId]),
      getComponentData: jest.fn((componentId) => components[componentId]),
    };
  };

  beforeEach(() => {
    // Create mocks for newer services
    mockPartDescriptionGenerator = {
      generatePartDescription: jest.fn(),
    };

    mockBodyDescriptionOrchestrator = {
      generateAllDescriptions: jest.fn(),
      generateBodyDescription: jest.fn(),
      getOrGenerateBodyDescription: jest.fn(),
    };

    mockDescriptionPersistenceService = {
      updateDescription: jest.fn(),
      updateMultipleDescriptions: jest.fn(),
    };

    // Create mocks for existing services (fallback)
    mockEntityFinder = {
      getEntityInstance: jest.fn(),
    };

    mockComponentManager = {
      addComponent: jest.fn(),
    };

    // Create service with newer services available
    service = new AnatomyDescriptionService({
      bodyPartDescriptionBuilder: { buildDescription: jest.fn() },
      bodyDescriptionComposer: { composeDescription: jest.fn() },
      bodyGraphService: { getAllParts: jest.fn() },
      entityFinder: mockEntityFinder,
      componentManager: mockComponentManager,
      eventDispatchService: { safeDispatchEvent: jest.fn() },
      // New specialized services
      partDescriptionGenerator: mockPartDescriptionGenerator,
      bodyDescriptionOrchestrator: mockBodyDescriptionOrchestrator,
      descriptionPersistenceService: mockDescriptionPersistenceService,
    });
  });

  describe('generateAllDescriptions with orchestrator delegation', () => {
    it('should delegate to bodyDescriptionOrchestrator when available', async () => {
      const mockEntity = createMockEntity('entity1', {
        [ANATOMY_BODY_COMPONENT_ID]: { body: { root: 'torso' } },
      });

      const mockResults = {
        bodyDescription: 'Full body description',
        partDescriptions: [
          { entityId: 'part1', description: 'Part 1 description' },
          { entityId: 'part2', description: 'Part 2 description' },
        ],
      };
      mockBodyDescriptionOrchestrator.generateAllDescriptions.mockResolvedValue(
        mockResults
      );

      await service.generateAllDescriptions(mockEntity);

      expect(
        mockBodyDescriptionOrchestrator.generateAllDescriptions
      ).toHaveBeenCalledWith(mockEntity);
      expect(
        mockDescriptionPersistenceService.updateDescription
      ).toHaveBeenCalledWith('entity1', 'Full body description');
      expect(
        mockDescriptionPersistenceService.updateMultipleDescriptions
      ).toHaveBeenCalledWith(mockResults.partDescriptions);
    });

    it('should handle null descriptions from orchestrator gracefully', async () => {
      const mockEntity = createMockEntity('entity1', {
        [ANATOMY_BODY_COMPONENT_ID]: { body: { root: 'torso' } },
      });

      const mockResults = {
        bodyDescription: null,
        partDescriptions: [],
      };
      mockBodyDescriptionOrchestrator.generateAllDescriptions.mockResolvedValue(
        mockResults
      );

      await expect(
        service.generateAllDescriptions(mockEntity)
      ).resolves.not.toThrow();

      expect(
        mockDescriptionPersistenceService.updateDescription
      ).toHaveBeenCalledWith('entity1', null);
      expect(
        mockDescriptionPersistenceService.updateMultipleDescriptions
      ).toHaveBeenCalledWith([]);
    });
  });

  describe('generatePartDescription with generator delegation (lines 93-100)', () => {
    it('should delegate to partDescriptionGenerator when available', () => {
      const partId = 'part1';
      const mockDescription = 'Generated part description';

      mockPartDescriptionGenerator.generatePartDescription.mockReturnValue(
        mockDescription
      );

      service.generatePartDescription(partId);

      expect(
        mockPartDescriptionGenerator.generatePartDescription
      ).toHaveBeenCalledWith(partId);
      expect(
        mockDescriptionPersistenceService.updateDescription
      ).toHaveBeenCalledWith(partId, mockDescription);
    });

    it('should handle null description from generator gracefully', () => {
      const partId = 'part1';

      mockPartDescriptionGenerator.generatePartDescription.mockReturnValue(
        null
      );

      service.generatePartDescription(partId);

      expect(
        mockPartDescriptionGenerator.generatePartDescription
      ).toHaveBeenCalledWith(partId);
      expect(
        mockDescriptionPersistenceService.updateDescription
      ).not.toHaveBeenCalled();
    });

    it('should handle undefined description from generator gracefully', () => {
      const partId = 'part1';

      mockPartDescriptionGenerator.generatePartDescription.mockReturnValue(
        undefined
      );

      service.generatePartDescription(partId);

      expect(
        mockPartDescriptionGenerator.generatePartDescription
      ).toHaveBeenCalledWith(partId);
      expect(
        mockDescriptionPersistenceService.updateDescription
      ).not.toHaveBeenCalled();
    });
  });

  describe('generateBodyDescription with orchestrator delegation (lines 129-136)', () => {
    it('should delegate to bodyDescriptionOrchestrator when available', async () => {
      const mockEntity = createMockEntity('entity1', {
        [ANATOMY_BODY_COMPONENT_ID]: { body: { root: 'torso' } },
      });
      const mockDescription = 'Orchestrated body description';

      mockBodyDescriptionOrchestrator.generateBodyDescription.mockResolvedValue(
        mockDescription
      );

      await service.generateBodyDescription(mockEntity);

      expect(
        mockBodyDescriptionOrchestrator.generateBodyDescription
      ).toHaveBeenCalledWith(mockEntity);
      expect(
        mockDescriptionPersistenceService.updateDescription
      ).toHaveBeenCalledWith('entity1', mockDescription);
    });

    it('should handle null description from orchestrator gracefully', async () => {
      const mockEntity = createMockEntity('entity1', {
        [ANATOMY_BODY_COMPONENT_ID]: { body: { root: 'torso' } },
      });

      mockBodyDescriptionOrchestrator.generateBodyDescription.mockResolvedValue(
        null
      );

      await service.generateBodyDescription(mockEntity);

      expect(
        mockBodyDescriptionOrchestrator.generateBodyDescription
      ).toHaveBeenCalledWith(mockEntity);
      expect(
        mockDescriptionPersistenceService.updateDescription
      ).toHaveBeenCalledWith('entity1', null);
    });

    it('should handle empty string description from orchestrator', async () => {
      const mockEntity = createMockEntity('entity1', {
        [ANATOMY_BODY_COMPONENT_ID]: { body: { root: 'torso' } },
      });

      mockBodyDescriptionOrchestrator.generateBodyDescription.mockResolvedValue(
        ''
      );

      await service.generateBodyDescription(mockEntity);

      expect(
        mockBodyDescriptionOrchestrator.generateBodyDescription
      ).toHaveBeenCalledWith(mockEntity);
      expect(
        mockDescriptionPersistenceService.updateDescription
      ).toHaveBeenCalledWith('entity1', '');
    });
  });

  describe('getOrGenerateBodyDescription with orchestrator delegation (lines 173-184)', () => {
    it('should delegate to bodyDescriptionOrchestrator when available for anatomy entity', async () => {
      const mockEntity = createMockEntity('entity1', {
        [ANATOMY_BODY_COMPONENT_ID]: { body: { root: 'torso' } },
      });
      const mockDescription = 'Orchestrated description';

      mockBodyDescriptionOrchestrator.getOrGenerateBodyDescription.mockResolvedValue(
        mockDescription
      );

      const result = await service.getOrGenerateBodyDescription(mockEntity);

      expect(
        mockBodyDescriptionOrchestrator.getOrGenerateBodyDescription
      ).toHaveBeenCalledWith(mockEntity);
      expect(
        mockDescriptionPersistenceService.updateDescription
      ).toHaveBeenCalledWith('entity1', mockDescription);
      expect(result).toBe(mockDescription);
    });

    it('should not update persistence when description is null from orchestrator', async () => {
      const mockEntity = createMockEntity('entity1', {
        [ANATOMY_BODY_COMPONENT_ID]: { body: { root: 'torso' } },
      });

      mockBodyDescriptionOrchestrator.getOrGenerateBodyDescription.mockResolvedValue(
        null
      );

      const result = await service.getOrGenerateBodyDescription(mockEntity);

      expect(
        mockBodyDescriptionOrchestrator.getOrGenerateBodyDescription
      ).toHaveBeenCalledWith(mockEntity);
      expect(
        mockDescriptionPersistenceService.updateDescription
      ).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });

    it('should not update persistence when entity lacks anatomy:body component', async () => {
      const mockEntity = createMockEntity('entity1', {
        [DESCRIPTION_COMPONENT_ID]: { text: 'Non-anatomy description' },
      });

      mockBodyDescriptionOrchestrator.getOrGenerateBodyDescription.mockResolvedValue(
        'Some description'
      );

      const result = await service.getOrGenerateBodyDescription(mockEntity);

      expect(
        mockBodyDescriptionOrchestrator.getOrGenerateBodyDescription
      ).toHaveBeenCalledWith(mockEntity);
      expect(
        mockDescriptionPersistenceService.updateDescription
      ).not.toHaveBeenCalled();
      expect(result).toBe('Some description');
    });
  });

  describe('updateDescription with persistence service delegation (lines 229-233)', () => {
    it('should delegate to descriptionPersistenceService when available', () => {
      const entityId = 'entity1';
      const description = 'Updated description';

      service.updateDescription(entityId, description);

      expect(
        mockDescriptionPersistenceService.updateDescription
      ).toHaveBeenCalledWith(entityId, description);
      expect(mockComponentManager.addComponent).not.toHaveBeenCalled();
    });

    it('should handle empty description through persistence service', () => {
      const entityId = 'entity1';
      const description = '';

      service.updateDescription(entityId, description);

      expect(
        mockDescriptionPersistenceService.updateDescription
      ).toHaveBeenCalledWith(entityId, description);
    });

    it('should handle null description through persistence service', () => {
      const entityId = 'entity1';
      const description = null;

      service.updateDescription(entityId, description);

      expect(
        mockDescriptionPersistenceService.updateDescription
      ).toHaveBeenCalledWith(entityId, description);
    });
  });

  describe('Service delegation without newer services', () => {
    let serviceWithoutNewServices;

    beforeEach(() => {
      // Create service without newer services to test fallback paths
      serviceWithoutNewServices = new AnatomyDescriptionService({
        bodyPartDescriptionBuilder: { buildDescription: jest.fn() },
        bodyDescriptionComposer: { composeDescription: jest.fn() },
        bodyGraphService: { getAllParts: jest.fn() },
        entityFinder: mockEntityFinder,
        componentManager: mockComponentManager,
        eventDispatchService: { safeDispatchEvent: jest.fn() },
        // No newer services provided
      });
    });

    it('should fall back to original implementation when partDescriptionGenerator is not available', () => {
      const partId = 'part1';
      const mockEntity = createMockEntity(partId, {
        [ANATOMY_PART_COMPONENT_ID]: { type: 'arm' },
      });

      mockEntityFinder.getEntityInstance.mockReturnValue(mockEntity);

      serviceWithoutNewServices.generatePartDescription(partId);

      expect(mockEntityFinder.getEntityInstance).toHaveBeenCalledWith(partId);
      // Should use fallback implementation
    });

    it('should fall back to original implementation when bodyDescriptionOrchestrator is not available', async () => {
      const mockEntity = createMockEntity('entity1', {
        [ANATOMY_BODY_COMPONENT_ID]: { body: { root: 'torso' } },
      });

      await serviceWithoutNewServices.generateBodyDescription(mockEntity);

      // Should use fallback implementation
      expect(
        mockPartDescriptionGenerator.generatePartDescription
      ).not.toHaveBeenCalled();
    });
  });
});
