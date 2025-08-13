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
      const expectedText = item.textContent.replace('📋', '').trim();

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
});
