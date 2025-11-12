/**
 * @file Comprehensive integration tests for ThematicDirectionsManagerController
 * @description Exercises the full controller workflow with real collaborators
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
import { PreviousItemsDropdown } from '../../../../src/shared/characterBuilder/previousItemsDropdown.js';
import { InPlaceEditor } from '../../../../src/shared/characterBuilder/inPlaceEditor.js';

const createDirection = ({
  id,
  title,
  conceptId,
  description = `${title} description`,
  coreTension = `${title} core tension`,
  uniqueTwist = `${title} unique twist`,
  narrativePotential = `${title} narrative potential`,
}) => ({
  direction: {
    id,
    title,
    description,
    coreTension,
    uniqueTwist,
    narrativePotential,
    conceptId,
  },
  concept:
    conceptId === null
      ? null
      : {
          id: conceptId,
          concept: `${title} concept details`,
          status: 'completed',
          createdAt: new Date('2024-01-01T12:00:00Z').toISOString(),
          updatedAt: new Date('2024-01-01T12:00:00Z').toISOString(),
          thematicDirections: [id],
        },
});

const flushAsync = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

describe('ThematicDirectionsManagerController – Full Integration Suite', () => {
  let testBase;
  let controller;
  let alertSpy;
  let confirmSpy;

  const buildDOM = () => {
    document.body.innerHTML = `
      <div class="controller-root">
        <div class="cb-input-panel concept-selection-panel">
          <label for="concept-selector">Choose Concept:</label>
          <select id="concept-selector" class="cb-input"></select>
          <div id="concept-display-container" style="display: none;">
            <div id="concept-display-content"></div>
          </div>
        </div>
        <div class="cb-main-content">
          <div id="empty-state" style="display: none;">
            <p class="empty-message">Default empty message</p>
          </div>
          <div id="loading-state" style="display: none;"></div>
          <div id="error-state" style="display: none;">
            <div id="error-message-text"></div>
          </div>
          <div id="results-state" style="display: none;">
            <input id="direction-filter" type="text" />
            <div id="directions-results"></div>
            <div id="total-directions"></div>
            <div id="orphaned-count"></div>
          </div>
        </div>
        <div class="cb-actions">
          <button id="refresh-btn">Refresh</button>
          <button id="cleanup-orphans-btn">Cleanup Orphans</button>
          <button id="back-to-menu-btn">Back</button>
          <button id="retry-btn" style="display:none;">Retry</button>
        </div>
        <div id="confirmation-modal" style="display: none;">
          <div class="modal-content">
            <button id="close-modal-btn" type="button">×</button>
            <h2 id="modal-title"></h2>
            <p id="modal-message"></p>
            <button id="modal-confirm-btn" type="button">Confirm</button>
            <button id="modal-cancel-btn" type="button">Cancel</button>
          </div>
        </div>
        <div id="success-notification" class="notification" style="display: none;"></div>
      </div>
    `;
  };

  beforeEach(async () => {
    jest.useFakeTimers();
    testBase = new BaseCharacterBuilderControllerTestBase();
    await testBase.setup();
    buildDOM();

    alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {});
    confirmSpy = jest.spyOn(window, 'confirm').mockImplementation(() => true);

    controller = new ThematicDirectionsManagerController(testBase.mocks);
  });

  afterEach(async () => {
    try {
      if (controller && typeof controller.destroy === 'function') {
        await controller.destroy();
      }
    } catch (err) {
      // ignore destroy issues in cleanup paths under test
    }

    await testBase.cleanup();
    if (typeof setTimeout === 'function' && setTimeout._isMockFunction) {
      jest.runOnlyPendingTimers();
    }
    jest.useRealTimers();
    jest.restoreAllMocks();
    localStorage.clear();
    document.body.innerHTML = '';
  });

  const arrangeStandardData = () => {
    const data = [
      createDirection({ id: 'dir-1', title: 'Heroic Journey', conceptId: 'concept-1' }),
      createDirection({ id: 'dir-2', title: 'Dark Path', conceptId: null }),
    ];
    testBase.mocks.characterBuilderService.getAllThematicDirectionsWithConcepts.mockResolvedValue(data);
    testBase.mocks.characterBuilderService.getCharacterConcept.mockImplementation(async (conceptId) => {
      return data.find((item) => item.concept?.id === conceptId)?.concept || null;
    });
    return data;
  };

  it('loads directions, supports filtering, concept selection, keyboard shortcuts, and state persistence', async () => {
    arrangeStandardData();

    await controller.initialize();

    expect(document.querySelectorAll('.direction-card-editable').length).toBe(2);
    expect(document.getElementById('total-directions').textContent).toBe('2');

    const filterInput = document.getElementById('direction-filter');
    filterInput.value = 'dark';
    filterInput.dispatchEvent(new Event('input', { bubbles: true }));
    await flushAsync();

    expect(document.querySelectorAll('.direction-card-editable').length).toBe(1);
    expect(testBase.mocks.eventBus.dispatch).toHaveBeenCalledWith(
      'core:analytics_track',
      expect.objectContaining({ event: 'thematic_dropdown_interaction' })
    );

    // Concept selection shows concept details
    const select = document.getElementById('concept-selector');
    select.value = 'concept-1';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    await flushAsync();

    expect(
      testBase.mocks.characterBuilderService.getCharacterConcept
    ).toHaveBeenCalledWith('concept-1');
    expect(document.getElementById('concept-display-container').style.display).toBe('block');

    // Orphaned filter hides display
    select.value = 'orphaned';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    await flushAsync();
    expect(document.getElementById('concept-display-container').style.display).toBe('none');

    // Keyboard shortcut clears filter and persists state
    filterInput.value = 'shadow';
    filterInput.dispatchEvent(new Event('input', { bubbles: true }));
    filterInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await flushAsync();
    expect(filterInput.value).toBe('');

    const storedState = JSON.parse(
      localStorage.getItem('thematic-directions-dropdown-state')
    );
    expect(storedState.lastSelection).toBe('orphaned');
    expect(storedState.lastFilter).toBe('');
  });

  it('validates inline edits, reports failures, and persists successful updates', async () => {
    arrangeStandardData();

    await controller.initialize();

    const titleField = document.querySelector(
      '.direction-card-editable [data-field="title"][data-direction-id="dir-1"]'
    );
    titleField.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    let editor = titleField.parentElement.querySelector('.in-place-editor');
    const input = editor.querySelector('.in-place-editor-input');
    const saveBtn = editor.querySelector('.in-place-save-btn');

    input.value = 'abc';
    saveBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flushAsync();
    expect(
      testBase.mocks.characterBuilderService.updateThematicDirection
    ).not.toHaveBeenCalled();

    input.value = 'Heroic Saga';
    testBase.mocks.characterBuilderService.updateThematicDirection.mockRejectedValueOnce(
      new Error('save failed')
    );
    saveBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flushAsync();
    editor = titleField.parentElement.querySelector('.in-place-editor');
    expect(editor.querySelector('.in-place-editor-error').textContent).toContain(
      'Failed to save changes'
    );

    testBase.mocks.characterBuilderService.updateThematicDirection.mockResolvedValue({
      id: 'dir-1',
    });
    saveBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flushAsync();

    expect(
      testBase.mocks.characterBuilderService.updateThematicDirection
    ).toHaveBeenCalledWith('dir-1', { title: 'Heroic Saga' });
    expect(titleField.textContent).toBe('Heroic Saga');
  });

  it('handles deletion workflow, notifications, and failures gracefully', async () => {
    arrangeStandardData();
    await controller.initialize();

    const deleteBtn = document.querySelector('.direction-action-btn.delete-btn');
    deleteBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    jest.runOnlyPendingTimers();

    const confirmBtn = document.getElementById('modal-confirm-btn');
    confirmBtn.click();
    await flushAsync();

    expect(
      testBase.mocks.characterBuilderService.deleteThematicDirection
    ).toHaveBeenCalledWith('dir-1');
    expect(testBase.mocks.eventBus.dispatch).toHaveBeenCalledWith(
      'core:direction_deleted',
      expect.objectContaining({ directionId: 'dir-1' })
    );

    const notification = document.getElementById('success-notification');
    expect(notification.classList.contains('notification-visible')).toBe(true);
    jest.runOnlyPendingTimers();
    expect(notification.classList.contains('notification-visible')).toBe(false);

    // Simulate failure path
    arrangeStandardData();
    await controller.refreshDropdown();
    testBase.mocks.characterBuilderService.deleteThematicDirection.mockRejectedValueOnce(
      new Error('delete failed')
    );
    document.querySelector('.direction-action-btn.delete-btn').click();
    jest.runOnlyPendingTimers();
    document.getElementById('modal-confirm-btn').click();
    await flushAsync();
    expect(alertSpy).toHaveBeenCalledWith(
      'Failed to delete direction. Please try again.'
    );
  });

  it('cleans up orphaned directions and shows alert when none exist', async () => {
    arrangeStandardData();
    await controller.initialize();

    const alertModalSpy = jest.spyOn(controller, '_showConfirmationModal');

    // First remove orphaned direction
    document.getElementById('cleanup-orphans-btn').click();
    jest.runOnlyPendingTimers();
    document.getElementById('modal-confirm-btn').click();
    await flushAsync();

    expect(
      testBase.mocks.characterBuilderService.deleteThematicDirection
    ).toHaveBeenLastCalledWith('dir-2');
    expect(testBase.mocks.eventBus.dispatch).toHaveBeenCalledWith(
      'core:orphans_cleaned',
      expect.objectContaining({ deletedCount: 1 })
    );

    // No orphaned directions -> alert modal path
    alertModalSpy.mockClear();
    testBase.mocks.characterBuilderService.getAllThematicDirectionsWithConcepts.mockResolvedValue([
      createDirection({ id: 'dir-3', title: 'Unified', conceptId: 'concept-3' }),
    ]);
    await controller.refreshDropdown();
    const cleanupBtn = document.getElementById('cleanup-orphans-btn');
    cleanupBtn.disabled = false; // simulate manual trigger despite UI disablement
    cleanupBtn.click();
    expect(alertModalSpy).toHaveBeenCalledTimes(1);
    expect(alertModalSpy.mock.calls[0][0]).toEqual(
      expect.objectContaining({ type: 'alert', confirmText: 'OK' })
    );
  });

  it('refreshes dropdown preserving state and falls back on dropdown errors', async () => {
    arrangeStandardData();
    await controller.initialize();

    const select = document.getElementById('concept-selector');
    select.value = 'concept-1';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    await flushAsync();

    testBase.mocks.characterBuilderService.getAllThematicDirectionsWithConcepts.mockResolvedValue([
      createDirection({ id: 'dir-4', title: 'Fresh Start', conceptId: 'concept-4' }),
    ]);
    await controller.refreshDropdown();
    expect(select.value).toBe('');
    expect(testBase.mocks.eventBus.dispatch).toHaveBeenCalledWith(
      'core:analytics_track',
      expect.objectContaining({
        properties: expect.objectContaining({ action: 'refresh_reset' }),
      })
    );

    const clearSpy = jest
      .spyOn(PreviousItemsDropdown.prototype, 'clear')
      .mockImplementation(() => {
        throw new Error('clear failed');
      });
    testBase.mocks.characterBuilderService.getAllThematicDirectionsWithConcepts.mockRejectedValueOnce(
      new Error('load failed')
    );
    await controller.refreshDropdown();
    expect(select.classList.contains('native-fallback')).toBe(true);
    clearSpy.mockRestore();
  });

  it('manages modal lifecycle, keyboard handlers, and performs thorough cleanup on destroy', async () => {
    arrangeStandardData();
    await controller.initialize();

    controller._handleModalConfirm();
    expect(testBase.mocks.logger.warn).toHaveBeenCalledWith(
      'No pending modal action to confirm'
    );

    const cancelCallback = jest.fn();
    controller._showConfirmationModal({
      title: 'Confirm',
      message: 'Confirm message',
      onConfirm: jest.fn(),
      onCancel: cancelCallback,
    });
    jest.runOnlyPendingTimers();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(cancelCallback).toHaveBeenCalled();

    controller._showEmptyWithMessage('Nothing here');
    expect(
      document.querySelector('#empty-state .empty-message').textContent
    ).toBe('Nothing here');

    controller._showSuccess('Saved!', 10);
    expect(
      document.getElementById('success-notification').classList.contains(
        'notification-visible'
      )
    ).toBe(true);
    jest.runOnlyPendingTimers();

    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    await controller.destroy();
    process.env.NODE_ENV = originalEnv;
  });

  it('preserves dropdown selection and handles keyboard shortcuts on concept selector', async () => {
    arrangeStandardData();
    await controller.initialize();

    const select = document.getElementById('concept-selector');
    const filterInput = document.getElementById('direction-filter');

    select.value = 'concept-1';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    await flushAsync();

    const refreshedData = [
      createDirection({ id: 'dir-1', title: 'Heroic Journey', conceptId: 'concept-1' }),
      createDirection({ id: 'dir-3', title: 'Alliance', conceptId: 'concept-3' }),
    ];
    testBase.mocks.characterBuilderService.getAllThematicDirectionsWithConcepts.mockResolvedValueOnce(
      refreshedData
    );

    await controller.refreshDropdown();

    const optionValues = Array.from(select.options).map((option) => option.value);
    expect(optionValues).toContain('concept-1');
    const actionsAfterRefresh = testBase.mocks.eventBus.dispatch.mock.calls
      .map(([, payload]) => payload?.properties?.action)
      .filter(Boolean);
    expect(actionsAfterRefresh).not.toContain('refresh_reset');

    // Escape should clear selection and dispatch keyboard analytics
    testBase.mocks.eventBus.dispatch.mockClear();
    select.value = 'concept-1';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    await flushAsync();

    select.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(select.value).toBe('');
    const keyboardActionsAfterEscape = testBase.mocks.eventBus.dispatch.mock.calls
      .map(([, payload]) => payload?.properties?.value?.action)
      .filter(Boolean);
    expect(keyboardActionsAfterEscape).toContain('clear');

    // Ctrl+/ should focus the filter and track interaction
    filterInput.value = '';
    filterInput.blur();
    select.focus();
    select.dispatchEvent(
      new KeyboardEvent('keydown', { key: '/', ctrlKey: true, bubbles: true })
    );
    expect(document.activeElement).toBe(filterInput);
    const keyboardActionsAfterFocus = testBase.mocks.eventBus.dispatch.mock.calls
      .map(([, payload]) => payload?.properties?.value?.action)
      .filter(Boolean);
    expect(keyboardActionsAfterFocus).toContain('focus_search');

    // Enter should confirm the current selection
    testBase.mocks.eventBus.dispatch.mockClear();
    select.value = 'concept-1';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    await flushAsync();

    select.focus();
    select.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    const confirmSelectionTracked = testBase.mocks.eventBus.dispatch.mock.calls.some(
      ([, payload]) =>
        payload?.properties?.action === 'keyboard' &&
        payload?.properties?.value?.action === 'confirm_selection'
    );
    expect(confirmSelectionTracked).toBe(true);
  });

  it('retries loading, navigates back, closes modals, and detects leaks during post-destroy', async () => {
    arrangeStandardData();
    await controller.initialize();

    const serviceMock =
      testBase.mocks.characterBuilderService.getAllThematicDirectionsWithConcepts;
    serviceMock.mockClear();
    serviceMock.mockResolvedValueOnce([
      createDirection({ id: 'dir-5', title: 'Renewed', conceptId: 'concept-5' }),
    ]);

    document.getElementById('retry-btn').click();
    await flushAsync();
    expect(serviceMock).toHaveBeenCalled();

    const originalHref = window.location.href;
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    document.getElementById('back-to-menu-btn').click();
    const navigationErrorLogged = consoleErrorSpy.mock.calls.some(([message]) => {
      if (typeof message === 'string') {
        return message.includes('Not implemented: navigation');
      }
      if (message && typeof message === 'object' && 'message' in message) {
        return String(message.message).includes('Not implemented: navigation');
      }
      return false;
    });
    expect(navigationErrorLogged).toBe(true);
    consoleErrorSpy.mockRestore();
    window.location.href = originalHref;

    const cancelViaButton = jest.fn();
    controller._showConfirmationModal({
      title: 'Confirm',
      message: 'Confirm message',
      onConfirm: jest.fn(),
      onCancel: cancelViaButton,
    });
    jest.runOnlyPendingTimers();
    document.getElementById('modal-cancel-btn').click();
    expect(cancelViaButton).toHaveBeenCalledTimes(1);

    const cancelViaClose = jest.fn();
    controller._showConfirmationModal({
      title: 'Confirm',
      message: 'Confirm message',
      onConfirm: jest.fn(),
      onCancel: cancelViaClose,
    });
    jest.runOnlyPendingTimers();
    document.getElementById('close-modal-btn').click();
    expect(cancelViaClose).toHaveBeenCalledTimes(1);

    const cancelViaBackdrop = jest.fn();
    controller._showConfirmationModal({
      title: 'Confirm',
      message: 'Confirm message',
      onConfirm: jest.fn(),
      onCancel: cancelViaBackdrop,
    });
    jest.runOnlyPendingTimers();
    const modal = document.getElementById('confirmation-modal');
    modal.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(cancelViaBackdrop).toHaveBeenCalledTimes(1);

    const destroySpy = jest
      .spyOn(PreviousItemsDropdown.prototype, 'destroy')
      .mockImplementationOnce(() => {
        throw new Error('destroy failed');
      });

    const titleField = document.querySelector(
      '.direction-card-editable [data-field="title"][data-direction-id="dir-1"]'
    );
    titleField.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flushAsync();

    controller._showSuccess('Leaky notification', 5000);

    const leakCancelSpy = jest.fn();
    controller._showConfirmationModal({
      title: 'Leak Check',
      message: 'Inspect leaks',
      onConfirm: () => {},
      onCancel: leakCancelSpy,
    });
    jest.runOnlyPendingTimers();

    const orphanEditor = document.createElement('div');
    orphanEditor.className = 'in-place-editor';
    document.body.appendChild(orphanEditor);

    const originalEnv = process.env.NODE_ENV;
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    process.env.NODE_ENV = 'development';
    controller._postDestroy();
    expect(warnSpy).toHaveBeenCalled();
    expect(testBase.mocks.logger.warn).toHaveBeenCalledWith(
      'ThematicDirectionsManagerController: Error destroying concept dropdown',
      expect.any(Error)
    );

    warnSpy.mockClear();
    process.env.NODE_ENV = 'production';
    controller._postDestroy();
    expect(
      testBase.mocks.logger.info.mock.calls.some(
        ([message]) =>
          message === 'Triggering automatic memory cleanup due to detected leaks'
      )
    ).toBe(true);

    process.env.NODE_ENV = originalEnv;
    warnSpy.mockRestore();
    destroySpy.mockRestore();
    orphanEditor.remove();
  });

  it('warns when dropdown DOM is missing and still loads data without enhancements', async () => {
    arrangeStandardData();

    const conceptSelector = document.getElementById('concept-selector');
    conceptSelector.remove();

    await controller.initialize();

    expect(testBase.mocks.logger.warn).toHaveBeenCalledWith(
      'conceptSelector element not found, dropdown disabled'
    );

    expect(
      testBase.mocks.logger.warn.mock.calls.some(([message]) =>
        message === 'Concept dropdown not initialized, cannot load concepts'
      )
    ).toBe(true);

    expect(document.getElementById('total-directions').textContent).toBe('2');
    expect(document.querySelectorAll('.direction-card-editable').length).toBe(2);
  });

  it('falls back to native select when enhanced dropdown fails to initialize', async () => {
    arrangeStandardData();

    const select = document.getElementById('concept-selector');
    const fallbackElement = document.createElement('div');
    fallbackElement.id = 'concept-selector';
    Object.defineProperty(fallbackElement, 'options', {
      value: [],
      writable: true,
    });
    fallbackElement.disabled = false;
    fallbackElement.value = '';
    select.replaceWith(fallbackElement);

    await controller.initialize();

    expect(fallbackElement.classList.contains('native-fallback')).toBe(true);

    const fallbackEvents = testBase.mocks.eventBus.dispatch.mock.calls.filter(
      ([event, payload]) =>
        event === 'core:analytics_track' &&
        payload?.properties?.action === 'fallback'
    );
    expect(fallbackEvents.length).toBeGreaterThan(0);

    fallbackElement.value = 'orphaned';
    fallbackElement.dispatchEvent(new Event('change', { bubbles: true }));
    await flushAsync();
  });

  it('surfaces initialization failures from characterBuilderService.initialize', async () => {
    arrangeStandardData();
    const failure = new Error('init failure');
    testBase.mocks.characterBuilderService.initialize.mockRejectedValueOnce(
      failure
    );

    await expect(controller.initialize()).rejects.toThrow('init failure');

    const initErrorMessages = testBase.mocks.logger.error.mock.calls.map(
      ([message]) => message
    );
    expect(initErrorMessages.join('\n')).toContain(
      'ThematicDirectionsManagerController: Failed service initialization'
    );
  });

  it('handles invalid datasets, refresh failures, and dropdown reset fallbacks', async () => {
    testBase.mocks.characterBuilderService.getAllThematicDirectionsWithConcepts.mockResolvedValueOnce(
      'not-an-array'
    );

    await controller.initialize();

    expect(
      testBase.mocks.logger.warn.mock.calls.some(([message]) =>
        message.includes('directionsData is not an array')
      )
    ).toBe(true);

    const emptyMessage = document.querySelector('#empty-state .empty-message');
    expect(emptyMessage.textContent).toContain('No thematic directions found');

    const select = document.getElementById('concept-selector');
    select.innerHTML = '';
    const cachedOption = document.createElement('option');
    cachedOption.value = 'existing';
    cachedOption.textContent = 'Existing Concept';
    select.appendChild(cachedOption);

    const clearSpy = jest
      .spyOn(PreviousItemsDropdown.prototype, 'clear')
      .mockImplementationOnce(() => {
        throw new Error('clear failure');
      });

    testBase.mocks.characterBuilderService.getAllThematicDirectionsWithConcepts.mockRejectedValueOnce(
      new Error('refresh failure')
    );

    await controller.refreshDropdown();

    expect(
      testBase.mocks.logger.error.mock.calls.some(
        ([message]) => message === 'Failed to reset dropdown:'
      )
    ).toBe(true);

    expect(select.querySelectorAll('option').length).toBeGreaterThan(0);
    expect(select.classList.contains('native-fallback')).toBe(true);

    clearSpy.mockRestore();
  });

  it('handles concept selection errors, deleteDirection calls, and orphan cleanup failures', async () => {
    const data = arrangeStandardData();
    await controller.initialize();

    testBase.mocks.characterBuilderService.getCharacterConcept.mockRejectedValueOnce(
      new Error('concept load failure')
    );

    const select = document.getElementById('concept-selector');
    select.value = data[0].concept.id;
    select.dispatchEvent(new Event('change', { bubbles: true }));
    await flushAsync();

    expect(
      document.getElementById('concept-display-container').style.display
    ).toBe('none');

    testBase.mocks.characterBuilderService.deleteThematicDirection.mockResolvedValueOnce(
      true
    );

    controller.deleteDirection(data[0].direction);
    jest.runOnlyPendingTimers();
    document.getElementById('modal-confirm-btn').click();
    await flushAsync();

    expect(
      testBase.mocks.characterBuilderService.deleteThematicDirection
    ).toHaveBeenCalledWith(data[0].direction.id);

    testBase.mocks.characterBuilderService.deleteThematicDirection.mockRejectedValueOnce(
      new Error('cleanup failure')
    );

    document.getElementById('cleanup-orphans-btn').click();
    jest.runOnlyPendingTimers();
    document.getElementById('modal-confirm-btn').click();
    await flushAsync();

    expect(alertSpy).toHaveBeenCalledWith(
      'Failed to cleanup orphaned directions. Please try again.'
    );
  });

  it('captures modal cancellation errors, focus restoration issues, and cleanup warnings', async () => {
    arrangeStandardData();
    await controller.initialize();

    const focusTarget = document.createElement('button');
    focusTarget.id = 'focus-target';
    document.body.appendChild(focusTarget);
    focusTarget.focus();
    const originalFocus = focusTarget.focus.bind(focusTarget);
    focusTarget.focus = jest.fn(() => {
      throw new Error('focus failure');
    });

    const cancelError = new Error('cancel failure');
    controller._showConfirmationModal({
      title: 'Test Modal',
      message: 'Testing modal error handling',
      onConfirm: jest.fn(),
      onCancel: () => {
        throw cancelError;
      },
    });
    jest.runOnlyPendingTimers();

    const orphanEditor = document.createElement('div');
    orphanEditor.className = 'in-place-editor';
    orphanEditor.remove = jest.fn(() => {
      throw new Error('remove failure');
    });
    document.body.appendChild(orphanEditor);

    const inPlaceDestroySpy = jest
      .spyOn(InPlaceEditor.prototype, 'destroy')
      .mockImplementationOnce(() => {
        throw new Error('editor destroy failure');
      });

    const titleField = document.querySelector(
      '.direction-card-editable [data-field="title"][data-direction-id="dir-1"]'
    );
    titleField.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flushAsync();

    document.getElementById('modal-cancel-btn').click();
    expect(
      testBase.mocks.logger.error.mock.calls.some(
        ([message]) => message === 'Error in modal cancel callback:'
      )
    ).toBe(true);

    controller._preDestroy();
    jest.runOnlyPendingTimers();

    expect(
      testBase.mocks.logger.warn.mock.calls.some((call) =>
        call[0] ===
        'Failed to destroy InPlaceEditor instance for key: dir-1-title'
      )
    ).toBe(true);

    expect(
      testBase.mocks.logger.debug.mock.calls.some((call) =>
        call[0] === 'Failed to remove orphaned editor element:'
      )
    ).toBe(true);

    inPlaceDestroySpy.mockRestore();
    focusTarget.focus = originalFocus;
    focusTarget.remove();
    orphanEditor.remove = jest.fn(() => {});
    orphanEditor.remove();
  });

  it('validates empty and overly long inputs before saving edits', async () => {
    arrangeStandardData();
    await controller.initialize();

    const titleField = document.querySelector(
      '.direction-card-editable [data-field="title"][data-direction-id="dir-1"]'
    );
    titleField.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flushAsync();

    const editor = titleField.parentElement.querySelector('.in-place-editor');
    const input = editor.querySelector('.in-place-editor-input');
    const saveBtn = editor.querySelector('.in-place-save-btn');

    input.value = '    ';
    saveBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flushAsync();
    expect(
      editor.querySelector('.in-place-editor-error').textContent
    ).toContain('Field cannot be empty');

    input.value = 'A'.repeat(305);
    saveBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flushAsync();
    expect(
      editor.querySelector('.in-place-editor-error').textContent
    ).toContain('title must be no more than 300 characters');
  });

  it('handles dropdown state persistence failures and concept display edge cases', async () => {
    localStorage.setItem('thematic-directions-dropdown-state', '{invalid-json');
    const data = arrangeStandardData();

    await controller.initialize();

    expect(
      testBase.mocks.logger.error.mock.calls.some((call) =>
        call[0] === 'Failed to restore dropdown state:'
      )
    ).toBe(true);

    const storagePrototype = Object.getPrototypeOf(localStorage);
    const storageSpy = jest
      .spyOn(storagePrototype, 'setItem')
      .mockImplementation(() => {
        throw new Error('storage failure');
      });

    const filterInput = document.getElementById('direction-filter');
    filterInput.value = 'shadow';
    filterInput.dispatchEvent(new Event('input', { bubbles: true }));
    await flushAsync();

    expect(storageSpy).toHaveBeenCalled();

    const saveErrorMessages = testBase.mocks.logger.error.mock.calls.map(
      ([message]) => message
    );
    expect(saveErrorMessages.join('\n')).toContain(
      'Failed to save dropdown state:'
    );

    storageSpy.mockRestore();

    const displayContainer = document.getElementById('concept-display-container');
    const displayContent = document.getElementById('concept-display-content');
    displayContainer.remove();
    displayContent.remove();

    testBase.mocks.characterBuilderService.getCharacterConcept.mockResolvedValueOnce(
      data[0].concept
    );

    const select = document.getElementById('concept-selector');
    select.value = data[0].concept.id;
    select.dispatchEvent(new Event('change', { bubbles: true }));
    await flushAsync();
  });
});

