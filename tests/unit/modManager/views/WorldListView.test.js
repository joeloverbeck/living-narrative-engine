/**
 * @file Unit tests for WorldListView
 * @see src/modManager/views/WorldListView.js
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { WorldListView } from '../../../../src/modManager/views/WorldListView.js';

describe('WorldListView', () => {
  /** @type {HTMLElement} */
  let container;
  /** @type {{debug: jest.Mock}} */
  let mockLogger;
  /** @type {jest.Mock} */
  let onWorldSelect;
  /** @type {WorldListView} */
  let view;

  const createWorlds = () => [
    {
      id: 'core:core',
      modId: 'core',
      worldId: 'core',
      name: 'Core World',
      description: 'The main adventure world',
    },
    {
      id: 'fantasy:fantasy',
      modId: 'fantasy',
      worldId: 'fantasy',
      name: 'Fantasy Realm',
      description: 'A magical fantasy world',
    },
  ];

  const createSingleModWorlds = () => [
    {
      id: 'core:core',
      modId: 'core',
      worldId: 'core',
      name: 'Core World',
      description: 'The main adventure world',
    },
  ];

  beforeEach(() => {
    document.body.innerHTML = '<div id="root"></div>';
    container = document.getElementById('root');

    mockLogger = { debug: jest.fn() };
    onWorldSelect = jest.fn();

    view = new WorldListView({
      container,
      logger: mockLogger,
      onWorldSelect,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor validation', () => {
    it('throws when container is missing', () => {
      expect(() => {
        new WorldListView({
          container: null,
          logger: mockLogger,
          onWorldSelect,
        });
      }).toThrow('WorldListView: container is required');
    });

    it('throws when logger is missing', () => {
      expect(() => {
        new WorldListView({
          container,
          logger: null,
          onWorldSelect,
        });
      }).toThrow('WorldListView: logger is required');
    });

    it('throws when onWorldSelect is missing', () => {
      expect(() => {
        new WorldListView({
          container,
          logger: mockLogger,
          onWorldSelect: null,
        });
      }).toThrow('WorldListView: onWorldSelect is required');
    });
  });

  describe('render', () => {
    it('displays loading state when isLoading is true', () => {
      view.render({
        worlds: createWorlds(),
        selectedWorld: null,
        isLoading: true,
      });

      expect(container.querySelector('.world-list__loading')?.hidden).toBe(
        false
      );
      expect(container.querySelector('.world-list')?.hidden).toBe(true);
      expect(container.querySelector('.world-list__empty')?.hidden).toBe(true);
    });

    it('displays empty state when no worlds', () => {
      view.render({
        worlds: [],
        selectedWorld: null,
        isLoading: false,
      });

      expect(container.querySelector('.world-list__empty')?.hidden).toBe(false);
      expect(container.querySelector('.world-list')?.hidden).toBe(true);
    });

    it('creates radio options for all worlds', () => {
      const worlds = createWorlds();

      view.render({
        worlds,
        selectedWorld: null,
        isLoading: false,
      });

      const options = container.querySelectorAll('.world-option');
      expect(options.length).toBe(worlds.length);

      const radios = container.querySelectorAll('input[type="radio"]');
      expect(radios.length).toBe(worlds.length);
    });

    it('groups worlds by mod when multiple mods have worlds', () => {
      view.render({
        worlds: createWorlds(),
        selectedWorld: null,
        isLoading: false,
      });

      const headers = container.querySelectorAll('.world-group-header');
      expect(headers.length).toBe(2); // Two mods: core and fantasy
      expect(headers[0].textContent).toBe('Core');
      expect(headers[1].textContent).toBe('Fantasy');
    });

    it('does not show group headers for single mod', () => {
      view.render({
        worlds: createSingleModWorlds(),
        selectedWorld: null,
        isLoading: false,
      });

      const headers = container.querySelectorAll('.world-group-header');
      expect(headers.length).toBe(0);
    });

    it('selects the specified world', () => {
      view.render({
        worlds: createWorlds(),
        selectedWorld: 'fantasy:fantasy',
        isLoading: false,
      });

      const selectedOption = container.querySelector('.world-option.selected');
      expect(selectedOption).not.toBeNull();
      expect(selectedOption.getAttribute('data-world-id')).toBe(
        'fantasy:fantasy'
      );

      const checkedRadio = /** @type {HTMLInputElement} */ (
        container.querySelector('input[type="radio"]:checked')
      );
      expect(checkedRadio.value).toBe('fantasy:fantasy');
    });

    it('updates details panel with selected world info', () => {
      view.render({
        worlds: createWorlds(),
        selectedWorld: 'core:core',
        isLoading: false,
      });

      const details = container.querySelector('.world-details');
      expect(details.innerHTML).toContain('Core World');
      expect(details.innerHTML).toContain('The main adventure world');
      expect(details.innerHTML).toContain('core');
    });

    it('shows hint when no world selected', () => {
      view.render({
        worlds: createWorlds(),
        selectedWorld: null,
        isLoading: false,
      });

      const details = container.querySelector('.world-details');
      expect(details.innerHTML).toContain(
        'Select a world to begin your adventure'
      );
    });

    it('shows error when selected world not found', () => {
      view.render({
        worlds: createWorlds(),
        selectedWorld: 'nonexistent:world',
        isLoading: false,
      });

      const details = container.querySelector('.world-details');
      expect(details.innerHTML).toContain('Selected world not found');
    });
  });

  describe('event handling', () => {
    it('change event triggers onWorldSelect callback', () => {
      view.render({
        worlds: createWorlds(),
        selectedWorld: null,
        isLoading: false,
      });

      const radio = container.querySelector(
        'input[type="radio"][value="fantasy:fantasy"]'
      );
      radio.checked = true;
      radio.dispatchEvent(new Event('change', { bubbles: true }));

      expect(onWorldSelect).toHaveBeenCalledWith('fantasy:fantasy');
    });

    it('updates selected class on change', () => {
      view.render({
        worlds: createWorlds(),
        selectedWorld: 'core:core',
        isLoading: false,
      });

      // Initially core is selected
      expect(
        container
          .querySelector('[data-world-id="core:core"]')
          .classList.contains('selected')
      ).toBe(true);

      // Trigger change to fantasy
      const radio = container.querySelector(
        'input[type="radio"][value="fantasy:fantasy"]'
      );
      radio.checked = true;
      radio.dispatchEvent(new Event('change', { bubbles: true }));

      // Now fantasy should be selected, core should not
      expect(
        container
          .querySelector('[data-world-id="fantasy:fantasy"]')
          .classList.contains('selected')
      ).toBe(true);
      expect(
        container
          .querySelector('[data-world-id="core:core"]')
          .classList.contains('selected')
      ).toBe(false);
    });

    it('keyboard Enter triggers world selection', () => {
      view.render({
        worlds: createWorlds(),
        selectedWorld: null,
        isLoading: false,
      });

      const option = container.querySelector('[data-world-id="fantasy:fantasy"]');
      option.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
      );

      expect(onWorldSelect).toHaveBeenCalledWith('fantasy:fantasy');
    });

    it('keyboard Space triggers world selection', () => {
      view.render({
        worlds: createWorlds(),
        selectedWorld: null,
        isLoading: false,
      });

      const option = container.querySelector('[data-world-id="core:core"]');
      option.dispatchEvent(
        new KeyboardEvent('keydown', { key: ' ', bubbles: true })
      );

      expect(onWorldSelect).toHaveBeenCalledWith('core:core');
    });
  });

  describe('setValidationState', () => {
    it('adds error class and aria-invalid', () => {
      view.render({
        worlds: createWorlds(),
        selectedWorld: null,
        isLoading: false,
      });

      view.setValidationState('error');

      const list = container.querySelector('.world-list');
      expect(list.classList.contains('world-list--error')).toBe(true);
      expect(list.getAttribute('aria-invalid')).toBe('true');
    });

    it('adds success class', () => {
      view.render({
        worlds: createWorlds(),
        selectedWorld: 'core:core',
        isLoading: false,
      });

      view.setValidationState('success');

      const list = container.querySelector('.world-list');
      expect(list.classList.contains('world-list--success')).toBe(true);
      expect(list.hasAttribute('aria-invalid')).toBe(false);
    });

    it('removes classes for none', () => {
      view.render({
        worlds: createWorlds(),
        selectedWorld: null,
        isLoading: false,
      });

      // First set error
      view.setValidationState('error');
      expect(
        container.querySelector('.world-list').classList.contains('world-list--error')
      ).toBe(true);

      // Then clear
      view.setValidationState('none');

      const list = container.querySelector('.world-list');
      expect(list.classList.contains('world-list--error')).toBe(false);
      expect(list.classList.contains('world-list--success')).toBe(false);
      expect(list.hasAttribute('aria-invalid')).toBe(false);
    });
  });

  describe('getSelectedWorld', () => {
    it('returns current selection', () => {
      view.render({
        worlds: createWorlds(),
        selectedWorld: 'fantasy:fantasy',
        isLoading: false,
      });

      expect(view.getSelectedWorld()).toBe('fantasy:fantasy');
    });

    it('returns null when nothing selected', () => {
      view.render({
        worlds: createWorlds(),
        selectedWorld: null,
        isLoading: false,
      });

      expect(view.getSelectedWorld()).toBeNull();
    });
  });

  describe('destroy', () => {
    it('cleans up container', () => {
      view.render({
        worlds: createWorlds(),
        selectedWorld: 'core:core',
        isLoading: false,
      });

      expect(container.innerHTML).not.toBe('');

      view.destroy();

      expect(container.innerHTML).toBe('');
    });
  });

  describe('accessibility', () => {
    it('has proper ARIA attributes on list', () => {
      view.render({
        worlds: createWorlds(),
        selectedWorld: null,
        isLoading: false,
      });

      const list = container.querySelector('.world-list');
      expect(list.getAttribute('role')).toBe('radiogroup');
      expect(list.getAttribute('aria-label')).toBe('Available worlds');
    });

    it('has aria-live on details panel', () => {
      const details = container.querySelector('.world-details');
      expect(details.getAttribute('aria-live')).toBe('polite');
    });

    it('has aria-describedby on radio buttons', () => {
      view.render({
        worlds: createWorlds(),
        selectedWorld: null,
        isLoading: false,
      });

      const radios = container.querySelectorAll('input[type="radio"]');
      for (const radio of radios) {
        expect(radio.getAttribute('aria-describedby')).toBe('world-details');
      }
    });
  });

  describe('XSS prevention', () => {
    it('escapes HTML in world names', () => {
      const maliciousWorlds = [
        {
          id: 'test:xss',
          modId: 'test',
          worldId: 'xss',
          name: '<script>alert("xss")</script>',
          description: 'Test world',
        },
      ];

      view.render({
        worlds: maliciousWorlds,
        selectedWorld: 'test:xss',
        isLoading: false,
      });

      const details = container.querySelector('.world-details');
      expect(details.innerHTML).not.toContain('<script>');
      expect(details.innerHTML).toContain('&lt;script&gt;');
    });

    it('escapes HTML in descriptions', () => {
      const maliciousWorlds = [
        {
          id: 'test:xss',
          modId: 'test',
          worldId: 'xss',
          name: 'Test World',
          description: '<img src="x" onerror="alert(1)">',
        },
      ];

      view.render({
        worlds: maliciousWorlds,
        selectedWorld: 'test:xss',
        isLoading: false,
      });

      const details = container.querySelector('.world-details');
      // The key is that <img is escaped to &lt;img - this prevents the browser
      // from parsing it as an actual img element, so onerror cannot execute
      expect(details.innerHTML).not.toContain('<img');
      expect(details.innerHTML).toContain('&lt;img');
    });
  });
});
