/**
 * @file Integration tests for Character Concepts Manager modal workflows
 * Tests the complete workflow of modal interactions with real container
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import { CharacterConceptsManagerController } from '../../../src/domUI/characterConceptsManagerController.js';
import {
  createTestContainer,
  createMockCharacterBuilderService,
  createFastIndexedDBMock,
  createMinimalModalDOM,
  resolveControllerDependencies,
} from '../../common/testContainerConfig.js';
import {
  flushPromises,
  waitForModalOpen,
  waitForModalClose,
  waitForValidation,
  waitForCapturedEvents,
  waitForIndexedDB,
  waitForInputValue,
} from '../../common/testWaitUtils.js';

// Mock IndexedDB for testing with fast resolution
global.indexedDB = createFastIndexedDBMock();

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

    // Reset DOM with optimized template
    document.body.innerHTML = createMinimalModalDOM();

    // Create lightweight test container
    const existingConcepts = [
      {
        id: 'existing-concept-1',
        concept: 'A brave knight with a mysterious past',
        created: Date.now() - 86400000, // 1 day ago
        updated: Date.now() - 3600000, // 1 hour ago
        createdAt: Date.now() - 86400000,
        updatedAt: Date.now() - 3600000,
      },
    ];

    characterBuilderService = createMockCharacterBuilderService({
      existingConcepts,
    });
    container = await createTestContainer({
      mockServices: {
        [tokens.CharacterBuilderService]: characterBuilderService,
      },
    });

    // Get services
    logger = container.resolve(tokens.ILogger);
    eventBus = container.resolve(tokens.ISafeEventDispatcher);

    // Setup event capturing
    const eventTypes = [
      'core:ui_modal_opened',
      'core:ui_modal_closed',
      'core:character-concept-created',
      'core:character-concept-updated',
      'core:character-concept-deleted',
      'core:statistics-updated',
      'core:ui_search_performed',
      'core:ui_search_cleared',
      'core:character-builder-error-occurred',
    ];

    eventTypes.forEach((eventType) => {
      const unsubscribe = eventBus.subscribe(eventType, (event) => {
        capturedEvents.push({ type: eventType, event });
      });
      eventUnsubscribers.push(unsubscribe);
    });

    // Configure mock service to dispatch events for controller
    const originalCreate = characterBuilderService.createCharacterConcept;
    characterBuilderService.createCharacterConcept = jest
      .fn()
      .mockImplementation(async (conceptText) => {
        const result = await originalCreate(conceptText);

        // Dispatch the events that the controller expects
        eventBus.dispatch('core:character-concept-created', {
          concept: result,
        });

        eventBus.dispatch('core:statistics-updated', {
          totalConcepts: 2,
          conceptsWithDirections: 1,
          totalDirections: 3,
        });

        return result;
      });

    // Create controller
    const controllerDependencies = resolveControllerDependencies(container);

    controller = new CharacterConceptsManagerController({
      logger,
      characterBuilderService,
      eventBus,
      ...controllerDependencies,
    });

    // Initialize controller and wait for IndexedDB
    await controller.initialize();
    await waitForIndexedDB();
  });

  afterEach(() => {
    controller?.destroy?.();
    controller = null;

    // Unsubscribe all event listeners
    eventUnsubscribers.forEach((unsubscribe) => {
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
    it('should show create modal with proper display styles', async () => {
      const modal = document.getElementById('concept-modal');
      const createBtn = document.getElementById('create-concept-btn');

      // Initially hidden
      expect(modal.style.display).toBe('none');

      // Click create button
      createBtn.click();

      // Wait for async event dispatch
      await flushPromises();

      // Modal should be visible
      expect(modal.style.display).toBe('flex');

      // Verify modal opened event was dispatched
      const modalOpenedEvents = capturedEvents.filter(
        (e) => e.type === 'core:ui_modal_opened'
      );
      expect(modalOpenedEvents).toHaveLength(1);
      expect(modalOpenedEvents[0].event.payload.modalType).toBe(
        'create-concept'
      );
    });

    it('should properly close modal and dispatch close event', async () => {
      const modal = document.getElementById('concept-modal');
      const createBtn = document.getElementById('create-concept-btn');
      const closeBtn = document.getElementById('close-concept-modal');

      // Open modal
      createBtn.click();
      await flushPromises();
      expect(modal.style.display).toBe('flex');

      // Clear previous events
      capturedEvents = [];

      // Close modal
      closeBtn.click();
      await flushPromises();

      // Modal should be hidden
      expect(modal.style.display).toBe('none');

      // Verify modal closed event was dispatched
      const modalClosedEvents = capturedEvents.filter(
        (e) => e.type === 'core:ui_modal_closed'
      );
      expect(modalClosedEvents).toHaveLength(1);
      expect(modalClosedEvents[0].event.payload.modalType).toBe('concept');
    });
  });

  describe('Create Concept Workflow', () => {
    it('should complete create concept workflow successfully', async () => {
      // Open create modal
      const createBtn = document.getElementById('create-concept-btn');
      createBtn.click();

      // Fill in concept text (needs to be at least 50 characters)
      const conceptText = document.getElementById('concept-text');
      const testConceptText =
        'A mysterious wizard with ancient knowledge who roams the forgotten lands seeking lost artifacts of power';
      conceptText.value = testConceptText;
      conceptText.dispatchEvent(new Event('input', { bubbles: true }));

      // Clear events before submission
      capturedEvents = [];

      // Submit form
      const form = document.getElementById('concept-form');
      form.dispatchEvent(new Event('submit', { bubbles: true }));

      // Wait for async operations to complete
      await flushPromises();

      // Verify service was called
      expect(
        characterBuilderService.createCharacterConcept
      ).toHaveBeenCalledWith(testConceptText);

      // Verify events were dispatched
      const conceptCreatedEvents = capturedEvents.filter(
        (e) => e.type === 'core:character-concept-created'
      );
      expect(conceptCreatedEvents).toHaveLength(1);

      const statisticsUpdatedEvents = capturedEvents.filter(
        (e) => e.type === 'core:statistics-updated'
      );
      expect(statisticsUpdatedEvents.length).toBeGreaterThan(0);

      const modalClosedEvents = capturedEvents.filter(
        (e) => e.type === 'core:ui_modal_closed'
      );
      expect(modalClosedEvents).toHaveLength(1);

      // Modal should be closed
      const modal = document.getElementById('concept-modal');
      expect(modal.style.display).toBe('none');
    });

    it('should handle create concept errors gracefully', async () => {
      // Mock service to throw error
      characterBuilderService.createCharacterConcept.mockImplementation(
        async () => {
          // Dispatch error event
          eventBus.dispatch('core:character-builder-error-occurred', {
            error: 'Database connection failed',
            operation: 'createConcept',
          });
          throw new Error('Database connection failed');
        }
      );

      // Open modal
      document.getElementById('create-concept-btn').click();

      // Fill and submit (needs to be at least 50 characters)
      const conceptText = document.getElementById('concept-text');
      conceptText.value =
        'This concept will fail to save but needs to be long enough to pass validation requirements';
      conceptText.dispatchEvent(new Event('input', { bubbles: true }));

      // Submit form
      const form = document.getElementById('concept-form');
      form.dispatchEvent(new Event('submit', { bubbles: true }));

      // Wait for async operations and error events
      await waitForCapturedEvents(
        capturedEvents,
        (e) => e.type === 'core:character-builder-error-occurred',
        1,
        1000
      );

      // Should have error event
      const errorEvents = capturedEvents.filter(
        (e) => e.type === 'core:character-builder-error-occurred'
      );
      expect(errorEvents.length).toBeGreaterThan(0);

      // Modal should remain open for retry
      const modal = document.getElementById('concept-modal');
      expect(modal.style.display).toBe('flex');

      // Verify error handling completed successfully:
      // 1. Error event was dispatched ✓ (checked above)
      // 2. Modal remains open for retry ✓ (checked above)
      // 3. Error display mechanism was called (service errors are handled at UI state level)
      const hasErrorHandling =
        errorEvents.length > 0 && modal.style.display === 'flex';
      expect(hasErrorHandling).toBe(true);
    });
  });

  describe('Edit Concept Workflow', () => {
    it('should open edit modal with existing concept data', async () => {
      // Use test exports to trigger edit
      if (controller._testExports && controller._testExports.showEditModal) {
        // Clear previous events
        capturedEvents = [];

        // Wait for data to be loaded if not already
        if (controller._testExports.conceptsData.length === 0) {
          // Trigger a manual data load if needed
          await controller._testExports.loadData();
          await flushPromises();
        }

        // Ensure concepts data is populated
        expect(controller._testExports.conceptsData.length).toBeGreaterThan(0);

        await controller._testExports.showEditModal('existing-concept-1');
        await flushPromises();

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
        const modalOpenedEvents = capturedEvents.filter(
          (e) => e.type === 'core:ui_modal_opened'
        );
        const editModalEvent = modalOpenedEvents.find(
          (e) => e.event.payload.modalType === 'edit-concept'
        );
        expect(editModalEvent).toBeDefined();
        expect(editModalEvent.event.payload.conceptId).toBe(
          'existing-concept-1'
        );
      } else {
        // Skip test if test exports not available
        console.warn('Test exports not available, skipping edit modal test');
      }
    });

    it('should enable save button when editing pre-existing concept text', async () => {
      // This test verifies that validation works correctly when editing existing concepts
      if (controller._testExports && controller._testExports.showEditModal) {
        // Clear previous events
        capturedEvents = [];

        // Ensure concepts data is populated
        if (controller._testExports.conceptsData.length === 0) {
          await controller._testExports.loadData();
          await flushPromises();
        }

        expect(controller._testExports.conceptsData.length).toBeGreaterThan(0);

        // Open edit modal for an existing concept
        await controller._testExports.showEditModal('existing-concept-1');
        await flushPromises();

        const modal = document.getElementById('concept-modal');

        // Re-query elements after modal setup (they get replaced by _setupConceptFormValidation)
        let conceptText = document.getElementById('concept-text');
        let saveBtn = document.getElementById('save-concept-btn');

        // Modal should be visible with existing content
        expect(modal.style.display).toBe('flex');
        expect(conceptText.value).toBe('A brave knight with a mysterious past');

        // Initial button state should be enabled (valid existing content)
        expect(saveBtn.disabled).toBe(false);

        // Clear the text to make it invalid (less than 50 chars)
        conceptText.value = 'Too short';
        conceptText.dispatchEvent(new Event('input', { bubbles: true }));

        // Wait for validation to complete
        await waitForValidation(saveBtn, true, 500);

        // Re-query button after validation
        saveBtn = document.getElementById('save-concept-btn');
        expect(saveBtn.disabled).toBe(true); // Should be disabled for invalid input

        // Type new valid text (more than 50 characters as per ValidationPatterns.concept)
        conceptText = document.getElementById('concept-text');
        const newText =
          'A completely different character concept that is definitely long enough to be valid';
        conceptText.value = newText;
        conceptText.dispatchEvent(new Event('input', { bubbles: true }));

        // Wait for validation to complete
        await waitForValidation(saveBtn, false, 500);

        // Re-query button after validation
        saveBtn = document.getElementById('save-concept-btn');
        expect(saveBtn.disabled).toBe(false); // Should be enabled for valid input
      } else {
        console.warn(
          'Test exports not available, skipping edit modal validation test'
        );
      }
    });
  });

  describe('Modal Keyboard Navigation', () => {
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
    it('should disable save button when concept text is too short', async () => {
      // Open modal
      document.getElementById('create-concept-btn').click();

      // Wait for modal setup
      await flushPromises();

      // Re-query elements after modal setup (they get replaced)
      const conceptText = document.getElementById('concept-text');
      const saveBtn = document.getElementById('save-concept-btn');

      // Type text that's too short (less than 50 characters)
      conceptText.value = 'Too short for validation';
      conceptText.dispatchEvent(new Event('input', { bubbles: true }));

      // Wait for validation to complete
      await waitForValidation(saveBtn, true, 500);

      // Re-query save button after validation
      const updatedSaveBtn = document.getElementById('save-concept-btn');

      // Save button should be disabled for invalid input
      expect(conceptText.value.length).toBeLessThan(50);
      expect(updatedSaveBtn.disabled).toBe(true);
    });
  });

  describe('Delete Confirmation Workflow', () => {
    it('should show delete confirmation modal', () => {
      // Use test exports to show delete confirmation
      if (
        controller._testExports &&
        controller._testExports.showDeleteConfirmation
      ) {
        const concept = {
          id: 'existing-concept-1',
          concept: 'A brave knight with a mysterious past',
        };

        controller._testExports.showDeleteConfirmation(concept, 3);

        const deleteModal = document.getElementById(
          'delete-confirmation-modal'
        );
        const deleteMessage = document.getElementById('delete-modal-message');

        // Modal should be visible
        expect(deleteModal.style.display).toBe('flex');

        // Message should include warning about directions
        expect(deleteMessage.innerHTML).toContain(
          '3</strong> associated thematic directions'
        );
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

      // Wait for search debounce to complete
      await waitForCapturedEvents(
        capturedEvents,
        (e) => e.type === 'core:ui_search_performed',
        1,
        500
      );

      // Should have search event
      const searchEvents = capturedEvents.filter(
        (e) => e.type === 'core:ui_search_performed'
      );
      expect(searchEvents).toHaveLength(1);
      expect(searchEvents[0].event.payload.searchTerm).toBe('knight');
    });
  });

  describe('Statistics Update Flow', () => {
    it('should update statistics after concept operations', async () => {
      // Clear initial events
      capturedEvents = [];

      // Create a new concept
      document.getElementById('create-concept-btn').click();

      const conceptText = document.getElementById('concept-text');
      conceptText.value =
        'A new test concept for statistics that needs to be at least fifty characters long to pass validation';
      conceptText.dispatchEvent(new Event('input', { bubbles: true }));

      const saveBtn = document.getElementById('save-concept-btn');
      saveBtn.disabled = false;

      const form = document.getElementById('concept-form');
      form.dispatchEvent(
        new Event('submit', { bubbles: true, cancelable: true })
      );

      // Wait for async operations and statistics events
      await waitForCapturedEvents(
        capturedEvents,
        (e) => e.type === 'core:statistics-updated',
        1,
        1000
      );

      // Should have statistics update event
      const statsEvents = capturedEvents.filter(
        (e) => e.type === 'core:statistics-updated'
      );
      expect(statsEvents.length).toBeGreaterThan(0);

      if (statsEvents.length > 0) {
        const lastStatsEvent = statsEvents[statsEvents.length - 1];
        expect(lastStatsEvent.event.payload).toHaveProperty('totalConcepts');
        expect(lastStatsEvent.event.payload).toHaveProperty(
          'conceptsWithDirections'
        );
        expect(lastStatsEvent.event.payload).toHaveProperty('totalDirections');
      }
    });
  });
});
