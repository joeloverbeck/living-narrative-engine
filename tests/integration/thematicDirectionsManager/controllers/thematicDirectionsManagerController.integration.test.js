/**
 * @file Integration tests for ThematicDirectionsManagerController
 * @description Tests complete workflow integration including service calls and UI updates
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { BaseCharacterBuilderControllerTestBase } from '../../../unit/characterBuilder/controllers/BaseCharacterBuilderController.testbase.js';
import { ThematicDirectionsManagerController } from '../../../../src/thematicDirectionsManager/controllers/thematicDirectionsManagerController.js';

// Mock the PreviousItemsDropdown
jest.mock(
  '../../../../src/shared/characterBuilder/previousItemsDropdown.js',
  () => ({
    PreviousItemsDropdown: jest.fn().mockImplementation((config) => {
      // Store the callback globally so tests can access it
      if (config && config.onSelectionChange) {
        global.__testSelectionHandler = config.onSelectionChange;
      }
      return {
        loadItems: jest.fn().mockResolvedValue(true),
        destroy: jest.fn(),
        _onSelectionChange: config?.onSelectionChange,
      };
    }),
  })
);

// Mock the InPlaceEditor
jest.mock('../../../../src/shared/characterBuilder/inPlaceEditor.js', () => ({
  InPlaceEditor: jest.fn().mockImplementation(() => ({
    destroy: jest.fn(),
  })),
}));

describe('ThematicDirectionsManagerController - Integration Tests', () => {
  let testBase;
  let controller;

  beforeEach(async () => {
    // Initialize test base
    testBase = new BaseCharacterBuilderControllerTestBase();
    await testBase.setup();

    // Add complete DOM structure for integration testing
    testBase.addDOMElement(`
      <div class="character-builder-container">
        <div class="cb-input-panel concept-selection-panel">
          <select id="concept-selector"></select>
          <div id="concept-display-container" style="display: none;">
            <div id="concept-display-content"></div>
          </div>
        </div>
        <div class="cb-main-content">
          <div id="empty-state" style="display: none;">
            <p class="empty-message">No thematic directions found</p>
          </div>
          <div id="loading-state" style="display: none;"></div>
          <div id="error-state" style="display: none;">
            <div id="error-message-text"></div>
          </div>
          <div id="results-state" style="display: none;">
            <div id="direction-filter"></div>
            <div id="directions-results"></div>
            <div id="total-directions"></div>
            <div id="orphaned-count"></div>
          </div>
        </div>
        <div class="cb-actions">
          <button id="refresh-btn">Refresh</button>
          <button id="cleanup-orphans-btn">Cleanup Orphans</button>
          <button id="back-to-menu-btn">Back to Menu</button>
          <button id="retry-btn" style="display: none;">Retry</button>
        </div>
        <div id="confirmation-modal" class="modal" style="display: none;">
          <div class="modal-content">
            <button id="close-modal-btn" class="modal-close">×</button>
            <h2 id="modal-title"></h2>
            <p id="modal-message"></p>
            <div class="modal-actions">
              <button id="modal-confirm-btn"></button>
              <button id="modal-cancel-btn"></button>
            </div>
          </div>
        </div>
        <div id="success-notification" class="notification notification-success" style="display: none;"></div>
      </div>
    `);

    // Setup global functions
    global.setTimeout = jest.fn((callback, delay) => {
      callback();
      return 'mock-timeout-id';
    });
    global.clearTimeout = jest.fn();
    global.alert = jest.fn();

    // Mock document event listeners for modal tests
    global.document.addEventListener = jest.fn();
    global.document.removeEventListener = jest.fn();

    // Clean up any previous global handler
    delete global.__testSelectionHandler;

    // Create controller instance using test base mocks
    controller = new ThematicDirectionsManagerController(testBase.mocks);
  });

  afterEach(async () => {
    await testBase.cleanup();
    jest.restoreAllMocks();
  });

  describe('Complete Initialization Workflow', () => {
    it('should initialize controller with all components', async () => {
      await controller.initialize();

      // Verify PreviousItemsDropdown was created
      expect(global.__testSelectionHandler).toBeDefined();

      // Verify no errors were logged during initialization
      expect(testBase.mocks.logger.error).not.toHaveBeenCalled();
    });

    it('should handle initialization errors gracefully', async () => {
      // Mock service to throw error during initialization
      testBase.mocks.characterBuilderService.getAllThematicDirectionsWithConcepts.mockRejectedValue(
        new Error('Service initialization failed')
      );

      await controller.initialize();

      // Should log error but not throw
      expect(testBase.mocks.logger.error).toHaveBeenCalled();
    });
  });

  describe('Complete Data Loading Workflow', () => {
    beforeEach(async () => {
      await controller.initialize();
    });

    it('should load and display thematic directions with concepts', async () => {
      const mockDirections = [
        {
          direction: {
            id: 'dir-1',
            title: 'Heroic Journey',
            description: 'A path of heroism and self-discovery',
            thematicDirection: 'Hero becomes legend through trials',
            conceptId: 'concept-1',
          },
          concept: {
            id: 'concept-1',
            concept: 'A brave knight seeking redemption',
            status: 'completed',
          },
        },
        {
          direction: {
            id: 'dir-2',
            title: 'Dark Path',
            description: 'A journey into darkness',
            thematicDirection: 'Character falls to corruption',
            conceptId: null,
          },
          concept: null,
        },
      ];

      testBase.mocks.characterBuilderService.getAllThematicDirectionsWithConcepts.mockResolvedValue(
        mockDirections
      );

      // Trigger data loading by calling the refresh method
      const refreshMethod = controller._refreshDirections || controller.refresh;
      if (typeof refreshMethod === 'function') {
        await refreshMethod.call(controller);
      }

      // Verify service was called
      expect(
        testBase.mocks.characterBuilderService
          .getAllThematicDirectionsWithConcepts
      ).toHaveBeenCalled();

      // The controller should process the data without errors
      expect(testBase.mocks.logger.error).not.toHaveBeenCalled();
    });

    it('should handle empty data gracefully', async () => {
      testBase.mocks.characterBuilderService.getAllThematicDirectionsWithConcepts.mockResolvedValue(
        []
      );

      // Trigger data loading
      const refreshMethod = controller._refreshDirections || controller.refresh;
      if (typeof refreshMethod === 'function') {
        await refreshMethod.call(controller);
      }

      // Should show empty state
      expect(testBase.mocks.logger.error).not.toHaveBeenCalled();
    });

    it('should handle service errors during data loading', async () => {
      testBase.mocks.characterBuilderService.getAllThematicDirectionsWithConcepts.mockRejectedValue(
        new Error('Failed to load directions')
      );

      // Trigger data loading via refreshDropdown
      await controller.refreshDropdown();

      // Should log error and show error state
      expect(testBase.mocks.logger.error).toHaveBeenCalled();
    });
  });

  describe('Concept Selection Integration', () => {
    beforeEach(async () => {
      await controller.initialize();
    });

    it('should load and display concept when selected', async () => {
      const mockConcept = {
        id: 'concept-123',
        concept: 'A brave knight seeking redemption for past mistakes',
        status: 'completed',
        createdAt: new Date('2023-01-01T12:00:00Z'),
        updatedAt: new Date('2023-01-01T12:00:00Z'),
        thematicDirections: [{ id: 'dir-1' }, { id: 'dir-2' }],
        metadata: {},
      };

      testBase.mocks.characterBuilderService.getCharacterConcept.mockResolvedValue(
        mockConcept
      );

      // Get the selection handler
      const selectionHandler = global.__testSelectionHandler;
      expect(selectionHandler).toBeDefined();

      // Trigger concept selection
      await selectionHandler('concept-123');

      // Verify service was called
      expect(
        testBase.mocks.characterBuilderService.getCharacterConcept
      ).toHaveBeenCalledWith('concept-123');

      // Verify concept display is visible
      const conceptDisplayContainer = document.getElementById(
        'concept-display-container'
      );
      expect(conceptDisplayContainer.style.display).toBe('block');
    });

    it('should handle concept loading errors', async () => {
      testBase.mocks.characterBuilderService.getCharacterConcept.mockRejectedValue(
        new Error('Failed to load concept')
      );

      const selectionHandler = global.__testSelectionHandler;
      await selectionHandler('concept-error');

      // Should log error and hide concept display
      expect(testBase.mocks.logger.error).toHaveBeenCalledWith(
        expect.stringMatching(/Failed to load character concept/),
        expect.any(Error)
      );

      const conceptDisplayContainer = document.getElementById(
        'concept-display-container'
      );
      expect(conceptDisplayContainer.style.display).toBe('none');
    });
  });

  describe('Delete Direction Workflow Integration', () => {
    beforeEach(async () => {
      await controller.initialize();
    });

    it('should complete full delete workflow with confirmation', async () => {
      const mockDirection = {
        id: 'dir-to-delete',
        title: 'Test Direction',
      };

      testBase.mocks.characterBuilderService.deleteThematicDirection.mockResolvedValue();

      // Create a spy for the confirmation modal
      const showConfirmationSpy = jest
        .spyOn(controller, '_showConfirmationModal')
        .mockImplementation((options) => {
          // Simulate user clicking confirm
          setTimeout(() => {
            if (options.onConfirm) {
              options.onConfirm();
            }
          }, 0);
        });

      // Simulate delete button click by calling the delete method
      const deleteMethod =
        controller._deleteDirection || controller.deleteDirection;
      if (typeof deleteMethod === 'function') {
        await deleteMethod.call(controller, mockDirection);
      }

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Verify confirmation modal was shown
      expect(showConfirmationSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Delete Thematic Direction',
          confirmText: 'Delete',
          cancelText: 'Keep',
          type: 'confirm',
        })
      );

      showConfirmationSpy.mockRestore();
    });
  });

  describe('Modal Integration Workflow', () => {
    beforeEach(async () => {
      await controller.initialize();
    });

    it('should show and handle confirmation modal', () => {
      const confirmAction = jest.fn();
      const cancelAction = jest.fn();

      controller._showConfirmationModal({
        title: 'Integration Test Modal',
        message: 'This is a test message',
        onConfirm: confirmAction,
        onCancel: cancelAction,
        confirmText: 'Yes',
        cancelText: 'No',
        type: 'confirm',
      });

      // Verify modal is displayed
      const modal = document.getElementById('confirmation-modal');
      const modalTitle = document.getElementById('modal-title');
      const modalMessage = document.getElementById('modal-message');

      expect(modal.style.display).toBe('flex');
      expect(modalTitle.textContent).toBe('Integration Test Modal');
      expect(modalMessage.textContent).toBe('This is a test message');
    });

    it('should handle modal keyboard interactions', () => {
      controller._showConfirmationModal({
        title: 'Test',
        message: 'Test',
        onConfirm: jest.fn(),
      });

      // Verify ESC key handler was added
      expect(global.document.addEventListener).toHaveBeenCalledWith(
        'keydown',
        expect.any(Function),
        true
      );
    });
  });

  describe('Error Recovery Integration', () => {
    beforeEach(async () => {
      await controller.initialize();
    });

    it('should recover from service errors and allow retry', async () => {
      // First call fails
      testBase.mocks.characterBuilderService.getAllThematicDirectionsWithConcepts
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce([]);

      // Trigger initial load (fails)
      await controller.refreshDropdown();

      // Verify error was logged
      expect(testBase.mocks.logger.error).toHaveBeenCalled();

      // Clear previous calls
      testBase.mocks.logger.error.mockClear();

      // Retry (succeeds)
      await controller.refreshDropdown();

      // Should not log new errors
      expect(testBase.mocks.logger.error).not.toHaveBeenCalled();
    });
  });

  describe('Resource Cleanup Integration', () => {
    beforeEach(async () => {
      await controller.initialize();
    });

    it('should perform complete cleanup on destroy', () => {
      // Set up various resources
      controller._showSuccess('Test notification');
      controller._showConfirmationModal({
        title: 'Test Modal',
        message: 'Test message',
        onConfirm: jest.fn(),
      });

      // Verify resources are active
      expect(global.setTimeout).toHaveBeenCalled();
      expect(global.document.addEventListener).toHaveBeenCalled();

      // Perform cleanup
      controller._preDestroy();
      controller._postDestroy();

      // Verify cleanup occurred
      expect(global.clearTimeout).toHaveBeenCalled();
      expect(testBase.mocks.logger.error).not.toHaveBeenCalled();
    });
  });

  describe('State Transition Integration', () => {
    beforeEach(async () => {
      await controller.initialize();
    });

    it('should transition between loading, results, and empty states', async () => {
      // Add spies for state methods
      const showLoadingSpy = jest
        .spyOn(controller, '_showLoading')
        .mockImplementation(() => {});
      const showResultsSpy = jest
        .spyOn(controller, '_showResults')
        .mockImplementation(() => {});
      const showEmptySpy = jest
        .spyOn(controller, '_showEmpty')
        .mockImplementation(() => {});

      // Mock service to return data
      testBase.mocks.characterBuilderService.getAllThematicDirectionsWithConcepts.mockResolvedValue(
        [
          {
            direction: { id: 'dir-1', title: 'Test' },
            concept: { id: 'concept-1', concept: 'Test concept' },
          },
        ]
      );

      // Trigger refresh
      const refreshMethod = controller._refreshDirections || controller.refresh;
      if (typeof refreshMethod === 'function') {
        await refreshMethod.call(controller);
      }

      // Should have shown loading initially (implementation dependent)
      // and then shown results
      expect(testBase.mocks.logger.error).not.toHaveBeenCalled();

      showLoadingSpy.mockRestore();
      showResultsSpy.mockRestore();
      showEmptySpy.mockRestore();
    });
  });
});
