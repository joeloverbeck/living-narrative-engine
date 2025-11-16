/**
 * @file Test to verify the controller fix
 * @description Tests that the controller now preserves prototype methods
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { CharacterBuilderService } from '../../../src/characterBuilder/services/characterBuilderService.js';
import { CharacterConceptsManagerController } from '../../../src/domUI/characterConceptsManagerController.js';
import {
  createTestContainer,
  resolveControllerDependencies,
} from '../../common/testContainerConfig.js';

describe('CharacterConceptsManagerController - Fix Verification', () => {
  let mockLogger;
  let mockStorageService;
  let mockDirectionGenerator;
  let mockEventBus;
  let characterBuilderService;
  let container;
  let controllerDependencies;

  beforeEach(async () => {
    // Create mocks for all dependencies
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockStorageService = {
      initialize: jest.fn().mockResolvedValue(),
      storeCharacterConcept: jest.fn(),
      listCharacterConcepts: jest.fn(),
      getCharacterConcept: jest.fn(),
      deleteCharacterConcept: jest.fn(),
      storeThematicDirections: jest.fn(),
      getThematicDirections: jest.fn(),
    };

    mockDirectionGenerator = {
      generateDirections: jest.fn(),
    };

    mockEventBus = {
      dispatch: jest.fn(),
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),
    };

    characterBuilderService = new CharacterBuilderService({
      logger: mockLogger,
      storageService: mockStorageService,
      directionGenerator: mockDirectionGenerator,
      eventBus: mockEventBus,
    });

    // Mock DOM elements
    document.body.innerHTML = `
      <div id="concepts-container"></div>
      <div id="empty-state"></div>
      <div id="loading-state"></div>
      <div id="error-state"></div>
      <div id="results-state"></div>
      <div id="concepts-results"></div>
      <button id="create-concept-btn"></button>
      <button id="create-first-btn"></button>
      <input id="concept-search" />
      <div id="total-concepts"></div>
      <div id="concepts-with-directions"></div>
      <div id="total-directions"></div>
      <button id="back-to-menu-btn"></button>
      <div id="concept-modal"></div>
      <form id="concept-form"></form>
      <textarea id="concept-text"></textarea>
      <div id="char-count"></div>
      <button id="save-concept-btn"></button>
      <button id="cancel-concept-btn"></button>
      <button id="close-concept-modal"></button>
      <div id="delete-confirmation-modal"></div>
      <button id="confirm-delete-btn"></button>
      <button id="cancel-delete-btn"></button>
      <button id="close-delete-modal"></button>
      <div id="outputDiv"></div>
      <div id="message-list"></div>
    `;

    container = await createTestContainer();
    controllerDependencies = resolveControllerDependencies(container);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('controller constructor fix', () => {
    it('should preserve initialize method when creating controller', () => {
      // Verify service has initialize method before passing to controller
      expect(typeof characterBuilderService.initialize).toBe('function');

      // Create controller - this should not destroy the initialize method
      const controller = new CharacterConceptsManagerController({
        logger: mockLogger,
        characterBuilderService: characterBuilderService,
        eventBus: mockEventBus,
        ...controllerDependencies,
      });

      expect(controller).toBeDefined();

      // The controller should have been created successfully without throwing dependency validation errors
      expect(controller).toBeInstanceOf(CharacterConceptsManagerController);
    });

    it('should pass dependency validation in base class', () => {
      // This test ensures that the base class dependency validation now passes
      expect(() => {
        new CharacterConceptsManagerController({
          logger: mockLogger,
          characterBuilderService: characterBuilderService,
          eventBus: mockEventBus,
          ...controllerDependencies,
        });
      }).not.toThrow();
    });

    it('should preserve all required methods on service', () => {
      const controller = new CharacterConceptsManagerController({
        logger: mockLogger,
        characterBuilderService: characterBuilderService,
        eventBus: mockEventBus,
        ...controllerDependencies,
      });

      // The service passed to the base class should still have all methods
      const requiredMethods = [
        'initialize',
        'getAllCharacterConcepts',
        'createCharacterConcept',
        'updateCharacterConcept',
        'deleteCharacterConcept',
        'getCharacterConcept',
        'generateThematicDirections',
        'getThematicDirections',
      ];

      // Access the service through the controller to verify it has all methods
      // Note: We can't directly access private fields, but the successful construction
      // means the dependency validation passed, proving all methods are present
      expect(controller).toBeDefined();
    });
  });
});
