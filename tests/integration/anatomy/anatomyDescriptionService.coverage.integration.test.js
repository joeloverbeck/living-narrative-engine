/**
 * @file Coverage-focused integration tests for AnatomyDescriptionService
 * Specifically targets uncovered lines identified in coverage report
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import AnatomyIntegrationTestBed from '../../common/anatomy/anatomyIntegrationTestBed.js';
import { AnatomyDescriptionService } from '../../../src/anatomy/anatomyDescriptionService.js';
import {
  ANATOMY_BODY_COMPONENT_ID,
  ANATOMY_PART_COMPONENT_ID,
  DESCRIPTION_COMPONENT_ID,
} from '../../../src/constants/componentIds.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../src/constants/eventIds.js';

describe('AnatomyDescriptionService - Coverage Integration', () => {
  let testBed;
  let anatomyDescriptionService;

  beforeEach(() => {
    testBed = new AnatomyIntegrationTestBed();

    // Load comprehensive test data like in anatomyDescriptionGenerationPipeline test
    testBed.loadEntityDefinitions({
      'core:actor': {
        id: 'core:actor',
        description: 'A basic actor entity',
        components: {
          'core:name': {},
          'anatomy:body': {},
        },
      },
      'anatomy:body_part': {
        id: 'anatomy:body_part',
        description: 'A basic body part',
        components: {
          'anatomy:part': {},
          'core:description': {},
        },
      },
    });

    testBed.loadComponents({
      'core:name': {
        id: 'core:name',
        description: 'Name component',
        dataSchema: {
          type: 'object',
          properties: {
            text: { type: 'string' },
          },
          required: ['text'],
        },
      },
      'core:description': {
        id: 'core:description',
        description: 'Description component',
        dataSchema: {
          type: 'object',
          properties: {
            text: { type: 'string' },
          },
          required: ['text'],
        },
      },
      'anatomy:body': {
        id: 'anatomy:body',
        description: 'Body anatomy component',
        dataSchema: {
          type: 'object',
          properties: {
            body: {
              type: ['object', 'null'],
              nullable: true,
            },
            recipeId: { type: 'string' },
          },
          required: [],
        },
      },
      'anatomy:part': {
        id: 'anatomy:part',
        description: 'Anatomy part component',
        dataSchema: {
          type: 'object',
          properties: {
            partType: { type: 'string' },
          },
          required: ['partType'],
        },
      },
    });

    anatomyDescriptionService = testBed.anatomyDescriptionService;
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('Coverage for Lines 65-73 (Error Handling)', () => {
    it('should throw error when entity lacks anatomy:body component', async () => {
      // Arrange - Create entity without anatomy:body component (fallback path)
      const serviceWithoutOrchestrator = new AnatomyDescriptionService({
        bodyPartDescriptionBuilder: testBed.mockBodyPartDescriptionBuilder,
        bodyDescriptionComposer: testBed.bodyDescriptionComposer,
        bodyGraphService: testBed.bodyGraphService,
        entityFinder: testBed.entityManager,
        componentManager: testBed.mockComponentManager,
        eventDispatchService: testBed.mocks.eventDispatchService,
        // No orchestrator - forces fallback path
      });

      const entity = testBed.createMockEntity();
      // Don't add anatomy:body component

      // Act & Assert - Should hit line 65-66
      await expect(
        serviceWithoutOrchestrator.generateAllDescriptions(entity)
      ).rejects.toThrow('Entity must have an anatomy:body component');
    });

    it('should throw error when body component lacks root property', async () => {
      // Arrange - Test lines 72-73
      const serviceWithoutOrchestrator = new AnatomyDescriptionService({
        bodyPartDescriptionBuilder: testBed.mockBodyPartDescriptionBuilder,
        bodyDescriptionComposer: testBed.bodyDescriptionComposer,
        bodyGraphService: testBed.bodyGraphService,
        entityFinder: testBed.entityManager,
        componentManager: testBed.mockComponentManager,
        eventDispatchService: testBed.mocks.eventDispatchService,
        // No orchestrator - forces fallback path
      });

      const entity = testBed.createMockEntity();
      entity.hasComponent = jest.fn(
        (componentId) => componentId === ANATOMY_BODY_COMPONENT_ID
      );
      entity.getComponentData = jest.fn(() => ({ body: null })); // No root property

      // Act & Assert - Should hit line 72-73
      await expect(
        serviceWithoutOrchestrator.generateAllDescriptions(entity)
      ).rejects.toThrow('Body component must have a body.root property');
    });
  });

  describe('Coverage for Lines 95-102 (Part Description Delegation)', () => {
    it('should delegate part description generation and update with persistence service', async () => {
      // Arrange - Test lines 95-102
      const partEntity =
        await testBed.entityManager.createEntityInstance('anatomy:body_part');
      testBed.entityManager.addComponent(partEntity.id, 'anatomy:part', {
        partType: 'test',
      });

      const generatorSpy = jest.spyOn(
        testBed.mockPartDescriptionGenerator,
        'generatePartDescription'
      );
      const persistenceSpy = jest.spyOn(
        testBed.descriptionPersistenceService,
        'updateDescription'
      );

      generatorSpy.mockReturnValue('Generated part description');

      // Act - Should hit lines 95-102
      anatomyDescriptionService.generatePartDescription(partEntity.id);

      // Assert
      expect(generatorSpy).toHaveBeenCalledWith(partEntity.id);
      expect(persistenceSpy).toHaveBeenCalledWith(
        partEntity.id,
        'Generated part description'
      );

      generatorSpy.mockRestore();
      persistenceSpy.mockRestore();
    });
  });

  describe('Coverage for Lines 108 (Missing Entity Handling)', () => {
    it('should handle missing entity in generatePartDescription gracefully', () => {
      // Arrange - Use non-existent entity ID
      const nonExistentId = 'definitely-does-not-exist-' + Date.now();

      // Act - Should hit line 108 (early return)
      expect(() => {
        anatomyDescriptionService.generatePartDescription(nonExistentId);
      }).not.toThrow();
    });
  });

  describe('Coverage for Lines 131-140 (Body Description Orchestrator)', () => {
    it('should delegate generateBodyDescription to orchestrator when available', async () => {
      // Arrange - Test lines 131-140
      const entity = testBed.createMockEntity();
      entity.hasComponent = jest.fn(() => true);
      entity.getComponentData = jest.fn(() => ({
        body: { root: 'test-root' },
      }));
      entity.id = 'test-entity-id';

      const orchestratorSpy = jest.spyOn(
        testBed.bodyDescriptionOrchestrator,
        'generateBodyDescription'
      );
      const persistenceSpy = jest.spyOn(
        testBed.descriptionPersistenceService,
        'updateDescription'
      );

      orchestratorSpy.mockResolvedValue('Orchestrator body description');

      // Act - Should hit lines 131-140
      await anatomyDescriptionService.generateBodyDescription(entity);

      // Assert
      expect(orchestratorSpy).toHaveBeenCalledWith(entity);
      expect(persistenceSpy).toHaveBeenCalledWith(
        entity.id,
        'Orchestrator body description'
      );

      orchestratorSpy.mockRestore();
      persistenceSpy.mockRestore();
    });
  });

  describe('Coverage for Lines 149-153 (Error Event Dispatching)', () => {
    it('should dispatch error event when body description is empty', async () => {
      // Arrange - Service without orchestrator to hit fallback path
      const serviceWithoutOrchestrator = new AnatomyDescriptionService({
        bodyPartDescriptionBuilder: testBed.mockBodyPartDescriptionBuilder,
        bodyDescriptionComposer: testBed.bodyDescriptionComposer,
        bodyGraphService: testBed.bodyGraphService,
        entityFinder: testBed.entityManager,
        componentManager: testBed.mockComponentManager,
        eventDispatchService: testBed.mocks.eventDispatchService,
        // No orchestrator
      });

      const entity = testBed.createMockEntity();
      entity.id = 'test-entity-id';
      entity.hasComponent = jest.fn(() => false); // Not anatomy entity for fallback
      entity.getComponentData = jest.fn((componentId) => {
        if (componentId === 'core:name') {
          return { text: 'Test Character' };
        }
        if (componentId === ANATOMY_BODY_COMPONENT_ID) {
          return { recipeId: 'test-recipe' };
        }
        return null;
      });

      // Mock composer to return empty description
      const composerSpy = jest.spyOn(
        testBed.bodyDescriptionComposer,
        'composeDescription'
      );
      composerSpy.mockResolvedValue(''); // Empty description triggers error event

      // Clear previous event calls
      testBed.mocks.eventDispatchService.safeDispatchEvent.mockClear();

      // Act - Should hit lines 149-153
      await serviceWithoutOrchestrator.generateBodyDescription(entity);

      // Assert - Error event should be dispatched
      expect(
        testBed.mocks.eventDispatchService.safeDispatchEvent
      ).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.objectContaining({
          message: expect.stringContaining(
            'Failed to generate body description'
          ),
          details: expect.objectContaining({
            raw: expect.stringContaining(entity.id),
            timestamp: expect.any(String),
          }),
        })
      );

      composerSpy.mockRestore();
    });
  });

  describe('Coverage for Lines 175-223 (getOrGenerateBodyDescription)', () => {
    it('should delegate getOrGenerateBodyDescription to orchestrator', async () => {
      // Arrange - Test lines 175-190
      const entity = testBed.createMockEntity();
      entity.id = 'test-entity-id';
      entity.hasComponent = jest.fn(() => true);
      entity.getComponentData = jest.fn(() => ({
        body: { root: 'test-root' },
      }));

      const orchestratorSpy = jest.spyOn(
        testBed.bodyDescriptionOrchestrator,
        'getOrGenerateBodyDescription'
      );
      const persistenceSpy = jest.spyOn(
        testBed.descriptionPersistenceService,
        'updateDescription'
      );

      orchestratorSpy.mockResolvedValue('Orchestrator description');

      // Act - Should hit lines 175-190
      const result =
        await anatomyDescriptionService.getOrGenerateBodyDescription(entity);

      // Assert
      expect(orchestratorSpy).toHaveBeenCalledWith(entity);
      expect(persistenceSpy).toHaveBeenCalledWith(
        entity.id,
        'Orchestrator description'
      );
      expect(result).toBe('Orchestrator description');

      orchestratorSpy.mockRestore();
      persistenceSpy.mockRestore();
    });

    it('should return null for null entity', async () => {
      // Act - Should hit lines 194-196
      const result =
        await anatomyDescriptionService.getOrGenerateBodyDescription(null);

      // Assert
      expect(result).toBeNull();
    });

    it('should return existing description for non-anatomy entity', async () => {
      // Arrange - Test lines 199-202
      const entity = testBed.createMockEntity();
      entity.hasComponent = jest.fn(
        (componentId) => componentId === DESCRIPTION_COMPONENT_ID
      );
      entity.getComponentData = jest.fn(() => ({
        text: 'Existing description',
      }));

      // Act - Should hit lines 199-202
      const result =
        await anatomyDescriptionService.getOrGenerateBodyDescription(entity);

      // Assert
      expect(result).toBe('Existing description');
    });
  });

  describe('Coverage for Lines 235-239 (Update Description Delegation)', () => {
    it('should delegate updateDescription to persistence service', () => {
      // Arrange - Test lines 235-239
      const entityId = 'test-entity-id';
      const description = 'Test description';

      const persistenceSpy = jest.spyOn(
        testBed.descriptionPersistenceService,
        'updateDescription'
      );

      // Act - Should hit lines 235-239
      anatomyDescriptionService.updateDescription(entityId, description);

      // Assert
      expect(persistenceSpy).toHaveBeenCalledWith(entityId, description);

      persistenceSpy.mockRestore();
    });
  });

  describe('Coverage for Lines 245 (Missing Entity in Update)', () => {
    it('should handle missing entity in updateDescription gracefully', () => {
      // Arrange - Service without persistence service for fallback
      const serviceWithoutPersistence = new AnatomyDescriptionService({
        bodyPartDescriptionBuilder: testBed.mockBodyPartDescriptionBuilder,
        bodyDescriptionComposer: testBed.bodyDescriptionComposer,
        bodyGraphService: testBed.bodyGraphService,
        entityFinder: testBed.entityManager,
        componentManager: testBed.mockComponentManager,
        eventDispatchService: testBed.mocks.eventDispatchService,
        // No persistence service
      });

      const nonExistentId = 'definitely-does-not-exist-' + Date.now();

      // Act - Should hit line 245 (early return)
      expect(() => {
        serviceWithoutPersistence.updateDescription(
          nonExistentId,
          'description'
        );
      }).not.toThrow();
    });
  });

  describe('Coverage for Lines 263-277 (Regenerate Descriptions)', () => {
    it('should handle regenerateDescriptions for valid anatomy entity', () => {
      // Arrange - Test lines 263-277
      const entity = testBed.createMockEntity();
      entity.id = 'test-entity-id';
      entity.hasComponent = jest.fn(() => true);
      entity.getComponentData = jest.fn(() => ({
        body: { root: 'test-root' },
      }));

      // Mock the entity finder to return our mock entity
      const originalGetEntity = testBed.entityManager.getEntityInstance;
      testBed.entityManager.getEntityInstance = jest.fn(() => entity);

      const generateAllSpy = jest.spyOn(
        anatomyDescriptionService,
        'generateAllDescriptions'
      );
      generateAllSpy.mockImplementation(() => Promise.resolve());

      // Act - Should hit lines 263-277
      anatomyDescriptionService.regenerateDescriptions(entity.id);

      // Assert
      expect(entity.hasComponent).toHaveBeenCalledWith(
        ANATOMY_BODY_COMPONENT_ID
      );
      expect(generateAllSpy).toHaveBeenCalledWith(entity);

      // Restore
      testBed.entityManager.getEntityInstance = originalGetEntity;
      generateAllSpy.mockRestore();
    });

    it('should handle regenerateDescriptions with missing entity gracefully', () => {
      // Arrange - Use non-existent entity ID
      const nonExistentId = 'definitely-does-not-exist-' + Date.now();

      // Act - Should hit early return in regenerateDescriptions
      expect(() => {
        anatomyDescriptionService.regenerateDescriptions(nonExistentId);
      }).not.toThrow();
    });

    it('should handle regenerateDescriptions with non-anatomy entity gracefully', () => {
      // Arrange
      const entity = testBed.createMockEntity();
      entity.id = 'test-entity-id';
      entity.hasComponent = jest.fn(() => false); // No anatomy:body component

      // Mock the entity finder to return our mock entity
      const originalGetEntity = testBed.entityManager.getEntityInstance;
      testBed.entityManager.getEntityInstance = jest.fn(() => entity);

      // Act - Should hit early return in regenerateDescriptions
      expect(() => {
        anatomyDescriptionService.regenerateDescriptions(entity.id);
      }).not.toThrow();

      // Assert
      expect(entity.hasComponent).toHaveBeenCalledWith(
        ANATOMY_BODY_COMPONENT_ID
      );

      // Restore
      testBed.entityManager.getEntityInstance = originalGetEntity;
    });
  });

  describe('Always Return False for Description Current', () => {
    it('should always return false for isDescriptionCurrent', () => {
      // Arrange
      const mockEntity = { id: 'test' };

      // Act
      const result = anatomyDescriptionService.isDescriptionCurrent(mockEntity);

      // Assert - Should hit line 263
      expect(result).toBe(false);
    });
  });
});
