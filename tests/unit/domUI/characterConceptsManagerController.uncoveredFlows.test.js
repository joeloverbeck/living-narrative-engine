import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { CharacterConceptsManagerTestBase } from './characterConceptsManagerController.testUtils.enhanced.js';

describe('CharacterConceptsManagerController uncovered flows', () => {
  const testBase = new CharacterConceptsManagerTestBase();
  let controller;

  beforeEach(async () => {
    await testBase.setup();
    controller = testBase.createController();
    controller._cacheElements();
    testBase.populateControllerElements(controller);
    jest.useFakeTimers();
  });

  afterEach(async () => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
    await testBase.cleanup();
  });

  it('formats full dates using locale strings', () => {
    const formatted = controller._formatFullDate('2024-01-01T00:00:00Z');

    expect(typeof formatted).toBe('string');
    expect(formatted.length).toBeGreaterThan(0);
  });

  it('refreshes the concepts display while preserving scroll position', async () => {
    const resultsEl = controller._getElement('conceptsResults');
    resultsEl.scrollTop = 87;
    const loadSpy = jest
      .spyOn(controller, '_loadConceptsData')
      .mockResolvedValue();

    await controller._refreshConceptsDisplay(true);

    expect(loadSpy).toHaveBeenCalled();
    expect(resultsEl.scrollTop).toBe(87);
  });

  it('renders the search-empty state and clears filters when triggered', () => {
    const displaySpy = jest
      .spyOn(controller, '_displayConcepts')
      .mockImplementation(() => {});
    const showStateSpy = jest
      .spyOn(controller, '_showState')
      .mockImplementation(() => {});
    const currentStateSpy = jest
      .spyOn(controller, 'currentState', 'get')
      .mockReturnValue('results');

    controller._testExports.searchFilter = 'heroic';
    controller._testExports.conceptsData = [
      { concept: { id: 'c-1', concept: 'Heroic tale' }, directionCount: 0 },
    ];

    controller._showEmptyState();

    const clearBtn = document.getElementById('clear-search-btn');
    expect(clearBtn).toBeTruthy();
    clearBtn.click();

    expect(controller._testExports.searchFilter).toBe('');
    expect(displaySpy).toHaveBeenCalledWith(
      controller._testExports.conceptsData
    );
    expect(showStateSpy).toHaveBeenCalledWith('empty');

    currentStateSpy.mockRestore();
  });

  it('queues the empty state when UI state manager is not ready', () => {
    const showStateSpy = jest
      .spyOn(controller, '_showState')
      .mockImplementation(() => {});
    jest.spyOn(controller, 'currentState', 'get').mockReturnValue(null);

    controller._testExports.searchFilter = '';

    controller._showEmptyState();

    const createBtn = document.getElementById('create-first-btn');
    expect(createBtn).toBeTruthy();
    createBtn.click();

    expect(showStateSpy).not.toHaveBeenCalled();
    expect(controller._testExports.pendingUIState).toBe('empty');
  });

  it('views concept details by delegating to the edit modal', () => {
    const showEditSpy = jest
      .spyOn(controller, '_showEditModal')
      .mockResolvedValue();

    controller._viewConceptDetails({ id: 'concept-77' });

    expect(controller.logger.info).toHaveBeenCalledWith(
      'Viewing concept details',
      {
        id: 'concept-77',
      }
    );
    expect(showEditSpy).toHaveBeenCalledWith('concept-77');
  });

  it('shows the edit modal with pre-populated data and focus handling', async () => {
    const conceptId = 'concept-101';
    controller._testExports.conceptsData = [
      {
        concept: { id: conceptId, concept: 'An existing concept' },
        directionCount: 3,
      },
    ];

    const textArea = controller._getElement('conceptText');
    textArea.setSelectionRange = jest.fn();

    const animateSpy = jest
      .spyOn(controller, '_animateModalEntrance')
      .mockImplementation(() => {});
    const validationSpy = jest
      .spyOn(controller, '_setupConceptFormValidation')
      .mockImplementation(() => {});
    jest.spyOn(controller, '_validateConceptForm').mockReturnValue(true);

    await controller._showEditModal(conceptId);
    jest.runAllTimers();

    expect(animateSpy).toHaveBeenCalledWith(
      controller._getElement('conceptModal')
    );
    expect(validationSpy).toHaveBeenCalled();
    expect(textArea.addEventListener).toHaveBeenCalledWith(
      'input',
      expect.any(Function),
      { once: false }
    );
    expect(textArea.focus).toHaveBeenCalled();
    expect(textArea.setSelectionRange).toHaveBeenCalledWith(
      textArea.value.length,
      textArea.value.length
    );
    expect(controller.eventBus.dispatch).toHaveBeenCalledWith(
      'core:ui_modal_opened',
      {
        modalType: 'edit-concept',
        conceptId,
      }
    );
  });

  it('handles edit modal errors when concept data is missing', async () => {
    controller._testExports.conceptsData = [];
    const errorSpy = jest
      .spyOn(controller, '_showError')
      .mockImplementation(() => {});

    await controller._showEditModal('missing');

    expect(controller.logger.error).toHaveBeenCalledWith(
      'Failed to show edit modal',
      expect.any(Error)
    );
    expect(errorSpy).toHaveBeenCalledWith(
      'Failed to load concept for editing. Please try again.'
    );
  });

  it('logs errors when concept saving fails', async () => {
    jest.spyOn(controller, '_validateConceptForm').mockReturnValue(true);
    jest.spyOn(controller, '_setFormEnabled').mockImplementation(() => {});
    jest
      .spyOn(controller, '_setSaveButtonLoading')
      .mockImplementation(() => {});
    controller._testExports.editingConceptId = 'concept-5';
    controller._getElement('conceptText').value = 'Updated concept idea';

    jest
      .spyOn(controller, '_executeWithErrorHandling')
      .mockRejectedValueOnce(new Error('save failed'));

    await controller._handleConceptSave();

    expect(controller.logger.error).toHaveBeenCalledWith(
      'Concept save operation failed',
      expect.any(Error)
    );
    expect(controller._setFormEnabled).toHaveBeenCalledWith(true);
    expect(controller._setSaveButtonLoading).toHaveBeenCalledWith(false);
  });

  it('reverts optimistic updates when updating a concept fails', async () => {
    controller._testExports.conceptsData = [
      {
        concept: { id: 'concept-8', concept: 'Original' },
        directionCount: 2,
      },
    ];

    jest
      .spyOn(controller, '_applyOptimisticUpdate')
      .mockImplementation(() => {});
    const revertSpy = jest
      .spyOn(controller, '_revertOptimisticUpdate')
      .mockImplementation(() => {});

    controller.characterBuilderService.updateCharacterConcept = jest
      .fn()
      .mockRejectedValue(new Error('update failed'));

    await expect(
      controller._updateConcept('concept-8', 'Updated text value')
    ).rejects.toThrow('update failed');

    expect(revertSpy).toHaveBeenCalledWith('concept-8');
    expect(controller.logger.error).toHaveBeenCalledWith(
      'Failed to update concept',
      expect.any(Error)
    );
  });

  it('registers enhanced keyboard shortcuts', () => {
    const addListenerSpy = jest.spyOn(document, 'addEventListener');
    const handlerSpy = jest
      .spyOn(controller, '_handleEnhancedKeyboardShortcut')
      .mockImplementation(() => {});

    controller._setupKeyboardShortcuts();

    expect(addListenerSpy).toHaveBeenCalledWith(
      'keydown',
      expect.any(Function)
    );
    const handler = addListenerSpy.mock.calls[0][1];
    const event = testBase.createKeyboardEvent('f', { ctrlKey: true });
    handler(event);

    expect(handlerSpy).toHaveBeenCalledWith(event);

    addListenerSpy.mockRestore();
  });
});
