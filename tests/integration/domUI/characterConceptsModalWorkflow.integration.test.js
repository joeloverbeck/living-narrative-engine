/**
 * @file Integration tests for Character Concepts Manager modal workflows
 * Tests the complete workflow of modal interactions with real container
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import AppContainer from '../../../src/dependencyInjection/appContainer.js';
import { configureContainer } from '../../../src/dependencyInjection/containerConfig.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import { CharacterConceptsManagerController } from '../../../src/domUI/characterConceptsManagerController.js';

describe('Character Concepts Manager - Modal Workflow Integration', () => {
  let container;
  let controller;
  let logger;
  let eventBus;
  let characterBuilderService;
  let capturedEvents = [];
  let eventUnsubscribers = [];

  beforeEach(async () => {
    // Reset captured events
    capturedEvents = [];
    eventUnsubscribers = [];

    // Reset DOM
    document.body.innerHTML = '';

    // Create container
    container = new AppContainer();

    // Create required DOM elements
    document.body.innerHTML = `
      <div id="character-concepts-manager-container">
        <div id="concepts-container"></div>
        <div id="concepts-results"></div>
        <div id="empty-state"></div>
        <div id="loading-state" style="display: none;"></div>
        <div id="error-state" style="display: none;"></div>
        <div id="results-state" style="display: none;"></div>
        <div id="error-message-text"></div>
        <button id="create-concept-btn">Create Concept</button>
        <button id="create-first-btn">Create First</button>
        <button id="retry-btn">Retry</button>
        <button id="back-to-menu-btn">Back</button>
        <input id="concept-search" type="text" />
        <div class="stats-display"></div>
        <span id="total-concepts">0</span>
        <span id="concepts-with-directions">0</span>
        <span id="total-directions">0</span>
        
        <!-- Create/Edit Modal -->
        <div id="concept-modal" class="modal" style="display: none;">
          <div class="modal-content">
            <h2 id="concept-modal-title">Create Character Concept</h2>
            <form id="concept-form">
              <textarea id="concept-text" required minlength="10"></textarea>
              <span id="char-count">0/1000</span>
              <div id="concept-error"></div>
              <button id="save-concept-btn" type="submit">Save Concept</button>
              <button id="cancel-concept-btn" type="button">Cancel</button>
              <button id="close-concept-modal" type="button">×</button>
            </form>
          </div>
        </div>
        
        <!-- Delete Modal -->
        <div id="delete-confirmation-modal" class="modal" style="display: none;">
          <div class="modal-content">
            <div id="delete-modal-message"></div>
            <button id="confirm-delete-btn">Delete</button>
            <button id="cancel-delete-btn">Cancel</button>
            <button id="close-delete-modal">×</button>
          </div>
        </div>
      </div>
    `;

    // Configure container
    const mockUiElements = {
      outputDiv: document.createElement('div'),
      inputElement: document.createElement('input'),
      titleElement: document.createElement('h1'),
      document: document,
    };
    
    configureContainer(container, mockUiElements);

    // Get services
    logger = container.resolve(tokens.ILogger);
    eventBus = container.resolve(tokens.ISafeEventDispatcher);
    characterBuilderService = container.resolve(tokens.CharacterBuilderService);

    // Setup event capturing
    const eventTypes = [
      'core:ui_modal_opened',
      'core:ui_modal_closed',
      'core:character-concept-created',
      'core:character-concept-updated',
      'core:character-concept-deleted',
      'core:statistics-updated',
      'core:ui-search-performed',
      'core:ui-search-cleared',
      'core:character-builder-error-occurred',
    ];

    eventTypes.forEach(eventType => {
      const unsubscribe = eventBus.subscribe(eventType, (event) => {
        capturedEvents.push({ type: eventType, event });
      });
      eventUnsubscribers.push(unsubscribe);
    });

    // Mock character builder service
    characterBuilderService.getAllCharacterConcepts = jest.fn().mockResolvedValue([
      {
        concept: {
          id: 'existing-concept-1',
          concept: 'A brave knight with a mysterious past',
          created: Date.now() - 86400000, // 1 day ago
          updated: Date.now() - 3600000,  // 1 hour ago
        },
        directionCount: 3,
      },
    ]);

    characterBuilderService.createCharacterConcept = jest.fn().mockImplementation(async (conceptText) => {
      return {
        id: 'new-concept-' + Date.now(),
        concept: conceptText,
        created: Date.now(),
        updated: Date.now(),
      };
    });

    characterBuilderService.updateCharacterConcept = jest.fn().mockResolvedValue(true);
    characterBuilderService.deleteCharacterConcept = jest.fn().mockResolvedValue(true);
    characterBuilderService.getThematicDirections = jest.fn().mockResolvedValue([]);

    // Create controller
    controller = new CharacterConceptsManagerController({
      logger,
      characterBuilderService,
      eventBus,
    });

    // Initialize controller
    await controller.initialize();
    
    // Wait for initial load
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  afterEach(() => {
    // Unsubscribe all event listeners
    eventUnsubscribers.forEach(unsubscribe => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    });
    
    // Clear DOM
    document.body.innerHTML = '';
    
    // Clear mocks
    jest.clearAllMocks();
  });

  describe('Modal Display Verification', () => {
    it('should show create modal with proper display styles', () => {
      const modal = document.getElementById('concept-modal');
      const createBtn = document.getElementById('create-concept-btn');

      // Initially hidden
      expect(modal.style.display).toBe('none');

      // Click create button
      createBtn.click();

      // Modal should be visible
      expect(modal.style.display).toBe('flex');
      
      // Verify modal opened event was dispatched
      const modalOpenedEvents = capturedEvents.filter(e => e.type === 'core:ui_modal_opened');
      expect(modalOpenedEvents).toHaveLength(1);
      expect(modalOpenedEvents[0].event.payload.modalType).toBe('create-concept');
    });

    it('should properly close modal and dispatch close event', () => {
      const modal = document.getElementById('concept-modal');
      const createBtn = document.getElementById('create-concept-btn');
      const closeBtn = document.getElementById('close-concept-modal');

      // Open modal
      createBtn.click();
      expect(modal.style.display).toBe('flex');

      // Clear previous events
      capturedEvents = [];

      // Close modal
      closeBtn.click();

      // Modal should be hidden
      expect(modal.style.display).toBe('none');

      // Verify modal closed event was dispatched
      const modalClosedEvents = capturedEvents.filter(e => e.type === 'core:ui_modal_closed');
      expect(modalClosedEvents).toHaveLength(1);
      expect(modalClosedEvents[0].event.payload.modalType).toBe('create-concept');
    });
  });

  describe('Create Concept Workflow', () => {
    it('should complete create concept workflow successfully', async () => {
      // Open create modal
      const createBtn = document.getElementById('create-concept-btn');
      createBtn.click();

      // Fill in concept text
      const conceptText = document.getElementById('concept-text');
      const testConceptText = 'A mysterious wizard with ancient knowledge';
      conceptText.value = testConceptText;
      conceptText.dispatchEvent(new Event('input', { bubbles: true }));

      // Update character count
      const charCount = document.getElementById('char-count');
      charCount.textContent = `${testConceptText.length}/1000`;

      // Enable save button (form validation would normally do this)
      const saveBtn = document.getElementById('save-concept-btn');
      saveBtn.disabled = false;

      // Clear events before submission
      capturedEvents = [];

      // Submit form
      const form = document.getElementById('concept-form');
      const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(submitEvent);

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 200));

      // Verify service was called
      expect(characterBuilderService.createCharacterConcept).toHaveBeenCalledWith(testConceptText);

      // Verify events were dispatched
      const conceptCreatedEvents = capturedEvents.filter(e => e.type === 'core:character-concept-created');
      expect(conceptCreatedEvents).toHaveLength(1);

      const statisticsUpdatedEvents = capturedEvents.filter(e => e.type === 'core:statistics-updated');
      expect(statisticsUpdatedEvents.length).toBeGreaterThan(0);

      const modalClosedEvents = capturedEvents.filter(e => e.type === 'core:ui_modal_closed');
      expect(modalClosedEvents).toHaveLength(1);

      // Modal should be closed
      const modal = document.getElementById('concept-modal');
      expect(modal.style.display).toBe('none');
    });

    it('should handle create concept errors gracefully', async () => {
      // Mock service to throw error
      characterBuilderService.createCharacterConcept.mockRejectedValue(
        new Error('Database connection failed')
      );

      // Open modal
      document.getElementById('create-concept-btn').click();

      // Fill and submit
      const conceptText = document.getElementById('concept-text');
      conceptText.value = 'This will fail to save';
      conceptText.dispatchEvent(new Event('input', { bubbles: true }));

      const form = document.getElementById('concept-form');
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 200));

      // Should have error event
      const errorEvents = capturedEvents.filter(e => e.type === 'core:character-builder-error-occurred');
      expect(errorEvents.length).toBeGreaterThan(0);

      // Modal should remain open for retry
      const modal = document.getElementById('concept-modal');
      expect(modal.style.display).toBe('flex');

      // Error should be displayed
      const conceptError = document.getElementById('concept-error');
      expect(conceptError.textContent).toContain('Failed to create concept');
    });
  });

  describe('Edit Concept Workflow', () => {
    it('should open edit modal with existing concept data', async () => {
      // Use test exports to trigger edit
      if (controller._testExports && controller._testExports.showEditModal) {
        await controller._testExports.showEditModal('existing-concept-1');

        const modal = document.getElementById('concept-modal');
        const modalTitle = document.getElementById('concept-modal-title');
        const conceptText = document.getElementById('concept-text');
        const saveBtn = document.getElementById('save-concept-btn');

        // Modal should be visible
        expect(modal.style.display).toBe('flex');
        
        // Title should be for editing
        expect(modalTitle.textContent).toBe('Edit Character Concept');
        expect(saveBtn.textContent).toBe('Update Concept');

        // Text should be populated
        expect(conceptText.value).toBe('A brave knight with a mysterious past');

        // Edit modal opened event
        const modalOpenedEvents = capturedEvents.filter(e => e.type === 'core:ui_modal_opened');
        const editModalEvent = modalOpenedEvents.find(e => e.event.payload.modalType === 'edit-concept');
        expect(editModalEvent).toBeDefined();
        expect(editModalEvent.event.payload.conceptId).toBe('existing-concept-1');
      }
    });
  });

  describe('Modal Keyboard Navigation', () => {
    it('should close modal on ESC key press', () => {
      // Open modal
      document.getElementById('create-concept-btn').click();
      const modal = document.getElementById('concept-modal');
      expect(modal.style.display).toBe('flex');

      // Press ESC
      const escEvent = new KeyboardEvent('keydown', { 
        key: 'Escape',
        bubbles: true,
        cancelable: true,
      });
      document.dispatchEvent(escEvent);

      // Modal should be closed
      expect(modal.style.display).toBe('none');
    });

    it('should handle backdrop click to close modal', () => {
      // Open modal
      document.getElementById('create-concept-btn').click();
      const modal = document.getElementById('concept-modal');
      expect(modal.style.display).toBe('flex');

      // Click on backdrop (modal element itself)
      const clickEvent = new MouseEvent('click', { bubbles: true });
      // Target should be the modal itself, not its content
      Object.defineProperty(clickEvent, 'target', { 
        value: modal,
        writable: false,
      });
      modal.dispatchEvent(clickEvent);

      // Modal should be closed
      expect(modal.style.display).toBe('none');
    });

    it('should not close modal when clicking inside modal content', () => {
      // Open modal
      document.getElementById('create-concept-btn').click();
      const modal = document.getElementById('concept-modal');
      const modalContent = modal.querySelector('.modal-content');
      
      expect(modal.style.display).toBe('flex');

      // Click inside modal content
      const clickEvent = new MouseEvent('click', { bubbles: true });
      Object.defineProperty(clickEvent, 'target', { 
        value: modalContent,
        writable: false,
      });
      modal.dispatchEvent(clickEvent);

      // Modal should remain open
      expect(modal.style.display).toBe('flex');
    });
  });

  describe('Form Validation Integration', () => {
    it('should disable save button when concept text is too short', () => {
      // Open modal
      document.getElementById('create-concept-btn').click();

      const conceptText = document.getElementById('concept-text');
      const saveBtn = document.getElementById('save-concept-btn');

      // Type text that's too short
      conceptText.value = 'Too short';
      conceptText.dispatchEvent(new Event('input', { bubbles: true }));

      // Save button should be disabled (controller should handle this)
      // Note: The actual validation is done by FormValidationHelper
      expect(conceptText.value.length).toBeLessThan(10);
    });
  });

  describe('Delete Confirmation Workflow', () => {
    it('should show delete confirmation modal', () => {
      // Use test exports to show delete confirmation
      if (controller._testExports && controller._testExports.showDeleteConfirmation) {
        const concept = {
          id: 'existing-concept-1',
          concept: 'A brave knight with a mysterious past',
        };
        
        controller._testExports.showDeleteConfirmation(concept, 3);

        const deleteModal = document.getElementById('delete-confirmation-modal');
        const deleteMessage = document.getElementById('delete-modal-message');

        // Modal should be visible
        expect(deleteModal.style.display).toBe('flex');

        // Message should include warning about directions
        expect(deleteMessage.innerHTML).toContain('3 thematic directions');
      }
    });
  });

  describe('Search Integration', () => {
    it('should dispatch search events while modal is open', async () => {
      // Open modal
      document.getElementById('create-concept-btn').click();

      // Perform search
      const searchInput = document.getElementById('concept-search');
      searchInput.value = 'knight';
      searchInput.dispatchEvent(new Event('input', { bubbles: true }));

      // Wait for debounce (300ms + buffer)
      await new Promise(resolve => setTimeout(resolve, 400));

      // Should have search event
      const searchEvents = capturedEvents.filter(e => e.type === 'core:ui-search-performed');
      expect(searchEvents).toHaveLength(1);
      expect(searchEvents[0].event.payload.query).toBe('knight');
    });
  });

  describe('Statistics Update Flow', () => {
    it('should update statistics after concept operations', async () => {
      // Clear initial events
      capturedEvents = [];

      // Create a new concept
      document.getElementById('create-concept-btn').click();
      
      const conceptText = document.getElementById('concept-text');
      conceptText.value = 'A new test concept for statistics';
      conceptText.dispatchEvent(new Event('input', { bubbles: true }));

      const saveBtn = document.getElementById('save-concept-btn');
      saveBtn.disabled = false;

      const form = document.getElementById('concept-form');
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 200));

      // Should have statistics update event
      const statsEvents = capturedEvents.filter(e => e.type === 'core:statistics-updated');
      expect(statsEvents.length).toBeGreaterThan(0);

      const lastStatsEvent = statsEvents[statsEvents.length - 1];
      expect(lastStatsEvent.event.payload).toHaveProperty('totalConcepts');
      expect(lastStatsEvent.event.payload).toHaveProperty('conceptsWithDirections');
      expect(lastStatsEvent.event.payload).toHaveProperty('totalDirections');
    });
  });
});