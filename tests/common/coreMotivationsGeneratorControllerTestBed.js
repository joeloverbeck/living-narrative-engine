/**
 * @file Test bed for CoreMotivationsGeneratorController testing
 */

import { jest } from '@jest/globals';
import { BaseTestBed } from './baseTestBed.js';
import { CoreMotivationsGeneratorController } from '../../src/coreMotivationsGenerator/controllers/CoreMotivationsGeneratorController.js';
import { createEventBus } from './mockFactories/eventBus.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Test bed for CoreMotivationsGeneratorController
 */
export class CoreMotivationsGeneratorControllerTestBed extends BaseTestBed {
  constructor() {
    super();

    // Create mock logger with enhanced debugging support
    this.logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      log: jest.fn(),
    };
    this.mockLogger = this.logger; // Keep backwards compatibility

    // Track event dispatches for state management testing
    this.dispatchedEvents = [];
    this.eventCallbacks = new Map();

    // Mock services
    this.mockCharacterBuilderService = {
      initialize: jest.fn().mockResolvedValue(true),
      getAllCharacterConcepts: jest
        .fn()
        .mockResolvedValue([{ id: 'concept-1', concept: 'A brave warrior' }]),
      createCharacterConcept: jest.fn().mockResolvedValue('concept-id'),
      updateCharacterConcept: jest.fn().mockResolvedValue(true),
      deleteCharacterConcept: jest.fn().mockResolvedValue(true),
      getCharacterConcept: jest.fn().mockResolvedValue({
        id: 'concept-1',
        concept: 'A brave warrior',
      }),
      getCharacterConceptById: jest.fn().mockResolvedValue({
        id: 'concept-1',
        concept: 'A brave warrior',
      }),
      generateThematicDirections: jest.fn().mockResolvedValue([]),
      getThematicDirections: jest.fn().mockResolvedValue([]),
      getThematicDirectionsByConceptId: jest.fn().mockResolvedValue([
        {
          id: 'test-direction-1',
          title: 'Heroic Journey',
          theme: 'The call to adventure',
          conceptId: 'concept-1',
        },
        {
          id: 'test-direction-2',
          title: 'Dark Past',
          theme: 'Hidden secrets emerge',
          conceptId: 'concept-1',
        },
      ]),
      hasClichesForDirection: jest.fn().mockResolvedValue(true),
      getCoreMotivationsByDirectionId: jest.fn().mockResolvedValue([]),
      getClichesByDirectionId: jest
        .fn()
        .mockResolvedValue([{ id: 'cliche-1', text: 'Chosen one trope' }]),
      saveCoreMotivations: jest.fn().mockResolvedValue(['motivation-1']),
      removeCoreMotivationItem: jest.fn().mockResolvedValue(true),
      clearCoreMotivationsForDirection: jest.fn().mockResolvedValue(2),
    };

    this.mockCoreMotivationsGenerator = {
      generate: jest.fn().mockResolvedValue([
        {
          id: 'motivation-1',
          text: 'Seek adventure and glory',
          category: 'Personal Growth',
          createdAt: new Date(),
        },
      ]),
    };

    this.mockDisplayEnhancer = {
      createMotivationBlock: jest
        .fn()
        .mockReturnValue(document.createElement('div')),
      formatMotivationsForExport: jest
        .fn()
        .mockReturnValue('Exported motivations'),
      formatSingleMotivation: jest.fn().mockReturnValue('Single motivation'),
    };

    // Use enhanced event bus that tracks dispatches for state management testing
    this.mockEventBus = this.createEnhancedEventBus();

    this.mockSchemaValidator = {
      validate: jest.fn().mockReturnValue({ valid: true }),
      getErrors: jest.fn().mockReturnValue([]),
      validateAgainstSchema: jest
        .fn()
        .mockReturnValue({ valid: true, errors: [] }),
    };

    // Controller will be created in setup() after DOM is ready
    this.controller = null;
  }

  /**
   * Override setup to initialize the controller
   */
  async setup() {
    await super.setup();

    // Create DOM structure first
    this.createDOMStructure();

    // Then create controller instance with DOM already in place
    this.controller = new CoreMotivationsGeneratorController({
      logger: this.logger,
      characterBuilderService: this.mockCharacterBuilderService,
      eventBus: this.mockEventBus,
      schemaValidator: this.mockSchemaValidator,
      coreMotivationsGenerator: this.mockCoreMotivationsGenerator,
      displayEnhancer: this.mockDisplayEnhancer,
    });

    // Mock the base controller methods
    this.controller.showError = jest.fn();
    this.controller.showSuccess = jest.fn();
    this.controller.showWarning = jest.fn();
  }

  /**
   * Create DOM structure for testing
   */
  createDOMStructure() {
    // Main container
    const main = document.createElement('main');
    main.id = 'main-content';

    // Direction selector container
    const directionSelector = document.createElement('div');
    directionSelector.id = 'direction-selector';
    main.appendChild(directionSelector);

    // No directions message
    const noDirectionsMsg = document.createElement('div');
    noDirectionsMsg.id = 'no-directions-message';
    noDirectionsMsg.style.display = 'none';
    noDirectionsMsg.textContent = 'No eligible directions found';
    main.appendChild(noDirectionsMsg);

    // Search and sort controls
    const searchInput = document.createElement('input');
    searchInput.id = 'motivation-search';
    searchInput.type = 'search';
    searchInput.placeholder = 'Search motivations...';
    main.appendChild(searchInput);

    const searchResultsCount = document.createElement('span');
    searchResultsCount.id = 'search-results-count';
    searchResultsCount.style.display = 'none';
    searchResultsCount.innerHTML = '<span id="search-count">0</span> results';
    main.appendChild(searchResultsCount);

    const sortSelect = document.createElement('select');
    sortSelect.id = 'motivation-sort';
    sortSelect.innerHTML = `
      <option value="newest">Newest First</option>
      <option value="oldest">Oldest First</option>
      <option value="alphabetical">Alphabetical (Core Desire)</option>
    `;
    main.appendChild(sortSelect);

    // Motivations container
    const motivationsContainer = document.createElement('div');
    motivationsContainer.id = 'motivations-container';
    main.appendChild(motivationsContainer);

    // Empty state
    const emptyState = document.createElement('div');
    emptyState.id = 'empty-state';
    emptyState.style.display = 'flex';
    emptyState.textContent = 'No motivations generated yet';
    main.appendChild(emptyState);

    // Generate button
    const generateBtn = document.createElement('button');
    generateBtn.id = 'generate-btn';
    generateBtn.textContent = 'Generate Motivations';
    generateBtn.disabled = true;
    main.appendChild(generateBtn);

    // Clear all button
    const clearBtn = document.createElement('button');
    clearBtn.id = 'clear-all-btn';
    clearBtn.textContent = 'Clear All';
    clearBtn.disabled = true;
    main.appendChild(clearBtn);

    // Export button
    const exportBtn = document.createElement('button');
    exportBtn.id = 'export-btn';
    exportBtn.textContent = 'Export';
    exportBtn.disabled = true;
    main.appendChild(exportBtn);

    // Back button
    const backBtn = document.createElement('button');
    backBtn.id = 'back-btn';
    backBtn.textContent = 'Back';
    main.appendChild(backBtn);

    // Loading indicator
    const loadingIndicator = document.createElement('div');
    loadingIndicator.id = 'loading-indicator';
    loadingIndicator.style.display = 'none';

    // Add paragraph element for loading text
    const loadingText = document.createElement('p');
    loadingText.textContent = 'Loading...';
    loadingIndicator.appendChild(loadingText);

    main.appendChild(loadingIndicator);

    // Confirmation modal
    const modal = document.createElement('div');
    modal.id = 'confirmation-modal';
    modal.style.display = 'none';

    const confirmBtn = document.createElement('button');
    confirmBtn.id = 'confirm-clear';
    confirmBtn.textContent = 'Confirm';
    modal.appendChild(confirmBtn);

    const cancelBtn = document.createElement('button');
    cancelBtn.id = 'cancel-clear';
    cancelBtn.textContent = 'Cancel';
    modal.appendChild(cancelBtn);

    main.appendChild(modal);

    document.body.appendChild(main);
  }

  /**
   * Create enhanced event bus that tracks dispatches
   */
  createEnhancedEventBus() {
    return {
      dispatch: jest.fn((event) => {
        this.dispatchedEvents.push(event);
      }),
      subscribe: jest.fn((eventType, callback) => {
        if (!this.eventCallbacks.has(eventType)) {
          this.eventCallbacks.set(eventType, []);
        }
        this.eventCallbacks.get(eventType).push(callback);
      }),
      unsubscribe: jest.fn(),
    };
  }

  /**
   * Setup successful direction loading scenario
   */
  setupSuccessfulDirectionLoad() {
    const directions = [
      {
        id: 'test-direction-1',
        title: 'Heroic Journey',
        theme: 'The call to adventure',
        conceptId: 'concept-1',
      },
      {
        id: 'test-direction-2',
        title: 'Dark Past',
        theme: 'Hidden secrets emerge',
        conceptId: 'concept-1',
      },
    ];

    this.mockCharacterBuilderService.getThematicDirectionsByConceptId.mockResolvedValue(
      directions
    );
    this.mockCharacterBuilderService.hasClichesForDirection.mockResolvedValue(
      true
    );

    return { directions };
  }

  /**
   * Select a direction programmatically
   *
   * @param directionId
   */
  async selectDirection(directionId) {
    // Create direction element if it doesn't exist
    let directionElement = document.querySelector(
      `[data-direction-id="${directionId}"]`
    );
    if (!directionElement) {
      directionElement = document.createElement('div');
      directionElement.className = 'direction-item';
      directionElement.dataset.directionId = directionId;

      const title = document.createElement('h3');
      title.textContent = 'Test Direction';
      directionElement.appendChild(title);

      const theme = document.createElement('p');
      theme.textContent = 'Test theme';
      theme.className = 'direction-theme';
      directionElement.appendChild(theme);

      document
        .getElementById('direction-selector')
        .appendChild(directionElement);
    }

    // Simulate click
    directionElement.click();
    await this.waitForAsyncOperations();
  }

  /**
   * Setup confirmation modal for testing
   */
  setupConfirmationModal() {
    const modal = document.getElementById('confirmation-modal');
    const confirmBtn = document.getElementById('confirm-clear');
    const cancelBtn = document.getElementById('cancel-clear');

    // Make modal elements interactive
    modal.style.display = 'none';

    return { modal, confirmBtn, cancelBtn };
  }

  /**
   * Create a mock delete button for testing
   *
   * @param motivationId
   */
  createMockDeleteButton(motivationId) {
    const button = document.createElement('button');
    button.className = 'delete-motivation-btn';
    button.dataset.motivationId = motivationId;
    button.textContent = 'Delete';
    document.body.appendChild(button);
    return button;
  }

  /**
   * Wait for async operations to complete
   */
  async waitForAsyncOperations() {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  /**
   * Get the last dispatched event of a specific type
   *
   * @param eventType
   */
  getLastEventOfType(eventType) {
    return this.dispatchedEvents
      .filter((event) => event.type === eventType)
      .pop();
  }

  /**
   * Clear all dispatched events
   */
  clearDispatchedEvents() {
    this.dispatchedEvents = [];
  }

  /**
   * Get generated motivations from display enhancer calls
   */
  getDisplayedMotivations() {
    return this.mockDisplayEnhancer.createMotivationBlock.mock.calls.map(
      (call) => call[0]
    );
  }

  /**
   * Cleanup test environment
   */
  /**
   * Setup motivations display with test data
   *
   * @param {Array} motivations - Array of motivation objects
   */
  setupMotivationsDisplay(motivations) {
    // Mock the display enhancer to create proper elements with data attributes
    this.mockDisplayEnhancer.createMotivationBlock.mockImplementation(
      (motivation) => {
        const block = document.createElement('div');
        block.className = 'motivation-block';
        block.dataset.motivationId = motivation.id;
        block.innerHTML = `
          <div class="motivation-content">
            <div class="core-desire">${motivation.coreDesire || ''}</div>
            <div class="internal-contradiction">${motivation.internalContradiction || ''}</div>
            <div class="central-question">${motivation.centralQuestion || ''}</div>
          </div>
        `;
        return block;
      }
    );
  }

  /**
   * Load a direction with motivations
   *
   * @param {string} directionId - Direction ID
   * @param {Array} motivations - Array of motivation objects
   */
  async loadDirectionWithMotivations(directionId, motivations) {
    // Ensure the controller is initialized with directions
    if (!this.controller) {
      throw new Error('Controller not initialized');
    }

    // Setup the mock to return the test direction when requested
    const testDirection = {
      id: directionId,
      title: 'Test Direction',
      theme: 'Test theme',
      conceptId: 'concept-1',
    };

    // Update mocks to ensure the direction is available
    this.mockCharacterBuilderService.getThematicDirectionsByConceptId.mockResolvedValue(
      [testDirection]
    );
    this.mockCharacterBuilderService.hasClichesForDirection.mockResolvedValue(
      true
    );

    // Update mock to return the specified motivations
    this.mockCharacterBuilderService.getCoreMotivationsByDirectionId.mockResolvedValue(
      motivations
    );

    // Re-initialize the controller to load the directions
    // This ensures #eligibleDirections is populated
    await this.controller.initialize();

    // Now select the direction through the controller's public interface
    // The direction should now exist in the DOM from initialization
    const directionElement = document.querySelector(
      `[data-direction-id="${directionId}"]`
    );

    if (directionElement) {
      // Click the direction element to trigger the controller's selection logic
      // This will call #selectDirection which will load the motivations
      directionElement.click();

      // Wait for async operations to complete
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }

  cleanup() {
    super.cleanup();

    if (this.controller && this.controller.cleanup) {
      this.controller.cleanup();
    }

    this.dispatchedEvents = [];
    this.eventCallbacks.clear();
  }
}
