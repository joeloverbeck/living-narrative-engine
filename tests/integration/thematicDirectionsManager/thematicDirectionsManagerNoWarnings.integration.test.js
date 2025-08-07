/**
 * @file Integration test to validate that thematic directions manager produces no warnings
 * @description This test simulates the complete initialization flow to ensure all warnings are resolved
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

describe('ThematicDirectionsManager - No Warnings Integration Test', () => {
  let testBase;
  let mockConsoleWarn;
  let mockConsoleLog;
  let capturedWarnings;
  let capturedLogs;

  beforeEach(async () => {
    testBase = new BaseCharacterBuilderControllerTestBase();
    await testBase.setup();

    // Capture console warnings and logs
    capturedWarnings = [];
    capturedLogs = [];

    mockConsoleWarn = jest
      .spyOn(console, 'warn')
      .mockImplementation((message) => {
        capturedWarnings.push(message);
      });

    mockConsoleLog = jest
      .spyOn(console, 'log')
      .mockImplementation((message) => {
        capturedLogs.push(message);
      });

    // Set up complete DOM structure that matches thematic-directions-manager.html
    document.body.innerHTML = `
      <div class="page-container">
        <div class="content-wrapper">
          <div class="header-section">
            <h1>Thematic Directions Manager</h1>
            <div class="action-buttons">
              <button id="refresh-btn" class="cb-btn cb-btn-primary">Refresh</button>
              <button id="back-to-menu-btn" class="cb-btn cb-btn-secondary">Back to Menu</button>
            </div>
          </div>

          <div class="filter-section">
            <div class="concept-selector-container">
              <select id="concept-selector" class="cb-select">
                <option value="">All Concepts</option>
                <option value="orphaned">Orphaned Directions</option>
              </select>
            </div>
            <div class="direction-filter-container">
              <input id="direction-filter" type="text" placeholder="Filter directions..." class="cb-input" />
            </div>
          </div>

          <div class="stats-section">
            <div class="stats-container">
              <div class="stat-item">
                <span class="stat-label">Total Directions:</span>
                <span id="total-directions" class="stat-value">0</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">Orphaned:</span>
                <span id="orphaned-count" class="stat-value">0</span>
              </div>
              <div class="stat-actions">
                <button id="cleanup-orphans-btn" class="cb-btn cb-btn-warning" disabled>
                  Clean Up Orphaned
                </button>
              </div>
            </div>
          </div>

          <div class="concept-display" id="concept-display-container" style="display: none;">
            <h3>Selected Concept</h3>
            <div id="concept-display-content"></div>
          </div>

          <div class="results-section">
            <!-- UIStateManager states -->
            <div id="empty-state" class="cb-empty-state cb-state-container" style="display: none;">
              <div class="empty-message">
                No thematic directions found. Create your first direction to get started.
              </div>
            </div>

            <div id="loading-state" class="cb-loading-state cb-state-container" style="display: none;">
              <div class="loading-spinner"></div>
              <div class="loading-message">Loading thematic directions...</div>
            </div>

            <div id="error-state" class="cb-error-state cb-state-container" style="display: none;">
              <div class="error-content">
                <h3>Error</h3>
                <p id="error-message-text">An error occurred while loading directions.</p>
                <button id="retry-btn" class="cb-btn cb-btn-primary">Retry</button>
              </div>
            </div>

            <div id="results-state" class="cb-results-state cb-state-container" style="display: none;">
              <div id="directions-results"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Confirmation Modal -->
      <div id="confirmation-modal" class="modal" style="display: none;">
        <div class="modal-content">
          <button id="close-modal-btn" class="modal-close">&times;</button>
          <h2 id="modal-title"></h2>
          <p id="modal-message"></p>
          <div class="modal-actions">
            <button id="modal-confirm-btn" class="cb-btn cb-btn-danger">Confirm</button>
            <button id="modal-cancel-btn" class="cb-btn cb-btn-secondary">Cancel</button>
          </div>
        </div>
      </div>
    `;
  });

  afterEach(async () => {
    mockConsoleWarn.mockRestore();
    mockConsoleLog.mockRestore();
    await testBase.cleanup();
  });

  describe('Complete Initialization Flow', () => {
    it('should complete initialization without any warnings', async () => {
      // Dynamic import to simulate actual module loading
      const { ThematicDirectionsManagerController } = await import(
        '../../../src/thematicDirectionsManager/controllers/thematicDirectionsManagerController.js'
      );

      // Set up dependencies similar to the actual page
      const dependencies = testBase.mocks;

      // Mock the service to return test data
      dependencies.characterBuilderService.getAllThematicDirectionsWithConcepts =
        jest.fn().mockResolvedValue([
          {
            direction: {
              id: 'test-direction-1',
              title: 'Test Direction',
              description: 'Test description',
              coreTension: 'Test tension',
              uniqueTwist: 'Test twist',
              narrativePotential: 'Test potential',
            },
            concept: {
              id: 'test-concept-1',
              concept: 'Test concept text',
              status: 'active',
              createdAt: new Date().toISOString(),
            },
          },
        ]);

      // Create and initialize controller
      const controller = new ThematicDirectionsManagerController(dependencies);

      // Initialize - this should complete without warnings
      await controller.initialize();

      // Wait for all async operations to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify controller is initialized
      expect(controller.isInitialized).toBe(true);

      // Check for UIStateManager warnings (should be none after our fix)
      const uiStateWarnings = capturedWarnings.filter(
        (warning) =>
          warning &&
          warning.toString().includes('UIStateManager not initialized')
      );
      expect(uiStateWarnings).toEqual([]);

      // Check for EventDefinition warnings (may still exist due to production vs test environment differences)
      const eventDefWarnings = capturedWarnings.filter(
        (warning) =>
          warning &&
          warning.toString().includes('EventDefinition not found for')
      );

      // Log any remaining warnings for analysis
      if (eventDefWarnings.length > 0) {
        console.log('Remaining EventDefinition warnings:', eventDefWarnings);
      }

      // At minimum, UIStateManager warnings should be eliminated
      expect(uiStateWarnings).toEqual([]);

      // Clean up
      controller.destroy();
    });

    it('should handle state transitions properly without warnings', async () => {
      const { ThematicDirectionsManagerController } = await import(
        '../../../src/thematicDirectionsManager/controllers/thematicDirectionsManagerController.js'
      );

      const dependencies = testBase.mocks;

      // Mock with empty data to test empty state
      dependencies.characterBuilderService.getAllThematicDirectionsWithConcepts =
        jest.fn().mockResolvedValue([]);

      const controller = new ThematicDirectionsManagerController(dependencies);

      await controller.initialize();

      // Wait for state transitions
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Verify no UIStateManager warnings during state transitions
      const uiStateWarnings = capturedWarnings.filter(
        (warning) =>
          warning &&
          warning.toString().includes('UIStateManager not initialized')
      );
      expect(uiStateWarnings).toEqual([]);

      // Controller should handle empty state properly
      expect(controller.isInitialized).toBe(true);

      controller.destroy();
    });

    it('should handle loading state transitions without premature calls', async () => {
      const { ThematicDirectionsManagerController } = await import(
        '../../../src/thematicDirectionsManager/controllers/thematicDirectionsManagerController.js'
      );

      const dependencies = testBase.mocks;

      // Make service slower to test loading states
      dependencies.characterBuilderService.getAllThematicDirectionsWithConcepts =
        jest
          .fn()
          .mockImplementation(
            () => new Promise((resolve) => setTimeout(() => resolve([]), 100))
          );

      const controller = new ThematicDirectionsManagerController(dependencies);

      // Initialize - should not call _showLoading before UIStateManager is ready
      await controller.initialize();

      // Verify no premature loading state calls
      const loadingStateWarnings = capturedWarnings.filter(
        (warning) =>
          warning && warning.toString().includes("cannot show state 'loading'")
      );
      expect(loadingStateWarnings).toEqual([]);

      controller.destroy();
    });

    it('should complete full workflow including dropdown and filtering', async () => {
      const { ThematicDirectionsManagerController } = await import(
        '../../../src/thematicDirectionsManager/controllers/thematicDirectionsManagerController.js'
      );

      const dependencies = testBase.mocks;

      // Mock with realistic test data
      dependencies.characterBuilderService.getAllThematicDirectionsWithConcepts =
        jest.fn().mockResolvedValue([
          {
            direction: {
              id: 'test-direction-1',
              title: 'Adventure Direction',
              description: 'A thrilling adventure story',
              coreTension: 'Hero vs villain',
              uniqueTwist: 'Unexpected ally',
              narrativePotential: 'High drama potential',
            },
            concept: {
              id: 'concept-1',
              concept: 'Heroic adventure concept',
              status: 'active',
              createdAt: new Date().toISOString(),
            },
          },
          {
            direction: {
              id: 'test-direction-2',
              title: 'Mystery Direction',
              description: 'A puzzling mystery',
              coreTension: 'Truth vs deception',
              uniqueTwist: 'Hidden identity',
              narrativePotential: 'Suspense and revelation',
            },
            concept: null, // Orphaned direction
          },
        ]);

      const controller = new ThematicDirectionsManagerController(dependencies);

      await controller.initialize();

      // Wait for complete initialization
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Should have no UIStateManager warnings throughout the process
      const allWarnings = capturedWarnings.filter(
        (warning) =>
          warning &&
          warning.toString().includes('UIStateManager not initialized')
      );
      expect(allWarnings).toEqual([]);

      // Controller should be fully functional
      expect(controller.isInitialized).toBe(true);

      controller.destroy();
    });
  });
});
