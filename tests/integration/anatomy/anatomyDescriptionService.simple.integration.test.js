/**
 * @file Simple integration tests for AnatomyDescriptionService
 * Basic tests to verify service functionality and improve coverage
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import AnatomyIntegrationTestBed from '../../common/anatomy/anatomyIntegrationTestBed.js';
import { AnatomyDescriptionService } from '../../../src/anatomy/anatomyDescriptionService.js';

describe('AnatomyDescriptionService - Simple Integration', () => {
  let testBed;
  let anatomyDescriptionService;

  beforeEach(() => {
    testBed = new AnatomyIntegrationTestBed();

    // Use existing test data from testBed
    testBed.loadCoreTestData();

    // Use the service from testBed
    anatomyDescriptionService = testBed.anatomyDescriptionService;
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('Basic Service Operations', () => {
    it('should handle isDescriptionCurrent always returning false', () => {
      // Arrange
      const mockEntity = { id: 'test' };

      // Act
      const result = anatomyDescriptionService.isDescriptionCurrent(mockEntity);

      // Assert
      expect(result).toBe(false);
    });

    it('should handle updateDescription delegation to persistence service', () => {
      // Arrange
      const entityId = 'test-entity-id';
      const description = 'Test description';

      const persistenceSpy = jest.spyOn(
        testBed.descriptionPersistenceService,
        'updateDescription'
      );

      // Act
      anatomyDescriptionService.updateDescription(entityId, description);

      // Assert
      expect(persistenceSpy).toHaveBeenCalledWith(entityId, description);

      persistenceSpy.mockRestore();
    });

    it('should handle updateDescription fallback to component manager', async () => {
      // Arrange - Create service without persistence service
      const serviceWithoutPersistence = new AnatomyDescriptionService({
        bodyPartDescriptionBuilder: testBed.mockBodyPartDescriptionBuilder,
        bodyDescriptionComposer: testBed.bodyDescriptionComposer,
        bodyGraphService: testBed.bodyGraphService,
        entityFinder: testBed.entityManager,
        componentManager: testBed.mockComponentManager,
        eventDispatchService: testBed.mocks.eventDispatchService,
      });

      // Create a real entity
      const testEntity =
        await testBed.entityManager.createEntityInstance('core:actor');
      const entityId = testEntity.id;
      const description = 'Test description';

      const componentManagerSpy = jest.spyOn(
        testBed.mockComponentManager,
        'addComponent'
      );

      // Act
      serviceWithoutPersistence.updateDescription(entityId, description);

      // Assert
      expect(componentManagerSpy).toHaveBeenCalledWith(
        entityId,
        'core:description',
        { text: description }
      );

      componentManagerSpy.mockRestore();
    });

    it('should handle generatePartDescription with missing entity gracefully', () => {
      // Arrange - Use non-existent entity ID
      const nonExistentId = 'definitely-does-not-exist-' + Date.now();

      // Act & Assert - Should not throw
      expect(() => {
        anatomyDescriptionService.generatePartDescription(nonExistentId);
      }).not.toThrow();
    });

    it('should handle regenerateDescriptions with missing entity gracefully', () => {
      // Arrange - Use non-existent entity ID
      const nonExistentId = 'definitely-does-not-exist-' + Date.now();

      // Act & Assert - Should not throw
      expect(() => {
        anatomyDescriptionService.regenerateDescriptions(nonExistentId);
      }).not.toThrow();
    });

    it('should handle regenerateDescriptions with non-anatomy entity gracefully', async () => {
      // Arrange - Create entity without anatomy:body component
      const testEntity =
        await testBed.entityManager.createEntityInstance('core:actor');

      // Act & Assert - Should not throw
      expect(() => {
        anatomyDescriptionService.regenerateDescriptions(testEntity.id);
      }).not.toThrow();

      // Verify entity exists but doesn't have anatomy:body
      expect(testEntity.hasComponent('anatomy:body')).toBe(false);
    });

    it('should handle getOrGenerateBodyDescription with null entity', async () => {
      // Act
      const result =
        await anatomyDescriptionService.getOrGenerateBodyDescription(null);

      // Assert
      expect(result).toBeNull();
    });

    it('should handle getOrGenerateBodyDescription for non-anatomy entity', async () => {
      // Arrange - Create entity without anatomy:body but with description
      const testEntity =
        await testBed.entityManager.createEntityInstance('core:actor');
      testBed.entityManager.addComponent(testEntity.id, 'core:description', {
        text: 'Existing description',
      });

      // Act
      const result =
        await anatomyDescriptionService.getOrGenerateBodyDescription(
          testEntity
        );

      // Assert
      expect(result).toBe('Existing description');
    });
  });

  describe('Error Handling', () => {
    it('should throw error for generateAllDescriptions without anatomy:body component', async () => {
      // Arrange - Create entity without anatomy:body
      const testEntity =
        await testBed.entityManager.createEntityInstance('core:actor');

      // Act & Assert
      await expect(
        anatomyDescriptionService.generateAllDescriptions(testEntity)
      ).rejects.toThrow('Entity must have an anatomy:body component');
    });

    it('should throw error for generateAllDescriptions with invalid body structure', async () => {
      // Arrange - Create entity with invalid body component
      const testEntity =
        await testBed.entityManager.createEntityInstance('core:actor');
      testBed.entityManager.addComponent(testEntity.id, 'anatomy:body', {
        body: null, // Invalid body
        recipeId: 'test:recipe',
      });

      // Act & Assert
      await expect(
        anatomyDescriptionService.generateAllDescriptions(testEntity)
      ).rejects.toThrow('Body component must have a body.root property');
    });

    it('should handle updateDescription with missing entity gracefully for fallback service', () => {
      // Arrange - Service without persistence service
      const serviceWithoutPersistence = new AnatomyDescriptionService({
        bodyPartDescriptionBuilder: testBed.mockBodyPartDescriptionBuilder,
        bodyDescriptionComposer: testBed.bodyDescriptionComposer,
        bodyGraphService: testBed.bodyGraphService,
        entityFinder: testBed.entityManager,
        componentManager: testBed.mockComponentManager,
        eventDispatchService: testBed.mocks.eventDispatchService,
      });

      // Use non-existent entity ID
      const nonExistentId = 'definitely-does-not-exist-' + Date.now();

      // Act & Assert - Should not throw
      expect(() => {
        serviceWithoutPersistence.updateDescription(
          nonExistentId,
          'description'
        );
      }).not.toThrow();
    });
  });

  describe('Service Delegation', () => {
    it('should delegate to bodyDescriptionOrchestrator when available for generateAllDescriptions', async () => {
      // Arrange - Create entity with anatomy
      const testEntity =
        await testBed.entityManager.createEntityInstance('core:actor');
      testBed.entityManager.addComponent(testEntity.id, 'anatomy:body', {
        body: {
          root: 'test-root',
          parts: { 'test-root': { id: 'test-root' } },
        },
        recipeId: 'test-recipe',
      });

      const orchestratorSpy = jest.spyOn(
        testBed.bodyDescriptionOrchestrator,
        'generateAllDescriptions'
      );
      const persistenceSpy = jest.spyOn(
        testBed.descriptionPersistenceService,
        'updateDescription'
      );

      orchestratorSpy.mockResolvedValue({
        bodyDescription: 'Test body description',
        partDescriptions: new Map([['part1', 'Test part description']]),
      });

      // Act
      await anatomyDescriptionService.generateAllDescriptions(testEntity);

      // Assert
      expect(orchestratorSpy).toHaveBeenCalledWith(testEntity);
      expect(persistenceSpy).toHaveBeenCalledWith(
        testEntity.id,
        'Test body description'
      );

      orchestratorSpy.mockRestore();
      persistenceSpy.mockRestore();
    });

    it('should delegate to bodyDescriptionOrchestrator for getOrGenerateBodyDescription', async () => {
      // Arrange
      const testEntity =
        await testBed.entityManager.createEntityInstance('core:actor');
      testBed.entityManager.addComponent(testEntity.id, 'anatomy:body', {
        body: { root: 'test-root' },
        recipeId: 'test-recipe',
      });

      const orchestratorSpy = jest.spyOn(
        testBed.bodyDescriptionOrchestrator,
        'getOrGenerateBodyDescription'
      );
      const persistenceSpy = jest.spyOn(
        testBed.descriptionPersistenceService,
        'updateDescription'
      );

      orchestratorSpy.mockResolvedValue('Orchestrator description');

      // Act
      const result =
        await anatomyDescriptionService.getOrGenerateBodyDescription(
          testEntity
        );

      // Assert
      expect(orchestratorSpy).toHaveBeenCalledWith(testEntity);
      expect(persistenceSpy).toHaveBeenCalledWith(
        testEntity.id,
        'Orchestrator description'
      );
      expect(result).toBe('Orchestrator description');

      orchestratorSpy.mockRestore();
      persistenceSpy.mockRestore();
    });

    it('should delegate to bodyDescriptionOrchestrator for generateBodyDescription', async () => {
      // Arrange
      const testEntity =
        await testBed.entityManager.createEntityInstance('core:actor');
      testBed.entityManager.addComponent(testEntity.id, 'anatomy:body', {
        body: { root: 'test-root' },
        recipeId: 'test-recipe',
      });

      const orchestratorSpy = jest.spyOn(
        testBed.bodyDescriptionOrchestrator,
        'generateBodyDescription'
      );
      const persistenceSpy = jest.spyOn(
        testBed.descriptionPersistenceService,
        'updateDescription'
      );

      orchestratorSpy.mockResolvedValue('Body description from orchestrator');

      // Act
      await anatomyDescriptionService.generateBodyDescription(testEntity);

      // Assert
      expect(orchestratorSpy).toHaveBeenCalledWith(testEntity);
      expect(persistenceSpy).toHaveBeenCalledWith(
        testEntity.id,
        'Body description from orchestrator'
      );

      orchestratorSpy.mockRestore();
      persistenceSpy.mockRestore();
    });

    it('should delegate part description generation to specialized service', async () => {
      // Arrange - Create a real entity instance
      const partEntity =
        await testBed.entityManager.createEntityInstance('core:actor');
      testBed.entityManager.addComponent(partEntity.id, 'anatomy:part', {
        subType: 'arm',
      });
      const partId = partEntity.id;

      const generatorSpy = jest.spyOn(
        testBed.mockPartDescriptionGenerator,
        'generatePartDescription'
      );
      const persistenceSpy = jest.spyOn(
        testBed.descriptionPersistenceService,
        'updateDescription'
      );

      generatorSpy.mockReturnValue('Generated part description');

      // Act
      anatomyDescriptionService.generatePartDescription(partId);

      // Assert
      expect(generatorSpy).toHaveBeenCalledWith(partId);
      expect(persistenceSpy).toHaveBeenCalledWith(
        partId,
        'Generated part description'
      );

      generatorSpy.mockRestore();
      persistenceSpy.mockRestore();
    });
  });
});
