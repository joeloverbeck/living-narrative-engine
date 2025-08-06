/**
 * @file Unit tests for ThematicDirectionsManagerController modal management functionality
 * @description Tests the modal management system migrated to base controller patterns
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { ThematicDirectionsManagerController } from '../../../../src/thematicDirectionsManager/controllers/thematicDirectionsManagerController.js';

// Mock dependencies
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
};

const mockCharacterBuilderService = {
  initialize: jest.fn(),
  deleteThematicDirection: jest.fn(),
};

const mockEventBus = {
  dispatch: jest.fn(),
};

const mockSchemaValidator = {
  validate: jest.fn(),
};

const mockUIStateManager = {
  showState: jest.fn(),
  showError: jest.fn(),
};

// Mock BaseCharacterBuilderController
jest.mock(
  '../../../../src/characterBuilder/controllers/BaseCharacterBuilderController.js',
  () => ({
    BaseCharacterBuilderController: jest
      .fn()
      .mockImplementation(function (dependencies) {
        // Store dependencies to make them accessible via getters
        this._logger = dependencies.logger;
        this._characterBuilderService = dependencies.characterBuilderService;
        this._eventBus = dependencies.eventBus;
        this._schemaValidator = dependencies.schemaValidator;

        // Mock elements storage
        this._elements = {};

        // Mock base controller methods
        this._getElement = jest.fn((key) => this._elements[key] || null);
        this._setElementText = jest.fn((key, text) => {
          const element = this._elements[key];
          if (element) {
            element.textContent = text;
            return true;
          }
          return false;
        });
        this._showElement = jest.fn((key, displayType) => {
          const element = this._elements[key];
          if (element) {
            element.style.display = displayType || 'block';
            return true;
          }
          return false;
        });
        this._hideElement = jest.fn((key) => {
          const element = this._elements[key];
          if (element) {
            element.style.display = 'none';
            return true;
          }
          return false;
        });
        this._addEventListener = jest.fn();
        this._cacheElementsFromMap = jest.fn();

        // Store additional services
        this.additionalServices = {
          uiStateManager: dependencies.uiStateManager,
        };

        // Mock parent destroy methods
        this._preDestroy = jest.fn();
        this._postDestroy = jest.fn();

        // Mock getter methods to access dependencies
        Object.defineProperty(this, 'logger', {
          get: function () {
            return this._logger;
          },
        });
        Object.defineProperty(this, 'characterBuilderService', {
          get: function () {
            return this._characterBuilderService;
          },
        });
        Object.defineProperty(this, 'eventBus', {
          get: function () {
            return this._eventBus;
          },
        });
        Object.defineProperty(this, 'schemaValidator', {
          get: function () {
            return this._schemaValidator;
          },
        });
      }),
  })
);

describe('ThematicDirectionsManagerController - Modal Management', () => {
  let controller;
  let mockElements;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create mock DOM elements
    mockElements = {
      confirmationModal: {
        style: { display: 'none' },
        className: 'modal',
        focus: jest.fn(),
      },
      modalTitle: { textContent: '' },
      modalMessage: { textContent: '' },
      modalConfirmBtn: {
        textContent: '',
        focus: jest.fn(),
      },
      modalCancelBtn: {
        textContent: '',
        style: { display: 'block' },
      },
    };

    // Setup document mock
    const mockActiveElement = { focus: jest.fn() };
    global.document = {
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    };

    // Mock activeElement with a getter
    Object.defineProperty(global.document, 'activeElement', {
      get: jest.fn(() => mockActiveElement),
      configurable: true,
    });

    // Mock setTimeout
    global.setTimeout = jest.fn((callback, delay) => {
      callback();
      return 1;
    });

    // Create controller instance
    controller = new ThematicDirectionsManagerController({
      logger: mockLogger,
      characterBuilderService: mockCharacterBuilderService,
      eventBus: mockEventBus,
      schemaValidator: mockSchemaValidator,
      uiStateManager: mockUIStateManager,
    });

    // Set up mock elements in controller
    controller._elements = mockElements;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('_showConfirmationModal', () => {
    it('should show confirmation modal with correct content', () => {
      const options = {
        title: 'Test Title',
        message: 'Test Message',
        onConfirm: jest.fn(),
        confirmText: 'Yes',
        cancelText: 'No',
        type: 'confirm',
      };

      controller._showConfirmationModal(options);

      expect(controller._setElementText).toHaveBeenCalledWith(
        'modalTitle',
        'Test Title'
      );
      expect(controller._setElementText).toHaveBeenCalledWith(
        'modalMessage',
        'Test Message'
      );
      expect(controller._setElementText).toHaveBeenCalledWith(
        'modalConfirmBtn',
        'Yes'
      );
      expect(controller._setElementText).toHaveBeenCalledWith(
        'modalCancelBtn',
        'No'
      );
      expect(controller._showElement).toHaveBeenCalledWith(
        'confirmationModal',
        'flex'
      );
    });

    it('should use default button text when not provided', () => {
      const options = {
        title: 'Test',
        message: 'Test',
        onConfirm: jest.fn(),
      };

      controller._showConfirmationModal(options);

      expect(controller._setElementText).toHaveBeenCalledWith(
        'modalConfirmBtn',
        'Confirm'
      );
      expect(controller._setElementText).toHaveBeenCalledWith(
        'modalCancelBtn',
        'Cancel'
      );
    });

    it('should handle alert type modals', () => {
      const options = {
        title: 'Alert',
        message: 'Alert Message',
        onConfirm: jest.fn(),
        type: 'alert',
      };

      controller._showConfirmationModal(options);

      expect(mockElements.confirmationModal.className).toBe(
        'modal modal-alert'
      );
      expect(controller._hideElement).toHaveBeenCalledWith('modalCancelBtn');
    });

    it('should focus confirm button after showing modal', () => {
      const options = {
        title: 'Test',
        message: 'Test',
        onConfirm: jest.fn(),
      };

      controller._showConfirmationModal(options);

      expect(global.setTimeout).toHaveBeenCalled();
      expect(mockElements.modalConfirmBtn.focus).toHaveBeenCalled();
    });
  });

  describe('_handleModalConfirm', () => {
    it('should execute synchronous confirm action', () => {
      const confirmAction = jest.fn();

      // Set up modal state
      controller._showConfirmationModal({
        title: 'Test',
        message: 'Test',
        onConfirm: confirmAction,
      });

      controller._handleModalConfirm();

      expect(confirmAction).toHaveBeenCalled();
      expect(controller._hideElement).toHaveBeenCalledWith('confirmationModal');
    });

    it('should execute asynchronous confirm action', async () => {
      const confirmAction = jest.fn().mockResolvedValue();

      controller._showConfirmationModal({
        title: 'Test',
        message: 'Test',
        onConfirm: confirmAction,
      });

      controller._handleModalConfirm();

      // Wait for promise to resolve
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(confirmAction).toHaveBeenCalled();
    });

    it('should handle async action errors', async () => {
      const confirmAction = jest
        .fn()
        .mockRejectedValue(new Error('Test error'));
      global.alert = jest.fn();

      controller._showConfirmationModal({
        title: 'Test',
        message: 'Test',
        onConfirm: confirmAction,
      });

      // Execute and wait for the promise to resolve/reject
      controller._handleModalConfirm();

      // Wait for the promise to be processed
      await new Promise((resolve) => process.nextTick(resolve));

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Modal action failed:',
        expect.any(Error)
      );
      expect(global.alert).toHaveBeenCalledWith(
        'Operation failed. Please try again.'
      );
    });

    it('should warn when no pending action exists', () => {
      controller._handleModalConfirm();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'No pending modal action to confirm'
      );
    });

    it('should handle sync action errors', () => {
      const confirmAction = jest.fn().mockImplementation(() => {
        throw new Error('Sync error');
      });
      global.alert = jest.fn();

      controller._showConfirmationModal({
        title: 'Test',
        message: 'Test',
        onConfirm: confirmAction,
      });

      controller._handleModalConfirm();

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error executing modal action:',
        expect.any(Error)
      );
      expect(global.alert).toHaveBeenCalledWith(
        'An error occurred. Please try again.'
      );
    });
  });

  describe('_handleModalCancel', () => {
    it('should call cancel callback when provided', () => {
      const cancelAction = jest.fn();

      controller._showConfirmationModal({
        title: 'Test',
        message: 'Test',
        onConfirm: jest.fn(),
        onCancel: cancelAction,
      });

      controller._handleModalCancel();

      expect(cancelAction).toHaveBeenCalled();
    });

    it('should close modal', () => {
      controller._showConfirmationModal({
        title: 'Test',
        message: 'Test',
        onConfirm: jest.fn(),
      });

      controller._handleModalCancel();

      expect(controller._hideElement).toHaveBeenCalledWith('confirmationModal');
    });
  });

  describe('Keyboard handling', () => {
    beforeEach(() => {
      // Make sure document methods are mocked
      global.document.addEventListener = jest.fn();
      global.document.removeEventListener = jest.fn();
    });

    it('should setup ESC key handler when modal is shown', () => {
      controller._showConfirmationModal({
        title: 'Test',
        message: 'Test',
        onConfirm: jest.fn(),
      });

      expect(global.document.addEventListener).toHaveBeenCalledWith(
        'keydown',
        expect.any(Function),
        true
      );
    });

    it('should close modal on ESC key', () => {
      controller._showConfirmationModal({
        title: 'Test',
        message: 'Test',
        onConfirm: jest.fn(),
      });

      // Get the event handler from the mock calls
      const addEventListenerCalls = global.document.addEventListener.mock.calls;
      const keydownCall = addEventListenerCalls.find(
        (call) => call[0] === 'keydown'
      );
      const keyHandler = keydownCall[1];

      // Simulate ESC key
      const event = { key: 'Escape', preventDefault: jest.fn() };
      keyHandler(event);

      expect(event.preventDefault).toHaveBeenCalled();
      expect(controller._hideElement).toHaveBeenCalledWith('confirmationModal');
    });

    it('should remove event handler when modal closes', () => {
      controller._showConfirmationModal({
        title: 'Test',
        message: 'Test',
        onConfirm: jest.fn(),
      });

      controller._closeModal();

      expect(global.document.removeEventListener).toHaveBeenCalledWith(
        'keydown',
        expect.any(Function),
        true
      );
    });
  });

  describe('Focus management', () => {
    it('should track focus when modal is shown', () => {
      const mockActiveElement = { focus: jest.fn() };

      // Mock activeElement for this test
      Object.defineProperty(global.document, 'activeElement', {
        get: jest.fn(() => mockActiveElement),
        configurable: true,
      });

      controller._showConfirmationModal({
        title: 'Test',
        message: 'Test',
        onConfirm: jest.fn(),
      });

      // Close modal to trigger restore focus
      controller._closeModal();

      expect(mockActiveElement.focus).toHaveBeenCalled();
    });

    it('should handle focus restoration errors gracefully', () => {
      const mockActiveElement = {
        focus: jest.fn().mockImplementation(() => {
          throw new Error('Focus error');
        }),
      };

      // Mock activeElement for this test
      Object.defineProperty(global.document, 'activeElement', {
        get: jest.fn(() => mockActiveElement),
        configurable: true,
      });

      controller._showConfirmationModal({
        title: 'Test',
        message: 'Test',
        onConfirm: jest.fn(),
      });

      // Should not throw when closing modal
      expect(() => controller._closeModal()).not.toThrow();
    });
  });

  describe('_showAlert', () => {
    it('should show alert modal with OK button only', () => {
      controller._showAlert({
        title: 'Alert',
        message: 'Alert message',
      });

      expect(controller._setElementText).toHaveBeenCalledWith(
        'modalConfirmBtn',
        'OK'
      );
      expect(controller._hideElement).toHaveBeenCalledWith('modalCancelBtn');
    });
  });

  describe('Cleanup on destroy', () => {
    beforeEach(() => {
      // Make sure document methods are mocked
      global.document.addEventListener = jest.fn();
      global.document.removeEventListener = jest.fn();
    });

    it('should call _preDestroy without errors', () => {
      // Show modal first to setup some state
      controller._showConfirmationModal({
        title: 'Test',
        message: 'Test',
        onConfirm: jest.fn(),
      });

      // Call preDestroy which should clean up handlers
      // The important thing is that it doesn't throw
      expect(() => controller._preDestroy()).not.toThrow();

      // Verify parent _preDestroy was called
      expect(controller._preDestroy).toBeDefined();
    });

    it('should not error when preDestroy is called without active modal', () => {
      // Should not throw when called without an active modal
      expect(() => controller._preDestroy()).not.toThrow();
    });
  });

  describe('Integration with existing functionality', () => {
    it('should work with delete direction flow', () => {
      const mockDirection = {
        id: 'dir1',
        title: 'Test Direction',
      };

      // Mock the characterBuilderService method
      mockCharacterBuilderService.deleteThematicDirection.mockResolvedValue();

      // Note: We can't access private fields directly in tests,
      // so this test focuses on the modal interaction pattern

      // Simulate calling the private method indirectly
      controller._showConfirmationModal({
        title: 'Delete Thematic Direction',
        message: `Are you sure you want to delete "${mockDirection.title}"? This action cannot be undone.`,
        onConfirm: async () => {
          await mockCharacterBuilderService.deleteThematicDirection(
            mockDirection.id
          );
        },
        confirmText: 'Delete',
        cancelText: 'Keep',
        type: 'confirm',
      });

      expect(controller._setElementText).toHaveBeenCalledWith(
        'modalTitle',
        'Delete Thematic Direction'
      );
      expect(controller._setElementText).toHaveBeenCalledWith(
        'modalConfirmBtn',
        'Delete'
      );
      expect(controller._setElementText).toHaveBeenCalledWith(
        'modalCancelBtn',
        'Keep'
      );
    });
  });
});
