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

    it('displays explicit mod count', () => {
      view.render({
        loadOrder: ['core', 'explicit1', 'explicit2'],
        activeCount: 3,
        explicitCount: 2,
        dependencyCount: 0,
        hasUnsavedChanges: false,
        isSaving: false,
        isLoading: false,
      });

      const statValues = container.querySelectorAll('.summary-panel__stat-value');
      // Stats order: Active, Explicit, Deps
      expect(statValues[1].textContent).toBe('2');
    });

    it('displays dependency mod count', () => {
      view.render({
        loadOrder: ['core', 'dep1', 'dep2', 'dep3'],
        activeCount: 4,
        explicitCount: 1,
        dependencyCount: 3,
        hasUnsavedChanges: false,
        isSaving: false,
        isLoading: false,
      });

      const statValues = container.querySelectorAll('.summary-panel__stat-value');
      // Stats order: Active, Explicit, Deps
      expect(statValues[2].textContent).toBe('3');
    });

    it('displays all three stats correctly for mixed mod types', () => {
      view.render({
        loadOrder: ['core', 'explicit1', 'explicit2', 'dep1'],
        activeCount: 4,
        explicitCount: 2,
        dependencyCount: 1,
        hasUnsavedChanges: false,
        isSaving: false,
        isLoading: false,
      });

      const statValues = container.querySelectorAll('.summary-panel__stat-value');
      expect(statValues[0].textContent).toBe('4'); // Active
      expect(statValues[1].textContent).toBe('2'); // Explicit
      expect(statValues[2].textContent).toBe('1'); // Deps
    });

    it('displays zero stats when counts are zero or missing', () => {
      view.render({
        loadOrder: [],
        activeCount: 0,
        hasUnsavedChanges: false,
        isSaving: false,
        isLoading: false,
      });

      const statValues = container.querySelectorAll('.summary-panel__stat-value');
      expect(statValues[0].textContent).toBe('0'); // Active
      expect(statValues[1].textContent).toBe('0'); // Explicit (defaults to 0)
      expect(statValues[2].textContent).toBe('0'); // Deps (defaults to 0)
    });

    it('defaults explicitCount and dependencyCount to 0 when not provided', () => {
      view.render({
        loadOrder: ['core'],
        activeCount: 1,
        hasUnsavedChanges: false,
        isSaving: false,
        isLoading: false,
      });

      const statValues = container.querySelectorAll('.summary-panel__stat-value');
      expect(statValues[1].textContent).toBe('0'); // Explicit defaults to 0
      expect(statValues[2].textContent).toBe('0'); // Deps defaults to 0
    });

    it('updates stats when values change', () => {
      view.render({
        loadOrder: ['core'],
        activeCount: 1,
        explicitCount: 0,
        dependencyCount: 0,
        hasUnsavedChanges: false,
        isSaving: false,
        isLoading: false,
      });

      let statValues = container.querySelectorAll('.summary-panel__stat-value');
      expect(statValues[0].textContent).toBe('1');
      expect(statValues[1].textContent).toBe('0');
      expect(statValues[2].textContent).toBe('0');

      // Simulate graph change
      view.render({
        loadOrder: ['core', 'explicit1', 'dep1'],
        activeCount: 3,
        explicitCount: 1,
        dependencyCount: 1,
        hasUnsavedChanges: true,
        isSaving: false,
        isLoading: false,
      });

      statValues = container.querySelectorAll('.summary-panel__stat-value');
      expect(statValues[0].textContent).toBe('3');
      expect(statValues[1].textContent).toBe('1');
      expect(statValues[2].textContent).toBe('1');
    });

    it('renders stats with correct BEM structure', () => {
      view.render({
        loadOrder: ['core'],
        activeCount: 1,
        explicitCount: 1,
        dependencyCount: 0,
        hasUnsavedChanges: false,
        isSaving: false,
        isLoading: false,
      });

      const quickStats = container.querySelector('.summary-panel__quick-stats');
      expect(quickStats).not.toBeNull();

      const statsRow = container.querySelector('.summary-panel__stats-row');
      expect(statsRow).not.toBeNull();

      const stats = container.querySelectorAll('.summary-panel__stat');
      expect(stats.length).toBe(3); // Active, Explicit, Deps

      const dividers = container.querySelectorAll('.summary-panel__stat-divider');
      expect(dividers.length).toBe(2); // Two dividers between three stats

      // Check labels
      const labels = container.querySelectorAll('.summary-panel__stat-label');
      expect(labels[0].textContent).toBe('Active');
      expect(labels[1].textContent).toBe('Explicit');
      expect(labels[2].textContent).toBe('Deps');
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
      expect(container.querySelector('.summary-panel__quick-stats')).not.toBeNull();
      expect(container.querySelector('.summary-panel__stats-row')).not.toBeNull();
      expect(container.querySelector('.summary-panel__stat')).not.toBeNull();
      expect(container.querySelector('.summary-panel__load-order')).not.toBeNull();
      expect(container.querySelector('.summary-panel__load-order-list')).not.toBeNull();
      expect(container.querySelector('.summary-panel__save')).not.toBeNull();
      expect(container.querySelector('.summary-panel__unsaved')).not.toBeNull();
      expect(container.querySelector('.summary-panel__save-button')).not.toBeNull();
    });

    it('sets correct accessibility attributes', () => {
      const stats = container.querySelector('.summary-panel__quick-stats');
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

  describe('Dependency Hotspots Section', () => {
    it('should render hotspots list with provided data', () => {
      view.render({
        loadOrder: ['core'],
        activeCount: 1,
        hasUnsavedChanges: false,
        isSaving: false,
        isLoading: false,
        hotspots: [
          { modId: 'core', dependentCount: 42 },
          { modId: 'anatomy', dependentCount: 28 },
          { modId: 'positioning', dependentCount: 15 },
        ],
      });

      const hotspotItems = container.querySelectorAll(
        '.summary-panel__hotspot-item'
      );
      expect(hotspotItems).toHaveLength(3);

      expect(
        hotspotItems[0].querySelector('.summary-panel__hotspot-name')
          .textContent
      ).toBe('core');
      expect(
        hotspotItems[0].querySelector('.summary-panel__hotspot-count')
          .textContent
      ).toBe('42 dependents');
    });

    it('should show empty message when hotspots array is empty', () => {
      view.render({
        loadOrder: ['core'],
        activeCount: 1,
        hasUnsavedChanges: false,
        isSaving: false,
        isLoading: false,
        hotspots: [],
      });

      const emptyMessage = container.querySelector(
        '.summary-panel__hotspots-empty'
      );
      expect(emptyMessage).toBeTruthy();
      expect(emptyMessage.textContent).toBe('No dependency hotspots');
    });

    it('should toggle section on header click', () => {
      view.render({
        loadOrder: ['core'],
        activeCount: 1,
        hasUnsavedChanges: false,
        isSaving: false,
        isLoading: false,
        hotspots: [{ modId: 'core', dependentCount: 10 }],
      });

      const header = container.querySelector('.summary-panel__section-header');
      const content = container.querySelector('.summary-panel__section-content');

      expect(header.getAttribute('aria-expanded')).toBe('true');
      expect(
        content.classList.contains('summary-panel__section-content--collapsed')
      ).toBe(false);

      header.click();

      expect(header.getAttribute('aria-expanded')).toBe('false');
      expect(
        content.classList.contains('summary-panel__section-content--collapsed')
      ).toBe(true);

      header.click();

      expect(header.getAttribute('aria-expanded')).toBe('true');
      expect(
        content.classList.contains('summary-panel__section-content--collapsed')
      ).toBe(false);
    });

    it('should have correct BEM class structure', () => {
      view.render({
        loadOrder: ['core'],
        activeCount: 1,
        hasUnsavedChanges: false,
        isSaving: false,
        isLoading: false,
        hotspots: [{ modId: 'core', dependentCount: 10 }],
      });

      expect(
        container.querySelector('.summary-panel__section--collapsible')
      ).toBeTruthy();
      expect(
        container.querySelector('.summary-panel__section-header')
      ).toBeTruthy();
      expect(
        container.querySelector('.summary-panel__section-title')
      ).toBeTruthy();
      expect(
        container.querySelector('.summary-panel__section-toggle')
      ).toBeTruthy();
      expect(
        container.querySelector('.summary-panel__section-content')
      ).toBeTruthy();
      expect(
        container.querySelector('.summary-panel__hotspots-list')
      ).toBeTruthy();
    });

    it('should default to empty array when hotspots not provided (backward compatibility)', () => {
      view.render({
        loadOrder: ['core'],
        activeCount: 1,
        hasUnsavedChanges: false,
        isSaving: false,
        isLoading: false,
        // hotspots not provided
      });

      const emptyMessage = container.querySelector(
        '.summary-panel__hotspots-empty'
      );
      expect(emptyMessage).toBeTruthy();
      expect(emptyMessage.textContent).toBe('No dependency hotspots');
    });

    it('should escape HTML in mod IDs to prevent XSS', () => {
      view.render({
        loadOrder: ['core'],
        activeCount: 1,
        hasUnsavedChanges: false,
        isSaving: false,
        isLoading: false,
        hotspots: [
          { modId: '<script>alert("xss")</script>', dependentCount: 5 },
        ],
      });

      const modName = container.querySelector('.summary-panel__hotspot-name');
      expect(modName.textContent).toBe('<script>alert("xss")</script>');
      expect(modName.innerHTML).not.toContain('<script>');
    });

    it('should update toggle icon when collapsing/expanding', () => {
      view.render({
        loadOrder: ['core'],
        activeCount: 1,
        hasUnsavedChanges: false,
        isSaving: false,
        isLoading: false,
        hotspots: [{ modId: 'core', dependentCount: 10 }],
      });

      const header = container.querySelector('.summary-panel__section-header');
      const toggle = container.querySelector('.summary-panel__section-toggle');

      expect(toggle.textContent).toBe('▼');

      header.click();
      expect(toggle.textContent).toBe('▶');

      header.click();
      expect(toggle.textContent).toBe('▼');
    });

    it('should have correct accessibility attributes on header button', () => {
      view.render({
        loadOrder: ['core'],
        activeCount: 1,
        hasUnsavedChanges: false,
        isSaving: false,
        isLoading: false,
        hotspots: [{ modId: 'core', dependentCount: 10 }],
      });

      const header = container.querySelector('.summary-panel__section-header');
      expect(header.getAttribute('type')).toBe('button');
      expect(header.getAttribute('aria-expanded')).toBe('true');
    });

    it('should render multiple hotspots in order', () => {
      view.render({
        loadOrder: ['core', 'anatomy', 'positioning'],
        activeCount: 3,
        hasUnsavedChanges: false,
        isSaving: false,
        isLoading: false,
        hotspots: [
          { modId: 'core', dependentCount: 42 },
          { modId: 'anatomy', dependentCount: 28 },
          { modId: 'positioning', dependentCount: 15 },
          { modId: 'clothing', dependentCount: 8 },
          { modId: 'items', dependentCount: 5 },
        ],
      });

      const hotspotItems = container.querySelectorAll(
        '.summary-panel__hotspot-item'
      );
      expect(hotspotItems).toHaveLength(5);

      const names = Array.from(hotspotItems).map(
        (item) =>
          item.querySelector('.summary-panel__hotspot-name').textContent
      );
      expect(names).toEqual([
        'core',
        'anatomy',
        'positioning',
        'clothing',
        'items',
      ]);

      const counts = Array.from(hotspotItems).map(
        (item) =>
          item.querySelector('.summary-panel__hotspot-count').textContent
      );
      expect(counts).toEqual([
        '42 dependents',
        '28 dependents',
        '15 dependents',
        '8 dependents',
        '5 dependents',
      ]);
    });

    it('should have hotspots section with correct aria-label', () => {
      view.render({
        loadOrder: ['core'],
        activeCount: 1,
        hasUnsavedChanges: false,
        isSaving: false,
        isLoading: false,
        hotspots: [],
      });

      const section = container.querySelector(
        '.summary-panel__section--collapsible'
      );
      expect(section.getAttribute('aria-label')).toBe('Dependency hotspots');
    });
  });

  describe('Dependency Health Section', () => {
    it('should render healthy configuration with checkmarks', () => {
      view.render({
        loadOrder: ['core'],
        activeCount: 1,
        hasUnsavedChanges: false,
        isSaving: false,
        isLoading: false,
        healthStatus: {
          hasCircularDeps: false,
          missingDeps: [],
          loadOrderValid: true,
          warnings: [],
          errors: [],
        },
      });

      const healthItems = container.querySelectorAll(
        '.summary-panel__health-item'
      );
      expect(healthItems).toHaveLength(3);

      // All items should have --ok modifier
      healthItems.forEach((item) => {
        expect(item.classList.contains('summary-panel__health-item--ok')).toBe(
          true
        );
      });

      // Check icons are checkmarks
      const icons = container.querySelectorAll('.summary-panel__health-icon');
      icons.forEach((icon) => {
        expect(icon.textContent).toBe('✓');
      });
    });

    it('should display missing dependencies', () => {
      view.render({
        loadOrder: ['core'],
        activeCount: 1,
        hasUnsavedChanges: false,
        isSaving: false,
        isLoading: false,
        healthStatus: {
          hasCircularDeps: false,
          missingDeps: ['mod1', 'mod2'],
          loadOrderValid: true,
          warnings: [],
          errors: [],
        },
      });

      const healthTexts = container.querySelectorAll(
        '.summary-panel__health-text'
      );
      const missingText = Array.from(healthTexts).find((el) =>
        el.textContent.includes('Missing')
      );
      expect(missingText.textContent).toBe('Missing dependencies: 2');
    });

    it('should show error messages', () => {
      view.render({
        loadOrder: ['core'],
        activeCount: 1,
        hasUnsavedChanges: false,
        isSaving: false,
        isLoading: false,
        healthStatus: {
          hasCircularDeps: true,
          missingDeps: [],
          loadOrderValid: false,
          warnings: [],
          errors: ['Circular dependency: A → B → A', 'Invalid load order'],
        },
      });

      const errors = container.querySelectorAll('.summary-panel__health-error');
      expect(errors).toHaveLength(2);
      expect(errors[0].textContent).toBe('Circular dependency: A → B → A');
      expect(errors[1].textContent).toBe('Invalid load order');
    });

    it('should show warning messages', () => {
      view.render({
        loadOrder: ['core'],
        activeCount: 1,
        hasUnsavedChanges: false,
        isSaving: false,
        isLoading: false,
        healthStatus: {
          hasCircularDeps: false,
          missingDeps: [],
          loadOrderValid: true,
          warnings: ['Consider updating mod X', 'Deprecated pattern detected'],
          errors: [],
        },
      });

      const warnings = container.querySelectorAll(
        '.summary-panel__health-warning'
      );
      expect(warnings).toHaveLength(2);
      expect(warnings[0].textContent).toBe('Consider updating mod X');
      expect(warnings[1].textContent).toBe('Deprecated pattern detected');
    });

    it('should add error class to header when errors exist', () => {
      view.render({
        loadOrder: ['core'],
        activeCount: 1,
        hasUnsavedChanges: false,
        isSaving: false,
        isLoading: false,
        healthStatus: {
          hasCircularDeps: true,
          missingDeps: [],
          loadOrderValid: true,
          warnings: [],
          errors: ['Error message'],
        },
      });

      const healthSection = container.querySelector(
        '[aria-label="Dependency health"]'
      );
      const header = healthSection.querySelector(
        '.summary-panel__section-header'
      );
      expect(
        header.classList.contains('summary-panel__section-header--error')
      ).toBe(true);
    });

    it('should add warning class to header when warnings and no errors', () => {
      view.render({
        loadOrder: ['core'],
        activeCount: 1,
        hasUnsavedChanges: false,
        isSaving: false,
        isLoading: false,
        healthStatus: {
          hasCircularDeps: false,
          missingDeps: [],
          loadOrderValid: true,
          warnings: ['Warning message'],
          errors: [],
        },
      });

      const healthSection = container.querySelector(
        '[aria-label="Dependency health"]'
      );
      const header = healthSection.querySelector(
        '.summary-panel__section-header'
      );
      expect(
        header.classList.contains('summary-panel__section-header--warning')
      ).toBe(true);
      expect(
        header.classList.contains('summary-panel__section-header--error')
      ).toBe(false);
    });

    it('should show summary counts', () => {
      view.render({
        loadOrder: ['core'],
        activeCount: 1,
        hasUnsavedChanges: false,
        isSaving: false,
        isLoading: false,
        healthStatus: {
          hasCircularDeps: false,
          missingDeps: [],
          loadOrderValid: true,
          warnings: ['warn1', 'warn2'],
          errors: ['err1'],
        },
      });

      const summaryItems = container.querySelectorAll(
        '.summary-panel__health-summary-item'
      );
      expect(summaryItems).toHaveLength(2);

      const summaryText = container.querySelector(
        '.summary-panel__health-summary'
      ).textContent;
      expect(summaryText).toContain('1');
      expect(summaryText).toContain('errors');
      expect(summaryText).toContain('2');
      expect(summaryText).toContain('warnings');
    });

    it('should toggle section on header click', () => {
      view.render({
        loadOrder: ['core'],
        activeCount: 1,
        hasUnsavedChanges: false,
        isSaving: false,
        isLoading: false,
        healthStatus: {
          hasCircularDeps: false,
          missingDeps: [],
          loadOrderValid: true,
          warnings: [],
          errors: [],
        },
      });

      const healthSection = container.querySelector(
        '[aria-label="Dependency health"]'
      );
      const header = healthSection.querySelector(
        '.summary-panel__section-header'
      );
      const content = healthSection.querySelector(
        '.summary-panel__section-content'
      );

      expect(header.getAttribute('aria-expanded')).toBe('true');
      expect(
        content.classList.contains('summary-panel__section-content--collapsed')
      ).toBe(false);

      header.click();

      expect(header.getAttribute('aria-expanded')).toBe('false');
      expect(
        content.classList.contains('summary-panel__section-content--collapsed')
      ).toBe(true);
    });

    it('should default to null healthStatus (backward compatibility)', () => {
      view.render({
        loadOrder: ['core'],
        activeCount: 1,
        hasUnsavedChanges: false,
        isSaving: false,
        isLoading: false,
        // healthStatus not provided
      });

      const healthSection = container.querySelector(
        '[aria-label="Dependency health"]'
      );
      expect(healthSection.hidden).toBe(true);
    });

    it('should escape HTML in messages to prevent XSS', () => {
      view.render({
        loadOrder: ['core'],
        activeCount: 1,
        hasUnsavedChanges: false,
        isSaving: false,
        isLoading: false,
        healthStatus: {
          hasCircularDeps: false,
          missingDeps: [],
          loadOrderValid: true,
          warnings: [],
          errors: ['<script>alert("xss")</script>'],
        },
      });

      const error = container.querySelector('.summary-panel__health-error');
      expect(error.textContent).toBe('<script>alert("xss")</script>');
      expect(error.innerHTML).not.toContain('<script>');
    });

    it('should have correct aria-label on health section', () => {
      view.render({
        loadOrder: ['core'],
        activeCount: 1,
        hasUnsavedChanges: false,
        isSaving: false,
        isLoading: false,
        healthStatus: {
          hasCircularDeps: false,
          missingDeps: [],
          loadOrderValid: true,
          warnings: [],
          errors: [],
        },
      });

      const healthSection = container.querySelector(
        '[aria-label="Dependency health"]'
      );
      expect(healthSection).toBeTruthy();
    });

    it('should render fail items for unhealthy checks', () => {
      view.render({
        loadOrder: ['core'],
        activeCount: 1,
        hasUnsavedChanges: false,
        isSaving: false,
        isLoading: false,
        healthStatus: {
          hasCircularDeps: true,
          missingDeps: ['missing-mod'],
          loadOrderValid: false,
          warnings: [],
          errors: [],
        },
      });

      const failItems = container.querySelectorAll(
        '.summary-panel__health-item--fail'
      );
      expect(failItems).toHaveLength(3);

      // Check icons are X marks
      const icons = container.querySelectorAll(
        '.summary-panel__health-item--fail .summary-panel__health-icon'
      );
      icons.forEach((icon) => {
        expect(icon.textContent).toBe('✗');
      });
    });
  });

  describe('Dependency Depth Section', () => {
    const defaultRenderOptions = (depthOverrides = {}) => ({
      loadOrder: [],
      activeCount: 0,
      explicitCount: 0,
      dependencyCount: 0,
      hotspots: [],
      healthStatus: {
        hasCircularDeps: false,
        missingDeps: [],
        loadOrderValid: true,
        warnings: [],
        errors: [],
      },
      depthAnalysis: {
        maxDepth: 0,
        deepestChain: [],
        averageDepth: 0,
        ...depthOverrides,
      },
      hasUnsavedChanges: false,
      isSaving: false,
      isLoading: false,
    });

    it('should display max and average depth', () => {
      view.render(
        defaultRenderOptions({
          maxDepth: 5,
          deepestChain: ['mod-e', 'mod-d', 'mod-c', 'mod-b', 'mod-a'],
          averageDepth: 2.4,
        })
      );

      const depthValues = container.querySelectorAll(
        '.summary-panel__depth-value'
      );
      expect(depthValues[0].textContent).toBe('5');
      expect(depthValues[1].textContent).toBe('2.4');
    });

    it('should display deepest chain with correct nodes', () => {
      view.render(
        defaultRenderOptions({
          maxDepth: 3,
          deepestChain: ['leaf', 'middle', 'root'],
          averageDepth: 2,
        })
      );

      const chainNodes = container.querySelectorAll(
        '.summary-panel__depth-chain-mod'
      );
      expect(chainNodes).toHaveLength(3);
      expect(chainNodes[0].textContent).toBe('leaf');
      expect(chainNodes[1].textContent).toBe('middle');
      expect(chainNodes[2].textContent).toBe('root');
    });

    it('should show empty message when no mods', () => {
      view.render(
        defaultRenderOptions({
          maxDepth: 0,
          deepestChain: [],
          averageDepth: 0,
        })
      );

      // Find the depth section's empty message
      const sections = container.querySelectorAll('.summary-panel__section');
      const depthSection = Array.from(sections).find((s) =>
        s.textContent.includes('Dependency Depth')
      );
      const emptyMessage = depthSection?.querySelector('.summary-panel__empty');

      expect(emptyMessage).toBeTruthy();
      expect(emptyMessage.textContent).toBe('No active mods');
    });

    it('should start collapsed', () => {
      view.render(
        defaultRenderOptions({
          maxDepth: 2,
          deepestChain: ['a', 'b'],
          averageDepth: 1.5,
        })
      );

      const headers = container.querySelectorAll(
        '.summary-panel__section-header'
      );
      const depthHeader = Array.from(headers).find((h) =>
        h.textContent.includes('Dependency Depth')
      );

      expect(depthHeader.getAttribute('aria-expanded')).toBe('false');
    });

    it('should toggle section on header click', () => {
      view.render(
        defaultRenderOptions({
          maxDepth: 2,
          deepestChain: ['a', 'b'],
          averageDepth: 1.5,
        })
      );

      const headers = container.querySelectorAll(
        '.summary-panel__section-header'
      );
      const depthHeader = Array.from(headers).find((h) =>
        h.textContent.includes('Dependency Depth')
      );

      depthHeader.click();

      expect(depthHeader.getAttribute('aria-expanded')).toBe('true');
    });

    it('should have correct BEM class structure', () => {
      view.render(
        defaultRenderOptions({
          maxDepth: 2,
          deepestChain: ['a', 'b'],
          averageDepth: 1.5,
        })
      );

      expect(
        container.querySelector('.summary-panel__depth-stats')
      ).toBeTruthy();
      expect(
        container.querySelector('.summary-panel__depth-stat')
      ).toBeTruthy();
      expect(
        container.querySelector('.summary-panel__depth-value')
      ).toBeTruthy();
      expect(
        container.querySelector('.summary-panel__depth-label')
      ).toBeTruthy();
      expect(
        container.querySelector('.summary-panel__depth-chain')
      ).toBeTruthy();
    });

    it('should escape HTML in chain mod IDs', () => {
      view.render(
        defaultRenderOptions({
          maxDepth: 1,
          deepestChain: ['<script>alert("xss")</script>'],
          averageDepth: 1,
        })
      );

      const chainMod = container.querySelector('.summary-panel__depth-chain-mod');
      expect(chainMod.innerHTML).not.toContain('<script>');
      expect(chainMod.textContent).toBe('<script>alert("xss")</script>');
    });

    it('should hide section when depthAnalysis is null', () => {
      view.render({
        loadOrder: [],
        activeCount: 0,
        explicitCount: 0,
        dependencyCount: 0,
        hotspots: [],
        healthStatus: {
          hasCircularDeps: false,
          missingDeps: [],
          loadOrderValid: true,
          warnings: [],
          errors: [],
        },
        depthAnalysis: null,
        hasUnsavedChanges: false,
        isSaving: false,
        isLoading: false,
      });

      // Find the depth section by aria-label (content is cleared when null)
      const depthSection = container.querySelector(
        '[aria-label="Dependency depth analysis"]'
      );
      expect(depthSection).toBeTruthy();
      expect(depthSection.hidden).toBe(true);
    });
  });

  describe('Dependency Footprint Section', () => {
    const defaultRenderOptions = (footprintOverrides = {}) => ({
      loadOrder: [],
      activeCount: 0,
      explicitCount: 0,
      dependencyCount: 0,
      hotspots: [],
      healthStatus: {
        hasCircularDeps: false,
        missingDeps: [],
        loadOrderValid: true,
        warnings: [],
        errors: [],
      },
      depthAnalysis: {
        maxDepth: 0,
        deepestChain: [],
        averageDepth: 0,
      },
      footprintAnalysis: {
        footprints: [],
        totalUniqueDeps: 0,
        sharedDepsCount: 0,
        overlapPercentage: 0,
        ...footprintOverrides,
      },
      hasUnsavedChanges: false,
      isSaving: false,
      isLoading: false,
    });

    it('should display overlap percentage prominently', () => {
      view.render(
        defaultRenderOptions({
          footprints: [{ modId: 'mod1', dependencies: ['core'], count: 1 }],
          totalUniqueDeps: 5,
          sharedDepsCount: 3,
          overlapPercentage: 60,
        })
      );

      const overlapValue = container.querySelector(
        '.summary-panel__footprint-overlap-value'
      );
      expect(overlapValue.textContent).toBe('60%');
    });

    it('should display footprint list for each explicit mod', () => {
      view.render(
        defaultRenderOptions({
          footprints: [
            { modId: 'large-mod', dependencies: ['a', 'b', 'c', 'd'], count: 4 },
            { modId: 'small-mod', dependencies: ['x'], count: 1 },
          ],
          totalUniqueDeps: 5,
          sharedDepsCount: 0,
          overlapPercentage: 0,
        })
      );

      const footprintItems = container.querySelectorAll(
        '.summary-panel__footprint-item'
      );
      expect(footprintItems).toHaveLength(2);

      const firstMod = footprintItems[0].querySelector(
        '.summary-panel__footprint-mod'
      );
      const firstCount = footprintItems[0].querySelector(
        '.summary-panel__footprint-count'
      );
      expect(firstMod.textContent).toBe('large-mod');
      expect(firstCount.textContent).toBe('+4 deps');
    });

    it('should show preview of first 3 deps with ellipsis for more', () => {
      view.render(
        defaultRenderOptions({
          footprints: [
            { modId: 'mod1', dependencies: ['a', 'b', 'c', 'd', 'e'], count: 5 },
          ],
          totalUniqueDeps: 5,
          sharedDepsCount: 0,
          overlapPercentage: 0,
        })
      );

      const depsPreview = container.querySelector(
        '.summary-panel__footprint-deps'
      );
      expect(depsPreview.textContent).toContain('a, b, c');
      expect(depsPreview.textContent).toContain('...');
    });

    it('should show footer with total and shared counts', () => {
      view.render(
        defaultRenderOptions({
          footprints: [{ modId: 'mod1', dependencies: ['a'], count: 1 }],
          totalUniqueDeps: 10,
          sharedDepsCount: 4,
          overlapPercentage: 40,
        })
      );

      const footer = container.querySelector('.summary-panel__footprint-footer');
      expect(footer.textContent).toContain('Total unique: 10');
      expect(footer.textContent).toContain('Shared: 4');
    });

    it('should show empty message when no explicit mods', () => {
      view.render(
        defaultRenderOptions({
          footprints: [],
          totalUniqueDeps: 0,
          sharedDepsCount: 0,
          overlapPercentage: 0,
        })
      );

      // Find the footprint section's empty message
      const sections = container.querySelectorAll('.summary-panel__section');
      const footprintSection = Array.from(sections).find((s) =>
        s.textContent.includes('Dependency Footprint')
      );
      const emptyMessage = footprintSection?.querySelector(
        '.summary-panel__empty'
      );

      expect(emptyMessage).toBeTruthy();
      expect(emptyMessage.textContent).toBe('No explicit mods');
    });

    it('should start collapsed', () => {
      view.render(
        defaultRenderOptions({
          footprints: [{ modId: 'mod1', dependencies: ['a'], count: 1 }],
          totalUniqueDeps: 1,
          sharedDepsCount: 0,
          overlapPercentage: 0,
        })
      );

      const headers = container.querySelectorAll(
        '.summary-panel__section-header'
      );
      const footprintHeader = Array.from(headers).find((h) =>
        h.textContent.includes('Dependency Footprint')
      );

      expect(footprintHeader.getAttribute('aria-expanded')).toBe('false');
    });

    it('should toggle collapse state on click', () => {
      view.render(
        defaultRenderOptions({
          footprints: [{ modId: 'mod1', dependencies: ['a'], count: 1 }],
          totalUniqueDeps: 1,
          sharedDepsCount: 0,
          overlapPercentage: 0,
        })
      );

      const headers = container.querySelectorAll(
        '.summary-panel__section-header'
      );
      const footprintHeader = Array.from(headers).find((h) =>
        h.textContent.includes('Dependency Footprint')
      );

      // Initially collapsed
      expect(footprintHeader.getAttribute('aria-expanded')).toBe('false');

      // Click to expand
      footprintHeader.click();
      expect(footprintHeader.getAttribute('aria-expanded')).toBe('true');

      // Click to collapse
      footprintHeader.click();
      expect(footprintHeader.getAttribute('aria-expanded')).toBe('false');
    });

    it('should have correct BEM class structure', () => {
      view.render(
        defaultRenderOptions({
          footprints: [{ modId: 'mod1', dependencies: ['a'], count: 1 }],
          totalUniqueDeps: 1,
          sharedDepsCount: 0,
          overlapPercentage: 0,
        })
      );

      expect(
        container.querySelector('.summary-panel__footprint-overlap')
      ).toBeTruthy();
      expect(
        container.querySelector('.summary-panel__footprint-list')
      ).toBeTruthy();
      expect(
        container.querySelector('.summary-panel__footprint-item')
      ).toBeTruthy();
      expect(
        container.querySelector('.summary-panel__footprint-footer')
      ).toBeTruthy();
    });

    it('should escape HTML in mod IDs', () => {
      view.render(
        defaultRenderOptions({
          footprints: [
            {
              modId: '<script>alert("xss")</script>',
              dependencies: ['a'],
              count: 1,
            },
          ],
          totalUniqueDeps: 1,
          sharedDepsCount: 0,
          overlapPercentage: 0,
        })
      );

      const modElement = container.querySelector('.summary-panel__footprint-mod');
      expect(modElement.innerHTML).not.toContain('<script>');
      expect(modElement.textContent).toBe('<script>alert("xss")</script>');
    });

    it('should hide section when footprintAnalysis is null', () => {
      view.render({
        loadOrder: [],
        activeCount: 0,
        explicitCount: 0,
        dependencyCount: 0,
        hotspots: [],
        healthStatus: {
          hasCircularDeps: false,
          missingDeps: [],
          loadOrderValid: true,
          warnings: [],
          errors: [],
        },
        depthAnalysis: null,
        footprintAnalysis: null,
        hasUnsavedChanges: false,
        isSaving: false,
        isLoading: false,
      });

      // Find the footprint section by aria-label
      const footprintSection = container.querySelector(
        '[aria-label="Dependency footprint analysis"]'
      );
      expect(footprintSection).toBeTruthy();
      expect(footprintSection.hidden).toBe(true);
    });
  });

  describe('Configuration Profile Section', () => {
    const defaultRenderOptions = (profileOverrides = {}) => ({
      loadOrder: [],
      activeCount: 0,
      explicitCount: 0,
      dependencyCount: 0,
      hotspots: [],
      healthStatus: {
        hasCircularDeps: false,
        missingDeps: [],
        loadOrderValid: true,
        warnings: [],
        errors: [],
      },
      depthAnalysis: {
        maxDepth: 0,
        deepestChain: [],
        averageDepth: 0,
      },
      footprintAnalysis: {
        footprints: [],
        totalUniqueDeps: 0,
        sharedDepsCount: 0,
        overlapPercentage: 0,
      },
      profileRatio: {
        foundationCount: 0,
        optionalCount: 0,
        totalActive: 0,
        foundationPercentage: 0,
        optionalPercentage: 0,
        foundationMods: [],
        profile: 'balanced',
        ...profileOverrides,
      },
      hasUnsavedChanges: false,
      isSaving: false,
      isLoading: false,
    });

    it('should display foundation-heavy badge correctly', () => {
      view.render(
        defaultRenderOptions({
          foundationCount: 8,
          optionalCount: 2,
          totalActive: 10,
          foundationPercentage: 80,
          optionalPercentage: 20,
          profile: 'foundation-heavy',
        })
      );

      const badge = container.querySelector('.summary-panel__profile-badge');
      expect(badge).toBeTruthy();
      expect(badge.textContent).toBe('Foundation Heavy');
      expect(
        badge.classList.contains('summary-panel__profile-badge--foundation-heavy')
      ).toBe(true);
    });

    it('should display content-heavy badge correctly', () => {
      view.render(
        defaultRenderOptions({
          foundationCount: 2,
          optionalCount: 8,
          totalActive: 10,
          foundationPercentage: 20,
          optionalPercentage: 80,
          profile: 'content-heavy',
        })
      );

      const badge = container.querySelector('.summary-panel__profile-badge');
      expect(badge).toBeTruthy();
      expect(badge.textContent).toBe('Content Heavy');
      expect(
        badge.classList.contains('summary-panel__profile-badge--content-heavy')
      ).toBe(true);
    });

    it('should display balanced badge correctly', () => {
      view.render(
        defaultRenderOptions({
          foundationCount: 5,
          optionalCount: 5,
          totalActive: 10,
          foundationPercentage: 50,
          optionalPercentage: 50,
          profile: 'balanced',
        })
      );

      const badge = container.querySelector('.summary-panel__profile-badge');
      expect(badge).toBeTruthy();
      expect(badge.textContent).toBe('Balanced');
      expect(
        badge.classList.contains('summary-panel__profile-badge--balanced')
      ).toBe(true);
    });

    it('should render bar visualization with correct widths', () => {
      view.render(
        defaultRenderOptions({
          foundationCount: 7,
          optionalCount: 3,
          totalActive: 10,
          foundationPercentage: 70,
          optionalPercentage: 30,
          profile: 'foundation-heavy',
        })
      );

      const foundationBar = container.querySelector(
        '.summary-panel__profile-bar--foundation'
      );
      const optionalBar = container.querySelector(
        '.summary-panel__profile-bar--optional'
      );

      expect(foundationBar).toBeTruthy();
      expect(foundationBar.style.width).toBe('70%');
      expect(optionalBar).toBeTruthy();
      expect(optionalBar.style.width).toBe('30%');
    });

    it('should have accessible aria-labels on bars', () => {
      view.render(
        defaultRenderOptions({
          foundationCount: 6,
          optionalCount: 4,
          totalActive: 10,
          foundationPercentage: 60,
          optionalPercentage: 40,
          profile: 'balanced',
        })
      );

      const foundationBar = container.querySelector(
        '.summary-panel__profile-bar--foundation'
      );
      const optionalBar = container.querySelector(
        '.summary-panel__profile-bar--optional'
      );

      expect(foundationBar.getAttribute('aria-label')).toBe('Foundation: 60%');
      expect(optionalBar.getAttribute('aria-label')).toBe('Optional: 40%');
    });

    it('should display legend with counts and percentages', () => {
      view.render(
        defaultRenderOptions({
          foundationCount: 7,
          optionalCount: 3,
          totalActive: 10,
          foundationPercentage: 70,
          optionalPercentage: 30,
          profile: 'foundation-heavy',
        })
      );

      const legend = container.querySelector('.summary-panel__profile-legend');
      expect(legend).toBeTruthy();
      expect(legend.textContent).toContain('Foundation: 7 (70%)');
      expect(legend.textContent).toContain('Optional: 3 (30%)');
    });

    it('should display total active count', () => {
      view.render(
        defaultRenderOptions({
          foundationCount: 8,
          optionalCount: 4,
          totalActive: 12,
          foundationPercentage: 67,
          optionalPercentage: 33,
          profile: 'foundation-heavy',
        })
      );

      const total = container.querySelector('.summary-panel__profile-total');
      expect(total).toBeTruthy();
      expect(total.textContent).toBe('Total Active: 12');
    });

    it('should show empty message when no active mods', () => {
      view.render(
        defaultRenderOptions({
          foundationCount: 0,
          optionalCount: 0,
          totalActive: 0,
          foundationPercentage: 0,
          optionalPercentage: 0,
          profile: 'balanced',
        })
      );

      const emptyMessage = container.querySelector('.summary-panel__empty');
      expect(emptyMessage).toBeTruthy();
      expect(emptyMessage.textContent).toBe('No active mods');

      // Should not have badge, bars, legend, or total
      expect(container.querySelector('.summary-panel__profile-badge')).toBeFalsy();
      expect(container.querySelector('.summary-panel__profile-bar-container')).toBeFalsy();
    });

    it('should handle 100% foundation correctly (0% optional)', () => {
      view.render(
        defaultRenderOptions({
          foundationCount: 5,
          optionalCount: 0,
          totalActive: 5,
          foundationPercentage: 100,
          optionalPercentage: 0,
          profile: 'foundation-heavy',
        })
      );

      const foundationBar = container.querySelector(
        '.summary-panel__profile-bar--foundation'
      );
      const optionalBar = container.querySelector(
        '.summary-panel__profile-bar--optional'
      );

      expect(foundationBar.style.width).toBe('100%');
      expect(optionalBar.style.width).toBe('0%');
    });

    it('should have correct BEM class structure', () => {
      view.render(
        defaultRenderOptions({
          foundationCount: 5,
          optionalCount: 5,
          totalActive: 10,
          foundationPercentage: 50,
          optionalPercentage: 50,
          profile: 'balanced',
        })
      );

      expect(container.querySelector('.summary-panel__profile-badge')).toBeTruthy();
      expect(container.querySelector('.summary-panel__profile-bar-container')).toBeTruthy();
      expect(container.querySelector('.summary-panel__profile-bar')).toBeTruthy();
      expect(container.querySelector('.summary-panel__profile-legend')).toBeTruthy();
      expect(container.querySelector('.summary-panel__profile-legend-item')).toBeTruthy();
      expect(container.querySelector('.summary-panel__profile-legend-color')).toBeTruthy();
      expect(container.querySelector('.summary-panel__profile-total')).toBeTruthy();
    });

    it('should start collapsed', () => {
      view.render(
        defaultRenderOptions({
          foundationCount: 5,
          optionalCount: 5,
          totalActive: 10,
          foundationPercentage: 50,
          optionalPercentage: 50,
          profile: 'balanced',
        })
      );

      // Find the profile section by aria-label to ensure we get the right section
      const profileSection = container.querySelector(
        '[aria-label="Configuration profile"]'
      );
      const header = profileSection.querySelector('.summary-panel__section-header');
      const content = profileSection.querySelector('.summary-panel__section-content');

      expect(header.getAttribute('aria-expanded')).toBe('false');
      expect(
        content.classList.contains('summary-panel__section-content--collapsed')
      ).toBe(true);
    });

    it('should toggle on header click', () => {
      view.render(
        defaultRenderOptions({
          foundationCount: 5,
          optionalCount: 5,
          totalActive: 10,
          foundationPercentage: 50,
          optionalPercentage: 50,
          profile: 'balanced',
        })
      );

      // Find the profile section by aria-label
      const profileSection = container.querySelector(
        '[aria-label="Configuration profile"]'
      );
      const header = profileSection.querySelector('.summary-panel__section-header');
      const content = profileSection.querySelector('.summary-panel__section-content');

      // Initially collapsed
      expect(header.getAttribute('aria-expanded')).toBe('false');
      expect(
        content.classList.contains('summary-panel__section-content--collapsed')
      ).toBe(true);

      // Click to expand
      header.click();

      expect(header.getAttribute('aria-expanded')).toBe('true');
      expect(
        content.classList.contains('summary-panel__section-content--collapsed')
      ).toBe(false);

      // Click to collapse again
      header.click();

      expect(header.getAttribute('aria-expanded')).toBe('false');
      expect(
        content.classList.contains('summary-panel__section-content--collapsed')
      ).toBe(true);
    });

    it('should hide section when profileRatio is null', () => {
      view.render({
        loadOrder: [],
        activeCount: 0,
        explicitCount: 0,
        dependencyCount: 0,
        hotspots: [],
        healthStatus: {
          hasCircularDeps: false,
          missingDeps: [],
          loadOrderValid: true,
          warnings: [],
          errors: [],
        },
        depthAnalysis: null,
        footprintAnalysis: null,
        profileRatio: null,
        hasUnsavedChanges: false,
        isSaving: false,
        isLoading: false,
      });

      // Find the profile section by aria-label
      const profileSection = container.querySelector(
        '[aria-label="Configuration profile"]'
      );
      expect(profileSection).toBeTruthy();
      expect(profileSection.hidden).toBe(true);
    });

    it('should handle unknown profile gracefully', () => {
      view.render(
        defaultRenderOptions({
          foundationCount: 5,
          optionalCount: 5,
          totalActive: 10,
          foundationPercentage: 50,
          optionalPercentage: 50,
          profile: 'unknown-profile-type',
        })
      );

      const badge = container.querySelector('.summary-panel__profile-badge');
      expect(badge).toBeTruthy();
      // Should fall back to using the raw profile value
      expect(badge.textContent).toBe('unknown-profile-type');
    });
  });

  describe('Fragility Warnings Section', () => {
    const renderWithFragility = (fragilityAnalysis) => {
      view.render({
        loadOrder: ['core'],
        activeCount: 1,
        explicitCount: 1,
        dependencyCount: 0,
        hotspots: [],
        healthStatus: null,
        depthAnalysis: null,
        footprintAnalysis: null,
        profileRatio: null,
        fragilityAnalysis,
        hasUnsavedChanges: false,
        isSaving: false,
        isLoading: false,
      });
    };

    it('should display success message when no fragile deps', () => {
      renderWithFragility({
        atRiskMods: [],
        totalAtRisk: 0,
        percentageOfDeps: 0,
      });

      const successMessage = container.querySelector('.summary-panel__success');
      expect(successMessage).toBeTruthy();
      expect(successMessage.textContent).toBe('No fragile dependencies detected');
    });

    it('should display count and percentage of at-risk mods', () => {
      renderWithFragility({
        atRiskMods: [
          { modId: 'anatomy', singleDependent: 'clothing', status: 'dependency' },
          { modId: 'core', singleDependent: 'anatomy', status: 'core' },
        ],
        totalAtRisk: 2,
        percentageOfDeps: 40,
      });

      const count = container.querySelector('.summary-panel__fragility-count');
      const label = container.querySelector('.summary-panel__fragility-label');

      expect(count.textContent).toBe('2');
      expect(label.textContent).toContain('40%');
    });

    it('should display at-risk mods with their single dependent', () => {
      renderWithFragility({
        atRiskMods: [
          { modId: 'anatomy', singleDependent: 'clothing', status: 'dependency' },
        ],
        totalAtRisk: 1,
        percentageOfDeps: 25,
      });

      const items = container.querySelectorAll('.summary-panel__fragility-item');
      expect(items).toHaveLength(1);

      const modName = items[0].querySelector('.summary-panel__fragility-mod');
      const dependent = items[0].querySelector(
        '.summary-panel__fragility-dependent'
      );

      expect(modName.textContent).toBe('anatomy');
      expect(dependent.textContent).toContain('clothing');
    });

    it('should show correct badge for core status', () => {
      renderWithFragility({
        atRiskMods: [
          { modId: 'core', singleDependent: 'anatomy', status: 'core' },
        ],
        totalAtRisk: 1,
        percentageOfDeps: 50,
      });

      const badge = container.querySelector('.summary-panel__fragility-badge');
      expect(badge.textContent).toBe('core');
      expect(
        badge.classList.contains('summary-panel__fragility-badge--core')
      ).toBe(true);
    });

    it('should show correct badge for dependency status', () => {
      renderWithFragility({
        atRiskMods: [
          { modId: 'anatomy', singleDependent: 'clothing', status: 'dependency' },
        ],
        totalAtRisk: 1,
        percentageOfDeps: 25,
      });

      const badge = container.querySelector('.summary-panel__fragility-badge');
      expect(badge.textContent).toBe('dep');
      expect(
        badge.classList.contains('summary-panel__fragility-badge--dependency')
      ).toBe(true);
    });

    it('should include warning icon in header when risks exist', () => {
      renderWithFragility({
        atRiskMods: [
          { modId: 'anatomy', singleDependent: 'clothing', status: 'dependency' },
        ],
        totalAtRisk: 1,
        percentageOfDeps: 25,
      });

      const headers = container.querySelectorAll('.summary-panel__section-header');
      const fragilityHeader = Array.from(headers).find((h) =>
        h.textContent.includes('Fragility')
      );

      expect(fragilityHeader.textContent).toContain('⚠️');
    });

    it('should not include warning icon when no risks', () => {
      renderWithFragility({
        atRiskMods: [],
        totalAtRisk: 0,
        percentageOfDeps: 0,
      });

      const headers = container.querySelectorAll('.summary-panel__section-header');
      const fragilityHeader = Array.from(headers).find((h) =>
        h.textContent.includes('Fragility')
      );

      expect(fragilityHeader.textContent).not.toContain('⚠️');
    });

    it('should start collapsed', () => {
      renderWithFragility({
        atRiskMods: [
          { modId: 'anatomy', singleDependent: 'clothing', status: 'dependency' },
        ],
        totalAtRisk: 1,
        percentageOfDeps: 25,
      });

      const fragilitySection = container.querySelector(
        '[aria-label="Fragility warnings"]'
      );
      const header = fragilitySection.querySelector(
        '.summary-panel__section-header'
      );

      expect(header.getAttribute('aria-expanded')).toBe('false');
    });

    it('should toggle section on header click', () => {
      renderWithFragility({
        atRiskMods: [
          { modId: 'anatomy', singleDependent: 'clothing', status: 'dependency' },
        ],
        totalAtRisk: 1,
        percentageOfDeps: 25,
      });

      const fragilitySection = container.querySelector(
        '[aria-label="Fragility warnings"]'
      );
      const header = fragilitySection.querySelector(
        '.summary-panel__section-header'
      );
      const content = fragilitySection.querySelector(
        '.summary-panel__section-content'
      );

      // Initially collapsed
      expect(header.getAttribute('aria-expanded')).toBe('false');
      expect(
        content.classList.contains('summary-panel__section-content--collapsed')
      ).toBe(true);

      // Click to expand
      header.click();

      expect(header.getAttribute('aria-expanded')).toBe('true');
      expect(
        content.classList.contains('summary-panel__section-content--collapsed')
      ).toBe(false);
    });

    it('should display explanation text', () => {
      renderWithFragility({
        atRiskMods: [
          { modId: 'anatomy', singleDependent: 'clothing', status: 'dependency' },
        ],
        totalAtRisk: 1,
        percentageOfDeps: 25,
      });

      const explanation = container.querySelector(
        '.summary-panel__fragility-explanation'
      );
      expect(explanation).toBeTruthy();
      expect(explanation.textContent).toContain('only one dependent');
    });

    it('should hide section when fragilityAnalysis is null', () => {
      renderWithFragility(null);

      const fragilitySection = container.querySelector(
        '[aria-label="Fragility warnings"]'
      );
      expect(fragilitySection.hidden).toBe(true);
    });

    it('should have correct BEM class structure', () => {
      renderWithFragility({
        atRiskMods: [
          { modId: 'anatomy', singleDependent: 'clothing', status: 'dependency' },
        ],
        totalAtRisk: 1,
        percentageOfDeps: 25,
      });

      expect(
        container.querySelector('.summary-panel__fragility-stats')
      ).toBeTruthy();
      expect(
        container.querySelector('.summary-panel__fragility-count')
      ).toBeTruthy();
      expect(
        container.querySelector('.summary-panel__fragility-list')
      ).toBeTruthy();
      expect(
        container.querySelector('.summary-panel__fragility-item')
      ).toBeTruthy();
      expect(
        container.querySelector('.summary-panel__fragility-badge')
      ).toBeTruthy();
      expect(
        container.querySelector('.summary-panel__fragility-mod')
      ).toBeTruthy();
      expect(
        container.querySelector('.summary-panel__fragility-dependent')
      ).toBeTruthy();
    });

    it('should escape HTML in mod IDs to prevent XSS', () => {
      renderWithFragility({
        atRiskMods: [
          {
            modId: '<script>alert("xss")</script>',
            singleDependent: '<img onerror="alert(1)">',
            status: 'dependency',
          },
        ],
        totalAtRisk: 1,
        percentageOfDeps: 25,
      });

      const modName = container.querySelector('.summary-panel__fragility-mod');
      const dependent = container.querySelector(
        '.summary-panel__fragility-dependent'
      );

      // Should contain escaped text, not raw HTML
      expect(modName.textContent).toContain('<script>');
      expect(dependent.textContent).toContain('<img');
      // Should not have created actual script or img elements
      expect(container.querySelector('script')).toBeFalsy();
      expect(
        container.querySelector('.summary-panel__fragility-dependent img')
      ).toBeFalsy();
    });
  });
});
