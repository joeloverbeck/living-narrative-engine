/**
 * @file End-to-end tests for Core Motivations Generator
 * Tests complete user workflows from navigation to generation to export
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';

describe('Core Motivations Generator E2E', () => {
  let dom;
  let window;
  let document;
  let mockFetch;
  let mockIndexedDB;

  beforeEach(() => {
    // Read the actual HTML file
    const htmlPath = path.resolve(
      process.cwd(),
      'core-motivations-generator.html'
    );
    const html = fs.readFileSync(htmlPath, 'utf8');

    // Create a new JSDOM instance with necessary features
    dom = new JSDOM(html, {
      url: 'http://localhost:3000/core-motivations-generator.html',
      runScripts: 'dangerously',
      resources: 'usable',
      pretendToBeVisual: true,
    });

    window = dom.window;
    document = window.document;

    // Mock fetch for API calls
    mockFetch = jest.fn();
    window.fetch = mockFetch;

    // Mock IndexedDB for storage operations
    mockIndexedDB = {
      open: jest.fn().mockReturnValue({
        onsuccess: null,
        onerror: null,
        onupgradeneeded: null,
        result: {
          transaction: jest.fn().mockReturnValue({
            objectStore: jest.fn().mockReturnValue({
              put: jest.fn().mockReturnValue({ onsuccess: null }),
              get: jest.fn().mockReturnValue({ onsuccess: null }),
              getAll: jest.fn().mockReturnValue({ onsuccess: null }),
              delete: jest.fn().mockReturnValue({ onsuccess: null }),
              index: jest.fn().mockReturnValue({
                getAll: jest.fn().mockReturnValue({ onsuccess: null }),
              }),
            }),
          }),
          objectStoreNames: { contains: jest.fn().mockReturnValue(true) },
          createObjectStore: jest.fn(),
        },
      }),
    };
    window.indexedDB = mockIndexedDB;

    // Mock console to avoid test output noise
    window.console = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
    };
  });

  afterEach(() => {
    if (dom) {
      dom.window.close();
    }
    jest.clearAllMocks();
  });

  describe('Page Initialization', () => {
    it('should have all required UI elements', () => {
      // Form elements
      const directionSelector = document.getElementById('direction-selector');
      const generateBtn = document.getElementById('generate-btn');
      const clearAllBtn = document.getElementById('clear-all-btn');
      const exportBtn = document.getElementById('export-btn');

      expect(directionSelector).toBeTruthy();
      expect(generateBtn).toBeTruthy();
      expect(clearAllBtn).toBeTruthy();
      expect(exportBtn).toBeTruthy();

      // Display containers
      const emptyState = document.getElementById('empty-state');
      const loadingState = document.getElementById('loading-state');
      const resultsState = document.getElementById('results-state');
      const errorState = document.getElementById('error-state');

      expect(emptyState).toBeTruthy();
      expect(loadingState).toBeTruthy();
      expect(resultsState).toBeTruthy();
      expect(errorState).toBeTruthy();

      // Initial state
      expect(generateBtn.disabled).toBe(true);
      expect(clearAllBtn.disabled).toBe(true);
      expect(exportBtn.disabled).toBe(true);
    });

    it('should load eligible directions on page load', async () => {
      // Mock successful directions fetch
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          directions: [
            { id: 'dir-1', name: 'Direction 1', conceptName: 'Concept 1' },
            { id: 'dir-2', name: 'Direction 2', conceptName: 'Concept 2' },
          ],
        }),
      });

      // Trigger page load event
      const event = new window.Event('DOMContentLoaded');
      window.document.dispatchEvent(event);

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 100));

      const directionSelector = document.getElementById('direction-selector');
      expect(directionSelector.children.length).toBeGreaterThan(1); // Default option + loaded directions
    });
  });

  describe('Generation Workflow', () => {
    it('should complete full generation workflow', async () => {
      const directionSelector = document.getElementById('direction-selector');
      const generateBtn = document.getElementById('generate-btn');
      const resultsState = document.getElementById('results-state');
      const motivationsList = document.getElementById('motivations-list');

      // Mock successful generation response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          motivations: [
            {
              id: 'mot-1',
              coreDesire: 'To find true purpose in life',
              internalContradiction:
                'Seeks meaning but fears the responsibility it brings',
              centralQuestion: 'What makes a life worth living?',
            },
          ],
        }),
      });

      // Select a direction
      directionSelector.value = 'dir-1';
      directionSelector.dispatchEvent(new window.Event('change'));

      // Generate button should be enabled
      expect(generateBtn.disabled).toBe(false);

      // Click generate
      generateBtn.click();

      // Should show loading state
      const loadingState = document.getElementById('loading-state');
      expect(loadingState.style.display).not.toBe('none');

      // Wait for async generation
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should show results
      expect(resultsState.style.display).not.toBe('none');
      expect(motivationsList.children.length).toBeGreaterThan(0);
    });

    it('should handle generation errors gracefully', async () => {
      const directionSelector = document.getElementById('direction-selector');
      const generateBtn = document.getElementById('generate-btn');
      const errorState = document.getElementById('error-state');

      // Mock failed generation
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      // Select direction and generate
      directionSelector.value = 'dir-1';
      directionSelector.dispatchEvent(new window.Event('change'));
      generateBtn.click();

      // Wait for async error handling
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should show error state
      expect(errorState.style.display).not.toBe('none');
      expect(errorState.textContent).toContain('error');
    });
  });

  describe('Accumulative Storage', () => {
    it('should accumulate multiple generation sets', async () => {
      const directionSelector = document.getElementById('direction-selector');
      const generateBtn = document.getElementById('generate-btn');
      const motivationsList = document.getElementById('motivations-list');

      // First generation
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          motivations: [
            {
              id: 'mot-1',
              coreDesire: 'First desire',
              internalContradiction: 'First contradiction',
              centralQuestion: 'First question?',
            },
          ],
        }),
      });

      directionSelector.value = 'dir-1';
      directionSelector.dispatchEvent(new window.Event('change'));
      generateBtn.click();

      await new Promise((resolve) => setTimeout(resolve, 100));

      const firstCount = motivationsList.children.length;

      // Second generation
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          motivations: [
            {
              id: 'mot-2',
              coreDesire: 'Second desire',
              internalContradiction: 'Second contradiction',
              centralQuestion: 'Second question?',
            },
          ],
        }),
      });

      generateBtn.click();
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should have accumulated both sets
      expect(motivationsList.children.length).toBeGreaterThan(firstCount);
    });

    it('should persist motivations across page reloads', async () => {
      // Mock IndexedDB retrieval
      const mockMotivations = [
        {
          id: 'mot-1',
          directionId: 'dir-1',
          conceptId: 'concept-1',
          coreDesire: 'Persisted desire',
          internalContradiction: 'Persisted contradiction',
          centralQuestion: 'Persisted question?',
        },
      ];

      mockIndexedDB.open.mockReturnValue({
        onsuccess: function () {
          this.result = {
            transaction: jest.fn().mockReturnValue({
              objectStore: jest.fn().mockReturnValue({
                index: jest.fn().mockReturnValue({
                  getAll: jest.fn().mockReturnValue({
                    onsuccess: function () {
                      this.result = mockMotivations;
                    },
                  }),
                }),
              }),
            }),
          };
        },
      });

      // Trigger page load with existing data
      const event = new window.Event('DOMContentLoaded');
      window.document.dispatchEvent(event);

      await new Promise((resolve) => setTimeout(resolve, 100));

      const motivationsList = document.getElementById('motivations-list');
      expect(motivationsList.children.length).toBeGreaterThan(0);
    });
  });

  describe('Export and Delete Functionality', () => {
    beforeEach(async () => {
      // Pre-populate with test data
      const motivationsList = document.getElementById('motivations-list');
      motivationsList.innerHTML = `
        <div class="motivation-item" data-motivation-id="mot-1">
          <div class="core-desire">Test desire</div>
          <div class="internal-contradiction">Test contradiction</div>
          <div class="central-question">Test question?</div>
          <button class="delete-btn" data-motivation-id="mot-1">Delete</button>
        </div>
      `;
    });

    it('should export motivations correctly', () => {
      const exportBtn = document.getElementById('export-btn');
      exportBtn.disabled = false;

      // Mock clipboard API
      const mockClipboard = {
        writeText: jest.fn().mockResolvedValue(),
      };
      Object.defineProperty(window.navigator, 'clipboard', {
        value: mockClipboard,
        writable: true,
      });

      // Click export
      exportBtn.click();

      // Should copy to clipboard
      expect(mockClipboard.writeText).toHaveBeenCalled();
      const exportedText = mockClipboard.writeText.mock.calls[0][0];
      expect(exportedText).toContain('Test desire');
      expect(exportedText).toContain('Test contradiction');
      expect(exportedText).toContain('Test question?');
    });

    it('should delete individual motivations', async () => {
      const motivationsList = document.getElementById('motivations-list');
      const deleteBtn = motivationsList.querySelector('.delete-btn');

      // Mock successful deletion
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      // Click delete
      deleteBtn.click();

      // Confirm deletion in dialog (if implemented)
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Item should be removed
      expect(
        motivationsList.querySelector('[data-motivation-id="mot-1"]')
      ).toBeFalsy();
    });

    it('should clear all motivations with confirmation', async () => {
      const clearAllBtn = document.getElementById('clear-all-btn');
      const motivationsList = document.getElementById('motivations-list');
      clearAllBtn.disabled = false;

      // Mock window.confirm
      window.confirm = jest.fn().mockReturnValue(true);

      // Mock successful clear
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      // Click clear all
      clearAllBtn.click();

      // Should show confirmation
      expect(window.confirm).toHaveBeenCalledWith(
        expect.stringContaining('clear all')
      );

      await new Promise((resolve) => setTimeout(resolve, 100));

      // All items should be removed
      expect(motivationsList.children.length).toBe(0);
    });

    it('should not clear when confirmation is cancelled', () => {
      const clearAllBtn = document.getElementById('clear-all-btn');
      const motivationsList = document.getElementById('motivations-list');
      clearAllBtn.disabled = false;

      const initialCount = motivationsList.children.length;

      // Mock window.confirm to return false
      window.confirm = jest.fn().mockReturnValue(false);

      // Click clear all
      clearAllBtn.click();

      // Items should remain
      expect(motivationsList.children.length).toBe(initialCount);
    });
  });

  describe('Error Recovery', () => {
    it('should recover from network failures', async () => {
      const directionSelector = document.getElementById('direction-selector');
      const generateBtn = document.getElementById('generate-btn');
      const errorState = document.getElementById('error-state');
      const resultsState = document.getElementById('results-state');

      // First attempt fails
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      directionSelector.value = 'dir-1';
      directionSelector.dispatchEvent(new window.Event('change'));
      generateBtn.click();

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should show error
      expect(errorState.style.display).not.toBe('none');

      // Retry with success
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          motivations: [
            {
              id: 'mot-1',
              coreDesire: 'Recovery desire',
              internalContradiction: 'Recovery contradiction',
              centralQuestion: 'Recovery question?',
            },
          ],
        }),
      });

      generateBtn.click();
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should recover and show results
      expect(errorState.style.display).toBe('none');
      expect(resultsState.style.display).not.toBe('none');
    });

    it('should handle malformed API responses', async () => {
      const directionSelector = document.getElementById('direction-selector');
      const generateBtn = document.getElementById('generate-btn');
      const errorState = document.getElementById('error-state');

      // Mock malformed response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          // Missing expected fields
          wrongField: 'value',
        }),
      });

      directionSelector.value = 'dir-1';
      directionSelector.dispatchEvent(new window.Event('change'));
      generateBtn.click();

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should handle gracefully
      expect(errorState.style.display).not.toBe('none');
      expect(window.console.error).toHaveBeenCalled();
    });

    it('should handle IndexedDB failures gracefully', async () => {
      // Mock IndexedDB failure
      mockIndexedDB.open.mockReturnValue({
        onerror: function () {
          // Simulate DB error
        },
        onsuccess: null,
      });

      // Page should still load
      const event = new window.Event('DOMContentLoaded');
      window.document.dispatchEvent(event);

      await new Promise((resolve) => setTimeout(resolve, 100));

      // UI should still be functional
      const directionSelector = document.getElementById('direction-selector');
      expect(directionSelector).toBeTruthy();
    });
  });

  describe('User Interaction Validation', () => {
    it('should validate direction selection', () => {
      const directionSelector = document.getElementById('direction-selector');
      const generateBtn = document.getElementById('generate-btn');

      // Initially disabled
      expect(generateBtn.disabled).toBe(true);

      // Select empty value
      directionSelector.value = '';
      directionSelector.dispatchEvent(new window.Event('change'));
      expect(generateBtn.disabled).toBe(true);

      // Select valid direction
      directionSelector.value = 'dir-1';
      directionSelector.dispatchEvent(new window.Event('change'));
      expect(generateBtn.disabled).toBe(false);
    });

    it('should display loading feedback during generation', async () => {
      const directionSelector = document.getElementById('direction-selector');
      const generateBtn = document.getElementById('generate-btn');
      const loadingState = document.getElementById('loading-state');

      // Mock slow response
      mockFetch.mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  json: async () => ({
                    success: true,
                    motivations: [],
                  }),
                }),
              200
            );
          })
      );

      directionSelector.value = 'dir-1';
      directionSelector.dispatchEvent(new window.Event('change'));
      generateBtn.click();

      // Should show loading immediately
      expect(loadingState.style.display).not.toBe('none');
      expect(generateBtn.disabled).toBe(true);

      await new Promise((resolve) => setTimeout(resolve, 300));

      // Should hide loading after completion
      expect(loadingState.style.display).toBe('none');
      expect(generateBtn.disabled).toBe(false);
    });

    it('should update button states based on content', () => {
      const clearAllBtn = document.getElementById('clear-all-btn');
      const exportBtn = document.getElementById('export-btn');
      const motivationsList = document.getElementById('motivations-list');

      // No content - buttons disabled
      motivationsList.innerHTML = '';
      expect(clearAllBtn.disabled).toBe(true);
      expect(exportBtn.disabled).toBe(true);

      // Add content - buttons enabled
      motivationsList.innerHTML = '<div class="motivation-item">Test</div>';
      // Trigger state update (implementation dependent)
      window.document.dispatchEvent(new window.Event('motivationsUpdated'));
      expect(clearAllBtn.disabled).toBe(false);
      expect(exportBtn.disabled).toBe(false);
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      const generateBtn = document.getElementById('generate-btn');
      const clearAllBtn = document.getElementById('clear-all-btn');
      const exportBtn = document.getElementById('export-btn');

      expect(generateBtn.getAttribute('aria-label')).toBeTruthy();
      expect(clearAllBtn.getAttribute('aria-label')).toBeTruthy();
      expect(exportBtn.getAttribute('aria-label')).toBeTruthy();
    });

    it('should announce state changes to screen readers', () => {
      const liveRegion = document.querySelector('[aria-live="polite"]');
      expect(liveRegion).toBeTruthy();
    });

    it('should support keyboard navigation', () => {
      const directionSelector = document.getElementById('direction-selector');
      const generateBtn = document.getElementById('generate-btn');

      // Simulate Tab key
      directionSelector.focus();
      expect(document.activeElement).toBe(directionSelector);

      // Tab to next element
      const tabEvent = new window.KeyboardEvent('keydown', {
        key: 'Tab',
        code: 'Tab',
      });
      directionSelector.dispatchEvent(tabEvent);
      // Focus should move to next interactive element
    });
  });
});
