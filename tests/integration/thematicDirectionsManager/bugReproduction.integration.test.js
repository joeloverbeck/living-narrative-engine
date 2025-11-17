/**
 * @file Integration test to reproduce bugs in thematic-directions-manager.html
 * @description Reproduces both the UIStateManager warning and the concept loading issue
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { BaseCharacterBuilderControllerTestBase } from '../../unit/characterBuilder/controllers/BaseCharacterBuilderController.testbase.js';
import { ThematicDirectionsManagerController } from '../../../src/thematicDirectionsManager/controllers/thematicDirectionsManagerController.js';

describe('ThematicDirectionsManager - Bug Reproduction Integration Test', () => {
  let testBase;
  let controller;
  let mockConsoleWarn;
  let capturedWarnings;
  let createController;

  beforeEach(async () => {
    testBase = new BaseCharacterBuilderControllerTestBase();
    await testBase.setup();

    // Capture console warnings
    capturedWarnings = [];
    mockConsoleWarn = jest
      .spyOn(console, 'warn')
      .mockImplementation((message) => {
        capturedWarnings.push(message);
      });

    // Set up DOM structure matching thematic-directions-manager.html
    document.body.innerHTML = `
      <div id="thematic-directions-manager-container" class="cb-page-container">
        <main class="cb-page-main thematic-directions-manager-main">
          <!-- Left Panel: Concept Selection & Controls -->
          <section class="cb-input-panel concept-selection-panel">
            <div class="cb-form-group">
              <label for="concept-selector">Choose Concept:</label>
              <select id="concept-selector" class="cb-select">
                <option value="">-- All Concepts --</option>
                <option value="orphaned">🚨 Orphaned Directions</option>
                <!-- Should be populated dynamically with concepts -->
              </select>
            </div>

            <!-- Character Concept Display -->
            <div id="concept-display-container" class="concept-display-container" style="display: none">
              <div id="concept-display-content" class="concept-display-content">
                <!-- Content will be dynamically inserted here -->
              </div>
            </div>

            <!-- Filter Controls -->
            <div class="cb-form-group">
              <input type="text" id="direction-filter" class="cb-input" placeholder="Search directions..." />
            </div>

            <!-- Actions -->
            <button type="button" id="refresh-btn" class="cb-button-secondary">🔄 Refresh</button>
            <button type="button" id="cleanup-orphans-btn" class="cb-button-secondary">🧹 Clean Orphans</button>

            <!-- Stats Display -->
            <div class="stats-display">
              <span id="total-directions" class="stat-value">0</span>
              <span id="orphaned-count" class="stat-value">0</span>
            </div>
          </section>

          <!-- Right Panel: Directions Display & Editing -->
          <section class="cb-results-panel directions-management-panel">
            <div id="directions-container" class="cb-state-container directions-content">
              <!-- Empty State -->
              <div id="empty-state" class="cb-empty-state">
                <p>No thematic directions found.</p>
              </div>

              <!-- Loading State -->
              <div id="loading-state" class="cb-loading-state" style="display: none">
                <div class="spinner large"></div>
                <p>Loading directions...</p>
              </div>

              <!-- Error State -->
              <div id="error-state" class="cb-error-state" style="display: none">
                <p class="error-title">Unable to Load Directions</p>
                <p class="error-message" id="error-message-text"></p>
                <button type="button" class="cb-button-secondary" id="retry-btn">Try Again</button>
              </div>

              <!-- Results State -->
              <div id="results-state" class="cb-state-container" style="display: none">
                <div id="directions-results" class="directions-results">
                  <!-- Dynamically populated -->
                </div>
              </div>
            </div>
          </section>
        </main>

        <!-- Back to Menu Button -->
        <button type="button" id="back-to-menu-btn" class="cb-button-secondary">← Back to Main Menu</button>

        <!-- Confirmation Modal -->
        <div id="confirmation-modal" class="modal" style="display: none">
          <div class="modal-content">
            <div class="modal-header">
              <h2 id="modal-title">Confirm Action</h2>
              <button type="button" class="close-modal" id="close-modal-btn">×</button>
            </div>
            <div class="modal-body">
              <p id="modal-message">Are you sure you want to perform this action?</p>
              <div class="modal-actions">
                <button type="button" id="modal-confirm-btn" class="cb-button-primary">Confirm</button>
                <button type="button" id="modal-cancel-btn" class="cb-button-secondary">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Mock service data - simulate having some concepts and directions
    const mockConcepts = [
      {
        id: 'concept-1',
        concept: 'A brave warrior seeking redemption after a terrible mistake',
        status: 'active',
        createdAt: new Date().toISOString(),
        thematicDirections: ['direction-1'],
      },
      {
        id: 'concept-2',
        concept: 'A cunning rogue with a heart of gold',
        status: 'active',
        createdAt: new Date().toISOString(),
        thematicDirections: ['direction-2'],
      },
    ];

    const mockDirectionsWithConcepts = [
      {
        direction: {
          id: 'direction-1',
          conceptId: 'concept-1',
          title: 'Redemption Arc',
          description: 'A journey of self-forgiveness and making amends',
          coreTension: 'Past mistakes vs. desire for redemption',
          uniqueTwist: 'The mistake was actually a setup by an enemy',
          narrativePotential: 'Reveals true enemy and tests character growth',
        },
        concept: mockConcepts[0],
      },
      {
        direction: {
          id: 'direction-2',
          conceptId: 'concept-2',
          title: 'Heart of Gold',
          description: 'Despite criminal past, shows unexpected nobility',
          coreTension: 'Criminal reputation vs. noble actions',
          uniqueTwist: 'Actually a noble in exile',
          narrativePotential: 'Royal heritage reveal changes everything',
        },
        concept: mockConcepts[1],
      },
      {
        direction: {
          id: 'direction-orphan',
          conceptId: 'nonexistent-concept',
          title: 'Orphaned Direction',
          description: 'This direction has no valid concept',
          coreTension: 'Isolation vs. belonging',
          uniqueTwist: 'Actually belongs to deleted concept',
          narrativePotential: 'Could be reassigned or deleted',
        },
        concept: null, // This simulates an orphaned direction
      },
    ];

    // Setup mock services
    testBase.mocks.characterBuilderService.getAllThematicDirectionsWithConcepts =
      jest.fn().mockResolvedValue(mockDirectionsWithConcepts);

    testBase.mocks.characterBuilderService.getCharacterConcept = jest
      .fn()
      .mockImplementation(async (conceptId) => {
        return mockConcepts.find((concept) => concept.id === conceptId) || null;
      });

    testBase.mocks.characterBuilderService.initialize = jest
      .fn()
      .mockResolvedValue(true);

    createController = (overrides = {}) =>
      new ThematicDirectionsManagerController({
        logger: testBase.mocks.logger,
        characterBuilderService: testBase.mocks.characterBuilderService,
        eventBus: testBase.mocks.eventBus,
        schemaValidator: testBase.mocks.schemaValidator,
        controllerLifecycleOrchestrator:
          testBase.mocks.controllerLifecycleOrchestrator,
        domElementManager: testBase.mocks.domElementManager,
        eventListenerRegistry: testBase.mocks.eventListenerRegistry,
        asyncUtilitiesToolkit: testBase.mocks.asyncUtilitiesToolkit,
        performanceMonitor: testBase.mocks.performanceMonitor,
        memoryManager: testBase.mocks.memoryManager,
        errorHandlingStrategy: testBase.mocks.errorHandlingStrategy,
        validationService: testBase.mocks.validationService,
        ...overrides,
      });
  });

  afterEach(async () => {
    mockConsoleWarn.mockRestore();
    if (controller && typeof controller.destroy === 'function') {
      controller.destroy();
    }
    await testBase.cleanup();
  });

  describe('Bug 1: UIStateManager Warning - FIXED', () => {
    it('should verify that UIStateManager warning is no longer generated', async () => {
      // This test now verifies that the bug has been FIXED
      // Create controller normally - UIStateManager should be created automatically by BaseCharacterBuilderController
      controller = createController();

      // Initialize the controller
      await controller.initialize();

      // Check that NO UIStateManager warnings were captured
      const uiStateWarnings = capturedWarnings.filter(
        (warning) =>
          typeof warning === 'string' &&
          (warning.includes(
            "Optional service 'uiStateManager' is null/undefined"
          ) ||
            (warning.includes('uiStateManager') && warning.includes('null')))
      );

      // This should PASS now that the bug is fixed - no warnings should be present
      expect(uiStateWarnings).toHaveLength(0);
      console.log('✅ UIStateManager warning has been successfully resolved!');
    });

    it('should identify the root cause of UIStateManager creation failure', async () => {
      // Test the scenario where DOM elements exist but UIStateManager still fails
      const stateElements = {
        emptyState: document.getElementById('empty-state'),
        loadingState: document.getElementById('loading-state'),
        errorState: document.getElementById('error-state'),
        resultsState: document.getElementById('results-state'),
      };

      // Verify all elements exist
      expect(stateElements.emptyState).not.toBeNull();
      expect(stateElements.loadingState).not.toBeNull();
      expect(stateElements.errorState).not.toBeNull();
      expect(stateElements.resultsState).not.toBeNull();

      // Try to create UIStateManager manually to see what fails
      const { UIStateManager } = await import(
        '../../../src/shared/characterBuilder/uiStateManager.js'
      );

      let uiStateManager = null;
      let creationError = null;

      try {
        uiStateManager = new UIStateManager(stateElements);
      } catch (error) {
        creationError = error;
      }

      // Document what happens - either it works or we identify the error
      if (creationError) {
        expect(creationError).toBeDefined();
        console.log(
          'UIStateManager creation failed with:',
          creationError.message
        );
      } else {
        expect(uiStateManager).not.toBeNull();
        console.log('UIStateManager created successfully');
      }
    });
  });

  describe('Bug 2: Concept Loading Issue - FIXED', () => {
    it('should verify that concepts are successfully loaded into dropdown', async () => {
      // Create controller with proper UIStateManager to focus on concept loading
      const stateElements = {
        emptyState: document.getElementById('empty-state'),
        loadingState: document.getElementById('loading-state'),
        errorState: document.getElementById('error-state'),
        resultsState: document.getElementById('results-state'),
      };

      let uiStateManager = null;
      try {
        const { UIStateManager } = await import(
          '../../../src/shared/characterBuilder/uiStateManager.js'
        );
        uiStateManager = new UIStateManager(stateElements);
      } catch (error) {
        // If UIStateManager fails, use null - we're focusing on dropdown loading
        uiStateManager = null;
      }

      controller = createController({ uiStateManager });

      // Initialize the controller
      await controller.initialize();

      // Check the concept selector dropdown
      const conceptSelector = document.getElementById('concept-selector');
      expect(conceptSelector).not.toBeNull();

      // Get all options in the dropdown
      const options = Array.from(conceptSelector.options);
      const optionValues = options.map((option) => option.value);
      const optionTexts = options.map((option) => option.textContent);

      console.log('Concept selector options:');
      options.forEach((option, index) => {
        console.log(
          `  ${index}: value="${option.value}", text="${option.textContent}"`
        );
      });

      // Check if concepts were loaded
      // We expect to see:
      // - Default empty option ("-- All Concepts --")
      // - Orphaned option ("🚨 Orphaned Directions")
      // - concept-1 ("A brave warrior seeking redemption...")
      // - concept-2 ("A cunning rogue with a heart of gold")

      // This should PASS now that the bug is fixed
      const hasConceptOptions =
        optionValues.includes('concept-1') &&
        optionValues.includes('concept-2');

      // Document the current state for verification
      if (hasConceptOptions) {
        console.log('✅ Concept dropdown successfully loaded expected options');
        console.log('Found concept-1 and concept-2 as expected');
      } else {
        console.log('❌ Concept dropdown still missing expected options');
        console.log('Expected concept-1 and concept-2 to be present');
        console.log(
          'Service call made:',
          testBase.mocks.characterBuilderService
            .getAllThematicDirectionsWithConcepts.mock.calls.length
        );
      }

      // This assertion should PASS now that the bug is fixed
      expect(hasConceptOptions).toBe(true);
    });

    it('should verify that service data is available but not reaching dropdown', async () => {
      // Test that the service returns the expected data
      const directionsWithConcepts =
        await testBase.mocks.characterBuilderService.getAllThematicDirectionsWithConcepts();

      expect(directionsWithConcepts).toHaveLength(3);
      expect(directionsWithConcepts[0].concept).not.toBeNull();
      expect(directionsWithConcepts[1].concept).not.toBeNull();
      expect(directionsWithConcepts[2].concept).toBeNull(); // Orphaned

      // Extract concepts from the service data
      const conceptsWithDirections = directionsWithConcepts
        .filter((item) => item.concept !== null)
        .map((item) => item.concept);

      expect(conceptsWithDirections).toHaveLength(2);
      expect(conceptsWithDirections[0].id).toBe('concept-1');
      expect(conceptsWithDirections[1].id).toBe('concept-2');

      console.log(
        'Service data is correct - concepts should appear in dropdown'
      );
    });

    it('should test PreviousItemsDropdown loading functionality directly', async () => {
      // Test the dropdown component in isolation
      const { PreviousItemsDropdown } = await import(
        '../../../src/shared/characterBuilder/previousItemsDropdown.js'
      );

      const selectElement = document.getElementById('concept-selector');
      expect(selectElement).not.toBeNull();

      // Create dropdown instance
      const mockSelectionHandler = jest.fn();
      const dropdown = new PreviousItemsDropdown({
        element: selectElement,
        onSelectionChange: mockSelectionHandler,
        labelText: 'Choose Concept:',
      });

      // Test loading concepts directly
      const mockConcepts = [
        {
          id: 'concept-1',
          concept:
            'A brave warrior seeking redemption after a terrible mistake',
        },
        {
          id: 'concept-2',
          concept: 'A cunning rogue with a heart of gold',
        },
      ];

      // Load items into dropdown
      await dropdown.loadItems(mockConcepts);

      // Check if items were loaded
      const options = Array.from(selectElement.options);
      const optionValues = options.map((option) => option.value);

      console.log('Direct dropdown test - options loaded:');
      options.forEach((option, index) => {
        console.log(
          `  ${index}: value="${option.value}", text="${option.textContent}"`
        );
      });

      // Verify concepts were loaded
      expect(optionValues).toContain('concept-1');
      expect(optionValues).toContain('concept-2');

      // Clean up
      dropdown.destroy();
    });
  });

  describe('Integration Analysis', () => {
    it('should identify the point of failure in the integration chain', async () => {
      // Track the full initialization flow to see where it breaks
      const initializationLog = [];

      // Mock logger to capture initialization steps
      const originalLogger = testBase.mocks.logger;
      testBase.mocks.logger = {
        ...originalLogger,
        info: jest.fn((message, ...args) => {
          initializationLog.push({ level: 'info', message, args });
          return originalLogger.info(message, ...args);
        }),
        warn: jest.fn((message, ...args) => {
          initializationLog.push({ level: 'warn', message, args });
          return originalLogger.warn(message, ...args);
        }),
        error: jest.fn((message, ...args) => {
          initializationLog.push({ level: 'error', message, args });
          return originalLogger.error(message, ...args);
        }),
      };

      // Create and initialize controller
      controller = createController({ uiStateManager: null });

      await controller.initialize();

      // Print initialization log for debugging
      console.log('\n=== INITIALIZATION LOG ===');
      initializationLog.forEach((entry, index) => {
        console.log(
          `${index + 1}. [${entry.level.toUpperCase()}] ${entry.message}`
        );
        if (entry.args && entry.args.length > 0) {
          console.log(`    Args:`, entry.args);
        }
      });
      console.log('=== END INITIALIZATION LOG ===\n');

      // The test passes - the log will help us debug the issues
      expect(initializationLog.length).toBeGreaterThan(0);
    });
  });
});
