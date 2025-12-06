/**
 * @file Test bed for CoreMotivationsGeneratorController testing
 */

import { jest } from '@jest/globals';
import { BaseTestBed } from './baseTestBed.js';
import { CoreMotivationsGeneratorController } from '../../src/coreMotivationsGenerator/controllers/CoreMotivationsGeneratorController.js';
import { ControllerLifecycleOrchestrator } from '../../src/characterBuilder/services/controllerLifecycleOrchestrator.js';
import { AsyncUtilitiesToolkit } from '../../src/characterBuilder/services/asyncUtilitiesToolkit.js';
import { DOMElementManager } from '../../src/characterBuilder/services/domElementManager.js';
import { EventListenerRegistry } from '../../src/characterBuilder/services/eventListenerRegistry.js';
import { PerformanceMonitor } from '../../src/characterBuilder/services/performanceMonitor.js';
import { MemoryManager } from '../../src/characterBuilder/services/memoryManager.js';
import { ErrorHandlingStrategy } from '../../src/characterBuilder/services/errorHandlingStrategy.js';
import { ValidationService } from '../../src/characterBuilder/services/validationService.js';
import {
  ERROR_CATEGORIES,
  ERROR_SEVERITY,
} from '../../src/characterBuilder/controllers/BaseCharacterBuilderController.js';

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
      getAllThematicDirectionsWithConcepts: jest.fn().mockResolvedValue([
        {
          direction: {
            id: 'test-direction-1',
            title: 'Heroic Journey',
            theme: 'The call to adventure',
            conceptId: 'concept-1',
          },
          concept: {
            id: 'concept-1',
            text: 'A brave warrior',
          },
        },
        {
          direction: {
            id: 'test-direction-2',
            title: 'Dark Past',
            theme: 'Hidden secrets emerge',
            conceptId: 'concept-1',
          },
          concept: {
            id: 'concept-1',
            text: 'A brave warrior',
          },
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
      createMotivationBlock: jest.fn().mockImplementation((motivation) => {
        const div = document.createElement('div');
        div.className = 'motivation-block';
        div.setAttribute('data-motivation-id', motivation.id);
        return div;
      }),
      formatMotivationsForExport: jest
        .fn()
        .mockReturnValue('Exported motivations'),
      formatSingleMotivation: jest.fn().mockReturnValue('Single motivation'),
    };

    // Use enhanced event bus that tracks dispatches for state management testing
    this.mockEventBus = this.createEnhancedEventBus();
    this.eventBus = this.mockEventBus; // Expose as eventBus for consistent access

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
    this.controllerDependencies = this._buildControllerDependencies();
    this.controller = new CoreMotivationsGeneratorController({
      logger: this.logger,
      characterBuilderService: this.mockCharacterBuilderService,
      eventBus: this.mockEventBus,
      schemaValidator: this.mockSchemaValidator,
      coreMotivationsGenerator: this.mockCoreMotivationsGenerator,
      displayEnhancer: this.mockDisplayEnhancer,
      ...this.controllerDependencies,
    });

    // Mock the base controller methods
    this._mockControllerUIHelpers(this.controller);
  }

  /**
   * Build the dependency set required by BaseCharacterBuilderController
   * so tests don't have to wire them manually after the refactor.
   *
   * @param {string} contextName - Optional context name for DOM manager logs.
   * @returns {object} - Dependency map passed into the controller constructor.
   */
  _buildControllerDependencies(
    contextName = 'CoreMotivationsGeneratorControllerTestBed'
  ) {
    const controllerLifecycleOrchestrator = new ControllerLifecycleOrchestrator(
      {
        logger: this.logger,
        eventBus: this.mockEventBus,
      }
    );

    const asyncUtilitiesToolkit = new AsyncUtilitiesToolkit({
      logger: this.logger,
    });

    const performanceRef =
      typeof performance !== 'undefined'
        ? performance
        : {
            now: () => Date.now(),
          };

    const domElementManager = new DOMElementManager({
      logger: this.logger,
      documentRef: document,
      performanceRef,
      elementsRef: {},
      contextName,
    });

    const eventListenerRegistry = new EventListenerRegistry({
      logger: this.logger,
      asyncUtilities: {
        debounce: (...args) => asyncUtilitiesToolkit.debounce(...args),
        throttle: (...args) => asyncUtilitiesToolkit.throttle(...args),
      },
    });

    const performanceMonitor = new PerformanceMonitor({
      logger: this.logger,
      eventBus: this.mockEventBus,
    });

    const memoryManager = new MemoryManager({ logger: this.logger });

    const errorHandlingStrategy = new ErrorHandlingStrategy({
      logger: this.logger,
      eventBus: this.mockEventBus,
      controllerName: 'CoreMotivationsGeneratorController',
      errorCategories: ERROR_CATEGORIES,
      errorSeverity: ERROR_SEVERITY,
    });

    const validationService = new ValidationService({
      schemaValidator: this.mockSchemaValidator,
      logger: this.logger,
      handleError: jest.fn(),
      errorCategories: ERROR_CATEGORIES,
    });

    return {
      controllerLifecycleOrchestrator,
      domElementManager,
      eventListenerRegistry,
      asyncUtilitiesToolkit,
      performanceMonitor,
      memoryManager,
      errorHandlingStrategy,
      validationService,
    };
  }

  /**
   * Provide a reusable helper for creating controllers with proper dependencies.
   *
   * @param {object} overrides - Dependency overrides (optional).
   * @returns {CoreMotivationsGeneratorController}
   */
  createController(overrides = {}) {
    const {
      logger = this.logger,
      characterBuilderService = this.mockCharacterBuilderService,
      eventBus = this.mockEventBus,
      schemaValidator = this.mockSchemaValidator,
      coreMotivationsGenerator = this.mockCoreMotivationsGenerator,
      displayEnhancer = this.mockDisplayEnhancer,
      ...additionalOverrides
    } = overrides;

    const baseDependencies = this._buildControllerDependencies();

    const controller = new CoreMotivationsGeneratorController({
      logger,
      characterBuilderService,
      eventBus,
      schemaValidator,
      coreMotivationsGenerator,
      displayEnhancer,
      ...baseDependencies,
      ...additionalOverrides,
    });

    this._mockControllerUIHelpers(controller);
    return controller;
  }

  /**
   * Ensure controller UI helper methods are stubbed for predictable tests.
   *
   * @param {CoreMotivationsGeneratorController} controller
   */
  _mockControllerUIHelpers(controller) {
    controller.showError = jest.fn();
    controller.showSuccess = jest.fn();
    controller.showWarning = jest.fn();
  }

  /**
   * Create DOM structure for testing
   */
  createDOMStructure() {
    // Ensure previous test DOM does not leak into the current run
    document.body.innerHTML = '';

    // Skip link for keyboard navigation
    const skipLink = document.createElement('a');
    skipLink.className = 'skip-link';
    skipLink.href = '#main-content';
    skipLink.textContent = 'Skip to main content';
    document.body.appendChild(skipLink);

    // Main container
    const main = document.createElement('main');
    main.id = 'main-content';

    // Direction selector - match production code expectation (select element)
    const directionSelector = document.createElement('select');
    directionSelector.id = 'direction-selector';
    directionSelector.className = 'cb-select';
    directionSelector.setAttribute('aria-label', 'Select thematic direction');
    directionSelector.innerHTML =
      '<option value="">-- Choose a thematic direction --</option>';
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
    searchInput.className = 'motivation-search-input';
    searchInput.placeholder = 'Search motivations...';
    searchInput.setAttribute('aria-label', 'Search motivations');
    main.appendChild(searchInput);

    const searchResultsCount = document.createElement('span');
    searchResultsCount.id = 'search-results-count';
    searchResultsCount.className = 'search-results-count';
    searchResultsCount.style.display = 'none';
    searchResultsCount.innerHTML = '<span id="search-count">0</span> results';
    main.appendChild(searchResultsCount);

    const sortSelect = document.createElement('select');
    sortSelect.id = 'motivation-sort';
    sortSelect.className = 'cb-select sort-select';
    sortSelect.setAttribute('aria-label', 'Sort motivations');
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
    generateBtn.className = 'cb-button cb-button-primary';
    generateBtn.textContent = 'Generate Motivations';
    generateBtn.setAttribute('aria-label', 'Generate core motivations');
    generateBtn.disabled = true;
    main.appendChild(generateBtn);

    // Clear all button
    const clearBtn = document.createElement('button');
    clearBtn.id = 'clear-all-btn';
    clearBtn.className = 'cb-button cb-button-danger';
    clearBtn.textContent = 'Clear All';
    clearBtn.setAttribute('aria-label', 'Clear all motivations');
    clearBtn.disabled = true;
    main.appendChild(clearBtn);

    // Export button
    const exportBtn = document.createElement('button');
    exportBtn.id = 'export-btn';
    exportBtn.className = 'cb-button cb-button-secondary';
    exportBtn.textContent = 'Export';
    exportBtn.setAttribute('aria-label', 'Export motivations to text');
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
    loadingIndicator.className = 'loading-indicator';
    loadingIndicator.style.display = 'none';
    loadingIndicator.setAttribute('role', 'status');
    loadingIndicator.setAttribute('aria-live', 'polite');

    // Add paragraph element for loading text
    const loadingText = document.createElement('p');
    loadingText.textContent = 'Loading...';
    loadingIndicator.appendChild(loadingText);

    main.appendChild(loadingIndicator);

    // Confirmation modal
    const modal = document.createElement('div');
    modal.id = 'confirmation-modal';
    modal.className = 'modal-overlay';
    modal.style.display = 'none';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'modal-title');

    // Modal content structure
    const modalContent = document.createElement('div');
    modalContent.className = 'modal-content';

    const modalTitle = document.createElement('h3');
    modalTitle.id = 'modal-title';
    modalTitle.className = 'modal-title';
    modalTitle.textContent = 'Clear All Motivations?';
    modalContent.appendChild(modalTitle);

    const confirmBtn = document.createElement('button');
    confirmBtn.id = 'confirm-clear';
    confirmBtn.className = 'cb-button cb-button-danger';
    confirmBtn.textContent = 'Confirm';
    confirmBtn.setAttribute('aria-label', 'Confirm clear all');
    modalContent.appendChild(confirmBtn);

    const cancelBtn = document.createElement('button');
    cancelBtn.id = 'cancel-clear';
    cancelBtn.className = 'cb-button cb-button-secondary';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.setAttribute('aria-label', 'Cancel');
    modalContent.appendChild(cancelBtn);

    modal.appendChild(modalContent);
    main.appendChild(modal);

    document.body.appendChild(main);
  }

  /**
   * Create enhanced event bus that tracks dispatches
   */
  createEnhancedEventBus() {
    return {
      dispatch: jest.fn((eventName, payload, options) => {
        // Store events in the format tests expect - matching ISafeEventDispatcher signature
        this.dispatchedEvents.push({
          type: eventName,
          payload: payload,
        });
        // Return Promise<boolean> as per ISafeEventDispatcher interface
        return Promise.resolve(true);
      }),
      subscribe: jest.fn((eventType, callback) => {
        if (!this.eventCallbacks.has(eventType)) {
          this.eventCallbacks.set(eventType, []);
        }
        this.eventCallbacks.get(eventType).push(callback);
        // Return unsubscribe function as per ISafeEventDispatcher interface
        return () => {
          const callbacks = this.eventCallbacks.get(eventType) || [];
          const index = callbacks.indexOf(callback);
          if (index > -1) {
            callbacks.splice(index, 1);
          }
        };
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
    // Get the select element
    const directionSelector = document.getElementById('direction-selector');
    if (!directionSelector) {
      throw new Error('Direction selector not found');
    }

    // Create option if it doesn't exist (for test scenarios)
    let option = directionSelector.querySelector(
      `option[value="${directionId}"]`
    );
    if (!option) {
      const optgroup = document.createElement('optgroup');
      optgroup.label = 'Test Concept';

      option = document.createElement('option');
      option.value = directionId;
      option.textContent = 'Test Direction';
      option.dataset.conceptId = 'concept-1';

      optgroup.appendChild(option);
      directionSelector.appendChild(optgroup);
    }

    // Simulate selection change
    directionSelector.value = directionId;

    // Trigger change event that the controller should listen for
    const changeEvent = new Event('change', { bubbles: true });
    directionSelector.dispatchEvent(changeEvent);

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
    // The direction should now exist in the select element from initialization
    const directionSelector = document.getElementById('direction-selector');
    const option = directionSelector?.querySelector(
      `option[value="${directionId}"]`
    );

    if (option || directionSelector) {
      // Select the direction to trigger the controller's selection logic
      await this.selectDirection(directionId);
    }
  }

  async cleanup() {
    try {
      if (this.controller?.cleanup) {
        await this.controller.cleanup();
      }
    } finally {
      this.dispatchedEvents = [];
      this.eventCallbacks.clear();
      document.body.innerHTML = '';
      await super.cleanup();
    }
  }
}
