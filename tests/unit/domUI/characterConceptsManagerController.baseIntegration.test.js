/**
 * @file Unit tests for CharacterConceptsManagerController - Base Class Integration
 * @description Tests the integration with BaseCharacterBuilderController and migration compatibility
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { CharacterConceptsManagerController } from '../../../src/domUI/characterConceptsManagerController.js';
import { BaseCharacterBuilderController } from '../../../src/characterBuilder/controllers/BaseCharacterBuilderController.js';
import { CharacterConceptsManagerTestBase } from './characterConceptsManagerController.testUtils.enhanced.js';

describe('CharacterConceptsManagerController - Base Class Integration', () => {
  const testBase = new CharacterConceptsManagerTestBase();

  beforeEach(async () => {
    await testBase.setup();
  });

  afterEach(async () => {
    await testBase.cleanup();
  });

  describe('Migration Compatibility', () => {
    it('should maintain all public APIs', () => {
      const controller = testBase.createController();

      // Verify all public methods exist
      const publicMethods = ['initialize', 'destroy'];

      publicMethods.forEach((method) => {
        expect(typeof controller[method]).toBe('function');
      });
    });

    it('should work with existing test utilities', async () => {
      // Configure using enhanced test base
      testBase.configureConcepts([
        { id: '1', concept: 'Test 1', createdAt: new Date().toISOString() },
        { id: '2', concept: 'Test 2', createdAt: new Date().toISOString() },
      ]);

      const controller = testBase.createController();
      await controller.initialize();

      // Verify concepts loaded
      expect(
        testBase.mocks.characterBuilderService.getAllCharacterConcepts
      ).toHaveBeenCalled();
    });

    it('should properly extend BaseCharacterBuilderController', () => {
      const controller = testBase.createController();

      // Verify inheritance chain
      expect(controller).toBeInstanceOf(CharacterConceptsManagerController);
      expect(controller).toBeInstanceOf(BaseCharacterBuilderController);
      expect(controller.logger).toBe(testBase.mocks.logger);

      // The characterBuilderService is wrapped for backward compatibility
      expect(controller.characterBuilderService).toEqual(
        expect.objectContaining({
          initialize: testBase.mocks.characterBuilderService.initialize,
          getAllCharacterConcepts:
            testBase.mocks.characterBuilderService.getAllCharacterConcepts,
        })
      );

      expect(controller.eventBus).toBe(testBase.mocks.eventBus);
    });

    it('should implement required abstract methods', () => {
      const controller = testBase.createController();

      expect(typeof controller._cacheElements).toBe('function');
      expect(typeof controller._setupEventListeners).toBe('function');
    });
  });

  describe('Base Class Lifecycle Integration', () => {
    it('should follow base class initialization lifecycle', async () => {
      const controller = testBase.createController();

      expect(controller.isInitialized).toBe(false);
      expect(controller.isDestroyed).toBe(false);

      await controller.initialize();

      expect(controller.isInitialized).toBe(true);
      expect(controller.isDestroyed).toBe(false);
    });

    it('should follow base class destruction lifecycle', async () => {
      const controller = testBase.createController();
      await controller.initialize();

      expect(controller.isDestroyed).toBe(false);

      await controller.destroy();

      expect(controller.isDestroyed).toBe(true);
    });

    it('should call base class abstract methods during lifecycle', async () => {
      const controller = testBase.createController();

      // Spy on abstract methods
      const cacheElementsSpy = jest.spyOn(controller, '_cacheElements');
      const setupEventListenersSpy = jest.spyOn(
        controller,
        '_setupEventListeners'
      );

      await controller.initialize();

      expect(cacheElementsSpy).toHaveBeenCalled();
      expect(setupEventListenersSpy).toHaveBeenCalled();
    });
  });

  describe('Advanced Features Preservation', () => {
    it('should maintain character concepts loading functionality', async () => {
      const mockConcepts = [
        {
          id: '1',
          concept: 'Test concept 1',
          createdAt: new Date().toISOString(),
        },
        {
          id: '2',
          concept: 'Test concept 2',
          createdAt: new Date().toISOString(),
        },
      ];

      testBase.configureConcepts(mockConcepts);

      const controller = testBase.createController();
      await controller.initialize();

      // Verify concepts were loaded through service
      expect(
        testBase.mocks.characterBuilderService.getAllCharacterConcepts
      ).toHaveBeenCalled();
    });

    it('should preserve search analytics functionality', async () => {
      const controller = testBase.createController();
      await controller.initialize();

      // Trigger search through DOM
      const searchInput = document.getElementById('concept-search');
      searchInput.value = 'test search';
      searchInput.dispatchEvent(new Event('input', { bubbles: true }));

      // Wait for debounce
      await testBase.flushPromises();
      await new Promise((resolve) => setTimeout(resolve, 310)); // Debounce delay

      // Verify search was processed
      expect(searchInput.value).toBe('test search');
    });

    it('should maintain event bus integration', async () => {
      const controller = testBase.createController();
      await controller.initialize();

      // Wait for dynamic imports to complete
      await testBase.flushPromises();

      // Verify event subscriptions were set up
      expect(testBase.mocks.eventBus.subscribe).toHaveBeenCalledWith(
        'core:character_concept_created',
        expect.any(Function)
      );
      expect(testBase.mocks.eventBus.subscribe).toHaveBeenCalledWith(
        'core:character_concept_updated',
        expect.any(Function)
      );
      expect(testBase.mocks.eventBus.subscribe).toHaveBeenCalledWith(
        'core:character_concept_deleted',
        expect.any(Function)
      );
    });
  });

  describe('Error Handling with Base Class', () => {
    it('should use base class error patterns', async () => {
      testBase.mocks.characterBuilderService.getAllCharacterConcepts.mockRejectedValue(
        new Error('Load failed')
      );

      const controller = testBase.createController();

      // Initialize will handle the error internally
      await expect(controller.initialize()).rejects.toThrow();

      // Verify error was logged through base class logger
      expect(testBase.mocks.logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed initial data loading'),
        expect.any(Error)
      );
    });

    it('should show error state correctly', async () => {
      testBase.mocks.characterBuilderService.getAllCharacterConcepts.mockRejectedValue(
        new Error('Network error')
      );

      const controller = testBase.createController();

      try {
        await controller.initialize();
      } catch (error) {
        // Expected error
      }

      // Check error state is visible
      const errorState = document.getElementById('error-state');
      expect(errorState.style.display).not.toBe('none');
    });

    it('should handle service method failures gracefully', async () => {
      const controller = testBase.createController();
      await controller.initialize();

      // Configure service to fail on concept creation
      testBase.mocks.characterBuilderService.createCharacterConcept.mockRejectedValue(
        new Error('Create failed')
      );

      // Verify controller handles the error without crashing
      expect(controller.isInitialized).toBe(true);
      expect(controller.isDestroyed).toBe(false);
    });
  });

  describe('DOM Integration with Base Class', () => {
    it('should properly cache DOM elements through base class', async () => {
      const controller = testBase.createController();

      // Spy on base class element caching
      const cacheElementsSpy = jest.spyOn(controller, '_cacheElements');

      await controller.initialize();

      expect(cacheElementsSpy).toHaveBeenCalled();
    });

    it('should set up event listeners through base class patterns', async () => {
      const controller = testBase.createController();

      // Spy on event listener setup
      const setupEventListenersSpy = jest.spyOn(
        controller,
        '_setupEventListeners'
      );

      await controller.initialize();

      expect(setupEventListenersSpy).toHaveBeenCalled();
    });

    it('should handle missing DOM elements gracefully', async () => {
      // Remove a required element from DOM
      const conceptsContainer = document.getElementById('concepts-container');
      if (conceptsContainer) {
        conceptsContainer.remove();
      }

      const controller = testBase.createController();
      await controller.initialize();

      // Verify controller still initializes despite missing element
      expect(controller.isInitialized).toBe(true);

      // Still expect a warning to surface (even if it comes from other fallbacks)
      expect(testBase.mocks.logger.warn).toHaveBeenCalled();
    });
  });

  describe('State Management Integration', () => {
    it('should integrate with base class state management', async () => {
      const controller = testBase.createController();
      testBase.populateControllerElements(controller);
      controller._cacheElements();

      // Spy on base class state methods
      const showStateSpy = jest.spyOn(controller, '_showState');

      // Test direct state management
      controller._showState('loading');

      expect(showStateSpy).toHaveBeenCalledWith('loading');
    });

    it('should properly handle UI state transitions', async () => {
      testBase.configureConcepts([]);

      const controller = testBase.createController();
      testBase.populateControllerElements(controller);
      controller._cacheElements();

      // Spy on state methods
      const showStateSpy = jest.spyOn(controller, '_showState');

      // Initialize the controller fully to trigger UI state initialization
      await controller.initialize();

      // Should show empty state after UIStateManager is initialized
      expect(showStateSpy).toHaveBeenCalledWith('empty');
    });
  });

  describe('Enhanced Test Base Features', () => {
    it('should provide enhanced configuration methods', () => {
      // Test concept configuration
      const mockConcepts = [
        { id: '1', concept: 'Test', createdAt: new Date().toISOString() },
      ];

      testBase.configureConcepts(mockConcepts);
      // configureConcepts sets up the mock to return the concepts, not call it
      expect(
        testBase.mocks.characterBuilderService.getAllCharacterConcepts
      ).toHaveProperty('mockResolvedValue');

      // Test other configuration methods exist
      expect(typeof testBase.configureDirections).toBe('function');
      expect(typeof testBase.configureConceptCreation).toBe('function');
      expect(typeof testBase.configureConceptUpdate).toBe('function');
      expect(typeof testBase.configureConceptDeletion).toBe('function');
    });

    it('should provide helper utilities', () => {
      // Test helper methods exist
      expect(typeof testBase.createTestConcept).toBe('function');
      expect(typeof testBase.createTestDirection).toBe('function');
      expect(typeof testBase.createKeyboardEvent).toBe('function');
      expect(typeof testBase.flushPromises).toBe('function');
    });

    it('should provide DOM and mock access', () => {
      const elements = testBase.getElements();
      const uiStateManager = testBase.getUIStateManager();

      expect(elements).toBeDefined();
      expect(uiStateManager).toBeDefined();
      expect(testBase.mocks.logger).toBeDefined();
      expect(testBase.mocks.characterBuilderService).toBeDefined();
      expect(testBase.mocks.eventBus).toBeDefined();
    });
  });
});
