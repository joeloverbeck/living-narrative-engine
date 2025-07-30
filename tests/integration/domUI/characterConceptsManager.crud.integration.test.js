/**
 * @file Integration tests for Character Concepts Manager CRUD operations
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { CommonBootstrapper } from '../../../src/bootstrapper/CommonBootstrapper.js';
import { CharacterConceptsManagerController } from '../../../src/domUI/characterConceptsManagerController.js';
import { CharacterBuilderService } from '../../../src/characterBuilder/services/characterBuilderService.js';
import { CharacterStorageService } from '../../../src/characterBuilder/services/characterStorageService.js';
import { CharacterDatabase } from '../../../src/characterBuilder/storage/characterDatabase.js';
import EventBus from '../../../src/events/eventBus.js';
import ValidatedEventDispatcher from '../../../src/events/validatedEventDispatcher.js';
import { SafeEventDispatcher } from '../../../src/events/safeEventDispatcher.js';
import ConsoleLogger from '../../../src/logging/consoleLogger.js';
import AjvSchemaValidator from '../../../src/validation/ajvSchemaValidator.js';
import { MockThematicDirectionGenerator } from '../../common/mocks/mockThematicDirectionGenerator.js';

describe('Character Concepts Manager - CRUD Integration', () => {
  let bootstrapResult;
  let controller;
  let builderService;
  let storageService;
  let eventBus;
  let container;
  let logger;
  let validatedDispatcher;
  let mockDirectionGenerator;
  let schemaValidator;
  let gameDataRepository;
  let characterDatabase;

  beforeEach(async () => {
    // Set up DOM structure
    document.body.innerHTML = `
      <div class="app-content">
        <div id="concept-create-btn" class="concept-card create-new"></div>
        <div id="concepts-results" class="concepts-grid"></div>
        <div id="empty-state" class="empty-state" style="display: none;">
          <p>No character concepts yet.</p>
        </div>
        <div id="loading-state" class="loading-state" style="display: none;">
          <p>Loading...</p>
        </div>
        <div id="error-state" class="error-state" style="display: none;">
          <p class="error-message"></p>
        </div>
        <div id="statistics">
          <span id="total-concepts">0</span>
          <span id="concepts-with-directions">0</span>
          <span id="total-directions">0</span>
          <span id="average-directions">0</span>
          <span id="completion-rate">0</span>
        </div>
      </div>
      
      <!-- Modals -->
      <div id="concept-modal" class="modal" style="display: none;">
        <div class="modal-header">
          <h2 id="modal-title">Create Character Concept</h2>
          <button class="close-btn">&times;</button>
        </div>
        <div class="modal-body">
          <textarea id="concept-text" placeholder="Enter character concept..."></textarea>
        </div>
        <div class="modal-footer">
          <button id="concept-save-btn" class="btn primary">Save</button>
          <button id="concept-cancel-btn" class="btn">Cancel</button>
        </div>
      </div>
      
      <div id="delete-modal" class="modal" style="display: none;">
        <div class="modal-header">
          <h2>Confirm Delete</h2>
        </div>
        <div class="modal-body">
          <p id="delete-message">Are you sure you want to delete this concept?</p>
        </div>
        <div class="modal-footer">
          <button id="confirm-delete-btn" class="btn danger">Delete</button>
          <button id="cancel-delete-btn" class="btn">Cancel</button>
        </div>
      </div>
    `;

    // Initialize core services
    logger = new ConsoleLogger({ prefix: 'Test' });
    eventBus = new EventBus({ logger });
    
    // Bootstrap to load event definitions
    const bootstrapper = new CommonBootstrapper();
    bootstrapResult = await bootstrapper.bootstrap({
      containerConfigType: 'minimal',
      skipModLoading: true,  // Skip mod loading to avoid network requests
    });

    // Get services from bootstrap result
    container = bootstrapResult.container;
    const { tokens } = await import('../../../src/dependencyInjection/tokens.js');
    gameDataRepository = container.resolve(tokens.IGameDataRepository);
    schemaValidator = container.resolve(tokens.ISchemaValidator);
    
    // Create validated dispatcher with all required dependencies
    validatedDispatcher = new ValidatedEventDispatcher({
      logger,
      eventBus,
      gameDataRepository,
      schemaValidator,
    });
    
    // Create safe dispatcher that wraps the validated dispatcher
    const safeDispatcher = new SafeEventDispatcher({ 
      logger, 
      validatedEventDispatcher: validatedDispatcher 
    });

    // Create character database
    characterDatabase = new CharacterDatabase({ logger });
    
    // Create storage service with all required dependencies
    storageService = new CharacterStorageService({ 
      logger,
      database: characterDatabase,
      schemaValidator,
    });
    await storageService.initialize();
    
    // Create mock direction generator
    mockDirectionGenerator = new MockThematicDirectionGenerator();
    
    builderService = new CharacterBuilderService({
      logger,
      eventBus: safeDispatcher,
      storageService,
      directionGenerator: mockDirectionGenerator,
    });

    // Initialize controller
    controller = new CharacterConceptsManagerController({
      logger,
      eventBus,
      eventDispatcher: safeDispatcher,
      builderService,
      storageService,
    });

    await controller.initialize();
  });

  afterEach(async () => {
    // Clean up IndexedDB
    if (storageService) {
      await storageService.close();
    }
    document.body.innerHTML = '';
  });

  describe('Create Operation', () => {
    it('should create a new concept and update UI', async () => {
      // Arrange
      const conceptText = 'A brave knight from a distant kingdom';
      
      // Act - Open create modal
      document.getElementById('concept-create-btn').click();
      
      // Fill in concept
      const textArea = document.getElementById('concept-text');
      textArea.value = conceptText;
      
      // Save concept
      const saveBtn = document.getElementById('concept-save-btn');
      saveBtn.click();
      
      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Assert
      const concepts = await storageService.getAllCharacterConcepts();
      expect(concepts).toHaveLength(1);
      expect(concepts[0].concept).toBe(conceptText);
      
      // Check UI update
      const conceptCards = document.querySelectorAll('.concept-card:not(.create-new)');
      expect(conceptCards).toHaveLength(1);
      
      // Check statistics
      expect(document.getElementById('total-concepts').textContent).toBe('1');
    });

    it('should dispatch character_concept_created event', async () => {
      // Arrange
      const conceptText = 'An ancient wizard';
      let eventFired = false;
      let eventPayload = null;
      
      eventBus.subscribe('thematic:character_concept_created', (event) => {
        eventFired = true;
        eventPayload = event.payload;
      });
      
      // Act
      const result = await builderService.createCharacterConcept(conceptText);
      
      // Assert
      expect(eventFired).toBe(true);
      expect(eventPayload).toMatchObject({
        conceptId: result.id,
        concept: conceptText,
        autoSaved: true,
      });
    });
  });

  describe('Read Operation', () => {
    it('should load existing concepts on initialization', async () => {
      // Arrange - Create concepts directly
      await builderService.createCharacterConcept('Concept 1');
      await builderService.createCharacterConcept('Concept 2');
      await builderService.createCharacterConcept('Concept 3');
      
      // Act - Reinitialize controller
      const newController = new CharacterConceptsManagerController({
        logger: container.resolve(tokens.ILogger),
        eventBus,
        eventDispatcher: safeDispatcher,
        builderService,
        storageService,
      });
      
      await newController.initialize();
      
      // Assert
      expect(newController.conceptsData).toHaveLength(3);
      const conceptCards = document.querySelectorAll('.concept-card:not(.create-new)');
      expect(conceptCards).toHaveLength(3);
    });
  });

  describe('Update Operation', () => {
    it('should update concept text', async () => {
      // Arrange - Create a concept
      const originalText = 'Original concept';
      const result = await builderService.createCharacterConcept(originalText);
      await controller.loadData();
      
      // Act - Click edit button
      const editBtn = document.querySelector(`[data-concept-id="${result.id}"] .edit-btn`);
      editBtn?.click();
      
      // Update text
      const textArea = document.getElementById('concept-text');
      textArea.value = 'Updated concept';
      
      // Save
      document.getElementById('concept-save-btn').click();
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Assert
      const updatedConcept = await storageService.getCharacterConcept(result.id);
      expect(updatedConcept.concept).toBe('Updated concept');
    });
  });

  describe('Delete Operation', () => {
    it('should delete concept and update UI', async () => {
      // Arrange - Create concepts
      const result1 = await builderService.createCharacterConcept('Concept 1');
      const result2 = await builderService.createCharacterConcept('Concept 2');
      await controller.loadData();
      
      // Act - Delete first concept
      const deleteBtn = document.querySelector(`[data-concept-id="${result1.id}"] .delete-btn`);
      deleteBtn?.click();
      
      // Confirm deletion
      document.getElementById('confirm-delete-btn').click();
      await new Promise(resolve => setTimeout(resolve, 350)); // Wait for animation
      
      // Assert
      const remainingConcepts = await storageService.getAllCharacterConcepts();
      expect(remainingConcepts).toHaveLength(1);
      expect(remainingConcepts[0].id).toBe(result2.id);
      
      // Check UI
      const conceptCards = document.querySelectorAll('.concept-card:not(.create-new)');
      expect(conceptCards).toHaveLength(1);
      
      // Check statistics
      expect(document.getElementById('total-concepts').textContent).toBe('1');
    });

    it('should show empty state when all concepts deleted', async () => {
      // Arrange - Create and delete all concepts
      const result = await builderService.createCharacterConcept('Only concept');
      await controller.loadData();
      
      // Act
      const deleteBtn = document.querySelector(`[data-concept-id="${result.id}"] .delete-btn`);
      deleteBtn?.click();
      
      document.getElementById('confirm-delete-btn').click();
      await new Promise(resolve => setTimeout(resolve, 350));
      
      // Assert
      const emptyState = document.getElementById('empty-state');
      expect(emptyState.style.display).toBe('flex');
      
      const resultsState = document.getElementById('concepts-results').parentElement;
      expect(resultsState.style.display).toBe('none');
    });

    it('should dispatch character_concept_deleted event', async () => {
      // Arrange
      const result = await builderService.createCharacterConcept('To be deleted');
      let eventFired = false;
      let eventPayload = null;
      
      eventBus.subscribe('thematic:character_concept_deleted', (event) => {
        eventFired = true;
        eventPayload = event.payload;
      });
      
      // Act
      await builderService.deleteCharacterConcept(result.id);
      
      // Assert
      expect(eventFired).toBe(true);
      expect(eventPayload).toMatchObject({
        conceptId: result.id,
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle storage errors gracefully', async () => {
      // Arrange - Mock storage error
      const error = new Error('Storage error');
      storageService.storeCharacterConcept = jest.fn().mockRejectedValue(error);
      
      // Act
      const conceptText = 'This will fail';
      let createError = null;
      
      try {
        await builderService.createCharacterConcept(conceptText);
      } catch (e) {
        createError = e;
      }
      
      // Assert
      expect(createError).toBeTruthy();
      expect(createError.message).toContain('Storage error');
      
      // UI should remain functional
      const createBtn = document.getElementById('concept-create-btn');
      expect(createBtn).toBeTruthy();
    });
  });
});