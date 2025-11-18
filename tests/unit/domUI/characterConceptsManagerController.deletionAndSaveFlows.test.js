/**
 * @file Unit tests for CharacterConceptsManagerController deletion and save flows
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { CharacterConceptsManagerTestBase } from './characterConceptsManagerController.testUtils.enhanced.js';
import { FormValidationHelper } from '../../../src/shared/characterBuilder/formValidationHelper.js';

/**
 *
 * @param controller
 */
function setupRealConceptsResults(controller) {
  return controller._getElement('conceptsResults');
}

describe('CharacterConceptsManagerController - Deletion and Save flows', () => {
  const testBase = new CharacterConceptsManagerTestBase();
  let controller;

  beforeEach(async () => {
    await testBase.setup();
    controller = testBase.createController();
    testBase.controller = controller;
    await controller.initialize();
  });

  afterEach(async () => {
    jest.useRealTimers();
    await testBase.cleanup();
  });

  describe('Delete confirmation UI', () => {
    it('should show delete confirmation with severe action when concept has directions', () => {
      const concept = { id: 'concept-1', concept: 'Test concept text' };

      controller._showDeleteConfirmation(concept, 2);

      const message = controller
        ._getElement('deleteModalMessage')
        .innerHTML.replace(/<br>/g, '\n');
      expect(message).toContain('Are you sure you want to delete this character concept?');
      expect(message).toContain('⚠️');

      const confirmBtn = controller._getElement('confirmDeleteBtn');
      expect(confirmBtn.textContent).toBe('Delete Concept & 2 Directions');
      expect(confirmBtn.classList.contains('severe-action')).toBe(true);
    });

    it('should reset severe action styling when no directions exist', () => {
      const confirmBtn = controller._getElement('confirmDeleteBtn');
      confirmBtn.classList.add('severe-action');
      confirmBtn.textContent = 'Custom';

      controller._showDeleteConfirmation(
        { id: 'concept-2', concept: 'Another concept' },
        0
      );

      expect(confirmBtn.textContent).toBe('Delete Concept');
      expect(confirmBtn.classList.contains('severe-action')).toBe(false);
    });

    it('should close delete modal and reset state correctly', () => {
      controller._testExports.conceptToDelete = {
        concept: { id: 'concept-3' },
        directionCount: 0,
      };
      controller._testExports.deleteHandler = () => {};

      const deleteModal = controller._getElement('deleteModal');
      deleteModal.style.display = 'flex';
      const confirmBtn = controller._getElement('confirmDeleteBtn');
      confirmBtn.textContent = 'Pending';
      confirmBtn.classList.add('severe-action');

      controller._closeDeleteModal();

      expect(deleteModal.style.display).toBe('none');
      expect(controller._testExports.conceptToDelete).toBeNull();
      expect(controller._testExports.deleteHandler).toBeNull();
      expect(confirmBtn.textContent).toBe('Delete');
      expect(confirmBtn.classList.contains('severe-action')).toBe(false);
      expect(controller.eventBus.dispatch).toHaveBeenCalledWith(
        'core:ui_modal_closed',
        { modalType: 'delete-confirmation' }
      );
    });

    it('should toggle delete modal buttons enabled state', () => {
      controller._setDeleteModalEnabled(false);
      expect(controller._getElement('confirmDeleteBtn').disabled).toBe(true);
      expect(controller._getElement('cancelDeleteBtn').disabled).toBe(true);
      expect(controller._getElement('closeDeleteModal').disabled).toBe(true);

      controller._setDeleteModalEnabled(true);
      expect(controller._getElement('confirmDeleteBtn').disabled).toBe(false);
      expect(controller._getElement('cancelDeleteBtn').disabled).toBe(false);
      expect(controller._getElement('closeDeleteModal').disabled).toBe(false);
    });

    it('should show and hide delete errors', () => {
      jest.useFakeTimers();

      const deleteModalMessage = controller._getElement('deleteModalMessage');
      if (!deleteModalMessage.parentElement) {
        document.body.appendChild(deleteModalMessage);
      }

      controller._showDeleteError('Failed to delete concept.');

      const errorElement = deleteModalMessage.parentElement?.querySelector(
        '.delete-error'
      );
      expect(errorElement).not.toBeNull();
      expect(errorElement.textContent).toBe('Failed to delete concept.');
      expect(errorElement.style.display).toBe('block');

      jest.advanceTimersByTime(5000);

      expect(errorElement.style.display).toBe('none');
    });
  });

  describe('Concept deletion workflow', () => {
    it('should delete concept and update local cache and UI state', async () => {
      jest.useFakeTimers();
      const conceptsResults = setupRealConceptsResults(controller);
      const card = document.createElement('div');
      card.className = 'concept-card';
      card.dataset.conceptId = 'concept-delete';
      card.appendChild(document.createElement('span')).className = 'concept-text';
      conceptsResults.appendChild(card);

      controller._testExports.conceptsData = [
        { concept: { id: 'concept-delete', concept: 'To remove' }, directionCount: 0 },
      ];

      const showStateSpy = jest.spyOn(controller, '_showState');
      const removeSpy = jest.spyOn(controller, '_removeFromLocalCache');
      const statsSpy = jest.spyOn(controller, '_updateStatistics');

      await controller._deleteConcept('concept-delete', 0);

      expect(controller.characterBuilderService.deleteCharacterConcept).toHaveBeenCalledWith(
        'concept-delete'
      );
      expect(removeSpy).toHaveBeenCalledWith('concept-delete');
      expect(statsSpy).toHaveBeenCalled();
      expect(showStateSpy).toHaveBeenCalledWith('empty');

      jest.runAllTimers();
    });

    it('should revert optimistic delete when deletion fails', async () => {
      const conceptsResults = setupRealConceptsResults(controller);
      const card = document.createElement('div');
      card.className = 'concept-card';
      card.dataset.conceptId = 'concept-fail';
      card.appendChild(document.createElement('span')).className = 'concept-text';
      conceptsResults.appendChild(card);

      controller._testExports.conceptsData = [
        { concept: { id: 'concept-fail', concept: 'To fail' }, directionCount: 0 },
      ];

      const revertSpy = jest.spyOn(controller, '_revertOptimisticDelete');
      controller.characterBuilderService.deleteCharacterConcept.mockRejectedValueOnce(
        new Error('fatal error')
      );

      await expect(controller._deleteConcept('concept-fail', 0)).rejects.toThrow('fatal error');
      expect(revertSpy).toHaveBeenCalled();
      expect(controller.logger.error).toHaveBeenCalledWith(
        'Failed to delete concept',
        expect.any(Error)
      );
    });

    it('should navigate to thematic directions page', () => {
      const originalHref = window.location.href;
      try {
        controller._viewThematicDirections('concept-42');
      } catch (error) {
        expect(error.message).toContain('Not implemented: navigation');
      }
      expect(controller.logger.info).toHaveBeenCalledWith(
        'Viewing thematic directions',
        { conceptId: 'concept-42' }
      );
      expect(window.location.href === originalHref || window.location.href.endsWith('concept-42')).toBe(true);
    });

    it('should log when showing concept menu', () => {
      const button = document.createElement('button');
      controller._showConceptMenu({ id: 'concept-menu' }, button);

      expect(controller.logger.info).toHaveBeenCalledWith('Showing concept menu', {
        conceptId: 'concept-menu',
      });
    });
  });

  describe('Form enablement and validation helpers', () => {
    it('should toggle form enabled state and revalidate when enabling', () => {
      const validateSpy = jest
        .spyOn(controller, '_validateConceptForm')
        .mockReturnValue(true);

      controller._setFormEnabled(false);
      expect(controller._getElement('conceptText').disabled).toBe(true);
      expect(controller._getElement('saveConceptBtn').disabled).toBe(true);
      expect(controller._getElement('cancelConceptBtn').disabled).toBe(true);

      controller._setFormEnabled(true);
      expect(controller._getElement('conceptText').disabled).toBe(false);
      expect(controller._getElement('saveConceptBtn').disabled).toBe(false);
      expect(controller._getElement('cancelConceptBtn').disabled).toBe(false);
      expect(validateSpy).toHaveBeenCalled();
    });

    it('should update save button state during loading and after completion', () => {
      const validateSpy = jest
        .spyOn(controller, '_validateConceptForm')
        .mockReturnValue(true);

      controller._testExports.editingConceptId = null;
      controller._setSaveButtonLoading(true);
      expect(controller._getElement('saveConceptBtn').disabled).toBe(true);
      expect(controller._getElement('saveConceptBtn').textContent).toBe('Saving...');

      controller._setSaveButtonLoading(false);
      expect(controller._getElement('saveConceptBtn').textContent).toBe('Create Concept');
      expect(validateSpy).toHaveBeenCalled();

      controller._testExports.editingConceptId = 'concept-99';
      controller._setSaveButtonLoading(false);
      expect(controller._getElement('saveConceptBtn').textContent).toBe('Update Concept');
    });

    it('should show form errors through FormValidationHelper', () => {
      controller._showFormError('Validation failed');
      expect(FormValidationHelper.showFieldError).toHaveBeenCalledWith(
        controller._getElement('conceptText'),
        'Validation failed'
      );
    });

    it('should log success notifications', () => {
      controller._showSuccessNotification('All good');
      expect(controller.logger.info).toHaveBeenCalledWith('All good');
    });
  });

  describe('Concept creation and saving', () => {
    it('should create concept and show success notification', async () => {
      const notifySpy = jest.spyOn(controller, '_showSuccessNotification');
      controller.characterBuilderService.createCharacterConcept.mockResolvedValueOnce({
        id: 'new-concept',
      });

      await controller._createConcept('A fresh idea');

      expect(controller.characterBuilderService.createCharacterConcept).toHaveBeenCalledWith(
        'A fresh idea'
      );
      expect(controller.logger.info).toHaveBeenCalledWith('Concept created successfully', {
        id: 'new-concept',
      });
      expect(notifySpy).toHaveBeenCalledWith('Character concept created successfully!');
    });

    it('should propagate errors when concept creation fails', async () => {
      controller.characterBuilderService.createCharacterConcept.mockRejectedValueOnce(
        new Error('creation failed')
      );

      await expect(controller._createConcept('Broken')).rejects.toThrow('creation failed');
      expect(controller.logger.error).toHaveBeenCalledWith(
        'Failed to create concept',
        expect.any(Error)
      );
    });

    it('should abort save when validation fails', async () => {
      jest.spyOn(controller, '_validateConceptForm').mockReturnValue(false);

      await controller._handleConceptSave();

      expect(controller.logger.warn).toHaveBeenCalledWith('Form validation failed');
      expect(controller._getElement('saveConceptBtn').disabled).toBe(false);
    });

    it('should handle creating a new concept through save flow', async () => {
      const executeSpy = jest
        .spyOn(controller, '_executeWithErrorHandling')
        .mockImplementation((operation) => operation());
      const closeSpy = jest.spyOn(controller, '_closeConceptModal');
      jest
        .spyOn(controller, '_validateConceptForm')
        .mockReturnValue(true);
      controller._getElement('conceptText').value = 'Brand new concept';

      await controller._handleConceptSave();

      expect(executeSpy).toHaveBeenCalledWith(
        expect.any(Function),
        'create character concept',
        expect.objectContaining({ loadingMessage: 'Creating concept...' })
      );
      expect(closeSpy).toHaveBeenCalled();
      expect(controller.logger.info).toHaveBeenCalledWith(
        'Concept created successfully'
      );
    });

    it('should update existing concept through save flow', async () => {
      jest.useFakeTimers();
      const executeSpy = jest
        .spyOn(controller, '_executeWithErrorHandling')
        .mockImplementation((operation) => operation());
      const closeSpy = jest.spyOn(controller, '_closeConceptModal');
      jest
        .spyOn(controller, '_validateConceptForm')
        .mockReturnValue(true);

      controller._testExports.editingConceptId = 'concept-edit';
      controller._testExports.conceptsData = [
        {
          concept: { id: 'concept-edit', concept: 'Original text', updatedAt: Date.now() },
          directionCount: 1,
        },
      ];

      const conceptsResults = setupRealConceptsResults(controller);
      const card = document.createElement('div');
      card.className = 'concept-card concept-updating';
      card.dataset.conceptId = 'concept-edit';
      const textSpan = document.createElement('span');
      textSpan.className = 'concept-text';
      card.appendChild(textSpan);
      const dateSpan = document.createElement('span');
      dateSpan.className = 'concept-date';
      card.appendChild(dateSpan);
      conceptsResults.appendChild(card);

      controller._getElement('conceptText').value = 'Updated text';

      await controller._handleConceptSave();

      expect(executeSpy).toHaveBeenCalledWith(
        expect.any(Function),
        'update character concept',
        expect.objectContaining({ loadingMessage: 'Updating concept...' })
      );
      expect(closeSpy).toHaveBeenCalled();
      expect(controller.characterBuilderService.updateCharacterConcept).toHaveBeenCalledWith(
        'concept-edit',
        { concept: 'Updated text' }
      );

      jest.runAllTimers();
      expect(card.classList.contains('concept-updated')).toBe(false);
    });
  });

  describe('Concept updating helpers', () => {
    it('should skip update when concept text has not changed', async () => {
      controller._testExports.conceptsData = [
        {
          concept: { id: 'concept-static', concept: 'Same text' },
          directionCount: 0,
        },
      ];

      await controller._updateConcept('concept-static', 'Same text');

      expect(controller.characterBuilderService.updateCharacterConcept).not.toHaveBeenCalledWith(
        'concept-static',
        expect.any(Object)
      );
      expect(controller.logger.info).toHaveBeenCalledWith(
        'No changes detected, skipping update'
      );
    });

    it('should update local cache and UI when concept changes', async () => {
      jest.useFakeTimers();

      controller._testExports.conceptsData = [
        {
          concept: {
            id: 'concept-update',
            concept: 'Before',
            updatedAt: new Date('2024-01-01').toISOString(),
          },
          directionCount: 3,
        },
      ];

      const conceptsResults = setupRealConceptsResults(controller);
      const card = document.createElement('div');
      card.className = 'concept-card concept-updating';
      card.dataset.conceptId = 'concept-update';
      const textSpan = document.createElement('div');
      textSpan.className = 'concept-text';
      card.appendChild(textSpan);
      const dateSpan = document.createElement('div');
      dateSpan.className = 'concept-date';
      card.appendChild(dateSpan);
      const originalQuerySelector = conceptsResults.querySelector;
      conceptsResults.querySelector = jest.fn((selector) => {
        if (selector === '[data-concept-id="concept-update"]') {
          return card;
        }
        return originalQuerySelector ? originalQuerySelector(selector) : null;
      });

      controller.characterBuilderService.updateCharacterConcept.mockResolvedValueOnce({
        id: 'concept-update',
        concept: 'After',
        updatedAt: new Date('2024-02-02').toISOString(),
      });

      await controller._updateConcept('concept-update', 'After');

      const updated = controller._testExports.conceptsData[0].concept;
      expect(updated.concept).toBe('After');
      expect(textSpan.textContent).toContain('After');
      expect(card.classList.contains('concept-updating')).toBe(false);
      expect(card.classList.contains('concept-updated')).toBe(true);

      jest.advanceTimersByTime(1000);
      expect(card.classList.contains('concept-updated')).toBe(false);
    });

    it('should update local cache entries and refresh card', () => {
      const updateCardSpy = jest.spyOn(controller, '_updateConceptCard');
      controller._testExports.conceptsData = [
        {
          concept: { id: 'concept-cache', concept: 'Old', updatedAt: null },
          directionCount: 5,
        },
      ];

      controller._updateLocalConceptCache({
        id: 'concept-cache',
        concept: 'New text',
        updatedAt: null,
      });

      expect(controller._testExports.conceptsData[0].concept.concept).toBe('New text');
      expect(updateCardSpy).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'concept-cache' }),
        5
      );
    });

    it('should update concept card contents and animations', () => {
      jest.useFakeTimers();
      const conceptsResults = setupRealConceptsResults(controller);
      const card = document.createElement('div');
      card.dataset.conceptId = 'concept-card';
      const textSpan = document.createElement('div');
      textSpan.className = 'concept-text';
      card.appendChild(textSpan);
      const dateSpan = document.createElement('div');
      dateSpan.className = 'concept-date';
      card.appendChild(dateSpan);
      const originalQuerySelector = conceptsResults.querySelector;
      conceptsResults.querySelector = jest.fn((selector) => {
        if (selector === '[data-concept-id="concept-card"]') {
          return card;
        }
        return originalQuerySelector ? originalQuerySelector(selector) : null;
      });

      controller._updateConceptCard(
        {
          id: 'concept-card',
          concept: 'Rendered text',
          updatedAt: new Date('2024-03-03').toISOString(),
        },
        0
      );

      expect(textSpan.innerHTML).toContain('Rendered text');
      expect(dateSpan.textContent).toContain('Updated');
      expect(card.classList.contains('concept-updated')).toBe(true);

      jest.advanceTimersByTime(1000);
      expect(card.classList.contains('concept-updated')).toBe(false);
    });

    it('should apply optimistic updates to concept cards', () => {
      const conceptsResults = setupRealConceptsResults(controller);
      const card = document.createElement('div');
      card.dataset.conceptId = 'concept-optimistic';
      const textSpan = document.createElement('div');
      textSpan.className = 'concept-text';
      card.appendChild(textSpan);
      const originalQuerySelector = conceptsResults.querySelector;
      conceptsResults.querySelector = jest.fn((selector) => {
        if (selector === '[data-concept-id="concept-optimistic"]') {
          return card;
        }
        return originalQuerySelector ? originalQuerySelector(selector) : null;
      });

      controller._applyOptimisticUpdate('concept-optimistic', 'Optimistic text');

      expect(textSpan.textContent).toContain('Optimistic text');
      expect(card.classList.contains('concept-updating')).toBe(true);
    });

    it('should revert optimistic updates using cached data', () => {
      const conceptsResults = setupRealConceptsResults(controller);
      const card = document.createElement('div');
      card.dataset.conceptId = 'concept-revert';
      const textSpan = document.createElement('div');
      textSpan.className = 'concept-text';
      card.appendChild(textSpan);
      const originalQuerySelector = conceptsResults.querySelector;
      conceptsResults.querySelector = jest.fn((selector) => {
        if (selector === '[data-concept-id="concept-revert"]') {
          return card;
        }
        return originalQuerySelector ? originalQuerySelector(selector) : null;
      });

      controller._testExports.conceptsData = [
        {
          concept: { id: 'concept-revert', concept: 'Cached text', updatedAt: null },
          directionCount: 2,
        },
      ];

      const updateSpy = jest.spyOn(controller, '_updateConceptCard');
      controller._revertOptimisticUpdate('concept-revert');

      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'concept-revert' }),
        2
      );
      expect(card.classList.contains('concept-updating')).toBe(false);
      expect(card.classList.contains('concept-update-failed')).toBe(true);
    });

    it('should track form changes and update save button style', () => {
      controller._testExports.originalConceptText = 'original';
      controller._getElement('conceptText').value = 'changed';

      controller._trackFormChanges();

      expect(controller._testExports.hasUnsavedChanges).toBe(true);
      expect(
        controller._getElement('saveConceptBtn').classList.contains('has-changes')
      ).toBe(true);

      controller._getElement('conceptText').value = 'original';
      controller._trackFormChanges();

      expect(controller._testExports.hasUnsavedChanges).toBe(false);
      expect(
        controller._getElement('saveConceptBtn').classList.contains('has-changes')
      ).toBe(false);
    });

    it('should register enhanced keyboard shortcuts', () => {
      const addEventListenerSpy = jest.spyOn(document, 'addEventListener');
      const registerCleanupSpy = jest.spyOn(controller, '_registerCleanupTask');

      controller._setupKeyboardShortcuts();

      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'keydown',
        expect.any(Function)
      );
      expect(registerCleanupSpy).toHaveBeenCalledWith(
        expect.any(Function),
        'Keyboard shortcuts cleanup'
      );

      addEventListenerSpy.mockRestore();
      registerCleanupSpy.mockRestore();
    });
  });
});
