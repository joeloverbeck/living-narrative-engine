/**
 * @file Unit-like integration tests for AnatomyDescriptionService
 * Tests service logic without complex entity manager interactions
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { AnatomyDescriptionService } from '../../../src/anatomy/anatomyDescriptionService.js';
import {
  ANATOMY_BODY_COMPONENT_ID,
  ANATOMY_PART_COMPONENT_ID,
  DESCRIPTION_COMPONENT_ID,
} from '../../../src/constants/componentIds.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../src/constants/eventIds.js';

describe('AnatomyDescriptionService - Unit-like Integration', () => {
  let anatomyDescriptionService;
  let mockBodyPartDescriptionBuilder;
  let mockBodyDescriptionComposer;
  let mockBodyGraphService;
  let mockEntityFinder;
  let mockComponentManager;
  let mockEventDispatchService;
  let mockPartDescriptionGenerator;
  let mockBodyDescriptionOrchestrator;
  let mockDescriptionPersistenceService;

  beforeEach(() => {
    // Create all mocks
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

    // Create service with all dependencies
    anatomyDescriptionService = new AnatomyDescriptionService({
      bodyPartDescriptionBuilder: mockBodyPartDescriptionBuilder,
      bodyDescriptionComposer: mockBodyDescriptionComposer,
      bodyGraphService: mockBodyGraphService,
      entityFinder: mockEntityFinder,
      componentManager: mockComponentManager,
      eventDispatchService: mockEventDispatchService,
      partDescriptionGenerator: mockPartDescriptionGenerator,
      bodyDescriptionOrchestrator: mockBodyDescriptionOrchestrator,
      descriptionPersistenceService: mockDescriptionPersistenceService,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Service Delegation (Lines 45-62)', () => {
    it('should delegate generateAllDescriptions to orchestrator when available', async () => {
      // Arrange
      const mockEntity = {
        id: 'test-entity',
        hasComponent: jest.fn(() => true),
        getComponentData: jest.fn(() => ({ body: { root: 'test-root' } })),
      };

      mockBodyDescriptionOrchestrator.generateAllDescriptions.mockResolvedValue({
        bodyDescription: 'Test body description',
        partDescriptions: new Map([['part1', 'Test part description']]),
      });

      // Act
      await anatomyDescriptionService.generateAllDescriptions(mockEntity);

      // Assert - Verify delegation to orchestrator (lines 47-49)
      expect(mockBodyDescriptionOrchestrator.generateAllDescriptions).toHaveBeenCalledWith(mockEntity);
      
      // Verify persistence service calls (lines 53-60)
      expect(mockDescriptionPersistenceService.updateDescription).toHaveBeenCalledWith(
        'test-entity',
        'Test body description'
      );
      expect(mockDescriptionPersistenceService.updateMultipleDescriptions).toHaveBeenCalledWith(
        new Map([['part1', 'Test part description']])
      );
    });
  });

  describe('Error Handling (Lines 65-73)', () => {
    it('should throw error when entity lacks anatomy:body component', async () => {
      // Create service without orchestrator to test fallback path
      const serviceWithoutOrchestrator = new AnatomyDescriptionService({
        bodyPartDescriptionBuilder: mockBodyPartDescriptionBuilder,
        bodyDescriptionComposer: mockBodyDescriptionComposer,
        bodyGraphService: mockBodyGraphService,
        entityFinder: mockEntityFinder,
        componentManager: mockComponentManager,
        eventDispatchService: mockEventDispatchService,
        // No orchestrator
      });

      const mockEntity = {
        id: 'test-entity',
        hasComponent: jest.fn(() => false), // No anatomy:body component
        getComponentData: jest.fn(),
      };

      // Act & Assert - Should hit line 65-66
      await expect(
        serviceWithoutOrchestrator.generateAllDescriptions(mockEntity)
      ).rejects.toThrow('Entity must have an anatomy:body component');
    });

    it('should throw error when body component lacks root property', async () => {
      // Create service without orchestrator to test fallback path
      const serviceWithoutOrchestrator = new AnatomyDescriptionService({
        bodyPartDescriptionBuilder: mockBodyPartDescriptionBuilder,
        bodyDescriptionComposer: mockBodyDescriptionComposer,
        bodyGraphService: mockBodyGraphService,
        entityFinder: mockEntityFinder,
        componentManager: mockComponentManager,
        eventDispatchService: mockEventDispatchService,
        // No orchestrator
      });

      const mockEntity = {
        id: 'test-entity',
        hasComponent: jest.fn(() => true),
        getComponentData: jest.fn(() => ({ body: null })), // No root property
      };

      // Act & Assert - Should hit line 72-73
      await expect(
        serviceWithoutOrchestrator.generateAllDescriptions(mockEntity)
      ).rejects.toThrow('Body component must have a body.root property');
    });
  });

  describe('Part Description Generation (Lines 95-102, 108)', () => {
    it('should delegate part description generation to specialized service', () => {
      const partId = 'test-part-id';
      const mockPartEntity = {
        id: partId,
        hasComponent: jest.fn(() => true),
        getComponentData: jest.fn(() => ({ subType: 'arm' })),
      };

      mockEntityFinder.getEntityInstance.mockReturnValue(mockPartEntity);
      mockPartDescriptionGenerator.generatePartDescription.mockReturnValue('Generated part description');

      // Act - Should hit lines 95-102
      anatomyDescriptionService.generatePartDescription(partId);

      // Assert
      expect(mockPartDescriptionGenerator.generatePartDescription).toHaveBeenCalledWith(partId);
      expect(mockDescriptionPersistenceService.updateDescription).toHaveBeenCalledWith(
        partId,
        'Generated part description'
      );
    });

    it('should handle missing entity gracefully', () => {
      // Arrange
      mockEntityFinder.getEntityInstance.mockReturnValue(null);

      // Act - Should hit line 108
      expect(() => {
        anatomyDescriptionService.generatePartDescription('nonexistent-part');
      }).not.toThrow();
    });
  });

  describe('Body Description Generation (Lines 131-140)', () => {
    it('should delegate generateBodyDescription to orchestrator when available', async () => {
      const mockEntity = {
        id: 'test-entity',
        hasComponent: jest.fn(() => true),
        getComponentData: jest.fn(() => ({ body: { root: 'test-root' } })),
      };

      mockBodyDescriptionOrchestrator.generateBodyDescription.mockResolvedValue('Orchestrator body description');

      // Act - Should hit lines 131-140
      await anatomyDescriptionService.generateBodyDescription(mockEntity);

      // Assert
      expect(mockBodyDescriptionOrchestrator.generateBodyDescription).toHaveBeenCalledWith(mockEntity);
      expect(mockDescriptionPersistenceService.updateDescription).toHaveBeenCalledWith(
        'test-entity',
        'Orchestrator body description'
      );
    });
  });

  describe('Error Event Dispatching (Lines 149-153)', () => {
    it('should dispatch error event when body description is empty', async () => {
      // Create service without orchestrator to test fallback path
      const serviceWithoutOrchestrator = new AnatomyDescriptionService({
        bodyPartDescriptionBuilder: mockBodyPartDescriptionBuilder,
        bodyDescriptionComposer: mockBodyDescriptionComposer,
        bodyGraphService: mockBodyGraphService,
        entityFinder: mockEntityFinder,
        componentManager: mockComponentManager,
        eventDispatchService: mockEventDispatchService,
        // No orchestrator
      });

      const mockEntity = {
        id: 'test-entity',
        getComponentData: jest.fn((componentId) => {
          if (componentId === 'core:name') {
            return { text: 'Test Character' };
          }
          if (componentId === ANATOMY_BODY_COMPONENT_ID) {
            return { recipeId: 'test-recipe' };
          }
          return null;
        }),
      };

      // Mock composer to return empty description
      mockBodyDescriptionComposer.composeDescription.mockResolvedValue('');

      // Act - Should hit lines 149-153
      await serviceWithoutOrchestrator.generateBodyDescription(mockEntity);

      // Assert
      expect(mockEventDispatchService.safeDispatchEvent).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.objectContaining({
          message: expect.stringContaining('Failed to generate body description'),
          details: expect.objectContaining({
            raw: expect.stringContaining('test-entity'),
            timestamp: expect.any(String),
          }),
        })
      );
    });
  });

  describe('Get or Generate Body Description (Lines 175-223)', () => {
    it('should delegate to orchestrator when available', async () => {
      const mockEntity = {
        id: 'test-entity',
        hasComponent: jest.fn(() => true),
        getComponentData: jest.fn(() => ({ body: { root: 'test-root' } })),
      };

      mockBodyDescriptionOrchestrator.getOrGenerateBodyDescription.mockResolvedValue('Orchestrator description');

      // Act - Should hit lines 175-190
      const result = await anatomyDescriptionService.getOrGenerateBodyDescription(mockEntity);

      // Assert
      expect(mockBodyDescriptionOrchestrator.getOrGenerateBodyDescription).toHaveBeenCalledWith(mockEntity);
      expect(mockDescriptionPersistenceService.updateDescription).toHaveBeenCalledWith(
        'test-entity',
        'Orchestrator description'
      );
      expect(result).toBe('Orchestrator description');
    });

    it('should return null for null entity using fallback service', async () => {
      // Create service without orchestrator to test fallback path
      const serviceWithoutOrchestrator = new AnatomyDescriptionService({
        bodyPartDescriptionBuilder: mockBodyPartDescriptionBuilder,
        bodyDescriptionComposer: mockBodyDescriptionComposer,
        bodyGraphService: mockBodyGraphService,
        entityFinder: mockEntityFinder,
        componentManager: mockComponentManager,
        eventDispatchService: mockEventDispatchService,
        // No orchestrator
      });

      // Act - Should hit lines 194-196
      const result = await serviceWithoutOrchestrator.getOrGenerateBodyDescription(null);

      // Assert
      expect(result).toBeNull();
    });

    it('should return existing description for non-anatomy entity using fallback service', async () => {
      // Create service without orchestrator to test fallback path
      const serviceWithoutOrchestrator = new AnatomyDescriptionService({
        bodyPartDescriptionBuilder: mockBodyPartDescriptionBuilder,
        bodyDescriptionComposer: mockBodyDescriptionComposer,
        bodyGraphService: mockBodyGraphService,
        entityFinder: mockEntityFinder,
        componentManager: mockComponentManager,
        eventDispatchService: mockEventDispatchService,
        // No orchestrator
      });

      const mockEntity = {
        id: 'test-entity',
        hasComponent: jest.fn((componentId) => componentId === DESCRIPTION_COMPONENT_ID),
        getComponentData: jest.fn(() => ({ text: 'Existing description' })),
      };

      // Act - Should hit lines 199-202
      const result = await serviceWithoutOrchestrator.getOrGenerateBodyDescription(mockEntity);

      // Assert
      expect(result).toBe('Existing description');
    });
  });

  describe('Update Description (Lines 235-239, 245)', () => {
    it('should delegate to persistence service when available', () => {
      const entityId = 'test-entity-id';
      const description = 'Test description';

      // Act - Should hit lines 235-239
      anatomyDescriptionService.updateDescription(entityId, description);

      // Assert
      expect(mockDescriptionPersistenceService.updateDescription).toHaveBeenCalledWith(entityId, description);
    });

    it('should fall back to component manager when persistence service unavailable', () => {
      // Create service without persistence service
      const serviceWithoutPersistence = new AnatomyDescriptionService({
        bodyPartDescriptionBuilder: mockBodyPartDescriptionBuilder,
        bodyDescriptionComposer: mockBodyDescriptionComposer,
        bodyGraphService: mockBodyGraphService,
        entityFinder: mockEntityFinder,
        componentManager: mockComponentManager,
        eventDispatchService: mockEventDispatchService,
        // No persistence service
      });

      const entityId = 'test-entity-id';
      const description = 'Test description';
      const mockEntity = { id: entityId };

      mockEntityFinder.getEntityInstance.mockReturnValue(mockEntity);

      // Act - Should hit lines 243-251
      serviceWithoutPersistence.updateDescription(entityId, description);

      // Assert
      expect(mockComponentManager.addComponent).toHaveBeenCalledWith(
        entityId,
        DESCRIPTION_COMPONENT_ID,
        { text: description }
      );
    });

    it('should handle missing entity gracefully', () => {
      // Create service without persistence service
      const serviceWithoutPersistence = new AnatomyDescriptionService({
        bodyPartDescriptionBuilder: mockBodyPartDescriptionBuilder,
        bodyDescriptionComposer: mockBodyDescriptionComposer,
        bodyGraphService: mockBodyGraphService,
        entityFinder: mockEntityFinder,
        componentManager: mockComponentManager,
        eventDispatchService: mockEventDispatchService,
        // No persistence service
      });

      mockEntityFinder.getEntityInstance.mockReturnValue(null);

      // Act - Should hit line 245
      expect(() => {
        serviceWithoutPersistence.updateDescription('nonexistent-entity', 'description');
      }).not.toThrow();
    });
  });

  describe('Regenerate Descriptions (Lines 263-277)', () => {
    it('should always return false for isDescriptionCurrent', () => {
      const mockEntity = { id: 'test' };

      // Act - Should hit line 263
      const result = anatomyDescriptionService.isDescriptionCurrent(mockEntity);

      // Assert
      expect(result).toBe(false);
    });

    it('should handle missing entity gracefully', () => {
      mockEntityFinder.getEntityInstance.mockReturnValue(null);

      // Act - Should hit early return
      expect(() => {
        anatomyDescriptionService.regenerateDescriptions('nonexistent-entity');
      }).not.toThrow();
    });

    it('should handle non-anatomy entity gracefully', () => {
      const mockEntity = {
        id: 'test-entity',
        hasComponent: jest.fn(() => false),
        getComponentData: jest.fn(),
      };

      mockEntityFinder.getEntityInstance.mockReturnValue(mockEntity);

      // Act - Should hit early return in lines 273-275
      expect(() => {
        anatomyDescriptionService.regenerateDescriptions('test-entity');
      }).not.toThrow();

      expect(mockEntity.hasComponent).toHaveBeenCalledWith(ANATOMY_BODY_COMPONENT_ID);
    });

    it('should call generateAllDescriptions for anatomy entity', () => {
      const mockEntity = {
        id: 'test-entity',
        hasComponent: jest.fn(() => true),
        getComponentData: jest.fn(() => ({ body: { root: 'test-root' } })),
      };

      mockEntityFinder.getEntityInstance.mockReturnValue(mockEntity);

      const generateAllSpy = jest.spyOn(anatomyDescriptionService, 'generateAllDescriptions');
      generateAllSpy.mockImplementation(() => Promise.resolve());

      // Act - Should hit lines 275-277
      anatomyDescriptionService.regenerateDescriptions('test-entity');

      // Assert
      expect(mockEntity.hasComponent).toHaveBeenCalledWith(ANATOMY_BODY_COMPONENT_ID);
      expect(generateAllSpy).toHaveBeenCalledWith(mockEntity);

      generateAllSpy.mockRestore();
    });
  });

  describe('Additional Coverage for Remaining Lines', () => {
    it('should handle entity without anatomy:part component in fallback part generation (line 108)', () => {
      const serviceWithoutGenerator = new AnatomyDescriptionService({
        bodyPartDescriptionBuilder: mockBodyPartDescriptionBuilder,
        bodyDescriptionComposer: mockBodyDescriptionComposer,
        bodyGraphService: mockBodyGraphService,
        entityFinder: mockEntityFinder,
        componentManager: mockComponentManager,
        eventDispatchService: mockEventDispatchService,
        // No part description generator
      });

      const partId = 'test-part-id';
      const mockPartEntity = {
        id: partId,
        hasComponent: jest.fn(() => false), // No anatomy:part component
        getComponentData: jest.fn(),
      };

      mockEntityFinder.getEntityInstance.mockReturnValue(mockPartEntity);

      // Act - Should hit line 108
      serviceWithoutGenerator.generatePartDescription(partId);

      // Assert
      expect(mockPartEntity.hasComponent).toHaveBeenCalledWith(ANATOMY_PART_COMPONENT_ID);
    });

    it('should handle empty description from builder in fallback part generation (line 115)', () => {
      const serviceWithoutGenerator = new AnatomyDescriptionService({
        bodyPartDescriptionBuilder: mockBodyPartDescriptionBuilder,
        bodyDescriptionComposer: mockBodyDescriptionComposer,
        bodyGraphService: mockBodyGraphService,
        entityFinder: mockEntityFinder,
        componentManager: mockComponentManager,
        eventDispatchService: mockEventDispatchService,
        // No part description generator
      });

      const partId = 'test-part-id';
      const mockPartEntity = {
        id: partId,
        hasComponent: jest.fn(() => true),
        getComponentData: jest.fn(() => ({ subType: 'arm' })),
      };

      mockEntityFinder.getEntityInstance.mockReturnValue(mockPartEntity);
      mockBodyPartDescriptionBuilder.buildDescription.mockReturnValue(''); // Empty description

      // Act - Should hit line 115
      serviceWithoutGenerator.generatePartDescription(partId);

      // Assert
      expect(mockBodyPartDescriptionBuilder.buildDescription).toHaveBeenCalledWith(mockPartEntity);
    });

    it('should return existing description when current in fallback service (line 212)', async () => {
      const serviceWithoutOrchestrator = new AnatomyDescriptionService({
        bodyPartDescriptionBuilder: mockBodyPartDescriptionBuilder,
        bodyDescriptionComposer: mockBodyDescriptionComposer,
        bodyGraphService: mockBodyGraphService,
        entityFinder: mockEntityFinder,
        componentManager: mockComponentManager,
        eventDispatchService: mockEventDispatchService,
        // No orchestrator
      });

      // Override isDescriptionCurrent to return true for this test
      serviceWithoutOrchestrator.isDescriptionCurrent = jest.fn(() => true);

      const mockEntity = {
        id: 'test-entity',
        hasComponent: jest.fn((componentId) => {
          if (componentId === ANATOMY_BODY_COMPONENT_ID) return true;
          if (componentId === DESCRIPTION_COMPONENT_ID) return true;
          return false;
        }),
        getComponentData: jest.fn((componentId) => {
          if (componentId === DESCRIPTION_COMPONENT_ID) {
            return { text: 'Current existing description' };
          }
          if (componentId === ANATOMY_BODY_COMPONENT_ID) {
            return { body: { root: 'test-root' } };
          }
          return null;
        }),
      };

      // Act - Should hit line 212
      const result = await serviceWithoutOrchestrator.getOrGenerateBodyDescription(mockEntity);

      // Assert
      expect(result).toBe('Current existing description');
      expect(serviceWithoutOrchestrator.isDescriptionCurrent).toHaveBeenCalledWith(mockEntity);
    });

    it('should return null when composed description is empty in fallback service (line 223)', async () => {
      const serviceWithoutOrchestrator = new AnatomyDescriptionService({
        bodyPartDescriptionBuilder: mockBodyPartDescriptionBuilder,
        bodyDescriptionComposer: mockBodyDescriptionComposer,
        bodyGraphService: mockBodyGraphService,
        entityFinder: mockEntityFinder,
        componentManager: mockComponentManager,
        eventDispatchService: mockEventDispatchService,
        // No orchestrator
      });

      const mockEntity = {
        id: 'test-entity',
        hasComponent: jest.fn((componentId) => {
          if (componentId === ANATOMY_BODY_COMPONENT_ID) return true;
          if (componentId === DESCRIPTION_COMPONENT_ID) return false; // No existing description
          return false;
        }),
        getComponentData: jest.fn((componentId) => {
          if (componentId === ANATOMY_BODY_COMPONENT_ID) {
            return { body: { root: 'test-root' } };
          }
          return null;
        }),
      };

      // Mock composeDescription to return null/empty
      mockBodyDescriptionComposer.composeDescription.mockResolvedValue(null);

      // Act - Should hit line 223
      const result = await serviceWithoutOrchestrator.getOrGenerateBodyDescription(mockEntity);

      // Assert
      expect(mockBodyDescriptionComposer.composeDescription).toHaveBeenCalledWith(mockEntity);
      expect(result).toBeNull();
    });

    it('should use fallback implementation when orchestrator unavailable (lines 77-83)', async () => {
      const serviceWithoutOrchestrator = new AnatomyDescriptionService({
        bodyPartDescriptionBuilder: mockBodyPartDescriptionBuilder,
        bodyDescriptionComposer: mockBodyDescriptionComposer,
        bodyGraphService: mockBodyGraphService,
        entityFinder: mockEntityFinder,
        componentManager: mockComponentManager,
        eventDispatchService: mockEventDispatchService,
        // No orchestrator
      });

      const mockEntity = {
        id: 'test-entity',
        hasComponent: jest.fn(() => true),
        getComponentData: jest.fn(() => ({ 
          body: { root: 'test-root' } 
        })),
      };

      // Mock the getAllParts call for the fallback path
      mockBodyGraphService.getAllParts.mockReturnValue(['part1', 'part2']);
      mockBodyDescriptionComposer.composeDescription.mockResolvedValue('Fallback body description');

      // Mock generatePartDescription method
      const generatePartSpy = jest.spyOn(serviceWithoutOrchestrator, 'generatePartDescription');
      generatePartSpy.mockImplementation(() => {});

      // Act - Should hit lines 77-83
      await serviceWithoutOrchestrator.generateAllDescriptions(mockEntity);

      // Assert
      expect(mockBodyGraphService.getAllParts).toHaveBeenCalled();
      expect(generatePartSpy).toHaveBeenCalledWith('part1');
      expect(generatePartSpy).toHaveBeenCalledWith('part2');
      expect(mockBodyDescriptionComposer.composeDescription).toHaveBeenCalledWith(mockEntity);

      generatePartSpy.mockRestore();
    });

    it('should use fallback part description generation when no generator available (lines 106-119)', () => {
      const serviceWithoutGenerator = new AnatomyDescriptionService({
        bodyPartDescriptionBuilder: mockBodyPartDescriptionBuilder,
        bodyDescriptionComposer: mockBodyDescriptionComposer,
        bodyGraphService: mockBodyGraphService,
        entityFinder: mockEntityFinder,
        componentManager: mockComponentManager,
        eventDispatchService: mockEventDispatchService,
        // No part description generator
      });

      const partId = 'test-part-id';
      const mockPartEntity = {
        id: partId,
        hasComponent: jest.fn(() => true),
        getComponentData: jest.fn(() => ({ subType: 'arm' })),
      };

      mockEntityFinder.getEntityInstance.mockReturnValue(mockPartEntity);
      mockBodyPartDescriptionBuilder.buildDescription.mockReturnValue('Fallback part description');

      const updateDescriptionSpy = jest.spyOn(serviceWithoutGenerator, 'updateDescription');
      updateDescriptionSpy.mockImplementation(() => {});

      // Act - Should hit lines 106-119
      serviceWithoutGenerator.generatePartDescription(partId);

      // Assert
      expect(mockBodyPartDescriptionBuilder.buildDescription).toHaveBeenCalledWith(mockPartEntity);
      expect(updateDescriptionSpy).toHaveBeenCalledWith(partId, 'Fallback part description');

      updateDescriptionSpy.mockRestore();
    });

    it('should generate new description when existing is not current in fallback service (lines 206-223)', async () => {
      const serviceWithoutOrchestrator = new AnatomyDescriptionService({
        bodyPartDescriptionBuilder: mockBodyPartDescriptionBuilder,
        bodyDescriptionComposer: mockBodyDescriptionComposer,
        bodyGraphService: mockBodyGraphService,
        entityFinder: mockEntityFinder,
        componentManager: mockComponentManager,
        eventDispatchService: mockEventDispatchService,
        // No orchestrator
      });

      const mockEntity = {
        id: 'test-entity',
        hasComponent: jest.fn((componentId) => {
          if (componentId === ANATOMY_BODY_COMPONENT_ID) return true;
          if (componentId === DESCRIPTION_COMPONENT_ID) return true;
          return false;
        }),
        getComponentData: jest.fn((componentId) => {
          if (componentId === DESCRIPTION_COMPONENT_ID) {
            return { text: 'Existing description' };
          }
          if (componentId === ANATOMY_BODY_COMPONENT_ID) {
            return { body: { root: 'test-root' } };
          }
          return null;
        }),
      };

      // Mock composeDescription to return new description
      mockBodyDescriptionComposer.composeDescription.mockResolvedValue('New composed description');

      const updateDescriptionSpy = jest.spyOn(serviceWithoutOrchestrator, 'updateDescription');
      updateDescriptionSpy.mockImplementation(() => {});

      // Act - Should hit lines 206-223
      const result = await serviceWithoutOrchestrator.getOrGenerateBodyDescription(mockEntity);

      // Assert
      expect(mockBodyDescriptionComposer.composeDescription).toHaveBeenCalledWith(mockEntity);
      expect(updateDescriptionSpy).toHaveBeenCalledWith('test-entity', 'New composed description');
      expect(result).toBe('New composed description');

      updateDescriptionSpy.mockRestore();
    });
  });
});