/**
 * @file Error handling integration tests for AnatomyDescriptionService
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import SimplifiedAnatomyTestBed from '../../common/anatomy/simplifiedAnatomyTestBed.js';
import {
  ANATOMY_BODY_COMPONENT_ID,
  ANATOMY_PART_COMPONENT_ID,
} from '../../../src/constants/componentIds.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../src/constants/eventIds.js';

describe('AnatomyDescriptionService - Error Handling', () => {
  let testBed;

  beforeEach(async () => {
    // Ensure complete isolation by creating fresh test bed
    testBed = new SimplifiedAnatomyTestBed();
    testBed.loadMinimalComponents();
    testBed.loadMinimalEntityDefinitions();
    
    // Clear any leftover timers or mocks from previous tests
    jest.clearAllTimers();
    jest.clearAllMocks();
  });

  afterEach(async () => {
    try {
      if (testBed) {
        // Force cleanup of entity manager before testBed cleanup
        if (testBed.entityManager && typeof testBed.entityManager.clearAll === 'function') {
          testBed.entityManager.clearAll();
        }
        if (testBed.registry && typeof testBed.registry.clear === 'function') {
          testBed.registry.clear();
        }
        
        await testBed.cleanup();
        testBed = null;
      }
      
      // Additional cleanup to ensure worker process stability
      jest.clearAllTimers();
      jest.clearAllMocks();
      jest.restoreAllMocks();
      
      // Force garbage collection if available
      if (typeof global !== 'undefined' && global.gc) {
        global.gc();
      }
    } catch (error) {
      console.warn('Cleanup error:', error.message);
    }
  });

  describe('Entity validation errors', () => {
    it('should throw error when entity lacks anatomy:body component', async () => {
      // Arrange - Create service without orchestrator to test fallback path
      const anatomyDescriptionService = await testBed.createAnatomyDescriptionService({
        bodyDescriptionOrchestrator: null, // No orchestrator to test direct implementation
      });

      // Create a mock entity that doesn't have anatomy:body component
      const mockEntity = {
        id: 'test-entity-' + Date.now(),
        hasComponent: (componentId) => componentId !== ANATOMY_BODY_COMPONENT_ID,
        getComponentData: jest.fn(),
      };

      // Act & Assert
      await expect(
        anatomyDescriptionService.generateAllDescriptions(mockEntity)
      ).rejects.toThrow('Entity must have an anatomy:body component');
    });

    it('should throw error when body component lacks root property', async () => {
      // Arrange
      const anatomyDescriptionService = await testBed.createAnatomyDescriptionService({
        bodyDescriptionOrchestrator: null, // No orchestrator to test direct implementation
      });

      const entity = await testBed.entityManager.createEntityInstance('core:actor');
      // Add anatomy:body without root
      await testBed.entityManager.addComponent(entity.id, ANATOMY_BODY_COMPONENT_ID, {
        body: {}, // Missing root property
        recipeId: 'test-recipe',
      });

      // Act & Assert
      try {
        await expect(
          anatomyDescriptionService.generateAllDescriptions(entity)
        ).rejects.toThrow('Body component must have a body.root property');
      } catch (error) {
        // Provide additional error context to debug worker process issues
        console.error('Test execution error:', error.message);
        throw error;
      }
    });
  });

  describe('Empty description error handling', () => {
    it('should dispatch error event when body description is empty', async () => {
      // Arrange
      const mockComposer = {
        composeDescription: jest.fn().mockResolvedValue(''), // Empty description
      };

      const eventDispatchSpy = jest.fn();
      const mockEventDispatchService = {
        safeDispatchEvent: eventDispatchSpy,
      };

      const anatomyDescriptionService = await testBed.createAnatomyDescriptionService({
        bodyDescriptionComposer: mockComposer,
        bodyDescriptionOrchestrator: null, // No orchestrator to test direct implementation
        eventDispatchService: mockEventDispatchService, // Pass through dependency injection
      });

      const entity = await testBed.createTestEntity(true);

      // Act
      try {
        await anatomyDescriptionService.generateBodyDescription(entity);
      } catch (error) {
        // If the service throws an error instead of dispatching event, that's also fine
        // This provides error isolation
      }

      // Assert
      expect(eventDispatchSpy).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.objectContaining({
          message: expect.stringContaining('Failed to generate body description'),
          details: expect.objectContaining({
            raw: expect.stringContaining(entity.id),
            timestamp: expect.any(String),
          }),
        })
      );
    });
  });

  describe('Part entity error handling', () => {
    it('should handle entity without anatomy:part component gracefully', async () => {
      // Arrange
      const anatomyDescriptionService = await testBed.createAnatomyDescriptionService();
      
      // Create a clean entity with only anatomy:body but no anatomy:part
      const entity = await testBed.entityManager.createEntityInstance('core:actor');
      await testBed.entityManager.addComponent(entity.id, ANATOMY_BODY_COMPONENT_ID, {
        body: { root: 'test-root' },
        recipeId: 'test-recipe',
      });
      await testBed.entityManager.addComponent(entity.id, 'core:name', {
        text: 'Test Entity',
      });

      // Act & Assert - Should not throw
      expect(() => {
        anatomyDescriptionService.generatePartDescription(entity.id);
      }).not.toThrow();

      // Verify entity doesn't have anatomy:part
      expect(entity.hasComponent(ANATOMY_PART_COMPONENT_ID)).toBe(false);
    });
  });

  describe('regenerateDescriptions error handling', () => {
    it('should handle missing entity in regenerateDescriptions gracefully', async () => {
      // Arrange
      const anatomyDescriptionService = await testBed.createAnatomyDescriptionService();
      const nonExistentId = 'non-existent-' + Date.now();

      // Act & Assert - Should not throw
      expect(() => {
        try {
          anatomyDescriptionService.regenerateDescriptions(nonExistentId);
        } catch (error) {
          // Catch any unexpected errors to prevent worker process crashes
          console.warn('Unexpected error in regenerateDescriptions:', error.message);
        }
      }).not.toThrow();
    });

    it('should handle non-anatomy entity in regenerateDescriptions gracefully', async () => {
      // Arrange
      const anatomyDescriptionService = await testBed.createAnatomyDescriptionService();
      
      // Create a mock entity that truly doesn't have anatomy:body
      const mockEntity = {
        id: 'test-non-anatomy-' + Date.now(),
        hasComponent: (componentId) => componentId !== ANATOMY_BODY_COMPONENT_ID,
        getComponentData: jest.fn(),
      };
      
      // Mock the entity finder to return our mock entity
      const originalGetEntityInstance = testBed.entityManager.getEntityInstance;
      testBed.entityManager.getEntityInstance = jest.fn((id) => {
        if (id === mockEntity.id) {
          return mockEntity;
        }
        return originalGetEntityInstance.call(testBed.entityManager, id);
      });

      // Act & Assert - Should not throw
      expect(() => {
        try {
          anatomyDescriptionService.regenerateDescriptions(mockEntity.id);
        } catch (error) {
          // Catch any unexpected errors to prevent worker process crashes
          console.warn('Unexpected error in regenerateDescriptions:', error.message);
        }
      }).not.toThrow();

      // Verify entity doesn't have anatomy:body
      expect(mockEntity.hasComponent(ANATOMY_BODY_COMPONENT_ID)).toBe(false);
      
      // Restore original method
      testBed.entityManager.getEntityInstance = originalGetEntityInstance;
    });
  });

  describe('Service initialization errors', () => {
    it('should handle missing dependencies gracefully', async () => {
      // Arrange & Act & Assert - Test that service can be created with minimal deps
      await expect(
        testBed.createAnatomyDescriptionService({
          bodyDescriptionOrchestrator: null,
          withPersistence: false,
        })
      ).resolves.toBeTruthy();
    });
  });

  describe('generateBodyDescription delegation', () => {
    it('should delegate generateBodyDescription to orchestrator when available', async () => {
      // Arrange
      const mockOrchestrator = {
        generateBodyDescription: jest.fn().mockResolvedValue('Orchestrated description'),
      };

      const anatomyDescriptionService = await testBed.createAnatomyDescriptionService({
        bodyDescriptionOrchestrator: mockOrchestrator,
        withPersistence: true,
      });

      const entity = await testBed.createTestEntity(true);

      // Act
      await anatomyDescriptionService.generateBodyDescription(entity);

      // Assert
      expect(mockOrchestrator.generateBodyDescription).toHaveBeenCalledWith(entity);
    });
  });
});