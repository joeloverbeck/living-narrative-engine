/**
 * @file Modal functionality tests for ThematicDirectionsManagerController
 * @description Tests modal display, confirmation, and cancellation behavior
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

// Helper function to get element ID mapping
/**
 *
 * @param key
 */
function getElementId(key) {
  const mapping = {
    confirmationModal: 'confirmation-modal',
    modalTitle: 'modal-title',
    modalMessage: 'modal-message',
    modalConfirmBtn: 'modal-confirm-btn',
    modalCancelBtn: 'modal-cancel-btn',
    closeModalBtn: 'close-modal-btn',
  };
  return mapping[key] || key;
}

describe('ThematicDirectionsManagerController - Modal Tests', () => {
  let testBase;
  let controller;

  beforeEach(async () => {
    try {
      testBase = new BaseCharacterBuilderControllerTestBase();
      await testBase.setup();

      // Add required DOM elements for modal tests
      testBase.addDOMElement(`
        <div id="confirmation-modal" style="display: none;">
          <h2 id="modal-title"></h2>
          <p id="modal-message"></p>
          <button id="modal-confirm-btn"></button>
          <button id="modal-cancel-btn"></button>
          <button id="close-modal-btn"></button>
        </div>
      `);

      controller = new ThematicDirectionsManagerController(testBase.mocks);

      // Setup spies for modal interaction
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
    } catch (error) {
      console.error('Setup failed:', error);
      throw error;
    }
  });

  afterEach(async () => {
    try {
      if (controller && !controller.isDestroyed) {
        await controller.destroy();
      }

      await testBase.cleanup();
      jest.restoreAllMocks();

      controller = null;
    } catch (error) {
      console.error('Cleanup failed:', error);
    }
  });

  describe('Modal Display', () => {
    it('should show confirmation modal with content', () => {
      const modalOptions = {
        title: 'Test Modal',
        message: 'Test message',
        onConfirm: jest.fn(),
        confirmText: 'Yes',
        cancelText: 'No',
        type: 'confirm',
      };

      controller._showConfirmationModal(modalOptions);

      expect(controller._setElementText).toHaveBeenCalledWith(
        'modalTitle',
        'Test Modal'
      );
      expect(controller._setElementText).toHaveBeenCalledWith(
        'modalMessage',
        'Test message'
      );
      expect(controller._showElement).toHaveBeenCalledWith(
        'confirmationModal',
        'flex'
      );
    });
  });

  describe('Modal Actions', () => {
    it('should handle modal confirm action', () => {
      const confirmAction = jest.fn();
      const modalOptions = {
        title: 'Test',
        message: 'Test',
        onConfirm: confirmAction,
      };

      controller._showConfirmationModal(modalOptions);
      controller._handleModalConfirm();

      expect(confirmAction).toHaveBeenCalled();
    });

    it('should handle modal cancel', () => {
      const cancelAction = jest.fn();
      const modalOptions = {
        title: 'Test',
        message: 'Test',
        onConfirm: jest.fn(),
        onCancel: cancelAction,
      };

      controller._showConfirmationModal(modalOptions);
      controller._handleModalCancel();

      expect(cancelAction).toHaveBeenCalled();
      expect(controller._hideElement).toHaveBeenCalledWith('confirmationModal');
    });
  });

  describe('Modal Cleanup', () => {
    it('should cleanup modal state on destroy', async () => {
      const modalOptions = {
        title: 'Test',
        message: 'Test',
        onConfirm: jest.fn(),
      };

      controller._showConfirmationModal(modalOptions);
      controller._closeModal = jest.fn();

      await controller.destroy();

      expect(controller.isDestroyed).toBe(true);
    });
  });
});
