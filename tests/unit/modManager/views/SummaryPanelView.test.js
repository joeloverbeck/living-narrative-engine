/**
 * @file Unit tests for SummaryPanelView
 * @see src/modManager/views/SummaryPanelView.js
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { SummaryPanelView } from '../../../../src/modManager/views/SummaryPanelView.js';

describe('SummaryPanelView', () => {
  /** @type {HTMLElement} */
  let container;
  /** @type {{error: jest.Mock}} */
  let mockLogger;
  /** @type {jest.Mock} */
  let onSave;
  /** @type {SummaryPanelView} */
  let view;

  beforeEach(() => {
    document.body.innerHTML = '<div id="root"></div>';
    container = document.getElementById('root');

    mockLogger = { error: jest.fn() };
    onSave = jest.fn().mockResolvedValue(undefined);

    view = new SummaryPanelView({
      container,
      logger: mockLogger,
      onSave,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  describe('constructor validation', () => {
    it('throws if container is missing', () => {
      expect(() => {
        new SummaryPanelView({
          container: null,
          logger: mockLogger,
          onSave,
        });
      }).toThrow('SummaryPanelView: container is required');
    });

    it('throws if logger is missing', () => {
      expect(() => {
        new SummaryPanelView({
          container,
          logger: null,
          onSave,
        });
      }).toThrow('SummaryPanelView: logger is required');
    });

    it('throws if onSave is missing', () => {
      expect(() => {
        new SummaryPanelView({
          container,
          logger: mockLogger,
          onSave: null,
        });
      }).toThrow('SummaryPanelView: onSave is required');
    });
  });

  describe('render', () => {
    it('displays active mod count', () => {
      view.render({
        loadOrder: ['core', 'extra', 'another'],
        activeCount: 3,
        hasUnsavedChanges: false,
        isSaving: false,
        isLoading: false,
      });

      const countValue = container.querySelector('.summary-panel__stat-value');
      expect(countValue.textContent).toBe('3');
    });

    it('displays load order as numbered list', () => {
      view.render({
        loadOrder: ['core', 'extra'],
        activeCount: 2,
        hasUnsavedChanges: false,
        isSaving: false,
        isLoading: false,
      });

      const items = container.querySelectorAll('.summary-panel__load-order-item');
      expect(items.length).toBe(2);

      const firstNumber = items[0].querySelector('.load-order__number');
      expect(firstNumber.textContent).toBe('1');

      const secondNumber = items[1].querySelector('.load-order__number');
      expect(secondNumber.textContent).toBe('2');
    });

    it('marks core mod with lock icon', () => {
      view.render({
        loadOrder: ['core', 'extra'],
        activeCount: 2,
        hasUnsavedChanges: false,
        isSaving: false,
        isLoading: false,
      });

      const coreItem = container.querySelector('.summary-panel__load-order-item--core');
      expect(coreItem).not.toBeNull();

      const badge = coreItem.querySelector('.load-order__badge');
      expect(badge).not.toBeNull();
      expect(badge.textContent).toBe('🔒');
      expect(badge.getAttribute('aria-label')).toBe('Core mod');
    });

    it('shows unsaved indicator when hasUnsavedChanges', () => {
      view.render({
        loadOrder: ['core'],
        activeCount: 1,
        hasUnsavedChanges: true,
        isSaving: false,
        isLoading: false,
      });

      const unsavedIndicator = container.querySelector('.summary-panel__unsaved');
      expect(unsavedIndicator.hidden).toBe(false);
    });

    it('hides unsaved indicator when no changes', () => {
      view.render({
        loadOrder: ['core'],
        activeCount: 1,
        hasUnsavedChanges: false,
        isSaving: false,
        isLoading: false,
      });

      const unsavedIndicator = container.querySelector('.summary-panel__unsaved');
      expect(unsavedIndicator.hidden).toBe(true);
    });

    it('disables save button when no unsaved changes', () => {
      view.render({
        loadOrder: ['core'],
        activeCount: 1,
        hasUnsavedChanges: false,
        isSaving: false,
        isLoading: false,
      });

      const saveButton = container.querySelector('.summary-panel__save-button');
      expect(saveButton.disabled).toBe(true);
    });

    it('disables save button when saving', () => {
      view.render({
        loadOrder: ['core'],
        activeCount: 1,
        hasUnsavedChanges: true,
        isSaving: true,
        isLoading: false,
      });

      const saveButton = container.querySelector('.summary-panel__save-button');
      expect(saveButton.disabled).toBe(true);
    });

    it('disables save button when loading', () => {
      view.render({
        loadOrder: [],
        activeCount: 0,
        hasUnsavedChanges: true,
        isSaving: false,
        isLoading: true,
      });

      const saveButton = container.querySelector('.summary-panel__save-button');
      expect(saveButton.disabled).toBe(true);
    });

    it('shows loading state for load order', () => {
      view.render({
        loadOrder: [],
        activeCount: 0,
        hasUnsavedChanges: false,
        isSaving: false,
        isLoading: true,
      });

      const loadingElement = container.querySelector('.summary-panel__loading');
      expect(loadingElement).not.toBeNull();
      expect(loadingElement.textContent).toBe('Loading...');
    });

    it('shows empty state when no mods active', () => {
      view.render({
        loadOrder: [],
        activeCount: 0,
        hasUnsavedChanges: false,
        isSaving: false,
        isLoading: false,
      });

      const emptyElement = container.querySelector('.summary-panel__empty');
      expect(emptyElement).not.toBeNull();
      expect(emptyElement.textContent).toBe('No mods active');
    });

    it('hides unsaved indicator when saving', () => {
      view.render({
        loadOrder: ['core'],
        activeCount: 1,
        hasUnsavedChanges: true,
        isSaving: true,
        isLoading: false,
      });

      const unsavedIndicator = container.querySelector('.summary-panel__unsaved');
      expect(unsavedIndicator.hidden).toBe(true);
    });

    it('enables save button when has unsaved changes and not saving or loading', () => {
      view.render({
        loadOrder: ['core'],
        activeCount: 1,
        hasUnsavedChanges: true,
        isSaving: false,
        isLoading: false,
      });

      const saveButton = container.querySelector('.summary-panel__save-button');
      expect(saveButton.disabled).toBe(false);
    });
  });

  describe('save button click', () => {
    it('triggers onSave callback', async () => {
      view.render({
        loadOrder: ['core'],
        activeCount: 1,
        hasUnsavedChanges: true,
        isSaving: false,
        isLoading: false,
      });

      const saveButton = container.querySelector('.summary-panel__save-button');
      saveButton.click();

      await Promise.resolve(); // Allow async click handler to run
      expect(onSave).toHaveBeenCalledTimes(1);
    });

    it('does not trigger callback when button is disabled', () => {
      view.render({
        loadOrder: ['core'],
        activeCount: 1,
        hasUnsavedChanges: false,
        isSaving: false,
        isLoading: false,
      });

      const saveButton = container.querySelector('.summary-panel__save-button');
      saveButton.click();

      expect(onSave).not.toHaveBeenCalled();
    });
  });

  describe('setSaving', () => {
    it('updates button text and icon when saving', () => {
      view.render({
        loadOrder: ['core'],
        activeCount: 1,
        hasUnsavedChanges: true,
        isSaving: true,
        isLoading: false,
      });

      const saveButton = container.querySelector('.summary-panel__save-button');
      const textElement = saveButton.querySelector('.save-button__text');
      const iconElement = saveButton.querySelector('.save-button__icon');

      expect(textElement.textContent).toBe('Saving...');
      expect(iconElement.textContent).toBe('⏳');
      expect(saveButton.classList.contains('summary-panel__save-button--saving')).toBe(true);
      expect(saveButton.getAttribute('aria-busy')).toBe('true');
    });

    it('resets button text and icon after saving', () => {
      view.render({
        loadOrder: ['core'],
        activeCount: 1,
        hasUnsavedChanges: true,
        isSaving: true,
        isLoading: false,
      });

      view.render({
        loadOrder: ['core'],
        activeCount: 1,
        hasUnsavedChanges: false,
        isSaving: false,
        isLoading: false,
      });

      const saveButton = container.querySelector('.summary-panel__save-button');
      const textElement = saveButton.querySelector('.save-button__text');
      const iconElement = saveButton.querySelector('.save-button__icon');

      expect(textElement.textContent).toBe('Save Configuration');
      expect(iconElement.textContent).toBe('💾');
      expect(saveButton.classList.contains('summary-panel__save-button--saving')).toBe(false);
      expect(saveButton.hasAttribute('aria-busy')).toBe(false);
    });
  });

  describe('showSaveSuccess', () => {
    it('displays success state temporarily', () => {
      jest.useFakeTimers();

      view.render({
        loadOrder: ['core'],
        activeCount: 1,
        hasUnsavedChanges: false,
        isSaving: false,
        isLoading: false,
      });

      view.showSaveSuccess();

      const saveButton = container.querySelector('.summary-panel__save-button');
      const textElement = saveButton.querySelector('.save-button__text');
      const iconElement = saveButton.querySelector('.save-button__icon');

      expect(textElement.textContent).toBe('Saved!');
      expect(iconElement.textContent).toBe('✅');
      expect(saveButton.classList.contains('summary-panel__save-button--success')).toBe(true);

      jest.advanceTimersByTime(2000);

      expect(textElement.textContent).toBe('Save Configuration');
      expect(iconElement.textContent).toBe('💾');
      expect(saveButton.classList.contains('summary-panel__save-button--success')).toBe(false);
    });
  });

  describe('showSaveError', () => {
    it('displays error state temporarily', () => {
      jest.useFakeTimers();

      view.render({
        loadOrder: ['core'],
        activeCount: 1,
        hasUnsavedChanges: true,
        isSaving: false,
        isLoading: false,
      });

      view.showSaveError('Network error');

      const saveButton = container.querySelector('.summary-panel__save-button');
      const textElement = saveButton.querySelector('.save-button__text');
      const iconElement = saveButton.querySelector('.save-button__icon');

      expect(textElement.textContent).toBe('Save Failed');
      expect(iconElement.textContent).toBe('❌');
      expect(saveButton.classList.contains('summary-panel__save-button--error')).toBe(true);

      expect(mockLogger.error).toHaveBeenCalledWith('Save error displayed', {
        message: 'Network error',
      });

      jest.advanceTimersByTime(3000);

      expect(textElement.textContent).toBe('Save Configuration');
      expect(iconElement.textContent).toBe('💾');
      expect(saveButton.classList.contains('summary-panel__save-button--error')).toBe(false);
    });
  });

  describe('destroy', () => {
    it('cleans up container', () => {
      view.render({
        loadOrder: ['core'],
        activeCount: 1,
        hasUnsavedChanges: false,
        isSaving: false,
        isLoading: false,
      });

      expect(container.innerHTML).not.toBe('');

      view.destroy();

      expect(container.innerHTML).toBe('');
    });
  });

  describe('structure creation', () => {
    it('creates all required elements', () => {
      expect(container.querySelector('.summary-panel__title')).not.toBeNull();
      expect(container.querySelector('.summary-panel__stats')).not.toBeNull();
      expect(container.querySelector('.summary-panel__stat')).not.toBeNull();
      expect(container.querySelector('.summary-panel__load-order')).not.toBeNull();
      expect(container.querySelector('.summary-panel__load-order-list')).not.toBeNull();
      expect(container.querySelector('.summary-panel__save')).not.toBeNull();
      expect(container.querySelector('.summary-panel__unsaved')).not.toBeNull();
      expect(container.querySelector('.summary-panel__save-button')).not.toBeNull();
    });

    it('sets correct accessibility attributes', () => {
      const stats = container.querySelector('.summary-panel__stats');
      expect(stats.getAttribute('aria-label')).toBe('Mod statistics');

      const loadOrder = container.querySelector('.summary-panel__load-order');
      expect(loadOrder.getAttribute('aria-label')).toBe('Load order');

      const loadOrderList = container.querySelector('.summary-panel__load-order-list');
      expect(loadOrderList.getAttribute('aria-label')).toBe('Mods will load in this order');

      const unsaved = container.querySelector('.summary-panel__unsaved');
      expect(unsaved.getAttribute('role')).toBe('status');
      expect(unsaved.getAttribute('aria-live')).toBe('polite');
    });
  });

  describe('XSS prevention', () => {
    it('escapes HTML in mod IDs', () => {
      view.render({
        loadOrder: ['<script>alert("xss")</script>'],
        activeCount: 1,
        hasUnsavedChanges: false,
        isSaving: false,
        isLoading: false,
      });

      const modIdElement = container.querySelector('.load-order__mod-id');
      expect(modIdElement.textContent).toBe('<script>alert("xss")</script>');
      expect(modIdElement.innerHTML).not.toContain('<script>');
    });
  });
});
