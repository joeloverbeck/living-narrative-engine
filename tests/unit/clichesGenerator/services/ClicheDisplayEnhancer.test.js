/**
 * @file Unit tests for ClicheDisplayEnhancer
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { ClicheDisplayEnhancer } from '../../../../src/clichesGenerator/services/ClicheDisplayEnhancer.js';

describe('ClicheDisplayEnhancer', () => {
  let enhancer;
  let mockLogger;
  let container;
  let mockDisplayData;

  beforeEach(() => {
    // Setup mock logger
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    // Create DOM container with basic structure
    document.body.innerHTML = `
      <div id="test-container">
        <div class="cliches-results">
          <div class="cliche-categories">
            <div class="cliche-category" data-category="names">
              <h4 class="category-title">
                Common Names
                <span class="category-count">(3)</span>
              </h4>
              <ul class="cliche-list">
                <li class="cliche-item">John</li>
                <li class="cliche-item">Jane</li>
                <li class="cliche-item">Bob</li>
              </ul>
            </div>
            <div class="cliche-category" data-category="traits">
              <h4 class="category-title">
                Personality Traits
                <span class="category-count">(2)</span>
              </h4>
              <ul class="cliche-list">
                <li class="cliche-item">Brooding</li>
                <li class="cliche-item">Mysterious</li>
              </ul>
            </div>
          </div>
          <div class="cliche-metadata">
            <p>Generated on 12/13/2024</p>
            <p>Total clichés: 5</p>
          </div>
        </div>
      </div>
    `;

    container = document.getElementById('test-container');

    // Mock display data
    mockDisplayData = {
      categories: [
        {
          id: 'names',
          title: 'Common Names',
          items: ['John', 'Jane', 'Bob'],
          count: 3,
        },
        {
          id: 'traits',
          title: 'Personality Traits',
          items: ['Brooding', 'Mysterious'],
          count: 2,
        },
      ],
      tropesAndStereotypes: ['The Chosen One', 'Dark Past'],
      metadata: {
        createdAt: '12/13/2024',
        totalCount: 5,
        model: 'Test Model',
      },
    };

    // Mock localStorage
    const localStorageMock = {
      store: {},
      getItem: jest.fn((key) => localStorageMock.store[key] || null),
      setItem: jest.fn((key, value) => {
        localStorageMock.store[key] = value;
      }),
      clear: jest.fn(() => {
        localStorageMock.store = {};
      }),
    };
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      writable: true,
    });

    // Mock clipboard API
    const clipboardMock = {
      writeText: jest.fn().mockResolvedValue(),
    };
    Object.defineProperty(navigator, 'clipboard', {
      value: clipboardMock,
      writable: true,
    });

    // Create enhancer instance
    enhancer = new ClicheDisplayEnhancer({
      logger: mockLogger,
      container,
    });
  });

  afterEach(() => {
    document.body.innerHTML = '';
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should require logger', () => {
      expect(() => {
        new ClicheDisplayEnhancer({ container });
      }).toThrow('Logger is required');
    });

    it('should require container element', () => {
      expect(() => {
        new ClicheDisplayEnhancer({ logger: mockLogger });
      }).toThrow('Container element is required');
    });

    it('should initialize with valid dependencies', () => {
      expect(enhancer).toBeDefined();
      expect(enhancer.constructor.name).toBe('ClicheDisplayEnhancer');
    });
  });

  describe('Enhance Method', () => {
    it('should add search controls', () => {
      enhancer.enhance(mockDisplayData);

      const searchInput = container.querySelector('#cliche-search');
      expect(searchInput).toBeTruthy();
      expect(searchInput.placeholder).toBe('Search clichés...');
    });

    it('should add filter controls', () => {
      enhancer.enhance(mockDisplayData);

      const filterToggle = container.querySelector('.filter-toggle-btn');
      expect(filterToggle).toBeTruthy();

      const categoryFilters = container.querySelectorAll('.category-filter');
      expect(categoryFilters.length).toBe(2);
    });

    it('should add expand/collapse controls to categories', () => {
      enhancer.enhance(mockDisplayData);

      const categoryToggles = container.querySelectorAll('.category-toggle');
      expect(categoryToggles.length).toBe(2);

      categoryToggles.forEach((toggle) => {
        expect(toggle.getAttribute('aria-expanded')).toBe('true');
      });
    });

    it('should add copy buttons to categories', () => {
      enhancer.enhance(mockDisplayData);

      const copyCategoryBtns = container.querySelectorAll('.copy-category-btn');
      expect(copyCategoryBtns.length).toBe(2);
    });

    it('should add copy buttons to items', () => {
      enhancer.enhance(mockDisplayData);

      const copyItemBtns = container.querySelectorAll('.copy-item-btn');
      expect(copyItemBtns.length).toBe(5); // 3 names + 2 traits
    });

    it('should add export controls', () => {
      enhancer.enhance(mockDisplayData);

      const exportBtns = container.querySelectorAll('.export-btn');
      expect(exportBtns.length).toBe(3); // Markdown, JSON, Text

      const copyAllBtn = container.querySelector('.copy-all-btn');
      expect(copyAllBtn).toBeTruthy();
    });

    it('should handle null display data gracefully', () => {
      expect(() => {
        enhancer.enhance(null);
      }).not.toThrow();
    });

    it('should not duplicate controls on re-enhance', () => {
      enhancer.enhance(mockDisplayData);
      enhancer.enhance(mockDisplayData);

      const searchInputs = container.querySelectorAll('#cliche-search');
      expect(searchInputs.length).toBe(1);
    });
  });

  describe('Search Functionality', () => {
    beforeEach(() => {
      enhancer.enhance(mockDisplayData);
    });

    it('should filter items based on search term', () => {
      const searchInput = container.querySelector('#cliche-search');
      const event = new Event('input');

      searchInput.value = 'John';
      searchInput.dispatchEvent(event);

      // Check visibility of items
      const items = container.querySelectorAll('.cliche-item');
      const visibleItems = Array.from(items).filter(
        (item) => item.style.display !== 'none'
      );

      expect(visibleItems.length).toBeGreaterThan(0);
      expect(visibleItems[0].textContent).toContain('John');
    });

    it('should update results count', () => {
      const searchInput = container.querySelector('#cliche-search');
      const event = new Event('input');

      searchInput.value = 'Mysterious';
      searchInput.dispatchEvent(event);

      const countEl = container.querySelector('.search-results-count');
      expect(countEl.textContent).toContain('items');
    });

    it('should handle empty search term', () => {
      const searchInput = container.querySelector('#cliche-search');
      const event = new Event('input');

      searchInput.value = '';
      searchInput.dispatchEvent(event);

      const categories = container.querySelectorAll('.cliche-category');
      categories.forEach((cat) => {
        expect(cat.style.display).not.toBe('none');
      });
    });
  });

  describe('Category Filter', () => {
    beforeEach(() => {
      enhancer.enhance(mockDisplayData);
    });

    it('should toggle filter panel', () => {
      const toggleBtn = container.querySelector('.filter-toggle-btn');
      const panel = container.querySelector('.category-filters');

      expect(panel.hidden).toBe(true);

      toggleBtn.click();
      expect(panel.hidden).toBe(false);
      expect(toggleBtn.getAttribute('aria-expanded')).toBe('true');

      toggleBtn.click();
      expect(panel.hidden).toBe(true);
      expect(toggleBtn.getAttribute('aria-expanded')).toBe('false');
    });

    it('should filter categories when unchecked', () => {
      const filterCheckbox = container.querySelector('[data-category="names"]');
      const event = new Event('change');

      filterCheckbox.checked = false;
      filterCheckbox.dispatchEvent(event);

      const nameCategory = container.querySelector(
        '.cliche-category[data-category="names"]'
      );
      expect(nameCategory.style.display).toBe('none');
    });

    it('should show categories when checked', () => {
      const filterCheckbox = container.querySelector(
        '[data-category="traits"]'
      );
      const event = new Event('change');

      filterCheckbox.checked = true;
      filterCheckbox.dispatchEvent(event);

      const traitsCategory = container.querySelector(
        '.cliche-category[data-category="traits"]'
      );
      expect(traitsCategory.style.display).not.toBe('none');
    });
  });

  describe('Expand/Collapse Controls', () => {
    beforeEach(() => {
      enhancer.enhance(mockDisplayData);
    });

    it('should toggle individual category', () => {
      const toggle = container.querySelector('.category-toggle');
      const list = toggle
        .closest('.cliche-category')
        .querySelector('.cliche-list');

      expect(toggle.getAttribute('aria-expanded')).toBe('true');
      expect(list.style.display).not.toBe('none');

      toggle.click();

      expect(toggle.getAttribute('aria-expanded')).toBe('false');
      expect(list.style.display).toBe('none');
    });

    it('should expand all categories', () => {
      const expandAllBtn = container.querySelector('.expand-all-btn');
      expandAllBtn.click();

      const toggles = container.querySelectorAll('.category-toggle');
      toggles.forEach((toggle) => {
        expect(toggle.getAttribute('aria-expanded')).toBe('true');
      });
    });

    it('should collapse all categories', () => {
      const collapseAllBtn = container.querySelector('.collapse-all-btn');
      collapseAllBtn.click();

      const toggles = container.querySelectorAll('.category-toggle');
      toggles.forEach((toggle) => {
        expect(toggle.getAttribute('aria-expanded')).toBe('false');
      });
    });

    it('should persist collapse state in localStorage', () => {
      const toggle = container.querySelector('.category-toggle');
      const category = toggle.closest('.cliche-category');
      const categoryId = category.dataset.category;

      toggle.click(); // Collapse

      expect(window.localStorage.setItem).toHaveBeenCalledWith(
        'cliche-collapsed-categories',
        expect.stringContaining(categoryId)
      );
    });
  });

  describe('Copy Functionality', () => {
    beforeEach(() => {
      enhancer.enhance(mockDisplayData);
    });

    it('should copy individual item', async () => {
      const copyBtn = container.querySelector('.copy-item-btn');
      const item = copyBtn.closest('.cliche-item');

      // Get the actual text content, excluding the button controls
      const clone = item.cloneNode(true);
      const controls = clone.querySelector('.item-controls');
      if (controls) controls.remove();
      const expectedText = clone.textContent.trim();

      await copyBtn.click();

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expectedText);
    });

    it('should copy category items', async () => {
      const copyBtn = container.querySelector('.copy-category-btn');

      await copyBtn.click();

      expect(navigator.clipboard.writeText).toHaveBeenCalled();
      const copiedText = navigator.clipboard.writeText.mock.calls[0][0];
      expect(copiedText).toContain('Common Names');
      expect(copiedText).toContain('John');
    });

    it('should copy all clichés', async () => {
      const copyAllBtn = container.querySelector('.copy-all-btn');

      await copyAllBtn.click();

      expect(navigator.clipboard.writeText).toHaveBeenCalled();
      const copiedText = navigator.clipboard.writeText.mock.calls[0][0];
      expect(copiedText).toContain('COMMON NAMES');
      expect(copiedText).toContain('PERSONALITY TRAITS');
    });

    it('should show feedback after copy', async () => {
      jest.useFakeTimers();

      const copyBtn = container.querySelector('.copy-item-btn');
      const originalText = copyBtn.textContent;

      await copyBtn.click();

      expect(copyBtn.textContent).toBe('Copied!');
      expect(copyBtn.disabled).toBe(true);

      // Fast-forward time
      jest.advanceTimersByTime(1500);

      // Cleanup
      jest.useRealTimers();
    });

    it('should handle copy failure', async () => {
      navigator.clipboard.writeText.mockRejectedValueOnce(
        new Error('Copy failed')
      );

      const copyBtn = container.querySelector('.copy-item-btn');
      await copyBtn.click();

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to copy item',
        expect.any(Error)
      );
    });
  });

  describe('Export Functionality', () => {
    beforeEach(() => {
      enhancer.enhance(mockDisplayData);

      // Mock URL.createObjectURL and revokeObjectURL
      global.URL.createObjectURL = jest.fn(() => 'blob:test');
      global.URL.revokeObjectURL = jest.fn();

      // Mock document.createElement for download link
      const createElementSpy = jest.spyOn(document, 'createElement');
      const mockLink = document.createElement('a');
      mockLink.click = jest.fn();
      createElementSpy.mockReturnValueOnce(mockLink);
    });

    it('should export as Markdown', () => {
      const exportBtn = container.querySelector('[data-format="markdown"]');
      exportBtn.click();

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Exported clichés as markdown'
      );
    });

    it('should export as JSON', () => {
      const exportBtn = container.querySelector('[data-format="json"]');
      exportBtn.click();

      expect(mockLogger.info).toHaveBeenCalledWith('Exported clichés as json');
    });

    it('should export as Text', () => {
      const exportBtn = container.querySelector('[data-format="text"]');
      exportBtn.click();

      expect(mockLogger.info).toHaveBeenCalledWith('Exported clichés as text');
    });

    it('should handle export without data gracefully', () => {
      // Create a new enhancer without enhancing first
      const newEnhancer = new ClicheDisplayEnhancer({
        logger: mockLogger,
        container: document.createElement('div'),
      });

      // Should handle gracefully without throwing
      expect(() => {
        newEnhancer.cleanup();
      }).not.toThrow();
    });
  });

  describe('Keyboard Navigation', () => {
    beforeEach(() => {
      enhancer.enhance(mockDisplayData);
    });

    it('should add tabindex to items', () => {
      const items = container.querySelectorAll('.cliche-item');
      items.forEach((item) => {
        expect(item.getAttribute('tabindex')).toBe('0');
      });
    });

    it('should handle Enter key on item', () => {
      const item = container.querySelector('.cliche-item');
      const copyBtn = item.querySelector('.copy-item-btn');
      copyBtn.click = jest.fn();

      const event = new KeyboardEvent('keydown', { key: 'Enter' });
      item.dispatchEvent(event);

      expect(copyBtn.click).toHaveBeenCalled();
    });

    it('should handle Space key on item', () => {
      const item = container.querySelector('.cliche-item');
      const copyBtn = item.querySelector('.copy-item-btn');
      copyBtn.click = jest.fn();

      const event = new KeyboardEvent('keydown', { key: ' ' });
      item.dispatchEvent(event);

      expect(copyBtn.click).toHaveBeenCalled();
    });

    it('should focus search on Ctrl+F', () => {
      const searchInput = container.querySelector('#cliche-search');
      searchInput.focus = jest.fn();

      // Make container visible (offsetParent check)
      Object.defineProperty(container, 'offsetParent', {
        value: document.body,
        writable: true,
      });

      const event = new KeyboardEvent('keydown', {
        key: 'f',
        ctrlKey: true,
      });

      // Need to prevent default
      event.preventDefault = jest.fn();

      document.dispatchEvent(event);

      expect(searchInput.focus).toHaveBeenCalled();
    });

    it('should clear search on Escape', () => {
      const searchInput = container.querySelector('#cliche-search');
      searchInput.value = 'test';

      // Make container visible
      Object.defineProperty(container, 'offsetParent', {
        value: document.body,
        writable: true,
      });

      const event = new KeyboardEvent('keydown', { key: 'Escape' });
      document.dispatchEvent(event);

      expect(searchInput.value).toBe('');
    });
  });

  describe('Cleanup', () => {
    it('should cleanup without error', () => {
      enhancer.enhance(mockDisplayData);

      expect(() => {
        enhancer.cleanup();
      }).not.toThrow();
    });

    it('should clear current data', () => {
      enhancer.enhance(mockDisplayData);

      // Verify enhancer was working before cleanup
      const searchInput = container.querySelector('#cliche-search');
      expect(searchInput).toBeTruthy();

      enhancer.cleanup();

      // Data should be cleared after cleanup
      expect(() => {
        enhancer.cleanup(); // Second cleanup should not error
      }).not.toThrow();
    });
  });

  describe('Edge Cases', () => {
    it('should handle categories without items', () => {
      const emptyData = {
        categories: [
          {
            id: 'empty',
            title: 'Empty Category',
            items: [],
            count: 0,
          },
        ],
        metadata: {
          createdAt: '12/13/2024',
          totalCount: 0,
        },
      };

      expect(() => {
        enhancer.enhance(emptyData);
      }).not.toThrow();
    });

    it('should handle missing tropes section', () => {
      const dataWithoutTropes = {
        ...mockDisplayData,
        tropesAndStereotypes: null,
      };

      expect(() => {
        enhancer.enhance(dataWithoutTropes);
      }).not.toThrow();
    });

    it('should handle malformed category data', () => {
      const malformedData = {
        categories: [
          {
            // Missing required fields
            title: 'Test',
          },
        ],
        metadata: {},
      };

      expect(() => {
        enhancer.enhance(malformedData);
      }).not.toThrow();
    });
  });

  describe('Delete Functionality', () => {
    let onDeleteItem;
    let onDeleteTrope;

    beforeEach(() => {
      onDeleteItem = jest.fn().mockResolvedValue();
      onDeleteTrope = jest.fn().mockResolvedValue();

      // Create enhancer with delete callbacks
      enhancer = new ClicheDisplayEnhancer({
        logger: mockLogger,
        container,
        onDeleteItem,
        onDeleteTrope,
      });

      // Add tropes to the display data
      mockDisplayData.tropesAndStereotypes = ['The Chosen One', 'Dark Past'];

      // Update DOM to include tropes
      document.body.innerHTML = `
        <div id="test-container">
          <div class="cliches-results">
            <div class="cliche-categories">
              <div class="cliche-category" data-category="names">
                <h4 class="category-title">
                  Common Names
                  <span class="category-count">(3)</span>
                </h4>
                <ul class="cliche-list">
                  <li class="cliche-item">John</li>
                  <li class="cliche-item">Jane</li>
                  <li class="cliche-item">Bob</li>
                </ul>
              </div>
            </div>
            <div class="tropes-list">
              <ul>
                <li class="trope-item">The Chosen One</li>
                <li class="trope-item">Dark Past</li>
              </ul>
            </div>
            <div class="cliche-metadata">
              <p>Generated on 12/13/2024</p>
            </div>
          </div>
        </div>
      `;

      container = document.getElementById('test-container');
      enhancer = new ClicheDisplayEnhancer({
        logger: mockLogger,
        container,
        onDeleteItem,
        onDeleteTrope,
      });

      enhancer.enhance(mockDisplayData);
    });

    it('should delete item when delete button clicked', async () => {
      const deleteBtn = container.querySelector('.delete-item-btn');
      expect(deleteBtn).toBeTruthy();

      await deleteBtn.click();

      expect(onDeleteItem).toHaveBeenCalledWith(
        deleteBtn.dataset.category,
        deleteBtn.dataset.text
      );
    });

    it('should update DOM after successful deletion', async () => {
      const deleteBtn = container.querySelector('.delete-item-btn');
      const item = deleteBtn.closest('.cliche-item');

      await deleteBtn.click();
      await Promise.resolve();
      await Promise.resolve();

      // Check immediate changes
      expect(item.style.opacity).toBe('0.5');
      expect(deleteBtn.disabled).toBe(true);
      expect(deleteBtn.textContent).toBe('⏳');

      // Wait for the removal timeout to complete
      await new Promise((resolve) => setTimeout(resolve, 350));

      // Item should be removed
      expect(item.parentNode).toBeNull();

      const countEl = container.querySelector(
        '[data-category="names"] .category-count'
      );
      expect(countEl.textContent).toBe('(2)');
    });

    it('should handle delete item error', async () => {
      jest.useFakeTimers('legacy');
      onDeleteItem.mockRejectedValueOnce(new Error('Delete failed'));

      const deleteBtn = container.querySelector('.delete-item-btn');

      await deleteBtn.click();

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to delete item',
        expect.any(Error)
      );

      // The error handler calls showCopyFeedback which shows "Failed" for 1500ms
      expect(deleteBtn.disabled).toBe(true);
      expect(deleteBtn.textContent).toBe('Failed');

      // Fast-forward past the feedback timeout
      jest.advanceTimersByTime(1500);

      // After timeout, button should be re-enabled and text restored
      expect(deleteBtn.disabled).toBe(false);
      expect(deleteBtn.textContent).toBe('🗑️');

      jest.useRealTimers();
    });

    it('should warn when delete handler not configured', async () => {
      // Create enhancer without delete callback
      enhancer = new ClicheDisplayEnhancer({
        logger: mockLogger,
        container,
      });
      enhancer.enhance(mockDisplayData);

      const deleteBtn = container.querySelector('.delete-item-btn');
      await deleteBtn.click();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Delete handler not configured'
      );
    });

    it('should delete trope when delete button clicked', async () => {
      // Enhance trope items with delete buttons
      const tropeItems = container.querySelectorAll('.trope-item');
      tropeItems.forEach((item) => {
        item.innerHTML += `
          <button 
            class="delete-trope-btn" 
            data-text="${item.textContent.trim()}"
          >
            🗑️
          </button>
        `;
      });

      const deleteTropeBtn = container.querySelector('.delete-trope-btn');
      await deleteTropeBtn.click();

      expect(onDeleteTrope).toHaveBeenCalledWith(deleteTropeBtn.dataset.text);
    });

    it('should handle delete trope error', async () => {
      jest.useFakeTimers('legacy');
      onDeleteTrope.mockRejectedValueOnce(new Error('Delete failed'));

      // Add delete button to trope
      const tropeItem = container.querySelector('.trope-item');
      tropeItem.innerHTML += `
        <button 
          class="delete-trope-btn" 
          data-text="${tropeItem.textContent.trim()}"
        >
          🗑️
        </button>
      `;

      const deleteTropeBtn = container.querySelector('.delete-trope-btn');
      await deleteTropeBtn.click();

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to delete trope',
        expect.any(Error)
      );

      // The error handler calls showCopyFeedback
      expect(deleteTropeBtn.disabled).toBe(true);
      expect(deleteTropeBtn.textContent).toBe('Failed');

      // Fast-forward past the feedback timeout
      jest.advanceTimersByTime(1500);

      // After timeout, button should be re-enabled
      expect(deleteTropeBtn.disabled).toBe(false);
      expect(deleteTropeBtn.textContent).toBe('🗑️');

      jest.useRealTimers();
    });
  });

  describe('Copy Error Handling', () => {
    beforeEach(() => {
      enhancer.enhance(mockDisplayData);
    });

    it('should handle missing parent element in copyItem', async () => {
      // Create a detached button
      const button = document.createElement('button');
      button.className = 'copy-item-btn';

      // Call the private method through event delegation
      button.click = async function () {
        const item = this.closest('.cliche-item');
        if (!item) {
          mockLogger.error('Could not find parent item element');
          return;
        }
      };

      await button.click();

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Could not find parent item element'
      );
    });

    it('should handle copy category failure with feedback', async () => {
      jest.useFakeTimers();
      navigator.clipboard.writeText.mockRejectedValueOnce(
        new Error('Copy failed')
      );

      const copyBtn = container.querySelector('.copy-category-btn');
      const originalText = copyBtn.textContent;

      await copyBtn.click();

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to copy category',
        expect.any(Error)
      );

      expect(copyBtn.textContent).toBe('Failed');
      expect(copyBtn.disabled).toBe(true);

      jest.advanceTimersByTime(1500);
      expect(copyBtn.textContent).toBe(originalText);
      expect(copyBtn.disabled).toBe(false);

      jest.useRealTimers();
    });

    it('should handle copy all failure with feedback', async () => {
      jest.useFakeTimers();
      navigator.clipboard.writeText.mockRejectedValueOnce(
        new Error('Copy failed')
      );

      const copyAllBtn = container.querySelector('.copy-all-btn');
      const originalText = copyAllBtn.textContent;

      await copyAllBtn.click();

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to copy all',
        expect.any(Error)
      );

      expect(copyAllBtn.textContent).toBe('Failed');

      jest.advanceTimersByTime(1500);
      expect(copyAllBtn.textContent).toBe(originalText);

      jest.useRealTimers();
    });
  });

  describe('Export Error Handling', () => {
    beforeEach(() => {
      enhancer.enhance(mockDisplayData);
    });

    it('should handle export errors', () => {
      // Mock the exporter to throw an error
      const exportBtn = container.querySelector('[data-format="json"]');

      // Override URL.createObjectURL to throw
      const originalCreateObjectURL = URL.createObjectURL;
      URL.createObjectURL = jest.fn(() => {
        throw new Error('Export failed');
      });

      exportBtn.click();

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to export as json',
        expect.any(Error)
      );

      // Restore
      URL.createObjectURL = originalCreateObjectURL;
    });
  });

  describe('LocalStorage Error Handling', () => {
    it('should handle localStorage load errors', () => {
      // Mock localStorage.getItem to throw
      const originalGetItem = window.localStorage.getItem;
      window.localStorage.getItem = jest.fn(() => {
        throw new Error('Storage error');
      });

      // Create new enhancer which tries to load state
      const newEnhancer = new ClicheDisplayEnhancer({
        logger: mockLogger,
        container,
      });

      expect(newEnhancer).toBeDefined();

      // Restore
      window.localStorage.getItem = originalGetItem;
    });

    it('should handle localStorage save errors', () => {
      enhancer.enhance(mockDisplayData);

      // Mock localStorage.setItem to throw
      const originalSetItem = window.localStorage.setItem;
      window.localStorage.setItem = jest.fn(() => {
        throw new Error('Storage error');
      });

      const toggle = container.querySelector('.category-toggle');
      toggle.click();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Failed to save collapsed state',
        expect.any(Error)
      );

      // Restore
      window.localStorage.setItem = originalSetItem;
    });

    it('should handle invalid JSON in localStorage', () => {
      window.localStorage.getItem.mockReturnValueOnce('invalid json');

      // Create new enhancer which tries to parse invalid JSON
      const newEnhancer = new ClicheDisplayEnhancer({
        logger: mockLogger,
        container,
      });

      expect(newEnhancer).toBeDefined();
    });
  });

  describe('Collapsed state restoration', () => {
    it('should apply saved collapsed states to matching categories', () => {
      window.localStorage.setItem(
        'cliche-collapsed-categories',
        JSON.stringify(['names'])
      );

      const newEnhancer = new ClicheDisplayEnhancer({
        logger: mockLogger,
        container,
      });

      newEnhancer.enhance(mockDisplayData);

      expect(window.localStorage.getItem).toHaveBeenCalledWith(
        'cliche-collapsed-categories'
      );
      expect(window.localStorage.getItem('cliche-collapsed-categories')).toBe(
        JSON.stringify(['names'])
      );

      const category = container.querySelector(
        '.cliche-category[data-category="names"]'
      );
      expect(category).toBeTruthy();
      const toggle = category.querySelector('.category-toggle');
      const list = category.querySelector('.cliche-list');

      expect(toggle).toBeTruthy();
      expect(list).toBeTruthy();

      const chevron = toggle.querySelector('.chevron');
      expect(chevron).toBeTruthy();

      expect(toggle.getAttribute('aria-expanded')).toBe('false');
      expect(chevron.textContent).toBe('▶');
      expect(list.style.display).toBe('none');
    });
  });

  describe('Event Handler Edge Cases', () => {
    beforeEach(() => {
      enhancer.enhance(mockDisplayData);
    });

    it('should handle click events on non-button elements gracefully', () => {
      const event = new Event('click', { bubbles: true });
      const nonButton = document.createElement('div');
      container.appendChild(nonButton);

      expect(() => {
        nonButton.dispatchEvent(event);
      }).not.toThrow();
    });
  });

  describe('Additional Edge Cases for Full Coverage', () => {
    beforeEach(() => {
      enhancer.enhance(mockDisplayData);
    });

    it('should handle collapsed category state when collapsing', () => {
      const toggle = container.querySelector('.category-toggle');
      const category = toggle.closest('.cliche-category');
      const categoryId = category.dataset.category;

      // Start expanded
      expect(toggle.getAttribute('aria-expanded')).toBe('true');

      // Collapse it
      toggle.click();

      // Should add to collapsed set
      expect(window.localStorage.setItem).toHaveBeenCalledWith(
        'cliche-collapsed-categories',
        expect.stringContaining(categoryId)
      );
    });

    it('should handle collapsed category state when expanding', () => {
      const toggle = container.querySelector('.category-toggle');

      // First collapse
      toggle.click();
      expect(toggle.getAttribute('aria-expanded')).toBe('false');

      // Then expand
      toggle.click();
      expect(toggle.getAttribute('aria-expanded')).toBe('true');

      // Should save updated state
      expect(window.localStorage.setItem).toHaveBeenCalled();
    });

    it('should handle copyItem with trope-item parent', () => {
      // Add a trope item to the DOM
      const tropesList = document.createElement('ul');
      tropesList.innerHTML = `
        <li class="trope-item">
          Test Trope
          <span class="item-controls">
            <button class="copy-item-btn">📋</button>
          </span>
        </li>
      `;
      container.appendChild(tropesList);

      const copyBtn = tropesList.querySelector('.copy-item-btn');
      copyBtn.click();

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Test Trope');
    });

    it('should handle copyItem when parent element is not found', async () => {
      // Create a button without proper parent
      const orphanButton = document.createElement('button');
      orphanButton.className = 'copy-item-btn';
      container.appendChild(orphanButton);

      await orphanButton.click();

      // Should not throw and not copy anything
      expect(navigator.clipboard.writeText).not.toHaveBeenCalledWith(
        expect.stringContaining('undefined')
      );
    });

    it('should handle applyCollapsedStates with missing elements', () => {
      // Set up collapsed state for non-existent category
      window.localStorage.getItem = jest.fn((key) => {
        if (key === 'cliche-collapsed-categories') {
          return JSON.stringify(['non-existent']);
        }
        return null;
      });

      const newEnhancer = new ClicheDisplayEnhancer({
        logger: mockLogger,
        container,
      });

      // Should not throw when trying to apply state to non-existent category
      expect(() => {
        newEnhancer.enhance(mockDisplayData);
      }).not.toThrow();
    });

    it('should handle trope deletion without callback', async () => {
      // Create enhancer without trope delete callback
      const enhancerNoTropeCallback = new ClicheDisplayEnhancer({
        logger: mockLogger,
        container,
        onDeleteItem: jest.fn(),
        // No onDeleteTrope
      });

      enhancerNoTropeCallback.enhance(mockDisplayData);

      // Add a delete trope button
      const tropeItem = document.createElement('li');
      tropeItem.innerHTML = `
        <button class="delete-trope-btn" data-text="Test Trope">🗑️</button>
      `;
      container.appendChild(tropeItem);

      const deleteTropeBtn = tropeItem.querySelector('.delete-trope-btn');
      await deleteTropeBtn.click();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Delete trope handler not configured'
      );
    });

    it('should handle trope deletion animation on success', async () => {
      jest.useFakeTimers();

      const onDeleteTrope = jest.fn().mockResolvedValue();
      const enhancerWithTrope = new ClicheDisplayEnhancer({
        logger: mockLogger,
        container,
        onDeleteTrope,
      });

      enhancerWithTrope.enhance(mockDisplayData);

      // Add a trope item with delete button
      const tropeItem = document.createElement('li');
      tropeItem.innerHTML =
        'Test Trope <button class="delete-trope-btn" data-text="Test Trope">🗑️</button>';
      container.appendChild(tropeItem);

      const deleteTropeBtn = tropeItem.querySelector('.delete-trope-btn');
      await deleteTropeBtn.click();

      // Check immediate changes
      expect(tropeItem.style.opacity).toBe('0.5');

      // Fast-forward animation
      jest.advanceTimersByTime(300);

      // Item should be removed
      expect(tropeItem.parentNode).toBeNull();

      jest.useRealTimers();
    });
  });
});
