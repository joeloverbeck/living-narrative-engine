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

describe('CharacterConceptsManagerController event handlers', () => {
  const testBase = new CharacterConceptsManagerTestBase();
  let controller;

  beforeEach(async () => {
    await testBase.setup();
    controller = testBase.createController();
    controller._cacheElements();
    controller._setupEventListeners();
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
    await testBase.cleanup();
  });

  it('clears the search input when Escape is pressed', () => {
    const clearSearchSpy = jest
      .spyOn(controller, '_clearSearch')
      .mockImplementation(() => {});

    controller._testExports.searchFilter = 'mystic';
    const searchInput = document.getElementById('concept-search');
    const escapeEvent = new window.KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true,
    });

    searchInput.dispatchEvent(escapeEvent);

    expect(clearSearchSpy).toHaveBeenCalledTimes(1);
  });

  it('focuses the first concept card when Enter is pressed with an active filter', () => {
    const focusSpy = jest.fn();
    const conceptsResults = document.getElementById('concepts-results');
    conceptsResults.querySelector.mockReturnValue({ focus: focusSpy });

    controller._testExports.searchFilter = 'adventurer';
    const searchInput = document.getElementById('concept-search');
    const enterEvent = new window.KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      cancelable: true,
    });

    searchInput.dispatchEvent(enterEvent);

    expect(focusSpy).toHaveBeenCalledTimes(1);
  });

  it('prevents default submit behaviour and saves concept from the form', () => {
    const preventDefaultSpy = jest.spyOn(controller, '_preventDefault');
    const handleSaveSpy = jest
      .spyOn(controller, '_handleConceptSave')
      .mockResolvedValue();

    const conceptForm = document.getElementById('concept-form');
    const submitEvent = new window.Event('submit', {
      bubbles: true,
      cancelable: true,
    });

    conceptForm.dispatchEvent(submitEvent);

    expect(preventDefaultSpy).toHaveBeenCalledTimes(1);
    expect(handleSaveSpy).toHaveBeenCalledTimes(1);
  });

  it('triggers concept save when save button is clicked', () => {
    const handleSaveSpy = jest
      .spyOn(controller, '_handleConceptSave')
      .mockResolvedValue();

    const saveButton = document.getElementById('save-concept-btn');
    const clickEvent = new window.Event('click', { bubbles: true });

    saveButton.dispatchEvent(clickEvent);

    expect(handleSaveSpy).toHaveBeenCalledTimes(1);
  });

  it('closes the concept modal from cancel, close buttons and backdrop clicks', () => {
    const closeModalSpy = jest
      .spyOn(controller, '_closeConceptModal')
      .mockImplementation(() => {});

    const cancelButton = document.getElementById('cancel-concept-btn');
    const closeButton = document.getElementById('close-concept-modal');
    const conceptModal = document.getElementById('concept-modal');

    const clickEvent = new window.Event('click', { bubbles: true });
    cancelButton.dispatchEvent(clickEvent);
    closeButton.dispatchEvent(clickEvent);
    conceptModal.dispatchEvent(clickEvent);

    expect(closeModalSpy).toHaveBeenCalledTimes(3);
  });

  it('invokes delete actions for confirmation controls', () => {
    const confirmDeleteSpy = jest.spyOn(controller, '_confirmDelete');
    const closeDeleteSpy = jest
      .spyOn(controller, '_closeDeleteModal')
      .mockImplementation(() => {});

    const confirmButton = document.getElementById('confirm-delete-btn');
    const cancelButton = document.getElementById('cancel-delete-btn');
    const closeButton = document.getElementById('close-delete-modal');
    const deleteModal = document.getElementById('delete-confirmation-modal');

    const clickEvent = new window.Event('click', { bubbles: true });
    confirmButton.dispatchEvent(clickEvent);
    cancelButton.dispatchEvent(clickEvent);
    closeButton.dispatchEvent(clickEvent);
    deleteModal.dispatchEvent(clickEvent);

    expect(confirmDeleteSpy).toHaveBeenCalledTimes(1);
    expect(closeDeleteSpy).toHaveBeenCalledTimes(3);
  });

  it('calls the delete handler when confirmDelete is executed directly', () => {
    const deleteHandler = jest.fn();
    controller._testExports.deleteHandler = deleteHandler;

    controller._confirmDelete();

    expect(deleteHandler).toHaveBeenCalledTimes(1);
  });

  it('validates and updates character counts on text input events', () => {
    const validateSpy = jest
      .spyOn(controller, '_validateConceptForm')
      .mockImplementation(() => {});
    const updateSpy = jest.spyOn(controller, '_updateCharCount');

    const conceptText = document.getElementById('concept-text');
    const inputEvent = new window.Event('input', { bubbles: true });

    conceptText.dispatchEvent(inputEvent);

    expect(validateSpy).toHaveBeenCalledTimes(1);
    expect(updateSpy).toHaveBeenCalledTimes(1);
  });

  it('supports keyboard shortcut submission when control+enter is pressed', () => {
    const handleSaveSpy = jest
      .spyOn(controller, '_handleConceptSave')
      .mockResolvedValue();

    const conceptText = document.getElementById('concept-text');
    const keydownEvent = new window.KeyboardEvent('keydown', {
      key: 'Enter',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });

    conceptText.dispatchEvent(keydownEvent);

    expect(handleSaveSpy).toHaveBeenCalledTimes(1);
  });

  it('updates the live character counter when requested', () => {
    const conceptText = document.getElementById('concept-text');
    const charCount = document.getElementById('char-count');

    controller._updateCharCount();

    expect(FormValidationHelper.updateCharacterCount).toHaveBeenCalledWith(
      conceptText,
      charCount,
      6000,
    );
  });
});
