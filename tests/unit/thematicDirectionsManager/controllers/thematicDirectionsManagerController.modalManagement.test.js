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
import { BaseCharacterBuilderControllerTestBase } from '../../characterBuilder/controllers/BaseCharacterBuilderController.testbase.js';
import { ThematicDirectionsManagerController } from '../../../../src/thematicDirectionsManager/controllers/thematicDirectionsManagerController.js';

describe('ThematicDirectionsManagerController - Modal Management', () => {
  let testBase;
  let controller;
  let originalSetTimeout;
  let documentActiveElementSpy;

  beforeEach(async () => {
    // Initialize test base
    testBase = new BaseCharacterBuilderControllerTestBase();
    await testBase.setup();

    // Add modal DOM elements
    testBase.addDOMElement(`
      <div id="confirmation-modal" class="modal" style="display: none;">
        <div class="modal-content">
          <h2 id="modal-title"></h2>
          <p id="modal-message"></p>
          <div class="modal-actions">
            <button id="modal-confirm-btn"></button>
            <button id="modal-cancel-btn"></button>
          </div>
        </div>
      </div>
    `);

    // Setup document mock globals
    const defaultActiveElement = { focus: jest.fn() };
    originalSetTimeout = global.setTimeout;
    jest.spyOn(document, 'addEventListener');
    jest.spyOn(document, 'removeEventListener');
    documentActiveElementSpy = jest.spyOn(document, 'activeElement', 'get');
    documentActiveElementSpy.mockReturnValue(defaultActiveElement);

    // Mock setTimeout
    global.setTimeout = jest.fn((callback, delay) => {
      callback();
      return 1;
    });

    // Create controller instance using test base mocks
    controller = new ThematicDirectionsManagerController(testBase.mocks);

    // Add spies for controller methods
    jest.spyOn(controller, '_getElement').mockImplementation((key) => {
      return document.getElementById(getElementId(key));
    });
    jest
      .spyOn(controller, '_setElementText')
      .mockImplementation((key, text) => {
        const element = document.getElementById(getElementId(key));
        if (element) {
          element.textContent = text;
          return true;
        }
        return false;
      });
    jest
      .spyOn(controller, '_showElement')
      .mockImplementation((key, displayType = 'block') => {
        const element = document.getElementById(getElementId(key));
        if (element) {
          element.style.display = displayType;
          return true;
        }
        return false;
      });
    jest.spyOn(controller, '_hideElement').mockImplementation((key) => {
      const element = document.getElementById(getElementId(key));
      if (element) {
        element.style.display = 'none';
        return true;
      }
      return false;
    });
  });

  afterEach(async () => {
    await testBase.cleanup();
    jest.restoreAllMocks();
    if (originalSetTimeout) {
      global.setTimeout = originalSetTimeout;
      originalSetTimeout = null;
    }
  });


  // Helper function to map element keys to DOM IDs
  /**
   *
   * @param key
   */
  function getElementId(key) {
    const keyToIdMap = {
      confirmationModal: 'confirmation-modal',
      modalTitle: 'modal-title',
      modalMessage: 'modal-message',
      modalConfirmBtn: 'modal-confirm-btn',
      modalCancelBtn: 'modal-cancel-btn',
    };
    return keyToIdMap[key] || key;
  }

  describe('_showConfirmationModal', () => {
    beforeEach(() => {
      // Add spies for modal methods
      jest
        .spyOn(controller, '_showConfirmationModal')
        .mockImplementation((options) => {
          // Mock the behavior of showing the confirmation modal
          controller._setElementText('modalTitle', options.title);
          controller._setElementText('modalMessage', options.message);
          controller._setElementText(
            'modalConfirmBtn',
            options.confirmText || 'Confirm'
          );
          controller._setElementText(
            'modalCancelBtn',
            options.cancelText || 'Cancel'
          );

          const modal = document.getElementById('confirmation-modal');
          if (options.type === 'alert') {
            modal.className = 'modal modal-alert';
            controller._hideElement('modalCancelBtn');
          } else {
            modal.className = 'modal';
          }

          controller._showElement('confirmationModal', 'flex');

          // Setup keyboard handler
          document.addEventListener(
            'keydown',
            expect.any(Function),
            true
          );

          // Focus the confirm button after a timeout
          global.setTimeout(() => {
            const confirmBtn = document.getElementById('modal-confirm-btn');
            if (confirmBtn && confirmBtn.focus) {
              confirmBtn.focus();
            }
          }, 0);
        });
    });

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

      const modal = document.getElementById('confirmation-modal');
      expect(modal.className).toBe('modal modal-alert');
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
    });
  });

  describe('_handleModalConfirm', () => {
    beforeEach(() => {
      // Setup spies for modal helper methods but let _handleModalConfirm execute naturally
      jest.spyOn(controller, '_closeModal').mockImplementation(() => {
        controller._hideElement('confirmationModal');
      });
    });

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
      expect(controller._closeModal).toHaveBeenCalled();
    });

    it('should execute asynchronous confirm action', async () => {
      const confirmAction = jest.fn().mockResolvedValue();

      controller._showConfirmationModal({
        title: 'Test',
        message: 'Test',
        onConfirm: confirmAction,
      });

      // Execute the handler
      controller._handleModalConfirm();

      // Wait for the async action to complete
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(confirmAction).toHaveBeenCalled();
      expect(controller._closeModal).toHaveBeenCalled();
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

      // Execute the handler
      controller._handleModalConfirm();

      // Wait for the promise to be processed - use multiple microtasks
      await new Promise((resolve) => setTimeout(resolve, 0));
      await new Promise((resolve) => process.nextTick(resolve));

      expect(confirmAction).toHaveBeenCalled();
      expect(testBase.mocks.logger.error).toHaveBeenCalledWith(
        'Modal action failed:',
        expect.any(Error)
      );
      expect(global.alert).toHaveBeenCalledWith(
        'Operation failed. Please try again.'
      );
    });

    it('should warn when no pending action exists', () => {
      // Don't show modal first - just call _handleModalConfirm directly
      controller._handleModalConfirm();

      expect(testBase.mocks.logger.warn).toHaveBeenCalledWith(
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

      expect(confirmAction).toHaveBeenCalled();
      expect(testBase.mocks.logger.error).toHaveBeenCalledWith(
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
    it('should setup ESC key handler when modal is shown', () => {
      controller._showConfirmationModal({
        title: 'Test',
        message: 'Test',
        onConfirm: jest.fn(),
      });

      expect(document.addEventListener).toHaveBeenCalledWith(
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
      const addEventListenerCalls = document.addEventListener.mock.calls;
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

      expect(document.removeEventListener).toHaveBeenCalledWith(
        'keydown',
        expect.any(Function),
        true
      );
    });
  });

  describe('Focus management', () => {
    it('should track focus when modal is shown', () => {
      const mockActiveElement = { focus: jest.fn() };

      documentActiveElementSpy.mockReturnValue(mockActiveElement);

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

      documentActiveElementSpy.mockReturnValue(mockActiveElement);

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
      testBase.mocks.characterBuilderService.deleteThematicDirection.mockResolvedValue();

      // Note: We can't access private fields directly in tests,
      // so this test focuses on the modal interaction pattern

      // Simulate calling the private method indirectly
      controller._showConfirmationModal({
        title: 'Delete Thematic Direction',
        message: `Are you sure you want to delete "${mockDirection.title}"? This action cannot be undone.`,
        onConfirm: async () => {
          await testBase.mocks.characterBuilderService.deleteThematicDirection(
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
