/**
 * @file Core integration tests for AnatomyDescriptionService focusing on service delegation
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import SimplifiedAnatomyTestBed from '../../common/anatomy/simplifiedAnatomyTestBed.js';
import { DESCRIPTION_COMPONENT_ID } from '../../../src/constants/componentIds.js';

describe('AnatomyDescriptionService - Core Integration', () => {
  let testBed;

  beforeEach(() => {
    testBed = new SimplifiedAnatomyTestBed();
    testBed.loadMinimalComponents();
    testBed.loadMinimalEntityDefinitions();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('updateDescription delegation', () => {
    it('should delegate updateDescription to persistence service when available', async () => {
      // Arrange
      const anatomyDescriptionService =
        await testBed.createAnatomyDescriptionService({
          withPersistence: true,
        });

      const entity = await testBed.createTestEntity();
      const description = 'Updated description';

      // Create spy on the mocked eventDispatcher to track persistence service calls
      const updateSpy = jest.fn();
      testBed.mocks.eventDispatcher.dispatch = updateSpy;

      // Act
      anatomyDescriptionService.updateDescription(entity.id, description);

      // Assert - Check that the entity has the description component
      const updatedEntity = testBed.entityManager.getEntityInstance(entity.id);
      const descriptionData = updatedEntity.getComponentData(
        DESCRIPTION_COMPONENT_ID
      );
      expect(descriptionData).toBeTruthy();
      expect(descriptionData.text).toBe(description);
    });

    it('should fall back to component manager when persistence service unavailable', async () => {
      // Arrange
      const componentManagerSpy = jest.fn();
      const mockComponentManager = {
        addComponent: componentManagerSpy,
        updateComponent: jest.fn(),
      };

      const anatomyDescriptionService =
        await testBed.createAnatomyDescriptionService({
          withPersistence: false,
          componentManager: mockComponentManager,
        });

      const entity = await testBed.createTestEntity();
      const description = 'Fallback description';

      // Act
      anatomyDescriptionService.updateDescription(entity.id, description);

      // Assert
      expect(componentManagerSpy).toHaveBeenCalledWith(
        entity.id,
        DESCRIPTION_COMPONENT_ID,
        { text: description }
      );
    });

    it('should handle missing entity in updateDescription gracefully', async () => {
      // Arrange
      const anatomyDescriptionService =
        await testBed.createAnatomyDescriptionService({
          withPersistence: false,
        });

      const nonExistentId = 'non-existent-' + Date.now();

      // Act & Assert - Should not throw
      expect(() => {
        anatomyDescriptionService.updateDescription(
          nonExistentId,
          'description'
        );
      }).not.toThrow();
    });
  });

  describe('isDescriptionCurrent behavior', () => {
    it('should always return false for isDescriptionCurrent', async () => {
      // Arrange
      const anatomyDescriptionService =
        await testBed.createAnatomyDescriptionService();
      const entity = await testBed.createTestEntity();

      // Act
      const result = anatomyDescriptionService.isDescriptionCurrent(entity);

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('Service delegation for body description orchestration', () => {
    it('should delegate to bodyDescriptionOrchestrator when available', async () => {
      // Arrange
      const mockOrchestrator = {
        generateAllDescriptions: jest.fn().mockResolvedValue({
          bodyDescription: 'Orchestrated body description',
          partDescriptions: new Map([['part1', 'Part 1 description']]),
        }),
      };

      const anatomyDescriptionService =
        await testBed.createAnatomyDescriptionService({
          bodyDescriptionOrchestrator: mockOrchestrator,
          withPersistence: true,
        });

      const entity = await testBed.createTestEntity(true);

      // Act
      await anatomyDescriptionService.generateAllDescriptions(entity);

      // Assert
      expect(mockOrchestrator.generateAllDescriptions).toHaveBeenCalledWith(
        entity
      );
    });

    it('should fall back to original implementation when orchestrator unavailable', async () => {
      // Arrange
      const mockBodyGraphService = {
        getAllParts: jest.fn().mockReturnValue(['part1', 'part2']),
      };

      const mockComposer = {
        composeDescription: jest
          .fn()
          .mockResolvedValue('Fallback body description'),
      };

      const anatomyDescriptionService =
        await testBed.createAnatomyDescriptionService({
          bodyDescriptionOrchestrator: null, // No orchestrator
          bodyGraphService: mockBodyGraphService,
          bodyDescriptionComposer: mockComposer,
        });

      const entity = await testBed.createTestEntity(true);

      // Act
      await anatomyDescriptionService.generateAllDescriptions(entity);

      // Assert
      expect(mockBodyGraphService.getAllParts).toHaveBeenCalled();
      expect(mockComposer.composeDescription).toHaveBeenCalledWith(entity);
    });
  });

  describe('getOrGenerateBodyDescription delegation', () => {
    it('should delegate getOrGenerateBodyDescription to orchestrator', async () => {
      // Arrange
      const mockOrchestrator = {
        getOrGenerateBodyDescription: jest
          .fn()
          .mockResolvedValue('Orchestrated description'),
      };

      const anatomyDescriptionService =
        await testBed.createAnatomyDescriptionService({
          bodyDescriptionOrchestrator: mockOrchestrator,
          withPersistence: true,
        });

      const entity = await testBed.createTestEntity(true);

      // Act
      const result =
        await anatomyDescriptionService.getOrGenerateBodyDescription(entity);

      // Assert
      expect(
        mockOrchestrator.getOrGenerateBodyDescription
      ).toHaveBeenCalledWith(entity);
      expect(result).toBe('Orchestrated description');
    });

    it('should handle null entity in getOrGenerateBodyDescription', async () => {
      // Arrange
      const anatomyDescriptionService =
        await testBed.createAnatomyDescriptionService();

      // Act
      const result =
        await anatomyDescriptionService.getOrGenerateBodyDescription(null);

      // Assert
      expect(result).toBeNull();
    });

    it('should return existing description for non-anatomy entity', async () => {
      // Arrange
      const mockComposer = {
        composeDescription: jest.fn().mockResolvedValue('Existing description'),
      };

      const anatomyDescriptionService =
        await testBed.createAnatomyDescriptionService({
          bodyDescriptionComposer: mockComposer,
        });

      const entity = await testBed.createTestEntity(false); // No anatomy

      // Add description to entity
      await testBed.entityManager.addComponent(
        entity.id,
        DESCRIPTION_COMPONENT_ID,
        {
          text: 'Existing description',
        }
      );

      // Act
      const result =
        await anatomyDescriptionService.getOrGenerateBodyDescription(entity);

      // Assert
      expect(result).toBe('Existing description');
    });
  });

  describe('Part description generation', () => {
    it('should delegate part description generation to specialized service', async () => {
      // Arrange
      const mockGenerator = {
        generatePartDescription: jest
          .fn()
          .mockReturnValue('Generated part description'),
      };

      const anatomyDescriptionService =
        await testBed.createAnatomyDescriptionService({
          partDescriptionGenerator: mockGenerator,
          withPersistence: true,
        });

      const partEntity = await testBed.entityManager.createEntityInstance(
        'anatomy:humanoid_arm'
      );

      // Act
      anatomyDescriptionService.generatePartDescription(partEntity.id);

      // Assert
      expect(mockGenerator.generatePartDescription).toHaveBeenCalledWith(
        partEntity.id
      );
    });

    it('should handle missing entity in generatePartDescription gracefully', async () => {
      // Arrange
      const anatomyDescriptionService =
        await testBed.createAnatomyDescriptionService();
      const nonExistentId = 'non-existent-part-' + Date.now();

      // Act & Assert - Should not throw
      expect(() => {
        anatomyDescriptionService.generatePartDescription(nonExistentId);
      }).not.toThrow();
    });
  });
});
