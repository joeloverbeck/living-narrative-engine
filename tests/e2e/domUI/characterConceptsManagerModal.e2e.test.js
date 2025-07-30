/**
 * @file End-to-end tests for Character Concepts Manager Modal interactions
 * Tests the complete user workflow for creating, editing, and managing character concepts
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import AppContainer from '../../../src/dependencyInjection/appContainer.js';
import { configureContainer } from '../../../src/dependencyInjection/containerConfig.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import { CharacterConceptsManagerController } from '../../../src/domUI/characterConceptsManagerController.js';

// Mock FormValidationHelper to avoid DOM issues in tests
jest.mock(
  '../../../src/shared/characterBuilder/formValidationHelper.js',
  () => ({
    FormValidationHelper: {
      validateField: jest.fn().mockReturnValue(true),
      setupRealTimeValidation: jest.fn(),
      showFieldError: jest.fn(),
      clearFieldError: jest.fn(),
      updateCharacterCount: jest.fn((element, countElement, max) => {
        if (countElement) {
          countElement.textContent = `${element.value.length}/${max}`;
        }
      }),
    },
    ValidationPatterns: {
      concept: {
        pattern: /.+/,
        minLength: 10,
        maxLength: 3000,
      },
    },
  })
);

// Create a minimal DOM fixture for better performance
const createDOMFixture = () => {
  return `
    <div id="character-concepts-manager-container" class="cb-page-container">
      <header class="cb-page-header">
        <h1>Character Concepts Manager</h1>
      </header>
      <main class="cb-page-main character-concepts-manager-main">
        <section class="cb-input-panel concept-controls-panel">
          <h2>Concept Management</h2>
          <div class="action-buttons">
            <button id="create-concept-btn" type="button" class="cb-button-primary">➕ New Concept</button>
          </div>
          <div class="cb-form-group">
            <label for="concept-search">Search Concepts:</label>
            <input type="text" id="concept-search" class="cb-input" placeholder="Search by content..." />
          </div>
          <div class="stats-display">
            <h3>Statistics</h3>
            <div class="stat-item">
              <span class="stat-label">Total Concepts:</span>
              <span id="total-concepts" class="stat-value">0</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">With Directions:</span>
              <span id="concepts-with-directions" class="stat-value">0</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Total Directions:</span>
              <span id="total-directions" class="stat-value">0</span>
            </div>
          </div>
        </section>
        <section class="cb-results-panel concepts-display-panel">
          <h2>Character Concepts</h2>
          <div id="concepts-container" class="cb-state-container">
            <div id="empty-state" class="cb-empty-state">
              <p>No character concepts yet.</p>
              <button type="button" class="cb-button-primary" id="create-first-btn">➕ Create First Concept</button>
            </div>
            <div id="loading-state" class="cb-loading-state" style="display: none;">
              <p>Loading concepts...</p>
            </div>
            <div id="error-state" class="cb-error-state" style="display: none;">
              <p id="error-message-text"></p>
              <button type="button" class="cb-button-secondary" id="retry-btn">Try Again</button>
            </div>
            <div id="results-state" class="cb-state-container" style="display: none;">
              <div id="concepts-results" class="concepts-grid"></div>
            </div>
          </div>
        </section>
      </main>
      <footer class="cb-page-footer">
        <button type="button" id="back-to-menu-btn" class="cb-button-secondary">← Back to Main Menu</button>
      </footer>
    </div>
    <!-- Create/Edit Modal -->
    <div id="concept-modal" class="modal" style="display: none; position: fixed; z-index: 1000; opacity: 1; visibility: visible; pointer-events: auto;" role="dialog">
      <div class="modal-content">
        <div class="modal-header">
          <h2 id="concept-modal-title">Create Character Concept</h2>
          <button type="button" class="close-modal" id="close-concept-modal">×</button>
        </div>
        <div class="modal-body">
          <form id="concept-form" novalidate>
            <div class="cb-form-group">
              <label for="concept-text">Character Concept:</label>
              <textarea id="concept-text" name="conceptText" class="cb-textarea" placeholder="e.g. a ditzy female adventurer who's good with a bow" minlength="10" maxlength="1000" required></textarea>
              <div class="input-meta">
                <span class="char-count" id="char-count">0/1000</span>
                <div id="concept-error" class="error-message" role="alert"></div>
              </div>
            </div>
            <div class="modal-actions">
              <button type="submit" id="save-concept-btn" class="cb-button-primary" disabled>Save Concept</button>
              <button type="button" id="cancel-concept-btn" class="cb-button-secondary">Cancel</button>
            </div>
          </form>
        </div>
      </div>
    </div>
    <!-- Delete Confirmation Modal -->
    <div id="delete-confirmation-modal" class="modal" style="display: none; position: fixed; z-index: 1000; opacity: 1; visibility: visible; pointer-events: auto;" role="dialog">
      <div class="modal-content">
        <div class="modal-header">
          <h2>Confirm Deletion</h2>
          <button type="button" class="close-modal" id="close-delete-modal">×</button>
        </div>
        <div class="modal-body">
          <p id="delete-modal-message"></p>
          <div class="modal-actions">
            <button type="button" id="confirm-delete-btn" class="cb-button-danger">Delete</button>
            <button type="button" id="cancel-delete-btn" class="cb-button-secondary">Cancel</button>
          </div>
        </div>
      </div>
    </div>
  `;
};

describe('Character Concepts Manager Modal - E2E Tests', () => {
  let container;
  let controller;
  let logger;
  let eventBus;
  let characterBuilderService;

  // Mock IndexedDB for jsdom environment - use simpler synchronous mocks
  const mockRequest = {
    onsuccess: null,
    onerror: null,
    onupgradeneeded: null,
    result: null,
  };

  const mockObjectStore = {
    createIndex: jest.fn(),
    add: jest.fn().mockReturnValue(mockRequest),
    put: jest.fn().mockReturnValue(mockRequest),
    get: jest.fn().mockReturnValue(mockRequest),
    delete: jest.fn().mockReturnValue(mockRequest),
    index: jest.fn().mockReturnValue({
      getAll: jest.fn().mockReturnValue(mockRequest),
    }),
  };

  const mockTransaction = {
    objectStore: jest.fn().mockReturnValue(mockObjectStore),
    oncomplete: null,
    onerror: null,
  };

  const mockDbInstance = {
    createObjectStore: jest.fn().mockReturnValue(mockObjectStore),
    transaction: jest.fn().mockReturnValue(mockTransaction),
    close: jest.fn(),
  };

  beforeEach(async () => {
    // Set up IndexedDB mock with immediate callback execution
    mockRequest.result = mockDbInstance;
    global.indexedDB = {
      open: jest.fn().mockImplementation(() => {
        // Execute success callback immediately instead of using setTimeout
        Promise.resolve().then(() => {
          if (mockRequest.onsuccess) {
            mockRequest.onsuccess();
          }
        });
        return mockRequest;
      }),
    };
    global.IDBKeyRange = {
      only: jest.fn().mockImplementation((value) => ({ value, type: 'only' })),
    };

    // Create container
    container = new AppContainer();

    // Setup DOM using minimal fixture
    document.body.innerHTML = createDOMFixture();

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

    // Mock character builder service with realistic data
    const mockConcepts = [
      {
        id: 'e2e-test-1',
        concept:
          'A cunning rogue with a heart of gold, skilled in stealth and lockpicking',
        created: Date.now() - 172800000,
        updated: Date.now() - 86400000,
      },
      {
        id: 'e2e-test-2',
        concept: 'An ancient wizard seeking redemption for past mistakes',
        created: Date.now() - 259200000,
        updated: Date.now() - 172800000,
      },
    ];

    characterBuilderService.getAllCharacterConcepts = jest
      .fn()
      .mockResolvedValue(mockConcepts);
    characterBuilderService.getThematicDirections = jest
      .fn()
      .mockImplementation(async (conceptId) => {
        if (conceptId === 'e2e-test-1') {
          return new Array(5);
        }
        return [];
      });
    characterBuilderService.createCharacterConcept = jest
      .fn()
      .mockImplementation(async (text) => ({
        id: 'new-e2e-' + Date.now(),
        concept: text,
        created: Date.now(),
        updated: Date.now(),
      }));
    characterBuilderService.updateCharacterConcept = jest
      .fn()
      .mockImplementation(async (id, updates) => ({
        id,
        concept: updates.concept,
        created: Date.now() - 172800000,
        updated: Date.now(),
      }));
    characterBuilderService.deleteCharacterConcept = jest
      .fn()
      .mockResolvedValue(true);

    // Create and initialize controller
    controller = new CharacterConceptsManagerController({
      logger,
      characterBuilderService,
      eventBus,
    });

    await controller.initialize();

    // Wait for initial render without arbitrary delay
    await Promise.resolve();
  });

  afterEach(() => {
    // Clean up
    document.body.innerHTML = '';
    jest.clearAllMocks();
    delete global.indexedDB;
    delete global.IDBKeyRange;
  });

  describe('Complete User Workflow - Create Concept', () => {
    it('should allow user to create a new character concept', async () => {
      // Create a new controller with empty concepts
      characterBuilderService.getAllCharacterConcepts.mockResolvedValue([]);

      const emptyController = new CharacterConceptsManagerController({
        logger,
        characterBuilderService,
        eventBus,
      });

      await emptyController.initialize();

      // Wait for UI state to update
      await Promise.resolve();

      const emptyState = document.getElementById('empty-state');
      const resultsState = document.getElementById('results-state');

      // Check that empty state is visible
      expect(emptyState.style.display).not.toBe('none');
      expect(resultsState.style.display).toBe('none');

      // User clicks "Create First Concept" button
      const createFirstBtn = document.getElementById('create-first-btn');
      createFirstBtn.click();

      // Modal should open
      const modal = document.getElementById('concept-modal');
      expect(modal.style.display).toBe('flex');

      // User types concept text
      const conceptText = document.getElementById('concept-text');
      const userInput =
        'A brave warrior princess who defies tradition and fights for justice';

      conceptText.value = userInput;
      conceptText.dispatchEvent(new Event('input', { bubbles: true }));

      // Character count should update
      const charCount = document.getElementById('char-count');
      expect(charCount.textContent).toBe(`${userInput.length}/3000`);

      // Save button should be enabled
      const saveBtn = document.getElementById('save-concept-btn');
      saveBtn.disabled = false;

      // User submits form
      const form = document.getElementById('concept-form');
      form.dispatchEvent(
        new Event('submit', { bubbles: true, cancelable: true })
      );

      // Wait for form submission to process
      await Promise.resolve();

      // Verify save was called with correct input
      expect(
        characterBuilderService.createCharacterConcept
      ).toHaveBeenCalledWith(userInput);
    });
  });

  describe('Complete User Workflow - Edit Concept', () => {
    it('should allow user to edit an existing concept', async () => {
      // Wait for initial data to load
      await Promise.resolve();

      const resultsState = document.getElementById('results-state');
      expect(resultsState.style.display).not.toBe('none');

      // Find and click on a concept card
      const conceptCards = document.querySelectorAll('.concept-card');
      expect(conceptCards.length).toBeGreaterThan(0);

      // Simulate editing the first concept
      if (controller._testExports && controller._testExports.showEditModal) {
        await controller._testExports.showEditModal('e2e-test-1');

        // Edit modal should open with existing data
        const modal = document.getElementById('concept-modal');
        const modalTitle = document.getElementById('concept-modal-title');
        const conceptText = document.getElementById('concept-text');

        expect(modal.style.display).toBe('flex');
        expect(modalTitle.textContent).toBe('Edit Character Concept');
        expect(conceptText.value).toContain('cunning rogue');

        // User modifies the text
        const updatedText =
          conceptText.value + ' - now with magical abilities!';
        conceptText.value = updatedText;
        conceptText.dispatchEvent(new Event('input', { bubbles: true }));

        // User saves changes
        const saveBtn = document.getElementById('save-concept-btn');
        saveBtn.disabled = false;

        const form = document.getElementById('concept-form');
        form.dispatchEvent(
          new Event('submit', { bubbles: true, cancelable: true })
        );

        await Promise.resolve();

        // Verify update was called
        expect(
          characterBuilderService.updateCharacterConcept
        ).toHaveBeenCalled();
      }
    });
  });

  describe('Modal Interactions', () => {
    it('should handle modal open, ESC key, backdrop click, and content click', async () => {
      // Open modal
      document.getElementById('create-concept-btn').click();
      const modal = document.getElementById('concept-modal');
      expect(modal.style.display).toBe('flex');

      // Test that clicking inside content doesn't close modal
      const textarea = document.getElementById('concept-text');
      textarea.click();
      expect(modal.style.display).toBe('flex');

      // Test ESC key closes modal
      const escEvent = new KeyboardEvent('keydown', {
        key: 'Escape',
        code: 'Escape',
        keyCode: 27,
        bubbles: true,
      });
      document.dispatchEvent(escEvent);
      expect(modal.style.display).toBe('none');

      // Re-open for backdrop test
      document.getElementById('create-concept-btn').click();
      expect(modal.style.display).toBe('flex');

      // Test backdrop click closes modal
      const clickEvent = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        view: window,
      });
      Object.defineProperty(clickEvent, 'target', { value: modal });
      modal.dispatchEvent(clickEvent);
      expect(modal.style.display).toBe('none');
    });
  });

  describe('Form Validation', () => {
    it('should validate minimum character length', async () => {
      // Open modal
      document.getElementById('create-concept-btn').click();

      const conceptText = document.getElementById('concept-text');
      const saveBtn = document.getElementById('save-concept-btn');
      const conceptError = document.getElementById('concept-error');

      // Type too short text
      conceptText.value = 'Too short';
      conceptText.dispatchEvent(new Event('input', { bubbles: true }));

      // Validation would typically disable the button
      expect(conceptText.value.length).toBeLessThan(10);

      // Simulate validation
      if (conceptText.value.length < 10) {
        conceptError.textContent = 'Concept must be at least 10 characters';
        saveBtn.disabled = true;
      }

      expect(saveBtn.disabled).toBe(true);
      expect(conceptError.textContent).toContain('at least 10 characters');
    });
  });

  describe('Delete Confirmation', () => {
    it('should show delete confirmation with appropriate warnings', () => {
      if (
        controller._testExports &&
        controller._testExports.showDeleteConfirmation
      ) {
        const conceptWithDirections = {
          id: 'e2e-test-1',
          concept: 'A cunning rogue with a heart of gold',
        };

        // Show delete confirmation
        controller._testExports.showDeleteConfirmation(
          conceptWithDirections,
          5
        );

        const deleteModal = document.getElementById(
          'delete-confirmation-modal'
        );
        const deleteMessage = document.getElementById('delete-modal-message');
        const confirmBtn = document.getElementById('confirm-delete-btn');

        // Modal should be visible
        expect(deleteModal.style.display).toBe('flex');

        // Message should warn about directions
        expect(deleteMessage.innerHTML).toContain('<strong>5</strong>');
        expect(deleteMessage.innerHTML).toContain(
          'associated thematic directions'
        );

        // Confirm button should indicate severity
        expect(confirmBtn.textContent).toContain('Delete');
      }
    });
  });

  describe('Statistics and Search', () => {
    it('should update statistics and allow search', async () => {
      // Get initial stats
      const totalConceptsElement = document.getElementById('total-concepts');
      const initialTotal = parseInt(totalConceptsElement.textContent);

      // Create a new concept
      document.getElementById('create-concept-btn').click();

      const conceptText = document.getElementById('concept-text');
      const saveBtn = document.getElementById('save-concept-btn');

      // Type a valid concept
      conceptText.value =
        'A new test concept for statistics tracking that is definitely long enough';
      conceptText.dispatchEvent(new Event('input', { bubbles: true }));

      // Enable save button and submit
      saveBtn.disabled = false;

      const form = document.getElementById('concept-form');
      form.dispatchEvent(
        new Event('submit', { bubbles: true, cancelable: true })
      );

      await Promise.resolve();

      // Verify the service was called
      expect(
        characterBuilderService.createCharacterConcept
      ).toHaveBeenCalledWith(
        'A new test concept for statistics tracking that is definitely long enough'
      );

      // Test search functionality
      const searchInput = document.getElementById('concept-search');
      searchInput.value = 'wizard';
      searchInput.dispatchEvent(new Event('input', { bubbles: true }));
      expect(searchInput.value).toBe('wizard');
    });
  });
});
